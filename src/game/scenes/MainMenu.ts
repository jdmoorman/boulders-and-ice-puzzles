import { Scene } from 'phaser';
import { addButton, TEXT_STYLE } from '../ui/Button';
import { firstUncompletedLevel } from '../progress';

export class MainMenu extends Scene
{
    constructor ()
    {
        super('MainMenu');
    }

    create ()
    {
        //  Same title style and position as Level Select
        this.add.text(512, 90, 'Main Menu', { ...TEXT_STYLE, fontSize: 48, strokeThickness: 8 }).setOrigin(0.5);

        //  Play picks up at the earliest level not yet completed. Pass levelIndex explicitly:
        //  Phaser reuses a scene's previous start data otherwise
        addButton(this, 512, 220, 'Play', () => this.scene.start('Game', { levelIndex: firstUncompletedLevel() }));
        addButton(this, 512, 304, 'Levels', () => this.scene.start('LevelSelect'));
        addButton(this, 512, 388, 'Editor', () => this.scene.start('Editor'));
    }
}
