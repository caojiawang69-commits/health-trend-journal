import {
  AGENT_TOOL_DEFINITIONS,
  executeAgentTool,
  type HealthDataAdapter,
} from "./agent-tools";

// ============================================================================
// 1. 模型目录与动态选择配置（默认旗舰级 + 多档位可选 + 支持自定义 Model ID）
// ============================================================================

export type ArenaProvider =
  | "openai"
  | "anthropic"
  | "google"
  | "deepseek"
  | "x-ai"
  | "custom";

export interface ArenaModelConfig {
  key: string;
  provider: ArenaProvider;
  label: string;
  modelId: string; // OpenRouter 模型 ID
  tier?: "flagship" | "balanced" | "fast";
}

/**
 * 2026-11 最新 OpenRouter 模型目录（前端可直接渲染为下拉选择器）。
 * 若后续有更新模型上线，前端或请求体直接传入对应 modelId 字符串即可，无需修改后端代码。
 */
export const ARENA_MODEL_CATALOG: ArenaModelConfig[] = [
  // OpenAI GPT-6 系列
  {
    key: "openai-astra-62",
    provider: "openai",
    label: "GPT-6.2 Astra",
    modelId: "openai/gpt-6.2-astra",
    tier: "flagship",
  },
  {
    key: "openai-astra-6",
    provider: "openai",
    label: "GPT-6 Astra",
    modelId: "openai/gpt-6-astra",
    tier: "flagship",
  },
  {
    key: "openai-sol-62",
    provider: "openai",
    label: "GPT-6.2 Sol",
    modelId: "openai/gpt-6.2-sol",
    tier: "balanced",
  },
  {
    key: "openai-luna-6",
    provider: "openai",
    label: "GPT-6 Luna",
    modelId: "openai/gpt-6-luna",
    tier: "fast",
  },

  // Anthropic Claude 5 系列
  {
    key: "anthropic-opus-55",
    provider: "anthropic",
    label: "Claude Opus 5.5",
    modelId: "anthropic/claude-opus-5.5",
    tier: "flagship",
  },
  {
    key: "anthropic-fable-51",
    provider: "anthropic",
    label: "Claude Fable 5.1",
    modelId: "anthropic/claude-fable-5.1",
    tier: "balanced",
  },
  {
    key: "anthropic-sonnet-5",
    provider: "anthropic",
    label: "Claude Sonnet 5",
    modelId: "anthropic/claude-sonnet-5",
    tier: "balanced",
  },

  // Google Gemini 4 / 3.8 系列
  {
    key: "google-gemini-4-neon",
    provider: "google",
    label: "Gemini 4 Neon",
    modelId: "google/gemini-4-neon",
    tier: "flagship",
  },
  {
    key: "google-gemini-4-hydrogen",
    provider: "google",
    label: "Gemini 4 Hydrogen",
    modelId: "google/gemini-4-hydrogen",
    tier: "balanced",
  },
  {
    key: "google-gemini-38-flash",
    provider: "google",
    label: "Gemini 3.8 Flash",
    modelId: "google/gemini-3.8-flash",
    tier: "fast",
  },

  // 其他主流扩展选择（可替换或作为第 4 栏）
  {
    key: "deepseek-v41-flash",
    provider: "deepseek",
    label: "DeepSeek V4.1 Flash",
    modelId: "deepseek/deepseek-v4.1-flash",
    tier: "fast",
  },
  {
    key: "xai-grok-47",
    provider: "x-ai",
    label: "Grok 4.7",
    modelId: "x-ai/grok-4.7",
    tier: "flagship",
  },
];

/**
 * 默认三栏并发旗舰组合：GPT-6.2 Astra + Claude Opus 5.5 + Gemini 4 Neon
 */
export const DEFAULT_ARENA_MODELS: ArenaModelConfig[] = [
  ARENA_MODEL_CATALOG[0], // openai/gpt-6.2-astra
  ARENA_MODEL_CATALOG[4], // anthropic/claude-opus-5.5
  ARENA_MODEL_CATALOG[7], // google/gemini-4-neon
];

