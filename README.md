# 日麻整场计分器

面向手机端面麻使用的纯前端日麻计分工具。

## 功能

- 四人整场点数、本场与供托管理
- 微信小程序日麻房间：房间码/分享加入、多人实时同步、版本冲突保护
- SVG 麻将牌选牌器
- 指定最终和牌张
- 普通牌型、七对子、国士无双与役满分析
- 暗刻、明刻、暗杠、明杠及副露顺子修正
- 立直、两立直、一发、海底、河底、抢杠、岭上条件
- 多张表宝牌与裏宝牌指示牌
- 自动计算役、番、符与最终支付

## H5 使用（React 版）

H5 已迁移到 React + TypeScript（`apps/web/`），与小程序共享同一份计分核心和牌图。

```bash
cd apps/web
npm install
npm run dev      # http://localhost:5173
npm run build    # 产物在 apps/web/dist/，纯静态可部署
```

根目录旧版单文件 `index.html` 在新版本完成部署切换前保留可用。

## 微信小程序

小程序源码位于 `miniprogram/`，项目配置为根目录下的 `project.config.json`。

1. 使用微信开发者工具导入仓库根目录。
2. 将 `project.config.json` 中的测试 AppID 替换为自己的小程序 AppID。
3. 点击编译即可运行。

H5 与小程序共用唯一一份计分核心 `miniprogram/utils/mahjong-logic.js`（带 UMD 兼容导出，可直接 `<script>` 引入），牌图也只有一份，保存在 `miniprogram/assets/tiles/`。

### 实时房间

实时房间仅在微信小程序日麻计分页提供，使用微信云开发。未配置云环境时保持纯本地模式，不影响原有功能。

房间核心领域逻辑抽在 [`packages/room-core`](packages/room-core/README.md)（纯函数、零依赖）。云函数目录里的 `domain.js` 是同步产物，改动领域规则请改 `packages/room-core` 后运行 `node scripts/sync-room-core.js`。

部署步骤、集合权限和真机验证清单见 [`docs/room-setup.md`](docs/room-setup.md)。Supabase 可行性评估见 [`docs/research/supabase-wechat-room.md`](docs/research/supabase-wechat-room.md)。

## 测试

```bash
node test-logic.js
node test-miniprogram.js
node test-room-domain.js
node test-room-service.js
```

## 线上地址

<https://mj.lisang.top>

## 牌图

麻将牌 SVG 来源于 [FluffyStuff/riichi-mahjong-tiles](https://github.com/FluffyStuff/riichi-mahjong-tiles)。
