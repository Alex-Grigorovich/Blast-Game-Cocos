/**
 * Глобальные настройки звука (музыка, эффекты, общий mute).
 * Сохраняются в localStorage. Используются сценой Option и игрой (BlastGame).
 */
const KEY_MUSIC = 'blast_music_volume';
const KEY_SOUND = 'blast_sound_volume';
const KEY_MUTED = 'blast_muted';
const DEFAULT_MUSIC = 0.6;
const DEFAULT_SOUND = 1;
const DEFAULT_MUTED = false;

function getStorage(): Storage | null {
    if (typeof cc !== 'undefined' && cc.sys && cc.sys.localStorage) return cc.sys.localStorage as Storage;
    if (typeof localStorage !== 'undefined') return localStorage;
    return null;
}

function parseFloatSafe(s: string | null, def: number): number {
    if (s == null || s === '') return def;
    const n = parseFloat(s);
    return isNaN(n) ? def : Math.max(0, Math.min(1, n));
}

export const GameSettings = {
    getMusicVolume(): number {
        const s = getStorage();
        return s ? parseFloatSafe(s.getItem(KEY_MUSIC), DEFAULT_MUSIC) : DEFAULT_MUSIC;
    },

    setMusicVolume(value: number): void {
        const s = getStorage();
        if (s) s.setItem(KEY_MUSIC, String(Math.max(0, Math.min(1, value))));
    },

    getSoundVolume(): number {
        const s = getStorage();
        return s ? parseFloatSafe(s.getItem(KEY_SOUND), DEFAULT_SOUND) : DEFAULT_SOUND;
    },

    setSoundVolume(value: number): void {
        const s = getStorage();
        if (s) s.setItem(KEY_SOUND, String(Math.max(0, Math.min(1, value))));
    },

    isMuted(): boolean {
        const s = getStorage();
        if (!s) return DEFAULT_MUTED;
        const v = s.getItem(KEY_MUTED);
        return v === '1' || v === 'true';
    },

    setMuted(muted: boolean): void {
        const s = getStorage();
        if (s) s.setItem(KEY_MUTED, muted ? '1' : '0');
    },
};
