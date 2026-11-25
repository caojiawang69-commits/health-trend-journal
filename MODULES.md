# 模块使用手册

想在自己的项目里用其中一部分？从下表选一个目标。代码按源码复用，示例的相对导入路径以仓库根目录为起点。要启动完整应用，请看 [安装与部署](README.md)。

| 我想做什么 | 从哪里开始 | 需要什么 |
| --- | --- | --- |
| 复用登录卡片，点击后进入我自己的登录流程 | [登录组件](#login-ui) | React、一个登录地址 |
| 判断哪些请求能读取或写入私人记录 | [请求鉴权](#request-auth) | Worker、所有者密码或服务令牌 |
| 加密保存用户输入的第三方密钥 | [密钥加密](#encryption) | 服务端 Web Crypto、独立的加密密钥 |
| 读取佳明数据，或者接入自己的健康 API | [API 客户端](#api-client) | 服务商凭据、服务端 `fetch` |
| 把自己的数据画成趋势图 | [图表与数据结构](#chart-data) | React、Recharts、Lucide、一个数据加载函数 |
| 换成自己的异常算法，保留原图表 | [分析与回顾](#analysis) | 每日观测值、符合图表接口的分析结果 |

<a id="login-ui"></a>

## 登录组件：让用户从哪里进入

复制 [SignInCard](features/auth/sign-in-card.tsx) 到 React 项目，把 `href` 指向你已有的登录路由。`href` 是唯一必填参数，`title`、`description`、`button` 可以改成自己的文案。它输出一张卡片和一个链接；点击后的身份验证由目标路由负责。

```tsx
import SignInCard from './features/auth/sign-in-card';

export function LoginPage() {
  return <SignInCard href="/auth/start" title="训练日记"
    description="登录后查看自己的训练记录。" button="用我的账号登录" />;
}
```

把示例中的 `/auth/start` 换成你的地址。卡片使用 `card`、`sign-in-card`、`muted` 和 `primary` 类；可从 [项目样式](app/globals.css) 取对应规则，也可以沿用你自己的样式。[项目中的调用示例](app/login/page.tsx)

<a id="request-auth"></a>

## 请求鉴权：谁能读写私人实例

鉴权在 [Worker 的 fetch 入口](worker/index.ts) 执行。这个实例按单一所有者设计。公开静态演示独立运行，体验演示无需配置密码。

| 调用者 | 提供什么 | 成功后可以做什么 |
| --- | --- | --- |
| 浏览器用户 | HTTP Basic，用户名 `owner`，密码取自 `OWNER_PASSWORD` | 进入私人页面，按路由读写数据。浏览器写请求还会校验 `Origin`。 |
| 自动化客户端 | `Authorization: Bearer <SERVICE_TOKEN>` | 调用 `/mcp` 或 `/api/service`，例如读取周期证据、保存回顾。 |

Worker 对等长凭据使用恒定时间比较，验证后移除外部传来的身份头，注入实例所有者身份，再交给应用。[应用层身份读取](features/auth/chatgpt.ts) 使用该身份。凭据错误返回 `401`，浏览器写请求来源不符返回 `403`，对应服务端凭据未设置或不足 24 个字符返回 `503`。

**换成自己的登录体系**：保留页面组件，在服务端入口验证自己的会话，并同步调整应用层读取身份的方式。若要在一个实例中支持多个用户，还需要为数据库记录和照片增加所有者标识，并在读写时按用户授权。

<a id="encryption"></a>

## 密钥加密：怎样保存第三方 API Key

`OWNER_PASSWORD` 用于登录网站，服务商签发的 API Key 用于读取健康数据。第三种凭据 `GARMIN_CONNECTION_ENCRYPTION_KEY` 由部署者保管，用来加密数据库里保存的 API Key。变量沿用佳明命名，三个数据源都使用它。

[加解密模块](features/garmin/credential.ts) 可单文件复用。传入一个 32 字节、无填充 Base64URL 编码的服务端密钥（43 个字符）。`sealGarminKey` 每次生成新的 12 字节随机 IV，使用 AES-256-GCM 加密，返回可存储的字符串。`unsealGarminKey` 使用同一密钥还原原值。

```ts
import { sealGarminKey, unsealGarminKey } from './features/garmin/credential';

export async function checkRoundTrip(apiKey: string, wrappingKey: string) {
  const ciphertext = await sealGarminKey(apiKey, wrappingKey);
  return (await unsealGarminKey(ciphertext, wrappingKey)) === apiKey;
}
```

在后端先验证服务商接受这把 API Key，再保存密文；同步时才解密。加密密钥保存在运行环境的 secret 中，和数据库分开保管。更换加密密钥前，需要用旧密钥解密并重新加密现有连接，或请用户重新连接。[实际保存流程](features/providers/service.ts)

<a id="api-client"></a>

## API 客户端：怎样读取自己的数据源

**佳明**：[客户端](features/garmin/client.ts) 可以单独复制。先用个人密钥换取访问令牌，再按日期调用 `summaries`、`sleep`、`hrv` 或 `heart`。返回值是佳明的响应；保存到什么数据库由调用方决定。

```ts
import { exchangePersonalKey, garminClient } from './features/garmin/client';

export async function readGarminSleep(apiKey: string, from: string, to: string) {
  const token = await exchangePersonalKey(apiKey);
  if (!token) throw new Error('佳明未接受个人密钥');
  return garminClient(token).sleep(from, to);
}
```

**Intervals.icu 或 Daily JSON**：复用 [readFeed](features/providers/feeds.ts)。它返回 `DailyReading[]`；每项必须有 `date`，可选字段是 `steps`（步）、`restingBpm`（次/分）、`sleepSeconds`（秒）、`nightlyHrvMs`（毫秒）。缺测项会省略。只有明确是夜间测量的 HRV 才能填入 `nightlyHrvMs`。

```ts
import { readFeed } from './features/providers/feeds';

export function readMyFeed(apiKey: string, from: string, to: string, url: string) {
  // url 来自部署者的 HEALTH_FEED_URL，apiKey 由该服务签发。
  return readFeed('daily-json', apiKey, from, to, url);
}
```

若你控制上游服务，按 [Daily JSON 格式](README.md#数据源兼容性) 返回每日记录即可。新增采用其他协议的服务商时，先实现其认证、日期查询、分页和单位转换，再在 [来源选择与同步](features/providers/service.ts) 注册，并更新 [连接表单](app/garmin-connection.tsx) 的选项文案。在个人实例里，每个数据库绑定一个数据源。[已有适配器测试](tests/providers.mjs)

<a id="chart-data"></a>

## 图表与数据结构：怎样画自己的数据

趋势面板的入口是 [TrendPanel](features/trends/panel.tsx)。必填参数 `load(range, signal)` 返回 `Promise<TrendPayload>`。切换区间时面板会重新调用它，并通过 `AbortSignal` 取消上一请求。`loadReview` 是可选参数，用来加载文字回顾。

下面的组件可以原样接入本项目的私人趋势接口；换成自己的后端时，让接口返回相同结构即可。

```tsx
import TrendPanel from './features/trends/panel';
import type { TrendPayload, TrendRange } from './features/trends/model';

async function load(range: TrendRange, signal: AbortSignal): Promise<TrendPayload> {
  const response = await fetch('/api/trends?range=' + range, { signal });
  if (!response.ok) throw new Error('趋势数据读取失败');
  return response.json();
}

export function TrendsPage() {
  return <TrendPanel load={load} />;
}
```

**从一条记录理解接口**：假设某天的 `DailyReading` 有 `sleepSeconds = 25200`，查询层会把它换算成图表使用的 `sleep = 7`（小时）、`sleepCount = 1`。同一天没测 HRV，就保留 `hrv = null`、`hrvCount = 0`。手表确实记录了零步时，可写 `steps = 0`、`stepsCount = 1`。构造新点时可用 `emptyTrendPoint(date)` 初始化全部字段，再填实测值、计数和 `observed`。[完整类型和辅助函数](features/trends/model.ts) · [单位与标签](features/trends/metrics.ts)

| `TrendPayload` 字段 | 应当填什么 |
| --- | --- |
| `from`、`today`、`days`、`observed` | 起始日、排他的截止日、区间日历天数、至少有一项有效观测的天数。日期格式为 `YYYY-MM-DD`。 |
| `scale`、`points` | 粒度 `day/week/month` 和按日期排列的数据点。周、月点保存该时段日均值，每项 `Count` 保存对应的有效天数。空档保留在时间轴上。 |
| `deviations` | `flags` 是带日期的偏离记录；`assessed` 记录每个受跟踪指标有多少天够资格比较；`lastObserved` 是最近有观测的日期或 `null`。 |
| `comparison` | 两个 28 天窗口的起始日 `recentFrom`、`baselineFrom`，以及逐指标的比较结果 `changes`。 |

要把面板移到另一个 React 项目，复制 [trends 目录](features/trends)、[日期工具](lib/calendar.ts)、[回顾类型](features/analysis/period.ts) 和 [偏离类型及实现](features/analysis/deviations.ts)，安装 `recharts` 与 `lucide-react`，并引入或改写 [图表样式](app/globals.css)。要先看一个完整的输入对象，可直接调用 `exampleTrends('30')`。[合成数据生成器](features/demo/example-data.ts) · [公开演示如何使用同一面板](showcase/main.tsx)

<a id="analysis"></a>

## 分析与回顾：怎样替换判断逻辑

- **给图上的某天加标记**：`detectDeviations(points, from)` 接收日级 `TrendPoint[]`。给待展示区间额外传入之前 28 天的记录作基线，每天与此前至少 14 次有效观测比较。输出的每个标记包含 `date`、`metric`、`value`、`median` 和 `samples`。若要换算法，在产生 `deviations` 的地方返回同一结构即可。长区间图表仍能展开到原始日期。[偏离检测](features/analysis/deviations.ts) · [查询层调用位置](lib/trend-query.ts)
- **比较两个时期**：`compareTrend(recent, baseline)` 输出每个指标在两个窗口的平均值、覆盖天数和变化量。面板里的「和自己的平时相比」使用这组结果。[时期比较](features/analysis/compare.ts)
- **生成文字回顾**：内置生成接口用 `reviewEvidence` 整理趋势证据，`ReviewGenerator` 接收证据并异步返回文本。接自己的模型时，在生成路由换掉适配器及其密钥检查。若分析在外部聊天运行，可通过现有 MCP 工具读证据、写回顾。[证据与接口](features/analysis/review.ts) · [生成路由](app/api/trend-review/route.ts) · [聊天工具](app/mcp/route.ts)

## 验证接入

第一次使用可先运行 `npm ci` 和 `npm run dev`。打开静态演示，切换 30 天与一年，展开带橙色标记的指标，可看到同一图表如何呈现不同粒度。接入后端后运行 `npm run typecheck`、`npm run build`、`npm test`。现有测试使用模拟上游和临时数据库，检查访问控制、密文保存、三个数据源的同步与趋势读回。
