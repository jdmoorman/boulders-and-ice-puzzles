import { Scene, Textures } from 'phaser';
import { TILE_SIZE, TileIndex } from './levels/Tiles';
import {
    AUTOTILE_COLUMNS, AUTOTILE_FRAMES, AUTOTILE_SETS, ISOLATED_FRAME, autotileBase,
    autotileFrameSize, isTallSet
} from './levels/autotile';

//  Builds the level textures from the images loaded in the Preloader:
//  - 'tiles': a horizontal strip of TILE_SIZE tiles in TileIndex order, followed by every frame
//    of each autotile set (see autotile.ts). Ice is the plain 'ice' image; floor, exit and
//    walls come from autotile sheets. All are scaled up to a tile.
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

    //  Ice: one plain tile, not autotiled
    ctx.drawImage(source('ice'), TileIndex.Ice * S, 0, S, S);

    //  Autotile frames. The plain TileIndex slots get each set's isolated frame; levels are
    //  always drawn with the autotiled frames, so these are only a fallback. For a tall set
    //  this strip holds just the bottom square of each frame (also unused), and the full
    //  frames are added to the set's own texture as frames 0..AUTOTILE_FRAMES-1.
    AUTOTILE_SETS.forEach((set, setIndex) =>
    {
        const sheet = source(set.texture);
        const { width: fw, height: fh } = autotileFrameSize(scene, set);
        const frameX = (frame: number) => (frame % AUTOTILE_COLUMNS) * fw;
        const frameY = (frame: number) => Math.floor(frame / AUTOTILE_COLUMNS) * fh;
        const drawFrame = (frame: number, index: number) =>
        {
            //  Bottom square of the frame
            ctx.drawImage(sheet, frameX(frame), frameY(frame) + fh - fw, fw, fw, index * S, 0, S, S);
        };

        for (const tile of set.tiles)
        {
            drawFrame(ISOLATED_FRAME, tile);
        }
        for (let frame = 0; frame < AUTOTILE_FRAMES; frame++)
        {
            drawFrame(frame, autotileBase(setIndex) + frame);
        }

        if (isTallSet(scene, set))
        {
            const texture = scene.textures.get(set.texture);
            for (let frame = 0; frame < AUTOTILE_FRAMES; frame++)
            {
                texture.add(frame, 0, frameX(frame), frameY(frame), fw, fh);
            }
            texture.setFilter(Textures.FilterMode.NEAREST);
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
