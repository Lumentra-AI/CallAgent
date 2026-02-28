import os
import logging
from datetime import datetime, timezone

import httpx

logger = logging.getLogger("lumentra-agent.call_logger")

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


async def log_call(
    tenant_id: str,
    call_sid: str,
    caller_phone: str,
    session,
    started_at: datetime | None = None,
) -> None:
    """Log a completed call to lumentra-api.

    Extracts transcript from the agent session's chat context
    and posts it to the internal calls/log endpoint.
    """
    client = _get_client()
    now = datetime.now(timezone.utc)

    # Build transcript from chat context if available
    transcript = ""
    try:
        if session and hasattr(session, "chat_ctx") and session.chat_ctx:
            lines = []
            for msg in session.chat_ctx.items:
                if hasattr(msg, "role") and hasattr(msg, "text_content"):
                    role = msg.role
                    text = msg.text_content
                    if text and role in ("user", "assistant"):
                        speaker = "Customer" if role == "user" else "Agent"
                        lines.append(f"{speaker}: {text}")
            transcript = "\n".join(lines)
    except Exception as e:
        logger.warning("Failed to extract transcript: %s", e)

    # Calculate duration
    start = started_at or now
    duration = int((now - start).total_seconds())

    try:
        resp = await client.post(
            "/internal/calls/log",
            json={
                "tenant_id": tenant_id,
                "call_sid": call_sid,
                "caller_phone": caller_phone,
                "direction": "inbound",
                "status": "completed",
                "started_at": start.isoformat(),
                "ended_at": now.isoformat(),
                "duration_seconds": duration,
                "ended_reason": "completed",
                "outcome_type": "inquiry",
                "outcome_success": True,
                "transcript": transcript or None,
                "summary": None,
            },
        )
        resp.raise_for_status()
        logger.info("Call logged: %s (%ds)", call_sid, duration)
    except Exception as e:
        logger.error("Failed to log call %s: %s", call_sid, e)
