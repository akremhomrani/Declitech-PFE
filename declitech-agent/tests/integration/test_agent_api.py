import pytest
from unittest.mock import patch, MagicMock
from httpx import AsyncClient


@pytest.fixture
def app():
    """Fixture pour créer l'application FastAPI en mode test"""
    from main import app as fastapi_app
    return fastapi_app


@pytest.mark.asyncio
async def test_root_returns_api_info(app):
    """GET / → doit retourner le nom et la version de l'API"""
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["ok"] is True
    assert "DecliTech" in data["name"]
    assert "endpoints" in data


@pytest.mark.asyncio
async def test_status_not_running_initially(app):
    """GET /status → running=False au démarrage"""
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/status")
    assert response.status_code == 200
    data = response.json()
    assert data["running"] is False
    assert data["session_id"] is None


@pytest.mark.asyncio
async def test_start_requires_login_identity(app):
    """POST /start sans login_identity → 400"""
    payload = {
        "code": "ABC123",
        "student_id": "E01",
        "device_id": "PC-001",
        "duration_min": 30,
        "interval_min": 15,
        "login_identity": "   "   # vide
    }
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.post("/start", json=payload)
    assert response.status_code == 400
    assert "login_identity" in response.json().get("detail", "")


@pytest.mark.asyncio
async def test_validate_session_returns_valid_false_for_bad_code(app):
    """GET /validate/{code} → valid=False si code invalide"""
    with patch("controllers.agent_controller.validate_session_code",
               return_value=(False, "Session not found or inactive", None)):
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get("/validate/XXXXXX")
    assert response.status_code == 200
    data = response.json()
    assert data["valid"] is False
    assert data["reason"] is not None


@pytest.mark.asyncio
async def test_stop_when_not_running_returns_stopped(app):
    """POST /stop quand agent non démarré → statut STOPPED sans erreur"""
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.post("/stop")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "STOPPED"
