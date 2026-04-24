import asyncio
import logging
import os

from livekit import rtc
from livekit.agents import RunContext
from livekit.agents.llm import function_tool

from api_client import get_client

logger = logging.getLogger("lumentra-agent.tools")

# LiveKit API for SIP transfers and outbound SIP (consultation transfer)
try:
    from livekit import api as lkapi
    from livekit.protocol.sip import CreateSIPParticipantRequest, TransferSIPParticipantRequest
    from livekit.protocol.room import RoomParticipantIdentity
except ImportError:
    lkapi = None
    CreateSIPParticipantRequest = None  # type: ignore[assignment,misc]
    TransferSIPParticipantRequest = None  # type: ignore[assignment,misc]
    RoomParticipantIdentity = None  # type: ignore[assignment,misc]
    logger.warning("livekit.api not available -- SIP transfers will fall back to callback")

# Hold music imports (path changed in livekit-agents 1.4.5)
try:
    from livekit.agents.voice.background_audio import AudioConfig, BuiltinAudioClip
except ImportError:
    AudioConfig = None  # type: ignore[assignment,misc]
    BuiltinAudioClip = None  # type: ignore[assignment,misc]
    logger.warning("AudioConfig/BuiltinAudioClip not available -- hold music disabled")


def _say_filler(context: RunContext, text: str):
    """Play a short filler phrase while a tool runs. Returns a SpeechHandle
    we can interrupt once the tool completes, or None if session.say() is
    unavailable or fails. `add_to_chat_ctx=False` keeps the filler out of
    LLM memory so the next turn doesn't repeat it."""
    try:
        return context.session.say(text, add_to_chat_ctx=False)
    except Exception as e:
        logger.debug("pre-tool filler skipped: %s", e)
        return None


