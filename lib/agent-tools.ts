import { z } from "zod";

/**
 * 统一的健康数据查询适配器接口
 * 直接对齐 health-trend-journal 现有的 lib/trend-query.ts 与 lib/period-reviews.ts，
 * 让 /api/arena 与 /mcp 共用同一套工具定义与执行逻辑。
 */
export interface HealthDataAdapter {
  getWellnessRange: (params: {
    from: string; // YYYY-MM-DD（含）
    to: string; // YYYY-MM-DD（含）
    includeRaw?: boolean;
  }) => Promise<unknown[]>;
  readPeriodEvidence: (params: {
    period: string;
    end: string; // YYYY-MM-DD（含）
    page?: number;
  }) => Promise<unknown>;
  savePeriodReview?: (params: {
    period: string;
    end: string;
    body: string;
  }) => Promise<unknown>;
}

// ============================================================================
// 1. Zod 参数校验 Schema（与 app/mcp/route.ts 参数保持一致）
// ============================================================================

const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "日期格式必须为 YYYY-MM-DD");

export const GetWellnessRangeArgsSchema = z.object({
  from: dateStringSchema,
  to: dateStringSchema,
  includeRaw: z.boolean().optional().default(true),
});

export const ReadPeriodEvidenceArgsSchema = z.object({
  period: z.string().min(1, "period 不能为空，例如 week / month / 14d"),
  end: dateStringSchema,
  page: z.number().int().min(1).optional(),
});

export const SavePeriodReviewArgsSchema = z.object({
  period: z.string().min(1),
  end: dateStringSchema,
  body: z.string().min(10).max(10000),
});

// ============================================================================
// 2. 统一 Tool Schema 定义（兼容 OpenRouter / OpenAI / Anthropic / Gemini）
// ============================================================================

export interface UnifiedToolDefinition {
  type: "function";
  function: {
    name: "get_wellness_range" | "read_period_evidence" | "save_period_review";
    description: string;
    parameters: Record<string, unknown>;
  };
}

export const AGENT_TOOL_DEFINITIONS: UnifiedToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "get_wellness_range",
      description:
        "按日期范围查询每日基础健康指标（步数、静息心率、睡眠时长等 TrendPoint 明细）。适合在发现某几天异常后，进一步拉取前后对照数据。",
      parameters: {
        type: "object",
        properties: {
          from: {
            type: "string",
            description: "起始日期（含），格式 YYYY-MM-DD",
          },
          to: {
            type: "string",
            description: "结束日期（含），格式 YYYY-MM-DD",
          },
          includeRaw: {
            type: "boolean",
            description: "是否返回每日明细数组，默认 true",
          },
        },
        required: ["from", "to"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_period_evidence",
      description:
        "读取指定周期（如 week、month）的聚合统计摘要与异常偏差证据，用于快速定位问题日期区间。",
      parameters: {
        type: "object",
        properties: {
          period: {
            type: "string",
            description: "周期类型，如 week、month",
          },
          end: {
            type: "string",
            description: "周期结束日期（含，北京时间 YYYY-MM-DD）",
          },
          page: {
            type: "integer",
            minimum: 1,
            description: "可选分页页码，从 1 开始",
          },
        },
        required: ["period", "end"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "save_period_review",
      description:
        "将模型生成的周期健康归因结论持久化保存到 D1 数据库，供后续趋势回顾使用。",
      parameters: {
        type: "object",
        properties: {
          period: { type: "string", description: "周期类型，如 week、month" },
          end: { type: "string", description: "周期结束日期 YYYY-MM-DD" },
          body: {
            type: "string",
            description: "结构化的周期归因分析与建议正文（不超过 10000 字）",
          },
        },
        required: ["period", "end", "body"],
      },
    },
  },
];

/**
 * 转换为 MCP tools/list 标准格式，供 app/mcp/route.ts 直接复用
 */
export function toMcpToolList(includeWriteTools = true) {
  return AGENT_TOOL_DEFINITIONS.filter(
    (t) => includeWriteTools || t.function.name !== "save_period_review"
  ).map((t) => ({
    name: t.function.name,
    description: t.function.description,
    inputSchema: t.function.parameters,
  }));
}

// ============================================================================
// 3. 统一工具执行器（/api/arena 与 /mcp 共用入口）
// ============================================================================

export interface ToolExecutionResult {
  ok: boolean;
  toolName: string;
  data?: unknown;
  error?: string;
}

export async function executeAgentTool(
  toolName: string,
  rawArgs: string | Record<string, unknown>,
  adapter: HealthDataAdapter
): Promise<ToolExecutionResult> {
  let parsedInput: unknown;
  try {
    parsedInput =
      typeof rawArgs === "string" ? JSON.parse(rawArgs || "{}") : rawArgs;
  } catch {
    return {
      ok: false,
      toolName,
      error: "工具参数不是合法的 JSON 字符串",
    };
  }

  try {
    switch (toolName) {
      case "get_wellness_range": {
        const args = GetWellnessRangeArgsSchema.parse(parsedInput);
        const rows = await adapter.getWellnessRange(args);
        return {
          ok: true,
          toolName,
          data: {
            from: args.from,
            to: args.to,
            count: rows.length,
            records: args.includeRaw ? rows : undefined,
          },
        };
      }

      case "read_period_evidence": {
        const args = ReadPeriodEvidenceArgsSchema.parse(parsedInput);
        const evidence = await adapter.readPeriodEvidence(args);
        return {
          ok: true,
          toolName,
          data: evidence,
        };
      }

      case "save_period_review": {
        const args = SavePeriodReviewArgsSchema.parse(parsedInput);
        if (!adapter.savePeriodReview) {
          return {
            ok: false,
            toolName,
            error: "当前适配器未开启 save_period_review 写入权限",
          };
        }
        const saved = await adapter.savePeriodReview(args);
        return {
          ok: true,
          toolName,
          data: saved,
        };
      }

      default:
        return {
          ok: false,
          toolName,
          error: `未知工具名称: ${toolName}`,
        };
    }
  } catch (err) {
    const message =
      err instanceof z.ZodError
        ? `参数校验失败: ${err.issues.map((i) => i.message).join("; ")}`
        : err instanceof Error
          ? err.message
          : "工具执行异常";
    return {
      ok: false,
      toolName,
      error: message,
    };
  }
}
