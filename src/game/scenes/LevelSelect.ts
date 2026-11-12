import { Scene, Input } from 'phaser';
import { LEVEL_PACKS, LEVELS } from '../levels/levelList';
import { addButton, addIconButton, buttonLabel, ICON_INSET, TEXT_STYLE } from '../ui/Button';
import { levelThumbnail } from '../levels/thumbnail';
import { isUnlocked } from '../progress';

const PER_ROW = 5;
const CELL_W = 152;
const CELL_H = 120;
const GAP = 24;
const STEP_X = CELL_W + GAP;
const STEP_Y = CELL_H + GAP;
const BAR_HEIGHT = 120;
const BAR_DEPTH = 10;
const KEY_SCROLL = 80;

//  Every level pack, each with a heading and a grid of level buttons showing a thumbnail of the
//  level, on one screen.
//  Scrolls with the mouse wheel or arrow keys when it's taller than the screen; the Back
//  button stays fixed at the bottom. Levels after the first in a pack are locked until the one
//  before them is completed (see progress.ts).
export class LevelSelect extends Scene
{
    private maxScroll = 0;

    constructor ()
    {
        super('LevelSelect');
    }

    create ()
    {
        const { width, height } = this.scale;
        const cx = width / 2;
        const camera = this.cameras.main;
        camera.setScroll(0, 0);

        this.add.image(cx, height / 2, 'background').setScrollFactor(0);

        this.add.text(cx, 90, 'Select Level', { ...TEXT_STYLE, fontSize: 48, strokeThickness: 8 })
            .setOrigin(0.5);

        let y = 180;
        for (const pack of LEVEL_PACKS)
        {
            this.add.text(cx, y, pack.name, { ...TEXT_STYLE, fontSize: 36 }).setOrigin(0.5);
            const gridTop = y + 50 + CELL_H / 2;
            const rows = Math.ceil(pack.levels.length / PER_ROW);

            pack.levels.forEach((level, i) =>
            {
                const row = Math.floor(i / PER_ROW);
                const col = i % PER_ROW;
                //  Center each row on its own number of buttons, so a short last row is centered too
                const inRow = row < rows - 1 ? PER_ROW : pack.levels.length - row * PER_ROW;
                const x = cx + (col - (inRow - 1) / 2) * STEP_X;
                const by = gridTop + row * STEP_Y;
                const levelIndex = LEVELS.findIndex(l => l.key === level.key);

                const thumbnail = levelThumbnail(this, level, CELL_W - ICON_INSET * 2, CELL_H - ICON_INSET * 2);
                const button = addIconButton(this, x, by, [{ key: thumbnail, scale: 1 }],
                    () => this.scene.start('Game', { levelIndex }), { width: CELL_W, height: CELL_H });

                //  Locked until the previous level in the pack is completed: dimmed, with a padlock
                if (!isUnlocked(levelIndex))
                {
                    button.disableInteractive();
                    this.add.rectangle(x, by, CELL_W, CELL_H, 0x000000, 0.55);
                    this.add.image(x, by, 'icon-lock');
                }
            });

            y = gridTop + (rows - 1) * STEP_Y + CELL_H / 2 + 60;
        }

        //  Fixed bottom bar with Back; it blocks clicks to level buttons scrolled beneath it
        this.add.rectangle(0, height - BAR_HEIGHT, width, BAR_HEIGHT, 0x000000, 0.45)
            .setOrigin(0)
            .setScrollFactor(0)
            .setDepth(BAR_DEPTH)
            .setInteractive();
        const back = addButton(this, cx, height - BAR_HEIGHT / 2, 'Back', () => this.back());
        for (const object of [back, buttonLabel(back)])
        {
            object.setScrollFactor(0).setDepth(BAR_DEPTH + 1);
        }

        this.maxScroll = Math.max(0, y - (height - BAR_HEIGHT));

        this.input.on(Input.Events.POINTER_WHEEL,
            (_pointer: Input.Pointer, _over: unknown, _dx: number, dy: number) => this.scrollBy(dy));

        const keyboard = this.input.keyboard;
        if (keyboard)
        {
            keyboard.once('keydown-ESC', () => this.back());
            keyboard.on('keydown-UP', () => this.scrollBy(-KEY_SCROLL));
            keyboard.on('keydown-DOWN', () => this.scrollBy(KEY_SCROLL));
        }
    }

    private scrollBy (dy: number)
    {
        const camera = this.cameras.main;
        camera.scrollY = Math.min(this.maxScroll, Math.max(0, camera.scrollY + dy));
    }

    private back ()
    {
        this.scene.start('MainMenu');
    }
}
