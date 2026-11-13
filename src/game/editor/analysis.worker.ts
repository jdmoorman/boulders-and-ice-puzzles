import { DIRECTION_DELTA, Direction, resolveMove } from '../movement/Movement';
import type { GridPoint, LevelData } from '../levels/LevelParser';
import { TileIndex } from '../levels/Tiles';
import { AnalysisMessage, DIRECTION_LETTERS, FoundTile, MAX_STATES } from './analysisShared';

//  Web Worker that finds the shortest move sequence from the player's start to every tile it
//  can reach. Receives a LevelData and posts AnalysisMessages (see analysisShared.ts).
//
//  Breadth-first search over positions: the player's cell plus the cells of all boulders
//  (boulders are interchangeable, so their cells are kept sorted). Moves follow the game's own
//  rules via resolveMove. A tile counts as reached by the first move that takes the player onto
//  or through it, so ice the player slides across counts too (an exit placed there would stop the
//  slide). Reaching the exit is a final move that isn't explored further.

const DIRECTIONS: readonly Direction[] = ['up', 'down', 'left', 'right'];
const PROGRESS_MS = 100;
const CHECK_EVERY = 1000;

addEventListener('message', (event: MessageEvent<LevelData>) => analyze(event.data));

function analyze (level: LevelData): void
{
    const { width } = level;
    const cellOf = (p: GridPoint) => p.y * width + p.x;
    const pointOf = (i: number): GridPoint => ({ x: i % width, y: Math.floor(i / width) });
    const possible = possibleTiles(level);

    //  Per position: the player's cell, its boulder cells (flat, boulderCount per position),
    //  the position it was reached from, the move taken, and its number of moves from the start
    const boulderCount = level.boulders.length;
    const players: number[] = [];
    const boulders: number[] = [];
    const parents: number[] = [];
    const moves: number[] = [];
    const depths: number[] = [];
    const seen = new Set<string>();

    //  Tile cell -> the moves to reach it
    const found = new Map<number, string>();
    let pending: FoundTile[] = [];

    const movesTo = (id: number, last?: Direction): string =>
    {
        let text = last ? DIRECTION_LETTERS[last] : '';
        for (let s = id; parents[s] >= 0; s = parents[s])
        {
            text = DIRECTION_LETTERS[DIRECTIONS[moves[s]]] + text;
        }
        return text;
    };

    const reach = (cell: number, id: number, last?: Direction) =>
    {
        if (!found.has(cell))
        {
            const text = movesTo(id, last);
            found.set(cell, text);
            pending.push({ ...pointOf(cell), moves: text });
        }
    };

    const addState = (player: number, cells: number[], parent: number, move: number, depth: number) =>
    {
        const key = stateKey(player, cells);
        if (seen.has(key))
        {
            return;
        }
        seen.add(key);
        const id = players.length;
        players.push(player);
        for (const c of cells)
        {
            boulders.push(c);
        }
        parents.push(parent);
        moves.push(move);
        depths.push(depth);
        reach(player, id);
    };

    const post = (done: boolean, complete: boolean, depth: number) =>
    {
        const message: AnalysisMessage = {
            states: players.length, depth, found: found.size, possible: possible.size,
            tiles: pending, done, complete
        };
        postMessage(message);
        pending = [];
    };

    addState(cellOf(level.player), level.boulders.map(cellOf).sort((a, b) => a - b), -1, 0, 0);

    //  One LevelData reused for every position, with its boulders swapped in
    const data: LevelData = { ...level, boulders: [] };
    let lastPost = performance.now();
    let complete = true;

    for (let s = 0; s < players.length && found.size < possible.size; s++)
    {
        if (players.length >= MAX_STATES)
        {
            complete = false;
            break;
        }
        if (s % CHECK_EVERY === 0 && performance.now() - lastPost >= PROGRESS_MS)
        {
            post(false, false, depths[s]);
            lastPost = performance.now();
        }

        const player = pointOf(players[s]);
        const cells = boulders.slice(s * boulderCount, (s + 1) * boulderCount);
        data.boulders = cells.map(pointOf);

        DIRECTIONS.forEach((dir, d) =>
        {
            const result = resolveMove(data, player, dir);
            switch (result.kind)
            {
                case 'walk':
                    //  Tiles slid through on the way; the end tile is reached by its new position
                    result.path.slice(0, -1).forEach(p => reach(cellOf(p), s, dir));
                    addState(cellOf(result.path[result.path.length - 1]), cells, s, d, depths[s] + 1);
                    break;

                case 'push':
                {
                    const moved = cells.slice();
                    moved[result.boulderIndex] = cellOf(result.path[result.path.length - 1]);
                    addState(players[s], moved.sort((a, b) => a - b), s, d, depths[s] + 1);
                    break;
                }

                case 'exit':
                    result.path.forEach(p => reach(cellOf(p), s, dir));
                    reach(cellOf(result.exit), s, dir);
                    break;
            }
        });
    }

    post(true, complete, depths[depths.length - 1] ?? 0);
}

//  A string identifying a position; each cell index takes two UTF-16 code units
function stateKey (player: number, cells: readonly number[]): string
{
    let key = String.fromCharCode(player & 0xffff, player >>> 16);
    for (const c of cells)
    {
        key += String.fromCharCode(c & 0xffff, c >>> 16);
    }
    return key;
}

//  Every tile the player could conceivably reach: the snow and ice connected to the start (any of
//  it could become a stopping point, given the right boulders), plus the exit if it borders them.
//  The search can stop once it has found all of these.
function possibleTiles (level: LevelData): Set<number>
{
    const { width, height, tiles } = level;
    const isGround = (x: number, y: number) =>
        x >= 0 && y >= 0 && x < width && y < height
        && (tiles[y][x] === TileIndex.Floor || tiles[y][x] === TileIndex.Ice);

    const cells = new Set<number>();
    const stack: GridPoint[] = [level.player];
    cells.add(level.player.y * width + level.player.x);
    let exitBorders = false;

    while (stack.length > 0)
    {
        const p = stack.pop()!;
        for (const d of Object.values(DIRECTION_DELTA))
        {
            const x = p.x + d.x;
            const y = p.y + d.y;
            const cell = y * width + x;
            if (level.goal && x === level.goal.x && y === level.goal.y)
            {
                exitBorders = true;
            }
            if (isGround(x, y) && !cells.has(cell))
            {
                cells.add(cell);
                stack.push({ x, y });
            }
        }
    }

    if (exitBorders && level.goal)
    {
        cells.add(level.goal.y * width + level.goal.x);
    }
    return cells;
}
