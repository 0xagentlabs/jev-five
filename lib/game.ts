export const BOARD_SIZE = 15;
export type Stone = "black" | "white";
export type Cell = Stone | null;
export type Board = Cell[][];
export type Position = { row: number; col: number };

export const createBoard = (): Board =>
  Array.from({ length: BOARD_SIZE }, () => Array<Cell>(BOARD_SIZE).fill(null));

export const otherStone = (stone: Stone): Stone => (stone === "black" ? "white" : "black");

export const toLabel = ({ row, col }: Position) => `${String.fromCharCode(65 + col)}${row + 1}`;

export function fromLabel(label: string): Position | null {
  const match = /^([A-O])(1[0-5]|[1-9])$/.exec(label.toUpperCase());
  if (!match) return null;
  return { col: match[1].charCodeAt(0) - 65, row: Number(match[2]) - 1 };
}

export function isLegal(board: Board, position: Position): boolean {
  return position.row >= 0 && position.row < BOARD_SIZE && position.col >= 0 && position.col < BOARD_SIZE && board[position.row][position.col] === null;
}

export function placeStone(board: Board, position: Position, stone: Stone): Board {
  if (!isLegal(board, position)) return board;
  return board.map((line, row) =>
    line.map((cell, col) => (row === position.row && col === position.col ? stone : cell)),
  );
}

export function getWinner(board: Board): Stone | null {
  const directions = [[1, 0], [0, 1], [1, 1], [1, -1]];
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const stone = board[row][col];
      if (!stone) continue;
      for (const [dr, dc] of directions) {
        let count = 1;
        for (let step = 1; step < 5; step += 1) {
          if (board[row + dr * step]?.[col + dc * step] !== stone) break;
          count += 1;
        }
        if (count >= 5) return stone;
      }
    }
  }
  return null;
}

export const isBoardFull = (board: Board) => board.every((row) => row.every(Boolean));

export function legalMoves(board: Board): Position[] {
  const moves: Position[] = [];
  board.forEach((row, rowIndex) => row.forEach((cell, colIndex) => {
    if (!cell) moves.push({ row: rowIndex, col: colIndex });
  }));
  return moves;
}

export function serializeBoard(board: Board): string {
  const stones: string[] = [];
  board.forEach((row, rowIndex) => row.forEach((cell, colIndex) => {
    if (cell) stones.push(`${toLabel({ row: rowIndex, col: colIndex })}:${cell === "black" ? "B" : "W"}`);
  }));
  return stones.length ? stones.join(",") : "empty";
}
