import { Scene } from 'phaser';
import { Direction } from './movement/Movement';
import { PLAYER_ANIMATION } from './settings';

export type PlayerAnimKind = 'walk' | 'idle';

//  Frame size in player/openmon/set1-sheet3.png: 3 columns x 4 rows of 18x26 frames.
export const PLAYER_FRAME_WIDTH = 18;
export const PLAYER_FRAME_HEIGHT = 26;
const FRAMES_PER_ROW = 3;

//  Sheet row for each facing direction. In each row the middle frame is the standing pose.
const ROWS: Readonly<Record<Direction, number>> = {
    down: 0,
    left: 1,
    right: 2,
    up: 3
};

//  Registers the player animations. Animations are global, so call this once (in the Preloader).
//  - player-walk-<dir>: left step, stand, right step, stand (frames 0, 1, 2, 1 of the row)
//  - player-idle-<dir>: the standing frame (frame 1 of the row)
export function createPlayerAnimations (scene: Scene): void
{
    for (const [dir, row] of Object.entries(ROWS))
    {
        const first = row * FRAMES_PER_ROW;
        scene.anims.create({
            key: `player-walk-${dir}`,
            frames: scene.anims.generateFrameNumbers('player', { frames: [first, first + 1, first + 2, first + 1] }),
            frameRate: PLAYER_ANIMATION.walkFps,
            repeat: -1
        });
        scene.anims.create({
            key: `player-idle-${dir}`,
            frames: scene.anims.generateFrameNumbers('player', { frames: [first + 1] })
        });
    }
}

//  Animation key for a kind and direction.
export function playerAnimKey (kind: PlayerAnimKind, dir: Direction): string
{
    return `player-${kind}-${dir}`;
}
