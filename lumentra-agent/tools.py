import asyncio
import json
import logging

from livekit import rtc
from livekit.agents import RunContext
from livekit.agents.llm import function_tool

from api_client import get_client

logger = logging.getLogger("lumentra-agent.tools")


async def _call_tool(context: RunContext, action: str, args: dict) -> str:
    """Call a tool via the lumentra-api internal endpoint. Returns the message string."""
    agent = context.session.current_agent
    client = get_client()

    logger.info("Tool called: %s with args: %s", action, args)

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
        message = result.get("message", str(result))
        logger.info("Tool %s result: %s", action, message[:200])
        return message
    except Exception as e:
        logger.error("Tool %s error: %s", action, e)
        return "I encountered an error. Let me try again."


async def _call_tool_raw(context: RunContext, action: str, args: dict) -> dict:
    """Call a tool via the API and return the full result dict."""
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
        return data.get("result", {})
    except Exception as e:
        logger.error("Tool %s raw error: %s", action, e)
        return {}


def _get_sip_participant(room: rtc.Room) -> rtc.RemoteParticipant | None:
    """Find the SIP participant in the room (the caller, not the agent)."""
    for p in room.remote_participants.values():
        if p.kind == rtc.ParticipantKind.PARTICIPANT_KIND_SIP:
            return p
    return None


async def _attempt_transfer(room: rtc.Room, phone: str) -> bool:
    """Attempt SIP REFER to a single phone number. Returns True on success."""
    sip_participant = _get_sip_participant(room)
    if not sip_participant:
        logger.warning("No SIP participant found for transfer")
        return False

    sip_uri = f"sip:{phone}@sip.signalwire.com"
    try:
        await asyncio.wait_for(
            sip_participant.transfer_sip_call(sip_uri),
            timeout=35.0,
        )
        logger.info("SIP transfer succeeded to %s", phone)
        return True
    except asyncio.TimeoutError:
        logger.warning("SIP transfer to %s timed out (35s)", phone)
        return False
    except Exception as e:
        logger.error("SIP transfer to %s failed: %s", phone, e)
        return False


async def _attempt_transfers(room: rtc.Room, phones: list[str]) -> bool:
    """Try SIP REFER to each phone in order. Returns True on first success."""
    for i, phone in enumerate(phones):
        logger.info("Transfer attempt %d/%d to %s", i + 1, len(phones), phone)
        if await _attempt_transfer(room, phone):
            return True
    return False


async def _warm_transfer_sequence(
    context: RunContext,
    contact_phones: list[str],
    no_answer: str,
    queue_id: str,
) -> None:
    """Background task for warm transfer: hold music -> transfer -> fallback.

    Runs after the agent speaks the hold message. Pauses the agent,
    plays hold music, attempts transfer, handles failure.
    """
    session = context.session
    agent = context.session.current_agent
    room = session.room_io.room

    try:
        # Wait for agent to finish speaking the hold message
        await asyncio.sleep(4.0)

        # Pause agent: stop listening and responding
        session.input.set_audio_enabled(False)
        session.output.set_audio_enabled(False)

        # Play hold music if player is available
        hold_handle = None
        if agent.hold_player:
            try:
                from livekit.agents.voice import AudioConfig, BuiltinAudioClip
                hold_handle = agent.hold_player.play(
                    AudioConfig(BuiltinAudioClip.HOLD_MUSIC, volume=0.5),
                    loop=True,
                )
            except Exception as e:
                logger.warning("Hold music failed to start: %s", e)

        # Update transfer status to initiated
        try:
            client = get_client()
            await client.post(
                "/internal/voice-tools/update_transfer_status",
                json={
                    "tenant_id": agent.tenant_config["id"],
                    "args": {"queue_id": queue_id, "status": "initiated"},
                },
            )
        except Exception:
            pass  # Non-critical

        # Attempt transfer to each contact in order
        success = await _attempt_transfers(room, contact_phones)

        # Stop hold music
        if hold_handle:
            try:
                hold_handle.stop()
            except Exception:
                pass

        if success:
            # Transfer succeeded -- update status
            try:
                await client.post(
                    "/internal/voice-tools/update_transfer_status",
                    json={
                        "tenant_id": agent.tenant_config["id"],
                        "args": {"queue_id": queue_id, "status": "completed"},
                    },
                )
            except Exception:
                pass
            return

        # Transfer failed -- update status
        try:
            await client.post(
                "/internal/voice-tools/update_transfer_status",
                json={
                    "tenant_id": agent.tenant_config["id"],
                    "args": {"queue_id": queue_id, "status": "failed"},
                },
            )
        except Exception:
            pass

        # Resume agent
        session.input.set_audio_enabled(True)
        session.output.set_audio_enabled(True)

        # Handle no-answer behavior
        if no_answer == "message":
            session.generate_reply(
                instructions=(
                    "The transfer was unsuccessful -- nobody was available to take the call. "
                    "Apologize to the caller and offer to take a message so someone can call them back. "
                    "Ask for their name and what they'd like to pass along, then use the queue_callback tool."
                )
            )
        elif no_answer == "retry":
            session.generate_reply(
                instructions=(
                    "The transfer was unsuccessful -- nobody was available. "
                    "Apologize and suggest the caller try calling back during business hours. "
                    "Offer to take a message as an alternative."
                )
            )
        else:
            session.generate_reply(
                instructions=(
                    "The transfer was unsuccessful. Apologize to the caller "
                    "and ask if there's something else you can help with."
                )
            )

    except asyncio.CancelledError:
        logger.debug("Warm transfer sequence cancelled")
    except Exception as e:
        logger.error("Warm transfer sequence error: %s", e)
        # Best effort: resume agent
        try:
            session.input.set_audio_enabled(True)
            session.output.set_audio_enabled(True)
            session.generate_reply(
                instructions="Something went wrong with the transfer. Apologize and offer to help another way."
            )
        except Exception:
            pass


