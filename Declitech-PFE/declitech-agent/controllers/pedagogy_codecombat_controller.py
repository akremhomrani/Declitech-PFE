from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
import logging
from datetime import datetime, timezone
import json
import os
import asyncio

from services import pedagogy_codecombat_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/pedagogy", tags=["pedagogy"])

SESSIONS_DIR = "pedagogy_sessions"
os.makedirs(SESSIONS_DIR, exist_ok=True)

class PedagogyProgressPayload(BaseModel):
    sessionId:            str
    participantId:        Optional[str] = None
    studentLoginIdentity: Optional[str] = None
    type: str  
    site: str
    phase:        Optional[str] = "STARTED"
    blocksCount:  Optional[int] = 0
    levelSlug:    Optional[str] = None
    levelName:    Optional[str] = None
    levelNumber:  Optional[int] = None
    courseName:   Optional[str] = None
    lessonNumber: Optional[int] = None
    completed:    Optional[bool] = False
    score:        Optional[int]  = None
    stars:        Optional[int]  = None
    activityTitle:        Optional[str] = None
    activityInstructions: Optional[str] = None
    studentWork: Optional[str] = None
    url:         Optional[str] = None
    timestamp:   Optional[str] = None

class EvaluationResult(BaseModel):
    score:    int
    correct:  bool
    feedback: str
    source:   Optional[str] = None
    expectedSolution: Optional[str] = None
    aiPhrase: Optional[str] = None

_session_store: dict[str, dict[str, dict]] = {}

async def _save_event_to_json(payload: PedagogyProgressPayload, result: dict, ai_phrase: str):
    filepath = os.path.join(SESSIONS_DIR, f"{payload.sessionId}.json")
    
    data = {"sessionId": payload.sessionId, "students": {}}
    if os.path.exists(filepath):
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception:
            pass

    key = payload.studentLoginIdentity or payload.participantId or "anonymous"
    if key not in data["students"]:
        data["students"][key] = {
            "studentId": key,
            "site": payload.site,
            "startedAt": datetime.now(timezone.utc).isoformat(),
            "summary": {"levelsCompleted": 0, "currentLevel": payload.levelName, "totalEvents": 0},
            "events": []
        }

    student_data = data["students"][key]
    student_data["lastUpdatedAt"] = datetime.now(timezone.utc).isoformat()
    student_data["summary"]["currentLevel"] = payload.levelName
    student_data["summary"]["totalEvents"] += 1
    if payload.phase == "LEVEL_COMPLETE":
        student_data["summary"]["levelsCompleted"] += 1

    events_list = student_data["events"]
    is_stalled = payload.phase == "STALLED"
    has_previous = len(events_list) > 0
    same_level = has_previous and events_list[-1].get("levelSlug") == payload.levelSlug

    if is_stalled and same_level:
        last_event = events_list[-1]
        last_event["timestamp"] = payload.timestamp or datetime.now(timezone.utc).isoformat()
        last_event["phase"] = "STALLED"
        last_event["aiPhrase"] = ai_phrase
        last_event["score"] = result.get("score")
    else:
        event = {
            "timestamp": payload.timestamp or datetime.now(timezone.utc).isoformat(),
            "levelName": payload.levelName,
            "levelSlug": payload.levelSlug,
            "phase": payload.phase,
            "blocksCount": payload.blocksCount,
            "studentWork": payload.studentWork,
            "completed": payload.completed,
            "aiPhrase": ai_phrase,
            "score": result.get("score")
        }
        events_list.append(event)

    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

