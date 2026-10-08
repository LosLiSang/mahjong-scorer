# 微信云房间部署说明

房间功能默认处于关闭状态；不配置云环境时，原有本地日麻和川麻积分器不受影响。

## 1. 创建云开发环境

1. 使用当前小程序 AppID 打开微信开发者工具。
2. 点击“云开发”，创建一个环境。
3. 优先选择可用的免费额度，并关闭或限制可能产生意外费用的自动扩容能力。
4. 复制环境 ID。
5. 编辑 `miniprogram/config.js`：

```js
module.exports = {
  cloudEnvId: '你的环境 ID',
  roomFunctionName: 'mahjong-room'
};
```

不要把 AppSecret 或其他服务端凭据写入项目。

## 2. 创建数据库集合

创建以下三个集合：

- `rooms`：权威房间状态，仅云函数读写。
- `room_views`：每位成员自己的实时只读视图。
- `room_events`：操作审计和最新操作撤销数据，仅云函数读写。

### `rooms` 权限

```json
{
  "read": false,
  "write": false
}
```

### `room_events` 权限

```json
{
  "read": false,
  "write": false
}
```

### `room_views` 安全规则

```json
{
  "read": "doc._openid == auth.openid",
  "write": false
}
```

客户端监听时同时查询 `_id` 与 `_openid`，满足 CloudBase 对安全规则查询条件的要求。其他玩家的 OpenID 不会进入客户端可读视图。

建议在控制台建立以下索引，并以控制台实际查询提示为准：

- `room_views`：`_openid`、`_id` 等值查询；`roomCode` 用于过期清理。
- `room_events`：`roomCode` 用于过期清理。
- `rooms`：`status + expiresAt` 用于查找已结束且过期的房间。

## 3. 部署云函数

在微信开发者工具中找到并分别部署：

```text
cloudfunctions/mahjong-room
cloudfunctions/mahjong-room-cleanup
```

右键选择“上传并部署：云端安装依赖”。云函数依赖 `wx-server-sdk`，部署时不得跳过依赖安装。清理函数的 `config.json` 配置为每天 03:20（UTC+8）执行一次。

部署完成后，可在云函数控制台调用：

```json
{
  "action": "identity"
}
```

真实的小程序调用会返回当前用户 OpenID。控制台测试没有小程序调用上下文时可能无法取得 OpenID，这不代表小程序链路已经验证成功。

## 4. 真机验证

至少使用两个不同微信账号验证：

1. A 创建四麻房间并选择一个座位。
2. B 通过分享卡片或房间码查询房间、选择空座加入。
3. A 执行立直或和牌结算，B 应实时收到相同分数和操作者提示。
4. A、B 几乎同时基于同一版本提交操作，应只有一个成功，另一个收到版本冲突提示。
5. 断开 B 的网络，计分按钮应禁用；恢复网络后重新同步。
6. 房主释放 B 的座位，B 应退出房间视图，本地存档恢复且不被房间状态覆盖。
7. 成员换座：B（或任一成员）可把自己移到另一个空座，累计分数/点数跟着本人走，历史账本随座位对调自洽，总分守恒；房主与成员均可操作，但只能选空座。
8. 房主结束房间，所有成员进入只读状态。

## 5. 免费额度边界

当前设计一次房间操作会更新：

- 1 条权威房间记录；
- 最多 4 条成员实时视图；
- 1 条审计事件。

少于 10 个同时在线房间时数据量较小，但免费额度和计费政策可能变化，应以云开发控制台为准。额度不足时应暂停房间服务，不要把失败操作降级为离线写入。

## 6. 30 天清理

结束房间时会写入 `expiresAt`（结束时间后 30 天）。`mahjong-room-cleanup` 定时函数会删除过期的：

- `rooms`
- `room_views`
- `room_events`

部署后必须在云开发控制台确认 `daily-room-cleanup` 触发器已存在并实际产生执行记录；仅上传代码但触发器未生效时，过期数据不会自动删除。

## 7. 拍照识牌（可选）

日麻和牌结算第 2 步的「📷 拍照识牌」有两条通道：