async def _cold_transfer_sequence(
    context: RunContext,
    contact_phones: list[str],
    no_answer: str,
    queue_id: str,
) -> None:
    """Background task for cold transfer: brief pause then SIP REFER."""
    session = context.session
    agent = context.session.current_agent
    room = session.room_io.room

    try:
        # Brief wait for "Transferring you now" TTS to play
        await asyncio.sleep(2.0)

        success = await _attempt_transfers(room, contact_phones)

        if success:
            try:
                client = get_client()
                await client.post(
                    "/internal/voice-tools/update_transfer_status",
                    json={
                        "tenant_id": agent.tenant_config["id"],
                        "args": {"queue_id": queue_id, "status": "completed"},
                    },
                )
            except Exception:
                pass
            return

        # Cold transfer failed -- caller is still in room
        try:
            client = get_client()
            await client.post(
                "/internal/voice-tools/update_transfer_status",
                json={
                    "tenant_id": agent.tenant_config["id"],
                    "args": {"queue_id": queue_id, "status": "failed"},
                },
            )
        except Exception:
            pass

        if no_answer == "message":
            session.generate_reply(
                instructions=(
                    "The transfer didn't go through -- nobody picked up. "
                    "Apologize and offer to take a message. Use queue_callback to save it."
                )
            )
        elif no_answer == "retry":
            session.generate_reply(
                instructions=(
                    "The transfer didn't go through. "
                    "Suggest the caller try again later during business hours."
                )
            )
        else:
            session.generate_reply(
                instructions="The transfer didn't go through. Apologize and offer to help another way."
            )

    except asyncio.CancelledError:
        logger.debug("Cold transfer sequence cancelled")
    except Exception as e:
        logger.error("Cold transfer sequence error: %s", e)


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
    """Transfer to human staff. Use when the caller explicitly asks for a human,
    real person, manager, or when you cannot resolve their issue.

    The system will handle hold music, contact selection, and transfer automatically
    based on the business's configured transfer behavior (warm/cold/callback).

    Args:
        reason: One of: customer_request, complaint, refund_request, cannot_resolve,
                billing_issue, cancellation, special_request, persistent_request.
    """
    agent = context.session.current_agent
    room = context.session.room_io.room

    # Step 1: Call prepare_transfer API -- selects available contacts,
    # creates queue entry, determines effective transfer type
    result = await _call_tool_raw(context, "prepare_transfer", {"reason": reason})

    transfer_type = result.get("transfer_type_effective", "callback")
    contacts = result.get("contacts", [])
    no_answer = result.get("no_answer_behavior", "message")
    queue_id = result.get("queue_id", "")

    # Step 2: Route by transfer type

    # CALLBACK: no transfer attempt, take a message
    if transfer_type == "callback" or not contacts:
        logger.info("Transfer routed to callback mode (type=%s, contacts=%d)", transfer_type, len(contacts))
        return (
            "I'd be happy to have someone call you back. "
            "Can I get your name and a brief message to pass along?"
        )

    contact_name = contacts[0].get("name", "a team member")
    contact_phones = [c["phone"] for c in contacts]

    # COLD: immediate transfer with failure detection
    if transfer_type == "cold":
        logger.info("Initiating cold transfer to %d contact(s)", len(contacts))
        asyncio.create_task(
            _cold_transfer_sequence(context, contact_phones, no_answer, queue_id)
        )
        return f"Transferring you to {contact_name} now."

    # WARM: hold message -> hold music -> transfer -> fallback
    logger.info("Initiating warm transfer to %d contact(s)", len(contacts))
    asyncio.create_task(
        _warm_transfer_sequence(context, contact_phones, no_answer, queue_id)
    )
    return f"Let me connect you with {contact_name}. Please hold for just a moment."


@function_tool()
async def queue_callback(
    context: RunContext,
    message: str,
    caller_name: str = "",
    preferred_time: str = "",
) -> str:
    """Save a callback request when a transfer is not possible or the caller
    prefers a callback. Use after the caller provides their message.

    Args:
        message: The caller's message or reason for callback.
        caller_name: The caller's name if provided.
        preferred_time: When they'd like to be called back, if specified.
    """
    return await _call_tool(context, "queue_callback", {
        "message": message,
        "caller_name": caller_name,
        "preferred_time": preferred_time,
    })


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
    await asyncio.sleep(1.0)

    # Terminate the call by deleting the LiveKit room.
    agent = context.session.current_agent
    try:
        await agent.job_ctx.delete_room()
        logger.info("Room deleted, call ended: %s", reason)
    except Exception as e:
        logger.error("Failed to delete room: %s, falling back to shutdown", e)
        context.session.shutdown()

    return "Call ended."


@function_tool()
async def log_note(
    context: RunContext,
    note: str,
    note_type: str = "general",
) -> str:
    """Save an important note about the caller. Use this to record customer
    preferences, complaints, special requests, or any details worth remembering
    for future calls. Do NOT log routine conversation - only notable information.

    Args:
        note: The note content to save about this caller.
        note_type: One of: general, preference, complaint, compliment, follow_up, internal.
    """
    return await _call_tool(context, "log_note", {
        "note": note,
        "note_type": note_type,
    })