/**
 * 根据前端传入的 modelIds（支持目录预设 ID 或任意自定义 OpenRouter Model ID）解析并发列表
 */
export function resolveArenaModels(
  requestedModelIds?: string[]
): ArenaModelConfig[] {
  if (!requestedModelIds || requestedModelIds.length === 0) {
    return DEFAULT_ARENA_MODELS;
  }
  return requestedModelIds
    .map((id) => id.trim())
    .filter(Boolean)
    .map((id, index) => {
      const preset = ARENA_MODEL_CATALOG.find((m) => m.modelId === id);
      if (preset) return preset;
      const prefix = id.split("/")[0] as ArenaProvider;
      const provider: ArenaProvider =
        prefix === "openai" ||
        prefix === "anthropic" ||
        prefix === "google" ||
        prefix === "deepseek" ||
        prefix === "x-ai"
          ? prefix
          : "custom";
      return {
        key: `custom-${index}-${id.replace(/[^a-zA-Z0-9_-]/g, "_")}`,
        provider,
        label: id.split("/")[1] ?? id,
        modelId: id,
      };
    });
}

// ============================================================================
// 2. 并发事件流类型（供 /api/arena SSE 流式推送使用）
// ============================================================================

export type ArenaEvent =
  | {
      type: "status";
      modelKey: string;
      modelId: string;
      status: "thinking" | "calling_tools" | "writing";
    }
  | {
      type: "tool_call";
      modelKey: string;
      modelId: string;
      step: number;
      toolName: string;
      args: string;
    }
  | {
      type: "tool_result";
      modelKey: string;
      modelId: string;
      step: number;
      toolName: string;
      ok: boolean;
      summary: string;
    }
  | {
      type: "content";
      modelKey: string;
      modelId: string;
      text: string;
    }
  | {
      type: "done";
      modelKey: string;
      modelId: string;
      toolCallsCount: number;
      durationMs: number;
    }
  | {
      type: "error";
      modelKey: string;
      modelId: string;
      message: string;
    };

export interface RunArenaOptions {
  prompt: string;
  todayDate: string; // YYYY-MM-DD，用于让模型推算“近3天/上周”
  apiKey: string; // OpenRouter API Key（或兼容 OpenAI 格式的网关 Key）
  baseUrl?: string; // 默认 https://openrouter.ai/api/v1
  adapter: HealthDataAdapter;
  models?: ArenaModelConfig[];
  modelIds?: string[];
  maxSteps?: number;
  onEvent?: (event: ArenaEvent) => void;
}

export interface ArenaModelOutcome {
  modelKey: string;
  modelId: string;
  label: string;
  ok: boolean;
  content?: string;
  toolCallsCount: number;
  durationMs: number;
  error?: string;
}

// ============================================================================
// 3. OpenAI / OpenRouter 兼容消息类型（Workers 原生 fetch 零 SDK 依赖）
// ============================================================================

interface ChatToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

type ChatMessage =
  | { role: "system" | "user"; content: string }
  | {
      role: "assistant";
      content: string | null;
      tool_calls?: ChatToolCall[];
    }
  | {
      role: "tool";
      tool_call_id: string;
      content: string;
    };

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      role: "assistant";
      content: string | null;
      tool_calls?: ChatToolCall[];
    };
  }>;
  error?: { message?: string };
}

// ============================================================================
// 4. 单模型多轮 Tool Calling Agent 循环
// ============================================================================

