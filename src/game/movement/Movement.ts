import { LevelData, GridPoint } from '../levels/LevelParser';
import { TileIndex } from '../levels/Tiles';

export type Direction = 'up' | 'down' | 'left' | 'right';

export const DIRECTION_DELTA: Readonly<Record<Direction, GridPoint>> = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 }
};

function tileAt (data: LevelData, p: GridPoint): number
{
    if (p.x < 0 || p.y < 0 || p.x >= data.width || p.y >= data.height)
    {
        return TileIndex.Void;
    }
    return data.tiles[p.y][p.x];
}

//  True if the player can't enter this cell: off the map, void, wall, or a boulder.
export function isBlocked (data: LevelData, p: GridPoint): boolean
{
    const tile = tileAt(data, p);
    if (tile === TileIndex.Void || tile === TileIndex.Wall)
    {
        return true;
    }
    return data.boulders.some(b => b.x === p.x && b.y === p.y);
}

//  Movement rules, independent of input and animation.
//  Returns the tiles the player passes through, in order, when moving from `from` in `dir`.
//  An empty array means the move is blocked. After the first step, the player keeps
//  sliding while on ice, stopping before a blocked tile or on the first non-ice tile.
export function computeMove (data: LevelData, from: GridPoint, dir: Direction): GridPoint[]
{
    const d = DIRECTION_DELTA[dir];
    const path: GridPoint[] = [];
    let current = from;

    while (true)
    {
        const next = { x: current.x + d.x, y: current.y + d.y };
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
