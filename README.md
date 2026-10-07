# 麻将计分器

面向手机端的麻将计分工具。一套「计分核心」同时驱动 **H5** 与 **微信小程序** 两个前端，覆盖**日麻整场计分**与**川麻积分**两种玩法，并支持基于微信云开发的**实时联机房间**。

## 亮点

- **日麻整场计分**：四麻 / 三麻整场点数、本场与供托管理，自动计算役、番、符与最终支付；可选「血战到底」玩法。
- **川麻积分**：对局级规则（血战到底 / 血流成河、底分、封顶），明杠 / 暗杠 / 加杠自动计费，定缺、查花猪、查大叫、退税、诈和等罚分。
- **教学馆**：术语释义、开局策略攻略、役形判断等玩法学习内容。
- **实时联机房间**：房间码/分享加入，多人实时同步，带版本冲突保护。
- **纯前端可跑**：H5 版无后端依赖，可本地运行或任意静态托管部署。

## 两个前端

| 前端 | 入口 | 说明 |
| --- | --- | --- |
| H5 | `apps/web/` | React + TypeScript，纯静态部署；根目录旧版 `index.html` 在切换完成前保留 |
| 微信小程序 | `miniprogram/` | 完整小程序，含日麻、川麻、教学馆、役种图鉴、算分详解、设置等页面 |

两套前端共用同一份计分核心 `miniprogram/utils/mahjong-logic.js`（带 UMD 兼容导出）与同一份 SVG 牌图 `miniprogram/assets/tiles/`。

## 微信小程序页面

底部标签栏为四个主页面，另有若干功能页：

- **日麻计分**（`pages/index`）：日麻整场计分主界面。
- **川麻积分**（`pages/sichuan`）：川麻规则、杠分、罚分与积分。
- **教学馆**（`pages/tutorial`）：玩法学习与测试。
- **设置**（`pages/settings`）：昵称、主题与房间服务。
- **役种图鉴**（`pages/yaku-catalog`）：役种一览与牌例。
- **算分详解**（`pages/scoring-guide`）：和牌结算分步向导。

## H5 使用（React 版）

```bash
cd apps/web
npm install
npm run dev      # http://localhost:5173
npm run build    # 产物在 apps/web/dist/，纯静态可部署
```

线上地址：<https://mj.lisang.top>

## 微信小程序

小程序源码位于 `miniprogram/`，项目配置在根目录的 `project.config.json`。

1. 使用**微信开发者工具**导入仓库根目录。
2. 在 `project.config.json` 中替换为你的小程序 AppID。
3. 点击编译即可运行。

### 实时联机房间

实时房间功能默认关闭；**未配置云环境时，本地日麻与川麻计分完全不受影响**。

- 云环境配置：`miniprogram/config.js` 中的 `cloudEnvId`。
- 房间核心领域逻辑在 [`packages/room-core`](packages/room-core/README.md)（纯函数、零依赖）。云函数目录里的 `domain.js` 是同步产物，改动领域规则请改 `packages/room-core` 后运行 `node scripts/sync-room-core.js`。
- 部署步骤、集合权限与真机验证清单见 [`docs/room-setup.md`](docs/room-setup.md)。
- 云函数位于 `cloudfunctions/mahjong-room` 与 `cloudfunctions/mahjong-room-cleanup`。
- Supabase 可行性评估见 [`docs/research/supabase-wechat-room.md`](docs/research/supabase-wechat-room.md)。

## 项目结构

```
.
├── apps/web/                   # H5（React + TypeScript）
├── index.html                  # 旧版 H5 单文件入口（切换完成前保留）
├── miniprogram/                # 微信小程序
│   ├── app.json / app.js / app.wxss
│   ├── config.js               # 云开发环境配置
│   ├── assets/tiles/           # 牌图 SVG（H5 与小程序共用）
│   ├── components/             # serif-input 等公共组件
│   ├── pages/                  # index / sichuan / tutorial / settings / yaku-catalog / scoring-guide
│   ├── custom-tab-bar/         # 自定义标签栏
│   └── utils/                  # 计分核心、房间、学习数据等公共逻辑
├── packages/room-core/         # 联机房间领域逻辑（真源）
├── cloudfunctions/             # 微信云函数
│   ├── mahjong-room/           # 联机房间（domain.js 由 room-core 同步）
│   └── mahjong-room-cleanup/   # 房间清理
├── scripts/                    # sync-room-core 等脚本
├── docs/                       # 部署、研究与 agent 文档
├── project.config.json         # 小程序项目配置（本地填写，不入库）
└── .gitattributes              # 强制 LF 行尾，保证跨平台一致
```

## 测试

```bash
node test-logic.js          # 日麻计分核心（含血战到底）
node test-miniprogram.js    # 小程序页面交互与川麻计分
node test-room-domain.js    # 联机房间领域逻辑
node test-room-service.js   # 联机房间服务
```

## 牌图

麻将牌 SVG 来源于 [FluffyStuff/riichi-mahjong-tiles](https://github.com/FluffyStuff/riichi-mahjong-tiles)。

## 版权

Copyright © 2026 Lisang. All rights reserved.
