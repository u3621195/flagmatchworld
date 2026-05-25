import { movementForLevel } from './movement.js';

export function uniqueFlagsForLevel(level) {
  if (level <= 8) return 24;
  if (level <= 16) return 30;
  if (level <= 24) return 36;
  if (level <= 32) return 42;
  return 48;
}
export function shuffleArray(arr) {
  for (let i=arr.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]]; }
  return arr;
}
export function generateLevel({ level, flags, rows=9, cols=16 }) {
  const uniqueCount = uniqueFlagsForLevel(level);
  const pool = shuffleArray([...flags]).slice(0, uniqueCount);
  const pairs = [];
  for (let i=0;i<72;i++) pairs.push(pool[i % pool.length]);
  shuffleArray(pairs);
  const tiles = pairs.flatMap((flag, pairIndex) => [
    { flagId:flag.flagId, displayName:flag.displayName, assetFile:flag.assetFile, pairIndex, removed:false },
    { flagId:flag.flagId, displayName:flag.displayName, assetFile:flag.assetFile, pairIndex, removed:false },
  ]);
  shuffleArray(tiles);
  const board=[];
  for (let r=0;r<rows;r++) board.push(tiles.slice(r*cols,(r+1)*cols));
  return { level, movement: movementForLevel(level), board };
}
