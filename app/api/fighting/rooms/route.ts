import { NextRequest, NextResponse } from "next/server";
import { FightingError, newRoom, publicRoom } from "@/lib/fighting";
import { hashToken, newPlayerId, newPlayerToken, newRoomId } from "@/lib/fighting-auth";
import { createRoom } from "@/lib/fighting-store";

export const runtime = "nodejs";

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const name = text(body.name, 48) || "Jev Fighting";
    const hostName = text(body.hostName, 24);
    const hostSeat = body.hostSeat === "white" ? "white" : "black";
    const turnSeconds = Number(body.turnSeconds);
    if (!hostName) throw new FightingError("NAME_REQUIRED", "请输入房主昵称。");
    if (![15, 30, 60, 120].includes(turnSeconds)) throw new FightingError("INVALID_TIMER", "请选择有效的回合时限。");
    const token = newPlayerToken();
    const playerId = newPlayerId();
    const room = newRoom({
      id: newRoomId(),
      name,
      host: { id: playerId, name: hostName, seat: hostSeat, tokenHash: hashToken(token), joinedAt: new Date().toISOString() },
      turnSeconds,
      allowSpectators: body.allowSpectators !== false,
    });
    await createRoom(room);
    return NextResponse.json({ room: publicRoom(room), player: { id: playerId, token, seat: hostSeat } }, { status: 201 });
  } catch (error) {
    const problem = error instanceof FightingError ? error : new FightingError("CREATE_FAILED", "创建房间失败，请稍后重试。", 500);
    return NextResponse.json({ code: problem.code, message: problem.message }, { status: problem.status });
  }
}
