from pathlib import Path
from pydantic_settings import BaseSettings

BASE_DIR = Path(__file__).resolve().parents[2]

INSECURE_GATEWAY_SECRET = "change-in-production"


class Settings(BaseSettings):
    # Downstream services
    SPRING_BOOT_URL: str = "http://localhost:8081"
    SESSION_SERVICE_URL: str = "http://localhost:8084"
    REPORT_ENDPOINT: str = "/api/reports"
    SPRING_BOOT_REPORT_ENDPOINT: str = "/api/reports"

    # Agent server
    SERVER_BASE_URL: str = ""
    AGENT_PORT: int = 8765
    LOCAL_ONLY: bool = False

    # Security
    GATEWAY_SECRET: str = ""

    # Redis
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379

    # ONNX emotion model
    MODEL_PATH: str = str(BASE_DIR / "resources" / "onnx_model.onnx")
    EMOTION_CLASSES: str = "angry,disgust,fear,happy,sad,surprise,neutral"

    # Camera
    CAMERA_INDEX: int = 0
    CAMERA_WARMUP_FRAMES: int = 10
    FACE_SCALE_FACTOR: float = 1.1
    FACE_MIN_NEIGHBORS: int = 5
    FACE_MIN_SIZE: str = "50,50"
    FACE_MARGIN_PERCENT: float = 0.15
    MODEL_INPUT_SIZE: str = "48,48"

    # Screen analysis + conclusions (OpenRouter Qwen)
    OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1"
    OPENROUTER_API_KEY: str = ""
    OPENROUTER_MODEL: str = "openai/gpt-4o-mini"
    OPENROUTER_VISION_MODEL: str = "qwen/qwen2.5-vl-72b-instruct"

    # Timeouts / caching
    API_TIMEOUT: int = 20
    PHASE_CACHE_TTL_SECONDS: int = 20

    # CORS (comma-separated origins)
    CORS_ORIGINS: str = (
        "http://localhost:4200,http://localhost:4300,"
        "http://localhost:8765,http://127.0.0.1:4200,"
        "http://127.0.0.1:4300"
    )

    DEBUG: bool = False

    @property
    def emotion_classes_list(self) -> list[str]:
        return self.EMOTION_CLASSES.split(",")

    @property
    def cors_origins_list(self) -> list[str]:
        return self.CORS_ORIGINS.split(",")

    @property
    def face_min_size(self) -> tuple[int, int]:
        parts = self.FACE_MIN_SIZE.split(",")
        return int(parts[0]), int(parts[1])

    @property
    def model_input_size(self) -> tuple[int, int]:
        parts = self.MODEL_INPUT_SIZE.split(",")
        return int(parts[0]), int(parts[1])

    def model_post_init(self, __context) -> None:
        if not self.DEBUG and not self.LOCAL_ONLY:
            if not self.GATEWAY_SECRET or self.GATEWAY_SECRET == INSECURE_GATEWAY_SECRET:
                raise ValueError(
                    "GATEWAY_SECRET must be set to a secure value via environment "
                    "variable in production (DEBUG and LOCAL_ONLY disabled)."
                )

    model_config = {
        "env_file": str(BASE_DIR / ".env"),
        "env_file_encoding": "utf-8",
    }


settings = Settings()
