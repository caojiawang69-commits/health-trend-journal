"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ClipboardCopy,
  Eye,
  EyeOff,
  KeyRound,
  Layers,
  Loader2,
  RefreshCw,
  Wrench,
} from "lucide-react";

interface ArenaModelConfig {
  key: string;
  provider: string;
  label: string;
  modelId: string;
  tier?: "flagship" | "balanced" | "fast";
}

interface ToolTraceItem {
  step: number;
  toolName: string;
  args: string;
  ok?: boolean;
  summary?: string;
}

type ColumnStatus =
  | "idle"
  | "thinking"
  | "calling_tools"
  | "writing"
  | "done"
  | "error";

interface ColumnState {
  selectedModelId: string;
  customModelId: string;
  status: ColumnStatus;
  tools: ToolTraceItem[];
  content: string;
  toolCallsCount: number;
  durationMs: number | null;
  error?: string;
}

type ArenaEvent =
  | { type: "status"; modelKey: string; modelId: string; status: "thinking" | "calling_tools" | "writing" }
  | { type: "tool_call"; modelKey: string; modelId: string; step: number; toolName: string; args: string }
  | { type: "tool_result"; modelKey: string; modelId: string; step: number; toolName: string; ok: boolean; summary: string }
  | { type: "content"; modelKey: string; modelId: string; text: string }
  | { type: "done"; modelKey: string; modelId: string; toolCallsCount: number; durationMs: number }
  | { type: "error"; modelKey: string; modelId: string; message: string };

const FALLBACK_CATALOG: ArenaModelConfig[] = [
  { key: "openai-astra-62", provider: "openai", label: "GPT-6.2 Astra", modelId: "openai/gpt-6.2-astra", tier: "flagship" },
  { key: "openai-astra-6", provider: "openai", label: "GPT-6 Astra", modelId: "openai/gpt-6-astra", tier: "flagship" },
  { key: "openai-sol-62", provider: "openai", label: "GPT-6.2 Sol", modelId: "openai/gpt-6.2-sol", tier: "balanced" },
  { key: "anthropic-opus-55", provider: "anthropic", label: "Claude Opus 5.5", modelId: "anthropic/claude-opus-5.5", tier: "flagship" },
  { key: "anthropic-sonnet-5", provider: "anthropic", label: "Claude Sonnet 5", modelId: "anthropic/claude-sonnet-5", tier: "balanced" },
  { key: "google-gemini-4-neon", provider: "google", label: "Gemini 4 Neon", modelId: "google/gemini-4-neon", tier: "flagship" },
  { key: "google-gemini-38-flash", provider: "google", label: "Gemini 3.8 Flash", modelId: "google/gemini-3.8-flash", tier: "fast" },
  { key: "deepseek-v41-flash", provider: "deepseek", label: "DeepSeek V4.1 Flash", modelId: "deepseek/deepseek-v4.1-flash", tier: "fast" },
];

const DEFAULT_SELECTED = [
  "openai/gpt-6.2-astra",
  "anthropic/claude-opus-5.5",
  "google/gemini-4-neon",
];

const PRESET_PROMPTS = [
  "为什么最近睡眠不好？请结合我的心率和步数记录交叉验证。",
  "对比我最近 7 天和前 7 天的恢复状态，给下周作息建议。",
  "最近几天静息心率有什么异常波动？可能是什么原因？",
];

const DEMO_EVIDENCE_SAMPLE = {
  today: "2026-11-25",
  deviations: [
    { date: "2026-11-23", metric: "sleepSeconds", reason: "低于个人 14 天基线 28%" },
    { date: "2026-11-24", metric: "restingBpm", reason: "较基线抬升 +7 bpm" },
  ],
  points: [
    { date: "2026-11-21", steps: 8420, restingBpm: 59, sleepHours: 7.2 },
    { date: "2026-11-22", steps: 7910, restingBpm: 58, sleepHours: 7.1 },
    { date: "2026-11-23", steps: 12840, restingBpm: 65, sleepHours: 5.7 },
    { date: "2026-11-24", steps: 14120, restingBpm: 67, sleepHours: 5.5 },
    { date: "2026-11-25", steps: 11350, restingBpm: 66, sleepHours: 5.6 },
  ],
};

