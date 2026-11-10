import { Scene, Input } from 'phaser';
import { parseLevel, GridPoint } from '../levels/LevelParser';
import { buildLevel, BuiltLevel, tileCenter } from '../levels/LevelLoader';
import { computeMove, Direction } from '../movement/Movement';
import { MOVEMENT } from '../settings';

const DIRECTIONS: readonly Direction[] = ['up', 'down', 'left', 'right'];

export class Game extends Scene
{
    level: BuiltLevel;
    playerPos: GridPoint;
    isMoving = false;

    private directionKeys: Record<Direction, Input.Keyboard.Key[]> | null = null;
    //  Direction whose blocked move was already reported, so a held key reports it once
    private reportedBlockedDir: Direction | null = null;

    constructor ()
    {
        super('Game');
    }

    create ()
    {
        this.cameras.main.setBackgroundColor(0x141a22);

        const data = parseLevel(this.cache.text.get('level-demo'));
        this.level = buildLevel(this, data);
        this.playerPos = { ...data.player };
        this.isMoving = false;
        this.reportedBlockedDir = null;

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
        if (dir !== this.reportedBlockedDir)
        {
            this.reportedBlockedDir = null;
        }
        if (!dir)
        {
            return;
        }

        const path = computeMove(this.level.data, this.playerPos, dir);
        if (path.length > 0)
        {
            this.startMove(path);
        }
        else if (this.reportedBlockedDir !== dir)
        {
            this.reportedBlockedDir = dir;
            this.onBlockedMove(dir);
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

    //  Tweens the player along a straight path: the first tile is a walk, the rest are a slide.
    private startMove (path: GridPoint[])
    {
        const end = path[path.length - 1];
        const target = tileCenter(end);
        const duration = MOVEMENT.walkMsPerTile + (path.length - 1) * MOVEMENT.slideMsPerTile;

        this.isMoving = true;
        this.tweens.add({
            targets: this.level.player,
            x: target.x,
            y: target.y,
            duration,
            ease: 'Linear',
            onComplete: () =>
            {
                this.playerPos = { ...end };
                this.isMoving = false;
            }
        });
    }

    //  Called once when the player tries to move into a wall or boulder.
    //  Placeholder for a future bump sound and/or animation.
    private onBlockedMove (_dir: Direction)
    {
    }
}
