import { Scene } from 'phaser';
import { addButton, TEXT_STYLE } from '../ui/Button';
import { GameData, leaveGame } from './Game';

export interface LevelCompleteData
{
    levelIndex: number;
    isLast: boolean;
    //  Set when playtesting from the editor (see GameData)
    levelText?: string;
}

//  Overlay shown on top of the Game scene when a level is finished.
//  It has its own camera, so it isn't affected by the game camera's zoom or position.
export class LevelComplete extends Scene
{
    private levelIndex = 0;
    private isLast = false;
    private levelText: string | undefined;

    constructor ()
    {
        super('LevelComplete');
    }

    init (data: LevelCompleteData)
    {
        this.levelIndex = data.levelIndex;
        this.isLast = data.isLast;
        this.levelText = data.levelText;
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

        if (this.levelText)
        {
            addButton(this, cx + 120, cy + 60, 'Editor', () => this.toEditor());
        }
        else if (this.isLast)
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
            keyboard.once('keydown-ENTER', () =>
                this.levelText ? this.toEditor() : this.isLast ? this.toMenu() : this.next());
        }
    }

    //  scene.start from this scene stops the overlay and (re)starts Game with the given level
    private replay ()
    {
        const data: GameData = this.levelText ? { levelText: this.levelText } : { levelIndex: this.levelIndex };
        this.scene.start('Game', data);
    }

    private next ()
    {
        this.scene.start('Game', { levelIndex: this.levelIndex + 1 });
    }

    private toEditor ()
    {
        leaveGame(this, 'Editor');
    }

    private toMenu ()
    {
        leaveGame(this, 'MainMenu');
    }
}
