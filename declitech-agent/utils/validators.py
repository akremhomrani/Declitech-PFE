from typing import Tuple, Optional, Dict, Any
from config import settings


def validate_session_code(session_code: str) -> Tuple[bool, str, Optional[Dict[str, Any]]]:
    if settings.LOCAL_ONLY:
        return True, "local_only", None
    
    try:
        import requests
        url = f"{settings.SPRING_BOOT_URL}/api/sessions/code/{session_code}"
        
        response = requests.get(url, timeout=5)
        
        if response.status_code != 200:
            return False, "not_found", None

        data = response.json()
        status = data.get("status", "")

        is_active = (status == "ACTIVE")
        is_expired = (status == "EXPIRED")

        if not is_active:
            if is_expired:
                return False, "expired", data
            return False, "inactive", data

        return True, "ok", data
        
    except Exception:
        # En cas d'erreur réseau : on considère la session toujours valide
        # (évite la déconnexion automatique si le serveur est temporairement injoignable)
        return True, "server_unreachable", None
