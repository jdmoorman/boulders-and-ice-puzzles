import { Scene, Scenes, GameObjects, Input, Tilemaps } from 'phaser';
import { cellKey, EditorLevel, EditorTool } from '../editor/EditorLevel';
import { parseLevel, GridPoint } from '../levels/LevelParser';
import { TILE_SIZE, TileIndex } from '../levels/Tiles';
import { LEVELS } from '../levels/levelList';
import { AUTOTILE_SETS, AutotileSet, displayTileIndex, isTallSet } from '../levels/autotile';
import { addBoulder, addPlayer, addTallTile, tileCenter } from '../levels/LevelLoader';
import { playerAnimKey } from '../playerAnimations';
import type { GameData } from './Game';

//  Everything the editor keeps between visits (e.g. while playtesting), stored in the registry
interface EditorState
{
    level: EditorLevel;
    tool: EditorTool;
    scrollX: number;
    scrollY: number;
    zoom: number;
}

const STATE_KEY = 'editorState';
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2;
//  Above every y-sorted object on the canvas
const OVERLAY_DEPTH = 1e7;

//  Palette tools, in order (keys 1-6)
export const PALETTE: readonly { tool: EditorTool, label: string }[] = [
    { tool: 'wall', label: 'Wall' },
    { tool: 'snow', label: 'Snow' },
    { tool: 'ice', label: 'Ice' },
    { tool: 'exit', label: 'Exit' },
    { tool: 'player', label: 'Player' },
    { tool: 'boulder', label: 'Boulder' }
];

//  Tools that paint every cell along a drag. The others (exit, player, boulder) are placed
//  once, on the cell where the mouse was pressed.
const DRAG_TOOLS: ReadonlySet<EditorTool> = new Set<EditorTool>(['wall', 'snow', 'ice', 'erase']);

//  Events emitted on this scene's event emitter for the HUD
export const EDITOR_EVENTS = {
    TOOL: 'editor-tool',
    MESSAGE: 'editor-message'
} as const;

//  Level editor: the canvas, mouse painting, panning and zooming. The palette and buttons are
//  in the EditorHud scene, launched on top so they aren't affected by the camera.
export class Editor extends Scene
{
    private state: EditorState;
    private layer: Tilemaps.TilemapLayer;
    private isTall: (set: AutotileSet) => boolean;
    private tallImages = new Map<string, GameObjects.Image>();
    private boulderImages = new Map<string, GameObjects.Image>();
    private playerSprite: GameObjects.Sprite | null = null;
    private goalImage: GameObjects.Image | null = null;
    private hover: GameObjects.Rectangle;
    //  The tool being dragged with, and the last cell it was applied to
    private stroke: { tool: EditorTool, last: GridPoint } | null = null;
    //  Set when the registry already holds the state to start from next time
    private skipSave = false;

    constructor ()
    {
        super('Editor');
    }

    get tool (): EditorTool
    {
        return this.state.tool;
    }

    create ()
    {
        this.tallImages.clear();
        this.boulderImages.clear();
        this.playerSprite = null;
        this.goalImage = null;
        this.stroke = null;
        this.skipSave = false;

        const camera = this.cameras.main;
        camera.setBackgroundColor(0x141a22);

        const saved = this.registry.get(STATE_KEY) as EditorState | undefined;
        this.state = saved ?? this.initialState(new EditorLevel(), 'wall');
        camera.setScroll(this.state.scrollX, this.state.scrollY).setZoom(this.state.zoom);

        this.isTall = set => isTallSet(this, set);
        this.createCanvas();
        this.setupInput();

        //  Keep the editor's state for next time, and take the HUD down with the editor
        this.events.once(Scenes.Events.SHUTDOWN, () =>
        {
            this.scene.stop('EditorHud');
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

    //  Starts a playtest of the current map, or reports why it can't be played
    play ()
    {
        const problems = this.state.level.problems();
        const text = this.state.level.toText();
        if (problems.length > 0 || !text)
        {
            this.message(problems[0] ?? 'Place a player and an exit to play.');
            return;
        }
        const data: GameData = { levelText: text };
        this.scene.start('Game', data);
    }

    //  Replaces the map with a level from LEVELS, centred in view
    openLevel (index: number)
    {
        const level = EditorLevel.fromLevelData(parseLevel(this.cache.text.get(LEVELS[index].key)));
        this.registry.set(STATE_KEY, this.initialState(level, this.state.tool));
        //  Skip the shutdown save, which would overwrite the new state
        this.skipSave = true;
        this.scene.restart();
    }

    //  Downloads the map as level.txt and copies it to the clipboard
    exportLevel ()
    {
        const text = this.state.level.toText();
        if (!text)
        {
            this.message('Nothing to export yet.');
            return;
        }

        const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = 'level.txt';
        link.click();
        URL.revokeObjectURL(url);

        navigator.clipboard?.writeText(text).then(
            () => this.message('Downloaded level.txt and copied it to the clipboard.'),
            () => this.message('Downloaded level.txt (couldn\'t copy to the clipboard).')
        ) ?? this.message('Downloaded level.txt.');
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
            zoom: 1
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
        const key = cellKey(x, y);
        const image = this.boulderImages.get(key);
        const has = this.state.level.hasBoulderAt(x, y);
        if (has && !image)
        {
            this.boulderImages.set(key, addBoulder(this, { x, y }));
        }
        else if (!has && image)
        {
            image.destroy();
            this.boulderImages.delete(key);
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
            const { x, y } = tileCenter(goal);
            this.goalImage = this.add.image(x, y, 'goal');
        }
    }

    //  Applies the stroke's tool to a cell and redraws what changed
    private applyAt (tool: EditorTool, x: number, y: number)
    {
        const changed = this.state.level.applyTool(tool, x, y);
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
        }
        if (changed.length > 0)
        {
            this.drawPlayerAndGoal();
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
            const tool: EditorTool | null = pointer.rightButtonDown() ? 'erase'
                : pointer.leftButtonDown() ? this.state.tool : null;
            if (!tool)
            {
                return;
            }
            const cell = this.cellAt(pointer);
            this.stroke = DRAG_TOOLS.has(tool) ? { tool, last: cell } : null;
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
        this.input.on(Input.Events.GAME_OUT, () => this.hover.setVisible(false));

        this.input.on(Input.Events.POINTER_WHEEL,
            (pointer: Input.Pointer, _over: unknown, dx: number, dy: number) =>
            {
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
            const numberKeys = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX'];
            PALETTE.forEach(({ tool }, i) =>
            {
                keyboard.on(`keydown-${numberKeys[i]}`, () => this.selectTool(tool));
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
