import { TileIndex } from './Tiles';

//  Autotiling with tilesets in Godot's 3x3 minimal (47 tile) layout: 12 columns x 4 rows of
//  tiles, with one cell (column 10, row 1) left empty.
//
//  Each autotiled tile picks a frame from which of its 8 neighbours it joins with. The frame
//  for a neighbour mask is the same in every sheet that uses this layout.

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
    //  Walls join with walls, void and the outside of the level, so their rock edge is only
    //  drawn where a wall meets the playable area.
    {
        texture: 'wallAutotile',
        tiles: [TileIndex.Wall],
        joins: n => n === undefined || n === TileIndex.Wall || n === TileIndex.Void
    },
    //  Snow covers floor and the exit (its ring is drawn on top), and gets a shaded edge
    //  wherever it meets anything else.
    {
        texture: 'snowAutotile',
        tiles: [TileIndex.Floor, TileIndex.Goal],
        joins: n => n === TileIndex.Floor || n === TileIndex.Goal
    },
    //  Ice gets a rim wherever it meets anything that isn't ice.
    {
        texture: 'iceAutotile',
        tiles: [TileIndex.Ice],
        joins: n => n === TileIndex.Ice
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
//  (Read from wall_autotile.png and checked against snow_autotile.png and ice_autotile.png: an edge or corner counts
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

//  Returns a copy of a level's tiles for display, with each autotiled tile replaced by the
//  'tiles' strip index of the frame that fits its neighbours. The level data itself keeps
//  plain TileIndex values, which movement relies on.
export function autotileLevel (tiles: number[][]): number[][]
{
    return tiles.map((row, y) => row.map((tile, x) =>
    {
        const setIndex = AUTOTILE_SETS.findIndex(set => set.tiles.includes(tile));
        if (setIndex < 0)
        {
            return tile;
        }
        const mask = autotileMask(tiles, x, y, AUTOTILE_SETS[setIndex]);
        return autotileBase(setIndex) + FRAME_BY_MASK.get(mask)!;
    }));
}
