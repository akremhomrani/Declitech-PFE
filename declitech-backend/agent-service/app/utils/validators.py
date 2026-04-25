from typing import Tuple, Optional, Dict, Any

from app.core.config import settings


def validate_session_code(session_code: str) -> Tuple[bool, str, Optional[Dict[str, Any]]]:
    if settings.LOCAL_ONLY:
        return True, "local_only", None

    try:
        import requests
        url = f"{settings.SESSION_SERVICE_URL}/api/sessions/code/{session_code}"
        headers = {"X-Gateway-Secret": settings.GATEWAY_SECRET}
        response = requests.get(url, headers=headers, timeout=5)

        if response.status_code != 200:
            return False, "not_found", None

        data = response.json()
        status = data.get("status", "")

        if status == "ACTIVE":
            return True, "ok", data
        if status == "EXPIRED":
            return False, "expired", data
        return False, "inactive", data

    except Exception:
        # Network failure — assume session is still valid to avoid disconnecting the student
        return True, "server_unreachable", None
