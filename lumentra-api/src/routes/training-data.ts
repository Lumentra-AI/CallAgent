import { Hono } from "hono";
import { getSupabase } from "../services/database/client";

const app = new Hono();

// Types for export formats
interface ShareGPTMessage {
  from: "system" | "human" | "gpt";
  value: string;
}

interface ShareGPTConversation {
  conversations: ShareGPTMessage[];
}

interface AlpacaEntry {
  instruction: string;
  input: string;
  output: string;
}

interface OpenAIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OpenAIEntry {
  messages: OpenAIMessage[];
}

interface ConversationLog {
  id: string;
  tenant_id: string;
  call_id: string | null;
  session_id: string;
  industry: string | null;
  scenario_type: string | null;
  language: string;
  messages: Array<{
    role: string;
    content: string;
    tool_name?: string;
    tool_result?: unknown;
  }>;
  quality_score: number | null;
  is_complete: boolean;
  has_tool_calls: boolean;
  has_escalation: boolean;
  outcome_success: boolean | null;
  turn_count: number;
  user_turns: number;
  assistant_turns: number;
  tool_calls_count: number;
  total_tokens_estimate: number | null;
  duration_seconds: number | null;
  reviewed: boolean;
  flagged: boolean;
  flag_reason: string | null;
  tags: string[];
  notes: string | null;
  exported_at: string | null;
  export_format: string | null;
  created_at: string;
  updated_at: string;
}

// List conversation logs with filtering
app.get("/:tenantId", async (c) => {
  const tenantId = c.req.param("tenantId");
  const {
    scenario,
    minQuality,
    reviewed,
    flagged,
    hasTools,
    limit = "50",
    offset = "0",
  } = c.req.query();

  const supabase = getSupabase();
  let query = supabase
    .from("conversation_logs")
    .select("*", { count: "exact" })
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (scenario) query = query.eq("scenario_type", scenario);
  if (minQuality) query = query.gte("quality_score", parseFloat(minQuality));
  if (reviewed !== undefined) query = query.eq("reviewed", reviewed === "true");
  if (flagged !== undefined) query = query.eq("flagged", flagged === "true");
  if (hasTools !== undefined)
    query = query.eq("has_tool_calls", hasTools === "true");

  query = query.range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

  const { data, error, count } = await query;

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json({
    data,
    pagination: {
      total: count,
      limit: parseInt(limit),
      offset: parseInt(offset),
    },
  });
});

// Get single conversation log
app.get("/:tenantId/:id", async (c) => {
  const tenantId = c.req.param("tenantId");
  const id = c.req.param("id");

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("conversation_logs")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .single();

  if (error) {
    return c.json({ error: error.message }, 404);
  }

  return c.json(data);
});

// Update conversation log (for review/flagging)
app.patch("/:tenantId/:id", async (c) => {
  const tenantId = c.req.param("tenantId");
  const id = c.req.param("id");
  const body = await c.req.json();

  const allowedFields = [
    "reviewed",
    "flagged",
    "flag_reason",
    "tags",
    "notes",
    "quality_score",
    "scenario_type",
  ];
  const updateData: Record<string, unknown> = {};

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updateData[field] = body[field];
    }
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("conversation_logs")
    .update(updateData)
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json(data);
});

// Bulk review
app.post("/:tenantId/bulk-review", async (c) => {
  const tenantId = c.req.param("tenantId");
  const { ids, reviewed, flagged, tags } = await c.req.json();

  const updateData: Record<string, unknown> = {};
  if (reviewed !== undefined) updateData.reviewed = reviewed;
  if (flagged !== undefined) updateData.flagged = flagged;
  if (tags !== undefined) updateData.tags = tags;

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("conversation_logs")
    .update(updateData)
    .eq("tenant_id", tenantId)
    .in("id", ids)
    .select("id");

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json({ updated: data?.length || 0 });
});

