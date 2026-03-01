import asyncio
import logging

from livekit.agents import RunContext
from livekit.agents.llm import function_tool
from livekit import rtc

from api_client import get_client

logger = logging.getLogger("lumentra-agent.tools")


async def _call_tool(context: RunContext, action: str, args: dict) -> str:
    """Call a tool via the lumentra-api internal endpoint."""
    agent = context.session.current_agent
    client = get_client()

    try:
        resp = await client.post(
            f"/internal/voice-tools/{action}",
            json={
                "tenant_id": agent.tenant_config["id"],
                "call_sid": context.session.room_io.room.name if context.session else "",
                "caller_phone": agent.caller_phone,
                "escalation_phone": agent.tenant_config.get("escalation_phone", ""),
                "args": args,
            },
        )
        resp.raise_for_status()
        data = resp.json()
        result = data.get("result", {})
        return result.get("message", str(result))
    except Exception as e:
        logger.error("Tool %s error: %s", action, e)
        return "I encountered an error. Let me try again."


def _get_sip_participant(room: rtc.Room) -> rtc.RemoteParticipant | None:
    """Find the SIP participant in the room (the caller, not the agent)."""
    for p in room.remote_participants.values():
        if p.kind == rtc.ParticipantKind.PARTICIPANT_KIND_SIP:
            return p
    return None


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

    # Attempt SIP REFER transfer to the escalation phone
    agent = context.session.current_agent
    escalation_phone = agent.tenant_config.get("escalation_phone", "")

    if escalation_phone:
        sip_participant = _get_sip_participant(context.session.room_io.room)
        if sip_participant:
            try:
                # SIP REFER: transfer the caller to the escalation number
                sip_uri = f"sip:{escalation_phone}@sip.signalwire.com"
                await sip_participant.transfer_sip_call(sip_uri)
                logger.info("SIP transfer initiated to %s", escalation_phone)
                return "Transferring you now. Please hold."
            except Exception as e:
                logger.error("SIP transfer failed: %s", e)
                return f"{result} I was unable to transfer you directly. Someone will call you back shortly."
        else:
            logger.warning("No SIP participant found for transfer")
            return f"{result} Someone will call you back shortly."
    else:
        return f"{result} Someone will call you back shortly."


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
    # Log the end reason via the API (best-effort, don't block hangup)
    try:
        await _call_tool(context, "end_call", {"reason": reason})
    except Exception:
        pass

    # Grace period: let final TTS audio finish playing before disconnecting
    await asyncio.sleep(2.0)

    # Disconnect the session so the SIP call hangs up
    context.session.shutdown()
    return "Call ended."
