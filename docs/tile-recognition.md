# 拍照识牌：调用链、使用与配置说明

日麻和牌结算时，把手牌拍一张照片，由多模态模型识别成牌面并自动填入手牌。本文说明它在哪里用、怎么用、怎么配自定义模型、各环节如何计费与防滥用，以及维护者如何部署与切换模型后端。

## 两条通道

| 通道 | 请求路径 | 谁付费 |
| --- | --- | --- |
| 云端默认 | 小程序 → 微信云函数 `tile-recognizer` → Cloudflare Worker（`https://mahjong-tile.lisang.top`）→ Workers AI `@cf/qwen/qwen3.8-27b` | 项目方 |
| 自定义模型 | 小程序 `wx.request` 直连用户填的 OpenAI 兼容接口 | 用户自己 |

用户在「设置 → 识牌」填了自定义模型就走第二条通道，留空走云端默认。两条通道的请求构造与响应解析共用同一份代码：[`miniprogram/utils/model-protocol.js`](../miniprogram/utils/model-protocol.js)（Worker 由 wrangler 打包时直接引用这份文件，改协议只改这一处）。

**为什么云端默认要经过云函数和自定义域名中转**：小程序正式版只能请求已登记的「request 合法域名」，而合法域名要求 ICP 备案，`*.workers.dev` 无法满足。同时实测腾讯云函数连不上 `*.workers.dev`（连接被重置或超时），所以 Worker 绑定了自有域名 `mahjong-tile.lisang.top`，由云函数在服务端转发——既绕开了小程序的域名限制，又保证了连通性。

## 在哪用

- **日麻和牌结算第 2 步（牌型）**：「📷 拍照识牌」按钮，在「清空」「撤销」同一行。仅当云端可用或已配置自定义模型时显示。
- **设置 → 识牌 Tab**：查看当前使用的模型、配置自定义模型。

设置页的两个按钮：

- **「获取」**：直连 `GET {地址}/models` 拉取模型列表，视觉类模型排在前面，点选即填入「模型」输入框。需要先填地址和 Key。
- **「测试」**：发送一张 32×32 纯红小图给模型，检查连通、鉴权和看图能力。结果显示「可用 · X.Xs」（看懂了是红色）或「已连通 · X.Xs，但可能看不懂图片」。地址、模型名、Key **三项都留空**（或点「恢复默认」清空）时，测试的才是云端默认通道；只清空地址和 Key、留着模型名，会被提示先补全。

## 怎么拍、怎么核对

拍照建议：

- **拍齐整手 14–18 张**（含荣和/自摸那张），牌面完整入镜，不要互相叠压遮挡。
- **光线均匀、避免反光**：哑光桌面优于亮面玻璃，避免顶灯直射产生反光斑。
- **正对俯拍**：镜头正对牌面，避免斜角导致字牌辨认不清。
- **和了的那张单独放开**（或横置）：模型会尝试把它填入 `winTile`；分不开也没关系，之后手动在「最终和牌张」里点选即可。

识别成功后，识别结果会**整体替换**当前手牌，并弹窗提示张数（含赤五时注明「暂不自动计入赤宝牌」——赤五 `0m/0p/0s` 会折算成普通 `5m/5p/5s`；第 2 步选牌键盘也没有赤五牌面，需要计赤宝牌时请在第 3 步手动调高「翻数」）。**识别不完全可靠，填入后务必逐张核对**；点「撤销」可一键恢复识别前的整手手牌与和牌张。

识别失败（或低置信度）只弹窗提示，**不会改动当前手牌**。校验规则（[`miniprogram/utils/tile-recognition.js`](../miniprogram/utils/tile-recognition.js)）：

| 规则 | 含义 |
| --- | --- |
| 14–18 张 | 和牌手牌（含杠）的张数范围，识别到 19 张以上说明有牌重叠或误识别 |
| 同种 ≤ 4 张 | 同一种牌最多 4 张，出现 5 张说明有误识别 |
| 置信度 ≥ 0.6 | 模型自报的整体把握，低于 60% 会提示重拍或手动选牌 |
| 合法牌 ID | 只接受 `1m-9m`、`1p-9p`、`1s-9s`、`1z-7z`（赤五 `0m/0p/0s`） |

