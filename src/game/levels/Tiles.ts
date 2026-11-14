//  Tile indices into the generated 'tiles' texture strip (see textures.ts).
//  The order here must match the order the tiles are drawn in. Autotile frames follow
//  these in the strip (see autotile.ts); level data only ever holds these values.
export enum TileIndex
{
    Void = -1,  //  Phaser treats -1 as "no tile"
    Floor = 0,
    Ice = 1,
    Wall = 2
}

//  Number of plain tiles at the start of the 'tiles' strip, before the autotile frames
export const PLAIN_TILE_COUNT = TileIndex.Wall + 1;

export const TILE_SIZE = 64;

//  Things that stand on a snow or ice tile, except the goal: the exit, a hole in a south-facing
//  wall (see isSouthFacingWall), entered only from the tile below. A plate is a pressure plate,
//  pressed while the player or a boulder rests on it; a door is open while every plate is pressed;
//  a trap arms the first time the player steps on it and restarts the level the second time.
export type EntityKind = 'player' | 'boulder' | 'goal' | 'plate' | 'door' | 'trap';

export interface LegendEntry
{
    tile: TileIndex;
    entity?: EntityKind;
}

//  ASCII level legend. For entities, lowercase means the entity stands on floor
//  and uppercase means it stands on ice. The exit is a wall.
export const LEGEND: Readonly<Record<string, LegendEntry>> = {
    ' ': { tile: TileIndex.Void },
    '#': { tile: TileIndex.Wall },
    '.': { tile: TileIndex.Floor },
    '_': { tile: TileIndex.Ice },
    'p': { tile: TileIndex.Floor, entity: 'player' },
    'P': { tile: TileIndex.Ice, entity: 'player' },
    'b': { tile: TileIndex.Floor, entity: 'boulder' },
    'B': { tile: TileIndex.Ice, entity: 'boulder' },
    'x': { tile: TileIndex.Wall, entity: 'goal' },
    'o': { tile: TileIndex.Floor, entity: 'plate' },
    'O': { tile: TileIndex.Ice, entity: 'plate' },
    'd': { tile: TileIndex.Floor, entity: 'door' },
    'D': { tile: TileIndex.Ice, entity: 'door' },
    //  Traps only stand on snow, so the player always stops on one rather than sliding over it
    't': { tile: TileIndex.Floor, entity: 'trap' }
};

//  Whether (x, y) is a wall with snow or ice right below it: the only place an exit can go
export function isSouthFacingWall (tiles: number[][], x: number, y: number): boolean
{
    const below = tiles[y + 1]?.[x];
    return tiles[y]?.[x] === TileIndex.Wall && (below === TileIndex.Floor || below === TileIndex.Ice);
}
