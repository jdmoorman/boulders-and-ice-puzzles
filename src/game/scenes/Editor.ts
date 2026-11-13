import { Scene, Scenes, GameObjects, Input, Tilemaps } from 'phaser';
import { cellKey, EditorLevel, EditorSnapshot, EditorTool } from '../editor/EditorLevel';
import { parseLevelDraft, GridPoint, LevelParseError } from '../levels/LevelParser';
import { TILE_SIZE, TileIndex } from '../levels/Tiles';
import { AUTOTILE_SETS, AutotileSet, displayTileIndex, isTallSet } from '../levels/autotile';
import { addBoulder, addDoor, addGoal, addPlate, addPlayer, addTallTile, tileCenter } from '../levels/LevelLoader';
import { playerAnimKey } from '../playerAnimations';
import type { GameData } from './Game';
import { AnalysisProgress, EditorAnalysis } from '../editor/EditorAnalysis';
import type { FoundTile } from '../editor/analysisShared';
import { EditorSettings, loadEditorSettings, saveEditorSettings } from '../editor/EditorSettings';
import { TEXT_STYLE } from '../ui/Button';

//  Everything the editor keeps between visits (e.g. while playtesting), stored in the registry
interface EditorState
{
    level: EditorLevel;
    tool: EditorTool;
    scrollX: number;
    scrollY: number;
    zoom: number;
    //  Snapshots from before each edit (undo) and before each undo (redo), oldest first
    undo: EditorSnapshot[];
    redo: EditorSnapshot[];
    //  File name suggested when exporting: the opened or imported file's, or the last one saved to
    fileName: string;
}

const DEFAULT_FILE_NAME = 'level.txt';

//  The File System Access API's save dialog (Chrome and Edge); not in TypeScript's DOM types yet
type SaveFilePicker = (options: {
    suggestedName?: string;
    types?: { description: string, accept: Record<string, string[]> }[];
}) => Promise<{ name: string, createWritable (): Promise<{ write (data: string): Promise<void>, close (): Promise<void> }> }>;

const STATE_KEY = 'editorState';
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2;
const HISTORY_LIMIT = 1000;
//  Limits on imported files, so a stray large file can't build a huge canvas
const MAX_IMPORT_BYTES = 256 * 1024;
const MAX_IMPORT_SIZE = 256;
//  Above every y-sorted object on the canvas
const OVERLAY_DEPTH = 1e7;

//  Palette tools, in order (keys 1-8)
export const PALETTE: readonly EditorTool[] = ['wall', 'snow', 'ice', 'exit', 'player', 'boulder', 'plate', 'door'];

//  Tools that paint every cell along a drag. The others (exit, player) are placed
//  once, on the cell where the mouse was pressed.
const DRAG_TOOLS: ReadonlySet<EditorTool> = new Set<EditorTool>(['wall', 'snow', 'ice', 'boulder', 'plate', 'door', 'erase', 'erase-entity']);

//  Events emitted on this scene's event emitter for the HUD
export const EDITOR_EVENTS = {
    TOOL: 'editor-tool',
    MESSAGE: 'editor-message',
    //  Analysis mode turned on or off (boolean)
    ANALYSIS: 'editor-analysis',
    //  The reachability search's progress changed (AnalysisProgress | null)
    PROGRESS: 'editor-progress',
    //  The editor's options changed (EditorSettings)
    SETTINGS: 'editor-settings'
} as const;

const PATH_COLOR = 0x1f5fa8;
const BOULDER_PATH_COLOR = 0xb85a10;

