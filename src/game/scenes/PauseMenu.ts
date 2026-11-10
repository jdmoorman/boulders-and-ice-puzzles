import { Scene } from 'phaser';
import { addButton, TEXT_STYLE } from '../ui/Button';

export interface PauseMenuData
{
    levelIndex: number;
}

//  Overlay shown on top of the paused Game scene.
export class PauseMenu extends Scene
{
    private levelIndex = 0;

    constructor ()
    {
        super('PauseMenu');
    }

    init (data: PauseMenuData)
    {
        this.levelIndex = data.levelIndex;
    }

    create ()
    {
        const { width, height } = this.scale;
        const cx = width / 2;
        const cy = height / 2;

        //  Dim the frozen level behind the menu
        this.add.rectangle(cx, cy, width, height, 0x000000, 0.5);

        this.add.rectangle(cx, cy, 400, 460, 0x24303f)
            .setStrokeStyle(4, 0x9fd0f0);

        this.add.text(cx, cy - 170, 'Paused', { ...TEXT_STYLE, fontSize: 44 })
            .setOrigin(0.5);

        const buttons: [string, () => void][] = [
            ['Resume', () => this.resumeGame()],
            ['Restart', () => this.restart()],
            ['Settings', () => this.openSettings()],
            ['Main Menu', () => this.toMainMenu()]
        ];
        buttons.forEach(([label, onClick], i) =>
        {
            addButton(this, cx, cy - 80 + i * 80, label, onClick, { width: 260 });
        });

        const keyboard = this.input.keyboard;
        if (keyboard)
        {
            keyboard.once('keydown-ESC', () => this.resumeGame());
            keyboard.once('keydown-P', () => this.resumeGame());
        }
    }

    private resumeGame ()
    {
        this.scene.resume('Game');
        this.scene.stop();
    }

    //  scene.start from this scene stops the overlay and restarts Game fresh
    private restart ()
    {
        this.scene.start('Game', { levelIndex: this.levelIndex });
    }

    //  Placeholder: there is no settings screen yet.
    private openSettings ()
    {
    }

    private toMainMenu ()
    {
        this.scene.stop('Game');
        this.scene.start('MainMenu');
    }
}
