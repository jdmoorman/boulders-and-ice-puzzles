//  The editor's options, changed in the HUD's Options popup and remembered in localStorage across
//  visits and reloads. Storage can be unavailable (private windows, blocked site data), in which
//  case the defaults are used and changes last until the page is closed.
export interface EditorSettings
{
    //  Analysis: steps from snow to snow cost nothing, so move counts show only the moves that
    //  matter (onto ice, slides and pushes). Off counts every step.
    freeSnowWalking: boolean;
}

export const DEFAULT_EDITOR_SETTINGS: Readonly<EditorSettings> = {
    freeSnowWalking: true
};

const SETTINGS_KEY = 'bouldersAndIce.editorSettings';

export function loadEditorSettings (): EditorSettings
{
    const settings = { ...DEFAULT_EDITOR_SETTINGS };
    try
    {
        const saved: unknown = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}');
        if (saved && typeof saved === 'object')
        {
            //  Keep only known settings of the right type, so an old or edited value can't break anything
            for (const key of Object.keys(settings) as (keyof EditorSettings)[])
            {
                const value = (saved as Record<string, unknown>)[key];
                if (typeof value === typeof settings[key])
                {
                    settings[key] = value as EditorSettings[typeof key];
                }
            }
        }
    }
    catch
    {
        //  Unreadable or unavailable; use the defaults
    }
    return settings;
}

export function saveEditorSettings (settings: EditorSettings): void
{
    try
    {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    }
    catch
    {
        //  Can't save; the settings last until the page is closed
    }
}
