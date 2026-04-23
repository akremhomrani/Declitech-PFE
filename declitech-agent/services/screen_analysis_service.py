import json
import logging
import os
import re
from datetime import datetime, timezone
from typing import Optional

import requests

from config import settings
from models.schemas import ScreenAnalysisRequest, ScreenAnalysisResponse

logger = logging.getLogger(__name__)

PROGRESS_ORDER = ["NOT_STARTED", "STARTING", "IN_PROGRESS", "NEAR_COMPLETE", "COMPLETE"]

_VISION_PROMPT = (
    "You are analyzing a screenshot from an online learning platform. "
    "Answer in JSON with these exact keys:\n"
    '  "exercise_name": title of the current exercise ("Unknown" if not visible)\n'
    '  "progress_level": one of NOT_STARTED | STARTING | IN_PROGRESS | NEAR_COMPLETE | COMPLETE\n'
    '  "observations": one sentence describing what the student is doing\n'
    "Return ONLY the JSON object, no other text."
)


def _progress_rank(level: str) -> int:
    try:
        return PROGRESS_ORDER.index(level)
    except ValueError:
        return 0


class ScreenAnalysisService:
    def __init__(self, redis_client=None):
        self.output_file = os.path.join(os.path.dirname(__file__), "..", "screen_analysis_output.json")
        self._redis = redis_client
        self._memory: dict = {}

    # ── Public ────────────────────────────────────────────────────────────────

    def analyze_screen(self, request: ScreenAnalysisRequest) -> ScreenAnalysisResponse:
        state = self._load_story_state(request.session_id, request.student_login_identity)

        response = ScreenAnalysisResponse(
            status="SUCCESS",
            exercise_name="Unknown",
            progress_level="NOT_STARTED",
            on_track=True,
            observations="N/A",
        )

        self._dom_analysis(request.dom_data, request.page_url, response)

        if response.exercise_name == "Unknown" and request.screenshot_base64:
            self._vision_analysis(request.screenshot_base64, response)

        self._apply_story(request, response, state)
        self._save_story_state(request.session_id, request.student_login_identity, state)
        self._log_to_file(request, response)
        return response

    # ── Story state ───────────────────────────────────────────────────────────

    def _story_key(self, session_id: str, identity: Optional[str]) -> str:
        return f"story:{session_id}:{identity or 'unknown'}"

    def _load_story_state(self, session_id: str, identity: Optional[str]) -> dict:
        key = self._story_key(session_id, identity)
        if key in self._memory:
            return self._memory[key]
        return {
            "exercise_name": None,
            "max_progress_level": "NOT_STARTED",
            "categories": {},
            "model_trained": False,
            "best_prediction": None,
            "zero_category_streak": 0,
            "capture_count": 0,
            "first_seen_at": datetime.now(timezone.utc).isoformat(),
        }

    def _save_story_state(self, session_id: str, identity: Optional[str], state: dict):
        self._memory[self._story_key(session_id, identity)] = state

    def _apply_story(self, request: ScreenAnalysisRequest, response: ScreenAnalysisResponse, state: dict):
        now = datetime.now(timezone.utc).isoformat()
        state["capture_count"] = state.get("capture_count", 0) + 1

        # Exercise name — clean once, keep forever
        clean = self._clean_exercise_name(response.exercise_name)
        if clean != "Unknown":
            state["exercise_name"] = clean
        if state.get("exercise_name"):
            response.exercise_name = state["exercise_name"]

        dom = request.dom_data or {}
        new_cats = dom.get("categories", [])
        training = dom.get("trainingState", {})
        predictions = dom.get("predictions", [])

        # Category merge — union with max image counts, detect resets
        has_exercise_data = bool(new_cats or training or predictions)
        if new_cats:
            state["zero_category_streak"] = 0
            state["categories"] = self._merge_categories(state.get("categories", {}), new_cats, now)
        elif state.get("categories") and has_exercise_data:
            streak = state.get("zero_category_streak", 0) + 1
            state["zero_category_streak"] = streak
            if streak >= 3:
                state["categories"] = {}
                state["model_trained"] = False
                state["best_prediction"] = None
                state["max_progress_level"] = "STARTING"
                state["zero_category_streak"] = 0

        # Sticky model_trained flag
        if training.get("modelTrained"):
            state["model_trained"] = True

        # Best prediction — keep highest confidence seen
        if predictions:
            top = max(predictions, key=lambda x: x.get("confidence", 0))
            stored = state.get("best_prediction")
            if not stored or top.get("confidence", 0) > stored.get("confidence", 0):
                state["best_prediction"] = top

        # Advance progress — never regress (unless reset detected above)
        effective_level = response.progress_level
        if state["model_trained"] and _progress_rank(effective_level) < _progress_rank("NEAR_COMPLETE"):
            effective_level = "NEAR_COMPLETE"
        if state.get("best_prediction") and _progress_rank(effective_level) < _progress_rank("COMPLETE"):
            effective_level = "COMPLETE"
        state["max_progress_level"] = PROGRESS_ORDER[
            max(_progress_rank(state.get("max_progress_level", "NOT_STARTED")), _progress_rank(effective_level))
        ]
        response.progress_level = state["max_progress_level"]

        # Build narrative observation from full accumulated state
        response.observations = self._build_observation(state, response.progress_level)

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _merge_categories(self, stored: dict, new_cats: list, now: str) -> dict:
        result = dict(stored)
        for cat in new_cats:
            name = (cat.get("name") or "").strip()
            count = cat.get("imageCount", 0)
            key = name if name else f"__unnamed_{count}"
            if key in result:
                result[key]["max_images"] = max(result[key]["max_images"], count)
                result[key]["last_seen_at"] = now
            else:
                result[key] = {"name": name, "max_images": count, "last_seen_at": now}
        return result

    def _clean_exercise_name(self, raw: Optional[str]) -> str:
        if not raw or raw.strip() == "Unknown":
            return "Unknown"
        parts = [p.strip() for p in raw.split("\n") if p.strip()]
        nav_words = {"settings", "dashboard", "home", "accueil", "menu", "profil", "profile"}
        parts = [p for p in parts if p.lower() not in nav_words]
        return parts[-1] if parts else "Unknown"

    def _build_observation(self, state: dict, level: str) -> str:
        name = state.get("exercise_name") or "the exercise"
        cats = state.get("categories", {})
        named_cats = [c for c in cats.values() if c.get("name") and c.get("max_images", 0) > 0]
        n_cats = len(named_cats)
        total_images = sum(c["max_images"] for c in named_cats)
        cat_summary = ", ".join(f"{c['name']} ({c['max_images']} imgs)" for c in named_cats)

        if level == "NOT_STARTED":
            return f"Student has not started '{name}' yet."
        if level == "STARTING":
            return f"Student opened '{name}'."
        if level == "IN_PROGRESS":
            if n_cats == 0:
                return f"Student is working on '{name}' — no categories created yet."
            return f"Student is building a model on '{name}': {n_cats} categories — {cat_summary} ({total_images} total images)."
        if level == "NEAR_COMPLETE":
            if n_cats:
                return f"Model trained on {n_cats} categories ({cat_summary}). Waiting for student to test it."
            return f"Model trained on '{name}'. Waiting for student to test it."
        if level == "COMPLETE":
            pred = state.get("best_prediction")
            if pred and pred.get("category"):
                base = f"Model works! Detected '{pred['category']}' with {pred['confidence']}% confidence."
                return f"{base} Categories: {cat_summary}." if cat_summary else base
            return f"Exercise '{name}' complete." + (f" Categories: {cat_summary}." if cat_summary else "")
        return "Analysis in progress."

    # ── DOM analysis ──────────────────────────────────────────────────────────

    def _dom_analysis(self, dom_data: Optional[dict], page_url: Optional[str], response: ScreenAnalysisResponse):
        if not dom_data:
            response.status = "NO_DOM_DATA"
            response.observations = "No DOM data received from content script."
            return

        if page_url and "learn.decli.tech" in page_url:
            exercise = dom_data.get("exerciseName") or dom_data.get("pageTitle") or "Unknown"
            if dom_data.get("exerciseInfo"):
                exercise = dom_data["exerciseInfo"].get("title") or exercise
            response.exercise_name = exercise

            categories = dom_data.get("categories", [])
            training = dom_data.get("trainingState", {})
            predictions = dom_data.get("predictions", [])

            if categories or training:
                if predictions:
                    response.progress_level = "COMPLETE"
                    top = max(predictions, key=lambda x: x.get("confidence", 0))
                    response.observations = (
                        f"Model works! Detected {top['category']} with {top['confidence']}%."
                        if top.get("confidence", 0) > 80
                        else "Model trained and being tested."
                    )
                elif training.get("modelTrained"):
                    response.progress_level = "NEAR_COMPLETE"
                    response.observations = f"Model trained on {len(categories)} categories. Waiting for test."
                elif categories:
                    has_empty = any(not c.get("name") for c in categories)
                    response.progress_level = "IN_PROGRESS"
                    if has_empty:
                        response.on_track = False
                        response.observations = "Student added data but forgot to name a category."
                    else:
                        total = sum(c.get("imageCount", 0) for c in categories)
                        response.observations = f"Student created {len(categories)} categories ({total} images). Ready to train."
                else:
                    response.progress_level = "STARTING"
                    response.observations = f"Student opened: {exercise}"
            elif dom_data.get("completed"):
                response.progress_level = "COMPLETE"
                response.observations = f"Student completed: {exercise}"
            elif dom_data.get("studentCode"):
                response.progress_level = "IN_PROGRESS"
                response.observations = f"Student is coding on: {exercise}"
            elif dom_data.get("progress"):
                response.progress_level = "IN_PROGRESS"
                response.observations = f"Progress: {dom_data['progress']} — {exercise}"
            else:
                response.progress_level = "STARTING"
                response.observations = f"Student opened: {exercise}"
            return

        categories = dom_data.get("categories", [])
        training = dom_data.get("trainingState", {})
        predictions = dom_data.get("predictions", [])

        if dom_data.get("exerciseInfo"):
            response.exercise_name = dom_data["exerciseInfo"].get("title", "Unknown")

        if not categories:
            response.progress_level = "NOT_STARTED"
            response.observations = "Student has not started yet."
        elif not training.get("modelTrained"):
            has_empty = any(not c.get("name") for c in categories)
            response.progress_level = "IN_PROGRESS"
            if has_empty:
                response.on_track = False
                response.observations = "Student added data but forgot to name a category."
            else:
                response.observations = f"Student created {len(categories)} categories. Ready to train."
        else:
            if predictions:
                response.progress_level = "COMPLETE"
                top = max(predictions, key=lambda x: x.get("confidence", 0))
                response.observations = (
                    f"Model works! Detected {top['category']} with {top['confidence']}%."
                    if top.get("confidence", 0) > 80
                    else "Model trained and testing."
                )
            else:
                response.progress_level = "NEAR_COMPLETE"
                response.observations = "Model is trained, waiting for student to test it."

    # ── Vision analysis ───────────────────────────────────────────────────────

    def _vision_analysis(self, screenshot_base64: str, response: ScreenAnalysisResponse):
        if not settings.OPENROUTER_API_KEY:
            logger.debug("No OPENROUTER_API_KEY — skipping vision analysis")
            return
        try:
            resp = requests.post(
                f"{settings.OPENROUTER_BASE_URL}/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": settings.OPENROUTER_VISION_MODEL,
                    "messages": [{
                        "role": "user",
                        "content": [
                            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{screenshot_base64}"}},
                            {"type": "text", "text": _VISION_PROMPT},
                        ],
                    }],
                    "max_tokens": 300,
                },
                timeout=settings.API_TIMEOUT,
            )
            if not resp.ok:
                logger.warning("Vision API returned %s: %s", resp.status_code, resp.text[:200])
                return
            raw = resp.json().get("choices", [{}])[0].get("message", {}).get("content", "")
            data = self._parse_json(raw)
            if data.get("exercise_name") and data["exercise_name"] != "Unknown":
                response.exercise_name = data["exercise_name"]
            if data.get("progress_level"):
                response.progress_level = data["progress_level"]
            if data.get("observations"):
                response.observations = data["observations"]
            response.status = "SUCCESS_VISION"
        except Exception as exc:
            logger.warning("Vision analysis failed: %s", exc)

    def _parse_json(self, text: str) -> dict:
        try:
            return json.loads(text.strip())
        except json.JSONDecodeError:
            pass
        match = re.search(r"\{[^{}]*\}", text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                pass
        return {}

    # ── File log ──────────────────────────────────────────────────────────────

    def _log_to_file(self, request: ScreenAnalysisRequest, response: ScreenAnalysisResponse):
        log_entry = {
            "timestamp": request.timestamp,
            "session_id": request.session_id,
            "student_identity": request.student_login_identity,
            "page_url": request.page_url,
            "dom_data_received": bool(request.dom_data),
            "screenshot_received": bool(request.screenshot_base64),
            "analysis_result": response.dict(),
        }
        try:
            data = []
            if os.path.exists(self.output_file):
                with open(self.output_file, "r", encoding="utf-8") as f:
                    try:
                        data = json.load(f)
                    except json.JSONDecodeError:
                        pass
            data.append(log_entry)
            with open(self.output_file, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
        except Exception as e:
            logger.error("Failed to write to JSON file: %s", e)
