import json
import os
import base64
import logging
from datetime import datetime, timezone
from typing import Optional

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
        self.sessions_dir = "pedagogy_sessions"
        os.makedirs(self.sessions_dir, exist_ok=True)
        
        if HAS_GENAI and getattr(settings, 'GEMINI_API_KEY', None):
            genai.configure(api_key=settings.GEMINI_API_KEY)
            self.model = genai.GenerativeModel('gemini-2.5-flash')
        else:
            self.model = None

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
        
        if self.model:
            try:
                prompt = f"""
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
                
                result_json = json.loads(result.text)
                
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
            
        # Write to JSONL file for debugging
        self._log_to_file(request, response)
        
        # Save to pedagogy session JSON file (main persistence)
        self._save_vittascience_to_pedagogy_json(request, response)
        
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
            "participant_id": request.participant_id,
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

    def _save_vittascience_to_pedagogy_json(self, request: ScreenAnalysisRequest, response: ScreenAnalysisResponse):
        """Save Vittascience analysis to pedagogy session JSON file (same format as CodeCombat)"""
        logger.info(f"[Vittascience] Saving analysis - Session: {request.session_id}, Student: {request.student_login_identity}, Exercise: {response.exercise_name}")
        
        if not request.session_id:
            logger.warning("[Vittascience] No session_id provided - skipping JSON save")
            return
        
        filepath = os.path.join(self.sessions_dir, f"{request.session_id}.json")
        logger.debug(f"[Vittascience] JSON path: {filepath}")
        
        # Load existing data or create new structure
        data = {"sessionId": request.session_id, "students": {}}
        if os.path.exists(filepath):
            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    data = json.load(f)
                logger.debug(f"[Vittascience] Loaded existing file with {len(data.get('students', {}))} students")
            except Exception as e:
                logger.warning(f"[Vittascience] Failed to load existing file: {e}")
                pass

        # Use student identity or participant ID as the key
        key = request.student_login_identity or request.participant_id or "anonymous"
        logger.debug(f"[Vittascience] Using student key: {key}")
        
        # Initialize student record if not exists
        if key not in data["students"]:
            data["students"][key] = {
                "studentId": key,
                "site": "vittascience",
                "startedAt": datetime.now(timezone.utc).isoformat(),
                "summary": {
                    "exercisesStarted": 0,
                    "exercisesCompleted": 0,
                    "currentExercise": response.exercise_name or "Unknown",
                    "totalEvents": 0
                },
                "events": []
            }
            logger.info(f"[Vittascience] Created new student record for {key}")

        student_data = data["students"][key]
        student_data["lastUpdatedAt"] = datetime.now(timezone.utc).isoformat()
        student_data["summary"]["currentExercise"] = response.exercise_name or "Unknown"
        student_data["summary"]["totalEvents"] += 1
        
        # Update summary based on progress level
        if response.progress_level == "COMPLETE":
            student_data["summary"]["exercisesCompleted"] += 1
        elif response.progress_level in ["IN_PROGRESS", "STARTING"]:
            student_data["summary"]["exercisesStarted"] += 1

        # Create event record
        event = {
            "timestamp": request.timestamp or datetime.now(timezone.utc).isoformat(),
            "exerciseName": response.exercise_name or "Unknown",
            "progressLevel": response.progress_level,
            "onTrack": response.on_track,
            "observations": response.observations,
            "site": "vittascience",
            "domDataReceived": bool(request.dom_data),
            "domExtracted": {
                "categories": request.dom_data.get("categories", []) if request.dom_data else [],
                "predictions": request.dom_data.get("predictions", []) if request.dom_data else [],
                "trainingState": request.dom_data.get("trainingState", {}) if request.dom_data else {}
            } if request.dom_data else None
        }

        student_data["events"].append(event)
        logger.debug(f"[Vittascience] Added event - Progress: {response.progress_level}, Exercise: {response.exercise_name}")

        # Save updated data
        try:
            with open(filepath, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            logger.info(f"[Vittascience] ✓ JSON saved: {filepath} ({len(data['students'][key]['events'])} events)")
        except Exception as e:
            logger.error(f"[Vittascience] ✗ Failed to save JSON: {e}", exc_info=True)
