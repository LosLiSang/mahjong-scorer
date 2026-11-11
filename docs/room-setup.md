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

> 各云函数接收的参数、返回值与错误码见 [`cloud-functions.md`](cloud-functions.md)。

用 CloudBase CLI（`tcb`）部署，配置统一写在根目录 `cloudbaserc.json`（超时、内存、是否云端安装依赖、定时触发器）。详见 [`cloud-functions.md`](cloud-functions.md#部署)。

```bash
npx -p @cloudbase/cli tcb login          # 首次使用，扫码登录
node scripts/deploy-functions.js         # 部署全部云函数（含触发器）
```

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

| 情况 | 请求路径 |
| --- | --- |
| 用户在「设置 → 识牌」填了自定义模型 | 小程序本机 `wx.request` 直连该接口，Key 只存在手机本地 |
| 未填写（云端默认） | 小程序 → 微信云函数 `tile-recognizer` → Cloudflare Worker（`https://mahjong-tile.lisang.top`）→ Cloudflare Workers AI |

小程序正式版只能请求已备案登记的「request 合法域名」，且实测腾讯云函数连不上 `*.workers.dev`，所以云端默认通道由云函数经 Worker 自定义域名中转。

**使用方法、拍照建议、自定义模型配置（含各厂商 Base URL 与合法域名限制）、Worker 与云函数的部署和模型切换，统一见 [`docs/tile-recognition.md`](tile-recognition.md)。**
