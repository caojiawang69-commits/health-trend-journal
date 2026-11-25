"use client";



import React, { useEffect, useRef, useState } from "react";

import {

  AlertCircle,

  CheckCircle2,

  ClipboardCopy,

  Eye,

  EyeOff,

  KeyRound,

  Layers,

  Loader2,

  RefreshCw,

  Sparkles,

  Wrench,

  Zap,

} from "lucide-react";



// ============================================================================

// 类型定义（与 lib/arena-agent.ts & app/api/arena/route.ts 对齐）

// ============================================================================



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

  | { type: "content"; modelKey: string; modelId: string; text: string }

  | {

      type: "done";

      modelKey: string;

      modelId: string;

      toolCallsCount: number;

      durationMs: number;

    }

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

      content: `针对「${prompt.slice(0, 18)}...」的跨周期归因：\n\n1. 生理链条：11-23 起步数从 ~8,000 跃升至 12,800–14,100 步，伴随静息心率从 58 bpm 升至 67 bpm，说明负荷激增导致副交感神经在夜间未能充分占优。\n2. 恢复建议：未来 48 小时将训练降级为低强度散步或拉伸，睡前 3 小时避免高心率活动。`,

    };

  }

  if (lower.includes("gemini")) {

    return {

      delayMs: 180,

      durationMs: 1980,

      tools: [

        { step: 1, toolName: "read_period_evidence", args: '{"period":"week","end":"2026-11-25"}', summary: "发现 11-23 至 11-25 连续 3 天存在负向睡眠偏差" },

        { step: 2, toolName: "get_wellness_range", args: '{"from":"2026-11-15","to":"2026-11-25"}', summary: "返回 11 条每日明细，静息心率与睡眠时长呈显著负相关" },

      ],

      content: `跨指标关联分析：\n• 睡眠压缩：近 3 天平均睡眠仅 5.6 小时（基线 7.15 小时，下降约 22%）。\n• 心率预警：静息心率连续 3 日高于 65 bpm，提示心血管系统处于累积疲劳状态。\n\n优化建议：建议把高步数/跑量安排在 19:00 前完成，并观察次日晨起静息心率是否回落至 60 bpm 以下。`,

    };

  }

  return {

    delayMs: 240,

    durationMs: 2150,

    tools: [

      { step: 1, toolName: "read_period_evidence", args: '{"period":"week","end":"2026-11-25"}', summary: "定位到 11-23/24/25 异常睡眠与心率区间" },

      { step: 2, toolName: "get_wellness_range", args: '{"from":"2026-11-19","to":"2026-11-25"}', summary: "返回 7 天对照组明细，确认负荷突变" },

    ],

    content: `核心结论（结构化归因）：\n1. 直接诱因：近 3 日日均步数大幅高于前期基线，且静息心率同步抬升 +7~9 bpm，睡眠结构受到明显挤压。\n2. 下一步行动清单：\n• 今明两晚提前 30 分钟上床，减少睡前屏幕暴露。\n• 暂停高强度训练 2 天，待静息心率回落至 59 bpm 附近再恢复强度。`,

  };

}



// ============================================================================

// 主组件：支持【真实后端模式】与【静态 Demo 兜底模式（GitHub Pages 可直接交互）】

// ============================================================================



