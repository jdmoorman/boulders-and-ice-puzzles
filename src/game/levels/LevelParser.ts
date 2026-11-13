import { LEGEND } from './Tiles';

export interface GridPoint
{
    x: number;
    y: number;
}

export interface LevelData
{
    width: number;
    height: number;
    //  tiles[row][col], using TileIndex values
    tiles: number[][];
    player: GridPoint;
    //  null for a level with no exit, e.g. an editor playtest before one is placed
    goal: GridPoint | null;
    boulders: GridPoint[];
    //  Pressure plates
    plates: GridPoint[];
}

export class LevelParseError extends Error
{
    constructor (message: string)
    {
        super(message);
        this.name = 'LevelParseError';
    }
}

//  A parsed level that may not have a player yet, as the editor allows
export interface LevelDraft extends Omit<LevelData, 'player'>
{
    player: GridPoint | null;
}

//  Parses an ASCII level. Lines starting with ';' are comments.
//  Rows may differ in length: the map is as wide as the longest row, and
//  shorter rows are padded on the right with void.
export function parseLevel (text: string): LevelData
{
    const draft = parseLevelDraft(text);
    const { player } = draft;
    if (!player)
    {
        throw new LevelParseError("Level has no player start ('p' or 'P')");
    }
    return { ...draft, player };
}

//  Like parseLevel, but a level without a player is allowed.
export function parseLevelDraft (text: string): LevelDraft
{
    const rows = text
        .replace(/\r\n?/g, '\n')
        .split('\n')
        .filter(line => !line.startsWith(';'));

    //  Ignore blank lines at the start and end of the file
    while (rows.length > 0 && rows[0].trim() === '') { rows.shift(); }
    while (rows.length > 0 && rows[rows.length - 1].trim() === '') { rows.pop(); }

    if (rows.length === 0)
    {
        throw new LevelParseError('Level is empty');
    }

    const width = Math.max(...rows.map(line => line.length));
    const height = rows.length;
    const tiles: number[][] = [];
    const boulders: GridPoint[] = [];
    const plates: GridPoint[] = [];
    let player: GridPoint | null = null;
    let goal: GridPoint | null = null;

    rows.forEach((rawLine, y) =>
    {
        const line = rawLine.padEnd(width, ' ');
        const row: number[] = [];

        for (let x = 0; x < width; x++)
        {
            const ch = line[x];
            const entry = LEGEND[ch];

            if (!entry)
            {
                throw new LevelParseError(`Unknown character '${ch}' at row ${y + 1}, column ${x + 1}`);
            }

            row.push(entry.tile);

            if (entry.entity === 'goal')
            {
                if (goal)
                {
                    throw new LevelParseError(
                        `Second goal at row ${y + 1}, column ${x + 1} (first at row ${goal.y + 1}, column ${goal.x + 1})`
                    );
                }
                goal = { x, y };
            }

            if (entry.entity === 'player')
            {
                if (player)
                {
                    throw new LevelParseError(
                        `Second player start at row ${y + 1}, column ${x + 1} (first at row ${player.y + 1}, column ${player.x + 1})`
                    );
                }
                player = { x, y };
            }
            else if (entry.entity === 'boulder')
            {
                boulders.push({ x, y });
            }
            else if (entry.entity === 'plate')
            {
                plates.push({ x, y });
            }
        }

        tiles.push(row);
    });

    return { width, height, tiles, player, goal, boulders, plates };
}