### 常见提示与错误码

| 提示 | 原因与处理 |
| --- | --- |
| 识别到 N 张牌，和牌应为 14-18 张 | 有牌漏拍/遮挡或重复识别，重拍并铺开 |
| 识别把握较低（XX%） | 光线或角度问题，重拍或手动选牌 |
| 该地址不在小程序合法域名中，无法从本机直连 | 正式版未登记该域名，见下文[自定义模型配置](#自定义模型配置) |
| 模型鉴权失败，请检查 API Key | Key 错误或过期 |
| 接口地址或模型名不存在，请检查 | Base URL 或模型名拼写错误 |
| 模型调用太频繁或额度不足 | 限流或额度耗尽，稍后再试 |
| 识牌超时，请重试或手动选牌 | 网络或模型响应慢（自定义通道 30s、云端 20s 超时） |
| 照片太大，请靠近手牌重拍 | 压缩后 base64 仍超过 3MB，靠近拍减少背景 |
| 云端默认模型需要微信云开发环境 | 未配云环境又想用云端默认，可在设置页填自定义模型 |

## 自定义模型配置

「设置 → 识牌」支持任意 OpenAI 兼容的多模态接口。地址、模型名、Key **三项都填**才生效；配置只存手机本地（存储键 `mj_tile_model_v1`），照片和 Key 直接从手机发给该接口，不经过任何云端。

常用厂商示例（模型名以各厂商官网为准）：

| 厂商 | Base URL | 模型名示例 | Key 获取 |
| --- | --- | --- | --- |
| 阿里云百炼（通义千问） | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen-vl-max`、`qwen-vl-plus`、`qwen3-vl-flash` | 百炼控制台「API-KEY」页 |
| 智谱 AI | `https://open.bigmodel.cn/api/paas/v4` | `glm-4v-flash`（免费）、`glm-4v-plus` | open.bigmodel.cn 控制台 |
| OpenAI | `https://api.openai.com/v1` | `gpt-4o`、`gpt-4o-mini` | platform.openai.com |
| 硅基流动 | `https://api.siliconflow.cn/v1` | `Qwen/Qwen2.5-VL-72B-Instruct` | cloud.siliconflow.cn |

填写建议：先填地址和 Key，点「获取」拉模型列表点选；没有列表接口的厂商直接手动填模型名，再点「测试」确认能看图。

**合法域名限制**：小程序正式版只能请求小程序后台「开发管理 → 开发设置 → 服务器域名 → request 合法域名」中登记过的域名，且该域名必须 ICP 备案。未登记的地址会报「该地址不在小程序合法域名中」。想让用户直连某厂商，需要项目方提前登记该厂商域名（如 `dashscope.aliyuncs.com`、`open.bigmodel.cn`）。开发调试时可在微信开发者工具「详情 → 本地设置」勾选「不校验合法域名」临时绕过。

## 收费、单次成本与防滥用方案

> 以下各厂商官方定价与免费额度查询日期均为 **`2026-11-11`**（美元按 `1 USD ≈ 7.2 CNY` 折算，实际账单以各平台控制台为准）。

### 1. 云端默认通道单次全链路成本拆分

一次云端默认识牌依次经过微信云函数、Cloudflare Worker 与 Workers AI 三环：

| 环节 | 套餐与免费/固定配额 | 单次识牌消耗 | 按量折算单次成本 | 千次成本 |
| --- | --- | --- | --- | --- |
| 微信云开发 `tile-recognizer`（128MB 内存，20s 超时） | 基础套餐 ¥19.9/月（含 40,000 资源点，1,000 点 = ¥1；固定配额含 10 万 GBs、20 万次调用、2GB 外网出流量） | · 调用 1 次（¥0.5/万次）<br>· 资源 `0.125GB × 3~5s = 0.375~0.625 GBs`（¥0.00011108/GBs）<br>· 外网出流量：向 `mahjong-tile.lisang.top` 发送压缩 JPEG base64（常见 200~600KB，上限 3MB，均值约 400KB，¥0.8/GB） | 调用 ¥0.00005 + 资源 ¥0.00004~¥0.00007 + 出流量 ¥0.00030 ≈ **¥0.0004/次**（出流量占比约 75%，2GB 月配额约够 5,000 次） | **≈ ¥0.40**（1 万次约 ¥4） |
| Cloudflare Worker `mahjong-tile-worker` | **Free**：10 万次请求/天（UTC 00:00 重置），免出站流量费；<br>**Paid**（$5/月）：1,000 万次/月，超额 $0.30/百万次 | 1 次 HTTP 请求 | Free 额度内 **¥0/次**（Paid 超额约 ¥0.000002/次） | **¥0** |
| Cloudflare Workers AI `@cf/qwen/qwen3.8-27b`（已关闭思考） | Free 与 Paid 均享每天 **10,000 Neurons** 免费（UTC 00:00 重置）；超额需升级 Workers Paid，单价 **$0.011 / 1,000 Neurons** | 实测识牌约 **37 Neurons/次**（「测试」纯红小图约 **4 Neurons/次**），免费额度约够 **250~270 次/天** | 免费额度内 **¥0/次**；<br>超额 `$0.000407` ≈ **¥0.0029/次** | 额度内 **¥0**；<br>超额 **≈ ¥2.93** |
| **云端默认全链路合计** | — | — | **额度内 ≈ ¥0.0004/次**<br>**超额后 ≈ ¥0.0033/次** | **¥0.40 ~ ¥3.33** |

### 2. 超出免费额度的行为

- **未升级 Workers Paid（当前 Free 套餐）**：每日用满 10,000 Neurons 即触发**硬限流，不会自动扣费**。此时 `env.AI.run` 抛出含 `4006 / neuron / quota` 的错误，`apps/tile-worker/src/index.js` 将其捕获并映射为 HTTP 429 `{ ok: false, code: 'MODEL_RATE_LIMITED' }`，经云函数透传后前端弹窗提示「模型调用太频繁或额度不足，请稍后再试」（不改动当前手牌），次日 **UTC 00:00**（北京时间 08:00）自动恢复。
- **升级 Workers Paid（$5/月）后**：每日首 10,000 Neurons 依然免费；超出部分按 **$0.011 / 1,000 Neurons** 自动按量计费，不再因免费额度耗尽报 429。

### 3. 外部多模态模型价格与单次成本对比表（查询日期：`2026-11-11`）

前端已将照片压缩到 `compressedWidth: 1280`（`quality: 70`），连同识别 Prompt（约 180 Tokens）按单次识牌约 **1,500 输入 Tokens + 80 输出 Tokens** 统一换算：

| 模型 | 官方单价（2026-11-11） | 免费额度 | 单次模型成本 | 千次模型成本 | 含云函数转发总成本（单次） | 适用通道与说明 |
| --- | --- | --- | --- | --- | --- | --- |
| Cloudflare Workers AI `@cf/qwen/qwen3.8-27b` | 超额 $0.011 / 1,000 Neurons（约 37 Neurons/次） | 10,000 Neurons/天（约 250~270 次/天） | **¥0**（额度内）/ **¥0.0029**（超额） | ¥0 / ¥2.93 | **¥0.0004 ~ ¥0.0033** | 当前云端默认后端，零模型 Key 维护成本 |
| 阿里云百炼 `qwen3-vl-flash`（0~32K） | 输入 ¥0.15 / 百万 Tokens，输出 ¥1.5 / 百万 Tokens | 新用户百炼赠送额度（90 天有效） | **≈ ¥0.00035** | ≈ ¥0.35 | **≈ ¥0.00075** | 极低成本备选；适合云端切换或用户自配 |
| 阿里云百炼 `qwen-vl-plus`（北京） | 输入 ¥0.8 / 百万 Tokens，输出 ¥2.0 / 百万 Tokens | 新用户 100 万 Tokens / 90 天 | **≈ ¥0.0014** | ≈ ¥1.36 | **≈ ¥0.0018** | 性价比均衡，国内合法域名直连稳定 |
| 阿里云百炼 `qwen-vl-max`（北京） | 输入 ¥1.6 / 百万 Tokens，输出 ¥4.0 / 百万 Tokens | 新用户百炼赠送额度（90 天有效） | **≈ ¥0.0027** | ≈ ¥2.72 | **≈ ¥0.0031** | Worker 外部接口默认模型名，复杂光照下准确率高 |
| 智谱 `glm-4v-flash` | 输入 / 输出均 **¥0（免费）** | 持续免费（受平台并发限制） | **¥0** | **¥0** | ¥0.0004（若经云函数）/ **¥0（本机直连）** | 适合引导用户在「设置 → 识牌」自填 Key 零成本直连 |
| 智谱 `glm-4v-plus`（含 0111） | 输入 ¥4.0 / 百万 Tokens，输出 ¥4.0 / 百万 Tokens | 新注册赠送体验额度 | **≈ ¥0.0063** | ≈ ¥6.32 | **≈ ¥0.0067** | 精度较高，单价相对偏贵 |
| OpenAI `gpt-4o-mini` / `gpt-4o`（海外参照） | 按官方视觉 Token 计费 | 无常驻免费额度 | **≈ ¥0.002** / **≈ ¥0.03** | ≈ ¥2 / ≈ ¥30 | — | 境外域名无 ICP 备案，正式版小程序无法本机直连，仅作成本参照 |

### 4. 防滥用与按 `openid` 每日限流方案

结论：**对云端默认通道按微信 `OPENID` 限制每人每天（UTC+8）最多 20 次调用，限流计数放在微信云函数 `tile-recognizer` 中执行**（具体开发任务已拆分为独立实现单 [#35](https://github.com/LosLiSang/mahjong-scorer/issues/35)）。自定义模型通道由用户手机直连自有 Key，不经过云端、不限流。

- **为什么限流放在云函数 `tile-recognizer` 而不是 Worker**：
  1. **身份真实不可伪造**：`cloud.getWXContext().OPENID` 由微信服务端直接签发注入；而 Worker 侧只有云函数共用的 `WORKER_TOKEN`，且 Workers KV Free 套餐每天仅有 1,000 次写入额度。
  2. **省下云函数外网出流量**：在云函数向 Worker 转发 200~600KB 图片 base64 **之前**拦截，恶意连点或脚本刷接口不会消耗 `0.8 元/GB` 的云开发外网出流量，也不会消耗下游 Worker 与模型额度。
  3. **复用现有云数据库与定时清理**：新建仅云函数读写的集合 `tile_rate_limits`（文档结构 `{ _id: "${openid}_${YYYY-MM-DD}", count, updatedAt, expiresAt }`，日期按 `UTC+8` 自然日切分，上限由环境变量 `DAILY_LIMIT_PER_USER` 配置、默认 `20`），过期计数直接由现有的 `mahjong-room-cleanup` 每日 03:20 触发器顺带清理。
- **超限提示与引导**：超出当日限额返回错误码 `DAILY_LIMIT_EXCEEDED`，前端提示今日免费识牌次数已用完，并引导用户前往「设置 → 识牌」填写自有或免费 Key（如智谱 `glm-4v-flash`、阿里云百炼）继续使用。

### 5. 用量监控与告警阈值

- **Cloudflare 侧**：
  - `Cloudflare Dashboard → AI → Workers AI`：查看每日 Neurons 消耗曲线与剩余免费额度。
  - `Workers & Pages → mahjong-tile-worker → Metrics / Logs`：查看请求量、延迟以及 `MODEL_RATE_LIMITED`（HTTP 429）占比。
  - `Notifications`：配置 Workers AI 用量与异常错误率告警，在接近每日免费上限（如 80%，即 8,000 Neurons）或升级 Paid 后设置月度预算阈值时邮件提醒。
- **微信云开发侧**：
  - `微信云开发控制台 → 监控告警`：查看 `tile-recognizer` 的调用次数、资源使用量（GBs）和**外网出流量**（重点指标），配置套餐配额 **80% 阈值**微信/邮件告警，防止图片转发流量静默耗尽基础套餐资源点。

### 6. 商业化结论（回应 [#6](https://github.com/LosLiSang/mahjong-scorer/issues/6) 待确认项）

**现阶段不把拍照识牌设为付费功能，也不接入激励视频广告。**

- 单次云端识牌边际成本仅 **¥0.0004 ~ ¥0.0033**（一场半庄通常和牌 8~12 局，整场全用识牌不到 4 分钱），为几厘钱引入小程序虚拟支付（涉及苹果 iOS 虚拟支付规范与商户资质）或牌桌结算中途弹 15~30 秒激励广告，都会严重打断朋友局算分体验。
- 采用**「云端默认免费（每人每日 20 次限额 [#35](https://github.com/LosLiSang/mahjong-scorer/issues/35) + Workers Free 每日 10,000 Neurons 硬顶不扣费兜底）+ 引导重度用户在『设置 → 识牌』自配免费/自有 Key（如 `glm-4v-flash` 或百炼）」**的分层模式，既能把项目方月度成本稳控在云开发基础套餐内，又能无门槛覆盖普通牌局需求。

## 维护者指南

### Cloudflare Worker（`apps/tile-worker`）

- **默认后端**：Workers AI（`ai` 绑定），模型由 Var `WORKERS_AI_MODEL` 指定，默认 `@cf/qwen/qwen3.8-27b`，不需要模型 Key。
- **切换外部模型**：`wrangler secret put MODEL_API_KEY` 设置后即改走 OpenAI 兼容外部接口；接口地址与模型名由 Var `MODEL_BASE_URL`（默认 `https://dashscope.aliyuncs.com/compatible-mode/v1`）与 `MODEL_NAME`（默认 `qwen-vl-max`）指定。删掉该 Secret 即回到 Workers AI。
- **思考模式必须关闭**：识牌是直接看图输出 JSON 的任务，推理类模型若开思考，token 会耗在推理上导致 `content` 为空。Worker 已对 Workers AI 请求统一加 `chat_template_kwargs: { enable_thinking: false }`；换成外部推理模型时注意选非思考版本或关闭思考。
- **共享令牌**：`wrangler secret put WORKER_TOKEN`，与云函数侧 `TILE_WORKER_TOKEN` 一致。
- **部署**：`cd apps/tile-worker && npx wrangler deploy`，同时发布 workers.dev 地址与自定义域名 `mahjong-tile.lisang.top`。
- **接口**：`POST /recognize`、`POST /test`，均要求 `Authorization: Bearer <WORKER_TOKEN>`，失败统一返回 `{ ok: false, code }`。Workers Logs 与 Traces 已开启。
- **免费额度**：Workers 每天 10 万次请求；Workers AI 每天 10,000 neurons，实测一次识牌约 37 neurons、一次测试约 4 neurons，约合每天 250~270 次识牌（详细成本拆分与超额策略见上文[收费、单次成本与防滥用方案](#收费单次成本与防滥用方案)）。

### 微信云函数（`cloudfunctions/tile-recognizer`）

- Worker 地址与令牌放在同目录 `worker.config.json`（格式见 `worker.config.example.json`，已被 git 忽略，只随云函数上传）；也可用环境变量 `TILE_WORKER_URL` / `TILE_WORKER_TOKEN` 覆盖。
- 部署：`node scripts/deploy-functions.js tile-recognizer`。超时（20 秒）等配置来自 `cloudbaserc.json`，`tcb fn deploy` 会一并写入。
- 云函数只转发白名单字段（图片 base64 与 mimeType），不把客户端传来的其他内容带给 Worker；图片只在调用内存中转发，不落盘。

### 协议唯一真源

请求构造（`POST {baseUrl}/chat/completions`、`GET {baseUrl}/models`）、PROMPT 编码（万 `1m-9m` / 筒 `1p-9p` / 索 `1s-9s` / 字 `1z-7z` / 赤五 `0m/0p/0s`）、base64 上限 3MB、模型列表视觉优先排序，全部定义在 [`miniprogram/utils/model-protocol.js`](../miniprogram/utils/model-protocol.js)。小程序本地直连与 Worker 共用这份文件，修改协议**只改这一处**，再分别发布小程序与 Worker。

### 端到端链路各环节超时

小程序本地直连 30s → 云函数整体 20s（内部请求 Worker 19s）→ Worker 调**外部模型** 18s。默认 Workers AI 通道没有 Worker 侧限时，慢请求由云函数 19s 兜底超时。任何一环超时都会映射为「识牌超时，请重试或手动选牌」。

## 相关文档

- 云开发环境创建、集合权限与真机验证：[`docs/room-setup.md`](room-setup.md)
- 云函数参数、返回与错误码明细：[`docs/cloud-functions.md`](cloud-functions.md)
