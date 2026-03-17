from typing import Dict
import numpy as np

from models import EmotionModel
from services.face_detection_service import FaceDetectionService


class EmotionService:

    def __init__(self):
        self.model = EmotionModel()
        self.face_detector = FaceDetectionService()

    def analyze_frame(self, frame: np.ndarray) -> Dict:
        try:
            face = self.face_detector.detect_and_crop(frame)

            if face is None:
                return {"status": "no_face"}

            probs = self.model.predict(face)
            dominant = max(probs, key=probs.get)

            return {
                "status": "ok",
                "dominant": dominant,
                "probabilities": probs
            }

        except Exception as e:
            return {
                "status": "error",
                "error": str(e)
            }
