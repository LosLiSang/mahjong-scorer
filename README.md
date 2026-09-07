# 麻将计分器

面向手机端的麻将计分工具。一套「计分核心」同时驱动 **H5** 与 **微信小程序** 两个前端，覆盖**日麻整场计分**与**川麻积分**两种玩法，支持基于微信云开发的**实时联机房间**（小程序端），并提供**拍照识牌**（OpenAI 兼容视觉接口）自动填入手牌。

## 亮点

- **日麻整场计分**：四家整场点数、本场与供托管理，自动计算役、番、符与最终支付。
- **拍照识牌**（H5）：一张手牌照片自动识别全部牌张，可纠错后一键填入，替代手动点选。
- **川麻积分**：定缺、查花猪、查大叫、退税、诈和等川麻罚分与积分规则。
- **教学馆**：术语释义、开局策略攻略、役形判断等玩法学习内容。
- **役种图鉴 / 算分详解**：全部役种条件与牌例；符数、点数、满贯档位拆解与交互计算器。
- **实时联机房间**（小程序端）：房间码/分享加入，多人实时同步，带版本冲突保护。
- **纯前端可跑**：H5 版无后端依赖，可本地直接打开或任意静态托管部署。

## 两个前端

| 前端 | 入口 | 说明 |
| --- | --- | --- |
| H5 | `index.html` | 多文件静态应用：底部 tab 导航（日麻计分/教学馆/川麻积分/设置）+ hash 路由，含拍照识牌与全部教学工具 |
| 微信小程序 | `miniprogram/` | 完整小程序，含日麻、川麻、教学馆、役种图鉴、算分详解等页面 |

两套前端共用同一套计分核心逻辑与 SVG 牌图。H5 联机房间暂未提供（小程序走 wx.cloud，H5 待接 Supabase，见调研文档）。

### H5 目录结构

```
index.html               # 壳：视图容器 + 底部 tab + 脚本加载序
css/                     # theme(计分器原样式) / shell / common / tutorial / yaku-catalog / scoring-guide / sichuan / vision / settings
js/core/mahjong-logic.js # 计分核心（与 miniprogram/utils/mahjong-logic.js 字节一致，test-logic.js 有防漂移断言）
js/core/tiles.js         # 牌定义 / SVG 映射 / 牌码解析
js/core/vision-result.js # 识图纯逻辑：JSON 提取、牌码校验、多重集合比对、准确率
js/data/                 # 教学/川麻数据（与小程序 utils 字节级副本，test-h5-data.js 防漂移）
js/api/openai-client.js  # OpenAI 兼容 chat/completions 视觉调用（仅传输层）
js/store/settings-store.js # API 配置持久化（localStorage，仅存本机）
js/views/                # router / scorer / tutorial / yaku-catalog / scoring-guide / sichuan / vision / settings
tiles/                   # H5 牌图 SVG
```

## 微信小程序页面

底部标签栏为三主页面，另有若干功能页：

- **日麻计分**（`pages/index`）：四家整场日麻计分主界面。
- **教学馆**（`pages/tutorial`）：玩法学习与测试。
- **川麻积分**（`pages/sichuan`）：川麻定缺与罚分积分。
- **役种图鉴**（`pages/yaku-catalog`）：役种一览与牌例。
- **算分详解**（`pages/scoring-guide`）：和牌结算分步向导。

## H5 使用

纯静态项目，直接用浏览器打开 `index.html`，或通过任意静态 HTTP 服务器部署。

```bash
python3 -m http.server 8080
```

访问 `http://localhost:8080`。

线上地址：<https://mj.lisang.top>

### 拍照识牌（OpenAI 兼容视觉接口）

入口：底部「设置」填写配置后，进入「日麻计分 → 和牌结算 → 📷 拍照识牌」，或工具栏「识图」。