//  Level editor: the canvas, mouse painting, panning and zooming. The palette and buttons are
//  in the EditorHud scene, launched on top so they aren't affected by the camera.
export class Editor extends Scene
{
    private state: EditorState;
    private layer: Tilemaps.TilemapLayer;
    private isTall: (set: AutotileSet) => boolean;
    private tallImages = new Map<string, GameObjects.Image>();
    private boulderImages = new Map<string, GameObjects.Image>();
    private plateImages = new Map<string, GameObjects.Sprite>();
    private doorImages = new Map<string, GameObjects.Sprite>();
    private playerSprite: GameObjects.Sprite | null = null;
    private goalImage: GameObjects.Image | null = null;
    private hover: GameObjects.Rectangle;
    //  The tool being dragged with, and the last cell it was applied to
    private stroke: { tool: EditorTool, last: GridPoint } | null = null;
    //  The level as it was when the mouse was pressed; added to the undo history once the
    //  gesture changes something
    private pending: EditorSnapshot | null = null;
    //  Set when the registry already holds the state to start from next time
    private skipSave = false;
    //  The background reachability search, and analysis mode's overlay: move counts on reached
    //  tiles, unreachable tiles dimmed, and the route to the hovered tile
    private analysis: EditorAnalysis;
    private analyzing = false;
    private analysisOverlay: GameObjects.Container;
    private dimGraphics: GameObjects.Graphics;
    private pathGraphics: GameObjects.Graphics;
    private hoverCell: GridPoint | null = null;
    private settings: EditorSettings;
    //  Set by the HUD while a popup is open, so keys, clicks and scrolling don't edit the canvas
    inputLocked = false;

    constructor ()
    {
        super('Editor');
    }

    get tool (): EditorTool
    {
        return this.state.tool;
    }

    get isAnalyzing (): boolean
    {
        return this.analyzing;
    }

    get analysisProgress (): AnalysisProgress | null
    {
        return this.analysis.progress;
    }

    get editorSettings (): Readonly<EditorSettings>
    {
        return this.settings;
    }

    create ()
    {
        this.tallImages.clear();
        this.boulderImages.clear();
        this.plateImages.clear();
        this.doorImages.clear();
        this.playerSprite = null;
        this.goalImage = null;
        this.stroke = null;
        this.pending = null;
        this.skipSave = false;
        this.analyzing = loadAnalyzeSetting();
        this.hoverCell = null;
        this.settings = loadEditorSettings();
        this.inputLocked = false;

        const camera = this.cameras.main;
        camera.setBackgroundColor(0x141a22);

        const saved = this.registry.get(STATE_KEY) as EditorState | undefined;
        this.state = saved ?? this.initialState(new EditorLevel(), 'wall');
        this.state.fileName ??= DEFAULT_FILE_NAME;
        this.state.undo ??= [];
        this.state.redo ??= [];
        camera.setScroll(this.state.scrollX, this.state.scrollY).setZoom(this.state.zoom);

        this.isTall = set => isTallSet(this, set);
        this.createCanvas();
        this.createAnalysisOverlay();
        this.setupInput();

        this.analysis = new EditorAnalysis(tiles => this.onAnalysisUpdate(tiles));
        this.analysis.restart(this.state.level, this.settings.freeSnowWalking, 0);

        //  Keep the editor's state for next time, and take the HUD down with the editor
        this.events.once(Scenes.Events.SHUTDOWN, () =>
        {
            this.scene.stop('EditorHud');
            this.analysis.destroy();
            if (this.skipSave)
            {
                return;
            }
            this.state.scrollX = camera.scrollX;
            this.state.scrollY = camera.scrollY;
            this.state.zoom = camera.zoom;
            this.registry.set(STATE_KEY, this.state);
        });

        this.scene.launch('EditorHud');
    }

    selectTool (tool: EditorTool)
    {
        this.state.tool = tool;
        this.events.emit(EDITOR_EVENTS.TOOL, tool);
    }

    //  Turns analysis mode on or off: move counts on reachable tiles, unreachable ones shaded, and
    //  the shortest route to the tile under the mouse. Editing still works while it's on.
    toggleAnalysis ()
    {
        this.analyzing = !this.analyzing;
        saveAnalyzeSetting(this.analyzing);
        this.analysisOverlay.setVisible(this.analyzing);
        this.dimGraphics.setVisible(this.analyzing);
        this.showRoute();
        this.events.emit(EDITOR_EVENTS.ANALYSIS, this.analyzing);
    }

