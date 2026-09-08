import data from '@emoji-mart/data';
import i18nRu from '@emoji-mart/data/i18n/ru.json';
import {init, Picker} from 'emoji-mart';

/**
 * Use native glyphs so the picker works without a spritesheet CDN.
 * Apple spritesheets need a reachable image URL; when that fails, emoji-mart
 * renders the blue "#" placeholders seen in the UI.
 */
export const EMOJI_MART_SET = 'native' as const;
export const EMOJI_MART_LOCALE = 'ru' as const;

let emojiMartInitPromise: Promise<void> | null = null;

export interface EmojiMartSelection {
    native?: string;
    id?: string;
    unified?: string;
}

export interface CreateEmojiMartPickerOptions {
    theme: 'light' | 'dark';
    onEmojiSelect: (emoji: EmojiMartSelection) => void;
    navPosition?: 'top' | 'bottom' | 'none';
    skinTonePosition?: 'preview' | 'search' | 'none';
    emojiSize?: number;
    maxFrequentRows?: number;
}

export function ensureEmojiMartReady(): Promise<void> {
    if (!emojiMartInitPromise) {
        emojiMartInitPromise = init({data}).then(() => undefined);
    }

    return emojiMartInitPromise;
}

export async function createEmojiMartPicker(
    options: CreateEmojiMartPickerOptions,
): Promise<HTMLElement> {
    await ensureEmojiMartReady();

    return new Picker({
        data,
        i18n: i18nRu,
        theme: options.theme,
        set: EMOJI_MART_SET,
        locale: EMOJI_MART_LOCALE,
        previewPosition: 'none',
        skinTonePosition: options.skinTonePosition ?? 'search',
        navPosition: options.navPosition ?? 'bottom',
        searchPosition: 'sticky',
        dynamicWidth: true,
        emojiButtonSize: 36,
        emojiSize: options.emojiSize ?? 22,
        maxFrequentRows: options.maxFrequentRows ?? 2,
        autoFocus: false,
        onEmojiSelect: options.onEmojiSelect,
    }) as unknown as HTMLElement;
}

/** @deprecated Use createEmojiMartPicker */
export async function createAppleEmojiPicker(
    options: CreateEmojiMartPickerOptions,
): Promise<HTMLElement> {
    return createEmojiMartPicker(options);
}
