import logging

from fastapi import APIRouter, HTTPException

from app.models.schemas import StartRequest, StatusResponse, AgentControlResponse
from app.services.session_service import SessionService
from app.utils.validators import validate_session_code

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Agent Control"])

session_service = SessionService()


@router.get("/")
def root():
    return {
        "ok": True,
        "name": "DecliTrack Agent API",
        "version": "2.0",
        "endpoints": {
            "status": "/status",
            "start": "/start",
            "stop": "/stop",
            "validate": "/validate/{session_code}",
            "docs": "/docs",
        },
    }


@router.get("/status", response_model=StatusResponse)
def get_status():
    status = session_service.get_status()
    return StatusResponse(**status)


@router.get("/validate/{session_code}")
def validate_session(session_code: str):
    valid, reason, session = validate_session_code(session_code)
    return {"valid": valid, "reason": reason, "session": session}


@router.post("/start", response_model=AgentControlResponse)
def start_session(request: StartRequest):
    try:
        if not request.login_identity or not request.login_identity.strip():
            raise HTTPException(
                status_code=400,
                detail="login_identity is required and cannot be empty",
            )
        session_service.start(request)
        return AgentControlResponse(status="STARTED", session_id=session_service.session_id)
    except HTTPException:
        raise
    except Exception:
        logger.exception("Failed to start session")
        raise HTTPException(status_code=400, detail="Failed to start session")


@router.post("/stop", response_model=AgentControlResponse)
def stop_session():
    session_service.stop()
    return AgentControlResponse(status="STOPPED")
