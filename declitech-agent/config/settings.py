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
                    os.environ[key.strip()] = value.strip()

    def _init_settings(self) -> None:
        self.BASE_DIR = Path(__file__).resolve().parent.parent
        self.SERVER_BASE_URL = os.getenv("SERVER_BASE_URL", "").rstrip("/")
        self.SPRING_BOOT_URL = os.getenv("SPRING_BOOT_URL", "http://localhost:8081").rstrip("/")
        self.SESSION_SERVICE_URL = os.getenv("SESSION_SERVICE_URL", "http://localhost:8084").rstrip("/")
        self.AGENT_PORT = int(os.getenv("AGENT_PORT", "8765"))
        self.LOCAL_ONLY = os.getenv("LOCAL_ONLY", "false").lower() in ("1", "true", "yes")
        self.JOIN_ENDPOINT = os.getenv("JOIN_ENDPOINT", "/api/sessions/join")
        self.HEARTBEAT_ENDPOINT = os.getenv("HEARTBEAT_ENDPOINT", "/api/participants/{participantId}/heartbeat")
        self.CAPTURE_ENDPOINT = os.getenv("CAPTURE_ENDPOINT", "/api/participants/{participantId}/capture")
        self.REPORT_ENDPOINT = os.getenv("REPORT_ENDPOINT", "/api/reports")
        self.SPRING_BOOT_REPORT_ENDPOINT = os.getenv("SPRING_BOOT_REPORT_ENDPOINT", "/api/reports")
        self.API_TIMEOUT = int(os.getenv("API_TIMEOUT", "20"))
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
        self.PHASE_CACHE_TTL_SECONDS = int(os.getenv("PHASE_CACHE_TTL_SECONDS", "20"))
        self.MODEL_PATH = str(self.BASE_DIR / "onnx_model.onnx")
        self.EMOTION_CLASSES = os.getenv("EMOTION_CLASSES", "angry,disgust,fear,happy,sad,surprise,neutral").split(",")
        self.CAMERA_INDEX = int(os.getenv("CAMERA_INDEX", "0"))
        self.CAMERA_WARMUP_FRAMES = int(os.getenv("CAMERA_WARMUP_FRAMES", "10"))
        self.FACE_SCALE_FACTOR = float(os.getenv("FACE_SCALE_FACTOR", "1.1"))
        self.FACE_MIN_NEIGHBORS = int(os.getenv("FACE_MIN_NEIGHBORS", "5"))
        self.FACE_MIN_SIZE = tuple(map(int, os.getenv("FACE_MIN_SIZE", "50,50").split(",")))
        self.FACE_MARGIN_PERCENT = float(os.getenv("FACE_MARGIN_PERCENT", "0.15"))
        self.MODEL_INPUT_SIZE = tuple(map(int, os.getenv("MODEL_INPUT_SIZE", "48,48").split(",")))
        self.OPENROUTER_BASE_URL = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
        self.OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
        self.OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "openai/gpt-4o-mini")
        self.OPENROUTER_VISION_MODEL = os.getenv("OPENROUTER_VISION_MODEL", "qwen/qwen2.5-vl-72b-instruct")
        self.GATEWAY_SECRET = os.getenv("GATEWAY_SECRET", "declitech-gateway-secret-dev-change-in-production")
        self.DEBUG = os.getenv("DEBUG", "false").lower() == "true"
        self.REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
        self.REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))


settings = Settings()
