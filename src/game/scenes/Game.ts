import { Scene } from 'phaser';
import { parseLevel } from '../levels/LevelParser';
import { buildLevel, BuiltLevel } from '../levels/LevelLoader';

export class Game extends Scene
{
    level: BuiltLevel;

    constructor ()
    {
        super('Game');
    }

    create ()
    {
        this.cameras.main.setBackgroundColor(0x141a22);

        const data = parseLevel(this.cache.text.get('level-demo'));
        this.level = buildLevel(this, data);

        const keyboard = this.input.keyboard;
        if (keyboard)
        {
            keyboard.on('keydown-R', () => this.scene.restart());
            keyboard.on('keydown-ESC', () => this.scene.start('GameOver'));
        }
    }
}
