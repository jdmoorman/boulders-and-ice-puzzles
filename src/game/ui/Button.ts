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

const LABEL_KEY = 'label';

//  The text label of a button made by addButton, e.g. to move or restyle it with the button
export function buttonLabel (button: GameObjects.Rectangle): GameObjects.Text
{
    return button.getData(LABEL_KEY) as GameObjects.Text;
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

    const text = scene.add.text(x, y, label, { ...TEXT_STYLE, fontSize: 28 }).setOrigin(0.5);
    //  Destroying the button takes its label with it
    button.once(GameObjects.Events.DESTROY, () => text.destroy());
    button.setData(LABEL_KEY, text);

    button.on('pointerover', () => button.setFillStyle(FILL_HOVER));
    button.on('pointerout', () => button.setFillStyle(FILL));
    button.on('pointerup', onClick);

    return button;
}

//  One layer of an icon button's picture: a texture and, optionally, a frame of it
export interface ButtonIcon
{
    key: string;
    frame?: string | number;
    //  Draw at this scale instead of scaling to fit the button
    scale?: number;
}

export const ICON_INSET = 8;

//  Adds a clickable rectangle button showing images instead of a label. The icons are drawn in
//  order, each scaled to fit inside the button without stretching.
export function addIconButton (
    scene: Scene,
    x: number,
    y: number,
    icons: readonly ButtonIcon[],
    onClick: () => void,
    { width = 64, height = 64 }: ButtonSize = {}
): GameObjects.Rectangle
{
    const button = scene.add.rectangle(x, y, width, height, FILL)
        .setStrokeStyle(3, 0x000000)
        .setInteractive({ useHandCursor: true });

    const images = icons.map(({ key, frame, scale }) =>
    {
        const image = scene.add.image(x, y, key, frame);
        const fit = Math.min((width - ICON_INSET * 2) / image.width, (height - ICON_INSET * 2) / image.height);
        return image.setScale(scale ?? fit);
    });
    button.once(GameObjects.Events.DESTROY, () => images.forEach(image => image.destroy()));

    button.on('pointerover', () => button.setFillStyle(FILL_HOVER));
    button.on('pointerout', () => button.setFillStyle(FILL));
    button.on('pointerup', onClick);

    return button;
}