def _stop_filler(handle):
    """Interrupt a filler SpeechHandle if it's still playing."""
    if handle is None:
        return
    try:
        if not getattr(handle, "interrupted", False) and not handle.done():
            handle.interrupt()
    except Exception as e:
        logger.debug("pre-tool filler interrupt skipped: %s", e)


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
    """Attempt SIP transfer to a phone number via server-side API. Returns True on success."""
    if not lkapi or not TransferSIPParticipantRequest:
        logger.error("livekit.api not available for SIP transfer")
        return False

    sip_participant = _get_sip_participant(room)
    if not sip_participant:
        logger.warning("No SIP participant found for transfer")
        return False

    lk = lkapi.LiveKitAPI()
    try:
        transfer_req = TransferSIPParticipantRequest(
            participant_identity=sip_participant.identity,
            room_name=room.name,
            transfer_to=f"tel:{phone}",
            play_dialtone=True,
        )
        await asyncio.wait_for(
            lk.sip.transfer_sip_participant(transfer_req),
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
    finally:
        await lk.aclose()


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
        if agent.hold_player and AudioConfig and BuiltinAudioClip:
            try:
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

        # Handle no-answer: let caller know staff is unavailable, offer to help
        session.generate_reply(
            instructions=(
                "The transfer was unsuccessful -- no one is available to take the call right now. "
                "Tell the caller something like: 'It looks like everyone is busy at the moment, "
                "but I'm here to help! What can I assist you with?' "
                "Be warm and helpful. Continue the conversation and assist them yourself."
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


async def _wait_for_dtmf(
    room: rtc.Room,
    target_identity: str,
    timeout: float = 15.0,
) -> str | None:
    """Wait for a DTMF digit from a specific SIP participant.

    Returns the digit string ('1', '2', etc.) or None on timeout.
    """
    loop = asyncio.get_running_loop()
    future: asyncio.Future[str] = loop.create_future()

    def on_dtmf(dtmf):
        if future.done():
            return
        # dtmf.participant is the RemoteParticipant who sent the DTMF
        participant = getattr(dtmf, "participant", None)
        p_identity = getattr(participant, "identity", "") if participant else ""
        digit = getattr(dtmf, "digit", "") or str(getattr(dtmf, "code", ""))
        if p_identity == target_identity and digit:
            future.set_result(digit)

    room.on("sip_dtmf_received", on_dtmf)
    try:
        return await asyncio.wait_for(future, timeout=timeout)
    except asyncio.TimeoutError:
        return None
    finally:
        try:
            room.off("sip_dtmf_received", on_dtmf)
        except Exception:
            pass


async def _consultation_transfer_sequence(
    context: RunContext,
    contacts: list[dict],
    no_answer: str,
    queue_id: str,
    reason: str,
) -> None:
    """Background task for consultation transfer.

    Dials each contact via outbound SIP, plays a TTS briefing,
    waits for DTMF accept/decline, then connects or falls back.
    Falls back to warm transfer if outbound SIP trunk is not configured.
    """
    session = context.session
    agent = context.session.current_agent
    room = session.room_io.room

    trunk_id = os.getenv("LK_SIP_OUTBOUND_TRUNK_ID", "")

    # Graceful degradation: no outbound trunk -> fall back to warm (SIP REFER)
    if not trunk_id or lkapi is None:
        logger.warning("No outbound SIP trunk configured, falling back to warm transfer")
        contact_phones = [c["phone"] for c in contacts]
        await _warm_transfer_sequence(context, contact_phones, no_answer, queue_id)
        return

    try:
        # Wait for agent to finish speaking the hold message
        await asyncio.sleep(4.0)

        # Pause agent: stop listening and responding
        session.input.set_audio_enabled(False)
        session.output.set_audio_enabled(False)

        # Play hold music
        hold_handle = None
        if agent.hold_player and AudioConfig and BuiltinAudioClip:
            try:
                hold_handle = agent.hold_player.play(
                    AudioConfig(BuiltinAudioClip.HOLD_MUSIC, volume=0.5),
                    loop=True,
                )
            except Exception as e:
                logger.warning("Hold music failed to start: %s", e)

        # Update transfer status to initiated
        client = get_client()
        try:
            await client.post(
                "/internal/voice-tools/update_transfer_status",
                json={
                    "tenant_id": agent.tenant_config["id"],
                    "args": {"queue_id": queue_id, "status": "initiated"},
                },
            )
        except Exception:
            pass

        lk = lkapi.LiveKitAPI()
        accepted = False
        business_name = agent.tenant_config.get("business_name", "our team")

        try:
            for i, contact in enumerate(contacts):
                phone = contact["phone"]
                name = contact.get("name", "team member")
                contact_id = contact.get("id", "unknown")
                supervisor_identity = f"supervisor-{contact_id[:8]}"

                logger.info(
                    "Consultation attempt %d/%d: dialing %s (%s)",
                    i + 1, len(contacts), name, phone,
                )

                # Dial supervisor via outbound SIP trunk
                try:
                    await asyncio.wait_for(
                        lk.sip.create_sip_participant(
                            CreateSIPParticipantRequest(
                                sip_trunk_id=trunk_id,
                                sip_call_to=phone,
                                room_name=room.name,
                                participant_identity=supervisor_identity,
                                participant_name=name,
                            )
                        ),
                        timeout=35.0,
                    )
                    logger.info("Supervisor %s answered", name)
                except (asyncio.TimeoutError, Exception) as e:
                    logger.warning("Supervisor %s did not answer: %s", name, e)
                    continue

                # Supervisor is in the room -- stop hold music, brief them
                if hold_handle:
                    try:
                        hold_handle.stop()
                        hold_handle = None
                    except Exception:
                        pass

                # Re-enable output for TTS briefing (keep input disabled)
                session.output.set_audio_enabled(True)

                briefing = (
                    f"Hi {name}, this is the {business_name} assistant. "
                    f"I have a caller on the line regarding {reason}. "
                    f"Press 1 to accept the call, or 2 to decline."
                )

                try:
                    handle = session.say(briefing, allow_interruptions=False)
                    await handle
                except Exception as e:
                    logger.error("TTS briefing failed: %s", e)
                    try:
                        await lk.room.remove_participant(
                            RoomParticipantIdentity(
                                room=room.name,
                                identity=supervisor_identity,
                            )
                        )
                    except Exception:
                        pass
                    session.output.set_audio_enabled(False)
                    continue

                # Wait for DTMF response
                digit = await _wait_for_dtmf(room, supervisor_identity, timeout=15.0)

                if digit == "1":
                    # Supervisor accepted
                    logger.info("Supervisor %s accepted the transfer", name)
                    try:
                        handle = session.say("Connecting you now.", allow_interruptions=False)
                        await handle
                    except Exception:
                        pass

                    # Agent goes silent -- caller and supervisor talk directly
                    session.output.set_audio_enabled(False)
                    session.input.set_audio_enabled(False)

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

                    accepted = True
                    break
                else:
                    # Declined or timed out
                    logger.info(
                        "Supervisor %s declined or timed out (digit=%s)", name, digit
                    )

                    # Brief acknowledgment if they pressed 2
                    if digit == "2":
                        try:
                            handle = session.say("No problem, thanks.", allow_interruptions=False)
                            await handle
                        except Exception:
                            pass

                    # Remove supervisor from room
                    try:
                        await lk.room.remove_participant(
                            RoomParticipantIdentity(
                                room=room.name,
                                identity=supervisor_identity,
                            )
                        )
                    except Exception as e:
                        logger.warning("Failed to remove supervisor: %s", e)

                    # Disable output, restart hold music for next attempt
                    session.output.set_audio_enabled(False)
                    if agent.hold_player and AudioConfig and BuiltinAudioClip and i < len(contacts) - 1:
                        try:
                            hold_handle = agent.hold_player.play(
                                AudioConfig(BuiltinAudioClip.HOLD_MUSIC, volume=0.5),
                                loop=True,
                            )
                        except Exception:
                            pass
        finally:
            await lk.aclose()

        if accepted:
            return

        # All contacts declined or failed
        if hold_handle:
            try:
                hold_handle.stop()
            except Exception:
                pass

        # Update status
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

        # Resume agent with fallback speech
        session.input.set_audio_enabled(True)
        session.output.set_audio_enabled(True)

        session.generate_reply(
            instructions=(
                "The transfer was unsuccessful -- no one is available to take the call right now. "
                "Tell the caller something like: 'It looks like everyone is busy at the moment, "
                "but I'm here to help! What can I assist you with?' "
                "Be warm and helpful. Continue the conversation and assist them yourself."
            )
        )

    except asyncio.CancelledError:
        logger.debug("Consultation transfer sequence cancelled")
    except Exception as e:
        logger.error("Consultation transfer sequence error: %s", e)
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
    hold = _say_filler(context, "One moment, let me check that.")
    try:
        return await _call_tool(context, "check_availability", {
            "date": date,
            "service_type": service_type,
        })
    finally:
        _stop_filler(hold)


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
    hold = _say_filler(context, "Okay, booking that now.")
    try:
        return await _call_tool(context, "create_booking", {
            "customer_name": customer_name,
            "customer_phone": customer_phone,
            "date": date,
            "time": time,
            "service_type": service_type,
            "notes": notes,
        })
    finally:
        _stop_filler(hold)


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
    hold = _say_filler(context, "Got it, placing the order now.")
    try:
        return await _call_tool(context, "create_order", {
            "customer_name": customer_name,
            "customer_phone": customer_phone,
            "order_type": order_type,
            "items": items,
            "delivery_address": delivery_address,
            "special_instructions": special_instructions,
        })
    finally:
        _stop_filler(hold)


@function_tool()
async def transfer_to_human(
    context: RunContext,
    reason: str,
    target_role: str = "",
) -> str:
    """Transfer to human staff or a specific department. Use when the caller
    explicitly asks for a human, a specific department, or when you cannot
    resolve their issue.

    The system will handle hold music, contact selection, and transfer automatically
    based on the business's configured transfer behavior (warm/cold/callback).

    If the caller asks for a specific department or person (e.g. "housekeeping",
    "room service", "front desk", "Dr. Smith"), pass that as target_role so the
    system routes to the right contact.

    Args:
        reason: One of: customer_request, complaint, refund_request, cannot_resolve,
                billing_issue, cancellation, special_request, persistent_request,
                department_transfer.
        target_role: Optional department or person name to transfer to (e.g.
                     "housekeeping", "room service", "front desk", "maintenance",
                     "billing", "manager"). Leave empty for general escalation.
    """
    agent = context.session.current_agent
    room = context.session.room_io.room

    # Filler so the caller isn't met with dead air while we resolve contacts
    # and prep the SIP leg. Interrupted below before we return to the LLM.
    hold = _say_filler(context, "One moment, let me connect you.")

    # Step 1: Call prepare_transfer API -- selects available contacts,
    # creates queue entry, determines effective transfer type
    prepare_args = {"reason": reason}
    if target_role:
        prepare_args["target_contact"] = target_role
    try:
        result = await _call_tool_raw(context, "prepare_transfer", prepare_args)
    finally:
        _stop_filler(hold)

    transfer_type = result.get("transfer_type_effective", "callback")
    contacts = result.get("contacts", [])
    no_answer = result.get("no_answer_behavior", "message")
    queue_id = result.get("queue_id", "")

    # Step 2: Route by transfer type

    # CALLBACK: no transfer attempt, take a message
    if transfer_type == "callback" or not contacts:
        logger.info("Transfer routed to callback mode (type=%s, contacts=%d)", transfer_type, len(contacts))
        return (
            "No one's available right now, but I can take a message and "
            "have someone call you back. What's your name and message?"
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

    # CONSULTATION: dial supervisor, brief, DTMF accept/decline
    if transfer_type == "consultation":
        logger.info("Initiating consultation transfer to %d contact(s)", len(contacts))
        asyncio.create_task(
            _consultation_transfer_sequence(context, contacts, no_answer, queue_id, reason)
        )
        return f"Let me connect you with {contact_name}. Please hold while I brief them."

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
    hold = _say_filler(context, "Got it, saving that for you.")
    try:
        return await _call_tool(context, "queue_callback", {
            "message": message,
            "caller_name": caller_name,
            "preferred_time": preferred_time,
        })
    finally:
        _stop_filler(hold)


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
