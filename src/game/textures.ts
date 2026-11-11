import { Scene, Textures } from 'phaser';
import { TILE_SIZE, TileIndex } from './levels/Tiles';

//  Builds the 'tiles' texture: a horizontal strip of TILE_SIZE tiles in TileIndex order.
//  Floor and ice are the 'snow' and 'ice' images loaded in the Preloader, scaled up to a tile;
//  the wall and goal ring are still drawn placeholders.
//  The player comes from player/openmon/set1-sheet3.png (see playerAnimations.ts) and boulders from rock.png.
export function generateTextures (scene: Scene): void
{
    const S = TILE_SIZE;
    const texture = scene.textures.createCanvas('tiles', S * 4, S);
    if (!texture)
    {
        throw new Error("Could not create canvas texture 'tiles'");
    }
    const ctx = texture.context;
    //  Keep the scaled-up pixel art sharp
    ctx.imageSmoothingEnabled = false;

    const drawImageTile = (key: string, index: TileIndex) =>
    {
        const image = scene.textures.get(key).getSourceImage() as CanvasImageSource;
        ctx.drawImage(image, index * S, 0, S, S);
    };

    //  Floor and ice
    drawImageTile('snow', TileIndex.Floor);
    drawImageTile('ice', TileIndex.Ice);

    //  Wall: dark slate with a bevel
    {
        const ox = TileIndex.Wall * S;
        ctx.fillStyle = '#2f3a4a';
        ctx.fillRect(ox, 0, S, S);
        ctx.fillStyle = '#46546a';
        ctx.fillRect(ox, 0, S, 6);
        ctx.fillRect(ox, 0, 6, S);
        ctx.fillStyle = '#1e2530';
        ctx.fillRect(ox, S - 6, S, 6);
        ctx.fillRect(ox + S - 6, 0, 6, S);
    }

    //  Goal: snow with a gold ring
    {
        const ox = TileIndex.Goal * S;
        drawImageTile('snow', TileIndex.Goal);
        ctx.beginPath();
        ctx.arc(ox + S / 2, S / 2, S * 0.3, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(242, 194, 48, 0.35)';
        ctx.fill();
        ctx.lineWidth = 6;
        ctx.strokeStyle = '#f2c230';
        ctx.stroke();
    }

    texture.refresh();
    texture.setFilter(Textures.FilterMode.NEAREST);
}
