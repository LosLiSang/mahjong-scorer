# 日麻计分器 · H5 → 微信小程序全量迁移计划

> **For Hermes:** 分阶段实施，每阶段完成后验证。

**目标：** 将 `feat/h5-mahjong-tutorial` 分支的全部五个模块迁移到微信小程序，基于现有 `feat/wechat-mini-program` 架构扩展。

**架构：** 微信小程序原生框架（WXML/WXSS/JS）+ Tab 导航。共享工具层用 CommonJS (`require`)，数据文件从浏览器全局变量转为 module.exports。

---

## 当前状态

| 模块 | H5 (feat/h5-mahjong-tutorial) | 小程序 (feat/wechat-mini-program) |
|------|-------------------------------|-----------------------------------|
| 日麻计分器 | ✅ 四麻+三麻、立直/流局/和牌、手牌录入、面子和条件修正 | ✅ 仅四麻基本功能 |
| 教学馆 | ✅ 8节课+测验+localStorage进度 | ❌ |
| 役种图鉴 | ✅ 分类过滤+详情卡 | ❌ |
| 算分详解 | ✅ 符/点/满贯三Tab+计算器 | ❌ |
| 川麻积分 | ✅ 番型组合+杠分+罚分+定缺 | ❌ |

---

## 阶段 0：基础设施（一次性）

### 0.1 分支策略
```bash
git checkout feat/wechat-mini-program
git merge feat/h5-mahjong-tutorial --no-commit
# 手动处理冲突，保留小程序 miniprogram/ 目录
```

### 0.2 共享工具层转换
- `yaku-data.js` → `miniprogram/utils/yaku-data.js`（浏览器全局 → module.exports）
- `tutorial-data.js` → `miniprogram/utils/tutorial-data.js`
- `scoring-guide-data.js` → `miniprogram/utils/scoring-guide-data.js`
- `sichuan-score.js` → `miniprogram/utils/sichuan-score.js`
- `miniprogram/utils/shared.js`：抽公共函数（tileSrc, tileName, TILE_DEFS, CATEGORY_LABELS, formatYakuHan 等）

### 0.3 TILES 资源路径
将 H5 `tiles/` 中的新牌（Dora 变体等）复制到 `miniprogram/assets/tiles/`

### 0.4 app.json 导航升级
```json
{
  "pages": [
    "pages/index/index",
    "pages/tutorial/index",
    "pages/yaku-catalog/index",
    "pages/scoring-guide/index",
    "pages/sichuan/index"
  ],
  "tabBar": {
    "list": [
      { "pagePath": "pages/index/index", "text": "计分" },
      { "pagePath": "pages/tutorial/index", "text": "教学" },
      { "pagePath": "pages/sichuan/index", "text": "川麻" }
    ]
  }
}
```
（役种图鉴和算分详解作为教学馆的子页面，不从 tabBar 进入）

---

## 阶段 1：日麻计分器升级（最优先）

目标：将现有小程序计分器从仅四麻升级为与 H5 对等的四麻+三麻版本。

### 1.1 game-engine.js 升级
- ✅ 已有 `newGame()`，需增加三麻支持（MODE_CONFIG）
- 增加 `newGameSanma()` 或扩展 `newGame(mode)` 
- 三麻特有：拔北 dra、自摸损规则、35000起/40000返
- 保留 `applyWin`, `applyRiichi`, `applyDraw`

### 1.2 计分器页面 UI 重做
- **十字牌桌布局**：H5 用 CSS Grid `table-board` 布局，小程序用 flex+绝对定位实现同等效果
- **三麻模式**：隐藏北家、桌板加 `mode-sanma` 类
- **玩家卡片**：支持点击编辑姓名、立直标记
- **顶部导航**：日麻计分 | 川麻积分 | 学日麻（页面级 tab，非 app tabBar）
  - H5 用 `showAppView()` 切换三个 view
  - 小程序这里实际应该拆到不同页面，由 tabBar 切换

### 1.3 和牌面板增强
- 三麻模式显示「拔北数量」选择器
- 「分析牌型」按钮 + 自动填充翻/符数
- 面子修正（明/暗/杠切换）
- 特殊和牌条件（一发/海底/河底/抢杠/岭上）
- 计算结果显示

---

