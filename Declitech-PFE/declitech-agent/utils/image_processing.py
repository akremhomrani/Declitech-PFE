import cv2
import numpy as np


def softmax(x: np.ndarray) -> np.ndarray:
    x = x.astype(np.float32)
    x = x - np.max(x)
    e = np.exp(x)
    return e / (np.sum(e) + 1e-9)


def preprocess_fer(
    face_bgr: np.ndarray,
    target: tuple = (48, 48),
    nhwc: bool = False
) -> np.ndarray:
    gray = cv2.cvtColor(face_bgr, cv2.COLOR_BGR2GRAY)
    
    resized = cv2.resize(gray, target, interpolation=cv2.INTER_AREA)
    
    normalized = resized.astype(np.float32) / 255.0
    
    if nhwc:
        return normalized[None, :, :, None]
    else:
        return normalized[None, None, :, :]
