import logging

import httpx

from api_client import get_client

logger = logging.getLogger("lumentra-agent.tenant")


def apply_defaults(config: dict) -> dict:
    """Fill in sensible defaults for null config fields.

    Defense-in-depth: even if the API returns incomplete config,
    the agent should never crash or say 'None' to a caller.
    """
    tenant_id = config.get("id", "unknown")
    business = config.get("business_name") or "our business"

    if not config.get("agent_name"):
        config["agent_name"] = "AI Assistant"
        logger.warning("[TENANT %s] Missing agent_name, using default", tenant_id)

    if not config.get("business_name"):
        config["business_name"] = "our business"
        logger.warning("[TENANT %s] Missing business_name, using default", tenant_id)

    if not config.get("greeting_standard"):
        config["greeting_standard"] = (
            f"Thank you for calling {business}. How can I help you today?"
        )
        logger.warning("[TENANT %s] Missing greeting_standard, using default", tenant_id)

    if not config.get("greeting_after_hours"):
        config["greeting_after_hours"] = (
            f"Thank you for calling {business}. We're currently closed, "
            "but I can still help you with general questions or take a message."
        )
        logger.warning("[TENANT %s] Missing greeting_after_hours, using default", tenant_id)

    if not config.get("timezone"):
        config["timezone"] = "America/New_York"
        logger.warning("[TENANT %s] Missing timezone, using default", tenant_id)

    if not config.get("operating_hours"):
        config["operating_hours"] = {
            "monday": {"open": "09:00", "close": "17:00"},
            "tuesday": {"open": "09:00", "close": "17:00"},
            "wednesday": {"open": "09:00", "close": "17:00"},
            "thursday": {"open": "09:00", "close": "17:00"},
            "friday": {"open": "09:00", "close": "17:00"},
            "saturday": None,
            "sunday": None,
        }
        logger.warning("[TENANT %s] Missing operating_hours, using default", tenant_id)

    if config.get("escalation_enabled") and not config.get("escalation_phone"):
        config["escalation_enabled"] = False
        logger.warning(
            "[TENANT %s] Escalation enabled but no phone number, disabling",
            tenant_id,
        )

    if not config.get("transfer_behavior"):
        config["transfer_behavior"] = {"type": "warm", "no_answer": "message"}
        logger.warning("[TENANT %s] Missing transfer_behavior, using default", tenant_id)

    return config


async def get_tenant_by_phone(phone: str) -> dict | None:
    """Fetch tenant configuration from lumentra-api by phone number.

    Returns tenant config dict including system_prompt, voice_config,
    greetings, escalation settings, etc.
    """
    client = get_client()

    try:
        resp = await client.get(f"/internal/tenants/by-phone/{phone}")

        if resp.status_code == 404:
            logger.warning("No tenant found for phone: %s", phone)
            return None

        resp.raise_for_status()
        config = resp.json()
        return apply_defaults(config)
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
