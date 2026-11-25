import {
  ARENA_MODEL_CATALOG,
  DEFAULT_ARENA_MODELS,
  runConcurrentArena,
  type ArenaEvent,
} from "@/lib/arena-agent";
import type { HealthDataAdapter } from "@/lib/agent-tools";
import { readDailyRange } from "@/lib/trend-query";
import { periodEvidence, savePeriodReview } from "@/lib/period-reviews";

// ============================================================================
// 1. 鉴权、日期工具与真实数据适配器
// ============================================================================

function getEnv(name: string): string | undefined {
  return process.env[name];
}

/**
 * 将闭区间结束日 YYYY-MM-DD 转为 readDailyRange 所需的半开区间 endExclusive
 */
function addOneDay(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + 1));
  return dt.toISOString().slice(0, 10);
}

/**
 * 复用你现有的 owner 登录态、SERVICE_TOKEN 或 oai-authenticated-user-id 校验
 */
async function isAuthorizedRequest(request: Request): Promise<boolean> {
  return request.headers.get("oai-authenticated-user-id") === "owner";
}

/**
 * 直接桥接仓库现有的 lib/trend-query.ts 与 lib/period-reviews.ts
 */
function buildHealthAdapter(): HealthDataAdapter {
  return {
    async getWellnessRange({ from, to }) {
      const endExclusive = addOneDay(to);
      return await readDailyRange(from, endExclusive);
    },
    async readPeriodEvidence({ period, end, page }) {
      return await periodEvidence(period as never, end, page);
    },
    async savePeriodReview({ period, end, body }) {
      return await savePeriodReview(period as never, end, body);
    },
  };
}

// ============================================================================
// 2. GET /api/arena —— 返回可选模型目录与默认三栏旗舰配置
// ============================================================================

export async function GET() {
  if (getEnv("ENABLE_ARENA") === "false") {
    return Response.json(
      { enabled: false, error: "并发分析功能已通过环境变量关闭" },
      { status: 503 }
    );
  }

  return Response.json({
    enabled: true,
    defaultModels: DEFAULT_ARENA_MODELS,
    catalog: ARENA_MODEL_CATALOG,
  });
}

// ============================================================================
// 3. POST /api/arena —— SSE 流式并发调用三模型并实时推送 Tool Calling 轨迹
// ============================================================================

interface ArenaRequestBody {
  prompt?: string;
  modelIds?: string[]; // 默认 ["openai/gpt-6.2-astra", "anthropic/claude-opus-5.5", "google/gemini-4-neon"]
  apiKey?: string; // 可选：前端设置页/输入框传入的 OpenRouter Key；未传则读服务端环境变量
  todayDate?: string;
}

export async function POST(request: Request) {
  // Feature Flag 退路：线上随时可通过 ENABLE_ARENA=false 秒级关闭
  if (getEnv("ENABLE_ARENA") === "false") {
    return Response.json(
      { error: "并发分析功能当前已关闭" },
      { status: 503 }
    );
  }

  if (!(await isAuthorizedRequest(request))) {
    return Response.json({ error: "未授权访问，请先登录" }, { status: 401 });
  }

  let body: ArenaRequestBody;
  try {
    body = (await request.json()) as ArenaRequestBody;
  } catch {
    return Response.json({ error: "请求体必须是合法 JSON" }, { status: 400 });
  }

  const prompt = body.prompt?.trim();
  if (!prompt) {
    return Response.json({ error: "prompt 不能为空" }, { status: 400 });
  }

  const apiKey = body.apiKey?.trim() || getEnv("OPENROUTER_API_KEY");
  if (!apiKey) {
    return Response.json(
      {
        error:
          "未检测到 OPENROUTER_API_KEY，请在右上角输入密钥或配置服务端环境变量",
      },
      { status: 400 }
    );
  }

  const todayDate =
    body.todayDate && /^\d{4}-\d{2}-\d{2}$/.test(body.todayDate)
      ? body.todayDate
      : new Date().toISOString().slice(0, 10);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const sendSse = (eventName: string, payload: unknown) => {
        const line = `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;
        controller.enqueue(encoder.encode(line));
      };

      try {
        const outcomes = await runConcurrentArena({
          prompt,
          todayDate,
          apiKey,
          modelIds: body.modelIds,
          adapter: buildHealthAdapter(),
          onEvent: (ev: ArenaEvent) => {
            sendSse("arena_event", ev);
          },
        });

        sendSse("arena_complete", { outcomes });
      } catch (err) {
        sendSse("arena_fatal", {
          error: err instanceof Error ? err.message : "并发执行失败",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
