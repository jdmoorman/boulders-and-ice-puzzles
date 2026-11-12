import { Scene, GameObjects } from 'phaser';
import { addButton } from '../ui/Button';
import { firstUncompletedLevel } from '../progress';

export class MainMenu extends Scene
{
    background: GameObjects.Image;
    logo: GameObjects.Image;

    constructor ()
    {
        super('MainMenu');
    }

    create ()
    {
        this.background = this.add.image(512, 384, 'background');

        this.logo = this.add.image(512, 300, 'logo');

        //  Play picks up at the earliest level not yet completed. Pass levelIndex explicitly:
        //  Phaser reuses a scene's previous start data otherwise
        addButton(this, 512, 470, 'Play', () => this.scene.start('Game', { levelIndex: firstUncompletedLevel() }));
        addButton(this, 512, 554, 'Levels', () => this.scene.start('LevelSelect'));
        addButton(this, 512, 638, 'Editor', () => this.scene.start('Editor'));
    }
}
