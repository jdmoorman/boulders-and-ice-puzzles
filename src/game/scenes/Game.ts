import { Scene, Scenes, Input, GameObjects, Animations } from 'phaser';
import { parseLevel, GridPoint } from '../levels/LevelParser';
import { buildLevel, BuiltLevel, tileCenter, ySortDepth } from '../levels/LevelLoader';
import type { Trap } from '../traps';
import { LEVELS, isLastInPack } from '../levels/levelList';
import { markCompleted } from '../progress';
import { clearLevelInProgress, fitsLevel, loadLevelInProgress, saveLevelInProgress } from '../levelInProgress';
import { doorsOpen, resolveMove, Direction } from '../movement/Movement';
import { MOVEMENT, PLATES } from '../settings';
import { playerAnimKey, PlayerAnimKind } from '../playerAnimations';
import { LevelCompleteData } from './LevelComplete';
import { updatePlates } from '../plates';
import { setDoorOpen } from '../doors';
import { PauseMenuData } from './PauseMenu';

const DIRECTIONS: readonly Direction[] = ['up', 'down', 'left', 'right'];

export interface GameData
{
    levelIndex?: number;
    //  Set when playtesting from the editor: the level to play, instead of LEVELS[levelIndex]
    levelText?: string;
    //  Pick the level up where it was left (see levelInProgress.ts), if it was saved
    resume?: boolean;
}

//  Whether Ctrl, Cmd, Alt or Shift was held for a key press. R with one of those is most likely
//  the browser's refresh shortcut rather than a restart.
export function withModifier (event: KeyboardEvent): boolean
{
    return event.ctrlKey || event.metaKey || event.altKey || event.shiftKey;
}

//  Stops Game and starts another scene, for overlays (pause menu, level complete) leaving play
export function leaveGame (scene: Scene, target: 'Editor' | 'MainMenu'): void
{
    scene.scene.stop('Game');
    scene.scene.start(target);
}

export class Game extends Scene
{
    levelIndex = 0;
    //  The editor's level being playtested, or null for a level from LEVELS
    levelText: string | null = null;
    level: BuiltLevel;
    playerPos: GridPoint;
    //  True while the player or a pushed boulder is moving; input is ignored until it settles
    isMoving = false;
    //  True once the player has reached the exit; gameplay input stops
    levelComplete = false;
    //  True while an armed trap springs; gameplay input stops until the restart, or until a
    //  boulder has fallen in
    springing = false;
    //  Direction the player sprite faces; levels start facing down
    facing: Direction = 'down';

    private directionKeys: Record<Direction, Input.Keyboard.Key[]> | null = null;
    //  Direction whose blocked move was already reported, so a held key reports it once
    private reportedDir: Direction | null = null;
    private resume = false;

    constructor ()
    {
        super('Game');
    }

    init (data: GameData)
    {
        this.levelIndex = data.levelIndex ?? 0;
        this.levelText = data.levelText ?? null;
        this.resume = data.resume ?? false;
    }

    //  Data that starts this same level again
    private restartData (): GameData
    {
        return this.levelText ? { levelText: this.levelText } : { levelIndex: this.levelIndex };
    }

