import json
import os
import logging
from typing import Optional
import redis

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
        self.output_file = os.path.join(settings.BASE_DIR, "screen_analysis_output.json")
        
        if HAS_GENAI and getattr(settings, 'GEMINI_API_KEY', None):
            genai.configure(api_key=settings.GEMINI_API_KEY)
            self.model = genai.GenerativeModel('gemini-2.5-flash')
        else:
            self.model = None
            
        try:
            self.redis_client = redis.Redis(host='localhost', port=6379, db=0, decode_responses=True)
        except Exception as e:
            logger.error(f"Failed to connect to Redis: {e}")
            self.redis_client = None

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

        if self.model:
            # Smart caching: Hash the DOM state to avoid calling Gemini if nothing changed!
            # We ignore the image to save API calls when the UI state is identical
            state_str = json.dumps(request.dom_data, sort_keys=True) if request.dom_data else "No DOM data"
            import hashlib
            current_hash = hashlib.md5(state_str.encode()).hexdigest()
            
            if hasattr(self, 'last_state_hash') and self.last_state_hash == current_hash and hasattr(self, 'last_response'):
                # State hasn't changed, reuse the previous LLM response to save quota!
                logger.info("DOM state identical to last request. Returning cached LLM response to save API quota.")
                import copy
                cached_response = copy.deepcopy(self.last_response)
                # Update status on the copied response to show it was cached
                cached_response.status = "SUCCESS_CACHED"
                self._log_to_redis(request, cached_response)
                return cached_response

            import google.api_core.exceptions
            for attempt in range(len(settings.GEMINI_API_KEYS) or 1):
                try:
                    # Dynamically set the API key for this attempt
                    current_key = settings.get_next_gemini_key()
                    if current_key:
                        genai.configure(api_key=current_key)
                        
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
                    
                    # Cache the successful result
                    self.last_state_hash = current_hash
                    self.last_response = response
                    break # Success! Break out of the retry loop

                except google.api_core.exceptions.ResourceExhausted as e:
                    logger.warning(f"Key rate limited (429). Attempt {attempt + 1}/{len(settings.GEMINI_API_KEYS)}")
                    if attempt == len(settings.GEMINI_API_KEYS) - 1:
                        response.status = f"ERROR_LLM_QUOTA: {str(e)}"
                        response.observations = "API Quota Exceeded on all keys. Fallback to DOM rules."
                        self._fallback_analysis(request.dom_data, response)

                except Exception as e:
                    response.status = f"ERROR_LLM: {str(e)}"
                    response.observations = "Error calling Vision LLM. Fallback to DOM data."
                    self._fallback_analysis(request.dom_data, response)
                    break # Non-quota error, don't retry
        else:
            # Fallback heuristic using DOM data if no API key or no module
            response.status = "SUCCESS_NO_LLM"
            self._fallback_analysis(request.dom_data, response)
            
        # Write detailed analysis results to Redis
        self._log_to_redis(request, response)
        
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

    def _log_to_redis(self, request: ScreenAnalysisRequest, response: ScreenAnalysisResponse):
        if not self.redis_client:
            return

        log_entry = {
            "timestamp": request.timestamp,
            "session_id": request.session_id,
            "student_identity": request.student_login_identity,
            "page_url": request.page_url,
            "dom_data_received": bool(request.dom_data),
            "analysis_result": response.dict()
        }
        
        try:
            key = f"track:{request.session_id}:{request.student_login_identity or 'unknown'}"
            self.redis_client.rpush(key, json.dumps(log_entry))
            # Set an expiration of 1 day to clean up old sessions automatically
            self.redis_client.expire(key, 86400)
        except Exception as e:
            logger.error(f"Failed to write to Redis: {e}")