| 情况 | 请求路径 | 模型 Key 存放位置 |
| --- | --- | --- |
| 用户在「设置 → 识牌」填了自定义模型 | 小程序本机 `wx.request` 直连该接口 | 用户手机本地 |
| 未填写（云端默认） | 小程序 → 微信云函数 `tile-recognizer` → Cloudflare Worker（`*.workers.dev`）→ 模型 | Worker Secret |

小程序正式版只能请求已登记的「request 合法域名」，合法域名要求 ICP 备案，`workers.dev` 无法登记，国内网络也基本访问不到。因此由微信云函数在服务端转发：云函数只保存调用 Worker 的共享令牌，不保存模型 Key。

### 7.1 部署 Cloudflare Worker（`apps/tile-worker`）

```bash
cd apps/tile-worker
npm install
npx wrangler login
# 模型 Key 与共享令牌只用 secret 保存，不写进 wrangler.jsonc
npx wrangler secret put MODEL_API_KEY
npx wrangler secret put WORKER_TOKEN      # 自己生成一段足够长的随机串
npx wrangler deploy                       # 输出 https://mahjong-tile-worker.<子域>.workers.dev
```

- 默认模型在 `wrangler.jsonc` 的 `vars` 中配置：`MODEL_BASE_URL` 默认是 `https://dashscope.aliyuncs.com/compatible-mode/v1`，`MODEL_NAME` 默认是 `qwen-vl-max`。
- 接口：`POST /recognize`、`POST /test`，都要求请求头带 `Authorization: Bearer <WORKER_TOKEN>`。
- 已开启 Workers Logs 与 Traces，可在 Cloudflare 控制台查看调用记录。
- 本地调试：复制 `.dev.vars.example` 为 `.dev.vars`，然后运行 `npm run dev`。

### 7.2 部署微信云函数（`cloudfunctions/tile-recognizer`）

1. 右键该目录 → “上传并部署：云端安装依赖”。该函数没有第三方依赖，`config.json` 中的超时设为 20 秒。
2. 在云开发控制台 → 云函数 → `tile-recognizer` → 函数配置 → 环境变量中填写：

| 变量 | 说明 |
| --- | --- |
| `TILE_WORKER_URL` | 上一步得到的 Worker 地址 |
| `TILE_WORKER_TOKEN` | 与 Worker 的 `WORKER_TOKEN` 相同 |

云函数只转发白名单字段（图片、图片类型），不会把客户端传来的模型地址或 Key 带给 Worker。

### 7.3 自定义模型（本机直连）

- 正式版只能请求「小程序后台 → 开发管理 → 服务器域名 → request 合法域名」中登记过的域名。请提前登记允许用户使用的厂商域名（如 `dashscope.aliyuncs.com`、`open.bigmodel.cn`）；未登记的地址会提示“该地址不在小程序合法域名中”。开发者工具中勾选“不校验合法域名”后可以随意测试。
- 「获取」按钮直连 `GET {地址}/models`，视觉类模型排在前面。「测试」按钮发送一张纯红小图，检查连通、鉴权和看图能力，并显示耗时。地址和 Key 都留空时，「测试」检查的是云端默认通道（云函数 → Worker）。

### 共同约定

- 请求构造与响应解析的唯一真源是 `miniprogram/utils/model-protocol.js`：小程序端直接引用，Worker 由 wrangler 打包时引入，无需复制。
- 照片在手机上压缩后以 base64 发出，不上传云存储，不落盘；Worker 也不保存图片。
- 目前不限制调用次数；云端默认通道的模型费用由 Worker 中配置的 Key 承担。
- Cloudflare Workers 免费版：每天 10 万次请求；每次请求的 CPU 时间上限为 10ms，等待模型返回的时间不计入。照片在手机上已压缩到宽 1280、质量 70（base64 一般只有几百 KB），Worker 只解析和转发一次 JSON，通常在额度内；如果日志里出现 CPU 超限，可以降低压缩宽度。
- 识别结果必须通过前端校验（合法牌 ID、14–18 张、同种牌不超过 4 张、置信度 ≥ 0.6）才会替换手牌；失败时只提示，不改动当前手牌。
