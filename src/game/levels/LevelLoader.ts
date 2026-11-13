import { Scene, GameObjects, Tilemaps } from 'phaser';
import { LevelData, GridPoint } from './LevelParser';
import { TILE_SIZE } from './Tiles';
import { PLAYER_FRAME_HEIGHT } from '../playerAnimations';
import { PLAYER_SPRITE } from '../settings';
import { AUTOTILE_SETS, AutotileSet, autotileFrame, autotileFrameSize, autotileLevel, isTallSet } from './autotile';

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

//  Draw order: the tilemap sits at depth 0 and the exit just above it, under everything else.
//  Tall wall images, the player and boulders are sorted by the bottom edge of the tile they stand
//  on, so a tall wall covers things on the tiles north of it and is covered by things south of it.
//  Sets an object's depth from the bottom edge of the tile its centre is in.
export function ySortDepth (obj: GameObjects.Image | GameObjects.Sprite): void
{
    obj.setDepth(obj.y + TILE_SIZE / 2);
}

//  Adds the image for a tall autotile tile at (x, y): standing on the bottom edge of its tile,
//  rising over the tiles above it, and depth-sorted by that bottom edge.
export function addTallTile (
    scene: Scene, set: AutotileSet, tiles: number[][], x: number, y: number
): GameObjects.Image
{
    const scale = TILE_SIZE / autotileFrameSize(scene, set).width;
    const bottom = (y + 1) * TILE_SIZE;
    const image = scene.add.image(x * TILE_SIZE, bottom, set.texture, autotileFrame(tiles, x, y, set))
        .setOrigin(0, 1)
        .setScale(scale)
        .setDepth(bottom);
    return image;
}

//  Depth of the exit: over the terrain but under everything that stands on tiles (y-sorted
//  objects start at TILE_SIZE / 2), so the player is drawn over it
export const GOAL_DEPTH = 0.5;

//  Adds the exit, a gold ring, on tile p
export function addGoal (scene: Scene, p: GridPoint): GameObjects.Image
{
    const { x, y } = tileCenter(p);
    return scene.add.image(x, y, 'goal').setDepth(GOAL_DEPTH);
}

//  Adds a boulder image on tile p.
export function addBoulder (scene: Scene, p: GridPoint): GameObjects.Image
{
    const { x, y } = tileCenter(p);
    //  rock.png is 32x32; draw it at one tile
    const boulder = scene.add.image(x, y, 'boulder').setDisplaySize(TILE_SIZE, TILE_SIZE);
    ySortDepth(boulder);
    return boulder;
}

//  Adds the player sprite on tile p.
//  The player is drawn taller than a tile, standing on its tile and reaching into the one
//  above. Its position stays at the tile centre (so movement tweens are unchanged); the
//  origin shifts the frame up so its bottom edge (where the feet are) sits
//  feetAboveTileBottom pixels above the tile's bottom edge.
export function addPlayer (scene: Scene, p: GridPoint): GameObjects.Sprite
{
    const start = tileCenter(p);
    const frameHeight = PLAYER_FRAME_HEIGHT * PLAYER_SPRITE.pixelScale;
    const player = scene.add.sprite(start.x, start.y, 'player')
        .setScale(PLAYER_SPRITE.pixelScale)
        .setOrigin(0.5, 1 - (TILE_SIZE / 2 - PLAYER_SPRITE.feetAboveTileBottom) / frameHeight);
    ySortDepth(player);
    return player;
}

//  Builds a tilemap and entity sprites from parsed level data, and makes the camera follow the player.
//  Requires the 'tiles' and 'goal' textures from generateTextures(), and the 'player' spritesheet and
//  'boulder' image loaded in the Preloader.
export function buildLevel (scene: Scene, data: LevelData): BuiltLevel
{
    const map = scene.make.tilemap({
        //  Walls, snow and ice are drawn with the autotile frame that fits their neighbours;
        //  tall sets are left out here and drawn as images below
        data: autotileLevel(data.tiles, set => isTallSet(scene, set)),
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

    //  Tall autotile frames: one image per tile, standing on the bottom edge of its tile and
    //  rising over the tiles above it
    for (const set of AUTOTILE_SETS.filter(s => isTallSet(scene, s)))
    {
        data.tiles.forEach((row, y) => row.forEach((tile, x) =>
        {
            if (set.tiles.includes(tile))
            {
                addTallTile(scene, set, data.tiles, x, y);
            }
        }));
    }

    if (data.goal)
    {
        addGoal(scene, data.goal);
    }

    const boulders = data.boulders.map(b => addBoulder(scene, b));
    const player = addPlayer(scene, data.player);

    //  Keep the player centred on screen at all times (no bounds, no smoothing), so the
    //  level scrolls around them and space past the level's edges can show.
    const camera = scene.cameras.main;
    camera.setZoom(1);
    camera.startFollow(player, true);

    return { data, map, layer, player, boulders };
}
