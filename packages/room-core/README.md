# room-core — 房间核心领域

房间功能的纯领域逻辑，零依赖（不依赖 wx-server-sdk、数据库或网络），可被 Node 直接 require。

## 真源与同步

- **真源**：`packages/room-core/domain.js`。改领域规则只改这里。
- **同步产物**：`cloudfunctions/mahjong-room/domain.js`。微信云函数上传时只能包含函数目录内的文件，所以部署前需要运行：

```bash
node scripts/sync-room-core.js
```

`test-room-domain.js` 会校验两份文件一致，直接改云函数目录里的副本会导致测试失败。

## 边界

这里只放"规则"：房间码生成与规范化、昵称/头像清洗、初始牌局（日麻四麻/三麻、川麻）、座位分配与转移、乐观锁版本校验、动作摘要、30 天保留期计算。

不放在这里：微信云数据库读写（`cloudfunctions/mahjong-room/index.js`）、客户端同步与订阅（`miniprogram/utils/room-service.js`）、界面。

## 动作协议（当前云函数对外支持的 type）

`identity` / `create` / `inspect` / `join` / `updateProfile` / `command`（`win`、`draw`、`riichi`、`sichuan-win`、`sichuan-gang`、`sichuan-penalty`、`sichuan-setup`）/ `undo` / `reset` / `releaseSeat` / `moveSeat` / `end`

将来的 TS 后端按同一套动作与版本语义实现即可无缝替换云开发。
