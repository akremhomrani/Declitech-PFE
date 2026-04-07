import time
import threading
from datetime import datetime
from typing import Optional

import requests

from config import settings
from models import StartRequest
from services.camera_service import CameraService
from services.emotion_service import EmotionService
from services.report_service import ReportService
from services.api_client import APIClient
from utils import validate_session_code


class SessionService:

    def __init__(self):
        self.running = False
        self.stop_event = threading.Event()
        self.thread: Optional[threading.Thread] = None

        self.session_id: Optional[str] = None
        self.session_code: Optional[str] = None
        self.login_identity: Optional[str] = None
        self.token: Optional[str] = None
        self.last_error: Optional[str] = None

        self.camera_service = CameraService()
        self.emotion_service = EmotionService()
        self.report_service = ReportService()

    def start(self, request: StartRequest) -> None:
        if self.running:
            raise RuntimeError("Agent already running")

        self.session_code = request.code
        self.login_identity = request.login_identity.strip() if request.login_identity else None

        if not settings.LOCAL_ONLY:
            valid, reason, _session = validate_session_code(request.code)
            if not valid:
                if reason in ["inactive", "expired"]:
                    raise RuntimeError(f"Session is no longer active: {reason}")
                # Fallback to local session if backend doesn't have it or is unreachable
                self.session_id = f"LOCAL-{request.code}"
            else:
                self.session_id = f"SESSION-{request.code}"
            self.token = None
        else:
            self.session_id = f"LOCAL-{request.code}"
            self.token = None

        self.stop_event.clear()
        self.running = True
        self.last_error = None

        self.thread = threading.Thread(
            target=self._run_session,
            args=(request.duration_min, request.interval_min),
            daemon=True
        )
        self.thread.start()

    def stop(self) -> None:
        self.stop_event.set()
        self.running = False

        if self.thread and self.thread.is_alive():
            self.thread.join(timeout=60)  # give time for cleanup + Gemini call

    def get_status(self) -> dict:
        return {
            "running": self.running,
            "session_id": self.session_id,
            "last_error": self.last_error,
            "login_identity": self.login_identity
        }

    def _join_session(self, session_code: str) -> None:
        api_client = APIClient()
        join_url = settings.JOIN_ENDPOINT.replace("{sessionCode}", session_code)
        
        response = api_client.post(join_url, {})
        
        if response is None or response.status_code != 200:
            raise RuntimeError(
                f"JOIN failed: {getattr(response, 'status_code', None)} "
                f"{getattr(response, 'text', '')}"
            )

        self.session_id = f"SESSION-{session_code}"
        self.token = None

    def _send_heartbeat(self) -> None:
        if settings.LOCAL_ONLY or not settings.SERVER_BASE_URL:
            return

        try:
            api_client = APIClient(token=self.token)
            api_client.post(
                settings.HEARTBEAT_ENDPOINT,
                {
                    "ts": datetime.utcnow().isoformat(),
                    "online": True
                },
                include_auth=True
            )
        except Exception:
            pass

    def _send_capture(self, timestamp: str, dominant: str, probs: dict) -> None:
        if settings.LOCAL_ONLY or not settings.SERVER_BASE_URL:
            return

        try:
            api_client = APIClient(token=self.token)
            api_client.post(
                settings.CAPTURE_ENDPOINT,
                {
                    "ts": timestamp,
                    "dominant": dominant,
                    "probs": probs
                },
                include_auth=True
            )
        except Exception:
            pass

    def _send_report_to_spring_boot(self, report: dict) -> None:
        try:
            url = settings.SPRING_BOOT_URL + settings.SPRING_BOOT_REPORT_ENDPOINT
            response = requests.post(
                url,
                json=report,
                headers={"Content-Type": "application/json"},
                timeout=10
            )
        except Exception:
            pass

    def _run_session(self, duration_min: int, interval_min: int) -> None:
        dominants, probs_list = [], []
        no_face_count = 0
        
        import redis
        import json
        r_client = redis.Redis(host='localhost', port=6379, db=0)
        redis_emotion_key = f"emotion_timeline:{self.session_code}:{self.login_identity}"
        # Delete old matching list if we are starting a fresh session track
        r_client.delete(redis_emotion_key)

        session_start_time = datetime.utcnow().isoformat()
        session_metadata = {
            "sessionId": self.session_id,
            "sessionCode": self.session_code,
            "studentLoginIdentity": self.login_identity,
            "sessionStartedAt": session_start_time
        }

        initial_report = {
            **session_metadata,
            "generatedAt": session_start_time,
            "status": "IN_PROGRESS"
        }
        self._send_report_to_spring_boot(initial_report)

        total_seconds = duration_min * 60
        # interval_seconds = interval_min * 60
        interval_seconds = 10 # TEST OVERRIDE: Capture emotion every 10 seconds
        n_steps = max(1, int(total_seconds // interval_seconds))

        if not self.camera_service.open():
            self.last_error = "Failed to open camera"
            self.running = False
            return

        self.camera_service.warmup()

        self._send_heartbeat()

        for step in range(n_steps):
            if self.stop_event.is_set():
                break

            self._send_heartbeat()

            success, frame = self.camera_service.capture()
            timestamp = datetime.utcnow().isoformat()

            current_event = None
            if not success:
                current_event = {
                    **session_metadata,
                    "ts": timestamp,
                    "status": "no_frame"
                }
            else:
                result = self.emotion_service.analyze_frame(frame)

                if result["status"] == "no_face":
                    no_face_count += 1
                    current_event = {
                        **session_metadata,
                        "ts": timestamp,
                        "status": "no_face"
                    }
                elif result["status"] == "error":
                    self.last_error = f"Analysis error: {result.get('error')}"
                    current_event = {
                        **session_metadata,
                        "ts": timestamp,
                        "status": "error",
                        "error": result.get("error")
                    }
                else:
                    dominant = result["dominant"]
                    probs = result["probabilities"]
                    
                    dominants.append(dominant)
                    probs_list.append(probs)
                    current_event = {
                        **session_metadata,
                        "ts": timestamp,
                        "status": "ok",
                        "dominant": dominant,
                        "probs": probs
                    }

                    self._send_capture(timestamp, dominant, probs)
            
            # Push the live event to Redis!
            if current_event:
                try:
                    r_client.rpush(redis_emotion_key, json.dumps(current_event))
                    r_client.expire(redis_emotion_key, 86400) # Hot storage for 24h
                except Exception as e:
                    logging.getLogger(__name__).warning(f"Failed to push emotion event to Redis: {e}")

            if step < n_steps - 1:
                for _ in range(interval_seconds):
                    if self.stop_event.is_set():
                        break
                    time.sleep(1)

        self.camera_service.close()

        summary_mean = self.report_service.aggregate_mean(probs_list)
        final_state = self.report_service.summarize_session(
            dominants, probs_list, no_face_count, n_steps
        )

        final_report = {
            "sessionId": self.session_id,
            "sessionCode": self.session_code,
            "generatedAt": datetime.utcnow().isoformat(),
            "studentLoginIdentity": self.login_identity,
            "summaryMean": summary_mean,
            "finalState": final_state
        }

        if not settings.LOCAL_ONLY and settings.SERVER_BASE_URL:
            api_client = APIClient(token=self.token)
            try:
                api_client.post(settings.REPORT_ENDPOINT, final_report, include_auth=True)
            except Exception as e:
                self.last_error = f"Report send error: {e}"

        self._send_report_to_spring_boot(final_report)

        self._generate_and_send_track_report()

        self.running = False
        
    def _generate_and_send_track_report(self) -> None:
        try:
            import redis
            import json
            import logging
            
            r = redis.Redis(host='localhost', port=6379, db=0, decode_responses=True)
            key = f"track:{self.session_code}:{self.login_identity or 'unknown'}"
            observations = r.lrange(key, 0, -1)
            
            if not observations:
                return

            timeline_texts = []
            exercise_name = "Unknown Activity"
            
            for obs_str in observations:
                try:
                    obs = json.loads(obs_str)
                    res = obs.get("analysis_result", {})
                    ts = obs.get("timestamp", "").split("T")[-1]
                    
                    if res.get("exercise_name") and res.get("exercise_name") != "Unknown":
                        exercise_name = res.get("exercise_name")
                        
                    progress = res.get("progress_level", "")
                    text = res.get("observations", "")
                    timeline_texts.append(f"[{ts}] ({progress}): {text}")
                except Exception:
                    pass
            
            if not timeline_texts:
                return
                
            prompt = f"You are an AI teacher evaluating a student's session.\nHere is their chronological timeline:\n"
            prompt += "\n".join(timeline_texts)
            prompt += "\nWrite a concise conclusion (in 2-3 sentences max) detailing their major accomplishments and any core mistakes they exhibited. Do not use Markdown formatting like ** or ##."
            
            conclusion = "No conclusion active."
            try:
                import requests as _requests
                resp = _requests.post(
                    f"{settings.OPENROUTER_BASE_URL}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": settings.OPENROUTER_MODEL,
                        "messages": [{"role": "user", "content": prompt}],
                        "temperature": 0.2,
                        "max_tokens": 300
                    },
                    timeout=60
                )
                resp.raise_for_status()
                conclusion = (resp.json()["choices"][0]["message"]["content"] or "").strip()
            except Exception as e:
                logging.getLogger(__name__).error(f"OpenRouter error: {e}")
                successes = sum(1 for t in timeline_texts if "SUCCESS" in t)
                errors = sum(1 for t in timeline_texts if "ERROR" in t or "mistake" in t.lower())
                total = len(timeline_texts)
                fallback = f"Student was tracked over {total} events on '{exercise_name}'. "
                if successes > 0 and errors == 0:
                    fallback += "They made smooth progress without major visible errors."
                elif errors > 0:
                    fallback += f"They encountered some difficulties ({errors} flagged issues) during the session."
                else:
                    fallback += "They engaged with the exercise steadily."
                conclusion = f"[AI Error] Fallback summary: {fallback}"
            track_report = {
                "sessionId": self.session_id,
                "sessionCode": self.session_code,
                "studentIdentity": self.login_identity,
                "exerciseName": exercise_name,
                "conclusion": conclusion
            }
            
            url = settings.SPRING_BOOT_URL + "/api/reports/track"
            headers = {
                "Content-Type": "application/json",
                "X-Gateway-Secret": "declitech-gateway-secret-2024"
            }
            requests.post(url, json=track_report, headers=headers, timeout=10)
            
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"Failed to generate track report: {e}")
