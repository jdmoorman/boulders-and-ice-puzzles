export interface LevelInfo
{
    //  Text cache key
    key: string;
    //  Path relative to public/assets
    file: string;
}

export interface LevelPack
{
    name: string;
    levels: readonly LevelInfo[];
}

//  All level packs, in order, each with its levels in play order. To add a level, put its .txt
//  file in public/assets/levels and add an entry to its pack here.
export const LEVEL_PACKS: readonly LevelPack[] = [
    {
        name: 'Boulders',
        levels: [
            { key: 'level-boulders-1', file: 'levels/boulders/level1.txt' },
            { key: 'level-boulders-2', file: 'levels/boulders/level2.txt' },
            { key: 'level-boulders-3', file: 'levels/boulders/level3.txt' }
        ]
    },
    {
        name: 'Ice',
        levels: [
            { key: 'level-ice-1', file: 'levels/ice/level1.txt' },
            { key: 'level-ice-2', file: 'levels/ice/level2.txt' },
            { key: 'level-ice-3', file: 'levels/ice/level3.txt' }
        ]
    },
    {
        name: 'Traps',
        levels: [
            { key: 'level-traps-1', file: 'levels/traps/level1.txt' }
        ]
    },
    {
        name: 'Test',
        levels: [
            { key: 'level-test-demo', file: 'levels/test/demo.txt' },
            { key: 'level-test-autotile', file: 'levels/test/autotile-test.txt' },
            { key: 'stub1', file: 'levels/test/stub.txt' },
            { key: 'stub2', file: 'levels/test/stub.txt' },
            { key: 'stub3', file: 'levels/test/stub.txt' },
            { key: 'stub4', file: 'levels/test/stub.txt' },
            { key: 'stub5', file: 'levels/test/stub.txt' },
            { key: 'stub6', file: 'levels/test/stub.txt' },
            { key: 'stub7', file: 'levels/test/stub.txt' },
        ]
    }
];

//  Every level, pack by pack. A level's index here is how scenes refer to it.
export const LEVELS: readonly (LevelInfo & { pack: LevelPack, number: number })[] =
    LEVEL_PACKS.flatMap(pack => pack.levels.map((level, i) => ({ ...level, pack, number: i + 1 })));

//  Whether a level is the last in its pack, so there's no Next level after it
export function isLastInPack (index: number): boolean
{
    return LEVELS[index + 1]?.pack !== LEVELS[index].pack;
}
