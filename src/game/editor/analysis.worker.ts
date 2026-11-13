import { DIRECTION_DELTA, Direction, resolveMove } from '../movement/Movement';
import type { GridPoint, LevelData } from '../levels/LevelParser';
import { TileIndex } from '../levels/Tiles';
import { AnalysisMessage, AnalysisRequest, DIRECTION_LETTERS, FoundTile, MAX_STATES } from './analysisShared';

//  Web Worker that finds the fewest moves from the player's start to every tile it can reach.
//  Receives an AnalysisRequest and posts AnalysisMessages (see analysisShared.ts).
//
//  Searches positions: the player's cell plus the cells of all boulders (boulders are
//  interchangeable, so their cells are kept sorted). Moves follow the game's own rules via
//  resolveMove. A tile counts as reached by the first move that takes the player onto or through
//  it, so ice the player slides across counts too (an exit placed there would stop the slide).
//  Reaching the exit is a final move that isn't explored further.
//
//  Walking around on snow is trivial, so with freeSnowWalking set, steps from snow to snow are
//  free; every other move costs 1. The search is a 0-1 breadth-first search: positions are
//  explored in order of cost, one cost at a time, with free steps joining the current cost and
//  paid moves the next. Without free steps it's a plain breadth-first search.

const DIRECTIONS: readonly Direction[] = ['up', 'down', 'left', 'right'];
const PROGRESS_MS = 100;
const CHECK_EVERY = 1000;

addEventListener('message', (event: MessageEvent<AnalysisRequest>) =>
    analyze(event.data.level, event.data.freeSnowWalking));

//  The best way found so far to reach a tile: from a position, plus the final move when the tile
//  is passed through (or is the exit) rather than stood on
interface Candidate
{
    cost: number;
    from: number;
    last?: Direction;
}

