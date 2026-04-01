"""
CodeCombat Pedagogy — AI Service (Gemini 2.5 Flash)
Evaluates student work and generates learning analytics feedback.
"""
import httpx
import json
import logging
import os
import asyncio
import time
from typing import Optional

logger = logging.getLogger(__name__)

# Gemini Configuration (Google)
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
GEMINI_API_VERSION = os.getenv("GEMINI_API_VERSION", "v1beta")
REQUEST_TIMEOUT = int(os.getenv("REQUEST_TIMEOUT", "60"))
MAX_RETRIES_429 = int(os.getenv("MAX_RETRIES_429", "3"))
RETRY_BASE_SECONDS = float(os.getenv("RETRY_BASE_SECONDS", "1.0"))
PHASE_CACHE_TTL_SECONDS = int(os.getenv("PHASE_CACHE_TTL_SECONDS", "20"))


def _compute_retry_delay(attempt: int, retry_after_header: Optional[str]) -> float:
    if retry_after_header:
        try:
            return max(0.0, float(retry_after_header))
        except ValueError:
            pass
    # Simple exponential backoff: base * 2^attempt
    return RETRY_BASE_SECONDS * (2 ** attempt)

def _build_gemini_url(model: str, version: str) -> str:
    """Build Gemini API endpoint URL"""
    return f"https://generativelanguage.googleapis.com/{version}/models/{model}:generateContent"

async def _ask_gemini(prompt: str, temperature: float = 0.2) -> str:
    """Call Gemini 2.5 Flash API (Google)"""
    if not GEMINI_API_KEY:
        logger.warning("Gemini API unavailable: GEMINI_API_KEY missing.")
        return ""

    try:
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": temperature, "maxOutputTokens": 500}
        }
        
        # Try v1beta first, fallback to v1
        versions = [GEMINI_API_VERSION] if GEMINI_API_VERSION == "v1" else [GEMINI_API_VERSION, "v1"]

        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            last_error = None
            for version in versions:
                url = _build_gemini_url(GEMINI_MODEL, version)
                for attempt in range(MAX_RETRIES_429 + 1):
                    try:
                        r = await client.post(url, params={"key": GEMINI_API_KEY}, json=payload)
                        r.raise_for_status()
                        data = r.json()
                        try:
                            return data["candidates"][0]["content"]["parts"][0]["text"].strip()
                        except (KeyError, IndexError):
                            logger.error(f"Unexpected Gemini response format: {data}")
                            return ""
                    except httpx.HTTPStatusError as e:
                        last_error = e
                        status = e.response.status_code
                        if status in (400, 404):
                            logger.warning(f"Gemini {version} unavailable ({status}), trying {versions[-1]}...")
                            break
                        if status == 429 and attempt < MAX_RETRIES_429:
                            retry_after = e.response.headers.get("Retry-After")
                            delay = _compute_retry_delay(attempt, retry_after)
                            logger.warning(
                                f"Gemini rate-limited (429). Retry {attempt + 1}/{MAX_RETRIES_429} in {delay:.1f}s..."
                            )
                            await asyncio.sleep(delay)
                            continue
                        raise

            if last_error:
                logger.error(f"Gemini error: {last_error}")
                return ""
    except Exception as e:
        logger.error(f"Gemini error: {e}")
        return ""
        
    return ""

async def is_ai_available() -> bool:
    return bool(GEMINI_API_KEY)

def _normalize_blocks(code: str) -> list[str]:
    """Extract individual blocks from code. Handles both function calls and plain commands."""
    if not code or not code.strip():
        return []
    
    # Split by lines and filter empty ones
    lines = [line.strip() for line in code.split('\n') if line.strip()]
    
    # Normalize each line: extract meaningful parts
    blocks = []
    for line in lines:
        # Remove common syntax noise but keep the command
        cleaned = line.replace('hero.', '').replace('()', '').replace('(', '').replace(')', '').replace('"', '').replace("'", '').strip()
        if cleaned and not cleaned.startswith('//'):
            blocks.append(cleaned)
    
    return blocks

async def generate_expected_solution(
    activity_title: str,
    site: str,
    level_number: Optional[int] = None
) -> str:
    """Generate the expected solution for a given activity."""
    prompt = (
        f"You are a CodeCombat instructor. Generate the EXACT expected solution for level '{activity_title}'.\n"
        f"Return ONLY the sequence of blocks/movements, one per line, with NO explanation.\n"
        f"Examples:\n"
        f"  Up\n"
        f"  Right\n"
        f"  Down\n"
        f"  Down\n"
        f"  Left\n\n"
        f"Or if it uses function syntax:\n"
        f"  hero.move(0, 4)\n"
        f"  hero.attackNearestEnemy()\n\n"
        f"IMPORTANT: Keep it SHORT and EXACT. No comments, no explanations, just the code lines."
    )
    return await _ask_gemini(prompt, temperature=0.1)