export function ArenaPanel({ forceDemo }: { forceDemo?: boolean } = {}) {

  const [activeTab, setActiveTab] = useState<"api" | "subagent">("api");

  const [isDemoMode, setIsDemoMode] = useState&lt;boolean&gt;(Boolean(forceDemo));

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



  // 窗口二（零 API 额度 Sub-Agent 异步中转）状态

  const [evidenceText, setEvidenceText] = useState("");

  const [loadingEvidence, setLoadingEvidence] = useState(false);

  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  const [subReplies, setSubReplies] = useState({

    gpt: "",

    claude: "",

    gemini: "",

  });



  const clearDemoTimers = () => {

    demoTimersRef.current.forEach((id) => window.clearTimeout(id));

    demoTimersRef.current = [];

  };



  useEffect(() => {

    try {

      const savedKey = localStorage.getItem("health_arena_openrouter_key");

      if (savedKey) setApiKey(savedKey);

    } catch {

      // ignore storage errors

    }



    if (forceDemo) {

      setIsDemoMode(true);

      return;

    }



    fetch("/api/arena")

      .then(async (res) => {

        if (!res.ok) throw new Error("No backend");

        return res.json();

      })

      .then((data) => {

        setIsDemoMode(false);

        if (data?.catalog?.length) {

          setCatalog(data.catalog);

        }

        if (data?.defaultModels?.length === 3) {

          setColumns(

            createInitialColumns(

              data.defaultModels.map((m: ArenaModelConfig) => m.modelId)

            )

          );

        }

      })

      .catch(() => {

        // 静态部署（如 GitHub Pages docs/）检测不到 /api/arena 时自动切换为 Demo 模式

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

      if (val.trim()) {

        localStorage.setItem("health_arena_openrouter_key", val.trim());

      } else {

        localStorage.removeItem("health_arena_openrouter_key");

      }

    } catch {

      // ignore

    }

  };



  const getEffectiveModelId = (col: ColumnState) =>

    col.selectedModelId === "__custom__"

      ? col.customModelId.trim()

      : col.selectedModelId;



  const updateColumnByIndex = (

    idx: number,

    updater: (prev: ColumnState) => ColumnState

  ) => {

    setColumns((prev) => prev.map((col, i) => (i === idx ? updater(col) : col)));

  };



  const updateColumnByModelId = (

    modelId: string,

    updater: (prev: ColumnState) => ColumnState

  ) => {

    setColumns((prev) =>

      prev.map((col) =>

        getEffectiveModelId(col) === modelId ? updater(col) : col

      )

    );

  };



  // 纯前端 Demo 并发模拟（用于 docs/ 公开展示）

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

            tools: [

              ...c.tools,

              { step: tool.step, toolName: tool.toolName, args: tool.args },

            ],

          }));

        }, elapsed);

        demoTimersRef.current.push(t1);

        elapsed += 350;



        const t2 = window.setTimeout(() => {

          updateColumnByIndex(idx, (c) => ({

            ...c,

            tools: c.tools.map((item, tIdx) =>

              tIdx === c.tools.length - 1

                ? { ...item, ok: true, summary: tool.summary }

                : item

            ),

          }));

        }, elapsed);

        demoTimersRef.current.push(t2);

        elapsed += 300;

      });



      const tWrite = window.setTimeout(() => {

        updateColumnByIndex(idx, (c) => ({

          ...c,

          status: "writing",

        }));

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

        if (finished === modelIds.length) {

          setIsRunning(false);

        }

      }, elapsed);

      demoTimersRef.current.push(tDone);

    });

  };



  // 窗口一：并发调用 /api/arena SSE（或自动降级为 Demo 演示）

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

        throw new Error(errJson.error || `请求失败 (${res.status})`);

      }



      if (!res.body) {

        throw new Error("服务端未返回流式响应");

      }



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

              updateColumnByModelId(ev.modelId, (c) => ({

                ...c,

                status: ev.status,

              }));

            } else if (ev.type === "tool_call") {

              updateColumnByModelId(ev.modelId, (c) => ({

                ...c,

                tools: [

                  ...c.tools,

                  { step: ev.step, toolName: ev.toolName, args: ev.args },

                ],

              }));

            } else if (ev.type === "tool_result") {

              updateColumnByModelId(ev.modelId, (c) => ({

                ...c,

                tools: c.tools.map((t, idx) =>

                  idx === c.tools.length - 1

                    ? { ...t, ok: ev.ok, summary: ev.summary }

                    : t

                ),

              }));

            } else if (ev.type === "content") {

              updateColumnByModelId(ev.modelId, (c) => ({

                ...c,

                content: ev.text,

              }));

            } else if (ev.type === "done") {

              updateColumnByModelId(ev.modelId, (c) => ({

                ...c,

                status: "done",

                toolCallsCount: ev.toolCallsCount,

                durationMs: ev.durationMs,

              }));

            } else if (ev.type === "error") {

              updateColumnByModelId(ev.modelId, (c) => ({

                ...c,

                status: "error",

                error: ev.message,

              }));

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



  // 窗口二：拉取真实 /api/trends?range=14d，或在 Demo 模式下自动使用示例证据包

  const handleBuildEvidence = async () => {

    setLoadingEvidence(true);

    setCopyStatus(null);

    try {

      let payload = DEMO_EVIDENCE_SAMPLE;

      if (!isDemoMode) {

        const res = await fetch("/api/trends?range=14d");

        if (res.ok) {

          payload = await res.json();

        }

      }

      const recentPoints = Array.isArray(payload?.points)

        ? payload.points.slice(-7)

        : [];

      const deviations = Array.isArray(payload?.deviations)

        ? payload.deviations

        : [];



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



  return (

    &lt;section className=&quot;space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6&quot;&gt;

      {/* 顶部标题与双窗口切换 */}

      &lt;div className=&quot;flex flex-wrap items-center justify-between gap-3&quot;&gt;

        &lt;div className=&quot;flex flex-wrap items-center gap-2&quot;&gt;

          &lt;span className=&quot;inline-flex items-center gap-1 rounded-md bg-blue-600 px-2 py-0.5 text-xs font-medium text-white&quot;&gt;

            &lt;Sparkles className=&quot;h-3.5 w-3.5&quot; /&gt;

            Agent 层

          &lt;/span&gt;

          &lt;h2 className=&quot;text-base font-semibold text-slate-900&quot;&gt;

            双模式多模型分析工作台

          &lt;/h2&gt;

          {isDemoMode && (

            &lt;span className=&quot;rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-amber-600/20&quot;&gt;

              Demo 演示模式（未检测到后端接口）

            &lt;/span&gt;

          )}

        &lt;/div&gt;



        <div className="flex flex-wrap items-center gap-2 text-xs">

          <div className="flex items-center rounded-xl border border-slate-200 bg-slate-100 p-0.5">

            <button

              type="button"

              onClick={() => setActiveTab("api")}

              className={`rounded-lg px-3 py-1.5 font-medium transition ${

                activeTab === "api"

                  ? "bg-white text-slate-900 shadow-2xs"

                  : "text-slate-500 hover:text-slate-800"

              }`}

            >

              窗口一：API 并发分析

            </button>

            <button

              type="button"

              onClick={() => {

                setActiveTab("subagent");

                if (!evidenceText) handleBuildEvidence();

              }}

              className={`rounded-lg px-3 py-1.5 font-medium transition ${

                activeTab === "subagent"

                  ? "bg-white text-slate-900 shadow-2xs"

                  : "text-slate-500 hover:text-slate-800"

              }`}

            >

              窗口二：Sub-Agent 零额度异步 (Beta)

            </button>

          </div>



          {activeTab === "api" && (

            <>

              <button

                type="button"

                onClick={() => setShowToolLogs((v) => !v)}

                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-slate-600 hover:bg-slate-50"

              >

                {showToolLogs ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}

                {showToolLogs ? "隐藏轨迹" : "显示轨迹"}

              </button>



              {!isDemoMode && (

                <button

                  type="button"

                  onClick={() => setShowKeyBox((v) => !v)}

                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-slate-600 hover:bg-slate-50"

                >

                  <KeyRound className="h-3.5 w-3.5" />

                  OpenRouter Key

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

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">

              <label className="mb-1.5 block font-medium text-slate-700">

                OpenRouter API Key（若服务端已配置环境变量 OPENROUTER_API_KEY，此处可留空）

              </label>

              <input

                type="password"

                value={apiKey}

                onChange={(e) => handleSaveKey(e.target.value)}

                placeholder="sk-or-v1-..."

                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-none"

              />

            </div>

          )}



          <div className="space-y-2.5">

            <div className="flex flex-col gap-2 sm:flex-row">

              <input

                type="text"

                value={prompt}

                onChange={(e) => setPrompt(e.target.value)}

                onKeyDown={(e) => {

                  if (e.key === "Enter" && !isRunning) handleRunArena();

                }}

                placeholder="输入健康分析问题，三个模型将各自调用工具交叉验证..."

                className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none"

              />

              <button

                type="button"

                disabled={isRunning}

                onClick={() => handleRunArena()}

                className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"

              >

                {isRunning ? (

                  <Loader2 className="h-4 w-4 animate-spin" />

                ) : (

                  <Zap className="h-4 w-4" />

                )}

                {isRunning ? "并发推理中..." : "并发分析"}

              </button>

            </div>



            <div className="flex flex-wrap items-center gap-1.5">

              <span className="text-xs text-slate-400">快捷提问：</span>

              {PRESET_PROMPTS.map((item) => (

                <button

                  key={item}

                  type="button"

                  disabled={isRunning}

                  onClick={() => {

                    setPrompt(item);

                    handleRunArena(item);

                  }}

                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-50"

                >

                  {item}

                </button>

              ))}

            </div>



            {globalError && (

              <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">

                <AlertCircle className="h-4 w-4 shrink-0" />

                <span>{globalError}</span>

              </div>

            )}

          </div>



          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">

            {columns.map((col, idx) => (

              <article

                key={idx}

                className="flex flex-col rounded-2xl border border-slate-200 bg-white shadow-2xs"

              >

                <div className="space-y-2 border-b border-slate-100 p-3.5">

                  <div className="flex items-center justify-between gap-2">

                    <select

                      disabled={isRunning}

                      value={col.selectedModelId}

                      onChange={(e) => {

                        const val = e.target.value;

                        setColumns((prev) =>

                          prev.map((c, i) =>

                            i === idx ? { ...c, selectedModelId: val } : c

                          )

                        );

                      }}

                      className="max-w-[190px] rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-800 focus:outline-none"

                    >

                      {catalog.map((m) => (

                        <option key={m.modelId} value={m.modelId}>

                          {m.label}

                        </option>

                      ))}

                      <option value="__custom__">自定义 Model ID...</option>

                    </select>



                    <StatusBadge status={col.status} />

                  </div>



                  {col.selectedModelId === "__custom__" && (

                    <input

                      type="text"

                      value={col.customModelId}

                      onChange={(e) => {

                        const val = e.target.value;

                        setColumns((prev) =>

                          prev.map((c, i) =>

                            i === idx ? { ...c, customModelId: val } : c

                          )

                        );

                      }}

                      placeholder="例如 openai/gpt-6.2-astra-pro"

                      className="w-full rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-700 focus:border-blue-500 focus:outline-none"

                    />

                  )}

                </div>



                {showToolLogs && col.tools.length > 0 && (

                  <div className="space-y-1.5 border-b border-slate-100 bg-slate-50/70 p-3 text-xs">

                    {col.tools.map((t, tIdx) => (

                      <div

                        key={tIdx}

                        className="rounded-lg border border-slate-200 bg-white p-2"

                      >

                        <div className="flex items-center gap-1.5 font-mono text-[11px] font-medium text-blue-700">

                          <Wrench className="h-3 w-3 shrink-0" />

                          <span className="truncate">

                            #{t.step} {t.toolName}({t.args})

                          </span>

                        </div>

                        {t.summary && (

                          <div className="mt-1 text-[11px] text-slate-500">

                            ↳ {t.summary}

                          </div>

                        )}

                      </div>

                    ))}

                  </div>

                )}



                <div className="min-h-[200px] flex-1 p-4 text-sm leading-relaxed text-slate-700">

                  {col.error ? (

                    <p className="text-xs text-rose-600">调用失败：{col.error}</p>

                  ) : col.content ? (

                    <p className="whitespace-pre-line">{col.content}</p>

                  ) : (

                    <p className="text-xs text-slate-400">

                      {col.status === "idle"

                        ? "点击“并发分析”后，模型将按需调用工具并在此输出结论。"

                        : "正在分析你的健康数据..."}

                    </p>

                  )}

                </div>



                <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400">

                  <span>工具调用: {col.toolCallsCount} 次</span>

                  <span>

                    耗时:{" "}

                    {col.durationMs !== null

                      ? `${(col.durationMs / 1000).toFixed(2)}s`

                      : "--"}

                  </span>

                </div>

              </article>

            ))}

          </div>

        </div>

      ) : (

        /* 窗口二：Sub-Agent 零 API 额度异步中转模式 (Beta) */

        <div className="space-y-4">

          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/70 px-3.5 py-2.5 text-xs leading-relaxed text-amber-900">

            <Layers className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />

            <span>

              <strong>零 API 额度异步模式（Beta）：</strong>

              当你没有购买 OpenRouter / 官方 API 额度时，可一键把最近 7–14 天数据打包成结构化证据，异步丢进你已订阅的 ChatGPT Plus / Claude Pro / Gemini 网页版，再把三家回复贴回下方同屏对比。

            </span>

          </div>



          <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/70 p-4">

            <div className="flex flex-wrap items-center justify-between gap-2">

              <span className="text-xs font-semibold text-slate-800">

                第一步：生成结构化健康证据包（{isDemoMode ? "Demo 示例数据" : "调用本地 /api/trends"}，零大模型费用）

              </span>

              <div className="flex items-center gap-2">

                <button

                  type="button"

                  disabled={loadingEvidence}

                  onClick={handleBuildEvidence}

                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"

                >

                  <RefreshCw className={`h-3.5 w-3.5 ${loadingEvidence ? "animate-spin" : ""}`} />

                  刷新证据包

                </button>

                <button

                  type="button"

                  onClick={handleCopyEvidence}

                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"

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

              className="w-full rounded-xl border border-slate-200 bg-white p-3 font-mono text-xs leading-relaxed text-slate-700 focus:outline-none"

            />

            {copyStatus && (

              <p className="text-xs font-medium text-emerald-700">{copyStatus}</p>

            )}

          </div>



          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">

            {[

              { key: "gpt" as const, title: "ChatGPT 网页端回复", tag: "Plus 订阅" },

              { key: "claude" as const, title: "Claude 网页端回复", tag: "Pro 订阅" },

              { key: "gemini" as const, title: "Gemini / DeepSeek 回复", tag: "网页订阅/免费" },

            ].map((item) => (

              <div

                key={item.key}

                className="space-y-2 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs"

              >

                <div className="flex items-center justify-between text-xs">

                  <span className="font-semibold text-slate-900">{item.title}</span>

                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">

                    {item.tag}

                  </span>

                </div>

                <textarea

                  rows={6}

                  value={subReplies[item.key]}

                  onChange={(e) =>

                    setSubReplies((prev) => ({

                      ...prev,

                      [item.key]: e.target.value,

                    }))

                  }

                  placeholder={`将 ${item.title.replace("回复", "")} 的分析结果粘贴到此处对比...`}

                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 focus:border-blue-500 focus:bg-white focus:outline-none"

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



function StatusBadge({ status }: { status: ColumnStatus }) {

  switch (status) {

    case "thinking":

    case "calling_tools":

    case "writing":

      return (

        &lt;span className=&quot;inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700&quot;&gt;

          &lt;Loader2 className=&quot;h-3 w-3 animate-spin&quot; /&gt;

          {status === "calling_tools"

            ? "调用工具中"

            : status === "writing"

              ? "生成结论中"

              : "思考中"}

        &lt;/span&gt;

      );

    case "done":

      return (

        &lt;span className=&quot;inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700&quot;&gt;

          &lt;CheckCircle2 className=&quot;h-3 w-3&quot; /&gt;

          已完成

        &lt;/span&gt;

      );

    case "error":

      return (

        &lt;span className=&quot;inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700&quot;&gt;

          &lt;AlertCircle className=&quot;h-3 w-3&quot; /&gt;

          异常

        &lt;/span&gt;

      );

    default:

      return (

        &lt;span className=&quot;rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500&quot;&gt;

          待命

        &lt;/span&gt;

      );

  }

}
