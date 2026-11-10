import { Scene, Input, GameObjects } from 'phaser';
import { parseLevel, GridPoint } from '../levels/LevelParser';
import { buildLevel, BuiltLevel, tileCenter } from '../levels/LevelLoader';
import { LEVELS } from '../levels/levelList';
import { resolveMove, Direction } from '../movement/Movement';
import { MOVEMENT } from '../settings';
import { LevelCompleteData } from './LevelComplete';

const DIRECTIONS: readonly Direction[] = ['up', 'down', 'left', 'right'];

export interface GameData
{
    levelIndex?: number;
}

export class Game extends Scene
{
    levelIndex = 0;
    level: BuiltLevel;
    playerPos: GridPoint;
    //  True while the player or a pushed boulder is moving; input is ignored until it settles
    isMoving = false;
    //  True once the player has reached the exit; gameplay input stops
    levelComplete = false;

    private directionKeys: Record<Direction, Input.Keyboard.Key[]> | null = null;
    //  Direction whose blocked move was already reported, so a held key reports it once
    private reportedDir: Direction | null = null;

    constructor ()
    {
        super('Game');
    }

    init (data: GameData)
    {
        this.levelIndex = data.levelIndex ?? 0;
    }

    create ()
    {
        this.cameras.main.setBackgroundColor(0x141a22);

        //  level.data.boulders holds live boulder positions, in the same order as level.boulders sprites
        const data = parseLevel(this.cache.text.get(LEVELS[this.levelIndex].key));
        this.level = buildLevel(this, data);
        this.playerPos = { ...data.player };
        this.isMoving = false;
        this.levelComplete = false;
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

            //  Disabled once the level is complete; the popup has its own R shortcut
            keyboard.on('keydown-R', () =>
            {
                if (!this.levelComplete)
                {
                    this.scene.restart({ levelIndex: this.levelIndex });
                }
            });
            keyboard.on('keydown-ESC', () =>
            {
                if (!this.levelComplete)
                {
                    this.scene.start('GameOver');
                }
            });
        }
    }

    update ()
    {
        if (this.isMoving || this.levelComplete)
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
                //  Finish the move by stepping onto the exit tile itself
                this.levelComplete = true;
                this.movePlayer([...move.path, this.level.data.goal], () => this.completeLevel());
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

    private completeLevel ()
    {
        const data: LevelCompleteData = {
            levelIndex: this.levelIndex,
            isLast: this.levelIndex >= LEVELS.length - 1
        };
        this.scene.launch('LevelComplete', data);
    }

    //  Called once when the player tries to move into a wall or an immovable boulder.
    //  Placeholder for a future bump sound and/or animation.
    private onBlockedMove (_dir: Direction)
    {
    }
}
