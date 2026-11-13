import { Scene, GameObjects } from 'phaser';
import { GridPoint } from './levels/LevelParser';

//  Pressure plates. For now they do nothing but show whether they're pressed: pressed while the
//  player or a boulder rests on one (sliding across doesn't count).
//
//  Art: ranitayas_plate_press.png and ranitayas_plate_unpress.png, strips of 14x13 frames.
//  'plate-press' goes from raised to pressed and 'plate-unpress' back again; each animation plays
//  every frame of its sheet, so the sheets can have any number of frames.

export const PLATE_FRAME_WIDTH = 14;
export const PLATE_FRAME_HEIGHT = 13;
//  The frame of 'plate-press' showing a raised plate
export const PLATE_UP_FRAME = 0;
//  A pressed plate at rest: the first frame of the animation that releases it
export const PLATE_PRESSED: Readonly<{ key: string, frame: number }> = { key: 'plate-unpress', frame: 0 };
const PLATE_FPS = 12;
//  The art's pixels per tile, as for the player
export const PLATE_ART_TILE_SIZE = 16;
//  How far below its tile's bottom edge a plate's bottom edge sits, in world pixels at TILE_SIZE
export const PLATE_DROP = 0;

//  Loads the plate sheets. Call from the Preloader's preload().
export function loadPlates (scene: Scene): void
{
    const frame = { frameWidth: PLATE_FRAME_WIDTH, frameHeight: PLATE_FRAME_HEIGHT };
    scene.load.spritesheet('plate-press', 'ranitayas_plate_press.png', frame);
    scene.load.spritesheet('plate-unpress', 'ranitayas_plate_unpress.png', frame);
}

//  Registers the press and unpress animations. Animations are global, so call this once (in the
//  Preloader).
export function createPlateAnimations (scene: Scene): void
{
    for (const key of ['plate-press', 'plate-unpress'])
    {
        scene.anims.create({
            key,
            frames: scene.anims.generateFrameNumbers(key),
            frameRate: PLATE_FPS
        });
    }
}

//  A pressure plate in play
export interface Plate
{
    position: GridPoint;
    sprite: GameObjects.Sprite;
    pressed: boolean;
}

//  Sets every plate's state from what rests on it, the cells in `occupied`, playing the press or
//  unpress animation for each plate that changes
export function updatePlates (plates: readonly Plate[], occupied: readonly GridPoint[]): void
{
    for (const plate of plates)
    {
        const { x, y } = plate.position;
        const pressed = occupied.some(p => p.x === x && p.y === y);
        if (plate.pressed !== pressed)
        {
            plate.pressed = pressed;
            plate.sprite.play(pressed ? 'plate-press' : 'plate-unpress');
        }
    }
}
