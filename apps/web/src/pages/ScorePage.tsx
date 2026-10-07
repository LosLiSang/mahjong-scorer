import { useEffect, useMemo, useRef, useState } from 'react';
import { Engine, Logic } from '../lib/shared';
import { TILE_DEFS, tileDisplay, tileImgSrc } from '../lib/tiles';
import { loadGame, saveGame } from '../lib/game';
import type {
  Decomp,
  EvalResult,
  Game,
  MentsuOverride,
  RiichiState,
  WinConditions,
  WinPaymentResult
} from '../lib/types';
import './score.css';

const SEATS = ['东', '南', '西', '北'];
const RETURN_POINTS = 30000;
const HAN_OPTIONS = Array.from({ length: 13 }, (_, i) => i + 1);
const FU_OPTIONS = [20, 25, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130];
const WAIT_NAMES: Record<string, string> = {
  ryanmen: '两面', kanchan: '嵌张', penchan: '边张', tanki: '单骑', shanpon: '双碰'
};

type ModalName = null | 'win' | 'riichi' | 'draw' | 'history' | 'settings' | 'end';

interface WinPayload {
  winnerIdx: number;
  loserIdx: number;
  isTsumo: boolean;
  han: number;
  fu: number;
  hand: string[];
}

function sortHand(tiles: string[]): string[] {
  return [...tiles].sort(
    (a, b) => TILE_DEFS.findIndex((t) => t.id === a) - TILE_DEFS.findIndex((t) => t.id === b)
  );
}

function hanLabel(han: number, fu: number): string {
  if (han >= 13) return '役满';
  if (han >= 11) return '三倍满';
  if (han >= 8) return '倍满';
  if (han >= 6) return '跳满';
  if (han >= 5) return '满贯';
  return `${han}翻${fu}符`;
}

// 宝牌指示牌的下一张（循环规则）
function nextDoraTile(id: string): string {
  if (id.endsWith('z')) {
    const n = parseInt(id, 10);
    if (n <= 4) return ((n % 4) + 1) + 'z';
    return (((n - 5) % 3) + 5) + 'z';
  }
  const n = parseInt(id, 10);
  const suit = id.slice(-1);
  return ((n % 9) + 1) + suit;
}

function checkGameEnd(game: Game): boolean {
  if (game.roundIndex >= 8) return true;
  if (game.roundIndex === 7 && game.dealerIndex === 3) {
    const top = Math.max(...game.players.map((p) => p.points));
    if (top >= RETURN_POINTS) return true;
  }
  return false;
}