1. **配置**（设置页，仅需一次）：填写兼容 OpenAI Chat Completions 的 Base URL、API Key、支持图片输入的模型名。Key 只保存在本机浏览器 localStorage，不入代码库、保存后不回显。
2. **识别**：一张照片拍全整副手牌（13/14 张）→ 本地压缩 → 调用视觉接口 → 识别结果以牌图呈现，点牌可删（纠错）。
3. **填入**：「填入计分器手牌」自动打开和牌结算弹窗并替换手牌；红宝牌（红5万/筒/索 → `0m/0p/0s`）单独登记计入赤宝牌数。最终和牌张从已识别的牌中人工指定（不让模型推断，避免误判）。
4. **验证**：识图页输入「期望牌型」与识别结果做多重集合逐张比对，显示漏识/多识与准确率；真实调用的记录（时间/模型/延迟/牌码/准确率，不含 Key）入档并汇总。

**可行性判定标准**：≥10 张真实牌桌照片、平均逐张准确率 ≥90% → 方案可行。

注意：

- 浏览器直连要求网关允许跨域（CORS）。识别报「网络/CORS」错误时，请更换支持 CORS 的网关或自建代理。
- 未配置 Key 时识图功能 fail-closed 明确提示，不影响计分器其它功能。
- localStorage 中的 Key 可被本机脚本读取，仅建议个人使用；生产部署应改走服务端代理。

## 微信小程序

小程序源码位于 `miniprogram/`，项目配置在根目录的 `project.config.json`。

1. 使用**微信开发者工具**导入仓库根目录。
2. 在 `project.config.json` 中替换为你的小程序 AppID。
3. 点击编译即可运行。

牌图保存在 `miniprogram/assets/tiles/`。

### 实时联机房间

实时房间功能默认关闭；**未配置云环境时，本地日麻与川麻计分完全不受影响**。

- 云环境配置：`miniprogram/config.js` 中的 `cloudEnvId`。
- 部署步骤、集合权限与真机验证清单见 [`docs/room-setup.md`](docs/room-setup.md)。
- 云函数位于 `cloudfunctions/mahjong-room` 与 `cloudfunctions/mahjong-room-cleanup`。
- Supabase 可行性评估见 [`docs/research/supabase-wechat-room.md`](docs/research/supabase-wechat-room.md)。

## 项目结构

```
.
├── index.html                  # H5 日麻计分入口（纯静态）
├── mahjong-logic.js            # 日麻计分核心（H5 与小程序共用）
├── tiles/                      # H5 牌图 SVG
├── miniprogram/                # 微信小程序
│   ├── app.json / app.js / app.wxss
│   ├── config.js               # 云开发环境配置
│   ├── assets/tiles/           # 小程序牌图 SVG
│   ├── pages/                  # index / sichuan / tutorial / yaku-catalog / scoring-guide
│   ├── custom-tab-bar/         # 自定义标签栏
│   └── utils/                  # 计分、房间、学习数据等公共逻辑
├── cloudfunctions/             # 微信云函数
│   ├── mahjong-room/           # 联机房间
│   └── mahjong-room-cleanup/   # 房间清理
├── docs/                       # 部署与研究文档
├── project.config.json         # 小程序项目配置
└── .gitattributes              # 强制 LF 行尾，保证跨平台一致
```

## 测试

```bash
node test-logic.js          # 日麻计分核心（含与小程序副本的字节一致性断言）
node test-h5-vision.js      # 拍照识图纯逻辑（JSON 解析/牌码校验/比对/准确率/设置存储）
node test-h5-data.js        # 教学数据层（与小程序副本字节一致 + 结构校验）
node test-miniprogram.js    # 小程序与川麻计分
node test-room-domain.js    # 联机房间领域逻辑
node test-room-service.js   # 联机房间服务
```

## 牌图

麻将牌 SVG 来源于 [FluffyStuff/riichi-mahjong-tiles](https://github.com/FluffyStuff/riichi-mahjong-tiles)。

## 版权

Copyright © 2026 Lisang. All rights reserved.
