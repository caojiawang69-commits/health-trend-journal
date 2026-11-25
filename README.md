# Health Trend Journal

用个人基线观察睡眠、心率和活动量怎样随时间变化。趋势页支持近 30 天、90 天、半年、一年和全部历史。周均和月均曲线可以展开到触发偏离标记的具体日期。

**[打开交互演示](https://caojiawang69-commits.github.io/health-trend-journal/)** · [模块说明](MODULES.md) · [MIT 许可证](LICENSE)

演示通过确定性函数生成四年数据。可以切换「睡眠与恢复」和「活动与消耗」，在橙色圆点对应的日期查看测量值、此前 28 天中位数和样本数。打开演示无需账户。

## 启动演示

使用 Node.js 22.13 或更高版本，在仓库根目录运行：

```sh
npm ci
npm run dev
```

打开终端显示的本机地址。运行 `npm run build:demo` 可在 `docs/` 生成独立的静态网站，适合 GitHub Pages。

## 私人实例

完整应用包含加密数据源连接、历史回补和定时同步、长期趋势、偏离标注、训练与饮食计划、餐前餐后照片、营养估算和周期回顾。每个实例供一个人使用。浏览器以用户名 `owner` 和实例密码登录，照片保存在 R2，每日记录保存在 D1。公开演示独立构建，浏览器只下载静态资源。

1. 安装依赖。在根目录创建已被 Git 忽略的 `.dev.vars`，设置 `OWNER_PASSWORD` 和 `GARMIN_CONNECTION_ENCRYPTION_KEY`。每次执行 `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"` 可生成一个值，两项请分别生成。加密密钥为 43 位 Base64URL，供所有适配器使用。保留密钥以读取已保存的连接。
2. 运行 `npm run db:local`、`npm run build` 和 `npm start`。打开终端显示的地址，登录后在「连接与设置」选择来源，粘贴该来源签发的密钥。数据按来源、日期和单位验证。一个数据库绑定一个来源，其他用户或来源使用独立实例。
3. 部署到自己的 Cloudflare 账户时，创建自己的 D1 数据库和 R2 桶，更新 `wrangler.jsonc` 的资源标识。使用 Wrangler 的 secret 命令保存生产密钥，应用 D1 的远端迁移，重新构建后部署 `dist/server/wrangler.json`。本地 `.dev.vars` 只用于开发。定时入口默认在北京时间 23:00 运行，并安排重试。
4. 需要聊天回顾时，设置独立随机值 `SERVICE_TOKEN`，由你授权的客户端使用 Bearer 凭据访问私有 `/mcp`，调用 `read_period_evidence` 和 `save_period_review`。周、月、年的任务在自己的调度器中设置。站内 AI 照片估算和文字反馈可选配 `OPENAI_API_KEY`。导入、趋势及个人基线均可独立运行。

## 数据源兼容性

| 来源 | 认证和数据 |
| --- | --- |
| Garmin Connect | 个人 API 密钥在佳明官方服务换取短期令牌。读取可用的每日摘要、睡眠、心率和夜间 HRV。 |
| Intervals.icu | 个人 API Key 调用官方 wellness 接口。映射日期、步数、静息心率和睡眠秒数。其通用 HRV 字段缺少夜间采样说明，因此留空。[官方 API 示例](https://forum.intervals.icu/t/intervals-icu-api-integration-cookbook/80090) |
| Daily JSON | 部署者通过 `HEALTH_FEED_URL` 配置自己的固定 HTTPS 服务，设置页会显示该选项。用户输入此服务签发的 Bearer 密钥。 |

Daily JSON 接口接收 `from` 和 `to` 两个日期（含首尾），返回每天最多一个对象。下面是**虚构的格式示例**：

```json
[{"date":"2024-04-10","steps":6420,"restingBpm":58,"sleepSeconds":26100,"nightlyHrvMs":49}]
```

缺测字段可省略或填 null。夜间 HRV 单位为毫秒，睡眠为秒。服务端固定目标地址，拒绝转发重定向。其他采用 OAuth、不同字段或不同分页规则的平台，需要在 `features/providers/` 增加适配器。只有密钥无法描述这些协议。可设置 `HEALTH_PROVIDER` 将部署限定为 `garmin`、`intervals` 或 `daily-json`。

## 验证

```sh
npm run typecheck
npm run build
npm test
```

测试使用合成数据、临时数据库及模拟的上游响应，覆盖授权、凭据加密保存、三类来源同步和趋势读取。图中的偏离阈值用于回看个人记录，不作医学诊断。
