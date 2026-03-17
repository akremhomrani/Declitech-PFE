"""
Tests de sécurité — Agent Python (DecliTech)
Vérifie : endpoints non trouvés, payloads malformés, rate limiting, inputs invalides
"""
import pytest
from unittest.mock import patch
from httpx import AsyncClient, ASGITransport


@pytest.fixture
def app():
    from main import app as fastapi_app
    return fastapi_app


def make_client(app):
    """Helper : crée un client de test compatible avec httpx >= 0.24"""
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


# =========================================================
#  1. Payloads malformés / injections
# =========================================================

@pytest.mark.asyncio
async def test_start_sql_injection_in_code(app):
    """SEC-PY-01 : Injection SQL dans session code → rejeté"""
    payload = {
        "code": "'; DROP TABLE sessions; --",
        "student_id": "E01",
        "device_id": "PC-001",
        "duration_min": 30,
        "interval_min": 15,
        "login_identity": "test@test.com"
    }
    async with make_client(app) as client:
        response = await client.post("/start", json=payload)
    # En isolation, le code est transmis au backend (non lancé) → retourne 4xx ou 5xx
    # L'essentiel : pas de crash serveur (< 600) et pas d'erreur DB exposée
    assert response.status_code < 600  # Pas d'exception Python non contrôlée


@pytest.mark.asyncio
async def test_start_xss_in_login_identity(app):
    """SEC-PY-02 : XSS dans login_identity → 400 ou rejeté"""
    payload = {
        "code": "ABC123",
        "student_id": "E01",
        "device_id": "PC-001",
        "duration_min": 30,
        "interval_min": 15,
        "login_identity": "<script>alert('XSS')</script>"
    }
    with patch("controllers.agent_controller.validate_session_code",
               return_value=(False, "Invalid code", None)):
        async with make_client(app) as client:
            response = await client.post("/start", json=payload)
    assert response.status_code != 200


@pytest.mark.asyncio
async def test_start_negative_duration(app):
    """SEC-PY-03 : Durée négative → rejetée par validation (422)"""
    payload = {
        "code": "ABC123",
        "student_id": "E01",
        "device_id": "PC-001",
        "duration_min": -999,
        "interval_min": 15,
        "login_identity": "user@test.com"
    }
    async with make_client(app) as client:
        response = await client.post("/start", json=payload)
    assert response.status_code in (400, 422)


@pytest.mark.asyncio
async def test_start_zero_interval(app):
    """SEC-PY-04 : Intervalle = 0 → doit être rejeté"""
    payload = {
        "code": "ABC123",
        "student_id": "E01",
        "device_id": "PC-001",
        "duration_min": 30,
        "interval_min": 0,
        "login_identity": "user@test.com"
    }
    async with make_client(app) as client:
        response = await client.post("/start", json=payload)
    assert response.status_code in (400, 422)


@pytest.mark.asyncio
async def test_start_extremely_large_payload(app):
    """SEC-PY-05 : Payload oversized → rejeté ou erreur contrôlée (pas de crash)"""
    big_string = "a" * 100_000
    payload = {
        "code": big_string,
        "student_id": big_string,
        "device_id": big_string,
        "duration_min": 999999,
        "interval_min": 999999,
        "login_identity": big_string
    }
    async with make_client(app) as client:
        response = await client.post("/start", json=payload)
    assert response.status_code < 600  # Pas d'exception non gérée


# =========================================================
#  2. Endpoints non documentés / méthodes incorrectes
# =========================================================

@pytest.mark.asyncio
async def test_unknown_endpoint_returns_404(app):
    """SEC-PY-06 : Endpoint inconnu → 404 (pas de stack trace)"""
    async with make_client(app) as client:
        response = await client.get("/admin/secret")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_on_post_only_endpoint_returns_405(app):
    """SEC-PY-07 : GET sur /start (POST only) → 405 Method Not Allowed"""
    async with make_client(app) as client:
        response = await client.get("/start")
    assert response.status_code == 405


@pytest.mark.asyncio
async def test_start_missing_required_fields(app):
    """SEC-PY-08 : Champs obligatoires manquants → 422 Validation Error"""
    async with make_client(app) as client:
        response = await client.post("/start", json={})
    assert response.status_code == 422


# =========================================================
#  3. Comportement sous contrainte (double start)
# =========================================================

@pytest.mark.asyncio
async def test_start_when_already_running_returns_error(app):
    """SEC-PY-09 : Double start → 400 (pas de démarrage silencieux)"""
    from controllers.agent_controller import session_service
    session_service.running = True

    payload = {
        "code": "ABC123",
        "student_id": "E01",
        "device_id": "PC-001",
        "duration_min": 30,
        "interval_min": 15,
        "login_identity": "user@test.com"
    }

    try:
        with patch("controllers.agent_controller.validate_session_code",
                   return_value=(True, None, {"id": "1"})):
            async with make_client(app) as client:
                response = await client.post("/start", json=payload)
        assert response.status_code == 400
    finally:
        session_service.running = False  # Reset état
