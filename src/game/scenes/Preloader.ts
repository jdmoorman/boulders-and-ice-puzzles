import { Scene, Textures } from 'phaser';
import { createPlayerAnimations, PLAYER_FRAME_WIDTH, PLAYER_FRAME_HEIGHT } from '../playerAnimations';
import { generateTextures } from '../textures';
import { LEVELS } from '../levels/levelList';

export class Preloader extends Scene
{
    constructor ()
    {
        super('Preloader');
    }

    init ()
    {
        //  A simple progress bar. This is the outline of the bar.
        this.add.rectangle(512, 384, 468, 32).setStrokeStyle(1, 0xffffff);

        //  This is the progress bar itself. It will increase in size from the left based on the % of progress.
        const bar = this.add.rectangle(512-230, 384, 4, 28, 0xffffff);

        //  Use the 'progress' event emitted by the LoaderPlugin to update the loading bar
        this.load.on('progress', (progress: number) => {

            //  Update the progress bar (our bar is 464px wide, so 100% = 464px)
            bar.width = 4 + (460 * progress);

        });
    }

    preload ()
    {
        //  Load the assets for the game - Replace with your own assets
        this.load.setPath('assets');

        this.load.spritesheet('player', 'player/openmon/set1-sheet3.png', {
            frameWidth: PLAYER_FRAME_WIDTH,
            frameHeight: PLAYER_FRAME_HEIGHT
        });
        this.load.image('boulder', 'rock.png');
        this.load.image('wallAutotile', 'buch_wall_autotile.png');
        this.load.image('snowAutotile', 'buch_snow_autotile.png');
        this.load.image('ice', 'buch_ice.png');

        for (const level of LEVELS)
        {
            this.load.text(level.key, level.file);
        }
    }

    create ()
    {
        //  When all the assets have loaded, it's often worth creating global objects here that the rest of the game can use.
        //  For example, you can define global animations here, so we can use them in other scenes.
        //  Keep the scaled-up pixel art sharp (only these textures; others still smooth)
        for (const key of ['player', 'boulder'])
        {
            this.textures.get(key).setFilter(Textures.FilterMode.NEAREST);
        }
        createPlayerAnimations(this);

        generateTextures(this);

        //  Move to the MainMenu. You could also swap this for a Scene Transition, such as a camera fade.
        this.scene.start('MainMenu');
    }
}
