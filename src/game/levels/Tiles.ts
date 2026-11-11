//  Tile indices into the generated 'tiles' texture strip (see textures.ts).
//  The order here must match the order the tiles are drawn in. Autotile frames follow
//  these in the strip (see autotile.ts); level data only ever holds these values.
export enum TileIndex
{
    Void = -1,  //  Phaser treats -1 as "no tile"
    Floor = 0,
    Ice = 1,
    Wall = 2,
    Goal = 3
}

export const TILE_SIZE = 64;

export type EntityKind = 'player' | 'boulder';

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
    'x': { tile: TileIndex.Goal },
    'p': { tile: TileIndex.Floor, entity: 'player' },
    'P': { tile: TileIndex.Ice, entity: 'player' },
    'b': { tile: TileIndex.Floor, entity: 'boulder' },
    'B': { tile: TileIndex.Ice, entity: 'boulder' }
};
