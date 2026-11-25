# 生活与健康：模块与替换点

| 模块 | 入口 | 复用方式 |
| --- | --- | --- |
| 登录 | `features/auth/sign-in-card.tsx` | 只提供登录界面。传入自己身份服务生成的授权链接；`features/auth/chatgpt.ts` 读取可信身份，默认由 worker/index.ts 验证所有者身份后注入。 |
| 佳明数据 | `features/garmin/client.ts` | 独立对接佳明个人 API；`sync.ts` 负责编排、回补和本网站的 D1 写入。 |
| 其他健康数据源 | `features/providers/feeds.ts`、`service.ts` | 读取服务商协议、校验单位并映射为每日记录。配置方法见 README。 |
| 趋势图 | `features/trends/panel.tsx` | 给 `load(range, signal)` 传入数据加载器即可。数据接口声明在 `model.ts`；不要求使用佳明或 OpenAI。 |
| 分析 | `features/analysis/compare.ts`、`review.ts` | 基线比较是纯函数；AI 可换为符合 `ReviewGenerator` 的函数。当前 OpenAI 适配器仅接收汇总。 |
| 演示 | `features/demo/example-data.ts` | 确定性的四年合成数据，既不读数据库，也不调用外部 API。 |

`app/` 负责把页面、权限、存储适配器和 HTTP 接口接在一起。图表和分析的接口不直接依赖 D1 或会话；实例在 `lib/trend-query.ts` 用 D1 实现。不同托管环境可替换身份和存储适配器。

当前网站的数据表和写入接口假设 **网站仅所有者可访问**。复制到公开或多人部署时，应更换认证适配器并为每行实现用户级授权；不能把 Sites 注入的身份头当作普通公网站点可自行信任的请求头。生产 API 密钥、数据库、部署标识和个人资料不应进入可分享模块包。

## 数据和显示

同步以日期和类型去重写入，记录表不按显示周期删除。首次手动同步重查近 90 天；佳明未提供的日期保留空白。短区间按日，半年按周，按年和全部历史按月汇总；总平均按实际有记录的天数加权。HRV 使用佳明夜间平均值，不把缺测当作零或用静息心率替代。佳明适配器连接佳明官方域名，Intervals.icu 适配器使用其官方 API；Daily JSON 的 HTTPS 地址由服务器部署者配置。

`features/analysis/deviations.ts` 根据此前 28 个日历日中至少 14 条有效记录计算个人中位数和绝对中位差（MAD）。超过灵敏度下限和 3 × 1.4826 × MAD 时标记。周、月视图保留偏离日期。阈值用于浏览记录，没有临床诊断含义。

聊天的定时回顾使用 `read_period_evidence` 和 `save_period_review`。每周读取最近 30 天，月度和年度读取完整自然周期。按类型和截止日期保存，同一任务重跑更新同一个报告。网站读取已保存报告，无需 OpenAI API 余额。
