import logging
from dotenv import load_dotenv

from livekit import rtc
from livekit.agents import (
    Agent,
    AgentServer,
    AgentSession,
    JobContext,
    JobProcess,
    RunContext,
    cli,
    metrics,
    room_io,
)
from livekit.agents.llm import function_tool
from livekit.plugins import deepgram, cartesia, openai, silero, noise_cancellation
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

    def __init__(self, tenant_config: dict, caller_phone: str) -> None:
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
    # Wait for the SIP participant and extract phone info
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

    # Configure the voice pipeline with explicit plugin instances (self-hosted, BYOK)
    session = AgentSession(
        stt=deepgram.STT(model="nova-3", language="multi"),
        llm=openai.LLM(model="gpt-4.1-mini"),
        tts=cartesia.TTS(
            model="sonic-3",
            voice=tenant_config["voice_config"]["voice_id"],
        ),
        vad=ctx.proc.userdata["vad"],
        turn_detection=MultilingualModel(),
        # Production tuning
        preemptive_generation=True,
        resume_false_interruption=True,
        false_interruption_timeout=1.0,
        aec_warmup_duration=3.0,
        min_endpointing_delay=0.5,
        max_endpointing_delay=3.0,
    )

    # Metrics collection for observability
    usage_collector = metrics.UsageCollector()

    @session.on("metrics_collected")
    def _on_metrics_collected(ev):
        metrics.log_metrics(ev.metrics)
        usage_collector.collect(ev.metrics)

    async def on_shutdown():
        summary = usage_collector.get_summary()
        logger.info("Call usage: %s", summary)

        # Log the call to lumentra-api
        await log_call(
            tenant_id=tenant_config["id"],
            call_sid=ctx.room.name,
            caller_phone=caller_phone,
            session=session,
        )

    ctx.add_shutdown_callback(on_shutdown)

    # Start the agent session
    await session.start(
        agent=LumentraAgent(tenant_config, caller_phone),
        room=ctx.room,
        room_options=room_io.RoomOptions(
            audio_input=room_io.AudioInputOptions(
                noise_cancellation=noise_cancellation.BVCTelephony(),
            ),
        ),
    )
    # Greeting is handled by LumentraAgent.on_enter()


if __name__ == "__main__":
    cli.run_app(server)
