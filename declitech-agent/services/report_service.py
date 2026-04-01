import json
from typing import List, Dict, Any, Optional
from collections import Counter

from config import settings


class ReportService:

    @staticmethod
    def aggregate_mean(results: List[Dict[str, float]]) -> Optional[Dict]:
        if not results:
            return None

        mean = {emotion: 0.0 for emotion in settings.EMOTION_CLASSES}
        
        for result in results:
            for emotion in settings.EMOTION_CLASSES:
                mean[emotion] += float(result.get(emotion, 0.0))

        n_samples = len(results)
        for emotion in mean:
            mean[emotion] /= n_samples

        dominant = max(mean, key=mean.get)

        return {
            "mean_probs": mean,
            "dominant": dominant,
            "n_samples": n_samples
        }

    @staticmethod
    def summarize_session(
        dominants: List[str],
        probs_list: List[Dict[str, float]],
        no_face_count: int,
        total_captures: int
    ) -> Dict[str, Any]:
        valid = len(dominants)

        if valid == 0 or (no_face_count / max(1, total_captures)) >= 0.6:
            return {
                "state": "Insufficient data: face frequently not detected during the session.",
                "finalSentence": "Insufficient data: face frequently not detected during the session."
            }

        counts = Counter(dominants)
        freq = {emotion: counts.get(emotion, 0) / valid for emotion in settings.EMOTION_CLASSES}

        mean = {emotion: 0.0 for emotion in settings.EMOTION_CLASSES}
        for probs in probs_list:
            for emotion in settings.EMOTION_CLASSES:
                mean[emotion] += float(probs.get(emotion, 0.0))
        for emotion in mean:
            mean[emotion] /= valid

        angry_f, sad_f, fear_f, happy_f, neutral_f = (
            freq["angry"], freq["sad"], freq["fear"],
            freq["happy"], freq["neutral"]
        )
        angry_m, sad_m, fear_m, happy_m, neutral_m = (
            mean["angry"], mean["sad"], mean["fear"],
            mean["happy"], mean["neutral"]
        )

        if angry_f >= 0.5 or angry_m >= 0.25 or (angry_f + sad_f) >= 0.6:
            return {
                "state": "The student appears frustrated or dissatisfied during the session.",
                "finalSentence": "The student appears frustrated or dissatisfied during the session.",
                "freq": freq,
                "mean_probs": mean
            }

        if fear_f >= 0.5 or fear_m >= 0.25:
            return {
                "state": "The student appears stressed or anxious during the session.",
                "finalSentence": "The student appears stressed or anxious during the session.",
                "freq": freq,
                "mean_probs": mean
            }

        if (sad_f + fear_f) >= 0.6 or (sad_m + fear_m) >= 0.45:
            return {
                "state": "The student appears to be struggling or confused during the session.",
                "finalSentence": "The student appears to be struggling or confused during the session.",
                "freq": freq,
                "mean_probs": mean
            }

        if happy_f >= 0.5 or happy_m >= 0.25 or (happy_f > sad_f and happy_f > angry_f):
            return {
                "state": "The student appears satisfied and deeply engaged during the session.",
                "finalSentence": "The student appears satisfied and deeply engaged during the session.",
                "freq": freq,
                "mean_probs": mean
            }

        if neutral_f >= 0.5 or neutral_m >= 0.40:
            return {
                "state": "The student appears neutral and calm during the session.",
                "finalSentence": "The student appears neutral and calm during the session.",
                "freq": freq,
                "mean_probs": mean
            }

        dominant_global = max(mean, key=mean.get)
        return {
            "state": f"Mixed emotional state during the session. Primary tendency: {dominant_global}.",
            "finalSentence": f"Mixed emotional state during the session. Primary tendency: {dominant_global}.",
            "freq": freq,
            "mean_probs": mean
        }


