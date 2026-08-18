const KEYBOARD_OVERLAP_THRESHOLD_PX = 24;

interface NativeKeyboardOverlayWindow {
    nativeKeyboardOverlayHeight?: number;
}

interface VirtualKeyboardNavigator {
    virtualKeyboard?: {
        boundingRect?: { height?: number };
        addEventListener?: (type: string, listener: () => void) => void;
        removeEventListener?: (type: string, listener: () => void) => void;
    };
}

export function readKeyboardEventHeight(event: Event): number {
    const withDetail = event as Event & { detail?: unknown; keyboardHeight?: number };
    if (typeof withDetail.keyboardHeight === 'number') {
        return normalizeInset(withDetail.keyboardHeight);
    }

    const detail = withDetail.detail;
    if (typeof detail === 'number') {
        return normalizeInset(detail);
    }

    if (detail && typeof detail === 'object') {
        const record = detail as { keyboardHeight?: unknown; height?: unknown };
        const height = record.keyboardHeight ?? record.height;
        if (typeof height === 'number') {
            return normalizeInset(height);
        }
    }

    return 0;
}

export function measureVisualViewportOverlap(host?: HTMLElement | null): number {
    if (typeof window === 'undefined') {
        return 0;
    }

    const viewport = window.visualViewport;
    if (!viewport) {
        return 0;
    }

    const viewportBottom = viewport.offsetTop + viewport.height;
    if (host) {
        return normalizeInset(host.getBoundingClientRect().bottom - viewportBottom);
    }

    return normalizeInset(window.innerHeight - viewport.height - viewport.offsetTop);
}

export function readNativeOverlayHeight(): number {
    if (typeof window === 'undefined') {
        return 0;
    }

    const nativeWindow = window as NativeKeyboardOverlayWindow;
    const windowHeight = nativeWindow.nativeKeyboardOverlayHeight;

    return typeof windowHeight === 'number' ? normalizeInset(windowHeight) : 0;
}

export function readVirtualKeyboardHeight(): number {
    if (typeof navigator === 'undefined') {
        return 0;
    }

    const height = (navigator as VirtualKeyboardNavigator).virtualKeyboard?.boundingRect?.height;

    return typeof height === 'number' ? normalizeInset(height) : 0;
}

export function pickKeyboardOverlap(values: number[]): number {
    return values.reduce((highest, value) => Math.max(highest, normalizeInset(value)), 0);
}

function normalizeInset(value: number): number {
    if (!Number.isFinite(value)) {
        return 0;
    }

    const rounded = Math.max(0, Math.round(value));

    return rounded > KEYBOARD_OVERLAP_THRESHOLD_PX ? rounded : 0;
}
