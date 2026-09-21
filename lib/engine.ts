import { Board, Position, Stone, getWinner, legalMoves, otherStone, placeStone, toLabel } from "./game";

const DIRECTIONS = [[1, 0], [0, 1], [1, 1], [1, -1]] as const;

export type Candidate = Position & {
  label: string;
  score: number;
  reason: string;
  forced: "win" | "block" | null;
};

function lineShape(board: Board, position: Position, stone: Stone, dr: number, dc: number) {
  let length = 1;
  let openEnds = 0;
  for (const sign of [-1, 1]) {
    let step = 1;
    while (board[position.row + dr * step * sign]?.[position.col + dc * step * sign] === stone) {
      length += 1;
      step += 1;
    }
    if (board[position.row + dr * step * sign]?.[position.col + dc * step * sign] === null) openEnds += 1;
  }
  return { length, openEnds };
}

function shapeScore(length: number, openEnds: number) {
  if (length >= 5) return 1_000_000;
  if (length === 4 && openEnds === 2) return 120_000;
  if (length === 4 && openEnds === 1) return 22_000;
  if (length === 3 && openEnds === 2) return 8_000;
  if (length === 3 && openEnds === 1) return 900;
  if (length === 2 && openEnds === 2) return 420;
  if (length === 2 && openEnds === 1) return 90;
  return openEnds * 8;
}

type PatternCounts = {
  jumpFour: number;
  openThree: number;
  jumpThree: number;
  sleepThree: number;
  openTwo: number;
};

function directionalString(board: Board, position: Position, stone: Stone, dr: number, dc: number) {
  let value = "";
  for (let offset = -5; offset <= 5; offset += 1) {
    const cell = board[position.row + dr * offset]?.[position.col + dc * offset];
    value += cell === stone ? "X" : cell === null ? "." : "O";
  }
  return value;
}

function countPatterns(value: string, patterns: string[]) {
  return patterns.reduce((total, pattern) => {
    let count = 0;
    for (let index = 0; index <= value.length - pattern.length; index += 1) {
      if (value.slice(index, index + pattern.length) === pattern) count += 1;
    }
    return total + count;
  }, 0);
}

function patternCounts(board: Board, position: Position, stone: Stone): PatternCounts {
  const total: PatternCounts = { jumpFour: 0, openThree: 0, jumpThree: 0, sleepThree: 0, openTwo: 0 };
  for (const [dr, dc] of DIRECTIONS) {
    const line = directionalString(board, position, stone, dr, dc);
    total.jumpFour += countPatterns(line, [".XXX.X.", ".XX.XX.", ".X.XXX."]);
    total.openThree += countPatterns(line, ["..XXX.."]);
    total.jumpThree += countPatterns(line, ["..XX.X..", "..X.XX.."]);
    total.sleepThree += countPatterns(line, ["O.XXX..", "..XXX.O", "O.XX.X.", ".X.XX.O"]);
    total.openTwo += countPatterns(line, ["..XX...", "...XX..", "..X.X.."]);
  }
  return total;
}

function evaluatePlacement(board: Board, position: Position, stone: Stone) {
  const next = placeStone(board, position, stone);
  const shapes = DIRECTIONS.map(([dr, dc]) => lineShape(next, position, stone, dr, dc));
  const patterns = patternCounts(next, position, stone);
  const patternScore = patterns.jumpFour * 85_000 + patterns.openThree * 11_000 + patterns.jumpThree * 7_500 + patterns.sleepThree * 1_400 + patterns.openTwo * 500;
  const score = shapes.reduce((sum, shape) => sum + shapeScore(shape.length, shape.openEnds), 0) + patternScore;
  const openFours = shapes.filter((shape) => shape.length === 4 && shape.openEnds === 2).length;
  const fours = shapes.filter((shape) => shape.length === 4 && shape.openEnds > 0).length;
  const closedFours = shapes.filter((shape) => shape.length === 4 && shape.openEnds === 1).length;
  const openThrees = shapes.filter((shape) => shape.length === 3 && shape.openEnds === 2).length;
  const best = shapes.reduce((current, shape) => shapeScore(shape.length, shape.openEnds) > shapeScore(current.length, current.openEnds) ? shape : current);
  return { score, openFours, fours, closedFours, openThrees, best, patterns };
}

function isNearby(board: Board, position: Position) {
  for (let dr = -2; dr <= 2; dr += 1) {
    for (let dc = -2; dc <= 2; dc += 1) {
      if (board[position.row + dr]?.[position.col + dc]) return true;
    }
  }
  return false;
}

