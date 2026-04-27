import copy
import hashlib
import json
import logging
import os
from datetime import datetime
from typing import Optional

import redis
import requests

from app.core.config import settings
from app.models.schemas import ScreenAnalysisRequest, ScreenAnalysisResponse

logger = logging.getLogger(__name__)


class ScreenAnalysisService:

    def __init__(self):
        # OpenRouter requires API key
        self.api_available = bool(settings.OPENROUTER_API_KEY)
        if not self.api_available:
            logger.warning("OPENROUTER_API_KEY not set — screen analysis will use fallback mode only")

        try:
            self.redis_client = redis.Redis(
                host=settings.REDIS_HOST, port=settings.REDIS_PORT, db=0, decode_responses=True
            )
        except Exception as e:
            logger.error("Failed to connect to Redis: %s", e)
            self.redis_client = None

        # Track previous code per session for delta analysis
        self.previous_code = {}

    def _analyze_python_module(self, request: ScreenAnalysisRequest, response: ScreenAnalysisResponse) -> ScreenAnalysisResponse:
        """Analyze Python module execution data and track code changes."""
        python_data = request.python_module_data or {}
        code = python_data.get("code", "")
        output = python_data.get("consoleOutput", "")
        module = python_data.get("activeModule", "Unknown")

        response.exercise_name = f"Python: {module}"
        response.status = "SUCCESS_PYTHON"

        # Get session key for tracking
        session_key = request.session_id
        prev_code = self.previous_code.get(session_key, "")

        # Detect what changed
        added_code = self._detect_code_changes(prev_code, code)

        # Determine progress and observations
        if not code or len(code.strip()) == 0:
            response.progress_level = "NOT_STARTED"
            response.observations = "Student hasn't written any code yet."
        elif output and len(output.strip()) > 0:
            response.progress_level = "COMPLETE"
            response.on_track = True
            output_preview = output[:80].strip()
            if added_code:
                response.observations = f"Added: {added_code} → Output: {output_preview}"
            else:
                response.observations = f"Executed. Output: {output_preview}"
        else:
            response.progress_level = "IN_PROGRESS"
            response.on_track = True
            if added_code:
                response.observations = f"Added: {added_code}"
            else:
                code_lines = len([l for l in code.split("\n") if l.strip()])
                response.observations = f"Writing code ({code_lines} lines total)."

        # Store current code for next comparison
        self.previous_code[session_key] = code

        self._log_to_file(request, response)
        return response

    def _detect_code_changes(self, prev_code: str, current_code: str) -> str:
        """Detect what was added between previous and current code."""
        prev_lines = set(l.strip() for l in prev_code.split("\n") if l.strip())
        curr_lines = [l.strip() for l in current_code.split("\n") if l.strip()]

        # Find new lines
        added_lines = [l for l in curr_lines if l not in prev_lines]

        if not added_lines:
            return ""

        # Extract meaningful parts
        changes = []
        for line in added_lines[:3]:  # Show max 3 most recent additions
            # Simplify for readability
            if "for" in line.lower():
                changes.append("for loop")
            elif "while" in line.lower():
                changes.append("while loop")
            elif "if" in line.lower():
                changes.append("if statement")
            elif "def" in line.lower():
                changes.append("function definition")
            elif "import" in line.lower():
                changes.append("import statement")
            elif "print" in line.lower():
                # Extract what's being printed
                try:
                    print_content = line.split("(", 1)[1].rsplit(")", 1)[0][:30]
                    changes.append(f'print("{print_content}")')
                except:
                    changes.append("print statement")
            elif "=" in line and not any(op in line for op in ["==", "!=", "<=", ">="]):
                # Variable assignment
                var_name = line.split("=")[0].strip()[:15]
                changes.append(f"{var_name} assignment")
            else:
                changes.append(line[:40])

        return " + ".join(changes) if changes else ""

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
        if not text:
            raise ValueError("LLM returned empty response")
        if text.startswith("```"):
            text = text.replace("```json", "").replace("```", "").strip()
        start = text.find("{")
        end = text.rfind("}") + 1
        if start != -1 and end > start:
            text = text[start:end]
        return json.loads(text)

    def analyze_screen(self, request: ScreenAnalysisRequest) -> ScreenAnalysisResponse:
        response = ScreenAnalysisResponse(
            status="SUCCESS",
            exercise_name="Unknown",
            progress_level="NOT_STARTED",
            on_track=True,
            observations="N/A",
        )

        # Check if this is Python module execution
        if request.python_module_data and request.python_module_data.get("isPythonModule"):
            return self._analyze_python_module(request, response)

        dom_context = json.dumps(request.dom_data) if request.dom_data else "No DOM data available"
        prompt = self._build_analysis_prompt(dom_context)

        if self.api_available:
            state_str = json.dumps(request.dom_data, sort_keys=True) if request.dom_data else "No DOM data"
            current_hash = hashlib.md5(state_str.encode()).hexdigest()

            if (
                hasattr(self, "last_state_hash")
                and self.last_state_hash == current_hash
                and hasattr(self, "last_response")
            ):
                logger.info("DOM state identical — returning cached LLM response")
                cached = copy.deepcopy(self.last_response)
                cached.status = "SUCCESS_CACHED"
                self._log_to_file(request, cached)
                return cached

            try:
                messages = [
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image_url",
                                "image_url": {"url": f"data:image/jpeg;base64,{request.screenshot_base64}"},
                            },
                            {"type": "text", "text": prompt},
                        ],
                    }
                ]

                resp = requests.post(
                    f"{settings.OPENROUTER_BASE_URL}/chat/completions",
                    headers={
                        "Content-Type": "application/json",
                        "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
                    },
                    json={
                        "model": settings.OPENROUTER_VISION_MODEL,
                        "messages": messages,
                        "temperature": 0.2,
                        "max_tokens": 500,
                        "stream": False,
                    },
                    timeout=int(os.getenv("REQUEST_TIMEOUT", "120")),
                )
                resp.raise_for_status()
                raw_text = resp.json()["choices"][0]["message"]["content"]
                result_json = self._parse_json_text(raw_text)

                response.exercise_name = result_json.get("exercise_name", "Unknown")
                response.progress_level = result_json.get("progress_level", "NOT_STARTED")
                response.on_track = result_json.get("on_track", True)
                response.observations = result_json.get("observations", "No observations")

                self.last_state_hash = current_hash
                self.last_response = response

            except Exception as e:
                response.status = f"ERROR_LLM: {str(e)}"
                response.observations = "Error calling Vision LLM. Fallback to DOM data."
                self._fallback_analysis(request.dom_data, response)
        else:
            response.status = "SUCCESS_NO_LLM"
            self._fallback_analysis(request.dom_data, response)

        self._log_to_file(request, response)
        return response

    def _fallback_analysis(self, dom_data: Optional[dict], response: ScreenAnalysisResponse):
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
                    response.observations = (
                        f"Model works! Detected {top_pred['category']} with {top_pred['confidence']}%."
                    )
                else:
                    response.observations = "Model trained and testing."
            else:
                response.progress_level = "NEAR_COMPLETE"
                response.observations = "Model is trained, waiting for student to test it."

    def _log_to_file(self, request: ScreenAnalysisRequest, response: ScreenAnalysisResponse):
        output_file = os.path.join(os.getcwd(), "screen_tracking_data.json")

        analysis_result = {
            "timestamp": request.timestamp,
            "page_url": request.page_url,
            "exercise_name": response.exercise_name,
            "progress_level": response.progress_level,
            "on_track": response.on_track,
            "observations": response.observations,
            "status": response.status,
            "dom_data_received": bool(request.dom_data),
        }

        try:
            # Load existing data
            data = {}
            if os.path.exists(output_file):
                with open(output_file, "r", encoding="utf-8") as f:
                    try:
                        data = json.load(f)
                    except json.JSONDecodeError:
                        data = self._initialize_tracking_file()
            else:
                data = self._initialize_tracking_file()

            # Ensure active_sessions exists
            if "active_sessions" not in data:
                data["active_sessions"] = {}

            session_id = request.session_id
            student_id = request.student_login_identity or "unknown"
            session_key = f"{session_id}_{student_id}"

            # Create or update session entry
            if session_key not in data["active_sessions"]:
                data["active_sessions"][session_key] = {
                    "student_login": student_id,
                    "session_id": session_id,
                    "started_at": request.timestamp,
                    "latest_analysis": analysis_result,
                    "analysis_history": [],
                }
            else:
                # Update latest analysis
                data["active_sessions"][session_key]["latest_analysis"] = analysis_result

                # Keep last 10 entries in history
                history = data["active_sessions"][session_key].get("analysis_history", [])
                history.append(analysis_result)
                if len(history) > 10:
                    history = history[-10:]
                data["active_sessions"][session_key]["analysis_history"] = history

            # Update metadata
            data["metadata"]["last_updated"] = datetime.utcnow().isoformat() + "Z"

            # Write back to file
            with open(output_file, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)

            logger.info(
                f"Screen analysis logged for {student_id} in session {session_id}: "
                f"{response.progress_level} | {response.observations}"
            )
        except Exception as e:
            logger.error("Failed to write to JSON file: %s", e)

    def _initialize_tracking_file(self) -> dict:
        return {
            "metadata": {
                "service": "screen_analysis_agent",
                "version": "2.0",
                "created_at": datetime.utcnow().isoformat() + "Z",
                "last_updated": datetime.utcnow().isoformat() + "Z",
                "description": "Real-time screen analysis tracking for student activity monitoring",
            },
            "active_sessions": {},
            "completed_sessions": [],
        }
