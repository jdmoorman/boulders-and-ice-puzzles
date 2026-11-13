import { Boot } from './scenes/Boot';
import { Editor } from './scenes/Editor';
import { EditorHud } from './scenes/EditorHud';
import { Game as MainGame } from './scenes/Game';
import { LevelComplete } from './scenes/LevelComplete';
import { LevelSelect } from './scenes/LevelSelect';
import { MainMenu } from './scenes/MainMenu';
import { PauseMenu } from './scenes/PauseMenu';
import { AUTO, Game, GameObjects } from 'phaser';
import { Preloader } from './scenes/Preloader';

//  Pixel snapping, for every object in every scene.
//  Objects next to each other (wall images, tilemap tiles) share edges in world space. If some
//  of them snap to whole screen pixels and others don't, those edges can land a pixel apart and
//  show seams. Phaser's default mode, 'safeAuto', only snaps objects that aren't scaled, and the
//  camera's zoom counts as scaling, so at most zooms almost nothing snapped except what was set
//  up by hand. Here 'safeAuto' snaps scaled objects too whenever the camera has roundPixels on
//  (all cameras do; see roundPixels in the config below). Rotated objects are left alone, since
//  snapping makes them wobble. Objects given another mode keep Phaser's behaviour for it.
const phaserWillRoundVertices = GameObjects.GameObject.prototype.willRoundVertices;
GameObjects.GameObject.prototype.willRoundVertices = function (
    this: GameObjects.GameObject, camera: Phaser.Cameras.Scene2D.Camera, onlyTranslated: boolean
): boolean
{
    if (this.vertexRoundMode === 'safeAuto')
    {
        const rotation = (this as Partial<GameObjects.Components.Transform>).rotation ?? 0;
        return camera.roundPixels && (onlyTranslated || rotation === 0);
    }
    return phaserWillRoundVertices.call(this, camera, onlyTranslated);
};

//  Find out more information about the Game Config at:
//  https://docs.phaser.io/api-documentation/typedef/types-core#gameconfig
const config: Phaser.Types.Core.GameConfig = {
    type: AUTO,
    width: 1024,
    height: 768,
    parent: 'game-container',
    backgroundColor: '#141a22',
    //  Every camera snaps to whole screen pixels (see the willRoundVertices override above)
    roundPixels: true,
    scene: [
        Boot,
        Preloader,
        MainMenu,
        LevelSelect,
        MainGame,
        LevelComplete,
        PauseMenu,
        Editor,
        EditorHud
    ]
};

const StartGame = (parent: string) => {

    return new Game({ ...config, parent });

}

export default StartGame;
