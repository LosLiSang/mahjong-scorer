# mahjong-scorer-web — H5（React + TS）

新的 H5 前端：React 18 + TypeScript + Vite，页面间通过 hash 路由切换（日麻计分 / 川麻积分 / 教学馆 / 设置）。

## 开发

```bash
cd apps/web
npm install
npm run dev      # http://localhost:5173
```

## 构建

```bash
npm run build    # tsc 类型检查 + vite 打包到 dist/
npm run preview  # 本地预览 dist/
```

`dist/` 是纯静态产物（牌图会一并拷入），部署到任意静态服务器即可。

## 与小程序共享的部分

- 计分核心直接引用 `miniprogram/utils/mahjong-logic.js` 与 `miniprogram/utils/game-engine.js`（见 `vite.config.ts` 的 alias 与 `optimizeDeps`，CommonJS 以预打包方式接入），**没有复制任何逻辑代码**。
- 牌图来自 `miniprogram/assets/tiles/`（通过 `publicDir` 指向），同样只有一份。

## 待办

- 川麻计分页、教学馆内容迁移
- 联机房间：等待 TS + SQLite 的房间后端就绪后接入（与小程序共用 `packages/room-core` 领域核心）
