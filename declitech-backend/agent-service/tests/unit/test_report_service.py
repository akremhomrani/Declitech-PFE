import pytest
from app.services.report_service import ReportService


class TestReportServiceAggregateMean:
    """Tests unitaires pour ReportService.aggregate_mean()"""

    def test_returns_none_for_empty_list(self):
        """Aucune donnée → résultat None"""
        result = ReportService.aggregate_mean([])
        assert result is None

    def test_single_sample_returns_same_probabilities(self):
        """Un seul échantillon → moyenne = valeurs d'origine"""
        probs = {"happy": 0.8, "sad": 0.05, "angry": 0.05,
                 "fear": 0.05, "neutral": 0.05}
        result = ReportService.aggregate_mean([probs])
        assert result is not None
        assert result["n_samples"] == 1
        assert abs(result["mean_probs"]["happy"] - 0.8) < 0.001

    def test_two_samples_calculates_mean_correctly(self):
        """Deux échantillons → moyenne arithmétique correcte"""
        samples = [
            {"happy": 0.8, "sad": 0.1, "angry": 0.05, "fear": 0.03, "neutral": 0.02},
            {"happy": 0.6, "sad": 0.2, "angry": 0.1, "fear": 0.05, "neutral": 0.05},
        ]
        result = ReportService.aggregate_mean(samples)
        assert result is not None
        assert result["n_samples"] == 2
        assert abs(result["mean_probs"]["happy"] - 0.7) < 0.001
        assert abs(result["mean_probs"]["sad"] - 0.15) < 0.001

    def test_dominant_is_max_emotion(self):
        """L'émotion dominante est celle avec la probabilité moyenne maximale"""
        samples = [
            {"happy": 0.9, "sad": 0.05, "angry": 0.02, "fear": 0.02, "neutral": 0.01},
            {"happy": 0.85, "sad": 0.05, "angry": 0.05, "fear": 0.03, "neutral": 0.02},
        ]
        result = ReportService.aggregate_mean(samples)
        assert result["dominant"] == "happy"

    def test_sad_dominant_when_mostly_sad(self):
        """Sad dominant quand triste majoritairement"""
        samples = [
            {"happy": 0.1, "sad": 0.7, "angry": 0.05, "fear": 0.1, "neutral": 0.05},
        ]
        result = ReportService.aggregate_mean(samples)
        assert result["dominant"] == "sad"


class TestReportServiceSummarizeSession:
    """Tests unitaires pour ReportService.summarize_session()"""

    def test_insufficient_data_when_no_dominants(self):
        """Aucun visage détecté → DONNEES_INSUFFISANTES"""
        result = ReportService.summarize_session(
            dominants=[], probs_list=[],
            no_face_count=10, total_captures=10
        )
        assert result["state"] == "DONNEES_INSUFFISANTES"

    def test_insufficient_data_when_60_percent_no_face(self):
        """60% de captures sans visage → DONNEES_INSUFFISANTES"""
        dominants = ["happy"] * 4
        probs_list = [{"happy": 0.7, "sad": 0.1, "angry": 0.05,
                       "fear": 0.1, "neutral": 0.05}] * 4
        result = ReportService.summarize_session(
            dominants, probs_list, no_face_count=6, total_captures=10
        )
        assert result["state"] == "DONNEES_INSUFFISANTES"

    def test_satisfait_engage_when_mostly_happy(self):
        """Majoritairement heureux → SATISFAIT_ENGAGE"""
        dominants = ["happy"] * 8 + ["neutral"] * 2
        probs_list = [{"happy": 0.8, "sad": 0.05, "angry": 0.05,
                       "fear": 0.05, "neutral": 0.05}] * 10
        result = ReportService.summarize_session(
            dominants, probs_list, no_face_count=0, total_captures=10
        )
        assert result["state"] == "SATISFAIT_ENGAGE"
        assert "satisfait" in result["final_sentence"].lower()

    def test_frustre_when_mostly_angry(self):
        """Majoritairement en colère → FRUSTRE_NON_SATISFAIT"""
        dominants = ["angry"] * 7 + ["sad"] * 3
        probs_list = [{"happy": 0.05, "sad": 0.1, "angry": 0.75,
                       "fear": 0.05, "neutral": 0.05}] * 10
        result = ReportService.summarize_session(
            dominants, probs_list, no_face_count=0, total_captures=10
        )
        assert result["state"] == "FRUSTRE_NON_SATISFAIT"

    def test_stresse_when_mostly_fear(self):
        """Majoritairement peur → STRESSE_INQUIET"""
        dominants = ["fear"] * 6 + ["neutral"] * 4
        probs_list = [{"happy": 0.05, "sad": 0.05, "angry": 0.1,
                       "fear": 0.7, "neutral": 0.1}] * 10
        result = ReportService.summarize_session(
            dominants, probs_list, no_face_count=0, total_captures=10
        )
        assert result["state"] == "STRESSE_INQUIET"

    def test_confus_when_sad_and_fear_combined(self):
        """(sad_m + fear_m) >= 0.45 et angry/fear en dessous des seuils → CONFUS_EN_DIFFICULTE"""
        # Conditions vérifiées :
        # fear_f = 0.3 < 0.5   → pas STRESSE via freq
        # fear_m = 0.20 < 0.25 → pas STRESSE via mean
        # angry_f = 0, angry_m = 0 → pas FRUSTRE
        # sad_m + fear_m = 0.27 + 0.20 = 0.47 >= 0.45 → CONFUS !
        dominants = ["sad"] * 3 + ["fear"] * 3 + ["neutral"] * 4
        probs_list = [
            {"happy": 0.10, "sad": 0.27, "angry": 0.0, "fear": 0.20, "neutral": 0.43}
        ] * 10
        result = ReportService.summarize_session(
            dominants, probs_list, no_face_count=0, total_captures=10
        )
        assert result["state"] == "CONFUS_EN_DIFFICULTE"

    def test_neutre_when_mostly_neutral(self):
        """Neutre dominant et happy en dessous des seuils → NEUTRE_CALME"""
        # happy_f = 0.1 < 0.5, happy_m = 0.08 < 0.25, happy_f < neutral_f
        # → pas SATISFAIT. neutral_f = 0.8 >= 0.5 → NEUTRE_CALME
        dominants = ["neutral"] * 8 + ["sad"] * 2
        probs_list = [
            {"happy": 0.08, "sad": 0.08, "angry": 0.02, "fear": 0.02, "neutral": 0.80}
        ] * 10
        result = ReportService.summarize_session(
            dominants, probs_list, no_face_count=0, total_captures=10
        )
        assert result["state"] == "NEUTRE_CALME"

    def test_result_contains_freq_and_mean_probs(self):
        """Le résultat doit contenir freq et mean_probs"""
        dominants = ["happy"] * 5 + ["neutral"] * 5
        probs_list = [{"happy": 0.5, "sad": 0.05, "angry": 0.05,
                       "fear": 0.05, "neutral": 0.35}] * 10
        result = ReportService.summarize_session(
            dominants, probs_list, no_face_count=0, total_captures=10
        )
        if result["state"] != "DONNEES_INSUFFISANTES":
            assert "freq" in result
            assert "mean_probs" in result
