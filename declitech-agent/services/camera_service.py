from typing import Optional, Tuple
import cv2
import numpy as np

from config import settings


class CameraService:

    def __init__(self, camera_index: int = None):
        self.camera_index = camera_index if camera_index is not None else settings.CAMERA_INDEX
        self.cap: Optional[cv2.VideoCapture] = None
        self.is_opened = False

    def open(self) -> bool:
        if self.is_opened:
            return True

        self.cap = cv2.VideoCapture(self.camera_index)
        self.is_opened = self.cap.isOpened()
        return self.is_opened

    def close(self) -> None:
        if self.cap is not None:
            self.cap.release()
            self.is_opened = False

    def warmup(self, frames: int = None) -> None:
        if not self.is_opened:
            return

        warmup_frames = frames if frames is not None else settings.CAMERA_WARMUP_FRAMES
        for _ in range(warmup_frames):
            self.cap.read()

    def capture(self) -> Tuple[bool, Optional[np.ndarray]]:
        if not self.is_opened:
            return False, None

        success, frame = self.cap.read()
        return success, frame if success else None

    def __enter__(self):
        self.open()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()