async def evaluate_student_work(
    activity_title: str,
    expected_solution: str,
    student_work: str,
    site: str = "generic",
    completed: bool = False,
    time_spent_seconds: Optional[int] = None,
    blocks_count: int = 0
) -> dict:
    """Evaluate student work and return detailed feedback with scoring."""
    if completed:
        time_comment = f" (completed in {time_spent_seconds}s)" if time_spent_seconds else ""
        return {
            "score": 100, "correct": True,
            "feedback": f"🏆 Level completed successfully{time_comment}! Excellent work!",
            "mistakes": [],
            "wrongBlocks": [],
            "missingBlocks": [],
            "extraBlocks": [],
            "onTrack": True,
            "timeAnalysis": f"Level completed in {time_spent_seconds} seconds." if time_spent_seconds else "Level completed.",
            "source": "AI"
        }
        
    if not student_work.strip() and blocks_count == 0:
        return _heuristic_evaluation(student_work, completed, blocks_count, time_spent_seconds)

    time_context = f"Time spent on the level: {time_spent_seconds} seconds." if time_spent_seconds else "Duration unknown."

    prompt = (
        f"You are an AI teacher analyzing CodeCombat block-based programming.\n"
        f"Level: '{activity_title}' on {site}\n"
        f"Time spent: {time_context}\n"
        f"Student placed: {blocks_count} block(s)\n\n"
        f"EXPECTED SOLUTION (sequence of blocks/commands):\n{expected_solution}\n\n"
        f"STUDENT'S CODE (actual blocks placed):\n{student_work.strip() if student_work else '(empty - no code yet)'}\n\n"
        f"TASK: Perform EXACT block-by-block comparison:\n"
        f"1. Parse each line as ONE block (e.g., 'hero.move(\"up\")', 'Up', or 'move(4,5)')\n"
        f"2. Compare student blocks EXACTLY with expected sequence\n"
        f"3. List WRONG blocks: position and what's wrong (e.g., 'Block 2: Written Right but should be Up')\n"
        f"4. List MISSING blocks: which blocks are not in student code\n"
        f"5. List EXTRA blocks: blocks student added that shouldn't be there\n"
        f"6. Score: 0-100 (0=empty, 50=half correct, 85=minor mistakes, 100=perfect)\n"
        f"7. Is student on right track? (true if majority correct OR attempting right approach)\n"
        f"8. Brief feedback (max 20 words) saying exactly what to fix\n\n"
        f"REPLY STRICTLY IN JSON FORMAT (no markdown, no backticks):\n"
        f"{{\n"
        f"  \"score\": 65,\n"
        f"  \"correct\": false,\n"
        f"  \"onTrack\": true,\n"
        f"  \"wrongBlocks\": [\"Block 2: Got 'Right' but should be 'Up'\", \"Block 4: Got 'Down' but should be 'Left'\"],\n"
        f"  \"missingBlocks\": [\"Block 5: 'Right' is missing\"],\n"
        f"  \"extraBlocks\": [\"Block 6: Extra 'Jump' not in solution\"],\n"
        f"  \"mistakes\": [\"Line 2 has wrong direction\", \"Missing the final block\"],\n"
        f"  \"feedback\": \"Block 2 should go UP not RIGHT. Check line order.\",\n"
        f"  \"timeAnalysis\": \"Student filled {blocks_count} blocks in {time_spent_seconds}s — good pace.\"\n"
        f"}}"
    )
    res = await _ask_gemini(prompt, temperature=0.05)
    
    try:
        start = res.find('{')
        end = res.rfind('}') + 1
        if start >= 0 and end > start:
            data = json.loads(res[start:end])
            score = int(data.get("score", 50))
            return {
                "score": score,
                "correct": data.get("correct", score >= 60),
                "onTrack": data.get("onTrack", score >= 40),
                "wrongBlocks": data.get("wrongBlocks", []),
                "missingBlocks": data.get("missingBlocks", []),
                "extraBlocks": data.get("extraBlocks", []),
                "mistakes": data.get("mistakes", []),
                "feedback": data.get("feedback", "Good work in progress."),
                "timeAnalysis": data.get("timeAnalysis", "Time analysis unavailable."),
                "source": "AI"
            }
    except Exception:
        pass
    
    return _heuristic_evaluation(student_work, completed, blocks_count, time_spent_seconds)