    //  Changes some of the editor's options and remembers them
    changeSettings (changes: Partial<EditorSettings>)
    {
        const before = this.settings.freeSnowWalking;
        this.settings = { ...this.settings, ...changes };
        saveEditorSettings(this.settings);
        if (this.settings.freeSnowWalking !== before)
        {
            this.analysis.restart(this.state.level, this.settings.freeSnowWalking, 0);
        }
        this.events.emit(EDITOR_EVENTS.SETTINGS, this.settings);
    }

    undo ()
    {
        this.stepHistory(this.state.undo, this.state.redo, 'Nothing to undo.');
    }

    redo ()
    {
        this.stepHistory(this.state.redo, this.state.undo, 'Nothing to redo.');
    }

    //  Restores the newest snapshot in `from`, saving the current level to `to`
    private stepHistory (from: EditorSnapshot[], to: EditorSnapshot[], emptyMessage: string)
    {
        if (this.stroke)
        {
            return;
        }
        const snapshot = from.pop();
        if (!snapshot)
        {
            this.message(emptyMessage);
            return;
        }
        to.push(this.state.level.snapshot());
        this.redrawCells(this.state.level.restore(snapshot));
    }

    //  Starts a playtest of the current map, or reports why it can't be played
    play ()
    {
        const problems = this.state.level.problems();
        const text = this.state.level.toText();
        if (problems.length > 0 || !text)
        {
            this.message(problems[0] ?? 'Place a player to play.');
            return;
        }
        const data: GameData = { levelText: text };
        this.scene.start('Game', data);
    }

    //  Lets the user pick a .txt level file to replace the map with
    importLevel ()
    {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.txt,text/plain';
        input.addEventListener('change', () =>
        {
            const file = input.files?.[0];
            if (file)
            {
                this.importFile(file);
            }
        });
        input.click();
    }

    //  Replaces the map with a level file, or reports why it can't be read
    private async importFile (file: File)
    {
        if (file.size > MAX_IMPORT_BYTES)
        {
            this.message(`${file.name} is too large to be a level.`);
            return;
        }

        let text: string;
        try
        {
            text = await file.text();
        }
        catch
        {
            this.message(`Couldn't read ${file.name}.`);
            return;
        }

        try
        {
            const data = parseLevelDraft(text);
            if (data.width > MAX_IMPORT_SIZE || data.height > MAX_IMPORT_SIZE)
            {
                this.message(`${file.name} is larger than ${MAX_IMPORT_SIZE}x${MAX_IMPORT_SIZE} tiles.`);
                return;
            }
            this.loadLevel(EditorLevel.fromLevelData(data), file.name);
        }
        catch (error)
        {
            if (!(error instanceof LevelParseError))
            {
                throw error;
            }
            this.message(`Couldn't import ${file.name}: ${error.message}.`);
        }
    }

    //  Replaces the map, centred in view, with a fresh undo history
    private loadLevel (level: EditorLevel, fileName: string)
    {
        if (!this.scene.isActive())
        {
            return;
        }
        this.registry.set(STATE_KEY, { ...this.initialState(level, this.state.tool), fileName });
        //  Skip the shutdown save, which would overwrite the new state
        this.skipSave = true;
        this.scene.restart();
    }

    //  Saves the map as a .txt level file, letting the user choose where and under what name
    //  where the browser supports it (otherwise it downloads)
    async exportLevel ()
    {
        const text = this.state.level.toText();
        if (!text)
        {
            this.message('Nothing to export yet.');
            return;
        }

        const picker = (window as { showSaveFilePicker?: SaveFilePicker }).showSaveFilePicker;
        if (picker)
        {
            try
            {
                const handle = await picker.call(window, {
                    suggestedName: this.state.fileName,
                    types: [{ description: 'Level', accept: { 'text/plain': ['.txt'] } }]
                });
                const writable = await handle.createWritable();
                await writable.write(text);
                await writable.close();
                this.state.fileName = handle.name;
                this.message(`Saved ${handle.name}.`);
            }
            catch (error)
            {
                //  Closing the dialog without saving isn't an error
                if (error instanceof DOMException && error.name === 'AbortError')
                {
                    return;
                }
                this.message(`Couldn't save the level: ${error instanceof Error ? error.message : error}`);
                return;
            }
        }
        else
        {
            downloadText(text, this.state.fileName);
            this.message(`Downloaded ${this.state.fileName}.`);
        }
    }