async def _store_progress_async(payload: PedagogyProgressPayload, result: dict, expected_solution: str):
    key = payload.studentLoginIdentity or payload.participantId or "anonymous"
    if payload.sessionId not in _session_store:
        _session_store[payload.sessionId] = {}

    activity_title = payload.activityTitle or payload.levelName or f"{payload.site} — Niveau {payload.levelNumber or 1}"

    ai_phrase = await pedagogy_codecombat_service.generate_phase_phrase(
        phase=payload.phase,
        level_name=payload.levelName or "Inconnu",
        blocks_count=payload.blocksCount or 0,
        completed=payload.completed or False,
        site=payload.site
    )
    result["aiPhrase"] = ai_phrase

    _session_store[payload.sessionId][key] = {
        "sessionId":            payload.sessionId,
        "participantId":        payload.participantId,
        "studentLoginIdentity": payload.studentLoginIdentity,
        "site":                 payload.site,
        "levelName":            payload.levelName,
        "phase":                payload.phase,
        "blocksCount":          payload.blocksCount,
        "activityTitle":        activity_title,
        "completed":            payload.completed,
        "score":                result.get("score", 0),
        "correct":              result.get("correct", False),
        "feedback":             result.get("feedback", ""),
        "aiPhrase":             ai_phrase,
        "expectedSolution":     expected_solution,
        "source":               result.get("source"),
        "timestamp":            payload.timestamp,
    }

    await _save_event_to_json(payload, result, ai_phrase)

@router.get("/status")
async def pedagogy_status():
    available = await pedagogy_codecombat_service.is_ai_available()
    return {
        "service":     "pedagogy",
        "aiReady":     available,
        "model":       pedagogy_codecombat_service.GEMINI_MODEL,
        "message":     "Prêt" if available else "IA non dispo"
    }

@router.post("/progress", response_model=EvaluationResult)
async def receive_progress(payload: PedagogyProgressPayload):
    activity_title = payload.activityTitle or payload.levelName or f"{payload.site} — Niveau {payload.levelNumber or 1}"
    logger.info(f"[Pédagogie] {payload.studentLoginIdentity} | {payload.phase} | {payload.site} | {activity_title} | Blocs={payload.blocksCount}")

    if payload.completed:
        immediate = {"score": 100, "correct": True, "feedback": "🏆 Niveau complété avec succès !", "source": "immediate"}
    else:
        work_len = payload.blocksCount * 10
        if work_len > 200: s, fb = 70, "📝 Bon travail en cours…"
        elif work_len > 80: s, fb = 50, "🔄 L'élève progresse…"
        elif work_len > 10: s, fb = 30, "⏳ Début de code détecté…"
        else: s, fb = 5, "⏳ L'élève n'a pas commencé."
        immediate = {"score": s, "correct": s >= 60, "feedback": fb, "source": "immediate"}

    async def run_ai_analysis():
        try:
            solution = await pedagogy_codecombat_service.get_or_generate_solution(
                activity_title=activity_title, site=payload.site, level_number=payload.levelNumber, instructions=payload.activityInstructions
            )
            ai_result = await pedagogy_codecombat_service.evaluate_student_work(
                activity_title=activity_title, expected_solution=solution, student_work=payload.studentWork or "",
                site=payload.site, completed=payload.completed or False, score_from_site=payload.score if payload.completed else None
            )
            await _store_progress_async(payload, ai_result, solution)
            logger.info(f"[IA] Phase={payload.phase} | Score={ai_result['score']}")
        except Exception as e:
            logger.warning(f"[IA] Erreur asynchrone : {e}")

    asyncio.create_task(run_ai_analysis())

    return EvaluationResult(
        score=immediate["score"],
        correct=immediate["correct"],
        feedback=immediate["feedback"],
        source=immediate["source"],
        expectedSolution=None,
        aiPhrase=None
    )

@router.get("/session/{session_id}")
async def get_session_progress(session_id: str):
    data = _session_store.get(session_id, {})
    return list(data.values())

@router.get("/session/{session_id}/export")
async def export_session_json(session_id: str):
    from fastapi.responses import FileResponse
    from fastapi import HTTPException
    filepath = os.path.join(SESSIONS_DIR, f"{session_id}.json")
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="JSON introuvable")
    return FileResponse(path=filepath, filename=f"pedagogy_{session_id}.json", media_type="application/json")

@router.get("/solution")
async def get_solution(title: str, site: str = "generic", level: Optional[int] = None):
    solution = await pedagogy_codecombat_service.get_or_generate_solution(title, site, level)
    return {"title": title, "site": site, "solution": solution}