export default function ScorePage() {
  const [game, setGame] = useState<Game>(() => loadGame());
  const [undoStack, setUndoStack] = useState<Game[]>([]);
  const [modal, setModal] = useState<ModalName>(null);
  const [deltas, setDeltas] = useState<Record<number, number>>({});
  const [riichiSel, setRiichiSel] = useState<number[]>([]);
  const [tenpaiSel, setTenpaiSel] = useState<number[]>([]);
  const [nameDraft, setNameDraft] = useState<string[]>([]);
  const deltaTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    saveGame(game);
  }, [game]);

  useEffect(() => () => window.clearTimeout(deltaTimer.current), []);

  function applyWithSnapshot(next: Game) {
    setUndoStack((stack) => [...stack.slice(-19), game]);
    setGame(next);
    const changes: Record<number, number> = {};
    next.players.forEach((p, i) => {
      const delta = p.points - game.players[i].points;
      if (delta !== 0) changes[i] = delta;
    });
    window.clearTimeout(deltaTimer.current);
    setDeltas(changes);
    deltaTimer.current = window.setTimeout(() => setDeltas({}), 2500);
    if (checkGameEnd(next)) setModal('end');
  }

  function confirmWin(payload: WinPayload) {
    const result = Engine.calcWinPayments(
      game, payload.winnerIdx, payload.han, payload.fu, payload.isTsumo, payload.loserIdx
    );
    const next = Engine.applyWin(
      game,
      {
        winnerIdx: payload.winnerIdx,
        loserIdx: payload.loserIdx,
        isTsumo: payload.isTsumo,
        han: payload.han,
        fu: payload.fu
      },
      result
    );
    if (next.history[0] && next.history[0].type === 'win') {
      next.history[0] = { ...next.history[0], hand: sortHand(payload.hand) };
    }
    setModal(null);
    applyWithSnapshot(next);
  }

  function confirmRiichi() {
    setModal(null);
    applyWithSnapshot(Engine.applyRiichi(game, riichiSel));
    setRiichiSel([]);
  }

  function confirmDraw() {
    setModal(null);
    applyWithSnapshot(Engine.applyDraw(game, tenpaiSel));
    setTenpaiSel([]);
  }

  function undoLast() {
    if (undoStack.length === 0) {
      window.alert('没有可撤销的操作');
      return;
    }
    const previous = undoStack[undoStack.length - 1];
    setUndoStack((stack) => stack.slice(0, -1));
    setGame(previous);
    setModal(null);
  }

  function resetGame() {
    if (!window.confirm('确定重置新对局？')) return;
    setUndoStack([]);
    setGame(Engine.newGame(4));
    setModal(null);
  }

  function saveNames() {
    setGame({
      ...game,
      players: game.players.map((p, i) => ({
        ...p,
        name: nameDraft[i] !== undefined && nameDraft[i].trim() ? nameDraft[i].trim() : p.name
      }))
    });
    setModal(null);
  }

  function openRiichi() {
    setRiichiSel(game.players.map((p, i) => (p.riichi ? i : -1)).filter((i) => i >= 0));
    setModal('riichi');
  }

  const roundName = Engine.roundNames(game)[game.roundIndex] || `第${game.roundIndex + 1}局`;

  return (
    <div className="score-page">
      <div className="status-bar">
        <div className="round-info">{roundName}局</div>
        <div className="sub-info">本场 {game.honba} · 供托 {game.riichiSticks * 1000}</div>
      </div>

      <div className="players">
        {game.players.map((p, i) => (
          <div
            key={i}
            className={'player-card' + (i === game.dealerIndex ? ' dealer' : '') + (p.riichi ? ' riichi' : '')}
          >
            <div className="seat">{SEATS[i]}{i === game.dealerIndex ? ' · 亲' : ''}</div>
            <div className="name">{p.name}</div>
            <div className="points">{p.points}</div>
            <div className={'delta' + ((deltas[i] ?? 0) < 0 ? ' minus' : '')}>
              {deltas[i] ? (deltas[i] > 0 ? '+' : '') + deltas[i] : ''}
            </div>
            {p.riichi && <div className="riichi-mark">●</div>}
          </div>
        ))}
      </div>

      <div className="actions">
        <button className="btn" onClick={() => setModal('win')}>和牌结算</button>
        <div className="btn-row">
          <button className="btn btn-secondary btn-small" onClick={openRiichi}>立直</button>
          <button className="btn btn-secondary btn-small" onClick={() => setModal('draw')}>流局</button>
        </div>
        <div className="toolbar">
          <button className="btn btn-danger btn-small" onClick={undoLast}>撤销</button>
          <button className="btn btn-danger btn-small" onClick={() => setModal('history')}>记录</button>
          <button className="btn btn-danger btn-small" onClick={() => { setNameDraft(game.players.map((p) => p.name)); setModal('settings'); }}>设置</button>
          <button className="btn btn-danger btn-small" onClick={resetGame}>重置</button>
        </div>
      </div>

      {modal === 'win' && (
        <WinModal game={game} onClose={() => setModal(null)} onConfirm={confirmWin} />
      )}

      {modal === 'riichi' && (
        <div className="overlay">
          <div className="modal">
            <h3>谁立直？</h3>
            <div className="seg-group">
              {game.players.map((p, i) => (
                <div
                  key={i}
                  className={'seg-btn' + (riichiSel.includes(i) ? ' active' : '')}
                  onClick={() =>
                    setRiichiSel((sel) =>
                      sel.includes(i) ? sel.filter((x) => x !== i) : [...sel, i]
                    )
                  }
                >
                  {SEATS[i]}{p.riichi ? ' ●' : ''}
                </div>
              ))}
            </div>
            <div className="btn-row" style={{ marginTop: 14 }}>
              <button className="btn btn-secondary" onClick={() => setModal(null)}>取消</button>
              <button className="btn" onClick={confirmRiichi}>确认</button>
            </div>
          </div>
        </div>
      )}

      {modal === 'draw' && (
        <div className="overlay">
          <div className="modal">
            <h3>流局听牌</h3>
            <div className="seg-group">
              {game.players.map((p, i) => (
                <div
                  key={i}
                  className={'seg-btn' + (tenpaiSel.includes(i) ? ' active' : '')}
                  onClick={() =>
                    setTenpaiSel((sel) =>
                      sel.includes(i) ? sel.filter((x) => x !== i) : [...sel, i]
                    )
                  }
                >
                  {SEATS[i]} ({p.points})
                </div>
              ))}
            </div>
            <div className="btn-row" style={{ marginTop: 14 }}>
              <button className="btn btn-secondary" onClick={() => setModal(null)}>取消</button>
              <button className="btn" onClick={confirmDraw}>确认流局</button>
            </div>
          </div>
        </div>
      )}

      {modal === 'history' && (
        <div className="overlay">
          <div className="modal">
            <h3>对局记录</h3>
            <div className="history-list">
              {game.history.length === 0 && <div className="history-item">暂无记录</div>}
              {game.history.map((h, idx) => (
                <div className="history-item" key={idx}>
                  {h.type === 'win' ? (
                    <>
                      {h.round} · <span className="who">{game.players[h.winner ?? 0]?.name}</span>{' '}
                      {h.isTsumo ? '自摸' : '荣和'} {hanLabel(h.han ?? 0, h.fu ?? 0)} +{h.total}
                      {!!h.hand?.length && (
                        <div className="history-hand">
                          {h.hand.map((id, tIdx) => (
                            <img key={tIdx} src={tileImgSrc(id)} alt={tileDisplay(id)} />
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <>{h.round} · 流局（听：{(h.tenpai ?? []).map((i) => SEATS[i]).join('') || '无人'}）</>
                  )}
                </div>
              ))}
            </div>
            <button className="btn btn-secondary" style={{ marginTop: 14 }} onClick={() => setModal(null)}>关闭</button>
          </div>
        </div>
      )}

      {modal === 'settings' && (
        <div className="overlay">
          <div className="modal">
            <h3>对局设置</h3>
            <label>玩家姓名</label>
            {game.players.map((p, i) => (
              <input
                key={i}
                value={nameDraft[i] ?? ''}
                onChange={(e) =>
                  setNameDraft((draft) => draft.map((v, j) => (j === i ? e.target.value : v)))
                }
                maxLength={12}
                placeholder={p.name}
                style={{ marginBottom: 8 }}
              />
            ))}
            <div className="btn-row" style={{ marginTop: 14 }}>
              <button className="btn btn-secondary" onClick={() => setModal(null)}>取消</button>
              <button className="btn" onClick={saveNames}>保存</button>
            </div>
          </div>
        </div>
      )}

      {modal === 'end' && (
        <div className="overlay">
          <div className="modal">
            <h3>对局结束</h3>
            {[...game.players]
              .map((p, i) => ({ ...p, idx: i }))
              .sort((a, b) => b.points - a.points)
              .map((p, rank) => (
                <div className="result-box" key={p.idx}>
                  <div className="rank-line">第{rank + 1}名 {p.name}</div>
                  <div className="points">{p.points}</div>
                </div>
              ))}
            <button className="btn" style={{ marginTop: 14 }} onClick={resetGame}>新对局</button>
          </div>
        </div>
      )}
    </div>
  );
}

interface AnalysisView {
  result: EvalResult;
  payments: WinPaymentResult;
  dora: number;
  conditionNames: string[];
}

function WinModal({
  game,
  onClose,
  onConfirm
}: {
  game: Game;
  onClose: () => void;
  onConfirm: (payload: WinPayload) => void;
}) {
  const [winnerIdx, setWinnerIdx] = useState(game.dealerIndex);
  const [isTsumo, setIsTsumo] = useState(false);
  const [loserIdx, setLoserIdx] = useState(game.dealerIndex === 0 ? 1 : 0);
  const [riichiState, setRiichiState] = useState<RiichiState>(
    game.players[game.dealerIndex]?.riichi ? 'riichi' : 'none'
  );
  const [hand, setHand] = useState<string[]>([]);
  const [tileHistory, setTileHistory] = useState<(string | { removed: string; at: number })[]>([]);
  const [winTile, setWinTile] = useState<string | null>(null);
  const [doraIndicators, setDoraIndicators] = useState<string[]>([]);
  const [uraDoraIndicators, setUraDoraIndicators] = useState<string[]>([]);
  const [mentsuOverride, setMentsuOverride] = useState<MentsuOverride[] | null>(null);
  const [pairOverride, setPairOverride] = useState<string[] | null>(null);
  const [decompIndex, setDecompIndex] = useState(0);
  const [analysisStage, setAnalysisStage] = useState(0);
  const [conditions, setConditions] = useState<WinConditions>({
    isIppatsu: false,
    isLastTileTsumo: false,
    isLastTileRon: false,
    isRobbingKan: false,
    isWinFromDeadWall: false
  });
  const [han, setHan] = useState(3);
  const [fu, setFu] = useState(30);
  const [notice, setNotice] = useState('');
  const [resultView, setResultView] = useState<AnalysisView | null>(null);
  const [fuLines, setFuLines] = useState<string[] | null>(null);

  const hasAnalysisRiichi = riichiState !== 'none';

  const decomps = useMemo<Decomp[]>(() => {
    if (hand.length < 14 || hand.length > 18) return [];
    const counts: Record<string, number> = {};
    hand.forEach((t) => {
      counts[t] = (counts[t] || 0) + 1;
    });
    const kanCandidates = new Set(Object.keys(counts).filter((id) => counts[id] === 4));
    try {
      return Logic.decompose(counts, new Set(), kanCandidates);
    } catch {
      return [];
    }
  }, [hand]);

  const doraCount = useMemo(() => {
    let count = 0;
    doraIndicators.forEach((ind) => {
      const dora = nextDoraTile(ind);
      count += hand.filter((t) => t === dora).length;
    });
    if (hasAnalysisRiichi) {
      uraDoraIndicators.forEach((ind) => {
        const dora = nextDoraTile(ind);
        count += hand.filter((t) => t === dora).length;
      });
    }
    return count;
  }, [hand, doraIndicators, uraDoraIndicators, hasAnalysisRiichi]);

  const preview = useMemo(
    () => Engine.calcWinPayments(game, winnerIdx, han, fu, isTsumo, loserIdx),
    [game, winnerIdx, han, fu, isTsumo, loserIdx]
  );

  function invalidateAnalysis() {
    setAnalysisStage(0);
    setMentsuOverride(null);
    setPairOverride(null);
    setDecompIndex(0);
    setNotice('');
    setResultView(null);
    setFuLines(null);
  }

  function addTile(tileId: string) {
    if (hand.filter((t) => t === tileId).length >= 4) return;
    setHand(sortHand([...hand, tileId]));
    setTileHistory([...tileHistory, tileId]);
    invalidateAnalysis();
  }

  function removeTileAt(index: number) {
    const removed = hand[index];
    const rest = hand.filter((_, i) => i !== index);
    if (winTile === removed && !rest.includes(removed)) setWinTile(null);
    setHand(sortHand(rest));
    setTileHistory([...tileHistory, { removed, at: index }]);
    invalidateAnalysis();
  }

  function clearHand() {
    setHand([]);
    setTileHistory([]);
    setWinTile(null);
    invalidateAnalysis();
  }

  function undoTile() {
    if (tileHistory.length === 0) return;
    const last = tileHistory[tileHistory.length - 1];
    const restHistory = tileHistory.slice(0, -1);
    let next = [...hand];
    if (typeof last === 'string') {
      const idx = next.lastIndexOf(last);
      if (idx >= 0) next.splice(idx, 1);
    } else {
      next.splice(last.at, 0, last.removed);
    }
    next = sortHand(next);
    setHand(next);
    setTileHistory(restHistory);
    invalidateAnalysis();
  }

  function selectWinner(i: number) {
    setWinnerIdx(i);
    setRiichiState(game.players[i]?.riichi ? 'riichi' : 'none');
    if (i === loserIdx) setLoserIdx(game.players.findIndex((_, j) => j !== i));
    invalidateAnalysis();
  }

  function selectLoser(i: number) {
    setLoserIdx(i);
  }

  function selectWinTile(id: string) {
    setWinTile(id);
    invalidateAnalysis();
  }

  function selectRiichiState(state: RiichiState) {
    setRiichiState(state);
    if (state === 'none') {
      setConditions((c) => ({ ...c, isIppatsu: false }));
    }
    if (analysisStage) setNotice('立直状态已修改，请重新分析');
  }

  function toggleCondition(key: keyof WinConditions, disabled: boolean) {
    if (disabled) return;
    const next: WinConditions = { ...conditions };
    next[key] = !next[key];
    if (key === 'isLastTileTsumo' && next[key]) next.isLastTileRon = false;
    if (key === 'isLastTileRon' && next[key]) next.isLastTileTsumo = false;
    if (key === 'isRobbingKan' && next[key]) {
      next.isWinFromDeadWall = false;
      next.isLastTileTsumo = false;
    }
    if (key === 'isWinFromDeadWall' && next[key]) {
      next.isRobbingKan = false;
      next.isLastTileRon = false;
    }
    if (!hasAnalysisRiichi) next.isIppatsu = false;
    setConditions(next);
    if (analysisStage) setNotice('条件已修改，请再次点击“重新分析并更新结果”更新结果');
  }

  function getOpenMentsus() {
    const open: { type: string; tiles: string[]; open: boolean }[] = [];
    const closedKantsus: string[] = [];
    (mentsuOverride || []).forEach((mo) => {
      if (mo.isKan && mo.isOpen) {
        open.push({ type: 'kantsu', tiles: [mo.tiles[0], mo.tiles[0], mo.tiles[0], mo.tiles[0]], open: true });
      } else if (mo.isKan && !mo.isOpen) {
        closedKantsus.push(mo.tiles[0]);
      } else if (mo.isOpen) {
        open.push({ type: mo.baseType, tiles: mo.tiles, open: true });
      }
    });
    return { open, closedKantsus };
  }

  function analyze() {
    if (hand.length < 14 || hand.length > 18) {
      setNotice('请先选好 14-18 张牌；每有一个杠，就比 14 张多一张。');
      return;
    }
    if (!winTile) {
      setNotice('请先选择“最终和牌张”，否则无法判断单骑、边张、嵌张和四暗刻单骑。');
      return;
    }
    if (decomps.length === 0) {
      setNotice('暂时无法分解和牌形，请检查手牌。');
      return;
    }
    const safeIndex = decompIndex >= decomps.length ? 0 : decompIndex;
    if (safeIndex !== decompIndex) setDecompIndex(0);
    let override = mentsuOverride;
    if (!override) {
      const decomp = decomps[safeIndex];
      override = decomp.mentsus.map((m) => ({
        tiles: m.type === 'kantsu' ? m.tiles.slice(0, 3) : [...m.tiles],
        baseType: (m.type === 'kantsu' ? 'koutsu' : m.type) as MentsuOverride['baseType'],
        isOpen: !!m.open,
        isKan: m.type === 'kantsu'
      }));
      setMentsuOverride(override);
      setPairOverride([...decomp.pair.tiles]);
    }

    const { open, closedKantsus } = getOpenMentsusFrom(override);
    const params: Record<string, unknown> = {
      tiles: [...hand],
      isOpened: open.length > 0,
      openMentsus: open,
      closedKantsus,
      isTsumo,
      isRiichi: riichiState === 'riichi',
      isDoubleRiichi: riichiState === 'double',
      isIppatsu: conditions.isIppatsu,
      isRobbingKan: conditions.isRobbingKan,
      isWinFromDeadWall: conditions.isWinFromDeadWall,
      isLastTile: isTsumo ? conditions.isLastTileTsumo : conditions.isLastTileRon,
      winTile,
      roundWind: ['1z', '2z', '3z', '4z'][Math.floor(game.roundIndex / 4) % 4],
      seatWind: ['1z', '2z', '3z', '4z'][winnerIdx],
      doraCount: doraCount,
      akadoraCount: 0
    };
    const result = Logic.evaluateHand(params);
    setAnalysisStage(1);
    setNotice('');
    setFuLines(null);
    if (!result.valid) {
      setResultView(null);
      setNotice(
        `暂时无法成立和牌：${result.error || '没有合法和牌形或没有役'}。请检查面子分组、明暗/杠子、最终和牌张和和牌条件后再次分析。`
      );
      return;
    }
    const resultHan = result.isYakuman ? 13 : result.han ?? 1;
    const resultFu = result.fu || 30;
    setHan(Math.min(resultHan, 13));
    setFu(resultFu);
    const payments = Engine.calcWinPayments(game, winnerIdx, resultHan, resultFu, isTsumo, loserIdx, result.basePoint);
    const conditionNames: string[] = [];
    if (conditions.isIppatsu) conditionNames.push('一发');
    if (conditions.isLastTileTsumo) conditionNames.push('海底摸月');
    if (conditions.isLastTileRon) conditionNames.push('河底捞鱼');
    if (conditions.isRobbingKan) conditionNames.push('抢杠');
    if (conditions.isWinFromDeadWall) conditionNames.push('岭上开花');
    if (riichiState === 'riichi') conditionNames.push('立直');
    if (riichiState === 'double') conditionNames.push('两立直');
    setResultView({ result, payments, dora: doraCount, conditionNames });
  }

  function getOpenMentsusFrom(override: MentsuOverride[]) {
    const open: { type: string; tiles: string[]; open: boolean }[] = [];
    const closedKantsus: string[] = [];
    override.forEach((mo) => {
      if (mo.isKan && mo.isOpen) {
        open.push({ type: 'kantsu', tiles: [mo.tiles[0], mo.tiles[0], mo.tiles[0], mo.tiles[0]], open: true });
      } else if (mo.isKan && !mo.isOpen) {
        closedKantsus.push(mo.tiles[0]);
      } else if (mo.isOpen) {
        open.push({ type: mo.baseType, tiles: mo.tiles, open: true });
      }
    });
    return { open, closedKantsus };
  }

  function showFuDetail() {
    if (fuLines) {
      setFuLines(null);
      return;
    }
    if (hand.length < 14 || hand.length > 18) {
      setFuLines(['请先选 14-18 张牌']);
      return;
    }
    if (!winTile) {
      setFuLines(['请先在“最终和牌张”区域选择胡牌的最后一张']);
      return;
    }
    if (decomps.length === 0) {
      setFuLines(['无法分解和牌形']);
      return;
    }
    const decomp = decomps[decompIndex >= decomps.length ? 0 : decompIndex];
    const isClosed = getOpenMentsus().open.length === 0;
    const lines: string[] = [`符数解析（${isClosed ? '门前' : '副露'} · ${isTsumo ? '自摸' : '荣和'}）`];
    let totalFu = 20;
    lines.push('副底: 20');

    const pairId = decomp.pair.tiles[0];
    const roundWind = ['1z', '2z', '3z', '4z'][Math.floor(game.roundIndex / 4) % 4];
    const seatWind = ['1z', '2z', '3z', '4z'][winnerIdx];
    let pairFu = 0;
    let pairLabel = tileDisplay(pairId);
    if (pairId === roundWind && pairId === seatWind) {
      pairFu = 4;
      pairLabel += '(连风)';
    } else if (pairId === roundWind || pairId === seatWind) {
      pairFu = 2;
      pairLabel += '(场/自风)';
    } else if (['5z', '6z', '7z'].includes(pairId)) {
      pairFu = 2;
      pairLabel += '(三元)';
    }
    if (pairFu > 0) {
      totalFu += pairFu;
      lines.push(`雀头 ${pairLabel}: +${pairFu}`);
    }

    const wait = Logic.detectWaitType(decomp, winTile);
    decomp.mentsus.forEach((m) => {
      if (m.type === 'shuntsu') return;
      const id = m.tiles[0];
      const yao = Logic.isYaochuu(id);
      const yaoLabel = yao ? '幺九' : '中张';
      const openLabel = m.open ? '明' : '暗';
      let mFu = 0;
      const typeLabel = m.type === 'kantsu' ? '杠' : '刻';
      if (m.type === 'kantsu') {
        mFu = ((m.open ? 16 : 32) * (yao ? 2 : 1)) / 2;
      } else {
        const ronCompletedTriplet = !isTsumo && wait === 'shanpon' && id === winTile;
        const effectiveOpen = m.open || ronCompletedTriplet;
        mFu = (effectiveOpen ? 2 : 4) * (yao ? 2 : 1);
      }
      totalFu += mFu;
      lines.push(`${openLabel}${typeLabel} ${tileDisplay(id)}(${yaoLabel}): +${mFu}`);
    });

    if (wait === 'kanchan') { totalFu += 2; lines.push('嵌张听: +2'); }
    else if (wait === 'penchan') { totalFu += 2; lines.push('边张听: +2'); }
    else if (wait === 'tanki') { totalFu += 2; lines.push('单骑听: +2'); }
    else lines.push('两面听: +0');

    if (isTsumo) {
      totalFu += 2;
      lines.push('自摸: +2');
    } else if (isClosed) {
      totalFu += 10;
      lines.push('门前荣和: +10');
    } else {
      lines.push('副露荣和: +0');
    }

    const rounded = Math.ceil(totalFu / 10) * 10;
    lines.push('');
    lines.push(`合计: ${totalFu}符 → 切整 ${rounded}符`);

    const { open, closedKantsus } = getOpenMentsus();
    const evalResult = Logic.evaluateHand({
      tiles: [...hand],
      isOpened: open.length > 0,
      openMentsus: open,
      closedKantsus,
      isTsumo,
      isRiichi: riichiState === 'riichi',
      isDoubleRiichi: riichiState === 'double',
      winTile,
      roundWind,
      seatWind,
      doraCount
    });
    if (evalResult.valid) {
      lines.push('');
      lines.push(`番数: ${evalResult.han}番 ${rounded}符`);
      lines.push(`役: ${(evalResult.yaku || []).map((y) => y.name).join(', ')}`);
      lines.push(`基本点: ${evalResult.basePoint}`);
    }
    setFuLines(lines);
  }

  const uniqueHandTiles = [...new Set(hand)];
  const conditionDefs: { key: keyof WinConditions; label: string; disabled: boolean }[] = [
    { key: 'isIppatsu', label: '一发', disabled: !hasAnalysisRiichi },
    { key: 'isLastTileTsumo', label: '海底摸月', disabled: isTsumo },
    { key: 'isLastTileRon', label: '河底捞鱼', disabled: !isTsumo },
    { key: 'isRobbingKan', label: '抢杠', disabled: !isTsumo },
    { key: 'isWinFromDeadWall', label: '岭上开花', disabled: !isTsumo }
  ];

  const autoHint = !analysisStage
    ? hand.length < 14
      ? `已选 ${hand.length} 张；选好牌后指定最终和牌张`
      : !winTile
        ? '请选择最终和牌张，然后点击“分析牌型”'
        : '点击“分析牌型”开始拆分面子并计算役、番、符和点数'
    : '';

  return (
    <div className="overlay">
      <div className="modal">
        <div className="modal-close" onClick={onClose}>✕</div>
        <h3>和牌结算</h3>

        <label>和牌者</label>
        <div className="seg-group">
          {game.players.map((p, i) => (
            <div
              key={i}
              className={'seg-btn' + (winnerIdx === i ? ' active' : '')}
              onClick={() => selectWinner(i)}
            >
              {SEATS[i]} ({p.points})
            </div>
          ))}
        </div>

        <label>方式</label>
        <div className="seg-group">
          <div className={'seg-btn' + (!isTsumo ? ' active' : '')} onClick={() => { setIsTsumo(false); invalidateAnalysis(); }}>荣和</div>
          <div className={'seg-btn' + (isTsumo ? ' active' : '')} onClick={() => { setIsTsumo(true); invalidateAnalysis(); }}>自摸</div>
        </div>

        {!isTsumo && (
          <>
            <label>放铳者</label>
            <div className="seg-group">
              {game.players.map((p, i) =>
                i === winnerIdx ? null : (
                  <div
                    key={i}
                    className={'seg-btn' + (loserIdx === i ? ' active' : '')}
                    onClick={() => selectLoser(i)}
                  >
                    {SEATS[i]} ({p.points})
                  </div>
                )
              )}
            </div>
          </>
        )}

        <label>立直状态</label>
        <div className="seg-group">
          <div className={'seg-btn' + (riichiState === 'none' ? ' active' : '')} onClick={() => selectRiichiState('none')}>未立直</div>
          <div className={'seg-btn' + (riichiState === 'riichi' ? ' active' : '')} onClick={() => selectRiichiState('riichi')}>立直</div>
          <div className={'seg-btn' + (riichiState === 'double' ? ' active' : '')} onClick={() => selectRiichiState('double')}>两立直</div>
        </div>
        <div className="riichi-hint">{hasAnalysisRiichi ? '裏宝牌有效' : '裏宝牌无效'}</div>

        <div className="hand-info">
          <span>手牌（选牌）</span>
          <span>{hand.length} 张</span>
        </div>
        <div className="hand-info" style={{ justifyContent: 'center' }}>{autoHint}</div>
        <div className="hand-area">
          {hand.length === 0 ? (
            <span className="empty-hint">点击下方麻将牌加入手牌</span>
          ) : (
            hand.map((id, idx) => (
              <img
                key={idx}
                className={'hand-tile-img' + (winTile === id && hand.findLastIndex((t) => t === id) === idx ? ' win-tile' : '')}
                src={tileImgSrc(id)}
                alt={tileDisplay(id)}
                title={`点击删除 ${tileDisplay(id)}`}
                onClick={() => removeTileAt(idx)}
              />
            ))
          )}
        </div>

        <div className="hand-info">
          <span>最终和牌张</span>
          <span>{winTile ? tileDisplay(winTile) : '未选择'}</span>
        </div>
        <div className="win-tile-picker">
          {uniqueHandTiles.length === 0 ? (
            <span className="win-tile-hint">选牌后在这里指定胡牌的最后一张</span>
          ) : (
            uniqueHandTiles.map((id) => (
              <button
                key={id}
                type="button"
                className={'win-tile-option' + (winTile === id ? ' active' : '')}
                title={tileDisplay(id)}
                onClick={() => selectWinTile(id)}
              >
                <img src={tileImgSrc(id)} alt={tileDisplay(id)} />
              </button>
            ))
          )}
        </div>

        <div className="tile-keyboard">
          {(['m', 'p', 's'] as const).map((suit) => (
            <div className="tile-row" key={suit}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => {
                const id = `${n}${suit}`;
                const count = hand.filter((t) => t === id).length;
                return (
                  <div
                    key={id}
                    className={'tile-key' + (count >= 4 ? ' disabled' : '')}
                    onClick={() => addTile(id)}
                  >
                    <img src={tileImgSrc(id)} alt={tileDisplay(id)} />
                    {count > 0 && <div className="count-badge">{count}</div>}
                  </div>
                );
              })}
            </div>
          ))}
          <div className="tile-row">
            {['1z', '2z', '3z', '4z'].map((id) => {
              const count = hand.filter((t) => t === id).length;
              return (
                <div key={id} className={'tile-key' + (count >= 4 ? ' disabled' : '')} onClick={() => addTile(id)}>
                  <img src={tileImgSrc(id)} alt={tileDisplay(id)} />
                  {count > 0 && <div className="count-badge">{count}</div>}
                </div>
              );
            })}
          </div>
          <div className="tile-row">
            {['5z', '6z', '7z'].map((id) => {
              const count = hand.filter((t) => t === id).length;
              return (
                <div key={id} className={'tile-key' + (count >= 4 ? ' disabled' : '')} onClick={() => addTile(id)}>
                  <img src={tileImgSrc(id)} alt={tileDisplay(id)} />
                  {count > 0 && <div className="count-badge">{count}</div>}
                </div>
              );
            })}
          </div>
        </div>

        <div className="btn-row" style={{ margin: '8px 0' }}>
          <button className="btn btn-secondary btn-small" onClick={clearHand}>清空</button>
          <button className="btn btn-secondary btn-small" onClick={undoTile}>撤销选牌</button>
        </div>

        <label>宝牌指示牌</label>
        <div className="dora-picker-row">
          {TILE_DEFS.map((def) => (
            <div
              key={def.id}
              className={'tile-key dora-key' + (doraIndicators.includes(def.id) ? ' dora-active' : '')}
              onClick={() =>
                setDoraIndicators((arr) =>
                  arr.includes(def.id) ? arr.filter((x) => x !== def.id) : [...arr, def.id]
                )
              }
            >
              <img src={tileImgSrc(def.id)} alt={def.display} />
            </div>
          ))}
        </div>
        <label>裏宝牌指示牌（仅立直有效）</label>
        <div className="dora-picker-row">
          {TILE_DEFS.map((def) => (
            <div
              key={def.id}
              className={'tile-key dora-key' + (uraDoraIndicators.includes(def.id) ? ' dora-active' : '')}
              onClick={() =>
                setUraDoraIndicators((arr) =>
                  arr.includes(def.id) ? arr.filter((x) => x !== def.id) : [...arr, def.id]
                )
              }
            >
              <img src={tileImgSrc(def.id)} alt={def.display} />
            </div>
          ))}
        </div>
        {(doraIndicators.length > 0 || uraDoraIndicators.length > 0) && (
          <div className="dora-count">
            表{doraIndicators.length} 裏{uraDoraIndicators.length} → 手中宝牌 {doraCount} 张
          </div>
        )}

        <div className="manual-row">
          <div className="manual-field">
            <label>番数</label>
            <select value={han} onChange={(e) => setHan(Number(e.target.value))}>
              {HAN_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div className="manual-field">
            <label>符数</label>
            <select value={fu} onChange={(e) => setFu(Number(e.target.value))}>
              {FU_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>

        <button className="btn analyze-btn" onClick={analyze}>
          {analysisStage ? '重新分析并更新结果' : '分析牌型'}
        </button>
        {analysisStage === 1 && (
          <button className="btn btn-secondary btn-small" style={{ marginTop: 8, width: '100%' }} onClick={showFuDetail}>
            {fuLines ? '收起符数解析' : '符数解析'}
          </button>
        )}

        {notice && <div className="analysis-display">{notice}</div>}

        {fuLines && (
          <div className="analysis-display fu-lines">
            {fuLines.map((line, i) => (
              <div key={i}>{line || '\u00a0'}</div>
            ))}
          </div>
        )}

        {analysisStage === 1 && decomps.length > 0 && (
          <div className="mentsu-editor">
            {decomps.length > 1 && (
              <div className="decomp-switch">
                分解方案 {decompIndex + 1}/{decomps.length}
                <span
                  className="decomp-btn"
                  onClick={() => {
                    const next = (decompIndex - 1 + decomps.length) % decomps.length;
                    setDecompIndex(next);
                    setMentsuOverride(null);
                    setPairOverride(null);
                  }}
                >
                  ◀
                </span>
                <span
                  className="decomp-btn"
                  onClick={() => {
                    const next = (decompIndex + 1) % decomps.length;
                    setDecompIndex(next);
                    setMentsuOverride(null);
                    setPairOverride(null);
                  }}
                >
                  ▶
                </span>
              </div>
            )}
            {(mentsuOverride || []).map((mo, idx) => {
              const displayTiles = mo.isKan ? [...mo.tiles, mo.tiles[0]] : mo.tiles;
              return (
                <div className="mentsu-group" key={idx}>
                  <div className="mentsu-tiles">
                    {displayTiles.map((tid, tIdx) => (
                      <img key={tIdx} src={tileImgSrc(tid)} alt={tileDisplay(tid)} />
                    ))}
                  </div>
                  <div className="mentsu-type">
                    {mo.baseType === 'koutsu' ? (
                      <>
                        {[
                          { label: '暗刻', open: false, kan: false },
                          { label: '明刻', open: true, kan: false },
                          { label: '暗杠', open: false, kan: true },
                          { label: '明杠', open: true, kan: true }
                        ].map((t) => (
                          <div
                            key={t.label}
                            className={'type-btn' + (!mo.isOpen === !t.open && mo.isKan === t.kan ? ' active' : '')}
                            onClick={() =>
                              setMentsuOverride((arr) =>
                                (arr || []).map((m, j) => (j === idx ? { ...m, isOpen: t.open, isKan: t.kan } : m))
                              )
                            }
                          >
                            {t.label}
                          </div>
                        ))}
                      </>
                    ) : (
                      <>
                        <div
                          className={'type-btn' + (!mo.isOpen ? ' active' : '')}
                          onClick={() => setMentsuOverride((arr) => (arr || []).map((m, j) => (j === idx ? { ...m, isOpen: false } : m)))}
                        >
                          门前
                        </div>
                        <div
                          className={'type-btn' + (mo.isOpen ? ' active' : '')}
                          onClick={() => setMentsuOverride((arr) => (arr || []).map((m, j) => (j === idx ? { ...m, isOpen: true } : m)))}
                        >
                          副露
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
            <div className="mentsu-group">
              <div className="mentsu-tiles">
                {(pairOverride || decomps[decompIndex >= decomps.length ? 0 : decompIndex]?.pair.tiles || []).map((tid, tIdx) => (
                  <img key={tIdx} src={tileImgSrc(tid)} alt={tileDisplay(tid)} />
                ))}
              </div>
              <div className="pair-label">雀头</div>
            </div>
          </div>
        )}

        {analysisStage === 1 && (
          <>
            <label>特殊和牌条件</label>
            <div className="seg-group">
              {conditionDefs.map((def) => (
                <div
                  key={def.key}
                  className={'seg-btn condition-btn' + (!def.disabled && conditions[def.key] ? ' active' : '')}
                  style={def.disabled ? { opacity: 0.35, pointerEvents: 'none' } : undefined}
                  onClick={() => toggleCondition(def.key, def.disabled)}
                >
                  {def.label}
                </div>
              ))}
            </div>
          </>
        )}

        {resultView && (
          <div className="analysis-display result-view">
            <b>牌型分析结果</b>
            <div>
              和牌形：
              {resultView.result.type === 'chiitoi' ? '七对子' : resultView.result.type === 'kokushi' ? '国士无双' : '四面子一雀头'}
              {resultView.result.waitType ? ` · 等待：${WAIT_NAMES[resultView.result.waitType] || resultView.result.waitType}` : ''}
            </div>
            <div>门清状态：{getOpenMentsus().open.length === 0 ? '门前' : '副露'}</div>
            <div>特殊条件：{resultView.conditionNames.length ? resultView.conditionNames.join('、') : '无'}</div>
            <div>役：{(resultView.result.yaku || []).map((y) => (y.yakuman ? `${y.name}（${y.yakuman > 1 ? y.yakuman + '倍役满' : '役满'}）` : `${y.name} ${y.han || ''}番`)).join('、') || '无'}</div>
            <div>宝牌：{resultView.dora}番（表/裏合计）</div>
            <b>{resultView.result.isYakuman ? `${resultView.result.yakumanCount || 1}倍役满` : `${resultView.result.han}番 ${resultView.result.fu}符`}</b>
            <b>和牌收入：{resultView.payments.total}点</b>
            {resultView.payments.payments.map((p, i) => (
              <div key={i}>{SEATS[p.from]} → {SEATS[p.to]}：{p.amount}</div>
            ))}
            <div className="muted">修改面子明暗、杠子或特殊条件后，再次点击“重新分析并更新结果”。</div>
          </div>
        )}

        <div className="result-box">
          <div className="points">+{preview.total}</div>
          <div className="detail">
            {SEATS[winnerIdx]} {isTsumo ? '自摸' : '荣和'} · {hanLabel(han, fu)}
          </div>
          <div className="breakdown">
            {preview.payments.map((p, i) => (
              <div key={i}>{SEATS[p.from]} → {SEATS[p.to]}: {p.amount}</div>
            ))}
            {preview.stickBonus > 0 && <div>供托 +{preview.stickBonus}</div>}
          </div>
        </div>

        <button className="btn" onClick={() => onConfirm({ winnerIdx, loserIdx, isTsumo, han, fu, hand })}>
          确认结算
        </button>
      </div>
    </div>
  );
}