    toMainMenu ()
    {
        this.scene.start('MainMenu');
    }

    //  A fresh state for a level: zoom 1, with the view centred on the canvas
    private initialState (level: EditorLevel, tool: EditorTool): EditorState
    {
        const camera = this.cameras.main;
        const centre = level.size * TILE_SIZE / 2;
        return {
            level,
            tool,
            scrollX: centre - camera.width / 2,
            scrollY: centre - camera.height / 2,
            zoom: 1,
            undo: [],
            redo: [],
            fileName: DEFAULT_FILE_NAME
        };
    }

    private message (text: string)
    {
        this.events.emit(EDITOR_EVENTS.MESSAGE, text);
    }

    //  Builds the tilemap, grid lines, hover outline and every cell's images
    private createCanvas ()
    {
        const { level } = this.state;
        const size = level.size;

        const map = this.make.tilemap({ width: size, height: size, tileWidth: TILE_SIZE, tileHeight: TILE_SIZE });
        const tileset = map.addTilesetImage('tiles', 'tiles', TILE_SIZE, TILE_SIZE);
        const layer = tileset && map.createBlankLayer('terrain', tileset);
        if (!layer)
        {
            throw new Error('Could not create the editor tilemap layer');
        }
        this.layer = layer;

        this.add.grid(0, 0, size * TILE_SIZE, size * TILE_SIZE, TILE_SIZE, TILE_SIZE, 0x000000, 0, 0xffffff, 0.12)
            .setOrigin(0)
            .setDepth(OVERLAY_DEPTH);

        this.hover = this.add.rectangle(0, 0, TILE_SIZE, TILE_SIZE)
            .setOrigin(0)
            .setStrokeStyle(3, 0xf2c230)
            .setDepth(OVERLAY_DEPTH + 1)
            .setVisible(false);

        for (let y = 0; y < size; y++)
        {
            for (let x = 0; x < size; x++)
            {
                this.drawTerrain(x, y);
                this.drawBoulder(x, y);
                this.drawPlate(x, y);
                this.drawDoor(x, y);
            }
        }
        this.drawPlayerAndGoal();
    }

    //  Redraws the terrain of a cell (its autotile frame depends on its neighbours)
    private drawTerrain (x: number, y: number)
    {
        const { level } = this.state;
        if (!level.inBounds(x, y))
        {
            return;
        }

        const index = displayTileIndex(level.tiles, x, y, this.isTall);
        if (index === TileIndex.Void)
        {
            this.layer.removeTileAt(x, y);
        }
        else
        {
            this.layer.putTileAt(index, x, y);
        }

        const key = cellKey(x, y);
        this.tallImages.get(key)?.destroy();
        this.tallImages.delete(key);
        const set = AUTOTILE_SETS.find(s => s.tiles.includes(level.tiles[y][x]));
        if (set && this.isTall(set))
        {
            this.tallImages.set(key, addTallTile(this, set, level.tiles, x, y));
        }
    }

    private drawBoulder (x: number, y: number)
    {
        this.drawCellImage(this.boulderImages, this.state.level.hasBoulderAt(x, y), x, y, addBoulder);
    }

    private drawPlate (x: number, y: number)
    {
        this.drawCellImage(this.plateImages, this.state.level.hasPlateAt(x, y), x, y, addPlate);
    }

    //  Doors are shown closed
    private drawDoor (x: number, y: number)
    {
        this.drawCellImage(this.doorImages, this.state.level.hasDoorAt(x, y), x, y, addDoor);
    }

    //  Adds or removes a cell's image in `images` to match whether the cell has the thing (`has`)
    private drawCellImage<T extends GameObjects.GameObject> (
        images: Map<string, T>, has: boolean, x: number, y: number, add: (scene: Scene, p: GridPoint) => T
    )
    {
        const key = cellKey(x, y);
        const image = images.get(key);
        if (has && !image)
        {
            images.set(key, add(this, { x, y }));
        }
        else if (!has && image)
        {
            image.destroy();
            images.delete(key);
        }
    }