def _heuristic_evaluation(student_work: str, completed: bool, blocks_count: int = 0, time_spent_seconds: Optional[int] = None) -> dict:
    """Fallback evaluation when AI is unavailable. Analyzes block count and code length."""
    work_len = len(student_work.strip())
    time_str = f"{time_spent_seconds}s" if time_spent_seconds else "unknown"
    
    if completed:
        return {
            "score": 100, "correct": True, "onTrack": True,
            "mistakes": [], "wrongBlocks": [], "missingBlocks": [], "extraBlocks": [],
            "feedback": "✅ Level complete!",
            "timeAnalysis": f"Level completed in {time_str}.",
            "source": "heuristic"
        }
    
    # Estimate by block count + code length
    if blocks_count >= 8 or work_len > 150:
        return {
            "score": 75, "correct": True, "onTrack": True,
            "mistakes": [], "wrongBlocks": [], "missingBlocks": [], "extraBlocks": [],
            "feedback": "✨ Great work! Code looks complete.",
            "timeAnalysis": f"Good progress: {blocks_count} blocks placed in {time_str}.",
            "source": "heuristic"
        }
    if blocks_count >= 5 or work_len > 80:
        return {
            "score": 50, "correct": True, "onTrack": True,
            "mistakes": [], "wrongBlocks": [], "missingBlocks": [], "extraBlocks": [],
            "feedback": "📝 Good start! Keep adding blocks to complete it.",
            "timeAnalysis": f"Progressing: {blocks_count} blocks placed in {time_str}.",
            "source": "heuristic"
        }
    if blocks_count >= 1 or work_len > 10:
        return {
            "score": 30, "correct": False, "onTrack": True,
            "wrongBlocks": [], "missingBlocks": [], "extraBlocks": [],
            "mistakes": [f"Only {blocks_count} block(s) placed — need more blocks to solve the level"],
            "feedback": "🔄 Good start! Add more blocks to solve this.",
            "timeAnalysis": f"Student started: {blocks_count} block(s) placed in {time_str}.",
            "source": "heuristic"
        }
    
    return {
        "score": 0, "correct": False, "onTrack": False,
        "wrongBlocks": [], "missingBlocks": [], "extraBlocks": [],
        "mistakes": ["No code submitted yet — waiting for student to start"],
        "feedback": "⏳ Waiting for you to start coding!",
        "timeAnalysis": f"No code after {time_str} — student may need help or is stuck.",
        "source": "heuristic"
    }

_solution_cache: dict[str, str] = {}


async def get_or_generate_solution(
    activity_title: str,
    site: str,
    level_number: Optional[int] = None
) -> str:
    """Get cached solution or generate and cache it."""
    cache_key = f"{site}:{activity_title}:{level_number}"
    if cache_key in _solution_cache:
        return _solution_cache[cache_key]
    sol = await generate_expected_solution(activity_title, site, level_number)
    _solution_cache[cache_key] = sol
    return sol

_PHASE_FALLBACKS = {
    "STARTED":        "🚀 Student just started the level.",
    "IN_PROGRESS":    "📝 Student is progressing and adding code.",
    "STALLED":        "⏸️ Student does not seem to have progressed since the last scan.",
    "LEVEL_COMPLETE": "🏆 Level completed successfully! Excellent work!",
    "NEW_LEVEL":      "⬆️ Student is moving to the next level — great progress!",
}

_phase_phrase_cache: dict[str, tuple[float, str]] = {}

async def generate_phase_phrase(phase: str, level_name: str, blocks_count: int = 0, completed: bool = False, site: str = "codecombat.com") -> str:
    cache_key = f"{site}:{phase}:{level_name}:{blocks_count}:{completed}"
    cached = _phase_phrase_cache.get(cache_key)
    if cached:
        ts, value = cached
        if time.monotonic() - ts <= PHASE_CACHE_TTL_SECONDS:
            return value

    phase_desc = {
        "STARTED":        f"just started level \"{level_name}\" with {blocks_count} block(s)",
        "IN_PROGRESS":    f"is progressing on \"{level_name}\" — {blocks_count} block(s) written",
        "STALLED":        f"is stuck on \"{level_name}\" with no change for 30s",
        "LEVEL_COMPLETE": f"has completed level \"{level_name}\" successfully",
        "NEW_LEVEL":      f"is moving to the new level \"{level_name}\"",
    }.get(phase, f"is working on \"{level_name}\"")

    prompt = (
        f"You are a pedagogy assistant. Generate ONE short sentence (max 15 words) in English to inform "
        f"the teacher that the student {phase_desc}.\nBe positive. No quotation marks."
    )
    raw = await _ask_gemini(prompt, temperature=0.4)
    if not raw:
        fallback = _PHASE_FALLBACKS.get(phase, "Student is working on the level.")
        _phase_phrase_cache[cache_key] = (time.monotonic(), fallback)
        return fallback
        
    phrase = raw.strip().split('\n')[0].strip().strip('"').strip("'")
    if not phrase or len(phrase) < 5:
        fallback = _PHASE_FALLBACKS.get(phase, "Student is actively working.")
        _phase_phrase_cache[cache_key] = (time.monotonic(), fallback)
        return fallback
    _phase_phrase_cache[cache_key] = (time.monotonic(), phrase)
    return phrase
