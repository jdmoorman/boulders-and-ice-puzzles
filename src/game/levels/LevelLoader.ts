import { Scene, GameObjects, Tilemaps } from 'phaser';
import { LevelData, GridPoint } from './LevelParser';
import { TILE_SIZE } from './Tiles';
import { PLAYER_FRAME_HEIGHT } from '../playerAnimations';
import { PLAYER_SPRITE } from '../settings';

export interface BuiltLevel
{
    data: LevelData;
    map: Tilemaps.Tilemap;
    layer: Tilemaps.TilemapLayer | Tilemaps.TilemapGPULayer;
    player: GameObjects.Sprite;
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

//  Builds a tilemap and entity sprites from parsed level data, and makes the camera follow the player.
//  Requires the 'tiles' texture from generateTextures(), and the 'player' spritesheet and
//  'boulder' image loaded in the Preloader.
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
        //  rock.png is 32x32; draw it at one tile
        return scene.add.image(x, y, 'boulder').setDisplaySize(TILE_SIZE, TILE_SIZE);
    });

    const start = tileCenter(data.player);
    //  The player is drawn taller than a tile, standing on its tile and reaching into the one
    //  above. Its position stays at the tile centre (so movement tweens are unchanged); the
    //  origin shifts the frame up so its bottom edge (where the feet are) sits
    //  feetAboveTileBottom pixels above the tile's bottom edge.
    const frameHeight = PLAYER_FRAME_HEIGHT * PLAYER_SPRITE.pixelScale;
    const player = scene.add.sprite(start.x, start.y, 'player')
        .setScale(PLAYER_SPRITE.pixelScale)
        .setOrigin(0.5, 1 - (TILE_SIZE / 2 - PLAYER_SPRITE.feetAboveTileBottom) / frameHeight);

    //  Keep the player centred on screen at all times (no bounds, no smoothing), so the
    //  level scrolls around them and space past the level's edges can show.
    const camera = scene.cameras.main;
    camera.setZoom(1);
    camera.startFollow(player, true);

    return { data, map, layer, player, boulders };
}
