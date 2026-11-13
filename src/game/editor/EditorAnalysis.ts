import { GridPoint, LevelData } from '../levels/LevelParser';
import { resolveMove } from '../movement/Movement';
import { cellKey, EditorLevel } from './EditorLevel';
import { AnalysisMessage, AnalysisRequest, FoundTile, LETTER_DIRECTIONS } from './analysisShared';

//  How long the map has to stay unchanged before a new search starts, so a paint drag doesn't
//  restart it for every cell
const RESTART_DELAY_MS = 200;

export interface AnalysisProgress
{
    running: boolean;
    states: number;
    depth: number;
    found: number;
    possible: number;
    //  When finished: false if the search hit its limit, so some tiles may be missing
    complete: boolean;
}

//  Part of a route, for drawing: cells the player or a pushed boulder passes through, in order
export interface PathSegment
{
    kind: 'player' | 'boulder';
    cells: GridPoint[];
}

//  Runs the editor's reachability search (analysis.worker.ts) in the background, restarting it
//  whenever the map changes, and keeps the results.
export class EditorAnalysis
{
    //  Cell key -> the shortest moves to reach it
    readonly results = new Map<string, string>();
    //  null when there's nothing to analyze (no player)
    progress: AnalysisProgress | null = null;
    //  The level as it was analyzed, for replaying routes
    private data: LevelData | null = null;
    private worker: Worker | null = null;
    private timer: number | null = null;

    //  onUpdate is called whenever the results or progress change, with the newly found tiles
    constructor (private readonly onUpdate: (tiles: FoundTile[]) => void) {}

    //  Discards the current results and analyzes the level again once it stops changing.
    //  freeSnowWalking: whether steps from snow to snow are free (see EditorSettings).
    restart (level: EditorLevel, freeSnowWalking: boolean, delay = RESTART_DELAY_MS)
    {
        this.stop();
        this.results.clear();
        this.data = null;
        this.progress = level.player
            ? { running: true, states: 0, depth: 0, found: 0, possible: 0, complete: false }
            : null;
        this.onUpdate([]);

        if (level.player)
        {
            this.timer = window.setTimeout(() => this.start(level, freeSnowWalking), delay);
        }
    }

    destroy ()
    {
        this.stop();
    }

    //  The route for a sequence of moves from the analyzed start, replayed with the game's rules
    replay (moves: string): PathSegment[]
    {
        if (!this.data)
        {
            return [];
        }
        const data: LevelData = { ...this.data, boulders: this.data.boulders.map(b => ({ ...b })) };
        let player = data.player;
        const segments: PathSegment[] = [];

        for (const letter of moves)
        {
            const result = resolveMove(data, player, LETTER_DIRECTIONS[letter]);
            switch (result.kind)
            {
                case 'walk':
                    segments.push({ kind: 'player', cells: [player, ...result.path] });
                    player = result.path[result.path.length - 1];
                    break;

                case 'exit':
                    segments.push({ kind: 'player', cells: [player, ...result.path, result.exit] });
                    player = result.exit;
                    break;

                case 'push':
                {
                    const boulder = data.boulders[result.boulderIndex];
                    segments.push({ kind: 'boulder', cells: [boulder, ...result.path] });
                    data.boulders[result.boulderIndex] = result.path[result.path.length - 1];
                    break;
                }
            }
        }
        return segments;
    }

    private start (level: EditorLevel, freeSnowWalking: boolean)
    {
        this.timer = null;
        const data = level.toLevelData();
        if (!data)
        {
            return;
        }
        this.data = data;

        const worker = new Worker(new URL('./analysis.worker.ts', import.meta.url), { type: 'module' });
        worker.addEventListener('message', (event: MessageEvent<AnalysisMessage>) =>
        {
            //  Ignore anything still arriving from a search that's been replaced
            if (this.worker !== worker)
            {
                return;
            }
            const m = event.data;
            for (const tile of m.tiles)
            {
                this.results.set(cellKey(tile.x, tile.y), tile.moves);
            }
            this.progress = {
                running: !m.done, states: m.states, depth: m.depth,
                found: m.found, possible: m.possible, complete: m.complete
            };
            if (m.done)
            {
                this.stop();
            }
            this.onUpdate(m.tiles);
        });
        worker.addEventListener('error', event =>
        {
            console.error('Level analysis failed:', event.message);
            this.stop();
            this.progress = null;
            this.onUpdate([]);
        });
        const request: AnalysisRequest = { level: data, freeSnowWalking };
        worker.postMessage(request);
        this.worker = worker;
    }

    private stop ()
    {
        if (this.timer !== null)
        {
            window.clearTimeout(this.timer);
            this.timer = null;
        }
        this.worker?.terminate();
        this.worker = null;
    }
}
