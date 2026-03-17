from fastapi import APIRouter, HTTPException

from models import StartRequest, StatusResponse, AgentControlResponse
from services import SessionService
from utils import validate_session_code

router = APIRouter(tags=["Agent Control"])

session_service = SessionService()


@router.get("/")
def root():
    return {
        "ok": True,
        "name": "DecliTech Agent API",
        "version": "2.0",
        "endpoints": {
            "status": "/status",
            "start": "/start",
            "stop": "/stop",
            "validate": "/validate/{session_code}",
            "docs": "/docs"
        }
    }


@router.get("/status", response_model=StatusResponse)
def get_status():
    status = session_service.get_status()
    return StatusResponse(**status)


@router.get("/validate/{session_code}")
def validate_session(session_code: str):
    valid, reason, session = validate_session_code(session_code)
    return {
        "valid": valid,
        "reason": reason,
        "session": session
    }


@router.post("/start", response_model=AgentControlResponse)
def start_session(request: StartRequest):
    try:
        if not request.login_identity or not request.login_identity.strip():
            raise HTTPException(
                status_code=400,
                detail="login_identity is required and cannot be empty"
            )

        session_service.start(request)

        return AgentControlResponse(
            status="STARTED",
            session_id=session_service.session_id,
            participant_id=session_service.participant_id
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/stop", response_model=AgentControlResponse)
def stop_session():
    session_service.stop()
    return AgentControlResponse(status="STOPPED")
