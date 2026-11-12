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
        name: 'Test',
        levels: [
            { key: 'level-test-demo', file: 'levels/test/demo.txt' },
            { key: 'level-test-autotile', file: 'levels/test/autotile-test.txt' }
        ]
    },
    {
        name: 'Boulders',
        levels: [
            { key: 'level-boulders-1', file: 'levels/boulders-only/level1.txt' },
            { key: 'level-boulders-2', file: 'levels/boulders-only/level2.txt' },
            { key: 'level-boulders-3', file: 'levels/boulders-only/level3.txt' }
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
