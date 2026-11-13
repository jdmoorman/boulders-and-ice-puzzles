import { Scene, GameObjects } from 'phaser';
import { GridPoint } from './levels/LevelParser';

//  Metal doors (portcullises), open while every pressure plate is pressed (see doorsOpen in
//  Movement.ts).
//
//  Art: Ranitayas_door_open.png and Ranitayas_door_close.png, strips of 16x32 frames: bars
//  standing on the bottom of the tile and rising over the tile above. 'door-open' goes from
//  closed to open and 'door-close' back again; each animation plays every frame of its sheet.

export const DOOR_FRAME_WIDTH = 16;
export const DOOR_FRAME_HEIGHT = 32;
const DOOR_FPS = 12;

//  The pictures of a door at rest: the first frame of the animation that leaves that state
export const DOOR_CLOSED: Readonly<{ key: string, frame: number }> = { key: 'door-open', frame: 0 };
export const DOOR_OPEN: Readonly<{ key: string, frame: number }> = { key: 'door-close', frame: 0 };

//  Loads the door sheets. Call from the Preloader's preload().
export function loadDoors (scene: Scene): void
{
    const frame = { frameWidth: DOOR_FRAME_WIDTH, frameHeight: DOOR_FRAME_HEIGHT };
    scene.load.spritesheet('door-open', 'Ranitayas_door_open.png', frame);
    scene.load.spritesheet('door-close', 'Ranitayas_door_close.png', frame);
}

//  Registers the open and close animations. Animations are global, so call this once (in the
//  Preloader).
export function createDoorAnimations (scene: Scene): void
{
    for (const key of ['door-open', 'door-close'])
    {
        scene.anims.create({ key, frames: scene.anims.generateFrameNumbers(key), frameRate: DOOR_FPS });
    }
}

//  A door in play
export interface Door
{
    position: GridPoint;
    sprite: GameObjects.Sprite;
    open: boolean;
}

//  Shows a door open or closed: animated if `animate`, otherwise straight to the end picture
export function setDoorOpen (door: Door, open: boolean, animate = true): void
{
    if (door.open === open)
    {
        return;
    }
    door.open = open;
    if (animate)
    {
        door.sprite.play(open ? 'door-open' : 'door-close');
    }
    else
    {
        const { key, frame } = open ? DOOR_OPEN : DOOR_CLOSED;
        door.sprite.stop().setTexture(key, frame);
    }
}
