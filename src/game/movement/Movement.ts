import { LevelData, GridPoint } from '../levels/LevelParser';
import { TileIndex } from '../levels/Tiles';

export type Direction = 'up' | 'down' | 'left' | 'right';

export const DIRECTION_DELTA: Readonly<Record<Direction, GridPoint>> = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 }
};

function step (p: GridPoint, dir: Direction): GridPoint
{
    const d = DIRECTION_DELTA[dir];
    return { x: p.x + d.x, y: p.y + d.y };
}

function tileAt (data: LevelData, p: GridPoint): number
{
    if (p.x < 0 || p.y < 0 || p.x >= data.width || p.y >= data.height)
    {
        return TileIndex.Void;
    }
    return data.tiles[p.y][p.x];
}

//  Index of the boulder at `p` in data.boulders, or -1 if there isn't one.
export function boulderAt (data: LevelData, p: GridPoint): number
{
    return data.boulders.findIndex(b => b.x === p.x && b.y === p.y);
}

function isGoal (data: LevelData, p: GridPoint): boolean
{
    return data.goal !== null && data.goal.x === p.x && data.goal.y === p.y;
}

//  True if nothing can enter this cell: off the map, void, wall, the exit, or a boulder.
//  (The exit is handled as a special case by resolveMove.)
export function isBlocked (data: LevelData, p: GridPoint): boolean
{
    const tile = tileAt(data, p);
    if (tile === TileIndex.Void || tile === TileIndex.Wall || isGoal(data, p))
    {
        return true;
    }
    return boulderAt(data, p) >= 0;
}

//  Movement rules shared by the player and boulders, independent of input and animation.
//  Returns the tiles passed through, in order, when moving from `from` in `dir`.
//  An empty array means the move is blocked. After the first step, the mover keeps
//  sliding while on ice, stopping before a blocked tile or on the first non-ice tile.
export function computeMove (data: LevelData, from: GridPoint, dir: Direction): GridPoint[]
{
    const path: GridPoint[] = [];
    let current = from;

    while (true)
    {
        const next = step(current, dir);
        if (isBlocked(data, next))
        {
            break;
        }

        path.push(next);
        current = next;

        if (tileAt(data, current) !== TileIndex.Ice)
        {
            break;
        }
    }

    return path;
}

export type MoveResult =
    | { kind: 'walk', path: GridPoint[] }
    | { kind: 'push', boulderIndex: number, path: GridPoint[] }
    //  path is the slide before reaching the exit; empty for a direct step
    | { kind: 'exit', path: GridPoint[], exit: GridPoint }
    | { kind: 'blocked' };

//  Resolves what happens when the player at `from` tries to move in `dir`.
//  - Stepping into a boulder pushes it: only the boulder moves, sliding on ice like the player.
//    If the boulder can't move, the move is blocked.
//  - A move that the exit stops (a direct step, or a slide on ice) is an exit attempt.
//  - Otherwise the player walks, sliding on ice. A sliding player stops in front of a
//    boulder rather than pushing it.
export function resolveMove (data: LevelData, from: GridPoint, dir: Direction): MoveResult
{
    const boulderIndex = boulderAt(data, step(from, dir));
    if (boulderIndex >= 0)
    {
        const path = computeMove(data, data.boulders[boulderIndex], dir);
        return path.length > 0 ? { kind: 'push', boulderIndex, path } : { kind: 'blocked' };
    }

    const path = computeMove(data, from, dir);
    const end = path.length > 0 ? path[path.length - 1] : from;

    //  The move stopped because it was blocked (not because it slid onto non-ice)
    //  if nothing was walked, or if it ended on ice.
    const stoppedByBlock = path.length === 0 || tileAt(data, end) === TileIndex.Ice;
    const next = step(end, dir);
    if (stoppedByBlock && isGoal(data, next))
    {
        return { kind: 'exit', path, exit: next };
    }

    return path.length > 0 ? { kind: 'walk', path } : { kind: 'blocked' };
}
