import json
import os
import logging
import time
from typing import Optional
import requests

from config import settings
from models.schemas import ScreenAnalysisRequest, ScreenAnalysisResponse

logger = logging.getLogger(__name__)

try:
    import google.generativeai as genai
    from google.generativeai.types import GenerationConfig
    HAS_GENAI = True
except ImportError:
    HAS_GENAI = False

class ScreenAnalysisService:
    def __init__(self):
        self.output_file = os.path.join(settings.BASE_DIR, "screen_analysis_output.jsonl")
        self.use_ollama_vision = getattr(settings, "USE_OLLAMA_VISION", True)
        self.ollama_base_url = getattr(settings, "OLLAMA_BASE_URL", "http://localhost:11434")
        self.ollama_vision_model = getattr(settings, "OLLAMA_VISION_MODEL", "llama3.2-vision")
        self._ollama_model_ready_cache_until = 0.0
        self._ollama_model_ready = False
        
        if HAS_GENAI and getattr(settings, 'GEMINI_API_KEY', None):
            genai.configure(api_key=settings.GEMINI_API_KEY)
            self.model = genai.GenerativeModel('gemini-2.5-flash')
        else:
            self.model = None

    def _build_analysis_prompt(self, dom_context: str) -> str:
        return f"""
                You are an AI educational tutor observing a student's screen on the Vittascience platform.
                Analyze the provided screenshot and the following DOM data extracted from the page:
                
                DOM Data:
                {dom_context}
                
                Based on both the screenshot and the DOM data, determine:
                1. What is the exercise name?
                2. What is the progress level? Choose strictly one from: [NOT_STARTED, STARTING, IN_PROGRESS, NEAR_COMPLETE, COMPLETE]
                   - NOT_STARTED: No categories or data.
                   - STARTING: Categories named, adding data.
                   - IN_PROGRESS: Training data ready, but model not trained, or training in progress, or missing category names.
                   - NEAR_COMPLETE: Model trained, testing in preview but not fully tested.
                   - COMPLETE: Everything working, prediction showing high confidence.
                3. Is the student on track? (true or false). Look for mistakes like unnamed categories, or unbalanced data.
                4. Create a short observation text explaining what they are doing and if they made mistakes.
                
                Return exactly a JSON object with these keys:
                "exercise_name" (str), "progress_level" (str), "on_track" (bool), "observations" (str)
                Do not wrap in Markdown blocks.
                """

    def _parse_json_text(self, raw_text: str) -> dict:
        text = (raw_text or "").strip()
        if text.startswith("```"):
            text = text.replace("```json", "").replace("```", "").strip()
        return json.loads(text)

    def _is_ollama_model_ready(self) -> bool:
        now = time.time()
        if now < self._ollama_model_ready_cache_until:
            return self._ollama_model_ready

        try:
            tags_url = f"{self.ollama_base_url}/api/tags"
            r = requests.get(tags_url, timeout=settings.API_TIMEOUT)
            r.raise_for_status()
            models = r.json().get("models", [])
            names = {m.get("name", "") for m in models}
            self._ollama_model_ready = self.ollama_vision_model in names
        except Exception:
            self._ollama_model_ready = False

        # Refresh every 30 seconds to avoid hammering /api/tags
        self._ollama_model_ready_cache_until = now + 30
        return self._ollama_model_ready

    def _ask_ollama_vision(self, prompt: str, screenshot_base64: str) -> dict:
        url = f"{self.ollama_base_url}/api/generate"
        payload = {
            "model": self.ollama_vision_model,
            "prompt": prompt,
            "stream": False,
            "format": "json",
            "images": [screenshot_base64],
            "options": {"temperature": 0.2}
        }

        response = requests.post(url, json=payload, timeout=settings.API_TIMEOUT)
        if response.status_code == 404:
            # Common case: model not pulled yet. Return clear status upstream.
            try:
                detail = response.json().get("error", "model not found")
            except Exception:
                detail = "model not found"
            raise RuntimeError(f"OLLAMA_MODEL_NOT_READY: {detail}")

        response.raise_for_status()
        data = response.json()
        return self._parse_json_text(data.get("response", ""))

    def analyze_screen(self, request: ScreenAnalysisRequest) -> ScreenAnalysisResponse:
        # Prepare the base response
        response = ScreenAnalysisResponse(
            status="SUCCESS",
            exercise_name="Unknown",
            progress_level="NOT_STARTED",
            on_track=True,
            observations="N/A"
        )
        
        # Merge DOM data and screenshot to analyze
        dom_context = json.dumps(request.dom_data) if request.dom_data else "No DOM data available"
        prompt = self._build_analysis_prompt(dom_context)

        # Prefer local Ollama vision to avoid external API quotas.
        if self.use_ollama_vision:
            if not self._is_ollama_model_ready():
                response.status = "MODEL_NOT_READY_OLLAMA"
                response.observations = f"Ollama model '{self.ollama_vision_model}' is not ready yet. Fallback to DOM data."
                self._fallback_analysis(request.dom_data, response)
                self._log_to_file(request, response)
                return response

            try:
                result_json = self._ask_ollama_vision(prompt, request.screenshot_base64)
                response.status = "SUCCESS_OLLAMA"
                response.exercise_name = result_json.get("exercise_name", "Unknown")
                response.progress_level = result_json.get("progress_level", "NOT_STARTED")
                response.on_track = result_json.get("on_track", True)
                response.observations = result_json.get("observations", "No observations")
                self._log_to_file(request, response)
                return response
            except Exception as e:
                err = str(e)
                if err.startswith("OLLAMA_MODEL_NOT_READY:"):
                    response.status = "MODEL_NOT_READY_OLLAMA"
                else:
                    response.status = f"ERROR_OLLAMA: {err}"
                response.observations = "Error calling local Ollama. Fallback to DOM data."
                self._fallback_analysis(request.dom_data, response)
                self._log_to_file(request, response)
                return response
        
        if not self.use_ollama_vision and self.model:
            try:
                # We need to construct the image part for Gemini API
                image_parts = [
                    {
                        "mime_type": "image/jpeg",
                        "data": request.screenshot_base64
                    }
                ]
                
                result = self.model.generate_content(
                    contents=[prompt, image_parts[0]],
                    generation_config=GenerationConfig(
                        temperature=0.2,
                        response_mime_type="application/json"
                    )
                )
                
                result_json = self._parse_json_text(result.text)
                
                response.exercise_name = result_json.get("exercise_name", "Unknown")
                response.progress_level = result_json.get("progress_level", "NOT_STARTED")
                response.on_track = result_json.get("on_track", True)
                response.observations = result_json.get("observations", "No observations")
                
            except Exception as e:
                response.status = f"ERROR_LLM: {str(e)}"
                response.observations = "Error calling Vision LLM. Fallback to DOM data."
                self._fallback_analysis(request.dom_data, response)
        else:
            # Fallback heuristic using DOM data if no API key or no module
            response.status = "SUCCESS_NO_LLM"
            self._fallback_analysis(request.dom_data, response)
            
        # Write detailed analysis results to JSONL file
        self._log_to_file(request, response)
        
        return response

    def _fallback_analysis(self, dom_data: Optional[dict], response: ScreenAnalysisResponse):
        """Simple rules-based fallback using just the DOM data when no LLM is available."""
        if not dom_data:
            response.observations = "No DOM data or LLM."
            return
            
        categories = dom_data.get("categories", [])
        training = dom_data.get("trainingState", {})
        predictions = dom_data.get("predictions", [])
        
        if dom_data.get("exerciseInfo"):
            response.exercise_name = dom_data.get("exerciseInfo").get("title", "Unknown")
            
        if not categories:
            response.progress_level = "NOT_STARTED"
            response.observations = "Student has not started yet."
        elif not training.get("modelTrained"):
            has_empty_names = any(not c.get("name") for c in categories)
            response.progress_level = "IN_PROGRESS"
            if has_empty_names:
                response.on_track = False
                response.observations = "Student added data but forgot to name a category."
            else:
                response.on_track = True
                response.observations = f"Student created {len(categories)} categories. Ready to train."
        elif training.get("modelTrained"):
            if predictions:
                response.progress_level = "COMPLETE"
                top_pred = max(predictions, key=lambda x: x.get("confidence", 0)) if predictions else None
                if top_pred and top_pred.get("confidence", 0) > 80:
                    response.observations = f"Model works! Detected {top_pred['category']} with {top_pred['confidence']}%."
                else:
                    response.observations = "Model trained and testing."
            else:
                response.progress_level = "NEAR_COMPLETE"
                response.observations = "Model is trained, waiting for student to test it."

    def _log_to_file(self, request: ScreenAnalysisRequest, response: ScreenAnalysisResponse):
        log_entry = {
            "timestamp": request.timestamp,
            "session_id": request.session_id,
            "student_identity": request.student_login_identity,
            "page_url": request.page_url,
            "dom_data_received": bool(request.dom_data),
            "analysis_result": response.dict()
        }
        
        try:
            with open(self.output_file, 'a', encoding='utf-8') as f:
                f.write(json.dumps(log_entry, ensure_ascii=False) + '\n')
        except Exception:
            pass