function winningMoves(board: Board, stone: Stone) {
  return legalMoves(board).filter((move) => getWinner(placeStone(board, move, stone)) === stone);
}

function nearbyMoves(board: Board) {
  return legalMoves(board).filter((move) => isNearby(board, move));
}

function strongestPlacement(board: Board, stone: Stone) {
  const moves = nearbyMoves(board);
  let best: { move: Position; score: number } | null = null;
  for (const move of moves) {
    const score = evaluatePlacement(board, move, stone).score;
    if (!best || score > best.score) best = { move, score };
  }
  return best;
}

export function rankCandidates(board: Board, stone: Stone, limit = 14): Candidate[] {
  const legal = legalMoves(board);
  const ownWins = winningMoves(board, stone);
  if (ownWins.length) return ownWins.map((move) => ({ ...move, label: toLabel(move), score: 10_000_000, reason: "立即连成五子，直接获胜", forced: "win" }));

  const opponent = otherStone(stone);
  const forcedBlocks = winningMoves(board, opponent);
  if (forcedBlocks.length) return forcedBlocks.map((move) => ({ ...move, label: toLabel(move), score: 9_000_000, reason: "对手下一手可成五，必须封堵", forced: "block" }));

  const occupied = legal.length < board.length * board.length;
  if (!occupied) {
    return [
      { row: 7, col: 7 }, { row: 6, col: 7 }, { row: 7, col: 6 }, { row: 7, col: 8 },
      { row: 8, col: 7 }, { row: 6, col: 6 }, { row: 6, col: 8 }, { row: 8, col: 6 }, { row: 8, col: 8 },
    ].map((move, index) => ({ ...move, label: toLabel(move), score: 10_000 - index * 100, reason: index === 0 ? "天元开局，最大化四向延展空间" : "中心区开局，保留多方向发展", forced: null }));
  }
  const pool = occupied ? legal.filter((move) => isNearby(board, move)) : legal;
  const preliminary = pool.map((move) => {
    const attack = evaluatePlacement(board, move, stone);
    const defense = evaluatePlacement(board, move, opponent);
    const next = placeStone(board, move, stone);
    const nextWins = winningMoves(next, stone).length;
    const opponentWins = winningMoves(next, opponent).length;
    const center = 14 - (Math.abs(move.row - 7) + Math.abs(move.col - 7));
    const threatCount = attack.openFours + attack.fours + attack.openThrees + attack.patterns.jumpFour + attack.patterns.jumpThree;
    const forkBonus = attack.openFours * 180_000 + attack.patterns.jumpFour * 100_000 + Math.max(0, threatCount - 1) * 38_000 + Math.max(0, nextWins - 1) * 70_000;
    const safety = opponentWins ? -500_000 * opponentWins : 0;
    const score = attack.score * 1.15 + defense.score + forkBonus + safety + center * 3;
    const tags = [
      attack.openFours ? "制造活四" : "",
      attack.patterns.jumpFour ? "制造跳四" : "",
      attack.closedFours ? "制造冲四" : "",
      attack.fours > 1 ? "形成双四" : "",
      attack.openThrees > 1 ? "形成双活三" : "",
      attack.patterns.jumpThree ? "制造跳活三" : "",
      attack.patterns.sleepThree ? "构筑眠三" : "",
      attack.patterns.openTwo ? "扩展活二" : "",
      (attack.fours + attack.patterns.jumpFour) > 0 && (attack.openThrees + attack.patterns.jumpThree) > 0 ? "形成四三杀" : "",
      defense.score >= 8_000 ? "压制对手强棋形" : "",
      `进攻形${attack.best.length}连/${attack.best.openEnds}口`,
      `防守值${Math.round(defense.score)}`,
    ].filter(Boolean);
    return { ...move, label: toLabel(move), score, reason: tags.join("；"), forced: null };
  }).sort((a, b) => b.score - a.score).slice(0, Math.max(limit, 18));

  return preliminary.map((candidate) => {
    const afterMove = placeStone(board, candidate, stone);
    const opponentReply = strongestPlacement(afterMove, opponent);
    if (!opponentReply) return candidate;
    const afterReply = placeStone(afterMove, opponentReply.move, opponent);
    const ownContinuation = strongestPlacement(afterReply, stone);
    const searchAdjustment = (ownContinuation?.score ?? 0) * 0.22 - opponentReply.score * 0.72;
    return {
      ...candidate,
      score: candidate.score + searchAdjustment,
      reason: `${candidate.reason}；三层搜索 对手最佳${toLabel(opponentReply.move)}`,
    };
  }).sort((a, b) => b.score - a.score).slice(0, limit);
}
