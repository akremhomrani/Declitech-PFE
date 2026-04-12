import logging
from typing import Optional

import requests

from config import settings

logger = logging.getLogger(__name__)


class APIClient:

    def __init__(self, base_url: Optional[str] = None, token: Optional[str] = None):
        self.base_url = base_url or settings.SERVER_BASE_URL
        self.token = token
        self.timeout = settings.API_TIMEOUT

    def _get_headers(self, include_auth: bool = False) -> dict:
        headers = {
            "Content-Type": "application/json",
            "X-Gateway-Secret": settings.GATEWAY_SECRET,
        }
        if include_auth and self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        return headers

    def post(
        self,
        path: str,
        json_body: dict,
        include_auth: bool = False,
    ) -> Optional[requests.Response]:
        if not self.base_url:
            return None

        url = self.base_url + path
        try:
            return requests.post(
                url,
                json=json_body,
                headers=self._get_headers(include_auth),
                timeout=self.timeout,
            )
        except Exception as e:
            logger.warning("POST %s failed: %s", url, e)
            return None

    def get(
        self,
        path: str,
        include_auth: bool = False,
    ) -> Optional[requests.Response]:
        if not self.base_url:
            return None

        url = self.base_url + path
        try:
            return requests.get(
                url,
                headers=self._get_headers(include_auth),
                timeout=self.timeout,
            )
        except Exception as e:
            logger.warning("GET %s failed: %s", url, e)
            return None
