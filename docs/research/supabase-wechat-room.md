# Supabase 用于微信小程序实时房间的可行性

调查日期：2026-08-22

## 结论

Supabase **可以通过自建适配层接入**微信小程序，但不适合作为本项目第一版“免费且最简单”的实时房间后端。第一版优先采用微信云开发。

## 主要原因

### 1. 官方 Supabase JavaScript SDK 不直接承诺微信小程序运行时

Supabase JS 的官方支持策略要求浏览器环境提供原生 `fetch`，Realtime 还要求原生 `WebSocket`。微信小程序使用的是 `wx.request` 和 `wx.connectSocket`，不是浏览器原生接口，因此不能假设 `@supabase/supabase-js` 可直接运行；至少需要请求和 WebSocket 适配层，且必须做真机验证。

来源：

- [Supabase JS SDK README — Support Policy](https://github.com/supabase/supabase-js#support-policy)
- [微信小程序网络文档](https://developers.weixin.qq.com/miniprogram/dev/framework/ability/network.html)

### 2. 正式微信小程序存在服务器域名限制

微信官方要求：

- 小程序只能与后台配置过的通讯域名通信；
- HTTPS 请求和 WSS WebSocket 域名均需配置；
- 域名必须经过 ICP 备案；
- 开发者工具中关闭域名校验只适用于开发调试，不能作为正式发布方案。

Supabase 项目默认使用 Supabase 托管域名。若该域名无法通过小程序后台的服务器域名校验，就需要再增加一个已备案的代理域名和服务器，失去“最简单、零额外成本”的优势。

来源：

- [微信小程序网络文档 — 服务器域名配置](https://developers.weixin.qq.com/miniprogram/dev/framework/ability/network.html)

### 3. 微信 OpenID 与 Supabase Auth 之间需要额外认证桥接

本项目要求使用微信 OpenID 认回房间身份。Supabase 官方支持匿名登录、OIDC 身份令牌和受支持的第三方 JWT，但微信登录不是可直接套用的浏览器 OIDC 登录流程。采用 Supabase 时仍需要可信后端：用小程序登录 code 调用微信接口换取 OpenID，再签发或映射 Supabase 身份，并配置 RLS。

来源：

- [Supabase Auth](https://supabase.com/docs/guides/auth)
- [Supabase Third-party Auth](https://supabase.com/docs/guides/auth/third-party/overview)
- [Supabase Anonymous Sign-ins](https://supabase.com/docs/guides/auth/auth-anonymous)

### 4. 免费额度足够小规模使用，但不是永久免费、零维护保证

Supabase 当前 Free Plan 包括：

- 每项目 500 MB 数据库；
- 5 GB egress；
- Realtime 200 个峰值并发连接；
- 每月 200 万条 Realtime 消息；
- 免费项目连续一周无活动后可能暂停。

这些额度足够本项目“少于 10 个同时在线房间”的容量，但项目暂停、域名接入、SDK 适配和微信身份桥接仍会增加运维与实现复杂度。

来源：

- [Supabase Pricing](https://supabase.com/pricing)
- [Supabase Billing](https://supabase.com/docs/guides/platform/billing-on-supabase)

## 方案比较

| 项目 | 微信云开发 | Supabase |
|---|---|---|
| 微信 OpenID | 云函数中直接获得 | 需要认证桥接 |
| 小程序网络接入 | 原生集成 | 需域名白名单，可能涉及 ICP/代理 |
| 实时监听 | 云数据库原生能力 | 需适配 Realtime WebSocket |
| SDK 兼容性 | 小程序原生 | 官方 SDK 未明确支持微信小程序 |
| 首期开发量 | 较低 | 较高 |
| 跨 H5 扩展 | 一般 | 较好 |
| 当前需求匹配 | 高 | 低 |

## 决策

第一版使用微信云开发，并把房间访问封装在独立的 `room-service` 接口后面。未来如果需要 H5 与小程序互通，可以替换服务实现或增加统一后端，而不让页面直接依赖云数据库细节。
