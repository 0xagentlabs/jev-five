import { describe, expect, it } from "vitest";
import { createBoard, fromLabel, getWinner, placeStone, serializeBoard, toLabel } from "./game";

describe("game engine", () => {
  it("round trips board labels", () => {
    expect(fromLabel(toLabel({ row: 14, col: 14 }))).toEqual({ row: 14, col: 14 });
  });

  it("detects a diagonal winner", () => {
    let board = createBoard();
    for (let i = 0; i < 5; i += 1) board = placeStone(board, { row: i + 2, col: i + 3 }, "black");
    expect(getWinner(board)).toBe("black");
  });

  it("serializes occupied cells", () => {
    const board = placeStone(createBoard(), { row: 7, col: 7 }, "black");
    expect(serializeBoard(board)).toBe("H8:B");
  });
});
