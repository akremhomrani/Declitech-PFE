import os
import time
import threading
from datetime import datetime
from collections import Counter
from pathlib import Path
from typing import Optional, Dict, Any

import cv2
import numpy as np
import onnxruntime as ort
import requests

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from dotenv import load_dotenv

# ----------------------------
# Load env
# ----------------------------
# Explicitly load .env from the agent directory
env_path = Path(__file__).resolve().parent / ".env"
print(f"[DEBUG] Loading .env from: {env_path}")
print(f"[DEBUG] File exists: {env_path.exists()}")

# Manually parse .env file instead of relying on load_dotenv()
if env_path.exists():
    with open(env_path, 'r', encoding='utf-8-sig') as f:  # utf-8-sig strips BOM
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                key = key.strip()
                value = value.strip()
                os.environ[key] = value
                print(f"[LOADED] {key} = {value}")

SERVER_BASE_URL = os.getenv("SERVER_BASE_URL", "").rstrip("/")
JOIN_ENDPOINT = os.getenv("JOIN_ENDPOINT", "/api/sessions/join")
HEARTBEAT_ENDPOINT = os.getenv("HEARTBEAT_ENDPOINT", "/api/participants/{participantId}/heartbeat")
CAPTURE_ENDPOINT = os.getenv("CAPTURE_ENDPOINT", "/api/participants/{participantId}/capture")
REPORT_ENDPOINT = os.getenv("REPORT_ENDPOINT", "/api/reports")
AGENT_PORT = int(os.getenv("AGENT_PORT", "8765"))

# Local-only mode (pour tester sans serveur)
LOCAL_ONLY = os.getenv("LOCAL_ONLY", "false").lower() in ("1", "true", "yes")

# Spring Boot Backend Integration
SPRING_BOOT_URL = os.getenv("SPRING_BOOT_URL", "http://localhost:8081").rstrip("/")
SPRING_BOOT_REPORT_ENDPOINT = os.getenv("SPRING_BOOT_REPORT_ENDPOINT", "/api/reports")

# Debug: Print loaded configuration
print(f"[DEBUG] .env file path: {env_path}")
print(f"[DEBUG] .env file exists: {env_path.exists()}")
print(f"[CONFIG] Configuration loaded:")
print(f"[CONFIG]   SERVER_BASE_URL: {SERVER_BASE_URL}")
print(f"[CONFIG]   LOCAL_ONLY: {LOCAL_ONLY}")
print(f"[CONFIG]   SPRING_BOOT_URL: {SPRING_BOOT_URL}")

# Paths
BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = str(BASE_DIR / "onnx_model.onnx")
REPORT_PATH = str(BASE_DIR / "emotion_report.json")
UI_DIR = str(BASE_DIR / "ui")

EMOTION_CLASSES = ["angry", "disgust", "fear", "happy", "sad", "surprise", "neutral"]

# ----------------------------
# Face detection (OpenCV Haar)
# ----------------------------
haar = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")

def crop_face_from_bgr(img_bgr: np.ndarray) -> Optional[np.ndarray]:
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    faces = haar.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(50, 50))
    if len(faces) == 0:
        return None

    x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
    m = int(0.15 * w)
    x1 = max(0, x - m); y1 = max(0, y - m)
    x2 = min(img_bgr.shape[1], x + w + m)
    y2 = min(img_bgr.shape[0], y + h + m)

    face = img_bgr[y1:y2, x1:x2]
    return face if face.size else None

# ----------------------------
# ONNX helpers
# ----------------------------
def softmax(x: np.ndarray) -> np.ndarray:
    x = x.astype(np.float32)
    x = x - np.max(x)
    e = np.exp(x)
    return e / (np.sum(e) + 1e-9)

def looks_like_probabilities(y: np.ndarray) -> bool:
    y = np.array(y).reshape(-1).astype(np.float32)
    if np.any(y < -1e-6):
        return False
    s = float(np.sum(y))
    return 0.98 <= s <= 1.02

def is_nhwc(shape) -> bool:
    return isinstance(shape, (list, tuple)) and len(shape) == 4 and shape[-1] in (1, 3)