async function runSingleModelLoop(
  model: ArenaModelConfig,
  options: RunArenaOptions
): Promise<ArenaModelOutcome> {
  const startedAt = Date.now();
  const maxSteps = options.maxSteps ?? 5;
  const endpoint = `${(options.baseUrl ?? "https://openrouter.ai/api/v1").replace(/\/$/, "")}/chat/completions`;
  const emit = options.onEvent ?? (() => {});

  const systemPrompt = [
    `你是一位严谨的个人健康数据分析助手。今天的日期是 ${options.todayDate}。`,
    "你必须先通过工具（read_period_evidence 或 get_wellness_range）按需查询用户的真实健康记录，再结合数据给出归因分析与可执行建议。",
    "如果某项字段（如 nightlyHrvMs 或 deepSleepSeconds）为 null，请如实说明数据缺失，严禁编造不存在的数值。",
  ].join("\n");

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: options.prompt },
  ];

  let toolCallsCount = 0;

  try {
    for (let step = 1; step <= maxSteps; step++) {
      emit({
        type: "status",
        modelKey: model.key,
        modelId: model.modelId,
        status: "thinking",
      });

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${options.apiKey}`,
          "X-Title": "health-trend-journal",
        },
        body: JSON.stringify({
          model: model.modelId,
          messages,
          tools: AGENT_TOOL_DEFINITIONS,
          tool_choice: "auto",
          temperature: 0.3,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errText.slice(0, 200)}`);
      }

      const json = (await res.json()) as ChatCompletionResponse;
      if (json.error?.message) {
        throw new Error(json.error.message);
      }

      const assistantMsg = json.choices?.[0]?.message;
      if (!assistantMsg) {
        throw new Error("模型未返回有效消息");
      }

      const toolCalls = assistantMsg.tool_calls ?? [];

      if (toolCalls.length === 0) {
        emit({
          type: "status",
          modelKey: model.key,
          modelId: model.modelId,
          status: "writing",
        });
        const finalContent = assistantMsg.content ?? "";
        emit({
          type: "content",
          modelKey: model.key,
          modelId: model.modelId,
          text: finalContent,
        });

        const durationMs = Date.now() - startedAt;
        emit({
          type: "done",
          modelKey: model.key,
          modelId: model.modelId,
          toolCallsCount,
          durationMs,
        });
        return {
          modelKey: model.key,
          modelId: model.modelId,
          label: model.label,
          ok: true,
          content: finalContent,
          toolCallsCount,
          durationMs,
        };
      }

      messages.push({
        role: "assistant",
        content: assistantMsg.content ?? null,
        tool_calls: toolCalls,
      });

      emit({
        type: "status",
        modelKey: model.key,
        modelId: model.modelId,
        status: "calling_tools",
      });

      for (const tc of toolCalls) {
        toolCallsCount += 1;
        emit({
          type: "tool_call",
          modelKey: model.key,
          modelId: model.modelId,
          step,
          toolName: tc.function.name,
          args: tc.function.arguments,
        });

        const result = await executeAgentTool(
          tc.function.name,
          tc.function.arguments,
          options.adapter
        );

        const serialized = JSON.stringify(result);
        emit({
          type: "tool_result",
          modelKey: model.key,
          modelId: model.modelId,
          step,
          toolName: tc.function.name,
          ok: result.ok,
          summary: result.ok
            ? `返回 ${serialized.length} 字符数据`
            : (result.error ?? "执行失败"),
        });

        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: serialized,
        });
      }
    }

    throw new Error(`超过最大工具调用轮数 (${maxSteps}) 仍未收敛`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "未知调用错误";
    const durationMs = Date.now() - startedAt;
    emit({
      type: "error",
      modelKey: model.key,
      modelId: model.modelId,
      message,
    });
    return {
      modelKey: model.key,
      modelId: model.modelId,
      label: model.label,
      ok: false,
      toolCallsCount,
      durationMs,
      error: message,
    };
  }
}

// ============================================================================
// 5. 多模型并发总入口（Promise.allSettled 保证单模型失败不影响其余栏位）
// ============================================================================

export async function runConcurrentArena(
  options: RunArenaOptions
): Promise<ArenaModelOutcome[]> {
  const models = options.models?.length
    ? options.models
    : resolveArenaModels(options.modelIds);

  const settled = await Promise.allSettled(
    models.map((m) => runSingleModelLoop(m, options))
  );

  return settled.map((item, idx) => {
    if (item.status === "fulfilled") {
      return item.value;
    }
    const model = models[idx];
    return {
      modelKey: model.key,
      modelId: model.modelId,
      label: model.label,
      ok: false,
      toolCallsCount: 0,
      durationMs: 0,
      error:
        item.reason instanceof Error
          ? item.reason.message
          : "并发任务异常中断",
    };
  });
}