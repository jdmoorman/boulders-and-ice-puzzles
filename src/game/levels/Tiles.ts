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

//  Things that stand on a snow or ice tile. The goal is the exit; a plate is a pressure plate,
//  pressed while the player or a boulder rests on it; a door is open while every plate is pressed.
export type EntityKind = 'player' | 'boulder' | 'goal' | 'plate' | 'door';

export interface LegendEntry
{
    tile: TileIndex;
    entity?: EntityKind;
}

//  ASCII level legend. For entities, lowercase means the entity stands on floor
//  and uppercase means it stands on ice.
export const LEGEND: Readonly<Record<string, LegendEntry>> = {
    ' ': { tile: TileIndex.Void },
    '#': { tile: TileIndex.Wall },
    '.': { tile: TileIndex.Floor },
    '_': { tile: TileIndex.Ice },
    'p': { tile: TileIndex.Floor, entity: 'player' },
    'P': { tile: TileIndex.Ice, entity: 'player' },
    'b': { tile: TileIndex.Floor, entity: 'boulder' },
    'B': { tile: TileIndex.Ice, entity: 'boulder' },
    'x': { tile: TileIndex.Floor, entity: 'goal' },
    'X': { tile: TileIndex.Ice, entity: 'goal' },
    'o': { tile: TileIndex.Floor, entity: 'plate' },
    'O': { tile: TileIndex.Ice, entity: 'plate' },
    'd': { tile: TileIndex.Floor, entity: 'door' },
    'D': { tile: TileIndex.Ice, entity: 'door' }
};
