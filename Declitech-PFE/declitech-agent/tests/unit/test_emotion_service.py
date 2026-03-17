import numpy as np
import pytest
from unittest.mock import MagicMock, patch


class TestEmotionService:
    """Tests unitaires pour EmotionService"""

    def setup_method(self):
        """Initialise le service avec des mocks pour éviter le chargement du modèle ONNX"""
        with patch("services.emotion_service.EmotionModel") as mock_model_cls, \
             patch("services.emotion_service.FaceDetectionService") as mock_detector_cls:
            from services.emotion_service import EmotionService
            self.service = EmotionService()
            self.mock_model = self.service.model
            self.mock_detector = self.service.face_detector

    def _make_frame(self):
        """Crée une frame de test (image noire 480x640)"""
        return np.zeros((480, 640, 3), dtype=np.uint8)

    def test_analyze_frame_no_face_detected(self):
        """Aucun visage détecté → status='no_face'"""
        self.service.face_detector.detect_and_crop = MagicMock(return_value=None)
        frame = self._make_frame()

        result = self.service.analyze_frame(frame)

        assert result["status"] == "no_face"

    def test_analyze_frame_returns_dominant_emotion(self):
        """Visage détecté → dominant = émotion avec proba max"""
        fake_face = np.zeros((48, 48, 1), dtype=np.uint8)
        fake_probs = {
            "happy": 0.75, "sad": 0.05, "angry": 0.05,
            "fear": 0.05, "neutral": 0.1
        }
        self.service.face_detector.detect_and_crop = MagicMock(return_value=fake_face)
        self.service.model.predict = MagicMock(return_value=fake_probs)
        frame = self._make_frame()

        result = self.service.analyze_frame(frame)

        assert result["status"] == "ok"
        assert result["dominant"] == "happy"
        assert result["probabilities"]["happy"] == 0.75

    def test_analyze_frame_angry_dominant(self):
        """Émotion angry dominante → dominant='angry'"""
        fake_face = np.zeros((48, 48, 1), dtype=np.uint8)
        fake_probs = {
            "happy": 0.1, "sad": 0.1, "angry": 0.6,
            "fear": 0.1, "neutral": 0.1
        }
        self.service.face_detector.detect_and_crop = MagicMock(return_value=fake_face)
        self.service.model.predict = MagicMock(return_value=fake_probs)

        result = self.service.analyze_frame(self._make_frame())

        assert result["dominant"] == "angry"

    def test_analyze_frame_handles_exception_gracefully(self):
        """Exception pendant l'analyse → status='error' sans crash"""
        self.service.face_detector.detect_and_crop = MagicMock(
            side_effect=Exception("Camera error")
        )
        frame = self._make_frame()

        result = self.service.analyze_frame(frame)

        assert result["status"] == "error"
        assert "error" in result

    def test_analyze_frame_probabilities_dict_returned(self):
        """Le résultat contient le dict complet des probabilités"""
        fake_face = np.zeros((48, 48, 1), dtype=np.uint8)
        fake_probs = {"happy": 0.5, "sad": 0.1, "angry": 0.1,
                      "fear": 0.1, "neutral": 0.2}
        self.service.face_detector.detect_and_crop = MagicMock(return_value=fake_face)
        self.service.model.predict = MagicMock(return_value=fake_probs)

        result = self.service.analyze_frame(self._make_frame())

        assert "probabilities" in result
        assert set(result["probabilities"].keys()) == {"happy", "sad", "angry", "fear", "neutral"}
