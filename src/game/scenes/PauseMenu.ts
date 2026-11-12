import { Scene } from 'phaser';
import { addButton, TEXT_STYLE } from '../ui/Button';
import { GameData, leaveGame } from './Game';

export interface PauseMenuData
{
    levelIndex: number;
    //  Set when playtesting from the editor (see GameData)
    levelText?: string;
}

//  Overlay shown on top of the paused Game scene.
export class PauseMenu extends Scene
{
    private levelIndex = 0;
    private levelText: string | undefined;

    constructor ()
    {
        super('PauseMenu');
    }

    init (data: PauseMenuData)
    {
        this.levelIndex = data.levelIndex;
        this.levelText = data.levelText;
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
            this.levelText ? ['Editor', () => this.toEditor()] : ['Main Menu', () => this.toMainMenu()]
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
        const data: GameData = this.levelText ? { levelText: this.levelText } : { levelIndex: this.levelIndex };
        this.scene.start('Game', data);
    }

    //  Placeholder: there is no settings screen yet.
    private openSettings ()
    {
    }

    private toEditor ()
    {
        leaveGame(this, 'Editor');
    }

    private toMainMenu ()
    {
        leaveGame(this, 'MainMenu');
    }
}
