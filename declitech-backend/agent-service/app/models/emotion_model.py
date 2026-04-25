import os
from typing import Dict

import numpy as np
import onnxruntime as ort

from app.core.config import settings
from app.utils.image_processing import preprocess_fer, softmax


class EmotionModel:

    def __init__(self, model_path: str = None):
        self.model_path = model_path or settings.MODEL_PATH

        if not os.path.exists(self.model_path):
            raise FileNotFoundError(f"Model not found: {self.model_path}")

        self.sess = ort.InferenceSession(self.model_path, providers=["CPUExecutionProvider"])

        self.inp = self.sess.get_inputs()[0]
        self.out = self.sess.get_outputs()[0]
        self.INPUT_NAME = self.inp.name
        self.OUTPUT_NAME = self.out.name
        self.nhwc = self._is_nhwc(self.inp.shape)

    @staticmethod
    def _is_nhwc(shape) -> bool:
        return (
            isinstance(shape, (list, tuple))
            and len(shape) == 4
            and shape[-1] in (1, 3)
        )

    @staticmethod
    def _looks_like_probabilities(arr: np.ndarray) -> bool:
        arr = np.array(arr).reshape(-1).astype(np.float32)
        if np.any(arr < -1e-6):
            return False
        total = float(np.sum(arr))
        return 0.98 <= total <= 1.02

    def predict(self, face_image: np.ndarray) -> Dict[str, float]:
        x = preprocess_fer(face_image, target=settings.model_input_size, nhwc=self.nhwc)

        y = self.sess.run([self.OUTPUT_NAME], {self.INPUT_NAME: x})[0]
        y = np.array(y).reshape(-1)

        probs = y if self._looks_like_probabilities(y) else softmax(y)
        probs = probs.astype(np.float32)

        if len(probs) != len(settings.emotion_classes_list):
            raise RuntimeError(
                f"Output size {len(probs)} != {len(settings.emotion_classes_list)}"
            )

        return {
            settings.emotion_classes_list[i]: float(probs[i])
            for i in range(len(settings.emotion_classes_list))
        }