function createInitialColumns(modelIds: string[]): ColumnState[] {
  return modelIds.map((id) => ({
    selectedModelId: id,
    customModelId: "",
    status: "idle",
    tools: [],
    content: "",
    toolCallsCount: 0,
    durationMs: null,
  }));
}

function buildDemoAnalysis(modelId: string, prompt: string) {
  const lower = modelId.toLowerCase();
  if (lower.includes("claude")) {
    return {
      delayMs: 320,
      durationMs: 2450,
      tools: [
        { step: 1, toolName: "read_period_evidence", args: '{"period":"week","end":"2026-11-25"}', summary: "检出近 3 天睡眠跌至 5.5–5.7h，静息心率抬升 +7 bpm" },
        { step: 2, toolName: "get_wellness_range", args: '{"from":"2026-11-18","to":"2026-11-25"}', summary: "对比前一周基线：步数激增 48%，交感神经恢复滞后" },
      ],
      content: `① 已标注异常定位：11-23 至 11-25 睡眠压缩至 5.5–5.7h，静息心率升至 67 bpm。\n② 活动与节律归因：针对「${prompt.slice(0, 16)}...」，近 3 天活动量跃升伴随心率延迟回落，导致夜间副交感神经未能充分占优。\n③ 可执行建议：未来 48 小时降级为低强度拉伸或散步，睡前 3 小时避免高心率活动。`,
    };
  }
  if (lower.includes("gemini")) {
    return {
      delayMs: 180,
      durationMs: 1980,
      tools: [
        { step: 1, toolName: "read_period_evidence", args: '{"period":"week","end":"2026-11-25"}', summary: "发现 11-23 至 11-25 连续 3 天负向睡眠偏差" },
        { step: 2, toolName: "get_wellness_range", args: '{"from":"2026-11-15","to":"2026-11-25"}', summary: "返回 11 日对照明细，静息心率与睡眠时长呈负相关" },
      ],
      content: `① 已标注异常定位：近 3 天平均睡眠 5.6 小时（较基线下降 22%），静息心率连续高于 65 bpm。\n② 活动与节律归因：活动负荷激增与心率抬升高度重合，心血管系统处于累积疲劳期。\n③ 可执行建议：把高步数/跑量提前至 19:00 前，观察晨起静息心率是否回落至 60 bpm 以下。`,
    };
  }
  return {
    delayMs: 240,
    durationMs: 2150,
    tools: [
      { step: 1, toolName: "read_period_evidence", args: '{"period":"week","end":"2026-11-25"}', summary: "定位到 11-23/24/25 异常睡眠与心率区间" },
      { step: 2, toolName: "get_wellness_range", args: '{"from":"2026-11-19","to":"2026-11-25"}', summary: "返回 7 天对照组明细，确认负荷突变" },
    ],
    content: `① 已标注异常定位：近 3 日静息心率较前期基线抬升 +7~9 bpm，睡眠结构明显受压。\n② 活动与节律归因：连续高步数负荷导致睡前交感神经持续活跃，深度恢复窗口缩短。\n③ 可执行建议：今明两晚提前 30 分钟入睡，暂停高强度训练 2 天待 RHR 回落。`,
  };
}

// ============================================================================
// Apple 极简低饱和配色版双模式工作台（#F5F5F7 / #FFFFFF / #1D1D1F / #6E6E73）
// ============================================================================

