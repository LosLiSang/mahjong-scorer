# 拍照识牌：调用链、使用与配置说明

日麻和牌结算时，把手牌拍一张照片，由多模态模型识别成牌面并自动填入手牌。本文说明它在哪里用、怎么用、怎么配自定义模型，以及维护者如何部署与切换模型后端。

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
- **「测试」**：发送一张 32×32 纯红小图给模型，检查连通、鉴权和看图能力。结果显示「可用 · X.Xs」（看懂了是红色）或「已连通 · X.Xs，但可能看不懂图片」。地址和 Key 留空时，测试的是云端默认通道。

## 怎么拍、怎么核对

拍照建议：

- **拍齐整手 14–18 张**（含荣和/自摸那张），牌面完整入镜，不要互相叠压遮挡。
- **光线均匀、避免反光**：哑光桌面优于亮面玻璃，避免顶灯直射产生反光斑。
- **正对俯拍**：镜头正对牌面，避免斜角导致字牌辨认不清。
- **和了的那张单独放开**（或横置）：模型会尝试把它填入 `winTile`；分不开也没关系，之后手动在「最终和牌张」里点选即可。

识别成功后，识别结果会**整体替换**当前手牌，并弹窗提示张数（含赤五时注明「暂不自动计入赤宝牌」——赤五 `0m/0p/0s` 会折算成普通 `5m/5p/5s`，需要计赤宝牌时请手动核对调整）。**识别不完全可靠，填入后务必逐张核对**；点「撤销」可一键恢复识别前的整手手牌与和牌张。

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
| 阿里云百炼（通义千问） | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen-vl-max`、`qwen-vl-plus` | 百炼控制台「API-KEY」页 |
| 智谱 AI | `https://open.bigmodel.cn/api/paas/v4` | `glm-4v-plus` | open.bigmodel.cn 控制台 |
| OpenAI | `https://api.openai.com/v1` | `gpt-4o` | platform.openai.com |
| 硅基流动 | `https://api.siliconflow.cn/v1` | `Qwen/Qwen2.5-VL-72B-Instruct` | cloud.siliconflow.cn |

填写建议：先填地址和 Key，点「获取」拉模型列表点选；没有列表接口的厂商直接手动填模型名，再点「测试」确认能看图。

**合法域名限制**：小程序正式版只能请求小程序后台「开发管理 → 开发设置 → 服务器域名 → request 合法域名」中登记过的域名，且该域名必须 ICP 备案。未登记的地址会报「该地址不在小程序合法域名中」。想让用户直连某厂商，需要项目方提前登记该厂商域名（如 `dashscope.aliyuncs.com`、`open.bigmodel.cn`）。开发调试时可在微信开发者工具「详情 → 本地设置」勾选「不校验合法域名」临时绕过。

## 维护者指南

### Cloudflare Worker（`apps/tile-worker`）

- **默认后端**：Workers AI（`ai` 绑定），模型由 Var `WORKERS_AI_MODEL` 指定，默认 `@cf/qwen/qwen3.8-27b`，不需要模型 Key。
- **切换外部模型**：`wrangler secret put MODEL_API_KEY` 设置后即改走 OpenAI 兼容外部接口；接口地址与模型名由 Var `MODEL_BASE_URL`（默认 `https://dashscope.aliyuncs.com/compatible-mode/v1`）与 `MODEL_NAME`（默认 `qwen-vl-max`）指定。删掉该 Secret 即回到 Workers AI。
- **思考模式必须关闭**：识牌是直接看图输出 JSON 的任务，推理类模型若开思考，token 会耗在推理上导致 `content` 为空。Worker 已对 Workers AI 请求统一加 `chat_template_kwargs: { enable_thinking: false }`；换成外部推理模型时注意选非思考版本或关闭思考。
- **共享令牌**：`wrangler secret put WORKER_TOKEN`，与云函数侧 `TILE_WORKER_TOKEN` 一致。
- **部署**：`cd apps/tile-worker && npx wrangler deploy`，同时发布 workers.dev 地址与自定义域名 `mahjong-tile.lisang.top`。
- **接口**：`POST /recognize`、`POST /test`，均要求 `Authorization: Bearer <WORKER_TOKEN>`，失败统一返回 `{ ok: false, code }`。Workers Logs 与 Traces 已开启。
- **免费额度**：Workers 每天 10 万次请求；Workers AI 每天 10,000 neurons，实测一次识牌约 37 neurons、一次测试约 4 neurons，约合每天 250 次识牌。

### 微信云函数（`cloudfunctions/tile-recognizer`）

- Worker 地址与令牌放在同目录 `worker.config.json`（格式见 `worker.config.example.json`，已被 git 忽略，只随云函数上传）；也可用环境变量 `TILE_WORKER_URL` / `TILE_WORKER_TOKEN` 覆盖。
- 部署：`node scripts/deploy-functions.js tile-recognizer`。超时（20 秒）等配置来自 `cloudbaserc.json`，`tcb fn deploy` 会一并写入。
- 云函数只转发白名单字段（图片 base64 与 mimeType），不把客户端传来的其他内容带给 Worker；图片只在调用内存中转发，不落盘。

### 协议唯一真源

请求构造（`POST {baseUrl}/chat/completions`、`GET {baseUrl}/models`）、PROMPT 编码（万 `1m-9m` / 筒 `1p-9p` / 索 `1s-9s` / 字 `1z-7z` / 赤五 `0m/0p/0s`）、base64 上限 3MB、模型列表视觉优先排序，全部定义在 [`miniprogram/utils/model-protocol.js`](../miniprogram/utils/model-protocol.js)。小程序本地直连与 Worker 共用这份文件，修改协议**只改这一处**，再分别发布小程序与 Worker。

### 端到端链路各环节超时

小程序本地直连 30s → 云函数整体 20s（内部请求 Worker 19s）→ Worker 调模型 18s。任何一环超时都会映射为「识牌超时，请重试或手动选牌」。

## 相关文档

- 云开发环境创建、集合权限与真机验证：[`docs/room-setup.md`](room-setup.md)
- 云函数参数、返回与错误码明细：[`docs/cloud-functions.md`](cloud-functions.md)
