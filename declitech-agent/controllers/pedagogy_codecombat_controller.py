from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
import logging
from datetime import datetime, timezone
import json
import os
import asyncio

from services import pedagogy_codecombat_service
from config import settings

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
    mistakes:      Optional[list] = None
    wrongBlocks:   Optional[list] = None
    missingBlocks: Optional[list] = None
    extraBlocks:   Optional[list] = None
    onTrack:       Optional[bool] = None
    timeAnalysis:  Optional[str] = None

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
        last_event["onTrack"] = result.get("onTrack")
        last_event["timeAnalysis"] = result.get("timeAnalysis")
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
            "score": result.get("score"),
            "correct": result.get("correct"),
            "onTrack": result.get("onTrack"),
            "mistakes": result.get("mistakes", []),
            "wrongBlocks": result.get("wrongBlocks", []),
            "missingBlocks": result.get("missingBlocks", []),
            "extraBlocks": result.get("extraBlocks", []),
            "feedback": result.get("feedback"),
            "timeAnalysis": result.get("timeAnalysis"),
        }
        events_list.append(event)

    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

async def _store_progress_async(payload: PedagogyProgressPayload, result: dict, expected_solution: str):
    key = payload.studentLoginIdentity or payload.participantId or "anonymous"
    if payload.sessionId not in _session_store:
        _session_store[payload.sessionId] = {}

    activity_title = payload.activityTitle or payload.levelName or f"{payload.site} — Level {payload.levelNumber or 1}"

    # --- Calculate time spent on the current level ---
    time_spent_seconds: Optional[int] = None
    try:
        filepath = os.path.join(SESSIONS_DIR, f"{payload.sessionId}.json")
        if os.path.exists(filepath):
            with open(filepath, "r", encoding="utf-8") as f:
                existing = json.load(f)
            student_events = existing.get("students", {}).get(key, {}).get("events", [])
            # Find the first event for this level slug
            first_ts = next(
                (e["timestamp"] for e in student_events if e.get("levelSlug") == payload.levelSlug),
                None
            )
            if first_ts:
                start_dt = datetime.fromisoformat(first_ts.replace("Z", "+00:00"))
                now_dt = datetime.now(timezone.utc)
                time_spent_seconds = int((now_dt - start_dt).total_seconds())
    except Exception as e:
        logger.warning(f"[AI] Could not calculate time spent: {e}")

    ai_phrase = await pedagogy_codecombat_service.generate_phase_phrase(
        phase=payload.phase,
        level_name=payload.levelName or "Unknown",
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
        "onTrack":              result.get("onTrack", False),
        "mistakes":             result.get("mistakes", []),
        "wrongBlocks":          result.get("wrongBlocks", []),
        "missingBlocks":        result.get("missingBlocks", []),
        "extraBlocks":          result.get("extraBlocks", []),
        "feedback":             result.get("feedback", ""),
        "timeAnalysis":         result.get("timeAnalysis", ""),
        "timeSpentSeconds":     time_spent_seconds,
        "aiPhrase":             ai_phrase,
        "expectedSolution":     expected_solution,
        "source":               result.get("source"),
        "timestamp":            payload.timestamp,
    }

    await _save_event_to_json(payload, result, ai_phrase)
    return time_spent_seconds

@router.get("/status")
async def pedagogy_status():
    available = await pedagogy_codecombat_service.is_ai_available()
    return {
        "service":     "pedagogy",
        "aiReady":     available,
        "model":       settings.OPENROUTER_MODEL,
        "message":     "Ready" if available else "AI unavailable"
    }

@router.post("/progress", response_model=EvaluationResult)
async def receive_progress(payload: PedagogyProgressPayload):
    activity_title = payload.activityTitle or payload.levelName or f"{payload.site} — Level {payload.levelNumber or 1}"
    logger.info(f"[Pedagogy] {payload.studentLoginIdentity} | {payload.phase} | {payload.site} | {activity_title} | Blocks={payload.blocksCount}")

    if payload.completed:
        immediate = {"score": 100, "correct": True, "feedback": "🏆 Level completed successfully!", "source": "immediate"}
    else:
        work_len = payload.blocksCount * 10
        if work_len > 200: s, fb = 70, "📝 Good work in progress…"
        elif work_len > 80: s, fb = 50, "🔄 Student is progressing…"
        elif work_len > 10: s, fb = 30, "⏳ Code started, keep going…"
        else: s, fb = 5, "⏳ Student has not started yet."
        immediate = {"score": s, "correct": s >= 60, "feedback": fb, "source": "immediate"}

    async def run_ai_analysis():
        try:
            solution = await pedagogy_codecombat_service.get_or_generate_solution(
                activity_title=activity_title, site=payload.site, level_number=payload.levelNumber
            )
            ai_result = await pedagogy_codecombat_service.evaluate_student_work(
                activity_title=activity_title,
                expected_solution=solution,
                student_work=payload.studentWork or "",
                site=payload.site,
                completed=payload.completed or False,
                blocks_count=payload.blocksCount or 0
            )
            time_spent = await _store_progress_async(payload, ai_result, solution)
            # Re-evaluate with time context if time is available
            if time_spent and not payload.completed:
                ai_result = await pedagogy_codecombat_service.evaluate_student_work(
                    activity_title=activity_title,
                    expected_solution=solution,
                    student_work=payload.studentWork or "",
                    site=payload.site,
                    completed=payload.completed or False,
                    time_spent_seconds=time_spent,
                    blocks_count=payload.blocksCount or 0
                )
                await _store_progress_async(payload, ai_result, solution)
            logger.info(f"[AI] Phase={payload.phase} | Score={ai_result['score']} | OnTrack={ai_result.get('onTrack')} | Mistakes={len(ai_result.get('mistakes', []))} | Time={time_spent}s")
        except Exception as e:
            logger.warning(f"[AI] Async error: {e}")

    asyncio.create_task(run_ai_analysis())

    return EvaluationResult(
        score=immediate["score"],
        correct=immediate["correct"],
        feedback=immediate["feedback"],
        source=immediate["source"],
        expectedSolution=None,
        aiPhrase=None,
        mistakes=[],
        wrongBlocks=[],
        missingBlocks=[],
        extraBlocks=[],
        onTrack=immediate["correct"],
        timeAnalysis=None
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
        raise HTTPException(status_code=404, detail="Session JSON not found")
    return FileResponse(path=filepath, filename=f"pedagogy_{session_id}.json", media_type="application/json")

@router.get("/solution")
async def get_solution(title: str, site: str = "generic", level: Optional[int] = None):
    solution = await pedagogy_codecombat_service.get_or_generate_solution(title, site, level)
    return {"title": title, "site": site, "solution": solution}
