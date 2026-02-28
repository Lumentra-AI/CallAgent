import os
import logging

import httpx
from livekit.agents import RunContext
from livekit.agents.llm import function_tool

logger = logging.getLogger("lumentra-agent.tools")

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


async def _call_tool(context: RunContext, action: str, args: dict) -> str:
    """Call a tool via the lumentra-api internal endpoint."""
    agent = context.agent
    client = _get_client()

    try:
        resp = await client.post(
            f"/internal/voice-tools/{action}",
            json={
                "tenant_id": agent.tenant_config["id"],
                "call_sid": context.session.room.name if context.session else "",
                "caller_phone": agent.caller_phone,
                "escalation_phone": agent.tenant_config.get("escalation_phone", ""),
                "args": args,
            },
        )
        resp.raise_for_status()
        data = resp.json()
        result = data.get("result", {})
        return result.get("message", str(result))
    except httpx.HTTPStatusError as e:
        logger.error("Tool %s HTTP error: %s %s", action, e.response.status_code, e.response.text)
        return f"I encountered an error. Let me try again."
    except Exception as e:
        logger.error("Tool %s error: %s", action, e)
        return "I encountered an error. Let me try again."


@function_tool()
async def check_availability(
    context: RunContext,
    date: str,
    service_type: str = "",
) -> str:
    """Check available appointment slots for a date. Call this when customer asks
    about availability, open times, or when they can book.

    Args:
        date: Date in YYYY-MM-DD format.
        service_type: Optional service type like haircut, consultation.
    """
    return await _call_tool(context, "check_availability", {
        "date": date,
        "service_type": service_type,
    })


@function_tool()
async def create_booking(
    context: RunContext,
    customer_name: str,
    customer_phone: str,
    date: str,
    time: str,
    service_type: str = "general",
    notes: str = "",
) -> str:
    """Create an appointment booking. Only call after customer confirms a
    specific time slot and provides their name.

    Args:
        customer_name: Customer's name.
        customer_phone: Phone number. Use caller ID if available.
        date: Booking date in YYYY-MM-DD format.
        time: Time in 24-hour HH:MM format.
        service_type: Type of service.
        notes: Special requests or notes.
    """
    return await _call_tool(context, "create_booking", {
        "customer_name": customer_name,
        "customer_phone": customer_phone,
        "date": date,
        "time": time,
        "service_type": service_type,
        "notes": notes,
    })


@function_tool()
async def create_order(
    context: RunContext,
    customer_name: str,
    order_type: str,
    items: str,
    customer_phone: str = "",
    delivery_address: str = "",
    special_instructions: str = "",
) -> str:
    """Place a food order. Must have customer name, items, and order type
    (pickup or delivery) before calling.

    Args:
        customer_name: Customer's name for the order.
        order_type: Must be 'pickup' or 'delivery'.
        items: Comma-separated list of items.
        customer_phone: Phone number if different from caller ID.
        delivery_address: Required for delivery orders.
        special_instructions: Optional special requests.
    """
    return await _call_tool(context, "create_order", {
        "customer_name": customer_name,
        "customer_phone": customer_phone,
        "order_type": order_type,
        "items": items,
        "delivery_address": delivery_address,
        "special_instructions": special_instructions,
    })


@function_tool()
async def transfer_to_human(
    context: RunContext,
    reason: str,
) -> str:
    """Transfer to human staff. Only use when caller explicitly asks for a
    human, real person, manager, or wants to complain.

    Args:
        reason: One of: customer_request, complaint, refund_request, cannot_resolve.
    """
    result = await _call_tool(context, "transfer_to_human", {"reason": reason})

    # If transfer was successful and we have SIP, do a SIP transfer
    # The actual SIP REFER is handled by the API-side transfer logic
    return result


@function_tool()
async def end_call(
    context: RunContext,
    reason: str,
) -> str:
    """Hang up the call. Only call when the customer's request is fully handled
    AND they said goodbye.

    Args:
        reason: One of: conversation_complete, customer_requested_hangup, order_confirmed, booking_confirmed.
    """
    return await _call_tool(context, "end_call", {"reason": reason})
