//  All levels, in play order. To add a level, put its .txt file in public/assets/levels
//  and add an entry here. `key` is the text cache key; `file` is relative to public/assets.
export const LEVELS: readonly { key: string, file: string }[] = [
    { key: 'level-autotile', file: 'levels/autotile-test.txt' },
    { key: 'level-demo', file: 'levels/demo.txt' },
    { key: 'level-2', file: 'levels/level2.txt' },
];
