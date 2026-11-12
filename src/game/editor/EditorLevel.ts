import { GridPoint, LevelData } from '../levels/LevelParser';
import { TileIndex } from '../levels/Tiles';

export type EditorTool = 'wall' | 'snow' | 'ice' | 'exit' | 'player' | 'boulder' | 'erase';

//  Default editing canvas size, in tiles. A level that doesn't fit with MARGIN tiles to spare
//  gets a bigger canvas.
export const EDITOR_SIZE = 64;
const MARGIN = 16;

export const cellKey = (x: number, y: number) => `${x},${y}`;
const isGround = (tile: number) => tile === TileIndex.Floor || tile === TileIndex.Ice;
const samePoint = (a: GridPoint | null, b: GridPoint | null) =>
    a === b || (a !== null && b !== null && a.x === b.x && a.y === b.y);

//  A copy of a level's contents, for undo and redo. Tiles are flattened row by row, one byte each.
export interface EditorSnapshot
{
    tiles: Int8Array;
    player: GridPoint | null;
    goal: GridPoint | null;
    boulders: string[];
}

//  The level being edited: a fixed-size square canvas of tiles plus the player, boulders and
//  exit. Plain data, so it can be kept in the registry across playtests.
export class EditorLevel
{
    readonly size: number;
    //  tiles[row][col], using TileIndex values; empty cells are TileIndex.Void
    readonly tiles: number[][];
    player: GridPoint | null = null;
    goal: GridPoint | null = null;
    //  Boulder positions as "x,y" keys
    readonly boulders = new Set<string>();

    constructor (size = EDITOR_SIZE)
    {
        this.size = size;
        this.tiles = Array.from({ length: size }, () => new Array<number>(size).fill(TileIndex.Void));
    }

    //  Builds an editor level from a parsed level, centred on the canvas.
    static fromLevelData (data: LevelData): EditorLevel
    {
        const size = Math.max(EDITOR_SIZE, Math.max(data.width, data.height) + MARGIN * 2);
        const level = new EditorLevel(size);
        const ox = Math.floor((size - data.width) / 2);
        const oy = Math.floor((size - data.height) / 2);

        data.tiles.forEach((row, y) => row.forEach((tile, x) =>
        {
            level.tiles[y + oy][x + ox] = tile;
        }));
        level.player = { x: data.player.x + ox, y: data.player.y + oy };
        level.goal = data.goal && { x: data.goal.x + ox, y: data.goal.y + oy };
        for (const b of data.boulders)
        {
            level.boulders.add(cellKey(b.x + ox, b.y + oy));
        }
        return level;
    }

    inBounds (x: number, y: number): boolean
    {
        return x >= 0 && y >= 0 && x < this.size && y < this.size;
    }

    isPlayerAt (x: number, y: number): boolean
    {
        return this.player !== null && this.player.x === x && this.player.y === y;
    }

    hasBoulderAt (x: number, y: number): boolean
    {
        return this.boulders.has(cellKey(x, y));
    }

    snapshot (): EditorSnapshot
    {
        const tiles = new Int8Array(this.size * this.size);
        this.tiles.forEach((row, y) => tiles.set(row, y * this.size));
        return {
            tiles,
            player: this.player && { ...this.player },
            goal: this.goal && { ...this.goal },
            boulders: [...this.boulders]
        };
    }

    //  Replaces the level's contents with a snapshot. Returns the cells that changed.
    restore (s: EditorSnapshot): GridPoint[]
    {
        const changed: GridPoint[] = [];
        for (let y = 0; y < this.size; y++)
        {
            const row = this.tiles[y];
            for (let x = 0; x < this.size; x++)
            {
                const tile = s.tiles[y * this.size + x];
                if (row[x] !== tile)
                {
                    row[x] = tile;
                    changed.push({ x, y });
                }
            }
        }

        const boulders = new Set(s.boulders);
        for (const k of new Set([...this.boulders, ...boulders]))
        {
            if (this.boulders.has(k) !== boulders.has(k))
            {
                const [x, y] = k.split(',').map(Number);
                changed.push({ x, y });
            }
        }
        this.boulders.clear();
        boulders.forEach(k => this.boulders.add(k));

        for (const [now, then] of [[this.player, s.player], [this.goal, s.goal]] as const)
        {
            if (!samePoint(now, then))
            {
                changed.push(...[now, then].filter((p): p is GridPoint => p !== null));
            }
        }
        this.player = s.player && { ...s.player };
        this.goal = s.goal && { ...s.goal };
        return changed;
    }

