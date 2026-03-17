"""
Suivi Pédagogique — Service IA (Google Gemini API)
"""
import httpx
import json
import logging
from typing import Optional

logger = logging.getLogger(__name__)

GEMINI_API_KEY = "AIzaSyAnWMjDF7Su9GNyi_sFlPt0rSCMiOwRg5o"
GEMINI_MODEL = "gemini-1.5-flash"
GEMINI_BASE_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"
REQUEST_TIMEOUT = 60

async def is_ai_available() -> bool:
    return True

async def _ask_gemini(prompt: str, temperature: float = 0.2) -> str:
    try:
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            r = await client.post(
                GEMINI_BASE_URL,
                json={
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {"temperature": temperature, "maxOutputTokens": 300}
                }
            )
            r.raise_for_status()
            data = r.json()
            try:
                return data["candidates"][0]["content"]["parts"][0]["text"].strip()
            except (KeyError, IndexError):
                logger.error(f"Format de réponse Gemini inattendu : {data}")
                return ""
    except Exception as e:
        logger.error(f"Erreur Gemini : {e}")
        return ""

async def generate_expected_solution(
    activity_title: str,
    site: str,
    level_number: Optional[int] = None,
    instructions: Optional[str] = None
) -> str:
    prompt = (
        f"Tu es un expert pédagogique. Donne la solution courte attendue pour l'activité '{activity_title}' sur {site}.\n"
        f"Structure en 4 points: Objectif, Commandes clés, Logique, Erreurs courantes."
    )
    return await _ask_gemini(prompt, temperature=0.1)

async def evaluate_student_work(
    activity_title: str,
    expected_solution: str,
    student_work: str,
    site: str = "generic",
    completed: bool = False,
    score_from_site: Optional[int] = None
) -> dict:
    if completed:
        return {"score": 100, "correct": True, "feedback": "🏆 Niveau complété avec succès ! Excellent travail !", "source": "IA"}
        
    if not student_work.strip():
        return _heuristic_evaluation(student_work, completed)

    prompt = (
        f"Tu es Prof-IA. Evalue le code de l'élève pour '{activity_title}'.\n"
        f"Solution attendue: {expected_solution}\n"
        f"Code élève:\n{student_work}\n\n"
        f"Donne une note sur 100 et un feedback très court.\n"
        f"Réponds STRICTEMENT en JSON : {{\"score\": 85, \"feedback\": \"...\"}}"
    )
    res = await _ask_gemini(prompt, temperature=0.05)
    
    try:
        start = res.find('{')
        end = res.rfind('}') + 1
        if start >= 0 and end > start:
            data = json.loads(res[start:end])
            return {
                "score": int(data.get("score", 50)),
                "correct": int(data.get("score", 50)) >= 60,
                "feedback": data.get("feedback", "Bon travail en cours."),
                "source": "IA"
            }
    except Exception:
        pass
    
    return _heuristic_evaluation(student_work, completed)

def _heuristic_evaluation(student_work: str, completed: bool) -> dict:
    work_len = len(student_work.strip())
    if completed:
        return {"score": 100, "correct": True, "feedback": "✅ Niveau complet", "source": "heuristic"}
    if work_len > 100:
        return {"score": 65, "correct": True, "feedback": "📝 Travail en cours...", "source": "heuristic"}
    if work_len > 20:
        return {"score": 40, "correct": False, "feedback": "🔄 Début de code...", "source": "heuristic"}
    return {"score": 10, "correct": False, "feedback": "⏳ En attente d'action...", "source": "heuristic"}

_solution_cache: dict[str, str] = {}
async def get_or_generate_solution(activity_title: str, site: str, level_number: Optional[int] = None, instructions: Optional[str] = None) -> str:
    cache_key = f"{site}:{activity_title}:{level_number}"
    if cache_key in _solution_cache: return _solution_cache[cache_key]
    sol = await generate_expected_solution(activity_title, site, level_number, instructions)
    _solution_cache[cache_key] = sol
    return sol

_PHASE_FALLBACKS = {
    "STARTED":        "🚀 L'élève vient de démarrer le niveau.",
    "IN_PROGRESS":    "📝 L'élève progresse et ajoute du code.",
    "STALLED":        "⏸️ L'élève ne semble pas avoir avancé depuis le dernier scan.",
    "LEVEL_COMPLETE": "🏆 Niveau complété avec succès ! Excellent travail !",
    "NEW_LEVEL":      "⬆️ L'élève passe au niveau suivant — belle progression !",
}

async def generate_phase_phrase(phase: str, level_name: str, blocks_count: int = 0, completed: bool = False, site: str = "codecombat.com") -> str:
    phase_desc = {
        "STARTED":        f"vient de démarrer le niveau \"{level_name}\" avec {blocks_count} bloc(s)",
        "IN_PROGRESS":    f"progresse sur \"{level_name}\" — {blocks_count} bloc(s) écrits",
        "STALLED":        f"est bloqué sur \"{level_name}\" sans changement depuis 30s",
        "LEVEL_COMPLETE": f"a terminé le niveau \"{level_name}\" avec succès",
        "NEW_LEVEL":      f"passe au nouveau niveau \"{level_name}\"",
    }.get(phase, f"travaille sur \"{level_name}\"")

    prompt = (
        f"Tu es un assistant pédagogique. Génère UNE seule phrase courte (max 15 mots) en français pour informer "
        f"l'enseignant que l'élève {phase_desc}.\nSois positif. Pas de guillemets."
    )
    raw = await _ask_gemini(prompt, temperature=0.4)
    if not raw:
        return _PHASE_FALLBACKS.get(phase, "L'élève travaille sur le niveau.")
        
    phrase = raw.strip().split('\n')[0].strip().strip('"').strip("'")
    if not phrase or len(phrase) < 5:
        return _PHASE_FALLBACKS.get(phase, "L'élève travaille activement.")
    return phrase
