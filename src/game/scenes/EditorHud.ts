import { Scene, Scenes, GameObjects, Time } from 'phaser';
import { addButton, addIconButton, ButtonIcon, TEXT_STYLE } from '../ui/Button';
import { TileIndex } from '../levels/Tiles';
import { AUTOTILE_SETS, ISOLATED_FRAME, SURROUNDED_FRAME, autotileBase } from '../levels/autotile';
import { EditorTool } from '../editor/EditorLevel';
import { Editor, EDITOR_EVENTS, PALETTE } from './Editor';

const BAR_COLOR = 0x24303f;
const SELECTED_STROKE = 0xf2c230;
const MESSAGE_MS = 3000;
const PALETTE_BUTTON_SIZE = 64;
const PALETTE_STEP = 84;

const setOf = (tile: TileIndex) => AUTOTILE_SETS.findIndex(set => set.tiles.includes(tile));
const WALL_ICON: ButtonIcon = { key: AUTOTILE_SETS[setOf(TileIndex.Wall)].texture, frame: ISOLATED_FRAME };
//  Snow as if surrounded by snow, so it shows no edges
const SNOW_ICON: ButtonIcon = { key: 'tiles', frame: autotileBase(setOf(TileIndex.Floor)) + SURROUNDED_FRAME };

//  The picture on each palette button, drawn bottom layer first
const PALETTE_ICONS: Readonly<Record<EditorTool, readonly ButtonIcon[]>> = {
    wall: [WALL_ICON],
    snow: [SNOW_ICON],
    ice: [{ key: 'tiles', frame: TileIndex.Ice }],
    exit: [SNOW_ICON, { key: 'goal' }],
    player: [{ key: 'player', frame: 'palette' }],
    boulder: [{ key: 'boulder' }],
    erase: []
};

//  The level editor's palette, buttons and messages. Runs on top of the Editor scene with its
//  own camera, so it isn't panned or zoomed. Its bars and buttons are interactive, so clicks on
//  them don't reach the canvas below.
export class EditorHud extends Scene
{
    private editor: Editor;
    private paletteButtons = new Map<EditorTool, GameObjects.Rectangle>();
    private messageText: GameObjects.Text;
    private messageTimer: Time.TimerEvent | null = null;

    constructor ()
    {
        super('EditorHud');
    }

    create ()
    {
        this.editor = this.scene.get('Editor') as Editor;
        this.paletteButtons.clear();
        this.messageTimer = null;

        const { width, height } = this.scale;

        //  Top bar: Menu, Undo and Redo on the left; Import, Export and Play on the right
        this.add.rectangle(0, 0, width, 72, BAR_COLOR, 0.92).setOrigin(0).setInteractive();
        const top = 36;
        const size = { height: 52 };
        addButton(this, 80, top, 'Menu', () => this.editor.toMainMenu(), { ...size, width: 130 });
        addIconButton(this, 200, top, [{ key: 'icon-undo' }], () => this.editor.undo(), { ...size, width: 72 });
        addIconButton(this, 286, top, [{ key: 'icon-redo' }], () => this.editor.redo(), { ...size, width: 72 });
        addButton(this, 674, top, 'Import', () => this.editor.importLevel(), { ...size, width: 140 });
        addButton(this, 822, top, 'Export', () => this.editor.exportLevel(), { ...size, width: 140 });
        addButton(this, 958, top, 'Play', () => this.editor.play(), { ...size, width: 116 });

        //  Bottom bar: the palette (keys 1-6)
        this.add.rectangle(0, height - 80, width, 80, BAR_COLOR, 0.92).setOrigin(0).setInteractive();
        const paletteSize = { width: PALETTE_BUTTON_SIZE, height: PALETTE_BUTTON_SIZE };
        PALETTE.forEach((tool, i) =>
        {
            const x = width / 2 + (i - (PALETTE.length - 1) / 2) * PALETTE_STEP;
            const y = height - 40;
            const button = addIconButton(this, x, y, PALETTE_ICONS[tool], () => this.editor.selectTool(tool), paletteSize);
            this.paletteButtons.set(tool, button);

            //  The tool's shortcut key, in the button's top-left corner
            const half = PALETTE_BUTTON_SIZE / 2;
            this.add.text(x - half + 4, y - half + 2, `${i + 1}`, { ...TEXT_STYLE, fontSize: 16, strokeThickness: 4 });
        });
        this.highlightTool(this.editor.tool);

        this.messageText = this.add.text(width / 2, 104, '', { ...TEXT_STYLE, fontSize: 24, strokeThickness: 5 })
            .setOrigin(0.5);

        const onTool = (tool: EditorTool) => this.highlightTool(tool);
        const onMessage = (text: string) => this.showMessage(text);
        this.editor.events.on(EDITOR_EVENTS.TOOL, onTool);
        this.editor.events.on(EDITOR_EVENTS.MESSAGE, onMessage);
        this.events.once(Scenes.Events.SHUTDOWN, () =>
        {
            this.editor.events.off(EDITOR_EVENTS.TOOL, onTool);
            this.editor.events.off(EDITOR_EVENTS.MESSAGE, onMessage);
        });
    }

    private highlightTool (selected: EditorTool)
    {
        for (const [tool, button] of this.paletteButtons)
        {
            if (tool === selected)
            {
                button.setStrokeStyle(5, SELECTED_STROKE);
            }
            else
            {
                button.setStrokeStyle(3, 0x000000);
            }
        }
    }

    private showMessage (text: string)
    {
        this.messageText.setText(text).setVisible(true);
        this.messageTimer?.remove();
        this.messageTimer = this.time.delayedCall(MESSAGE_MS, () => this.messageText.setVisible(false));
    }
}
