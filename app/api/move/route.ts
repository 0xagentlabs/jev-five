import { choice, TypeSafeClient } from "@typesafe-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { BOARD_SIZE, Board, fromLabel, isLegal, legalMoves, serializeBoard, Stone, toLabel } from "@/lib/game";

type MoveRequest = { board?: Board; stone?: Stone; persona?: "attack" | "defense" };

function validBoard(value: unknown): value is Board {
  return Array.isArray(value) && value.length === BOARD_SIZE && value.every(
    (row) => Array.isArray(row) && row.length === BOARD_SIZE && row.every((cell) => cell === null || cell === "black" || cell === "white"),
  );
}

export async function POST(request: NextRequest) {
  if (!process.env.TYPESAFE_API_KEY) {
    return NextResponse.json({ code: "JEV_NOT_CONFIGURED", message: "尚未配置官方 TypeSafe API Key。" }, { status: 503 });
  }

  let body: MoveRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "请求不是有效 JSON。" }, { status: 400 });
  }

  if (!validBoard(body.board) || (body.stone !== "black" && body.stone !== "white")) {
    return NextResponse.json({ message: "棋盘或执子参数无效。" }, { status: 400 });
  }

  const moves = legalMoves(body.board);
  if (!moves.length) return NextResponse.json({ message: "棋盘已满。" }, { status: 409 });

  const criteria = Object.fromEntries(moves.map((move) => [toLabel(move), null]));
  const persona = body.persona === "defense"
    ? "稳健型：优先阻止对手成五，其次建立连续棋形。"
    : "进攻型：优先自己成五，同时必须阻止对手下一手成五。";
  const startedAt = Date.now();

  try {
    const client = new TypeSafeClient({ apiKey: process.env.TYPESAFE_API_KEY });
    const response = await client.systemOne({
      model: "jev-latest",
      state: {
        game: "15x15 Gomoku; first player to connect five stones wins",
        coordinateSystem: "columns A-O, rows 1-15",
        currentPlayer: body.stone,
        strategy: persona,
        occupied: serializeBoard(body.board),
      },
      questions: {
        move: choice("Choose exactly one legal coordinate for the strongest Gomoku move. Check immediate wins first, then block any opponent immediate win, then prefer forks and connected shapes.", criteria),
      },
    });

    const answer = response.answers.move;
    const position = fromLabel(answer.choice);
    if (!position || !isLegal(body.board, position)) throw new Error("Jev returned an illegal move");
    const probabilities = Object.entries(answer.probabilities ?? {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([label, probability]) => ({ label, probability }));

    return NextResponse.json({
      move: position,
      label: answer.choice,
      confidence: answer.confidence,
      probabilities,
      latencyMs: Date.now() - startedAt,
      model: "jev-latest",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Jev 请求失败";
    return NextResponse.json({ message }, { status: 502 });
  }
}
