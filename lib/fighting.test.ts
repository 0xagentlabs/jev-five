import { describe, expect, it } from "vitest";
import { addPlayer, configureEngine, FightingPlayer, newRoom, publicRoom, startFight, submitMove } from "./fighting";

const host: FightingPlayer = { id: "host", name: "Alpha", seat: "black", tokenHash: "secret", joinedAt: "2026-01-01T00:00:00Z" };

function readyRoom() {
  let room = newRoom({ id: "ABCDEFGH", name: "Test", host, turnSeconds: 60, allowSpectators: true });
  room = addPlayer(room, { id: "guest", name: "Beta", seat: "white", tokenHash: "secret2", joinedAt: "2026-01-01T00:00:01Z" });
  room = configureEngine(room, "host", { name: "Attack", persona: "attack", readyAt: "2026-01-01T00:00:02Z" });
  room = configureEngine(room, "guest", { name: "Guard", persona: "defense", readyAt: "2026-01-01T00:00:03Z" });
  return room;
}

describe("Jev Fighting state machine", () => {
  it("moves from waiting to ready when both engines load", () => {
    const room = readyRoom();
    expect(room.status).toBe("ready");
    expect(publicRoom(room).players.black).not.toHaveProperty("tokenHash");
  });

  it("only lets the host start", () => {
    expect(() => startFight(readyRoom(), "guest")).toThrow("只有房主");
    expect(startFight(readyRoom(), "host").status).toBe("active");
  });

  it("enforces turn order and legal moves", () => {
    let room = startFight(readyRoom(), "host");
    expect(() => submitMove(room, "guest", { row: 7, col: 7 }, {})).toThrow("不是你的 Jev 回合");
    room = submitMove(room, "host", { row: 7, col: 7 }, { confidence: 0.8, latencyMs: 50 });
    expect(room.turn).toBe("white");
    expect(room.moves[0].label).toBe("H8");
    expect(() => submitMove(room, "guest", { row: 7, col: 7 }, {})).toThrow("非法落子");
  });

  it("detects a five-stone win", () => {
    let room = startFight(readyRoom(), "host");
    for (let col = 0; col < 4; col += 1) {
      room = submitMove(room, "host", { row: 0, col }, {});
      room = submitMove(room, "guest", { row: 1, col }, {});
    }
    room = submitMove(room, "host", { row: 0, col: 4 }, {});
    expect(room.status).toBe("black_win");
  });
});
