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
        
        # Server Configuration
        self.SERVER_BASE_URL = os.getenv("SERVER_BASE_URL", "").rstrip("/")
        self.SPRING_BOOT_URL = os.getenv("SPRING_BOOT_URL", "http://localhost:8083").rstrip("/")
        self.AGENT_PORT = int(os.getenv("AGENT_PORT", "8765"))
        self.LOCAL_ONLY = os.getenv("LOCAL_ONLY", "false").lower() in ("1", "true", "yes")
        
        # API Endpoints
        self.JOIN_ENDPOINT = os.getenv("JOIN_ENDPOINT", "/api/sessions/join")
        self.HEARTBEAT_ENDPOINT = os.getenv("HEARTBEAT_ENDPOINT", "/api/participants/{participantId}/heartbeat")
        self.CAPTURE_ENDPOINT = os.getenv("CAPTURE_ENDPOINT", "/api/participants/{participantId}/capture")
        self.REPORT_ENDPOINT = os.getenv("REPORT_ENDPOINT", "/api/reports")
        self.SPRING_BOOT_REPORT_ENDPOINT = os.getenv("SPRING_BOOT_REPORT_ENDPOINT", "/api/reports")
        self.API_TIMEOUT = int(os.getenv("API_TIMEOUT", "20"))
        
        # CORS Configuration
        self.CORS_ORIGINS = [
            "http://localhost",
            "http://localhost:4200",
            "http://localhost:4300",
            "http://localhost:8765",
            "http://127.0.0.1:4200",
            "http://127.0.0.1:4300",
            "http://127.0.0.1:8765",
            "chrome-extension://*",
        ]
        if custom_origins := os.getenv("CORS_ORIGINS"):
            self.CORS_ORIGINS = custom_origins.split(",")
        
        # Cache Configuration
        self.PHASE_CACHE_TTL_SECONDS = int(os.getenv("PHASE_CACHE_TTL_SECONDS", "20"))

        # Model Configuration
        self.MODEL_PATH = str(self.BASE_DIR / "onnx_model.onnx")
        self.EMOTION_CLASSES = os.getenv("EMOTION_CLASSES", "angry,disgust,fear,happy,sad,surprise,neutral").split(",")
        
        # Camera Configuration
        self.CAMERA_INDEX = int(os.getenv("CAMERA_INDEX", "0"))
        self.CAMERA_WARMUP_FRAMES = int(os.getenv("CAMERA_WARMUP_FRAMES", "10"))
        self.FACE_SCALE_FACTOR = float(os.getenv("FACE_SCALE_FACTOR", "1.1"))
        self.FACE_MIN_NEIGHBORS = int(os.getenv("FACE_MIN_NEIGHBORS", "5"))
        self.FACE_MIN_SIZE = tuple(map(int, os.getenv("FACE_MIN_SIZE", "50,50").split(",")))
        self.FACE_MARGIN_PERCENT = float(os.getenv("FACE_MARGIN_PERCENT", "0.15"))
        self.MODEL_INPUT_SIZE = tuple(map(int, os.getenv("MODEL_INPUT_SIZE", "48,48").split(",")))
        self.GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")


settings = Settings()
