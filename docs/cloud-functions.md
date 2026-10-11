# 云函数说明

项目共有 3 个微信云函数，目录在 `cloudfunctions/`。部署见下文「部署」一节，管理方案的讨论见 issue #28。

| 云函数 | 调用方 | 作用 |
| --- | --- | --- |
| `mahjong-room` | 小程序 `miniprogram/utils/room-service.js` | 联机房间的所有读写操作 |
| `mahjong-room-cleanup` | 定时触发器 `daily-room-cleanup`（每天 03:20） | 删除已结束且过期的房间 |
| `tile-recognizer` | 小程序 `miniprogram/utils/recognizer-service.js` | 把拍照识牌请求转发到 Cloudflare Worker |

所有参数都放在 `wx.cloud.callFunction({ name, data })` 的 `data` 里，云函数从 `event` 读取，并用 `event.action` 区分操作。

## 统一返回结构

所有云函数**都通过返回值告知结果，不向调用方抛异常**：

```js
{ code: 'OK', msg: '', data: <业务数据> }                         // 成功
{ code: 'ROOM_NOT_FOUND', msg: '没有找到这个房间', data: null }    // 失败
```

- `code`：`'OK'` 表示成功，其他值是错误码（大写下划线）。
- `msg`：给用户看的中文提示；成功时为空字符串。
- `data`：成功时的业务数据（下文各表中的「返回」指的就是 `data`）；失败时为 `null`。

实现：
- 真源 `packages/cloud-response/index.js`，由 `node scripts/sync-shared.js` 复制为各云函数目录下的 `response.js`（部署脚本会自动同步）。
- 云函数入口写成 `exports.main = event => Response.handle(run, MESSAGES)`。业务代码里仍可 `Response.fail('CODE')` 或 `throw new Error('CODE')`（领域层 `domain.js` 就是这样），由 `handle` 统一转成返回值。
- 每个云函数用 `MESSAGES` 登记自己的错误码和提示；**没有登记的异常一律返回 `INTERNAL_ERROR`**，详情只写到云函数日志，不下发给客户端。新增错误码时记得登记。
- 小程序端统一用 `miniprogram/utils/cloud-result.js` 的 `unwrap` 解析，失败时抛出 `err.code` / `err.message`（取服务端 `msg`）给页面。过渡期仍兼容旧版云函数的返回格式。
- `test-cloud-response.js` 覆盖包装、解析，以及每个云函数入口失败时确实返回统一结构。

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

错误码与提示登记在 `index.js` 的 `MESSAGES` 中：

`UNKNOWN_ACTION`、`IDENTITY_UNAVAILABLE`、`INVALID_ROOM_CODE`、`ROOM_NOT_FOUND`、`ROOM_ENDED`、`ROOM_NOT_ACTIVE`、`NOT_ROOM_MEMBER`、`HOST_ONLY`、`VERSION_CONFLICT`、`INVALID_COMMAND`、`INVALID_GAME_TYPE`、`INVALID_GAME`、`INVALID_GAME_MODE`、`POINT_TOTAL_MISMATCH`、`HAND_IN_PROGRESS`、`NOTHING_TO_UNDO`、`INVALID_SEAT`、`SEAT_OCCUPIED`、`SEAT_EMPTY`、`HOST_SEAT_LOCKED`、`NICKNAME_REQUIRED`、`ROOM_CODE_EXHAUSTED`、`INTERNAL_ERROR`。

### 写入范围

除 `create` 外，所有写操作都走 `index.js` 中的 `mutateRoom`：一个事务内读房间 → 校验状态、权限（`anyone` / `member` / `host`）和版本 → 生成新房间 → 版本加 1 并记录动作 → 写库。每次写操作更新：`rooms` 的 1 条记录、`room_views` 中每个成员的视图（最多 4 条）、`room_events` 的 1 条审计事件。`create` 不走事务，视图写入失败时会删除刚建的房间。

计分命令的规则（`commandType` 与玩法匹配、只有房主能改规则等）是纯函数 `Domain.applyGameCommand`，在 `packages/room-core` 中，由 `test-room-domain.js` 覆盖。

## 2. `mahjong-room-cleanup`

**没有参数**，由定时触发器 `daily-room-cleanup` 调用（cron `0 20 3 * * * *`，即每天 03:20）。

- 每批查找 100 个 `status = 'ended'` 且 `expiresAt` 早于当前时间的房间，用 `where({ roomCode }).remove()` 批量删除它们的 `room_views`、`room_events`，最后删除 `rooms` 记录。
- 在 45 秒的时间预算内反复分批处理（函数超时 60 秒）；处理不完的留到第二天。
- 单个房间删除失败只记录日志，跳过它继续处理；房间记录最后删，所以下次还会重试。
- `data` 为 `{ checkedAt, deletedCount, deletedRooms, failedRooms, timedOut }`；整体失败时 `code` 为 `INTERNAL_ERROR`。

