import { Scene, Input, GameObjects } from 'phaser';
import { parseLevel, GridPoint } from '../levels/LevelParser';
import { buildLevel, BuiltLevel, tileCenter } from '../levels/LevelLoader';
import { resolveMove, Direction } from '../movement/Movement';
import { MOVEMENT } from '../settings';

const DIRECTIONS: readonly Direction[] = ['up', 'down', 'left', 'right'];

export class Game extends Scene
{
    level: BuiltLevel;
    playerPos: GridPoint;
    //  True while the player or a pushed boulder is moving; input is ignored until it settles
    isMoving = false;

    private directionKeys: Record<Direction, Input.Keyboard.Key[]> | null = null;
    //  Direction whose blocked/exit attempt was already reported, so a held key reports it once
    private reportedDir: Direction | null = null;

    constructor ()
    {
        super('Game');
    }

    create ()
    {
        this.cameras.main.setBackgroundColor(0x141a22);

        //  level.data.boulders holds live boulder positions, in the same order as level.boulders sprites
        const data = parseLevel(this.cache.text.get('level-demo'));
        this.level = buildLevel(this, data);
        this.playerPos = { ...data.player };
        this.isMoving = false;
        this.reportedDir = null;

        const keyboard = this.input.keyboard;
        if (keyboard)
        {
            const K = Input.Keyboard.KeyCodes;
            this.directionKeys = {
                up: [keyboard.addKey(K.UP), keyboard.addKey(K.W)],
                down: [keyboard.addKey(K.DOWN), keyboard.addKey(K.S)],
                left: [keyboard.addKey(K.LEFT), keyboard.addKey(K.A)],
                right: [keyboard.addKey(K.RIGHT), keyboard.addKey(K.D)]
            };

            keyboard.on('keydown-R', () => this.scene.restart());
            keyboard.on('keydown-ESC', () => this.scene.start('GameOver'));
        }
    }

    update ()
    {
        if (this.isMoving)
        {
            return;
        }

        const dir = this.heldDirection();
        if (dir !== this.reportedDir)
        {
            this.reportedDir = null;
        }
        if (!dir)
        {
            return;
        }

        const move = resolveMove(this.level.data, this.playerPos, dir);
        switch (move.kind)
        {
            case 'walk':
                this.movePlayer(move.path);
                break;

            case 'push':
            {
                const i = move.boulderIndex;
                const end = move.path[move.path.length - 1];
                this.tweenAlong(this.level.boulders[i], move.path, () =>
                {
                    this.level.data.boulders[i] = { ...end };
                });
                break;
            }

            case 'exit':
                if (move.path.length > 0)
                {
                    this.movePlayer(move.path, () =>
                    {
                        //  Count the slide as this key's report, so holding it doesn't fire again
                        this.reportedDir = dir;
                        this.onExitAttempt();
                    });
                }
                else if (this.reportedDir !== dir)
                {
                    this.reportedDir = dir;
                    this.onExitAttempt();
                }
                break;

            case 'blocked':
                if (this.reportedDir !== dir)
                {
                    this.reportedDir = dir;
                    this.onBlockedMove(dir);
                }
                break;
        }
    }

    private heldDirection (): Direction | null
    {
        if (!this.directionKeys)
        {
            return null;
        }
        return DIRECTIONS.find(dir => this.directionKeys![dir].some(key => key.isDown)) ?? null;
    }

    private movePlayer (path: GridPoint[], then?: () => void)
    {
        const end = path[path.length - 1];
        this.tweenAlong(this.level.player, path, () =>
        {
            this.playerPos = { ...end };
            then?.();
        });
    }

    //  Tweens a sprite along a straight path: the first tile is a step, the rest are a slide.
    //  Input is ignored until it finishes; `onDone` then updates the logical position.
    private tweenAlong (sprite: GameObjects.Image, path: GridPoint[], onDone: () => void)
    {
        const target = tileCenter(path[path.length - 1]);
        const duration = MOVEMENT.walkMsPerTile + (path.length - 1) * MOVEMENT.slideMsPerTile;

        this.isMoving = true;
        this.tweens.add({
            targets: sprite,
            x: target.x,
            y: target.y,
            duration,
            ease: 'Linear',
            onComplete: () =>
            {
                onDone();
                this.isMoving = false;
            }
        });
    }

    //  Called once when the player tries to move into a wall or an immovable boulder.
    //  Placeholder for a future bump sound and/or animation.
    private onBlockedMove (_dir: Direction)
    {
    }

    //  Called when the player steps or slides into the exit.
    //  Placeholder for exit handling (e.g. finishing the level).
    private onExitAttempt ()
    {
    }
}
