import { Scene } from 'phaser';
import { addButton, TEXT_STYLE } from '../ui/Button';

export interface LevelCompleteData
{
    levelIndex: number;
    isLast: boolean;
}

//  Overlay shown on top of the Game scene when a level is finished.
//  It has its own camera, so it isn't affected by the game camera's zoom or position.
export class LevelComplete extends Scene
{
    private levelIndex = 0;
    private isLast = false;

    constructor ()
    {
        super('LevelComplete');
    }

    init (data: LevelCompleteData)
    {
        this.levelIndex = data.levelIndex;
        this.isLast = data.isLast;
    }

    create ()
    {
        const { width, height } = this.scale;
        const cx = width / 2;
        const cy = height / 2;

        //  Dim the level behind the popup
        this.add.rectangle(cx, cy, width, height, 0x000000, 0.5);

        this.add.rectangle(cx, cy, 520, 280, 0x24303f)
            .setStrokeStyle(4, 0xf2c230);

        this.add.text(cx, cy - 70, 'Level Complete!', { ...TEXT_STYLE, fontSize: 44 })
            .setOrigin(0.5);

        addButton(this, cx - 120, cy + 60, 'Replay', () => this.replay());

        if (this.isLast)
        {
            addButton(this, cx + 120, cy + 60, 'Menu', () => this.toMenu());
        }
        else
        {
            addButton(this, cx + 120, cy + 60, 'Next', () => this.next());
        }

        const keyboard = this.input.keyboard;
        if (keyboard)
        {
            keyboard.once('keydown-R', () => this.replay());
            keyboard.once('keydown-ENTER', () => this.isLast ? this.toMenu() : this.next());
        }
    }

    //  scene.start from this scene stops the overlay and (re)starts Game with the given level
    private replay ()
    {
        this.scene.start('Game', { levelIndex: this.levelIndex });
    }

    private next ()
    {
        this.scene.start('Game', { levelIndex: this.levelIndex + 1 });
    }

    private toMenu ()
    {
        this.scene.stop('Game');
        this.scene.start('MainMenu');
    }
}
