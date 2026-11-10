import { Scene, GameObjects } from 'phaser';

export interface LevelCompleteData
{
    levelIndex: number;
    isLast: boolean;
}

const TEXT_STYLE = {
    fontFamily: 'Arial Black', color: '#ffffff',
    stroke: '#000000', strokeThickness: 6,
    align: 'center'
};

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

        this.makeButton(cx - 120, cy + 60, 'Replay', () => this.replay());

        if (this.isLast)
        {
            this.makeButton(cx + 120, cy + 60, 'Menu', () => this.toMenu());
        }
        else
        {
            this.makeButton(cx + 120, cy + 60, 'Next', () => this.next());
        }

        const keyboard = this.input.keyboard;
        if (keyboard)
        {
            keyboard.once('keydown-R', () => this.replay());
            keyboard.once('keydown-ENTER', () => this.isLast ? this.toMenu() : this.next());
        }
    }

    private makeButton (x: number, y: number, label: string, onClick: () => void): GameObjects.Rectangle
    {
        const normal = 0x3d6fa8;
        const hover = 0x5a8fcc;

        const button = this.add.rectangle(x, y, 200, 64, normal)
            .setStrokeStyle(3, 0x000000)
            .setInteractive({ useHandCursor: true });

        this.add.text(x, y, label, { ...TEXT_STYLE, fontSize: 28 }).setOrigin(0.5);

        button.on('pointerover', () => button.setFillStyle(hover));
        button.on('pointerout', () => button.setFillStyle(normal));
        button.on('pointerup', onClick);

        return button;
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
