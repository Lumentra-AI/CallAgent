import os
import logging

import httpx

logger = logging.getLogger("lumentra-agent.tenant")

API_URL = os.environ.get("INTERNAL_API_URL", "http://localhost:3100")
API_KEY = os.environ.get("INTERNAL_API_KEY", "")

_client: httpx.AsyncClient | None = None


def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(
            base_url=API_URL,
            headers={"Authorization": f"Bearer {API_KEY}"},
            timeout=10.0,
        )
    return _client


async def get_tenant_by_phone(phone: str) -> dict | None:
    """Fetch tenant configuration from lumentra-api by phone number.

    Returns tenant config dict including system_prompt, voice_config,
    greetings, escalation settings, etc.
    """
    client = _get_client()

    try:
        resp = await client.get(f"/internal/tenants/by-phone/{phone}")

        if resp.status_code == 404:
            logger.warning("No tenant found for phone: %s", phone)
            return None

        resp.raise_for_status()
        return resp.json()
    except httpx.HTTPStatusError as e:
        logger.error(
            "Tenant lookup HTTP error: %s %s",
            e.response.status_code,
            e.response.text,
        )
        return None
    except Exception as e:
        logger.error("Tenant lookup error: %s", e)
        return None