def preprocess_fer(face_bgr: np.ndarray, target=(48, 48), nhwc: bool = False) -> np.ndarray:
    gray = cv2.cvtColor(face_bgr, cv2.COLOR_BGR2GRAY)
    x = cv2.resize(gray, target, interpolation=cv2.INTER_AREA).astype(np.float32) / 255.0
    if nhwc:
        return x[None, :, :, None]  # (1,H,W,1)
    return x[None, None, :, :]      # (1,1,H,W)

class EmotionONNX:
    def __init__(self, model_path: str):
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Model not found: {model_path}")

        self.sess = ort.InferenceSession(model_path, providers=["CPUExecutionProvider"])
        self.inp = self.sess.get_inputs()[0]
        self.out = self.sess.get_outputs()[0]
        self.INPUT_NAME = self.inp.name
        self.OUTPUT_NAME = self.out.name
        self.nhwc = is_nhwc(self.inp.shape)

        print("✅ Model loaded.")
        print("INPUT :", self.INPUT_NAME, self.inp.shape, self.inp.type)
        print("OUTPUT:", self.OUTPUT_NAME, self.out.shape, self.out.type)

    def predict(self, face_bgr: np.ndarray) -> Dict[str, float]:
        x = preprocess_fer(face_bgr, nhwc=self.nhwc)
        y = self.sess.run([self.OUTPUT_NAME], {self.INPUT_NAME: x})[0]
        y = np.array(y).reshape(-1)

        probs = y if looks_like_probabilities(y) else softmax(y)
        probs = probs.astype(np.float32)

        if len(probs) != len(EMOTION_CLASSES):
            raise RuntimeError(f"Output size {len(probs)} != {len(EMOTION_CLASSES)}")

        return {EMOTION_CLASSES[i]: float(probs[i]) for i in range(len(EMOTION_CLASSES))}

# ----------------------------
# Session summary -> final phrase
# ----------------------------
def aggregate_mean(results):
    if not results:
        return None
    mean = {c: 0.0 for c in EMOTION_CLASSES}
    for r in results:
        for c in EMOTION_CLASSES:
            mean[c] += float(r.get(c, 0.0))
    n = len(results)
    for c in mean:
        mean[c] /= n
    dominant = max(mean, key=mean.get)
    return {"mean_probs": mean, "dominant": dominant, "n_samples": n}

def summarize_session(dominants, probs_list, no_face_count, total_captures):
    valid = len(dominants)
    if valid == 0 or (no_face_count / max(1, total_captures)) >= 0.6:
        return {"state": "DONNEES_INSUFFISANTES",
                "final_sentence": "Données insuffisantes : visage souvent non détecté pendant la séance."}

    counts = Counter(dominants)
    freq = {k: counts.get(k, 0) / valid for k in EMOTION_CLASSES}

    mean = {c: 0.0 for c in EMOTION_CLASSES}
    for p in probs_list:
        for c in EMOTION_CLASSES:
            mean[c] += float(p.get(c, 0.0))
    for c in mean:
        mean[c] /= valid

    angry_f, sad_f, fear_f, happy_f, neutral_f = freq["angry"], freq["sad"], freq["fear"], freq["happy"], freq["neutral"]
    angry_m, sad_m, fear_m, happy_m, neutral_m = mean["angry"], mean["sad"], mean["fear"], mean["happy"], mean["neutral"]

    if angry_f >= 0.5 or angry_m >= 0.25 or (angry_f + sad_f) >= 0.6:
        return {"state": "FRUSTRE_NON_SATISFAIT",
                "final_sentence": "L’enfant semble frustré / non satisfait pendant la séance.",
                "freq": freq, "mean_probs": mean}

    if fear_f >= 0.5 or fear_m >= 0.25:
        return {"state": "STRESSE_INQUIET",
                "final_sentence": "L’enfant semble stressé / inquiet pendant la séance.",
                "freq": freq, "mean_probs": mean}

    if (sad_f + fear_f) >= 0.6 or (sad_m + fear_m) >= 0.45:
        return {"state": "CONFUS_EN_DIFFICULTE",
                "final_sentence": "L’enfant semble en difficulté / confus pendant la séance.",
                "freq": freq, "mean_probs": mean}

    if happy_f >= 0.5 or happy_m >= 0.25 or (happy_f > sad_f and happy_f > angry_f):
        return {"state": "SATISFAIT_ENGAGE",
                "final_sentence": "L’enfant semble satisfait et engagé pendant la séance.",
                "freq": freq, "mean_probs": mean}

    if neutral_f >= 0.5 or neutral_m >= 0.40:
        return {"state": "NEUTRE_CALME",
                "final_sentence": "L’enfant semble neutre / calme pendant la séance.",
                "freq": freq, "mean_probs": mean}

    dominant_global = max(mean, key=mean.get)
    return {"state": "ETAT_MIXTE",
            "final_sentence": f"État mixte pendant la séance. Tendance principale : {dominant_global}.",
            "freq": freq, "mean_probs": mean}