## 阶段 2：教学馆

目标：独立页面 `pages/tutorial/index`

### 2.1 页面结构
- 课程列表（8节，卡片式）
- 进度条（percent + n/8）
- 入门测验入口
- 下方嵌入役种图鉴和算分详解入口（点击跳转子页面）

### 2.2 课程弹窗
- 用 `<view class="overlay">` + `<scroll-view class="modal">`
- 课程内容：标题、摘要、要点列表、牌例（`<image>` 展示）、tip
- 「学完这节」按钮 → 存储进度到 `wx.setStorageSync('mj_tutorial_progress_v1', ...)`

### 2.3 入门测验
- 6 道 MCQ，逐题展示
- 选答案 → 确认 → 显示解析 → 下一题
- 最后显示成绩和评语

---

## 阶段 3：役种图鉴

目标：独立页面 `pages/yaku-catalog/index`

### 3.1 列表视图
- 分类过滤 chips：1翻/2翻/3翻/6翻/役满
- 役种卡片 grid（名称、翻数 badge、简要条件）
- 点击进入详情

### 3.2 详情视图
- 翻数 badge
- 成立条件
- 牌例（`<image>` 牌面展示）
- 易错点
- 打牌建议
- 鸣牌限制
- 返回列表按钮

---

## 阶段 4：算分详解

目标：独立页面 `pages/scoring-guide/index`

### 4.1 三 Tab 结构
- 符数详解：符数参考表 + 完整计算例子
- 点数计算：公式说明 + 交互式计算器（番数/符数 select + 亲子 toggle + 荣和/自摸 toggle）
- 满贯档位：各档位表（基本点、子家/亲家支付额）

### 4.2 计算器
- 番数 select (1-13)、符数 select (20-110)
- 子家/亲家 toggle
- 荣和/自摸 toggle
- 实时显示：总点数、公式、分配明细

---

## 阶段 5：川麻积分

目标：独立页面 `pages/sichuan/index`

### 5.1 页面结构
- Hero 区（说明文案）
- 十字牌桌：四个玩家卡片（分数、定缺显示）
- 操作按钮：胡牌积分、杠分、罚分/调整
- 工具栏：撤销、玩家设置、重置
- 记录列表

### 5.2 川麻积分录入弹窗
- 收分玩家选择
- 付款玩家多选
- 番型多选（平胡/对对胡/清一色/... 带牌例图）+ 根数 + 底分
- 手动金额模式
- 备注输入
- 预览显示

### 5.3 玩家设置
- 四人姓名编辑
- 定缺记录（万/筒/索/未定，点玩家卡片弹出选择）

---

## 关键转换规则（H5 DOM → 小程序 WXML）

| H5 | 小程序 |
|----|--------|
| `document.getElementById()` | `this.selectComponent()` 或 data 绑定 |
| `element.innerHTML = ...` | `this.setData({ key: value })` + WXML `{{key}}` |
| `element.classList.toggle()` | `this.setData({ className: condition })` + WXML `class="{{condition ? 'active' : ''}}"` |
| `element.onclick = fn` | `bindtap="fn"` |
| `element.style.display = ...` | `wx:if="{{condition}}"` |
| `localStorage` | `wx.setStorageSync / wx.getStorageSync` |
| `<img src>` | `<image src mode="aspectFit">` |
| `<button>` | `<button>` （小程序原生） |
| `<select>` | `<picker>` 或自定义 seg-group |
| `<input type="number">` | `<input type="number">` |
| CSS `position: fixed` overlay | `<view class="overlay">` + `wx:if` |

---

## 排期与优先级

1. **阶段 0**（基础设施）→ 1h
2. **阶段 1**（计分器升级）→ 2h
3. **阶段 2**（教学馆）→ 1.5h
4. **阶段 3**（役种图鉴）→ 1h
5. **阶段 4**（算分详解）→ 1h
6. **阶段 5**（川麻积分）→ 2h

总计约 8.5h，实际按迭代推进。

---

## 验证方式

每阶段完成后用微信开发者工具打开 `miniprogram/` 目录：
1. 编译无报错
2. 各页面渲染正常
3. 核心交互流程（和牌结算、课程学习、图鉴查看、算分计算、川麻记分）可走通
4. 数据持久化（storage）正常
