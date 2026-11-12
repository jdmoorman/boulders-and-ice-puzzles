import { Scene } from 'phaser';
import { TileIndex } from './Tiles';

//  Autotiling with tilesets in Godot's 3x3 minimal (47 tile) layout: 12 columns x 4 rows of
//  tiles, with one cell (column 10, row 1) left empty.
//
//  Each autotiled tile picks a frame from which of its 8 neighbours it joins with. The frame
//  for a neighbour mask is the same in every sheet that uses this layout.
//
//  Frames may be taller than they are wide (e.g. walls drawn in 3/4 view). Only the bottom
//  square of a tall frame sits on the tile; the rest rises over the tiles above it. The frame
//  size is read from the sheet: width / AUTOTILE_COLUMNS by height / AUTOTILE_ROWS.

export const AUTOTILE_COLUMNS = 12;
export const AUTOTILE_ROWS = 4;
export const AUTOTILE_FRAMES = AUTOTILE_COLUMNS * AUTOTILE_ROWS;

export interface AutotileSet
{
    //  Texture key of the sheet (loaded in the Preloader)
    texture: string;
    //  Level tiles drawn with this set
    tiles: readonly TileIndex[];
    //  Whether a neighbouring tile joins up with this set (undefined = outside the level)
    joins: (neighbour: TileIndex | undefined) => boolean;
}

//  The autotiled sets. Their frames follow the TileIndex tiles in the 'tiles' strip, one block
//  of AUTOTILE_FRAMES per set in this order (see textures.ts).
export const AUTOTILE_SETS: readonly AutotileSet[] = [
    //  Walls join only with walls, so their rock edge is drawn wherever a wall meets anything
    //  else, including void and the outside of the level (a lone wall looks like a lone wall).
    {
        texture: 'wallAutotile',
        tiles: [TileIndex.Wall],
        joins: n => n === TileIndex.Wall
    },
    //  Snow covers floor and the exit (its ring is drawn on top). Walls count as snow, so the
    //  snow runs up to them without an edge; it gets a shaded edge against ice and void.
    {
        texture: 'snowAutotile',
        tiles: [TileIndex.Floor, TileIndex.Goal],
        joins: n => n === TileIndex.Floor || n === TileIndex.Goal || n === TileIndex.Wall
    }
];

//  'tiles' strip index of a set's first frame
export function autotileBase (setIndex: number): number
{
    return TileIndex.Goal + 1 + setIndex * AUTOTILE_FRAMES;
}

//  Neighbour bits
const N = 1, NE = 2, E = 4, SE = 8, S = 16, SW = 32, W = 64, NW = 128;

//  Sheet frame for each neighbour mask, one row of the sheet per line.
//  A corner bit is only set when both edges next to it are set, which leaves 47 masks.
//  (Read from wall_autotile.png and checked against snow_autotile.png: an edge or corner counts
//  as joined where the tile's interior reaches it.)
const MASKS_BY_FRAME: readonly (number | null)[] = [
    16, 20, 84, 80, 213, 92, 116, 87, 28, 125, 124, 112,
    17, 21, 85, 81, 29, 127, 253, 113, 31, 119, null, 245,
    1, 5, 69, 65, 23, 223, 247, 209, 95, 255, 221, 241,
    0, 4, 68, 64, 117, 71, 197, 93, 7, 199, 215, 193
];

const FRAME_BY_MASK = new Map<number, number>();
MASKS_BY_FRAME.forEach((mask, frame) =>
{
    if (mask !== null)
    {
        FRAME_BY_MASK.set(mask, frame);
    }
});

//  The frame for a tile with no joined neighbours, used for the plain TileIndex slots
export const ISOLATED_FRAME = FRAME_BY_MASK.get(0)!;
//  The frame for a tile joined on all 8 sides
export const SURROUNDED_FRAME = FRAME_BY_MASK.get(255)!;

//  The neighbour mask of the tile at (x, y) in a set.
export function autotileMask (tiles: number[][], x: number, y: number, set: AutotileSet): number
{
    const j = (dx: number, dy: number) => set.joins(tiles[y + dy]?.[x + dx]);
    let mask = 0;
    if (j(0, -1)) mask |= N;
    if (j(1, 0)) mask |= E;
    if (j(0, 1)) mask |= S;
    if (j(-1, 0)) mask |= W;
    if ((mask & N) && (mask & E) && j(1, -1)) mask |= NE;
    if ((mask & S) && (mask & E) && j(1, 1)) mask |= SE;
    if ((mask & S) && (mask & W) && j(-1, 1)) mask |= SW;
    if ((mask & N) && (mask & W) && j(-1, -1)) mask |= NW;
    return mask;
}

//  The sheet frame for the tile at (x, y) in a set.
export function autotileFrame (tiles: number[][], x: number, y: number, set: AutotileSet): number
{
    return FRAME_BY_MASK.get(autotileMask(tiles, x, y, set))!;
}

//  Size in pixels of one frame of a set's sheet (the sheet must already be loaded).
export function autotileFrameSize (scene: Scene, set: AutotileSet): { width: number, height: number }
{
    const sheet = scene.textures.get(set.texture).getSourceImage() as HTMLImageElement;
    return { width: sheet.width / AUTOTILE_COLUMNS, height: sheet.height / AUTOTILE_ROWS };
}

//  Whether a set's frames are taller than a tile. Tall sets are drawn as depth-sorted images
//  (see LevelLoader.ts) instead of in the tilemap.
export function isTallSet (scene: Scene, set: AutotileSet): boolean
{
    const { width, height } = autotileFrameSize(scene, set);
    return height > width;
}

//  The tilemap index to draw at (x, y): the 'tiles' strip index of the autotile frame that fits
//  the tile's neighbours, TileIndex.Void for tiles of a tall set (drawn as images instead; see
//  addTallTile in LevelLoader.ts), or the plain tile for tiles no set covers.
export function displayTileIndex (
    tiles: number[][], x: number, y: number, isTall: (set: AutotileSet) => boolean
): number
{
    const tile = tiles[y][x];
    const setIndex = AUTOTILE_SETS.findIndex(set => set.tiles.includes(tile));
    if (setIndex < 0)
    {
        return tile;
    }
    const set = AUTOTILE_SETS[setIndex];
    if (isTall(set))
    {
        return TileIndex.Void;
    }
    return autotileBase(setIndex) + autotileFrame(tiles, x, y, set);
}

//  Returns a copy of a level's tiles for the tilemap (see displayTileIndex). The level data
//  itself keeps plain TileIndex values, which movement relies on.
export function autotileLevel (tiles: number[][], isTall: (set: AutotileSet) => boolean): number[][]
{
    return tiles.map((row, y) => row.map((_tile, x) => displayTileIndex(tiles, x, y, isTall)));
}