# ----------------------------
# Remote server client
# ----------------------------
def server_post(path: str, json_body: dict, token: Optional[str] = None) -> Optional[requests.Response]:
    if not SERVER_BASE_URL:
        return None
    url = SERVER_BASE_URL + path
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return requests.post(url, json=json_body, headers=headers, timeout=20)

def server_get(path: str, token: Optional[str] = None) -> Optional[requests.Response]:
    if not SERVER_BASE_URL:
        return None
    url = SERVER_BASE_URL + path
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return requests.get(url, headers=headers, timeout=20)

def validate_session_code(session_code: str) -> tuple:
    """Validate if session code exists, is active, and not expired"""
    if LOCAL_ONLY:
        return True, "local_only", None
    if not SERVER_BASE_URL:
        return False, "server_not_configured", None

    try:
        r = server_get(f"/api/sessions/code/{session_code}")
        if r is None:
            return False, "server_not_configured", None
        if r.status_code != 200:
            return False, "not_found", None

        data = r.json()
        is_active = bool(data.get("isActive", False))
        is_expired = bool(data.get("isExpired", False))

        if not is_active:
            return False, "inactive", data
        if is_expired:
            return False, "expired", data

        return True, "ok", data
    except Exception as e:
        print(f"⚠️ Session validation error: {e}")
        return False, "error", None

# ----------------------------
# FastAPI request/response models
# ----------------------------
class StartRequest(BaseModel):
    code: str = Field(..., description="Code séance")
    student_id: str = Field(..., description="ID élève")
    device_id: str = Field(..., description="ID PC")
    duration_min: int = Field(30, ge=1, le=240)
    interval_min: int = Field(15, ge=1, le=60)
    login_identity: str = Field(..., description="Pseudo / Email saisi sur la plateforme (required)")

class StatusResponse(BaseModel):
    running: bool
    session_id: Optional[str] = None
    participant_id: Optional[str] = None
    last_error: Optional[str] = None
    login_identity: Optional[str] = None

