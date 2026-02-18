from typing import Tuple, Optional, Dict, Any
from config import settings


def validate_session_code(session_code: str) -> Tuple[bool, str, Optional[Dict[str, Any]]]:
    if settings.LOCAL_ONLY:
        return True, "local_only", None
    
    if not settings.SERVER_BASE_URL:
        return False, "server_not_configured", None

    try:
        from services.api_client import APIClient
        
        api_client = APIClient()
        response = api_client.get(f"/api/sessions/code/{session_code}")
        
        if response is None:
            return False, "server_not_configured", None
        
        if response.status_code != 200:
            return False, "not_found", None

        data = response.json()
        is_active = bool(data.get("isActive", False))
        is_expired = bool(data.get("isExpired", False))

        if not is_active:
            return False, "inactive", data
        
        if is_expired:
            return False, "expired", data

        return True, "ok", data
        
    except Exception:
        return False, "error", None
