import { Scene, GameObjects } from 'phaser';

export const TEXT_STYLE = {
    fontFamily: 'Arial Black', color: '#ffffff',
    stroke: '#000000', strokeThickness: 6,
    align: 'center'
};

export interface ButtonSize
{
    width?: number;
    height?: number;
}

const FILL = 0x3d6fa8;
const FILL_HOVER = 0x5a8fcc;

//  Adds a clickable rectangle button with a centered label and a hover highlight.
export function addButton (
    scene: Scene,
    x: number,
    y: number,
    label: string,
    onClick: () => void,
    { width = 200, height = 64 }: ButtonSize = {}
): GameObjects.Rectangle
{
    const button = scene.add.rectangle(x, y, width, height, FILL)
        .setStrokeStyle(3, 0x000000)
        .setInteractive({ useHandCursor: true });

    scene.add.text(x, y, label, { ...TEXT_STYLE, fontSize: 28 }).setOrigin(0.5);

    button.on('pointerover', () => button.setFillStyle(FILL_HOVER));
    button.on('pointerout', () => button.setFillStyle(FILL));
    button.on('pointerup', onClick);

    return button;
}
