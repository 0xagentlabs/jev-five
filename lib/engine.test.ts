import { describe, expect, it } from "vitest";
import { createBoard, placeStone } from "./game";
import { rankCandidates } from "./engine";

describe("hybrid tactical engine", () => {
  it("takes an immediate win without asking Jev to search the whole board", () => {
    let board = createBoard();
    for (let col = 3; col < 7; col += 1) board = placeStone(board, { row: 7, col }, "black");
    board = placeStone(board, { row: 7, col: 2 }, "white");
    const candidates = rankCandidates(board, "black");
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({ label: "H8", forced: "win" });
  });

  it("blocks an opponent's only immediate win", () => {
    let board = createBoard();
    for (let row = 4; row < 8; row += 1) board = placeStone(board, { row, col: 5 }, "white");
    board = placeStone(board, { row: 3, col: 5 }, "black");
    const candidates = rankCandidates(board, "black");
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({ label: "F9", forced: "block" });
  });

  it("opens at the center and keeps the Jev choice set focused", () => {
    const candidates = rankCandidates(createBoard(), "black");
    expect(candidates[0].label).toBe("H8");
    expect(candidates).toHaveLength(9);
  });

  it("returns no more than the requested strategic candidates", () => {
    const board = placeStone(createBoard(), { row: 7, col: 7 }, "black");
    const candidates = rankCandidates(board, "white", 12);
    expect(candidates.length).toBeLessThanOrEqual(12);
    expect(candidates[0].reason).toContain("三层搜索");
  });

  it("recognizes a broken-four threat", () => {
    let board = createBoard();
    board = placeStone(board, { row: 7, col: 3 }, "black");
    board = placeStone(board, { row: 7, col: 4 }, "black");
    board = placeStone(board, { row: 7, col: 7 }, "black");
    const candidate = rankCandidates(board, "black", 30).find((move) => move.label === "F8");
    expect(candidate?.reason).toContain("跳四");
  });

  it("recognizes a jumping open-three shape", () => {
    let board = createBoard();
    board = placeStone(board, { row: 7, col: 3 }, "black");
    board = placeStone(board, { row: 7, col: 6 }, "black");
    const candidate = rankCandidates(board, "black", 30).find((move) => move.label === "E8");
    expect(candidate?.reason).toContain("跳活三");
  });
});