export function ArenaPanel({ forceDemo }: { forceDemo?: boolean } = {}) {
  const [activeTab, setActiveTab] = useState<"api" | "subagent">("api");
  const [disabled,setDisabled] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(Boolean(forceDemo));
  const [catalog, setCatalog] = useState<ArenaModelConfig[]>(FALLBACK_CATALOG);
  const [columns, setColumns] = useState<ColumnState[]>(() =>
    createInitialColumns(DEFAULT_SELECTED)
  );
  const [prompt, setPrompt] = useState(PRESET_PROMPTS[0]);
  const [showToolLogs, setShowToolLogs] = useState(true);
  const [showKeyBox, setShowKeyBox] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const demoTimersRef = useRef<number[]>([]);

  const [evidenceText, setEvidenceText] = useState("");
  const [loadingEvidence, setLoadingEvidence] = useState(false);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [subReplies, setSubReplies] = useState({ gpt: "", claude: "", gemini: "" });

  const clearDemoTimers = () => {
    demoTimersRef.current.forEach((id) => window.clearTimeout(id));
    demoTimersRef.current = [];
  };

  useEffect(() => {
    try {
      const savedKey = localStorage.getItem("health_arena_openrouter_key");
      if (savedKey) setApiKey(savedKey);
    } catch {}

    if (forceDemo) {
      setIsDemoMode(true);
      return;
    }

    fetch("/api/arena")
      .then(async (res) => {
        if (res.status === 503) {setDisabled(true); throw new Error("Disabled");}
        if (!res.ok) throw new Error("No backend");
        return res.json() as Promise<{catalog?: ArenaModelConfig[]; defaultModels?: ArenaModelConfig[]}>;
      })
      .then((data) => {
        setIsDemoMode(false);
        if (data?.catalog?.length) setCatalog(data.catalog);
        if (data?.defaultModels?.length === 3) {
          setColumns(createInitialColumns(data.defaultModels.map((m: ArenaModelConfig) => m.modelId)));
        }
      })
      .catch(() => {
        setIsDemoMode(true);
      });

    return () => {
      abortRef.current?.abort();
      clearDemoTimers();
    };
  }, [forceDemo]);

  const handleSaveKey = (val: string) => {
    setApiKey(val);
    try {
      if (val.trim()) localStorage.setItem("health_arena_openrouter_key", val.trim());
      else localStorage.removeItem("health_arena_openrouter_key");
    } catch {}
  };

  const getEffectiveModelId = (col: ColumnState) =>
    col.selectedModelId === "__custom__" ? col.customModelId.trim() : col.selectedModelId;

  const updateColumnByIndex = (idx: number, updater: (prev: ColumnState) => ColumnState) => {
    setColumns((prev) => prev.map((col, i) => (i === idx ? updater(col) : col)));
  };

  const updateColumnByModelId = (modelId: string, updater: (prev: ColumnState) => ColumnState) => {
    setColumns((prev) => prev.map((col) => (getEffectiveModelId(col) === modelId ? updater(col) : col)));
  };

  const runDemoSimulation = (activePrompt: string, modelIds: string[]) => {
    clearDemoTimers();
    let finished = 0;

    modelIds.forEach((modelId, idx) => {
      const plan = buildDemoAnalysis(modelId, activePrompt);
      let elapsed = plan.delayMs;

      plan.tools.forEach((tool) => {
        const t1 = window.setTimeout(() => {
          updateColumnByIndex(idx, (c) => ({
            ...c,
            status: "calling_tools",
            tools: [...c.tools, { step: tool.step, toolName: tool.toolName, args: tool.args }],
          }));
        }, elapsed);
        demoTimersRef.current.push(t1);
        elapsed += 350;

        const t2 = window.setTimeout(() => {
          updateColumnByIndex(idx, (c) => ({
            ...c,
            tools: c.tools.map((item, tIdx) => (tIdx === c.tools.length - 1 ? { ...item, ok: true, summary: tool.summary } : item)),
          }));
        }, elapsed);
        demoTimersRef.current.push(t2);
        elapsed += 300;
      });

      const tWrite = window.setTimeout(() => {
        updateColumnByIndex(idx, (c) => ({ ...c, status: "writing" }));
      }, elapsed);
      demoTimersRef.current.push(tWrite);
      elapsed += 380;

      const tDone = window.setTimeout(() => {
        updateColumnByIndex(idx, (c) => ({
          ...c,
          status: "done",
          content: plan.content,
          toolCallsCount: plan.tools.length,
          durationMs: plan.durationMs,
        }));
        finished += 1;
        if (finished === modelIds.length) setIsRunning(false);
      }, elapsed);
      demoTimersRef.current.push(tDone);
    });
  };

  const handleRunArena = async (overridePrompt?: string) => {
    const activePrompt = (overridePrompt ?? prompt).trim();
    if (!activePrompt) {
      setGlobalError("请先输入你想分析的健康问题");
      return;
    }

    const modelIds = columns.map(getEffectiveModelId);
    if (modelIds.some((id) => !id)) {
      setGlobalError("请为所有栏位选择模型或填写自定义 OpenRouter Model ID");
      return;
    }

    abortRef.current?.abort();
    clearDemoTimers();
    setGlobalError(null);
    setIsRunning(true);
    setColumns((prev) =>
      prev.map((col) => ({
        ...col,
        status: "thinking",
        tools: [],
        content: "",
        toolCallsCount: 0,
        durationMs: null,
        error: undefined,
      }))
    );

    if (isDemoMode) {
      runDemoSimulation(activePrompt, modelIds);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/arena", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          prompt: activePrompt,
          modelIds,
          apiKey: apiKey.trim() || undefined,
          todayDate: new Date().toISOString().slice(0, 10),
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error((errJson as {error?:string})?.error || `请求失败 (${res.status})`);
      }

      if (!res.body) throw new Error("服务端未返回流式响应");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const normalized = buffer.replace(/\r\n/g, "\n");
        const blocks = normalized.split("\n\n");
        buffer = blocks.pop() ?? "";

        for (const block of blocks) {
          const lines = block.split("\n");
          const eventLine = lines.find((l) => l.startsWith("event:"));
          const dataLine = lines.find((l) => l.startsWith("data:"));
          if (!eventLine || !dataLine) continue;

          const eventName = eventLine.replace("event:", "").trim();
          const payload = JSON.parse(dataLine.replace("data:", "").trim());

          if (eventName === "arena_event") {
            const ev = payload as ArenaEvent;
            if (ev.type === "status") {
              updateColumnByModelId(ev.modelId, (c) => ({ ...c, status: ev.status }));
            } else if (ev.type === "tool_call") {
              updateColumnByModelId(ev.modelId, (c) => ({
                ...c,
                tools: [...c.tools, { step: ev.step, toolName: ev.toolName, args: ev.args }],
              }));
            } else if (ev.type === "tool_result") {
              updateColumnByModelId(ev.modelId, (c) => ({
                ...c,
                tools: c.tools.map((t, idx) => (idx === c.tools.length - 1 ? { ...t, ok: ev.ok, summary: ev.summary } : t)),
              }));
            } else if (ev.type === "content") {
              updateColumnByModelId(ev.modelId, (c) => ({ ...c, content: ev.text }));
            } else if (ev.type === "done") {
              updateColumnByModelId(ev.modelId, (c) => ({
                ...c,
                status: "done",
                toolCallsCount: ev.toolCallsCount,
                durationMs: ev.durationMs,
              }));
            } else if (ev.type === "error") {
              updateColumnByModelId(ev.modelId, (c) => ({ ...c, status: "error", error: ev.message }));
            }
          } else if (eventName === "arena_fatal") {
            setGlobalError(payload.error || "并发执行异常");
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setGlobalError(err instanceof Error ? err.message : "请求异常");
      }
    } finally {
      setIsRunning(false);
    }
  };

  const handleBuildEvidence = async () => {
    setLoadingEvidence(true);
    setCopyStatus(null);
    try {
      let payload: {today:string; points:unknown[]; deviations:unknown[]} = DEMO_EVIDENCE_SAMPLE;
      if (!isDemoMode) {
        const res = await fetch("/api/trends?range=30");
        if (!res.ok) throw new Error("记录读取失败");
        const trend = await res.json() as import("../features/trends/model").TrendPayload;
        payload = {today:trend.today,points:trend.points,deviations:trend.deviations.flags};
      }
      const recentPoints = Array.isArray(payload?.points) ? payload.points.slice(-7) : [];
      const deviations = Array.isArray(payload?.deviations) ? payload.deviations : [];

      const packet = [
        `【分析问题】${prompt.trim() || "请分析我最近的健康与睡眠趋势"}`,
        `【数据来源】health-trend-journal${isDemoMode ? "（Demo 模拟数据）" : ""}（截止 ${payload?.today ?? new Date().toISOString().slice(0, 10)}）`,
        `【异常偏差摘要】${deviations.length ? JSON.stringify(deviations) : "无显式系统偏差标注"}`,
        `【最近每日数据】`,
        JSON.stringify(recentPoints, null, 2),
        "",
        "请基于以上真实健康指标，给出可能原因与可执行恢复建议；缺失字段请直说，不要编造。",
      ].join("\n");

      setEvidenceText(packet);
    } catch {
      setEvidenceText(""); setCopyStatus("读取记录失败，请重试。");
    } finally {
      setLoadingEvidence(false);
    }
  };

  const handleCopyEvidence = async () => {
    if (!evidenceText) return;
    try {
      await navigator.clipboard.writeText(evidenceText);
      setCopyStatus("已复制，可粘贴给任意网页版 AI");
    } catch {
      setCopyStatus("复制失败，请手动全选复制");
    }
  };

  if (disabled) return null;
  return (
    <section id="arena" className="mt-5 space-y-5 rounded-[22px] border border-black/[0.06] bg-[#F5F5F7] p-5 text-[#1D1D1F] sm:p-6">
      {/* 顶部标题与 Apple 分段切换 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-2.5">
          <span className="text-[11px] font-semibold tracking-wider text-[#86868B] uppercase">
            Multi-Agent
          </span>
          <h2 className="text-[17px] font-semibold tracking-tight text-[#1D1D1F]">
            双模式多模型并发工作台
          </h2>
          {isDemoMode && (
            <span className="rounded-full bg-black/[0.045] px-2.5 py-0.5 text-[11px] font-medium text-[#6E6E73]">
              Demo 演示模式
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="flex items-center rounded-[11px] bg-black/[0.045] p-0.5">
            <button
              type="button"
              onClick={() => setActiveTab("api")}
              className={`rounded-[9px] px-3 py-1.5 font-medium transition ${
                activeTab === "api"
                  ? "bg-white text-[#1D1D1F] shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
                  : "text-[#6E6E73] hover:text-[#1D1D1F]"
              }`}
            >
              窗口一 · API 并发
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("subagent");
                if (!evidenceText) handleBuildEvidence();
              }}
              className={`rounded-[9px] px-3 py-1.5 font-medium transition ${
                activeTab === "subagent"
                  ? "bg-white text-[#1D1D1F] shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
                  : "text-[#6E6E73] hover:text-[#1D1D1F]"
              }`}
            >
              窗口二 · 零额度异步
            </button>
          </div>

          {activeTab === "api" && (
            <>
              <button
                type="button"
                onClick={() => setShowToolLogs((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-[10px] border border-black/[0.06] bg-white px-2.5 py-1.5 text-[#6E6E73] hover:text-[#1D1D1F]"
              >
                {showToolLogs ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                {showToolLogs ? "隐藏轨迹" : "显示轨迹"}
              </button>

              {!isDemoMode && (
                <button
                  type="button"
                  onClick={() => setShowKeyBox((v) => !v)}
                  className="inline-flex items-center gap-1.5 rounded-[10px] border border-black/[0.06] bg-white px-2.5 py-1.5 text-[#6E6E73] hover:text-[#1D1D1F]"
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  Key
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* 窗口一：API 并发分析 */}
      {activeTab === "api" ? (
        <div className="space-y-4">
          {showKeyBox && !isDemoMode && (
            <div className="rounded-2xl border border-black/[0.06] bg-white p-3.5 text-xs">
              <label className="mb-1.5 block font-medium text-[#6E6E73]">
                OpenRouter API Key（若服务端已配置环境变量，此处可留空）
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => handleSaveKey(e.target.value)}
                placeholder="sk-or-v1-..."
                className="w-full rounded-xl border border-black/[0.08] bg-[#F5F5F7] px-3 py-2 text-xs text-[#1D1D1F] focus:border-black/25 focus:bg-white focus:outline-none"
              />
            </div>
          )}

          {/* 极简输入栏 */}
          <div className="space-y-2.5">
            <div className="flex flex-col gap-2 rounded-[18px] border border-black/[0.06] bg-white p-2 shadow-[0_2px_10px_rgba(0,0,0,0.02)] sm:flex-row sm:items-center">
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !isRunning) handleRunArena();
                }}
                placeholder="输入健康分析问题，三个模型将按需调用工具交叉验证..."
                className="flex-1 bg-transparent px-3 py-2 text-sm text-[#1D1D1F] placeholder-[#86868B] focus:outline-none"
              />
              <button
                type="button"
                disabled={isRunning}
                onClick={() => handleRunArena()}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1D1D1F] px-5 py-2.5 text-xs font-medium text-white transition hover:bg-[#3A3A3C] disabled:opacity-45"
              >
                {isRunning && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {isRunning ? "并发推理中" : "并发分析"}
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-[#86868B]">快捷提问：</span>
              {PRESET_PROMPTS.map((item) => (
                <button
                  key={item}
                  type="button"
                  disabled={isRunning}
                  onClick={() => {
                    setPrompt(item);
                    handleRunArena(item);
                  }}
                  className="rounded-full border border-black/[0.06] bg-white px-3 py-1 text-xs text-[#515154] transition hover:border-black/15 hover:text-[#1D1D1F] disabled:opacity-45"
                >
                  {item}
                </button>
              ))}
            </div>

            {globalError && (
              <div className="flex items-center gap-2 rounded-xl border border-[#C06C5B]/25 bg-[#FAF0EE] px-3.5 py-2.5 text-xs text-[#9E4F40]">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{globalError}</span>
              </div>
            )}
          </div>

          {/* 三栏卡片 */}
          <div className="arena-columns grid grid-cols-1 gap-4 lg:grid-cols-3">
            {columns.map((col, idx) => (
              <article
                key={idx}
                className="flex flex-col overflow-hidden rounded-[20px] border border-black/[0.055] bg-white shadow-[0_2px_12px_rgba(0,0,0,0.025)]"
              >
                <div className="space-y-2 border-b border-black/[0.045] px-4 py-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <select
                      disabled={isRunning}
                      value={col.selectedModelId}
                      onChange={(e) => {
                        const val = e.target.value;
                        setColumns((prev) => prev.map((c, i) => (i === idx ? { ...c, selectedModelId: val } : c)));
                      }}
                      className="max-w-[185px] rounded-lg border border-black/[0.06] bg-[#F5F5F7] px-2.5 py-1 text-xs font-medium text-[#1D1D1F] focus:outline-none"
                    >
                      {catalog.map((m) => (
                        <option key={m.modelId} value={m.modelId}>{m.label}</option>
                      ))}
                      <option value="__custom__">自定义 Model ID...</option>
                    </select>
                    <StatusDot status={col.status} />
                  </div>

                  {col.selectedModelId === "__custom__" && (
                    <input
                      type="text"
                      value={col.customModelId}
                      onChange={(e) => {
                        const val = e.target.value;
                        setColumns((prev) => prev.map((c, i) => (i === idx ? { ...c, customModelId: val } : c)));
                      }}
                      placeholder="例如 openai/gpt-6.2-astra-pro"
                      className="w-full rounded-lg border border-black/[0.08] bg-[#F5F5F7] px-2.5 py-1 text-xs text-[#1D1D1F] focus:bg-white focus:outline-none"
                    />
                  )}
                </div>

                {showToolLogs && col.tools.length > 0 && (
                  <div className="space-y-1.5 border-b border-black/[0.045] bg-[#FAFAFC] p-3 text-xs">
                    {col.tools.map((t, tIdx) => (
                      <div key={tIdx} className="rounded-[10px] border border-black/[0.055] bg-white p-2.5">
                        <div className="flex items-center gap-1.5 font-mono text-[11px] font-medium text-[#4A6580]">
                          <Wrench className="h-3 w-3 shrink-0 opacity-70" />
                          <span className="truncate">#{t.step} {t.toolName}({t.args})</span>
                        </div>
                        {t.summary && <div className="mt-1 text-[11px] text-[#6E6E73]">{t.summary}</div>}
                      </div>
                    ))}
                  </div>
                )}

                <div className="min-h-[200px] flex-1 p-4 text-[13px] leading-[1.7] text-[#424245]">
                  {col.error ? (
                    <p className="text-xs text-[#A65646]">调用失败：{col.error}</p>
                  ) : col.content ? (
                    <p className="whitespace-pre-line">{col.content}</p>
                  ) : (
                    <p className="text-xs text-[#86868B]">
                      {col.status === "idle" ? "点击“并发分析”后，模型将按需调用工具并在此输出结论。" : "正在交叉验证健康数据..."}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between border-t border-black/[0.045] px-4 py-2.5 text-[11px] text-[#86868B] tabular-nums">
                  <span>工具调用 {col.toolCallsCount} 次</span>
                  <span>{col.durationMs !== null ? `${(col.durationMs / 1000).toFixed(2)}s` : "—"}</span>
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : (
        /* 窗口二：零 API 额度异步模式 */
        <div className="space-y-4">
          <div className="flex items-start gap-2.5 rounded-2xl border border-black/[0.055] bg-white px-4 py-3 text-xs leading-relaxed text-[#515154]">
            <Layers className="mt-0.5 h-4 w-4 shrink-0 text-[#86868B]" />
            <span>
              <strong className="font-semibold text-[#1D1D1F]">零 API 额度异步模式：</strong>
              未配置 API 密钥时，可直接提取本地健康趋势与异常偏差打包，交给已订阅的网页端 AI 分析，再贴回下方同屏对照。
            </span>
          </div>

          <div className="space-y-2.5 rounded-[20px] border border-black/[0.055] bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-medium text-[#1D1D1F]">
                结构化健康证据包（{isDemoMode ? "Demo 示例数据" : "本地 /api/trends"}）
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={loadingEvidence}
                  onClick={handleBuildEvidence}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-black/[0.08] bg-[#F5F5F7] px-3 py-1.5 text-xs font-medium text-[#1D1D1F] hover:bg-black/[0.06]"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loadingEvidence ? "animate-spin" : ""}`} />
                  刷新
                </button>
                <button
                  type="button"
                  onClick={handleCopyEvidence}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#1D1D1F] px-3.5 py-1.5 text-xs font-medium text-white hover:bg-[#3A3A3C]"
                >
                  <ClipboardCopy className="h-3.5 w-3.5" />
                  一键复制
                </button>
              </div>
            </div>

            <textarea
              rows={6}
              readOnly
              value={evidenceText}
              className="w-full rounded-xl border border-black/[0.06] bg-[#F5F5F7] p-3 font-mono text-xs leading-relaxed text-[#424245] focus:outline-none"
            />
            {copyStatus && <p className="text-xs font-medium text-[#446654]">{copyStatus}</p>}
          </div>

          <div className="arena-columns grid grid-cols-1 gap-4 lg:grid-cols-3">
            {[
              { key: "gpt" as const, title: "ChatGPT 网页端", tag: "Plus" },
              { key: "claude" as const, title: "Claude 网页端", tag: "Pro" },
              { key: "gemini" as const, title: "Gemini / DeepSeek", tag: "Web" },
            ].map((item) => (
              <div key={item.key} className="space-y-2 rounded-[20px] border border-black/[0.055] bg-white p-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#1D1D1F]">{item.title}</span>
                  <span className="rounded-full bg-[#F5F5F7] px-2 py-0.5 text-[11px] text-[#6E6E73]">{item.tag}</span>
                </div>
                <textarea
                  rows={6}
                  value={subReplies[item.key]}
                  onChange={(e) => setSubReplies((prev) => ({ ...prev, [item.key]: e.target.value }))}
                  placeholder={`粘贴 ${item.title} 的分析结果...`}
                  className="w-full rounded-xl border border-black/[0.06] bg-[#F5F5F7] p-3 text-xs text-[#424245] focus:border-black/20 focus:bg-white focus:outline-none"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export default ArenaPanel;

function StatusDot({ status }: { status: ColumnStatus }) {
  if (status === "thinking" || status === "calling_tools" || status === "writing") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#5B7B9A]">
        <Loader2 className="h-3 w-3 animate-spin" />
        {status === "calling_tools" ? "查数中" : status === "writing" ? "总结中" : "思考中"}
      </span>
    );
  }
  if (status === "done") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#446654]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#527965]" />
        已完成
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#A65646]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#C06C5B]" />
        异常
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-[#86868B]">
      <span className="h-1.5 w-1.5 rounded-full bg-black/20" />
      待命
    </span>
  );
}
