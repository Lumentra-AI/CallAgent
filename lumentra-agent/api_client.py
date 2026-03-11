import os
import logging

import httpx

logger = logging.getLogger("lumentra-agent.api")

_client: httpx.AsyncClient | None = None


def get_client() -> httpx.AsyncClient:
    """Return a shared httpx client for internal API calls.

    Reads env vars lazily so python-dotenv has time to load .env first.
    Fails loudly if INTERNAL_API_KEY is not set.
    """
    global _client
    if _client is None:
        api_url = os.environ.get("INTERNAL_API_URL", "http://localhost:3100")
        api_key = os.environ.get("INTERNAL_API_KEY", "")
        if not api_key:
            logger.critical("INTERNAL_API_KEY not set -- agent cannot authenticate with API")
            raise RuntimeError("INTERNAL_API_KEY environment variable is required")
        _client = httpx.AsyncClient(
            base_url=api_url,
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=10.0,
        )
    return _client
