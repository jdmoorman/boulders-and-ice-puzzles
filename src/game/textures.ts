import { Scene, Textures } from 'phaser';
import { TILE_SIZE } from './levels/Tiles';
import {
    AUTOTILE_COLUMNS, AUTOTILE_FRAMES, AUTOTILE_SETS, ISOLATED_FRAME, autotileBase
} from './levels/autotile';

//  Builds the level textures from the images loaded in the Preloader:
//  - 'tiles': a horizontal strip of TILE_SIZE tiles in TileIndex order, followed by every frame
//    of each autotile set (see autotile.ts). Every tile comes from an autotile sheet,
//    scaled up to a tile.
//  - 'goal': the exit's gold ring, drawn over the snow under it.
//  The player comes from player/openmon/set1-sheet3.png (see playerAnimations.ts) and boulders from rock.png.
export function generateTextures (scene: Scene): void
{
    const S = TILE_SIZE;
    const tileCount = autotileBase(AUTOTILE_SETS.length);
    const tiles = scene.textures.createCanvas('tiles', S * tileCount, S);
    if (!tiles)
    {
        throw new Error("Could not create canvas texture 'tiles'");
    }
    const ctx = tiles.context;
    //  Keep the scaled-up pixel art sharp
    ctx.imageSmoothingEnabled = false;

    const source = (key: string) => scene.textures.get(key).getSourceImage() as HTMLImageElement;

    //  Autotile frames. The plain TileIndex slots get each set's isolated frame; levels are
    //  always drawn with the autotiled frames, so these are only a fallback.
    AUTOTILE_SETS.forEach((set, setIndex) =>
    {
        const sheet = source(set.texture);
        const frameSize = sheet.width / AUTOTILE_COLUMNS;
        const drawFrame = (frame: number, index: number) =>
        {
            const sx = (frame % AUTOTILE_COLUMNS) * frameSize;
            const sy = Math.floor(frame / AUTOTILE_COLUMNS) * frameSize;
            ctx.drawImage(sheet, sx, sy, frameSize, frameSize, index * S, 0, S, S);
        };

        for (const tile of set.tiles)
        {
            drawFrame(ISOLATED_FRAME, tile);
        }
        for (let frame = 0; frame < AUTOTILE_FRAMES; frame++)
        {
            drawFrame(frame, autotileBase(setIndex) + frame);
        }
    });

    tiles.refresh();
    tiles.setFilter(Textures.FilterMode.NEAREST);

    //  Goal ring
    const goal = scene.textures.createCanvas('goal', S, S);
    if (!goal)
    {
        throw new Error("Could not create canvas texture 'goal'");
    }
    const g = goal.context;
    g.beginPath();
    g.arc(S / 2, S / 2, S * 0.3, 0, Math.PI * 2);
    g.fillStyle = 'rgba(242, 194, 48, 0.35)';
    g.fill();
    g.lineWidth = 6;
    g.strokeStyle = '#f2c230';
    g.stroke();
    goal.refresh();
}
