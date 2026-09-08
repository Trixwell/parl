export interface ParlMessageDraft {
    content: string;
    replyToId: number | null;
    savedAt: number;
    expiresAt: number;
}

const DRAFT_PREFIX = 'ngx-parl-draft:';

export function draftStorageKey(chatKey: string): string {
    return `${DRAFT_PREFIX}${chatKey || 'default'}`;
}

export function loadMessageDraft(chatKey: string, now = Date.now()): ParlMessageDraft | null {
    if (typeof localStorage === 'undefined') {
        return null;
    }

    try {
        const raw = localStorage.getItem(draftStorageKey(chatKey));
        if (!raw) {
            return null;
        }

        const parsed = JSON.parse(raw) as ParlMessageDraft;
        if (!parsed || typeof parsed.content !== 'string') {
            clearMessageDraft(chatKey);
            return null;
        }

        if (typeof parsed.expiresAt === 'number' && parsed.expiresAt <= now) {
            clearMessageDraft(chatKey);
            return null;
        }

        return {
            content: parsed.content,
            replyToId: typeof parsed.replyToId === 'number' ? parsed.replyToId : null,
            savedAt: typeof parsed.savedAt === 'number' ? parsed.savedAt : now,
            expiresAt: typeof parsed.expiresAt === 'number' ? parsed.expiresAt : now,
        };
    } catch {
        clearMessageDraft(chatKey);
        return null;
    }
}

export function saveMessageDraft(
    chatKey: string,
    content: string,
    replyToId: number | null,
    ttlMs: number,
    now = Date.now(),
): ParlMessageDraft | null {
    if (typeof localStorage === 'undefined') {
        return null;
    }

    const trimmed = content.trim();
    if (!trimmed && replyToId == null) {
        clearMessageDraft(chatKey);
        return null;
    }

    const draft: ParlMessageDraft = {
        content,
        replyToId,
        savedAt: now,
        expiresAt: now + Math.max(0, ttlMs),
    };

    try {
        localStorage.setItem(draftStorageKey(chatKey), JSON.stringify(draft));
        return draft;
    } catch {
        return null;
    }
}

export function clearMessageDraft(chatKey: string): void {
    if (typeof localStorage === 'undefined') {
        return;
    }

    try {
        localStorage.removeItem(draftStorageKey(chatKey));
    } catch {
        // ignore quota / private mode
    }
}
