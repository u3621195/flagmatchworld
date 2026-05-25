export function isBoardCleared(board) { return board.flat().every(tile => !tile || tile.removed); }
export function remainingTiles(board) { return board.flat().filter(tile => tile && !tile.removed); }