## 3. `tile-recognizer`

### 参数

| `action` | 其他参数 | 转发到 Worker |
| --- | --- | --- |
| `recognize`（不传 `action` 时默认） | `imageBase64`（必填，base64 长度不超过 3MB）、`mimeType`（只认 `image/png`，其他一律按 `image/jpeg`） | `POST /recognize` |
| `testModel` | — | `POST /test` |

只转发上表中的字段；客户端多传的内容（如模型地址、Key）会被丢弃。自定义模型不经过这个云函数，由小程序直连。

### 返回

- 成功：`data` 是 Worker 结果去掉 `ok` 后的字段。`recognize` 为 `{ text }`，`testModel` 为 `{ model, reply, seesImage, latencyMs }`。
- 失败：`code` 见下表。Worker 自身是 HTTP 服务，仍返回 `{ ok, code }`，由云函数转换。

| `code` | 含义 |
| --- | --- |
| `UNKNOWN_ACTION` | `action` 不是 `recognize` / `testModel` |
| `IMAGE_REQUIRED` | 没有传 `imageBase64` |
| `IMAGE_TOO_LARGE` | 图片超过 3MB |
| `MODEL_NOT_CONFIGURED` | 没有配置 Worker 地址或令牌，或地址不是 https |
| `WORKER_UNREACHABLE` | 连不上 Worker，或返回内容不是 JSON |
| `MODEL_TIMEOUT` | 请求 Worker 超过 19 秒 |
| `WORKER_UNAUTHORIZED`、`MODEL_RATE_LIMITED` 等 | Worker 返回的错误码；已登记的原样透传，未登记的归为 `MODEL_REQUEST_FAILED` |

### 配置

Worker 地址和令牌优先读环境变量 `TILE_WORKER_URL` / `TILE_WORKER_TOKEN`，其次读同目录的 `worker.config.json`（已被 git 忽略，格式见 `worker.config.example.json`）。云函数超时必须设为 20 秒，否则 19 秒的转发超时不起作用。

## 部署

用 CloudBase CLI（`tcb`，通过 `npx -p @cloudbase/cli` 运行，不需要全局安装）。**配置唯一来源是根目录 `cloudbaserc.json`**：

| 云函数 | 超时 | 内存 | 云端安装依赖 | 触发器 |
| --- | --- | --- | --- | --- |
| `mahjong-room` | 10 秒 | 256 MB | 是（`wx-server-sdk`） | — |
| `mahjong-room-cleanup` | 60 秒 | 256 MB | 是 | `daily-room-cleanup` 每天 03:20 |
| `tile-recognizer` | 20 秒 | 128 MB | 否（无依赖） | — |

```bash
npx -p @cloudbase/cli tcb login                    # 首次使用，扫码登录
node scripts/deploy-functions.js                   # 部署全部
node scripts/deploy-functions.js tile-recognizer   # 只部署一个
node scripts/deploy-functions.js --dry-run         # 只打印命令
```

脚本做的事：

1. 环境 ID 取环境变量 `ENV_ID`，没有时取 `miniprogram/config.js` 的 `cloudEnvId`。
2. 先运行 `scripts/sync-shared.js`，把 `packages/` 下的共享代码同步到云函数目录（`domain.js`、`response.js`）。
3. 部署 `tile-recognizer` 前检查 `worker.config.json` 是否存在。
4. 执行 `tcb fn deploy <name> --force`，同时写入 `cloudbaserc.json` 中的超时、内存等配置。
5. 有触发器的函数再执行 `tcb fn trigger create`；触发器已存在时报错可以忽略。

各函数目录里的 `config.json` 只供微信开发者工具右键部署使用，以 `cloudbaserc.json` 为准。`test-deploy-functions.js` 会检查 `cloudbaserc.json` 登记了全部云函数，且关键配置没有丢。

### 部署后核对与排查

```bash
npx -p @cloudbase/cli tcb fn detail <函数名> -e <环境ID>   # 超时、内存、触发器
npx -p @cloudbase/cli tcb fn log <函数名> -e <环境ID>      # 调用日志
npx -p @cloudbase/cli tcb fn invoke mahjong-room-cleanup -e <环境ID>
npx -p @cloudbase/cli tcb fn invoke tile-recognizer -e <环境ID> --params '{"action":"testModel"}'
```

`mahjong-room` 在命令行调用时没有小程序上下文，一定返回 `IDENTITY_UNAVAILABLE`，要用真机验证。

### 密钥轮换（`WORKER_TOKEN`）

1. `cd apps/tile-worker && npx wrangler secret put WORKER_TOKEN` 写入新令牌。
2. 修改 `cloudfunctions/tile-recognizer/worker.config.json` 的 `workerToken`，执行 `node scripts/deploy-functions.js tile-recognizer`。
3. 两步之间默认识牌会返回 `WORKER_UNAUTHORIZED`，尽量连续完成。

