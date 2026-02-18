import os
from pathlib import Path


class Settings:

    def __init__(self):
        self._load_env()
        self._init_settings()

    def _load_env(self) -> None:
        env_path = Path(__file__).resolve().parent.parent / ".env"
        
        if not env_path.exists():
            return
        
        with open(env_path, 'r', encoding='utf-8-sig') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    key = key.strip()
                    value = value.strip()
                    os.environ[key] = value

    def _init_settings(self) -> None:
        self.BASE_DIR = Path(__file__).resolve().parent.parent
        self.SERVER_BASE_URL = os.getenv("SERVER_BASE_URL", "").rstrip("/")
        self.SPRING_BOOT_URL = os.getenv("SPRING_BOOT_URL", "http://localhost:8083").rstrip("/")
        self.JOIN_ENDPOINT = os.getenv("JOIN_ENDPOINT", "/api/sessions/join")
        self.HEARTBEAT_ENDPOINT = os.getenv("HEARTBEAT_ENDPOINT", "/api/participants/{participantId}/heartbeat")
        self.CAPTURE_ENDPOINT = os.getenv("CAPTURE_ENDPOINT", "/api/participants/{participantId}/capture")
        self.REPORT_ENDPOINT = os.getenv("REPORT_ENDPOINT", "/api/reports")
        self.SPRING_BOOT_REPORT_ENDPOINT = os.getenv("SPRING_BOOT_REPORT_ENDPOINT", "/api/reports")
        self.AGENT_PORT = int(os.getenv("AGENT_PORT", "8765"))
        self.LOCAL_ONLY = os.getenv("LOCAL_ONLY", "false").lower() in ("1", "true", "yes")
        self.MODEL_PATH = str(self.BASE_DIR / "onnx_model.onnx")
        self.EMOTION_CLASSES = ["angry", "disgust", "fear", "happy", "sad", "surprise", "neutral"]
        self.CAMERA_INDEX = 0
        self.CAMERA_WARMUP_FRAMES = 10
        self.FACE_SCALE_FACTOR = 1.1
        self.FACE_MIN_NEIGHBORS = 5
        self.FACE_MIN_SIZE = (50, 50)
        self.FACE_MARGIN_PERCENT = 0.15
        self.MODEL_INPUT_SIZE = (48, 48)
        self.API_TIMEOUT = 20
        self.CORS_ORIGINS = [
            "http://localhost",
            "http://localhost:*",
            "http://127.0.0.1:*",
            "chrome-extension://*",
        ]


settings = Settings()
