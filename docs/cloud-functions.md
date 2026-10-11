# 云函数说明

项目共有 3 个微信云函数，目录在 `cloudfunctions/`。部署步骤见 [`room-setup.md`](room-setup.md) 第 3 节和第 7.2 节；统一管理方案的讨论见 issue #28。

| 云函数 | 调用方 | 作用 |
| --- | --- | --- |
| `mahjong-room` | 小程序 `miniprogram/utils/room-service.js` | 联机房间的所有读写操作 |
| `mahjong-room-cleanup` | 定时触发器 `daily-room-cleanup`（每天 03:20） | 删除已结束且过期的房间 |
| `tile-recognizer` | 小程序 `miniprogram/utils/recognizer-service.js` | 把拍照识牌请求转发到 Cloudflare Worker |

所有参数都放在 `wx.cloud.callFunction({ name, data })` 的 `data` 里，云函数从 `event` 读取，并用 `event.action` 区分操作。

## 1. `mahjong-room`

调用者身份**只取微信注入的 `OPENID`**（`cloud.getWXContext()`），参数里传的 openid 一律忽略。取不到时报 `IDENTITY_UNAVAILABLE`。

### 参数

| `action` | 其他参数 | 权限 | 返回 |
| --- | --- | --- | --- |
| `identity` | — | 任何人 | `{ openId }` |
| `create` | `mode`, `gameType`, `nickname`, `avatarFileId`, `seatIndex` | 任何人 | 房主的房间视图 |
| `inspect` | `roomCode` | 任何人 | 房间公开预览（加入前选座用） |
| `join` | `roomCode`, `gameType`, `nickname`, `avatarFileId`, `seatIndex` | 任何人 | 自己的房间视图 |
| `updateProfile` | `roomCode`, `expectedVersion`, `avatarFileId` | 成员 | 自己的房间视图 |
| `command` | `roomCode`, `expectedVersion`, `commandType`, `nextGame`, `summary` | 成员；`*-rules` 仅房主 | 自己的房间视图 |
| `undo` | `roomCode`, `expectedVersion` | 成员 | 自己的房间视图 |
| `reset` | `roomCode`, `expectedVersion` | 仅房主 | 自己的房间视图 |
| `releaseSeat` | `roomCode`, `expectedVersion`, `seatIndex` | 仅房主；不能释放房主自己的座位 | 房主的房间视图；被释放者的视图会被删除 |
| `moveSeat` | `roomCode`, `expectedVersion`, `seatIndex`（目标空座） | 成员 | 自己的房间视图 |
| `end` | `roomCode`, `expectedVersion` | 仅房主 | 自己的房间视图，同时写入 30 天后的 `expiresAt` |

### 字段说明

- `expectedVersion`：客户端看到的房间版本号，用于乐观锁。与服务端版本不一致时报 `VERSION_CONFLICT`，所以同时提交的两次操作只会有一个成功。
- `commandType`：只能是下面几种，并且必须与房间的 `gameType` 一致，否则分别报 `INVALID_COMMAND` / `INVALID_GAME_TYPE`。
  - 日麻：`win`、`draw`、`riichi`、`riichi-rules`
  - 川麻：`sichuan-win`、`sichuan-gang`、`sichuan-penalty`、`sichuan-setup`、`sichuan-rules`
- `nextGame`：客户端算好的完整对局状态。服务端会规范化（`normalizeGame`）、按座位覆盖昵称、校验总分（`validateGame`）。
  - `*-rules` 命令只采用其中的 `rules`，分数和历史沿用房间现状。
  - 其他命令传入的 `rules` 一律忽略，沿用房间现有规则。
- `summary`：操作摘要，显示在操作记录里；不传时用默认文案。

「房间视图」是写入 `room_views` 的那份文档：`roomCode`、`status`、`mode`、`gameType`、`version`、`isHost`、`mySeat`、`seats`（不含其他人的 openid）、`game`、`lastAction` 等，结构见 `domain.js` 的 `roomView`。

### 错误

出错时**抛出异常**，`err.code` 或错误消息就是错误码；小程序端由 `room-service.js` 的 `parseError` 转成提示。

常见错误码：`UNKNOWN_ACTION`、`IDENTITY_UNAVAILABLE`、`INVALID_ROOM_CODE`、`ROOM_NOT_FOUND`、`ROOM_ENDED`、`ROOM_NOT_ACTIVE`、`NOT_ROOM_MEMBER`、`HOST_ONLY`、`VERSION_CONFLICT`、`INVALID_COMMAND`、`INVALID_GAME_TYPE`、`INVALID_GAME`、`INVALID_GAME_MODE`、`POINT_TOTAL_MISMATCH`、`HAND_IN_PROGRESS`、`NOTHING_TO_UNDO`、`INVALID_SEAT`、`SEAT_OCCUPIED`、`SEAT_EMPTY`、`HOST_SEAT_LOCKED`、`NICKNAME_REQUIRED`、`ROOM_CODE_EXHAUSTED`。

### 写入范围

每次写操作在一个事务里更新：`rooms` 的 1 条记录、`room_views` 中每个成员的视图（最多 4 条）、`room_events` 的 1 条审计事件。`create` 例外：它不走事务，视图写入失败时会删除刚建的房间。

## 2. `mahjong-room-cleanup`

**没有参数**，由 `config.json` 中的定时触发器调用（cron `0 20 3 * * * *`，即每天 03:20）。

- 查找 `status = 'ended'` 且 `expiresAt` 早于当前时间的房间，每次最多 100 个。
- 依次删除这些房间在 `room_views`、`room_events` 中的记录，最后删除 `rooms` 记录。
- 返回 `{ checkedAt, deletedCount, deletedRooms }`。

过期房间超过 100 个时，剩下的留到第二天处理。

## 3. `tile-recognizer`

### 参数

| `action` | 其他参数 | 转发到 Worker |
| --- | --- | --- |
| `recognize`（不传 `action` 时默认） | `imageBase64`（必填，base64 长度不超过 3MB）、`mimeType`（只认 `image/png`，其他一律按 `image/jpeg`） | `POST /recognize` |
| `testModel` | — | `POST /test` |

只转发上表中的字段；客户端多传的内容（如模型地址、Key）会被丢弃。自定义模型不经过这个云函数，由小程序直连。

### 返回

- 成功：原样返回 Worker 的结果，形如 `{ ok: true, text, ... }`。
- 失败：**不抛异常**，返回 `{ ok: false, code }`。

| `code` | 含义 |
| --- | --- |
| `UNKNOWN_ACTION` | `action` 不是 `recognize` / `testModel` |
| `IMAGE_REQUIRED` | 没有传 `imageBase64` |
| `IMAGE_TOO_LARGE` | 图片超过 3MB |
| `MODEL_NOT_CONFIGURED` | 没有配置 Worker 地址或令牌，或地址不是 https |
| `WORKER_UNREACHABLE` | 连不上 Worker，或返回内容不是 JSON |
| `MODEL_TIMEOUT` | 请求 Worker 超过 19 秒 |
| `WORKER_UNAUTHORIZED` 等 | Worker 返回的错误码，原样透传 |

### 配置

Worker 地址和令牌优先读环境变量 `TILE_WORKER_URL` / `TILE_WORKER_TOKEN`，其次读同目录的 `worker.config.json`（已被 git 忽略，格式见 `worker.config.example.json`）。云函数超时必须设为 20 秒，否则 19 秒的转发超时不起作用。

## 两种错误风格

`mahjong-room` 通过抛异常报错，`tile-recognizer` 通过返回 `{ ok: false, code }` 报错。新增云函数或修改调用方时，要注意两者的处理方式不同。
