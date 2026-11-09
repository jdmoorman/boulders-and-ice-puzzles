import { Scene, GameObjects, Tilemaps } from 'phaser';
import { LevelData, GridPoint } from './LevelParser';
import { TILE_SIZE } from './Tiles';

export interface BuiltLevel
{
    data: LevelData;
    map: Tilemaps.Tilemap;
    layer: Tilemaps.TilemapLayer | Tilemaps.TilemapGPULayer;
    player: GameObjects.Image;
    boulders: GameObjects.Image[];
}

//  World position of a tile's center
export function tileCenter (p: GridPoint): { x: number, y: number }
{
    return {
        x: p.x * TILE_SIZE + TILE_SIZE / 2,
        y: p.y * TILE_SIZE + TILE_SIZE / 2
    };
}

//  Builds a tilemap and entity sprites from parsed level data, and fits the camera to it.
//  Requires the 'tiles', 'player' and 'boulder' textures from generateTextures().
export function buildLevel (scene: Scene, data: LevelData): BuiltLevel
{
    const map = scene.make.tilemap({
        data: data.tiles,
        tileWidth: TILE_SIZE,
        tileHeight: TILE_SIZE
    });

    const tileset = map.addTilesetImage('tiles', 'tiles', TILE_SIZE, TILE_SIZE);
    if (!tileset)
    {
        throw new Error("Could not create tileset from texture 'tiles'");
    }

    const layer = map.createLayer(0, tileset, 0, 0);
    if (!layer)
    {
        throw new Error('Could not create tilemap layer');
    }

    const boulders = data.boulders.map(b =>
    {
        const { x, y } = tileCenter(b);
        return scene.add.image(x, y, 'boulder');
    });

    const start = tileCenter(data.player);
    const player = scene.add.image(start.x, start.y, 'player');

    //  Center the level on screen, shrinking it if it doesn't fit
    const camera = scene.cameras.main;
    const worldWidth = data.width * TILE_SIZE;
    const worldHeight = data.height * TILE_SIZE;
    const zoom = Math.min(1, camera.width / worldWidth, camera.height / worldHeight);
    camera.setZoom(zoom);
    camera.centerOn(worldWidth / 2, worldHeight / 2);

    return { data, map, layer, player, boulders };
}
