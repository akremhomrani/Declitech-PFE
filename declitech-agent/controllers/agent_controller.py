import logging

import redis
from fastapi import APIRouter, HTTPException

from config import settings
from models import StartRequest, StatusResponse, AgentControlResponse, ScreenAnalysisRequest, ScreenAnalysisResponse
from services import SessionService, ScreenAnalysisService
from utils import validate_session_code

router = APIRouter(tags=["Agent Control"])
logger = logging.getLogger(__name__)

session_service = SessionService()
screen_analysis_service = ScreenAnalysisService()

try:
    _redis = redis.Redis(host=settings.REDIS_HOST, port=settings.REDIS_PORT, db=0, decode_responses=True)
except Exception:
    _redis = None


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
            "analyze-screen": "/analyze-screen",
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
            session_id=session_service.session_id
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/stop", response_model=AgentControlResponse)
def stop_session():
    session_service.stop()
    return AgentControlResponse(status="STOPPED")

@router.post("/analyze-screen", response_model=ScreenAnalysisResponse)
def analyze_screen(request: ScreenAnalysisRequest):
    try:
        response = screen_analysis_service.analyze_screen(request)

        # Save observation to Redis so _generate_and_send_track_report() can read it
        if _redis and request.student_login_identity:
            redis_key = f"track:{request.session_id}:{request.student_login_identity}"
            entry = {
                "timestamp": request.timestamp,
                "page_url": request.page_url,
                "analysis_result": response.dict(),
            }
            try:
                import json
                _redis.rpush(redis_key, json.dumps(entry))
                _redis.expire(redis_key, 86400)
            except Exception as e:
                logger.warning("Failed to save track observation to Redis: %s", e)

        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