    private drawPlayerAndGoal ()
    {
        const { player, goal } = this.state.level;

        this.playerSprite?.destroy();
        this.playerSprite = player ? addPlayer(this, player).play(playerAnimKey('idle', 'down')) : null;

        this.goalImage?.destroy();
        this.goalImage = null;
        if (goal)
        {
            this.goalImage = addGoal(this, goal);
        }
    }

    //  Applies the stroke's tool to a cell and redraws what changed
    private applyAt (tool: EditorTool, x: number, y: number)
    {
        const changed = this.state.level.applyTool(tool, x, y);
        if (changed.length > 0 && this.pending)
        {
            const { undo } = this.state;
            undo.push(this.pending);
            if (undo.length > HISTORY_LIMIT)
            {
                undo.shift();
            }
            this.state.redo.length = 0;
            this.pending = null;
        }
        this.redrawCells(changed);
    }

    //  Redraws changed cells, their neighbours' terrain (autotile frames depend on neighbours),
    //  and the player and exit
    private redrawCells (changed: GridPoint[])
    {
        for (const cell of changed)
        {
            for (let dy = -1; dy <= 1; dy++)
            {
                for (let dx = -1; dx <= 1; dx++)
                {
                    this.drawTerrain(cell.x + dx, cell.y + dy);
                }
            }
            this.drawBoulder(cell.x, cell.y);
            this.drawPlate(cell.x, cell.y);
            this.drawDoor(cell.x, cell.y);
        }
        if (changed.length > 0)
        {
            this.drawPlayerAndGoal();
            this.analysis.restart(this.state.level, this.settings.freeSnowWalking);
        }
    }

    private createAnalysisOverlay ()
    {
        //  Just above the terrain and the exit, so walls, boulders and the player stand in front
        //  of the shadow (they're y-sorted from depth TILE_SIZE / 2 up)
        this.dimGraphics = this.add.graphics().setDepth(1).setVisible(this.analyzing);
        this.analysisOverlay = this.add.container(0, 0)
            .setDepth(OVERLAY_DEPTH + 2)
            .setVisible(this.analyzing);
        this.pathGraphics = this.add.graphics().setDepth(OVERLAY_DEPTH + 3);
    }

    //  Called when the search restarts, finds tiles or finishes
    private onAnalysisUpdate (tiles: FoundTile[])
    {
        const { results, progress } = this.analysis;
        if (results.size === 0)
        {
            //  A fresh search: clear the old move counts
            this.analysisOverlay.removeAll(true);
            this.dimGraphics.clear();
        }

        for (const tile of tiles)
        {
            //  In the tile's top-left corner, clear of the route lines through its centre
            const x = tile.x * TILE_SIZE + 6;
            const y = tile.y * TILE_SIZE + 4;
            this.analysisOverlay.add(this.add.text(x, y, `${tile.cost}`, { ...TEXT_STYLE, fontSize: 16, strokeThickness: 4 }));
        }

        //  Once the search is known to be complete, dim the ground it never reached
        if (progress && !progress.running && progress.complete)
        {
            this.dimUnreached();
        }

        this.events.emit(EDITOR_EVENTS.PROGRESS, progress);
        this.showRoute();
    }

    private dimUnreached ()
    {
        const { level } = this.state;
        this.dimGraphics.clear().fillStyle(0x000000, 0.5);
        level.tiles.forEach((row, y) => row.forEach((tile, x) =>
        {
            const ground = tile === TileIndex.Floor || tile === TileIndex.Ice;
            if (ground && !this.analysis.results.has(cellKey(x, y)))
            {
                this.dimGraphics.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
            }
        }));
    }

    //  In analysis mode, draws the shortest route to the hovered tile
    private showRoute ()
    {
        const g = this.pathGraphics.clear();
        if (!this.analyzing)
        {
            return;
        }

        const cell = this.hoverCell;
        const moves = cell && this.analysis.results.get(cellKey(cell.x, cell.y));
        if (cell && moves)
        {
            this.drawRoute(g, moves, cell);
        }
    }

