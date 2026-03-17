from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from controllers import agent_router, pedagogy_router


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
        allow_origins=[
            "http://localhost:4200",
            "http://localhost:4300",
            "http://localhost:3000",
            "http://127.0.0.1:4200",
            "http://localhost",
            "null",                   # fichiers HTML ouverts localement
        ],
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["*"],
    )

    app.include_router(agent_router)
    app.include_router(pedagogy_router)

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
