import { GridPoint, LevelData } from './levels/LevelParser';
import { TileIndex } from './levels/Tiles';
import { Direction } from './movement/Movement';

//  The level being played and where everything is in it, kept in localStorage so the main menu's
//  Play button can pick it back up after a reload. Saved when a level starts and after every
//  move, and cleared when a level is finished. Editor playtests aren't saved. Storage can be
//  unavailable (private windows, blocked site data), so every access is guarded.
const STORAGE_KEY = 'bouldersAndIce.levelInProgress';

export interface LevelInProgress
{
    //  LEVELS key
    levelKey: string;
    player: GridPoint;
    boulders: GridPoint[];
    facing: Direction;
    //  Indices into the level's traps of those already armed (missing in older saves)
    armedTraps?: number[];
}

export function saveLevelInProgress (state: LevelInProgress): void
{
    try
    {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
    catch
    {
        //  Can't save; Play starts from the first uncompleted level instead
    }
}

export function clearLevelInProgress (): void
{
    try
    {
        localStorage.removeItem(STORAGE_KEY);
    }
    catch
    {
        //  Nothing saved to clear
    }
}

//  The saved level in progress, or null if there isn't one
export function loadLevelInProgress (): LevelInProgress | null
{
    try
    {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<LevelInProgress> | null;
        if (saved && typeof saved.levelKey === 'string' && isPoint(saved.player) && Array.isArray(saved.boulders)
            && saved.boulders.every(isPoint) && ['up', 'down', 'left', 'right'].includes(saved.facing as string)
            && (saved.armedTraps === undefined
                || (Array.isArray(saved.armedTraps) && saved.armedTraps.every(i => Number.isInteger(i)))))
        {
            return saved as LevelInProgress;
        }
    }
    catch
    {
        //  Unreadable or unavailable
    }
    return null;
}

//  Whether a saved state fits a level: no more boulders than it starts with (traps swallow them),
//  the player and boulders each on their own snow or ice tile, off the exit, and armed traps that
//  the level has. It may not if
//  the level's file has changed since it was saved.
export function fitsLevel (state: LevelInProgress, level: LevelData): boolean
{
    const cells = [state.player, ...state.boulders];
    const onGround = (p: GridPoint) => p.y >= 0 && p.y < level.height && p.x >= 0 && p.x < level.width
        && (level.tiles[p.y][p.x] === TileIndex.Floor || level.tiles[p.y][p.x] === TileIndex.Ice)
        && !(level.goal && level.goal.x === p.x && level.goal.y === p.y);
    return state.boulders.length <= level.boulders.length
        && (state.armedTraps ?? []).every(i => i >= 0 && i < level.traps.length)
        && cells.every(onGround)
        && new Set(cells.map(p => `${p.x},${p.y}`)).size === cells.length;
}

function isPoint (p: unknown): p is GridPoint
{
    const q = p as GridPoint | null;
    return typeof q === 'object' && q !== null && Number.isInteger(q.x) && Number.isInteger(q.y);
}