    //  Draws the route, cut off at the target if the last move slides through it rather than
    //  stopping there
    private drawRoute (g: GameObjects.Graphics, moves: string, target: GridPoint)
    {
        const segments = this.analysis.replay(moves);
        //  The move that reaches a tile is always the player's (pushes don't move the player)
        const last = segments[segments.length - 1];
        if (last?.kind === 'player')
        {
            const i = last.cells.findIndex(p => p.x === target.x && p.y === target.y);
            if (i >= 0 && i < last.cells.length - 1)
            {
                last.cells = last.cells.slice(0, i + 1);
            }
        }

        const start = this.state.level.player;
        if (start)
        {
            const { x, y } = tileCenter(start);
            g.fillStyle(0xffffff, 0.9).fillCircle(x, y, 10);
        }

        for (const segment of segments)
        {
            const color = segment.kind === 'player' ? PATH_COLOR : BOULDER_PATH_COLOR;
            const points = segment.cells.map(tileCenter);
            g.lineStyle(6, color, 0.9).beginPath();
            g.moveTo(points[0].x, points[0].y);
            points.slice(1).forEach(p => g.lineTo(p.x, p.y));
            g.strokePath();

            const end = points[points.length - 1];
            g.fillStyle(color, 1).fillCircle(end.x, end.y, 8);
        }
    }

    private cellAt (pointer: Input.Pointer): GridPoint
    {
        const world = pointer.positionToCamera(this.cameras.main) as { x: number, y: number };
        return { x: Math.floor(world.x / TILE_SIZE), y: Math.floor(world.y / TILE_SIZE) };
    }

    private setupInput ()
    {
        this.input.mouse?.disableContextMenu();

        this.input.on(Input.Events.POINTER_DOWN, (pointer: Input.Pointer) =>
        {
            if (this.inputLocked)
            {
                return;
            }
            const cell = this.cellAt(pointer);
            //  Right-click erases. Starting on something standing on a tile, the stroke removes
            //  only such things and leaves the tiles; starting anywhere else, it clears whole cells.
            const level = this.state.level;
            const eraseTool = level.inBounds(cell.x, cell.y) && level.hasEntityAt(cell.x, cell.y) ? 'erase-entity' : 'erase';
            const tool: EditorTool | null = pointer.rightButtonDown() ? eraseTool
                : pointer.leftButtonDown() ? this.state.tool : null;
            if (!tool)
            {
                return;
            }
            this.stroke = DRAG_TOOLS.has(tool) ? { tool, last: cell } : null;
            this.pending = this.state.level.snapshot();
            this.applyAt(tool, cell.x, cell.y);
        });

        this.input.on(Input.Events.POINTER_MOVE, (pointer: Input.Pointer) =>
        {
            const cell = this.cellAt(pointer);
            this.updateHover(cell);

            if (this.stroke && pointer.isDown)
            {
                //  Fill in every cell between pointer samples, so fast drags leave no gaps
                for (const p of lineCells(this.stroke.last, cell))
                {
                    this.applyAt(this.stroke.tool, p.x, p.y);
                }
                this.stroke.last = cell;
            }
        });

        const endStroke = () => { this.stroke = null; };
        this.input.on(Input.Events.POINTER_UP, endStroke);
        this.input.on(Input.Events.POINTER_UP_OUTSIDE, endStroke);
        this.input.on(Input.Events.GAME_OUT, () =>
        {
            this.hover.setVisible(false);
            this.hoverCell = null;
            this.showRoute();
        });

        this.input.on(Input.Events.POINTER_WHEEL,
            (pointer: Input.Pointer, _over: unknown, dx: number, dy: number) =>
            {
                if (this.inputLocked)
                {
                    return;
                }
                const event = pointer.event as WheelEvent;
                if (event.ctrlKey || event.metaKey)
                {
                    this.zoomAt(pointer, dy);
                }
                else
                {
                    const camera = this.cameras.main;
                    camera.scrollX += dx / camera.zoom;
                    camera.scrollY += dy / camera.zoom;
                }
                this.updateHover(this.cellAt(pointer));
            });

        const keyboard = this.input.keyboard;
        if (keyboard)
        {
            //  Adds a key handler that's ignored while a popup is open
            const onKey = (key: string, handler: (event: KeyboardEvent) => void) =>
            {
                keyboard.on(`keydown-${key}`, (event: KeyboardEvent) =>
                {
                    if (!this.inputLocked)
                    {
                        handler(event);
                    }
                });
            };
            const numberKeys = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT'];
            PALETTE.forEach((tool, i) =>
            {
                onKey(numberKeys[i], () => this.selectTool(tool));
            });

            //  Ctrl/Cmd+Z undoes; Ctrl/Cmd+Shift+Z and Ctrl/Cmd+Y redo
            onKey('Z', (event: KeyboardEvent) =>
            {
                if (event.ctrlKey || event.metaKey)
                {
                    event.preventDefault();
                    if (event.shiftKey)
                    {
                        this.redo();
                    }
                    else
                    {
                        this.undo();
                    }
                }
            });
            onKey('A', () => this.toggleAnalysis());
            onKey('Y', (event: KeyboardEvent) =>
            {
                if (event.ctrlKey || event.metaKey)
                {
                    event.preventDefault();
                    this.redo();
                }
            });
        }
    }

