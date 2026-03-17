from typing import Optional
import cv2
import numpy as np

from config import settings


class FaceDetectionService:

    def __init__(self):
        self.haar = cv2.CascadeClassifier(
            cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        )

    def detect_and_crop(self, img_bgr: np.ndarray) -> Optional[np.ndarray]:
        gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)

        faces = self.haar.detectMultiScale(
            gray,
            scaleFactor=settings.FACE_SCALE_FACTOR,
            minNeighbors=settings.FACE_MIN_NEIGHBORS,
            minSize=settings.FACE_MIN_SIZE
        )

        if len(faces) == 0:
            return None

        x, y, w, h = max(faces, key=lambda f: f[2] * f[3])

        margin = int(settings.FACE_MARGIN_PERCENT * w)
        x1 = max(0, x - margin)
        y1 = max(0, y - margin)
        x2 = min(img_bgr.shape[1], x + w + margin)
        y2 = min(img_bgr.shape[0], y + h + margin)

        face = img_bgr[y1:y2, x1:x2]

        return face if face.size > 0 else None
