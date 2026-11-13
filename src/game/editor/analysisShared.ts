import type { Direction } from '../movement/Movement';

//  Shared by the analysis worker and the editor. Kept apart from the worker module so the editor
//  can import these without loading the worker's code on the main thread.

//  The search gives up after this many positions, so a huge map can't use up all memory
export const MAX_STATES = 1_000_000;

//  Moves are sent as strings of these letters, one per move
export const DIRECTION_LETTERS: Readonly<Record<Direction, string>> = { up: 'U', down: 'D', left: 'L', right: 'R' };
export const LETTER_DIRECTIONS: Readonly<Record<string, Direction>> = { U: 'up', D: 'down', L: 'left', R: 'right' };

//  A tile the search reached, with the cheapest move sequence that gets the player there
export interface FoundTile
{
    x: number;
    y: number;
    //  Every arrow-key press, one letter each
    moves: string;
    //  The number of moves, not counting steps from snow to snow (walking on snow is free)
    cost: number;
}

//  Sent by the worker as the search goes, and once more when it ends
export interface AnalysisMessage
{
    //  Positions (player cell plus boulder cells) discovered so far
    states: number;
    //  Cost (see FoundTile) of the positions being explored
    depth: number;
    //  Tiles reached so far, out of the tiles that could possibly be reached
    found: number;
    possible: number;
    //  Tiles reached since the last message
    tiles: FoundTile[];
    done: boolean;
    //  When done: false if the search stopped at MAX_STATES, so some tiles may be missing
    complete: boolean;
}
