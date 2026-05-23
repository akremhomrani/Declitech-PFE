from typing import Dict

import math
import numpy as np

from app.models.emotion_model import EmotionModel
from app.services.face_detection_service import FaceDetectionService

MODEL_VERSION = "fer-mini-xception-v1"
EMOTION_CLASSES = ["angry", "disgust", "fear", "happy", "sad", "surprise", "neutral"]


class EmotionService:

    def __init__(self):
        self.model = EmotionModel()
        self.face_detector = FaceDetectionService()

    def analyze_frame(self, frame: np.ndarray) -> Dict:
        try:
            face = self.face_detector.detect_and_crop(frame)
            if face is None:
                return self._wrap_status("no_face")

            probs = self.model.predict(face)
            dominant, margin, confidence, entropy = self._derive_metrics(probs)
            quality = self._quality_proxy(face)
            return {
                "status": "ok",
                "dominant": dominant,
                "probabilities": probs,
                "margin": margin,
                "entropy": entropy,
                "confidence": confidence,
                "quality": quality,
                "modelVersion": MODEL_VERSION,
                "classLabels": EMOTION_CLASSES,
            }

        except Exception as e:
            return {"status": "error", "error": str(e), "modelVersion": MODEL_VERSION}

    def _wrap_status(self, status: str) -> Dict:
        return {"status": status, "modelVersion": MODEL_VERSION}

    @staticmethod
    def _derive_metrics(probs: Dict[str, float]):
        ordered = sorted(probs.values(), reverse=True)
        top1 = ordered[0] if ordered else 0.0
        top2 = ordered[1] if len(ordered) > 1 else 0.0
        margin = top1 - top2
        dominant = max(probs, key=probs.get) if probs else None
        n = max(1, len(probs))
        h = 0.0
        for v in probs.values():
            if v > 1e-9:
                h -= v * math.log2(v)
        entropy = h / math.log2(n) if n > 1 else 0.0
        return dominant, margin, top1, entropy

    @staticmethod
    def _quality_proxy(face: np.ndarray) -> float:
        if face is None or face.size == 0:
            return 0.0
        gray = face if face.ndim == 2 else np.mean(face, axis=2)
        mean = float(np.mean(gray)) / 255.0
        brightness = 1.0 - min(1.0, abs(mean - 0.5) * 2.0)
        laplacian = (
            -4 * gray[1:-1, 1:-1]
            + gray[:-2, 1:-1]
            + gray[2:, 1:-1]
            + gray[1:-1, :-2]
            + gray[1:-1, 2:]
        )
        blur = float(min(1.0, np.var(laplacian) / 400.0))
        return float(0.5 * blur + 0.5 * brightness)
