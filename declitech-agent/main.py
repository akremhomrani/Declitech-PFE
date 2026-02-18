from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from controllers import agent_router


def create_app() -> FastAPI:
    app = FastAPI(
        title="DecliTech Agent API",
        description="Emotion Detection System for Educational Sessions",
        version="2.0.0",
        docs_url="/docs",
        redoc_url="/redoc"
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization"],
    )

    app.include_router(agent_router)

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=settings.AGENT_PORT,
        reload=True,
        log_level="info"
    )
