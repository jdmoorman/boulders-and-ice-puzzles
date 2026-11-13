import { Scene, Textures } from 'phaser';
import { parseLevel } from './LevelParser';
import { LevelInfo } from './levelList';
import { TILE_SIZE } from './Tiles';
import { AUTOTILE_SETS, autotileFrame, displayTileIndex, isTallSet } from './autotile';
import { PLAYER_FRAME_HEIGHT, PLAYER_FRAME_WIDTH } from '../playerAnimations';
import { PLAYER_SPRITE } from '../settings';
import { PLATE_ART_TILE_SIZE, PLATE_DROP, PLATE_FRAME_HEIGHT, PLATE_FRAME_WIDTH, PLATE_UP_FRAME } from '../plates';

//  Pixels per tile of the art itself; thumbnails with smaller tiles shrink it
const ART_TILE_SIZE = 16;
//  The standing, facing-down player frame
const PLAYER_FRAME = 1;

type Source = CanvasImageSource;

//  Returns the key of a texture picturing a level, drawn with the game's own art in the same
//  order as LevelLoader, at the largest whole number of pixels per tile that fits in
//  maxWidth x maxHeight. It's meant to be shown at scale 1. The texture is made on first use
//  and reused after.
export function levelThumbnail (scene: Scene, level: LevelInfo, maxWidth: number, maxHeight: number): string
{
    const key = `thumb-${level.key}-${maxWidth}x${maxHeight}`;
    if (scene.textures.exists(key))
    {
        return key;
    }

    const data = parseLevel(scene.cache.text.get(level.key));
    const { tiles } = data;
    const isTall = (set: typeof AUTOTILE_SETS[number]) => isTallSet(scene, set);
    const tallSets = AUTOTILE_SETS.filter(isTall);
    const textureFrame = (textureKey: string, frame?: string | number) => scene.textures.get(textureKey).get(frame);
    const source = (textureKey: string) => scene.textures.get(textureKey).getSourceImage() as Source;

    //  Tall walls and the player reach above their tiles; leave room for them above the top row.
    //  Measured in tiles, since the tile size depends on it.
    const wallRise = Math.max(0, ...tallSets.map(set =>
    {
        const f = textureFrame(set.texture, 0);
        return f.cutHeight / f.cutWidth - 1;
    }));
    const playerHeightTiles = PLAYER_FRAME_HEIGHT * PLAYER_SPRITE.pixelScale / TILE_SIZE;
    const playerFeetTiles = PLAYER_SPRITE.feetAboveTileBottom / TILE_SIZE;
    const rise = Math.max(wallRise, playerHeightTiles + playerFeetTiles - 1, 0);

    //  Whole pixels per tile, so every tile is the same size
    const T = Math.max(1, Math.floor(Math.min(maxWidth / data.width, maxHeight / (data.height + rise))));
    const scale = T / TILE_SIZE;
    const top = Math.ceil(rise * T);
    const playerHeight = playerHeightTiles * T;
    const playerFeet = playerFeetTiles * T;

    const texture = scene.textures.createCanvas(key, data.width * T, data.height * T + top);
    if (!texture)
    {
        throw new Error(`Could not create canvas texture '${key}'`);
    }
    const ctx = texture.context;
    //  Sharp pixels when enlarging the art; smooth when shrinking it, so small tiles stay legible
    const shrinking = T < ART_TILE_SIZE;
    ctx.imageSmoothingEnabled = shrinking;

    const drawFrame = (textureKey: string, frame: string | number | undefined, x: number, y: number, w: number, h: number) =>
    {
        const f = textureFrame(textureKey, frame);
        ctx.drawImage(source(textureKey), f.cutX, f.cutY, f.cutWidth, f.cutHeight, x, y, w, h);
    };

    //  Terrain (the tilemap), then the exit ring and raised pressure plates: all under everything else
    const strip = source('tiles');
    tiles.forEach((row, y) => row.forEach((_tile, x) =>
    {
        const index = displayTileIndex(tiles, x, y, isTall);
        if (index >= 0)
        {
            ctx.drawImage(strip, index * TILE_SIZE, 0, TILE_SIZE, TILE_SIZE, x * T, top + y * T, T, T);
        }
    }));
    if (data.goal)
    {
        ctx.drawImage(source('goal'), data.goal.x * T, top + data.goal.y * T, T, T);
    }
    const plateWidth = T * PLATE_FRAME_WIDTH / PLATE_ART_TILE_SIZE;
    const plateHeight = T * PLATE_FRAME_HEIGHT / PLATE_ART_TILE_SIZE;
    for (const p of data.plates)
    {
        drawFrame('plate-press', PLATE_UP_FRAME, p.x * T + (T - plateWidth) / 2, top + (p.y + 1) * T + PLATE_DROP * scale - plateHeight,
            plateWidth, plateHeight);
    }

    //  Then row by row, so things further down cover the tall walls behind them
    const boulders = new Set(data.boulders.map(b => `${b.x},${b.y}`));
    tiles.forEach((row, y) =>
    {
        const bottom = top + (y + 1) * T;
        row.forEach((tile, x) =>
        {
            const set = tallSets.find(s => s.tiles.includes(tile));
            if (set)
            {
                const frame = autotileFrame(tiles, x, y, set);
                const f = textureFrame(set.texture, frame);
                const h = T * f.cutHeight / f.cutWidth;
                drawFrame(set.texture, frame, x * T, bottom - h, T, h);
            }
            if (boulders.has(`${x},${y}`))
            {
                ctx.drawImage(source('boulder'), x * T, bottom - T, T, T);
            }
        });

        if (data.player.y === y)
        {
            const w = PLAYER_FRAME_WIDTH * PLAYER_SPRITE.pixelScale * scale;
            const left = data.player.x * T + (T - w) / 2;
            drawFrame('player', PLAYER_FRAME, left, bottom - playerFeet - playerHeight, w, playerHeight);
        }
    });

    texture.refresh();
    texture.setFilter(shrinking ? Textures.FilterMode.LINEAR : Textures.FilterMode.NEAREST);
    return key;
}
