import { Scene } from 'phaser';
import { Direction } from './movement/Movement';
import { PLAYER_ANIMATION } from './settings';

export type PlayerAnimKind = 'walk' | 'idle';

//  Frames in firefox.png (32x32, 8 per row; frame = row * 8 + column, rows from 0).
//  Rows 1, 4 and 7 of the sheet are unused. Left-facing reuses 'right', mirrored.
const PLAYER_ANIMS: readonly { key: string, start: number, end: number, kind: PlayerAnimKind }[] = [
    { key: 'player-walk-right', start: 8, end: 11, kind: 'walk' },   //  row 2
    { key: 'player-idle-right', start: 16, end: 20, kind: 'idle' },  //  row 3
    { key: 'player-walk-up', start: 32, end: 39, kind: 'walk' },     //  row 5
    { key: 'player-idle-up', start: 40, end: 41, kind: 'idle' },     //  row 6
    { key: 'player-walk-down', start: 56, end: 59, kind: 'walk' },   //  row 8
    { key: 'player-idle-down', start: 64, end: 65, kind: 'idle' }    //  row 9
];

//  Size of one frame in firefox.png
export const PLAYER_FRAME_SIZE = 32;

//  Registers the player animations. Animations are global, so call this once (in the Preloader).
export function createPlayerAnimations (scene: Scene): void
{
    for (const anim of PLAYER_ANIMS)
    {
        scene.anims.create({
            key: anim.key,
            frames: scene.anims.generateFrameNumbers('player', { start: anim.start, end: anim.end }),
            frameRate: anim.kind === 'walk' ? PLAYER_ANIMATION.walkFps : PLAYER_ANIMATION.idleFps,
            repeat: -1
        });
    }
}

//  Animation key for a kind and direction. Left uses the right-facing animation, flipped.
export function playerAnimKey (kind: PlayerAnimKind, dir: Direction): { key: string, flipX: boolean }
{
    if (dir === 'left')
    {
        return { key: `player-${kind}-right`, flipX: true };
    }
    return { key: `player-${kind}-${dir}`, flipX: false };
}
