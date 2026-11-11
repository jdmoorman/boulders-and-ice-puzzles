import { Scene } from 'phaser';
import { TILE_SIZE, TileIndex } from './levels/Tiles';

//  Draws placeholders into textures until the game has image files.
//  Creates 'tiles' (a horizontal strip in TileIndex order).
//  The player comes from player/openmon/set1-sheet3.png (see playerAnimations.ts) and boulders from rock.png.
export function generateTextures (scene: Scene): void
{
    const S = TILE_SIZE;
    const g = scene.make.graphics({}, false);

    const drawFloor = (ox: number) =>
    {
        g.fillStyle(0x8a8f98);
        g.fillRect(ox, 0, S, S);
        g.lineStyle(2, 0x6f747c);
        g.strokeRect(ox + 1, 1, S - 2, S - 2);
    };

    //  Floor
    drawFloor(TileIndex.Floor * S);

    //  Ice: pale blue with highlight streaks
    {
        const ox = TileIndex.Ice * S;
        g.fillStyle(0xbfe6ff);
        g.fillRect(ox, 0, S, S);
        g.lineStyle(2, 0x9fd0f0);
        g.strokeRect(ox + 1, 1, S - 2, S - 2);
        g.lineStyle(4, 0xffffff, 0.8);
        g.lineBetween(ox + 12, S - 20, ox + 30, 14);
        g.lineStyle(2, 0xffffff, 0.6);
        g.lineBetween(ox + 30, S - 14, ox + 44, 24);
    }

    //  Wall: dark slate with a bevel
    {
        const ox = TileIndex.Wall * S;
        g.fillStyle(0x2f3a4a);
        g.fillRect(ox, 0, S, S);
        g.fillStyle(0x46546a);
        g.fillRect(ox, 0, S, 6);
        g.fillRect(ox, 0, 6, S);
        g.fillStyle(0x1e2530);
        g.fillRect(ox, S - 6, S, 6);
        g.fillRect(ox + S - 6, 0, 6, S);
    }

    //  Goal: floor with a gold ring
    {
        const ox = TileIndex.Goal * S;
        drawFloor(ox);
        g.lineStyle(6, 0xf2c230);
        g.strokeCircle(ox + S / 2, S / 2, S * 0.3);
        g.fillStyle(0xf2c230, 0.35);
        g.fillCircle(ox + S / 2, S / 2, S * 0.3);
    }

    g.generateTexture('tiles', S * 4, S);

    g.destroy();
}
