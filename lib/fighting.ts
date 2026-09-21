import { Board, Position, Stone, createBoard, getWinner, isBoardFull, isLegal, otherStone, placeStone, toLabel } from "./game";

export type FightingPersona = "attack" | "balanced" | "defense";
export type FightingStatus = "waiting" | "ready" | "active" | "black_win" | "white_win" | "draw";

export type FightingPlayer = {
  id: string;
  name: string;
  seat: Stone;
  tokenHash: string;
  joinedAt: string;
  engine?: { name: string; persona: FightingPersona; readyAt: string };
};

export type FightingMove = {
  turn: number;
  stone: Stone;
  row: number;
  col: number;
  label: string;
  playerId: string;
  engineName: string;
  confidence?: number;
  latencyMs: number;
  createdAt: string;
};

export type FightingRoom = {
  id: string;
  name: string;
  createdAt: string;
  expiresAt: string;
  hostPlayerId: string;
  turnSeconds: number;
  allowSpectators: boolean;
  status: FightingStatus;
  version: number;
  turn: Stone;
  board: Board;
  players: Partial<Record<Stone, FightingPlayer>>;
  moves: FightingMove[];
};

export type PublicPlayer = Omit<FightingPlayer, "tokenHash">;
export type PublicFightingRoom = Omit<FightingRoom, "players"> & {
  players: Partial<Record<Stone, PublicPlayer>>;
};

export class FightingError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 400) {
    super(message);
  }
}

export function publicRoom(room: FightingRoom): PublicFightingRoom {
  const players: PublicFightingRoom["players"] = {};
  for (const seat of ["black", "white"] as const) {
    const player = room.players[seat];
    if (!player) continue;
    players[seat] = {
      id: player.id,
      name: player.name,
      seat: player.seat,
      joinedAt: player.joinedAt,
      ...(player.engine ? { engine: player.engine } : {}),
    };
  }
  return { ...room, players };
}

export function roomStatus(room: FightingRoom): FightingStatus {
  if (["active", "black_win", "white_win", "draw"].includes(room.status)) return room.status;
  return room.players.black?.engine && room.players.white?.engine ? "ready" : "waiting";
}

export function addPlayer(room: FightingRoom, player: FightingPlayer): FightingRoom {
  if (room.status !== "waiting" && room.status !== "ready") throw new FightingError("MATCH_STARTED", "对局已经开始，无法加入席位。", 409);
  if (room.players[player.seat]) throw new FightingError("SEAT_TAKEN", `${player.seat === "black" ? "黑方" : "白方"}席位已被占用。`, 409);
  const next = { ...room, version: room.version + 1, players: { ...room.players, [player.seat]: player } };
  return { ...next, status: roomStatus(next) };
}

export function configureEngine(room: FightingRoom, playerId: string, engine: NonNullable<FightingPlayer["engine"]>): FightingRoom {
  const seat = findSeat(room, playerId);
  if (room.status === "active" || room.moves.length) throw new FightingError("MATCH_STARTED", "对局开始后不能替换 Jev。", 409);
  const player = room.players[seat];
  if (!player) throw new FightingError("PLAYER_NOT_FOUND", "未找到玩家席位。", 404);
  const next = {
    ...room,
    version: room.version + 1,
    players: { ...room.players, [seat]: { ...player, engine } },
  };
  return { ...next, status: roomStatus(next) };
}

export function startFight(room: FightingRoom, playerId: string): FightingRoom {
  if (playerId !== room.hostPlayerId) throw new FightingError("HOST_ONLY", "只有房主可以开始 Fighting。", 403);
  if (!room.players.black?.engine || !room.players.white?.engine) throw new FightingError("NOT_READY", "双方玩家和 Jev 都准备好后才能开始。", 409);
  if (room.status !== "ready") throw new FightingError("INVALID_STATUS", "当前房间不能开始。", 409);
  return { ...room, version: room.version + 1, status: "active" };
}

export function submitMove(room: FightingRoom, playerId: string, position: Position, result: { confidence?: number; latencyMs?: number }): FightingRoom {
  if (room.status !== "active") throw new FightingError("NOT_ACTIVE", "对局尚未开始或已经结束。", 409);
  const seat = findSeat(room, playerId);
  if (seat !== room.turn) throw new FightingError("NOT_YOUR_TURN", "现在不是你的 Jev 回合。", 409);
  if (!isLegal(room.board, position)) throw new FightingError("ILLEGAL_MOVE", "Jev 返回了非法落子。", 422);
  const player = room.players[seat];
  if (!player?.engine) throw new FightingError("ENGINE_NOT_READY", "请先载入 Jev。", 409);
  const board = placeStone(room.board, position, seat);
  const winner = getWinner(board);
  const status: FightingStatus = winner ? `${winner}_win` : isBoardFull(board) ? "draw" : "active";
  const move: FightingMove = {
    turn: room.moves.length + 1,
    stone: seat,
    row: position.row,
    col: position.col,
    label: toLabel(position),
    playerId,
    engineName: player.engine.name,
    confidence: typeof result.confidence === "number" ? Math.max(0, Math.min(1, result.confidence)) : undefined,
    latencyMs: Math.max(0, Math.min(120_000, Math.round(result.latencyMs ?? 0))),
    createdAt: new Date().toISOString(),
  };
  return { ...room, board, status, turn: otherStone(seat), moves: [...room.moves, move], version: room.version + 1 };
}

export function findSeat(room: FightingRoom, playerId: string): Stone {
  if (room.players.black?.id === playerId) return "black";
  if (room.players.white?.id === playerId) return "white";
  throw new FightingError("PLAYER_NOT_FOUND", "当前身份不属于这个房间。", 403);
}

export function newRoom(input: {
  id: string;
  name: string;
  host: FightingPlayer;
  turnSeconds: number;
  allowSpectators: boolean;
}): FightingRoom {
  const createdAt = new Date();
  return {
    id: input.id,
    name: input.name,
    createdAt: createdAt.toISOString(),
    expiresAt: new Date(createdAt.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    hostPlayerId: input.host.id,
    turnSeconds: input.turnSeconds,
    allowSpectators: input.allowSpectators,
    status: "waiting",
    version: 1,
    turn: "black",
    board: createBoard(),
    players: { [input.host.seat]: input.host },
    moves: [],
  };
}
