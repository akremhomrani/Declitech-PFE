from typing import List, Dict, Any, Optional
from collections import Counter

from app.core.config import settings


class ReportService:

    @staticmethod
    def aggregate_mean(results: List[Dict[str, float]]) -> Optional[Dict]:
        if not results:
            return None

        mean = {emotion: 0.0 for emotion in settings.emotion_classes_list}

        for result in results:
            for emotion in settings.emotion_classes_list:
                mean[emotion] += float(result.get(emotion, 0.0))

        n_samples = len(results)
        for emotion in mean:
            mean[emotion] /= n_samples

        dominant = max(mean, key=mean.get)
        return {"mean_probs": mean, "dominant": dominant, "n_samples": n_samples}

    @staticmethod
    def summarize_session(
        dominants: List[str],
        probs_list: List[Dict[str, float]],
        no_face_count: int,
        total_captures: int,
        camera_available: bool = True,
    ) -> Dict[str, Any]:
        if not camera_available:
            return {
                "state": "CAMERA_UNAVAILABLE",
                "final_sentence": "Caméra indisponible pendant la session : aucune donnée émotionnelle collectée.",
            }

        valid = len(dominants)

        if valid == 0 or (no_face_count / max(1, total_captures)) >= 0.6:
            return {
                "state": "DONNEES_INSUFFISANTES",
                "final_sentence": "Données insuffisantes : visage fréquemment non détecté pendant la session.",
            }

        counts = Counter(dominants)
        freq = {e: counts.get(e, 0) / valid for e in settings.emotion_classes_list}

        mean = {e: 0.0 for e in settings.emotion_classes_list}
        for probs in probs_list:
            for e in settings.emotion_classes_list:
                mean[e] += float(probs.get(e, 0.0))
        for e in mean:
            mean[e] /= valid

        angry_f, sad_f, fear_f, happy_f, neutral_f = (
            freq["angry"], freq["sad"], freq["fear"], freq["happy"], freq["neutral"],
        )
        angry_m, sad_m, fear_m, happy_m, neutral_m = (
            mean["angry"], mean["sad"], mean["fear"], mean["happy"], mean["neutral"],
        )

        def result(state: str, sentence: str) -> Dict[str, Any]:
            return {"state": state, "final_sentence": sentence, "freq": freq, "mean_probs": mean}

        if angry_f >= 0.5 or angry_m >= 0.25 or (angry_f + sad_f) >= 0.6:
            return result("FRUSTRE_NON_SATISFAIT", "L'élève semble frustré ou insatisfait pendant la session.")
        if fear_f >= 0.5 or fear_m >= 0.25:
            return result("STRESSE_INQUIET", "L'élève semble stressé ou anxieux pendant la session.")
        if (sad_f + fear_f) >= 0.6 or (sad_m + fear_m) >= 0.45:
            return result("CONFUS_EN_DIFFICULTE", "L'élève semble confus ou en difficulté pendant la session.")
        if happy_f >= 0.5 or happy_m >= 0.25 or (happy_f > sad_f and happy_f > angry_f):
            return result("SATISFAIT_ENGAGE", "L'élève semble satisfait et profondément engagé pendant la session.")
        if neutral_f >= 0.5 or neutral_m >= 0.40:
            return result("NEUTRE_CALME", "L'élève semble neutre et calme pendant la session.")

        dominant_global = max(mean, key=mean.get)
        return result(
            "ETAT_MIXTE",
            f"État émotionnel mixte pendant la session. Tendance principale : {dominant_global}.",
        )
