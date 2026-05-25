// Movement logic adapted from Pocket Match.
export const MOVEMENT_CYCLE = ['STATIC','DOWN','UP','LEFT','RIGHT','CENTER_VERTICAL','CENTER_HORIZONTAL','RANDOM'];
const RANDOM_MOVES = ['DOWN','UP','LEFT','RIGHT','CENTER_VERTICAL','CENTER_HORIZONTAL'];
export function movementForLevel(level) { return MOVEMENT_CYCLE[(Math.max(1, level)-1) % MOVEMENT_CYCLE.length]; }
export function applyMovement(board, movement) {
  const rows = board.length, cols = board[0]?.length || 0;
  if (!rows || !cols || movement === 'STATIC') return board;
  if (movement === 'RANDOM') movement = RANDOM_MOVES[Math.floor(Math.random()*RANDOM_MOVES.length)];
  const compactLine = (cells, dir) => {
    const active = cells.filter(c => c && !c.removed);
    const empty = cells.filter(c => !c || c.removed);
    return dir === 1 ? [...empty, ...active] : [...active, ...empty];
  };
  if (movement === 'DOWN' || movement === 'UP') {
    const dir = movement === 'DOWN' ? 1 : 0;
    for (let c=0;c<cols;c++) {
      const col = board.map(row => row[c]);
      const comp = compactLine(col, dir);
      for (let r=0;r<rows;r++) board[r][c] = comp[r];
    }
  } else if (movement === 'LEFT' || movement === 'RIGHT') {
    const dir = movement === 'RIGHT' ? 1 : 0;
    for (let r=0;r<rows;r++) board[r] = compactLine(board[r], dir);
  } else if (movement === 'CENTER_VERTICAL') {
    const mid = Math.floor(cols / 2);
    for (let r=0;r<rows;r++) {
      const left = board[r].slice(0, mid);
      const right = board[r].slice(mid);
      board[r] = [...compactLine(left,0), ...compactLine(right,1)];
    }
  } else if (movement === 'CENTER_HORIZONTAL') {
    const mid = Math.floor(rows / 2);
    for (let c=0;c<cols;c++) {
      const top=[], bottom=[];
      for (let r=0;r<mid;r++) top.push(board[r][c]);
      const center = board[mid][c];
      for (let r=mid+1;r<rows;r++) bottom.push(board[r][c]);
      const nt = compactLine(top,0), nb = compactLine(bottom,1);
      for (let r=0;r<mid;r++) board[r][c]=nt[r];
      board[mid][c]=center;
      for (let r=mid+1;r<rows;r++) board[r][c]=nb[r-(mid+1)];
    }
  }
  return board;
}