function analyze (level: LevelData, freeSnowWalking: boolean): void
{
    const { width, tiles } = level;
    const cellOf = (p: GridPoint) => p.y * width + p.x;
    const pointOf = (i: number): GridPoint => ({ x: i % width, y: Math.floor(i / width) });
    //  Snow whose steps to more snow are free
    const isFreeSnow = (p: GridPoint) => freeSnowWalking && tiles[p.y][p.x] === TileIndex.Floor;
    const possible = possibleTiles(level);

    //  Per position: the player's cell, its boulder cells (flat, boulderCount per position),
    //  the position it was reached from, the move taken, its cost from the start, and whether its
    //  cost is final
    const boulderCount = level.boulders.length;
    const players: number[] = [];
    const boulders: number[] = [];
    const parents: number[] = [];
    const moves: number[] = [];
    const costs: number[] = [];
    const settled: boolean[] = [];
    const ids = new Map<string, number>();

    //  Tiles whose cost may still drop, and tiles whose cost is final (cell -> moves)
    const candidates = new Map<number, Candidate>();
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

    const reach = (cell: number, cost: number, from: number, last?: Direction) =>
    {
        if (found.has(cell))
        {
            return;
        }
        const best = candidates.get(cell);
        if (!best || cost < best.cost)
        {
            candidates.set(cell, { cost, from, last });
        }
    };

    const settle = (cell: number, c: Candidate) =>
    {
        const text = movesTo(c.from, c.last);
        found.set(cell, text);
        pending.push({ ...pointOf(cell), moves: text, cost: c.cost });
        candidates.delete(cell);
    };

    //  Every position explored from now on costs at least `cost`, so tiles reached for that
    //  much or less can't get any cheaper
    const finalize = (cost: number) =>
    {
        for (const [cell, c] of candidates)
        {
            if (c.cost <= cost)
            {
                settle(cell, c);
            }
        }
    };

    //  Positions to explore at the current cost, and at the next
    let current: number[] = [];
    let next: number[] = [];

    const addState = (player: number, cells: number[], parent: number, move: number, cost: number) =>
    {
        const key = stateKey(player, cells);
        let id = ids.get(key);
        if (id === undefined)
        {
            id = players.length;
            ids.set(key, id);
            players.push(player);
            for (const c of cells)
            {
                boulders.push(c);
            }
            parents.push(parent);
            moves.push(move);
            costs.push(cost);
            settled.push(false);
        }
        else if (settled[id] || cost >= costs[id])
        {
            return;
        }
        else
        {
            parents[id] = parent;
            moves[id] = move;
            costs[id] = cost;
        }
        (cost === costOf ? current : next).push(id);
    };

    const post = (done: boolean, complete: boolean) =>
    {
        const message: AnalysisMessage = {
            states: players.length, depth: costOf, found: found.size, possible: possible.size,
            tiles: pending, done, complete
        };
        postMessage(message);
        pending = [];
    };

    //  The cost being explored
    let costOf = 0;
    addState(cellOf(level.player), level.boulders.map(cellOf).sort((a, b) => a - b), -1, 0, 0);

    //  One LevelData reused for every position, with its boulders swapped in
    const data: LevelData = { ...level, boulders: [] };
    let lastPost = performance.now();
    let complete = true;
    let expanded = 0;

    search:
    while (current.length > 0)
    {
        //  Tiles slid through for this cost while exploring the cost before
        finalize(costOf);
        for (let i = 0; i < current.length; i++)
        {
            const s = current[i];
            if (settled[s])
            {
                continue;
            }
            settled[s] = true;
            //  Nothing explored later is cheaper, so the player's tile is settled
            if (!found.has(players[s]))
            {
                settle(players[s], { cost: costOf, from: s });
            }
            if (found.size >= possible.size)
            {
                break search;
            }
            if (players.length >= MAX_STATES)
            {
                complete = false;
                break search;
            }
            if (++expanded % CHECK_EVERY === 0 && performance.now() - lastPost >= PROGRESS_MS)
            {
                post(false, false);
                lastPost = performance.now();
            }

            const player = pointOf(players[s]);
            const cells = boulders.slice(s * boulderCount, (s + 1) * boulderCount);
            data.boulders = cells.map(pointOf);
            const onFreeSnow = isFreeSnow(player);

            DIRECTIONS.forEach((dir, d) =>
            {
                const result = resolveMove(data, player, dir);
                switch (result.kind)
                {
                    case 'walk':
                    {
                        const end = result.path[result.path.length - 1];
                        if (onFreeSnow && result.path.length === 1 && isFreeSnow(end))
                        {
                            addState(cellOf(end), cells, s, d, costOf);
                            break;
                        }
                        //  Tiles slid through on the way; the end tile is reached by its new position
                        result.path.slice(0, -1).forEach(p => reach(cellOf(p), costOf + 1, s, dir));
                        addState(cellOf(end), cells, s, d, costOf + 1);
                        break;
                    }

                    case 'push':
                    {
                        const moved = cells.slice();
                        moved[result.boulderIndex] = cellOf(result.path[result.path.length - 1]);
                        addState(players[s], moved.sort((a, b) => a - b), s, d, costOf + 1);
                        break;
                    }

                    case 'exit':
                    {
                        //  Stepping straight off snow into the exit is free, like any free snow step
                        const fromFreeSnow = onFreeSnow && result.path.length === 0;
                        result.path.forEach(p => reach(cellOf(p), costOf + 1, s, dir));
                        reach(cellOf(result.exit), fromFreeSnow ? costOf : costOf + 1, s, dir);
                        break;
                    }
                }
            });
        }

        //  Exits reached for free at this cost can't get cheaper either
        finalize(costOf);
        current = next;
        next = [];
        costOf++;
    }

    finalize(Infinity);
    post(true, complete);
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
            //  The exit stands on snow or ice, but nothing can pass through it
            if (level.goal && x === level.goal.x && y === level.goal.y)
            {
                exitBorders = true;
                continue;
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
