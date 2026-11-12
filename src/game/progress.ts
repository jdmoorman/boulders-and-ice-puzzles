import { LEVELS } from './levels/levelList';

//  Which levels the player has completed, by level key, kept in localStorage so it survives
//  reloads. Storage can be unavailable (private windows, blocked site data), so every access is
//  guarded and progress is also kept in memory for the current session.
const STORAGE_KEY = 'bouldersAndIce.completedLevels';

let completed: Set<string> | null = null;

function load (): Set<string>
{
    if (!completed)
    {
        completed = new Set();
        try
        {
            const saved: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
            if (Array.isArray(saved))
            {
                saved.filter((key): key is string => typeof key === 'string').forEach(key => completed!.add(key));
            }
        }
        catch
        {
            //  No saved progress available; start empty
        }
    }
    return completed;
}

export function markCompleted (levelKey: string): void
{
    const keys = load();
    keys.add(levelKey);
    try
    {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...keys]));
    }
    catch
    {
        //  Can't save; progress lasts for this session only
    }
}

//  The first level of each pack is always unlocked; every other level unlocks once the level
//  before it in the pack has been completed.
export function isUnlocked (levelIndex: number): boolean
{
    const level = LEVELS[levelIndex];
    const previous = LEVELS[levelIndex - 1];
    return level.number === 1 || (previous !== undefined && load().has(previous.key));
}
