# 日麻整场计分器

面向手机端面麻使用的纯前端日麻计分工具。

## 功能

- 四人 / 三人整场点数、本场与供托管理
- 三麻模式：35000 点起、东南各三局、自摸损、2000 点流局罚符、拔北计数、二万到八万移除
- 川麻独立积分账本：十字牌桌、牌图定缺、番型牌例、胡牌番型组合、杠分、花猪/查叫与手动调整
- SVG 麻将牌选牌器
- 指定最终和牌张
- 普通牌型、七对子、国士无双与役满分析
- 暗刻、明刻、暗杠、明杠及副露顺子修正
- 立直、两立直、一发、海底、河底、抢杠、岭上条件
- 多张表宝牌与裏宝牌指示牌
- 自动计算役、番、符与最终支付
- H5 日麻入门教学馆：6 节短课、真实牌图示例、学习进度与 6 题测验

## 使用

这是纯静态项目，直接用浏览器打开 `index.html`，或通过任意静态 HTTP 服务器部署。

```bash
python3 -m http.server 8080
```

访问 `http://localhost:8080`。

## 测试

```bash
node test-logic.js
node test-scoring-guide.js
node test-sichuan-score.js
node test-tutorial.js
node test-yaku-catalog.js
```

小程序分支另运行：

```bash
node test-miniprogram.js
```

## 线上地址

<https://mj.lisang.top>

## 牌图

麻将牌 SVG 来源于 [FluffyStuff/riichi-mahjong-tiles](https://github.com/FluffyStuff/riichi-mahjong-tiles)。
