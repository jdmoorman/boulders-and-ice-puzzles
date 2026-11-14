import { Scene, GameObjects } from 'phaser';
import { GridPoint } from './levels/LevelParser';

//  Rune traps. The first time the player or a boulder stops on one it arms: it sinks and its rune
//  lights up. The second time it springs: the floor slides away into a pit. A player who falls in
//  starts the level over; a boulder that falls in is gone, and the trap closes again, unarmed.
//
//  Art: ranitayas_rune_trap.png, a strip of 32x32 frames: arming is the first half of the
//  strip (ending on the lit rune) and springing is the rest. Closing plays the whole strip
//  backwards: the pit closes, then the slab rises and its rune goes dark.

export const TRAP_FRAME_SIZE = 32;
const TRAP_FPS = 12;

//  Loads the trap sheet. Call from the Preloader's preload().
export function loadTraps (scene: Scene): void
{
    scene.load.spritesheet('trap', 'ranitayas_rune_trap.png', { frameWidth: TRAP_FRAME_SIZE, frameHeight: TRAP_FRAME_SIZE });
}

//  The last frame of the arming half: an armed trap at rest
export function trapArmedFrame (scene: Scene): number
{
    return Math.floor((scene.textures.get('trap').frameTotal - 2) / 2);
}

//  Registers 'trap-arm' and 'trap-spring', splitting the sheet in half, and 'trap-close'. Animations are global, so
//  call this once (in the Preloader).
export function createTrapAnimations (scene: Scene): void
{
    //  frameTotal counts the whole-texture frame too
    const last = scene.textures.get('trap').frameTotal - 2;
    const armed = trapArmedFrame(scene);
    scene.anims.create({
        key: 'trap-arm',
        frames: scene.anims.generateFrameNumbers('trap', { start: 0, end: armed }),
        frameRate: TRAP_FPS
    });
    scene.anims.create({
        key: 'trap-spring',
        frames: scene.anims.generateFrameNumbers('trap', { start: armed + 1, end: last }),
        frameRate: TRAP_FPS
    });
    scene.anims.create({
        key: 'trap-close',
        frames: scene.anims.generateFrameNumbers('trap', { start: last, end: 0 }),
        frameRate: TRAP_FPS
    });
}

//  A trap in play
export interface Trap
{
    position: GridPoint;
    sprite: GameObjects.Sprite;
    armed: boolean;
}
