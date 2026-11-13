import { Scene } from 'phaser';
import { addButton, TEXT_STYLE } from '../ui/Button';
import { firstUncompletedLevel } from '../progress';
import { loadLevelInProgress } from '../levelInProgress';
import { LEVELS } from '../levels/levelList';
import type { GameData } from './Game';

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

        //  Play picks the level in progress back up where it was left, or else starts the
        //  earliest level not yet completed. Pass the data in full: Phaser reuses a scene's
        //  previous start data otherwise
        addButton(this, 512, 220, 'Play', () => this.scene.start('Game', playData()));
        addButton(this, 512, 304, 'Levels', () => this.scene.start('LevelSelect'));
        addButton(this, 512, 388, 'Editor', () => this.scene.start('Editor'));
    }
}

//  What Play starts: the saved level in progress if it's still in the game, else the first
//  uncompleted level
function playData (): GameData
{
    const saved = loadLevelInProgress();
    const levelIndex = saved ? LEVELS.findIndex(level => level.key === saved.levelKey) : -1;
    return levelIndex >= 0
        ? { levelIndex, resume: true }
        : { levelIndex: firstUncompletedLevel(), resume: false };
}