    create ()
    {
        this.cameras.main.setBackgroundColor(0x141a22);

        //  level.data.boulders holds live boulder positions, in the same order as level.boulders sprites
        const data = parseLevel(this.levelText ?? this.cache.text.get(LEVELS[this.levelIndex].key));
        this.facing = 'down';
        const saved = this.resume ? loadLevelInProgress() : null;
        let armedTraps: number[] = [];
        if (saved && !this.levelText && saved.levelKey === LEVELS[this.levelIndex].key && fitsLevel(saved, data))
        {
            data.player = saved.player;
            data.boulders = saved.boulders;
            this.facing = saved.facing;
            armedTraps = saved.armedTraps ?? [];
        }
        this.level = buildLevel(this, data, armedTraps);
        this.playerPos = { ...data.player };
        this.isMoving = false;
        this.levelComplete = false;
        this.springing = false;
        this.reportedDir = null;
        this.playPlayerAnim('idle');
        this.saveProgress();

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

            //  R restarts the level, but only when pressed by itself: with Ctrl, Cmd, Alt or Shift
            //  held it's most likely the browser's refresh shortcut, and with a direction key held
            //  it's probably a slip. Disabled once the level is complete.
            keyboard.on('keydown-R', (event: KeyboardEvent) =>
            {
                const otherKeyHeld = withModifier(event) || this.heldDirection() !== null;
                if (!otherKeyHeld && !this.levelComplete && !this.springing)
                {
                    this.scene.restart(this.restartData());
                }
            });
            //  While playtesting, Esc goes straight back to the editor
            keyboard.on('keydown-ESC', () => this.levelText ? this.scene.start('Editor') : this.pauseGame());
            keyboard.on('keydown-P', () => this.pauseGame());

            //  Keys released while paused can still read as held; clear them so the player
            //  doesn't walk on their own after resuming.
            //  Scene events outlive restarts, so remove the listener on shutdown.
            const onResume = () => keyboard.resetKeys();
            this.events.on(Scenes.Events.RESUME, onResume);
            this.events.once(Scenes.Events.SHUTDOWN, () => this.events.off(Scenes.Events.RESUME, onResume));
        }
    }

    update ()
    {
        if (this.isMoving || this.levelComplete || this.springing)
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
            //  Idle only once nothing is held, so held keys chain steps without flickering to idle
            this.playPlayerAnim('idle');
            return;
        }

        const move = resolveMove(this.level.data, this.playerPos, dir);
        this.facing = dir;
        switch (move.kind)
        {
            case 'walk':
                this.movePlayer(move.path);
                break;

            case 'push':
            {
                //  The player stays put, facing the boulder
                this.playPlayerAnim('idle');
                const i = move.boulderIndex;
                const end = move.path[move.path.length - 1];
                this.tweenAlong(this.level.boulders[i], this.level.data.boulders[i], move.path, () =>
                {
                    this.level.data.boulders[i] = { ...end };
                    this.boulderOnTrap(i);
                });
                break;
            }

            case 'exit':
                //  Finish the move by stepping onto the exit tile itself
                this.levelComplete = true;
                this.movePlayer([...move.path, move.exit], () =>
                {
                    this.playPlayerAnim('idle');
                    this.completeLevel();
                });
                break;

            case 'blocked':
                //  Turn to face the wall or boulder, every time (not just once per press)
                this.playPlayerAnim('idle');
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

    //  Plays the player's walk or idle animation for the current facing direction.
    //  Does nothing if that animation is already playing.
    private playPlayerAnim (kind: PlayerAnimKind)
    {
        this.level.player.play(playerAnimKey(kind, this.facing), true);
    }

    //  Walks the player along a path: walk animation for the first step, then idle while
    //  sliding on ice. The scene clock pauses with the scene, so this stays in sync with the tween.
    private movePlayer (path: GridPoint[], then?: () => void)
    {
        this.playPlayerAnim('walk');
        if (path.length > 1)
        {
            this.time.delayedCall(MOVEMENT.walkMsPerTile, () => this.playPlayerAnim('idle'));
        }

        const end = path[path.length - 1];
        this.tweenAlong(this.level.player, this.playerPos, path, () =>
        {
            this.playerPos = { ...end };
            this.stepOnTrap();
            then?.();
        });
    }

    //  The trap at a tile, or undefined
    private trapAt (p: GridPoint): Trap | undefined
    {
        return this.level.traps.find(t => t.position.x === p.x && t.position.y === p.y);
    }

    //  If the player has stopped on a trap: arms it the first time, and springs it the second,
    //  dropping the player into the pit and restarting the level once the animation ends
    private stepOnTrap ()
    {
        const trap = this.trapAt(this.playerPos);
        if (!trap)
        {
            return;
        }
        if (!trap.armed)
        {
            trap.armed = true;
            trap.sprite.play('trap-arm');
            return;
        }

        this.springing = true;
        this.playPlayerAnim('idle');
        trap.sprite.play('trap-spring');
        const player = this.level.player;
        const duration = trap.sprite.anims.duration;
        //  The player shrinks and fades as they fall into the opening pit
        this.tweens.add({ targets: player, scale: player.scale * 0.4, alpha: 0, delay: duration / 3, duration: duration * 2 / 3 });
        trap.sprite.once(Animations.Events.ANIMATION_COMPLETE, () => this.scene.restart(this.restartData()));
    }

    //  If boulder i has stopped on a trap: arms it the first time, and springs it the second. The
    //  boulder is removed (no fall animation yet), and once the trap has opened it closes again,
    //  unarmed. Play carries on while it closes; anything stopping on it then arms it as usual.
    private boulderOnTrap (i: number)
    {
        const trap = this.trapAt(this.level.data.boulders[i]);
        if (!trap)
        {
            return;
        }
        if (!trap.armed)
        {
            trap.armed = true;
            trap.sprite.play('trap-arm');
            return;
        }

        this.level.boulders[i].destroy();
        this.level.boulders.splice(i, 1);
        this.level.data.boulders.splice(i, 1);
        this.updatePlates();

        this.springing = true;
        trap.sprite.play('trap-spring');
        trap.sprite.once(Animations.Events.ANIMATION_COMPLETE, () =>
        {
            trap.armed = false;
            trap.sprite.play('trap-close');
            this.springing = false;
            this.saveProgress();
        });
    }

    //  Presses the pressure plates the player and boulders rest on and releases the others, then
    //  opens the doors if every plate is pressed and closes them if not. `mover` is the position
    //  (this.playerPos or one of the boulders) of something that's moving, and `arriving` where
    //  it will stop: its old plate releases as it leaves, and a plate it's heading for presses
    //  before it gets there. A door doesn't close on anything in its doorway, including a mover
    //  just leaving it; it closes once that's gone.
    private updatePlates (mover?: GridPoint, arriving?: GridPoint)
    {
        const others = [this.playerPos, ...this.level.data.boulders].filter(p => p !== mover);
        const resting = arriving ? [...others, arriving] : others;
        updatePlates(this.level.plates, resting);

        const open = doorsOpen(this.level.data, resting);
        const inDoorways = mover && !arriving ? [...resting, mover] : resting;
        for (const door of this.level.doors)
        {
            const { x, y } = door.position;
            setDoorOpen(door, open || inDoorways.some(p => p.x === x && p.y === y));
        }
    }

    //  Tweens a sprite along a straight path from `from` (its logical position, this.playerPos or
    //  one of the boulders): the first tile is a step, the rest are a slide. Input is ignored
    //  until it finishes; `onDone` then updates the logical position. Pressure plates release as
    //  it leaves and press PLATES.pressLeadMs before it stops on one.
    private tweenAlong (
        sprite: GameObjects.Image | GameObjects.Sprite, from: GridPoint, path: GridPoint[], onDone: () => void
    )
    {
        const end = path[path.length - 1];
        const target = tileCenter(end);
        const duration = MOVEMENT.walkMsPerTile + (path.length - 1) * MOVEMENT.slideMsPerTile;

        this.updatePlates(from);
        //  The scene clock pauses with the scene, like the tween
        this.time.delayedCall(Math.max(0, duration - PLATES.pressLeadMs), () => this.updatePlates(from, end));

        this.isMoving = true;
        this.tweens.add({
            targets: sprite,
            x: target.x,
            y: target.y,
            duration,
            ease: 'Linear',
            //  Keep the draw order right relative to tall walls as it moves
            onUpdate: () => ySortDepth(sprite),
            onComplete: () =>
            {
                onDone();
                this.isMoving = false;
                this.saveProgress();
            }
        });
    }

    //  Remembers where everything is, so Play can pick the level up after a reload. Not for
    //  editor playtests, or once the level is complete.
    private saveProgress ()
    {
        if (this.levelText || this.levelComplete || this.springing)
        {
            return;
        }
        saveLevelInProgress({
            levelKey: LEVELS[this.levelIndex].key,
            player: { ...this.playerPos },
            boulders: this.level.data.boulders.map(b => ({ ...b })),
            facing: this.facing,
            armedTraps: this.level.traps.flatMap((t, i) => t.armed ? [i] : [])
        });
    }

    //  Freezes the level (including any tween in progress) and opens the pause menu.
    //  A paused scene receives no input, so this only runs while playing.
    private pauseGame ()
    {
        if (this.levelComplete || this.springing)
        {
            return;
        }
        const data: PauseMenuData = { levelIndex: this.levelIndex, levelText: this.levelText ?? undefined };
        this.scene.pause();
        this.scene.launch('PauseMenu', data);
    }

    private completeLevel ()
    {
        //  Editor playtests don't count towards progress
        if (!this.levelText)
        {
            markCompleted(LEVELS[this.levelIndex].key);
            clearLevelInProgress();
        }
        const data: LevelCompleteData = {
            levelIndex: this.levelIndex,
            isLast: isLastInPack(this.levelIndex),
            levelText: this.levelText ?? undefined
        };
        this.scene.launch('LevelComplete', data);
    }

    //  Called once when the player tries to move into a wall or an immovable boulder.
    //  Placeholder for a future bump sound and/or animation.
    private onBlockedMove (_dir: Direction)
    {
    }
}
