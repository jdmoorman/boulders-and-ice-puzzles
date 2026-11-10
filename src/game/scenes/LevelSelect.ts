import { Scene } from 'phaser';
import { LEVELS } from '../levels/levelList';
import { addButton, TEXT_STYLE } from '../ui/Button';

const PER_ROW = 5;
const CELL = 96;
const GAP = 24;

//  Grid of numbered buttons, one per level in LEVELS. All levels are unlocked.
export class LevelSelect extends Scene
{
    constructor ()
    {
        super('LevelSelect');
    }

    create ()
    {
        const { width, height } = this.scale;
        const cx = width / 2;

        this.add.image(cx, height / 2, 'background');

        this.add.text(cx, 140, 'Select Level', { ...TEXT_STYLE, fontSize: 48, strokeThickness: 8 })
            .setOrigin(0.5);

        const rows = Math.ceil(LEVELS.length / PER_ROW);
        const step = CELL + GAP;
        const gridTop = 260;

        LEVELS.forEach((_level, i) =>
        {
            const row = Math.floor(i / PER_ROW);
            const col = i % PER_ROW;
            //  Center each row on its own number of buttons, so a short last row is centered too
            const inRow = row < rows - 1 ? PER_ROW : LEVELS.length - row * PER_ROW;
            const x = cx + (col - (inRow - 1) / 2) * step;
            const y = gridTop + row * step;

            addButton(this, x, y, String(i + 1), () => this.scene.start('Game', { levelIndex: i }),
                { width: CELL, height: CELL });
        });

        addButton(this, cx, height - 100, 'Back', () => this.back());

        this.input.keyboard?.once('keydown-ESC', () => this.back());
    }

    private back ()
    {
        this.scene.start('MainMenu');
    }
}
