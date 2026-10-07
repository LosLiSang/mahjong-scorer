// 共享计分核心的唯一引用入口。实现文件在 miniprogram/utils/（单一真源），
// 通过 vite.config.ts 的 alias 以 CommonJS 预打包方式接入。
import logicModule from '@shared/mahjong-logic';
import engineModule from '@shared/game-engine';
import type { GameEngineApi, MahjongLogicApi } from './types';

export const Logic = logicModule as unknown as MahjongLogicApi;
export const Engine = engineModule as unknown as GameEngineApi;