// Export training data in various formats
app.get("/:tenantId/export/:format", async (c) => {
  const tenantId = c.req.param("tenantId");
  const format = c.req.param("format") as
    | "jsonl"
    | "sharegpt"
    | "alpaca"
    | "openai";
  const {
    minQuality = "0.7",
    scenario,
    hasTools,
    limit = "1000",
  } = c.req.query();

  const supabase = getSupabase();

  // Build query for export-ready data
  let query = supabase
    .from("conversation_logs")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("reviewed", true)
    .eq("flagged", false)
    .eq("is_complete", true)
    .gte("quality_score", parseFloat(minQuality))
    .order("quality_score", { ascending: false })
    .limit(parseInt(limit));

  if (scenario) query = query.eq("scenario_type", scenario);
  if (hasTools !== undefined)
    query = query.eq("has_tool_calls", hasTools === "true");

  const { data, error } = await query;

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  if (!data || data.length === 0) {
    return c.json({ error: "No training data found matching criteria" }, 404);
  }

  const conversations = data as ConversationLog[];

  // Mark as exported
  const ids = conversations.map((d: ConversationLog) => d.id);
  await supabase
    .from("conversation_logs")
    .update({ exported_at: new Date().toISOString(), export_format: format })
    .in("id", ids);

  // Convert based on format
  let output: string;
  let contentType: string;
  let filename: string;

  switch (format) {
    case "jsonl":
      output = conversations
        .map((conv: ConversationLog) =>
          JSON.stringify(convertToOpenAI(conv.messages)),
        )
        .join("\n");
      contentType = "application/jsonl";
      filename = `training_data_${tenantId}_${Date.now()}.jsonl`;
      break;

    case "sharegpt":
      output = JSON.stringify(
        conversations.map((conv: ConversationLog) =>
          convertToShareGPT(conv.messages),
        ),
        null,
        2,
      );
      contentType = "application/json";
      filename = `training_data_sharegpt_${tenantId}_${Date.now()}.json`;
      break;

    case "alpaca":
      const alpacaEntries: AlpacaEntry[] = [];
      for (const conv of conversations) {
        alpacaEntries.push(...convertToAlpaca(conv.messages));
      }
      output = JSON.stringify(alpacaEntries, null, 2);
      contentType = "application/json";
      filename = `training_data_alpaca_${tenantId}_${Date.now()}.json`;
      break;

    case "openai":
    default:
      output = JSON.stringify(
        conversations.map((conv: ConversationLog) =>
          convertToOpenAI(conv.messages),
        ),
        null,
        2,
      );
      contentType = "application/json";
      filename = `training_data_openai_${tenantId}_${Date.now()}.json`;
      break;
  }

  c.header("Content-Type", contentType);
  c.header("Content-Disposition", `attachment; filename="${filename}"`);

  return c.body(output);
});

// Stats endpoint
app.get("/:tenantId/stats", async (c) => {
  const tenantId = c.req.param("tenantId");

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("conversation_logs")
    .select(
      "scenario_type, quality_score, reviewed, flagged, has_tool_calls, turn_count",
    )
    .eq("tenant_id", tenantId);

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  type StatsRow = {
    scenario_type: string | null;
    quality_score: number | null;
    reviewed: boolean;
    flagged: boolean;
    has_tool_calls: boolean;
    turn_count: number;
  };

  const rows = (data || []) as StatsRow[];

  const stats = {
    total: rows.length,
    reviewed: rows.filter((d: StatsRow) => d.reviewed).length,
    flagged: rows.filter((d: StatsRow) => d.flagged).length,
    exportReady: rows.filter(
      (d: StatsRow) =>
        d.reviewed && !d.flagged && (d.quality_score ?? 0) >= 0.7,
    ).length,
    avgQuality:
      rows.reduce(
        (sum: number, d: StatsRow) => sum + (d.quality_score || 0),
        0,
      ) / rows.length || 0,
    avgTurns:
      rows.reduce((sum: number, d: StatsRow) => sum + (d.turn_count || 0), 0) /
        rows.length || 0,
    byScenario: {} as Record<string, number>,
    withToolCalls: rows.filter((d: StatsRow) => d.has_tool_calls).length,
  };

  for (const conv of rows) {
    const scenario = conv.scenario_type || "unknown";
    stats.byScenario[scenario] = (stats.byScenario[scenario] || 0) + 1;
  }

  return c.json(stats);
});

// Helper: Convert to OpenAI format (for fine-tuning)
function convertToOpenAI(
  messages: Array<{
    role: string;
    content: string;
    tool_name?: string;
    tool_result?: unknown;
  }>,
): OpenAIEntry {
  const openaiMessages: OpenAIMessage[] = [];

  for (const msg of messages) {
    if (msg.role === "tool") continue; // Skip tool messages for basic format

    openaiMessages.push({
      role: msg.role as "system" | "user" | "assistant",
      content: msg.content,
    });
  }

  return { messages: openaiMessages };
}

// Helper: Convert to ShareGPT format
function convertToShareGPT(
  messages: Array<{ role: string; content: string }>,
): ShareGPTConversation {
  const conversations: ShareGPTMessage[] = [];

  for (const msg of messages) {
    let from: "system" | "human" | "gpt";
    switch (msg.role) {
      case "user":
        from = "human";
        break;
      case "assistant":
        from = "gpt";
        break;
      case "system":
        from = "system";
        break;
      default:
        continue; // Skip tool messages
    }

    conversations.push({ from, value: msg.content });
  }

  return { conversations };
}

// Helper: Convert to Alpaca format (instruction/input/output)
function convertToAlpaca(
  messages: Array<{ role: string; content: string }>,
): AlpacaEntry[] {
  const entries: AlpacaEntry[] = [];
  let systemPrompt = "";

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];

    if (msg.role === "system") {
      systemPrompt = msg.content;
      continue;
    }

    if (msg.role === "user" && i + 1 < messages.length) {
      const nextMsg = messages[i + 1];
      if (nextMsg.role === "assistant") {
        entries.push({
          instruction: systemPrompt || "You are a helpful AI voice assistant.",
          input: msg.content,
          output: nextMsg.content,
        });
      }
    }
  }

  return entries;
}

export default app;