    //  Applies a tool to the cell at (x, y). Returns the cells whose contents changed (the
    //  player or exit moving away changes their old cell too), or [] if nothing changed.
    applyTool (tool: EditorTool, x: number, y: number): GridPoint[]
    {
        if (!this.inBounds(x, y))
        {
            return [];
        }

        const before = this.cellState(x, y);
        const oldPlayer = this.player;
        const oldGoal = this.goal;
        const changed: GridPoint[] = [];

        switch (tool)
        {
            case 'wall':
                this.setTile(x, y, TileIndex.Wall);
                this.clearEntity(x, y);
                break;

            case 'snow':
                this.setTile(x, y, TileIndex.Floor);
                break;

            case 'ice':
                this.setTile(x, y, TileIndex.Ice);
                break;

            case 'exit':
                if (this.goal && (this.goal.x !== x || this.goal.y !== y))
                {
                    //  Only one exit: the old one becomes snow
                    this.tiles[this.goal.y][this.goal.x] = TileIndex.Floor;
                }
                this.tiles[y][x] = TileIndex.Goal;
                this.goal = { x, y };
                this.clearEntity(x, y);
                break;

            case 'player':
                this.makeGround(x, y);
                this.boulders.delete(cellKey(x, y));
                this.player = { x, y };
                break;

            case 'boulder':
                this.makeGround(x, y);
                if (this.isPlayerAt(x, y))
                {
                    this.player = null;
                }
                this.boulders.add(cellKey(x, y));
                break;

            case 'erase':
                this.setTile(x, y, TileIndex.Void);
                this.clearEntity(x, y);
                break;
        }

        if (this.cellState(x, y) !== before)
        {
            changed.push({ x, y });
        }
        for (const old of [oldPlayer, oldGoal])
        {
            if (old && (old.x !== x || old.y !== y) && (old !== this.player && old !== this.goal))
            {
                changed.push(old);
            }
        }
        return changed;
    }

    //  Reasons the level can't be played yet (empty when it's playable). An exit is optional.
    problems (): string[]
    {
        return this.player ? [] : ['Place a player to play.'];
    }

    //  The level as text in the .txt level format, trimmed to the cells in use.
    //  Returns null if the canvas is empty.
    toText (): string | null
    {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        this.tiles.forEach((row, y) => row.forEach((tile, x) =>
        {
            if (tile !== TileIndex.Void)
            {
                minX = Math.min(minX, x);
                minY = Math.min(minY, y);
                maxX = Math.max(maxX, x);
                maxY = Math.max(maxY, y);
            }
        }));
        if (minX === Infinity)
        {
            return null;
        }

        const lines: string[] = [];
        for (let y = minY; y <= maxY; y++)
        {
            let line = '';
            for (let x = minX; x <= maxX; x++)
            {
                line += this.charAt(x, y);
            }
            lines.push(line.trimEnd());
        }
        return lines.join('\n') + '\n';
    }

    //  The level-format character for a cell
    private charAt (x: number, y: number): string
    {
        const tile = this.tiles[y][x];
        const onIce = tile === TileIndex.Ice;
        if (this.isPlayerAt(x, y))
        {
            return onIce ? 'P' : 'p';
        }
        if (this.hasBoulderAt(x, y))
        {
            return onIce ? 'B' : 'b';
        }
        switch (tile)
        {
            case TileIndex.Wall: return '#';
            case TileIndex.Floor: return '.';
            case TileIndex.Ice: return '_';
            case TileIndex.Goal: return 'x';
            default: return ' ';
        }
    }

    //  Sets a tile, keeping track of the exit if it's overwritten
    private setTile (x: number, y: number, tile: TileIndex)
    {
        if (this.goal && this.goal.x === x && this.goal.y === y && tile !== TileIndex.Goal)
        {
            this.goal = null;
        }
        this.tiles[y][x] = tile;
    }

    //  Makes the cell snow unless it's already snow or ice (entities only stand on ground)
    private makeGround (x: number, y: number)
    {
        if (!isGround(this.tiles[y][x]))
        {
            this.setTile(x, y, TileIndex.Floor);
        }
    }

    private clearEntity (x: number, y: number)
    {
        if (this.isPlayerAt(x, y))
        {
            this.player = null;
        }
        this.boulders.delete(cellKey(x, y));
    }

    //  A string describing everything in a cell, for change detection
    private cellState (x: number, y: number): string
    {
        return `${this.tiles[y][x]}|${this.isPlayerAt(x, y)}|${this.hasBoulderAt(x, y)}`;
    }
}
