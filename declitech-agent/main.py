from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

from config import settings
from controllers import agent_router, pedagogy_router

logger = logging.getLogger(__name__)


def create_app() -> FastAPI:
    app = FastAPI(
        title="DecliTrack Agent API",
        description="Emotion Detection System for Educational Sessions",
        version="2.0.0",
        docs_url="/docs",
        redoc_url="/redoc"
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["*"],
    )

    app.include_router(agent_router)
    app.include_router(pedagogy_router)

    @app.get("/health", tags=["system"])
    async def health():
        return {"status": "UP", "service": "declitrack-agent"}

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=settings.AGENT_PORT,
        reload=settings.DEBUG,
        log_level="info",
    )