    //  Zooms in or out, keeping the world point under the cursor in place.
    //  Trackpad pinches arrive as wheel events with ctrlKey set.
    private zoomAt (pointer: Input.Pointer, dy: number)
    {
        const camera = this.cameras.main;
        const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, camera.zoom * Math.exp(-dy * 0.01)));

        //  A camera maps world to screen around its centre:
        //  screen = (world - scroll - half) * zoom + half
        const halfW = camera.width / 2;
        const halfH = camera.height / 2;
        const worldX = (pointer.x - halfW) / camera.zoom + camera.scrollX + halfW;
        const worldY = (pointer.y - halfH) / camera.zoom + camera.scrollY + halfH;

        camera.setZoom(zoom);
        camera.scrollX = worldX - halfW - (pointer.x - halfW) / zoom;
        camera.scrollY = worldY - halfH - (pointer.y - halfH) / zoom;
    }

    private updateHover (cell: GridPoint)
    {
        const inside = this.state.level.inBounds(cell.x, cell.y);
        this.hover.setVisible(inside).setPosition(cell.x * TILE_SIZE, cell.y * TILE_SIZE);
        if (this.hoverCell?.x !== cell.x || this.hoverCell?.y !== cell.y)
        {
            this.hoverCell = cell;
            this.showRoute();
        }
    }
}

//  Whether analysis mode is on, remembered in localStorage across visits and reloads. On unless
//  the user has turned it off. Storage can be unavailable (private windows, blocked site data).
const ANALYZE_KEY = 'bouldersAndIce.editorAnalyze';

function loadAnalyzeSetting (): boolean
{
    try
    {
        return localStorage.getItem(ANALYZE_KEY) !== 'false';
    }
    catch
    {
        return true;
    }
}

function saveAnalyzeSetting (on: boolean): void
{
    try
    {
        localStorage.setItem(ANALYZE_KEY, String(on));
    }
    catch
    {
        //  Can't save; the setting lasts until the editor is left
    }
}

//  The cells on a straight line from a to b, excluding a (Bresenham)
function lineCells (a: GridPoint, b: GridPoint): GridPoint[]
{
    const cells: GridPoint[] = [];
    const dx = Math.abs(b.x - a.x), sx = a.x < b.x ? 1 : -1;
    const dy = -Math.abs(b.y - a.y), sy = a.y < b.y ? 1 : -1;
    let err = dx + dy;
    let { x, y } = a;

    while (x !== b.x || y !== b.y)
    {
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x += sx; }
        if (e2 <= dx) { err += dx; y += sy; }
        cells.push({ x, y });
    }
    return cells;
}

//  Downloads text as a file, for browsers without a save dialog (it goes to the downloads folder)
function downloadText (text: string, fileName: string): void
{
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
}
