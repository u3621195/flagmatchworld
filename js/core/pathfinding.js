// Flag Match World pathfinding
// Correct match = same flagId + clear path with max 2 turns.

export function createPathfinder({ rows, cols, isEmpty }) {
  const outside = (r, c) => r < 0 || c < 0 || r >= rows || c >= cols;
  const clear = (r, c) => outside(r, c) || isEmpty(r, c);

  function straight(a, b) {
    if (a.r === b.r) {
      const min = Math.min(a.c, b.c) + 1;
      const max = Math.max(a.c, b.c);
      for (let c = min; c < max; c++) if (!clear(a.r, c)) return false;
      return true;
    }
    if (a.c === b.c) {
      const min = Math.min(a.r, b.r) + 1;
      const max = Math.max(a.r, b.r);
      for (let r = min; r < max; r++) if (!clear(r, a.c)) return false;
      return true;
    }
    return false;
  }

  const turns = (route) => {
    let t = 0;
    for (let i = 1; i < route.length - 1; i++) {
      const a = route[i - 1], b = route[i], c = route[i + 1];
      const d1 = `${Math.sign(b.r - a.r)},${Math.sign(b.c - a.c)}`;
      const d2 = `${Math.sign(c.r - b.r)},${Math.sign(c.c - b.c)}`;
      if (d1 !== d2) t++;
    }
    return t;
  };

  const distance = (route) => route.slice(1).reduce((sum,p,i)=>sum + Math.abs(p.r-route[i].r)+Math.abs(p.c-route[i].c),0);
  const simplify = (route) => route.filter((p,i)=> i===0 || i===route.length-1 || !(route[i-1].r===p.r && p.r===route[i+1].r) && !(route[i-1].c===p.c && p.c===route[i+1].c));

  function findPath(a, b) {
    const A = { r:a.r, c:a.c }, B = { r:b.r, c:b.c };
    const routes = [];
    if (straight(A, B)) routes.push([A, B]);

    const p1 = { r:A.r, c:B.c };
    if (clear(p1.r,p1.c) && straight(A,p1) && straight(p1,B)) routes.push([A,p1,B]);
    const p2 = { r:B.r, c:A.c };
    if (clear(p2.r,p2.c) && straight(A,p2) && straight(p2,B)) routes.push([A,p2,B]);

    for (let r=-1; r<=rows; r++) {
      const pa={r,c:A.c}, pb={r,c:B.c};
      if (clear(pa.r,pa.c) && clear(pb.r,pb.c) && straight(A,pa) && straight(pa,pb) && straight(pb,B)) routes.push([A,pa,pb,B]);
    }
    for (let c=-1; c<=cols; c++) {
      const pa={r:A.r,c}, pb={r:B.r,c};
      if (clear(pa.r,pa.c) && clear(pb.r,pb.c) && straight(A,pa) && straight(pa,pb) && straight(pb,B)) routes.push([A,pa,pb,B]);
    }

    const valid = routes.map(simplify).filter(r => turns(r) <= 2);
    valid.sort((a,b)=> distance(a)-distance(b) || a.length-b.length);
    return valid[0] || null;
  }
  return { findPath, straight };
}

export function findValidPair(board, rows, cols) {
  const pf = createPathfinder({ rows, cols, isEmpty:(r,c)=> !board[r]?.[c] || board[r][c].removed });
  const cells=[];
  for (let r=0;r<rows;r++) for (let c=0;c<cols;c++) {
    const tile = board[r][c];
    if (tile && !tile.removed) cells.push({ r,c,flagId:tile.flagId });
  }
  for (let i=0;i<cells.length;i++) for (let j=i+1;j<cells.length;j++) {
    if (cells[i].flagId === cells[j].flagId) {
      const path = pf.findPath(cells[i], cells[j]);
      if (path) return { a:cells[i], b:cells[j], path };
    }
  }
  return null;
}