# ----------------------------
# Runtime
# ----------------------------
class AgentRuntime:
    def __init__(self):
        self.running = False
        self.stop_event = threading.Event()
        self.thread: Optional[threading.Thread] = None

        self.session_id: Optional[str] = None
        self.session_code: Optional[str] = None  # ✅ Store session code
        self.participant_id: Optional[str] = None
        self.token: Optional[str] = None
        self.last_error: Optional[str] = None

        # ✅ NEW
        self.login_identity: Optional[str] = None

        self.model = EmotionONNX(MODEL_PATH)

    def start(self, req: StartRequest):
        if self.running:
            raise RuntimeError("Agent déjà en cours")

        # ✅ Store session code
        self.session_code = req.code

        # ✅ NEW
        self.login_identity = (req.login_identity or "").strip() or None

        # ✅ Validate session code first
        if not LOCAL_ONLY and SERVER_BASE_URL:
            valid, reason, _session = validate_session_code(req.code)
            if not valid:
                raise RuntimeError(f"Invalid session code: {reason}")

        # JOIN session (si serveur actif)
        if not LOCAL_ONLY and SERVER_BASE_URL:
            # Replace {sessionCode} in endpoint with actual code
            join_url = JOIN_ENDPOINT.replace("{sessionCode}", req.code)
            r = server_post(join_url, {})
            if r is None or r.status_code != 200:
                raise RuntimeError(f"JOIN failed: {getattr(r,'status_code',None)} {getattr(r,'text','')}")
            # SessionService join endpoint returns 200 Ok with no body
            self.session_id = f"SESSION-{req.code}"
            self.participant_id = f"PARTICIPANT-{req.student_id}"
            self.token = None
        else:
            # Local test ids
            self.session_id = f"LOCAL-{req.code}"
            self.participant_id = f"LOCAL-{req.student_id}"
            self.token = None

        self.stop_event.clear()
        self.running = True
        self.last_error = None

        self.thread = threading.Thread(
            target=self._run_loop,
            args=(req.duration_min, req.interval_min),
            daemon=True
        )
        self.thread.start()

    def stop(self):
        """Stop the agent and release camera"""
        self.stop_event.set()
        self.running = False
        
        # Wait for thread to finish (camera release)
        if self.thread and self.thread.is_alive():
            self.thread.join(timeout=5)  # Wait up to 5 seconds for cleanup
            print("✅ Agent stopped, camera released")

    def _run_loop(self, duration_min: int, interval_min: int):
        dominants, probs_list, timeline = [], [], []
        no_face_count = 0

        # ✅ Store session metadata at the start
        session_start_time = datetime.utcnow().isoformat()
        session_metadata = {
            "sessionId": self.session_id,
            "sessionCode": self.session_code,  # ✅ Include session code
            "participantId": self.participant_id,
            "studentLoginIdentity": self.login_identity,
            "sessionStartedAt": session_start_time
        }

        # ✅ Save initial metadata to file immediately
        initial_report = {
            **session_metadata,
            "generatedAt": session_start_time,  # ✅ Add generatedAt for database
            "status": "IN_PROGRESS",
            "timeline": []
        }
        with open(REPORT_PATH, "w", encoding="utf-8") as f:
            import json
            json.dump(initial_report, f, ensure_ascii=False, indent=2)

        # ✅ Send session start to Spring Boot backend immediately
        try:
            spring_boot_url = SPRING_BOOT_URL + SPRING_BOOT_REPORT_ENDPOINT
            response = requests.post(
                spring_boot_url,
                json=initial_report,
                headers={"Content-Type": "application/json"},
                timeout=10
            )
            if response.status_code in (200, 201):
                print(f"✅ Session started, sent to Spring Boot: {self.login_identity}")
            else:
                print(f"⚠️ Spring Boot responded with status {response.status_code}")
        except Exception as e:
            print(f"⚠️ Failed to send session start to Spring Boot: {e}")

        total_seconds = duration_min * 60
        interval_seconds = interval_min * 60
        n_steps = max(1, int(total_seconds // interval_seconds))

        cap = cv2.VideoCapture(0)
        if not cap.isOpened():
            self.last_error = "Impossible d'ouvrir la caméra"
            self.running = False
            return

        def heartbeat():
            if LOCAL_ONLY or not SERVER_BASE_URL:
                return
            try:
                path = HEARTBEAT_ENDPOINT.format(participantId=self.participant_id)
                server_post(path, {"ts": datetime.utcnow().isoformat(), "online": True}, token=self.token)
            except Exception:
                pass

        heartbeat()

        for step in range(n_steps):
            if self.stop_event.is_set():
                break

            heartbeat()
            for _ in range(10):
                cap.read()

            ok, frame = cap.read()
            ts = datetime.utcnow().isoformat()

            if not ok:
                timeline.append({**session_metadata, "ts": ts, "status": "no_frame"})
            else:
                face = crop_face_from_bgr(frame)
                if face is None:
                    no_face_count += 1
                    timeline.append({**session_metadata, "ts": ts, "status": "no_face"})
                else:
                    try:
                        probs = self.model.predict(face)
                        dom = max(probs, key=probs.get)
                        dominants.append(dom)
                        probs_list.append(probs)
                        timeline.append({**session_metadata, "ts": ts, "status": "ok", "dominant": dom, "probs": probs})

                        if not LOCAL_ONLY and SERVER_BASE_URL:
                            cap_path = CAPTURE_ENDPOINT.format(participantId=self.participant_id)
                            server_post(cap_path, {"ts": ts, "dominant": dom, "probs": probs}, token=self.token)

                    except Exception as e:
                        self.last_error = f"Predict error: {e}"
                        timeline.append({**session_metadata, "ts": ts, "status": "error", "error": str(e)})

            # attente
            if step < n_steps - 1:
                for _ in range(interval_seconds):
                    if self.stop_event.is_set():
                        break
                    time.sleep(1)

        cap.release()

        summary_mean = aggregate_mean(probs_list)
        final_state = summarize_session(dominants, probs_list, no_face_count, n_steps)

        report = {
            "sessionId": self.session_id,
            "sessionCode": self.session_code,  # ✅ Include session code
            "participantId": self.participant_id,
            "generatedAt": datetime.utcnow().isoformat(),

            # ✅ NEW
            "studentLoginIdentity": self.login_identity,

            "summaryMean": summary_mean,
            "finalState": final_state,
            "timeline": timeline
        }

        # sauver localement (toujours)
        with open(REPORT_PATH, "w", encoding="utf-8") as f:
            import json
            json.dump(report, f, ensure_ascii=False, indent=2)

        # Send to main server (if configured)
        if not LOCAL_ONLY and SERVER_BASE_URL:
            try:
                server_post(REPORT_ENDPOINT, report, token=self.token)
            except Exception as e:
                self.last_error = f"Report send error: {e}"

        # ✅ AUTO-SEND TO SPRING BOOT BACKEND
        try:
            spring_boot_url = SPRING_BOOT_URL + SPRING_BOOT_REPORT_ENDPOINT
            response = requests.post(
                spring_boot_url,
                json=report,
                headers={"Content-Type": "application/json"},
                timeout=10
            )
            if response.status_code in (200, 201):
                print(f"✅ Report sent to Spring Boot backend: {spring_boot_url}")
            else:
                print(f"⚠️ Spring Boot backend responded with status {response.status_code}")
        except Exception as e:
            print(f"⚠️ Failed to send report to Spring Boot backend: {e}")
            # Don't set last_error - this is optional

        self.running = False

# ----------------------------
# FastAPI app
# ----------------------------
app = FastAPI(title="DecliTech Agent PC", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost",
        "http://localhost:*",
        "http://127.0.0.1:*",
        "chrome-extension://*",  # Allow Chrome extension
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

# ✅ Serve UI static files: /ui/static/*
if os.path.isdir(UI_DIR):
    app.mount("/ui/static", StaticFiles(directory=UI_DIR), name="ui_static")

runtime = AgentRuntime()

@app.get("/status", response_model=StatusResponse)
def status():
    return StatusResponse(
        running=runtime.running,
        session_id=runtime.session_id,
        participant_id=runtime.participant_id,
        last_error=runtime.last_error,
        login_identity=runtime.login_identity
    )

@app.get("/validate/{session_code}")
def validate(session_code: str):
    """Validate if session code is live (active and not expired)"""
    valid, reason, session = validate_session_code(session_code)
    return {"valid": valid, "reason": reason, "session": session}

@app.post("/start")
def start(req: StartRequest):
    try:
        # Validate login_identity is not empty
        if not req.login_identity or not req.login_identity.strip():
            raise HTTPException(status_code=400, detail="login_identity is required and cannot be empty")
        
        runtime.start(req)
        return {"status": "STARTED", "session_id": runtime.session_id, "participant_id": runtime.participant_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/stop")
def stop():
    runtime.stop()
    return {"status": "STOPPED"}

# ----------------------------
# ✅ NEW: endpoints to view report + UI
# ----------------------------
@app.get("/report")
def report():
    if not os.path.exists(REPORT_PATH):
        return JSONResponse({"error": "emotion_report.json not found yet. Start a session first."}, status_code=404)
    with open(REPORT_PATH, "r", encoding="utf-8") as f:
        import json
        return json.load(f)

@app.get("/ui", response_class=HTMLResponse)
def ui():
    index_path = os.path.join(UI_DIR, "index.html")
    if not os.path.exists(index_path):
        raise HTTPException(status_code=404, detail="ui/index.html not found. Create ui folder next to agent.py")
    return FileResponse(index_path)

@app.get("/")
def root():
    return {
        "ok": True,
        "status": "http://127.0.0.1:8765/status",
        "report": "http://127.0.0.1:8765/report",
        "ui": "http://127.0.0.1:8765/ui"
    }
