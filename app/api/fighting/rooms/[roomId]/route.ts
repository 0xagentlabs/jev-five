import { NextRequest, NextResponse } from "next/server";
import { addPlayer, configureEngine, FightingError, findSeat, publicRoom, startFight, submitMove } from "@/lib/fighting";
import { hashToken, newPlayerId, newPlayerToken, safeEqualHash } from "@/lib/fighting-auth";
import { getRoom, updateRoom } from "@/lib/fighting-store";

export const runtime = "nodejs";

type Context = { params: Promise<{ roomId: string }> };

function roomId(value: string) {
  const id = value.toUpperCase();
  if (!/^[A-Z2-9]{8}$/.test(id)) throw new FightingError("INVALID_ROOM_ID", "房间码格式无效。", 400);
  return id;
}

function shortText(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function authenticatedPlayerId(room: Parameters<typeof findSeat>[0], token: unknown) {
  if (typeof token !== "string" || token.length > 128) throw new FightingError("AUTH_REQUIRED", "请重新加入房间。", 401);
  for (const seat of ["black", "white"] as const) {
    const player = room.players[seat];
    if (player && safeEqualHash(token, player.tokenHash)) return player.id;
  }
  throw new FightingError("INVALID_TOKEN", "玩家身份已失效，请重新加入。", 401);
}

export async function GET(_request: NextRequest, context: Context) {
  try {
    const id = roomId((await context.params).roomId);
    const current = await getRoom(id);
    if (!current) throw new FightingError("ROOM_NOT_FOUND", "房间不存在或已过期。", 404);
    return NextResponse.json({ room: publicRoom(current.room) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const problem = error instanceof FightingError ? error : new FightingError("READ_FAILED", "读取房间失败。", 500);
    return NextResponse.json({ code: problem.code, message: problem.message }, { status: problem.status });
  }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const id = roomId((await context.params).roomId);
    const body = await request.json();
    let issuedPlayer: { id: string; token: string; seat: "black" | "white" } | undefined;
    const room = await updateRoom(id, (current) => {
      if (body.action === "join") {
        const name = shortText(body.name, 24);
        const seat = body.seat === "white" ? "white" : body.seat === "black" ? "black" : null;
        if (!name || !seat) throw new FightingError("INVALID_JOIN", "请选择席位并填写昵称。");
        const token = newPlayerToken();
        const playerId = newPlayerId();
        issuedPlayer = { id: playerId, token, seat };
        return addPlayer(current, { id: playerId, name, seat, tokenHash: hashToken(token), joinedAt: new Date().toISOString() });
      }

      const playerId = authenticatedPlayerId(current, body.token);
      if (body.action === "configure") {
        const name = shortText(body.engineName, 32);
        const persona = body.persona === "defense" || body.persona === "balanced" ? body.persona : "attack";
        if (!name) throw new FightingError("ENGINE_NAME_REQUIRED", "请为 Jev 命名。");
        return configureEngine(current, playerId, { name, persona, readyAt: new Date().toISOString() });
      }
      if (body.action === "start") return startFight(current, playerId);
      if (body.action === "move") {
        const row = Number(body.move?.row);
        const col = Number(body.move?.col);
        if (!Number.isInteger(row) || !Number.isInteger(col)) throw new FightingError("INVALID_MOVE", "落子坐标无效。");
        return submitMove(current, playerId, { row, col }, { confidence: body.confidence, latencyMs: body.latencyMs });
      }
      throw new FightingError("UNKNOWN_ACTION", "不支持的房间操作。", 400);
    });
    return NextResponse.json({ room: publicRoom(room), ...(issuedPlayer ? { player: issuedPlayer } : {}) });
  } catch (error) {
    const problem = error instanceof FightingError ? error : new FightingError("UPDATE_FAILED", "更新房间失败，请重试。", 500);
    return NextResponse.json({ code: problem.code, message: problem.message }, { status: problem.status });
  }
}
