import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// 单一真源：计分核心与牌图直接引用 miniprogram/ 内的唯一副本，不复制。
export default defineConfig({
  plugins: [react()],
  publicDir: fileURLToPath(new URL('../../miniprogram/assets', import.meta.url)),
  resolve: {
    alias: {
      '@shared/mahjong-logic': fileURLToPath(
        new URL('../../miniprogram/utils/mahjong-logic.js', import.meta.url)
      ),
      '@shared/game-engine': fileURLToPath(
        new URL('../../miniprogram/utils/game-engine.js', import.meta.url)
      )
    }
  },
  server: {
    fs: {
      allow: [fileURLToPath(new URL('../..', import.meta.url))]
    }
  },
  build: {
    commonjsOptions: {
      include: [/node_modules/, /mahjong-logic\.js$/, /game-engine\.js$/]
    }
  },
  optimizeDeps: {
    include: ['@shared/mahjong-logic', '@shared/game-engine']
  }
});
