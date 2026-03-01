import asyncio
import logging
import os
from datetime import datetime, timezone

from dotenv import load_dotenv

from livekit import rtc
from livekit.agents import (
    Agent,
    AgentServer,
    AgentSession,
    JobContext,
    JobProcess,
    cli,
    metrics,
)
from livekit.agents.llm import function_tool
from livekit.plugins import deepgram, cartesia, openai, silero
from livekit.plugins.turn_detector.multilingual import MultilingualModel

from tools import (
    check_availability,
    create_booking,
    create_order,
    transfer_to_human,
    end_call,
)
from tenant_config import get_tenant_by_phone
from call_logger import log_call

load_dotenv()
logger = logging.getLogger("lumentra-agent")


class LumentraAgent(Agent):
    """Voice agent that handles inbound calls for Lumentra tenants."""

    def __init__(self, tenant_config: dict, caller_phone: str, job_ctx: JobContext) -> None:
        super().__init__(
            instructions=tenant_config["system_prompt"],
            tools=[
                check_availability,
                create_booking,
                create_order,
                transfer_to_human,
                end_call,
            ],
        )
        self.tenant_config = tenant_config
        self.caller_phone = caller_phone
        self.job_ctx = job_ctx

    async def on_enter(self):
        self.session.generate_reply(
            instructions=f"Greet the caller: {self.tenant_config['greeting_standard']}"
        )


server = AgentServer()


def prewarm(proc: JobProcess):
    """Prewarm VAD model during process startup for lower first-call latency."""
    proc.userdata["vad"] = silero.VAD.load()


server.setup_fnc = prewarm


@server.rtc_session(agent_name="lumentra-voice-agent")
async def entrypoint(ctx: JobContext):
    """Entrypoint for each inbound SIP call.

    Flow:
    1. Wait for the SIP participant to join the room
    2. Extract the dialed number and caller phone from SIP attributes
    3. Fetch tenant config (including system prompt) from lumentra-api
    4. Start the agent session with STT/LLM/TTS
    5. Agent greets the caller via on_enter()
    """
    # Connect to the room first, then wait for the SIP participant
    await ctx.connect()
    participant = await ctx.wait_for_participant()
    dialed_number = participant.attributes.get("sip.trunkPhoneNumber", "")
    caller_phone = participant.attributes.get("sip.phoneNumber", "")

    logger.info(
        "Call started: dialed=%s caller=%s room=%s",
        dialed_number,
        caller_phone,
        ctx.room.name,
    )

    # Fetch tenant config from lumentra-api internal endpoint
    tenant_config = await get_tenant_by_phone(dialed_number)
    if not tenant_config:
        logger.error("No tenant found for number: %s", dialed_number)
        return

    # Configure LLM: gpt-4.1-mini (best balance of quality, speed, tool calling)
    llm = openai.LLM(
        model="gpt-4.1-mini",
        temperature=0.8,
    )
    logger.info("Using OpenAI gpt-4.1-mini")

    # Configure the voice pipeline with explicit plugin instances (self-hosted, BYOK)
    session = AgentSession(
        stt=deepgram.STT(
            model="nova-3",
            language="multi",
            smart_format=True,
            keyterm=[tenant_config["business_name"]],
        ),
        llm=llm,
        tts=cartesia.TTS(
            model="sonic-3",
            voice=tenant_config["voice_config"]["voice_id"],
            speed=0.95,
            emotion=["Content"],
        ),
        vad=ctx.proc.userdata["vad"],
        turn_detection=MultilingualModel(),
        # Production tuning -- patient turn-taking for natural conversation
        preemptive_generation=True,
        resume_false_interruption=True,
        false_interruption_timeout=1.5,
        min_endpointing_delay=0.7,
        max_endpointing_delay=3.0,
    )

    # Track call start time for accurate duration
    call_started_at = datetime.now(timezone.utc)

    # Metrics collection for observability
    usage_collector = metrics.UsageCollector()

    @session.on("metrics_collected")
    def _on_metrics_collected(ev):
        metrics.log_metrics(ev.metrics)
        usage_collector.collect(ev.metrics)

    async def on_shutdown():
        summary = usage_collector.get_summary()
        logger.info("Call usage: %s", summary)

        # Fire-and-forget: log the call without blocking session teardown
        try:
            await asyncio.wait_for(
                log_call(
                    tenant_id=tenant_config["id"],
                    call_sid=ctx.room.name,
                    caller_phone=caller_phone,
                    session=session,
                    started_at=call_started_at,
                ),
                timeout=5.0,
            )
        except asyncio.TimeoutError:
            logger.warning("Call logging timed out for %s", ctx.room.name)
        except Exception as e:
            logger.error("Call logging failed for %s: %s", ctx.room.name, e)

    ctx.add_shutdown_callback(on_shutdown)

    # Start the agent session
    await session.start(
        agent=LumentraAgent(tenant_config, caller_phone, ctx),
        room=ctx.room,
    )
    # Greeting is handled by LumentraAgent.on_enter()


if __name__ == "__main__":
    cli.run_app(server)
