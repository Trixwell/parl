import {
    measureVisualViewportOverlap,
    pickKeyboardOverlap,
    readKeyboardEventHeight,
    readNativeOverlayHeight,
    readVirtualKeyboardHeight,
} from './keyboard-overlap';

describe('keyboard overlap helpers', () => {
    it('reads keyboard height from Capacitor, Ionic, and overlay events', () => {
        expect(readKeyboardEventHeight(new CustomEvent('keyboardDidShow', {
            detail: {keyboardHeight: 320},
        }))).toBe(320);
        expect(readKeyboardEventHeight(new CustomEvent('ionKeyboardDidShow', {
            detail: {keyboardHeight: 280},
        }))).toBe(280);
        expect(readKeyboardEventHeight(new CustomEvent('nativekeyboardoverlay', {
            detail: {height: 260},
        }))).toBe(260);
        expect(readKeyboardEventHeight(new CustomEvent('keyboardDidShow', {detail: 16}))).toBe(0);
    });

    it('measures how far a host element sits below the visual viewport', () => {
        const originalViewport = window.visualViewport;
        const host = document.createElement('div');
        spyOn(host, 'getBoundingClientRect').and.returnValue({
            bottom: 800,
        } as DOMRect);
        Object.defineProperty(window, 'visualViewport', {
            configurable: true,
            value: {offsetTop: 0, height: 500},
        });

        expect(measureVisualViewportOverlap(host)).toBe(300);

        Object.defineProperty(window, 'visualViewport', {
            configurable: true,
            value: originalViewport,
        });
    });

    it('picks the largest reported overlay and ignores native chrome jitter', () => {
        expect(pickKeyboardOverlap([0, 12, 240, 180])).toBe(240);
        expect(readNativeOverlayHeight()).toBe(0);
        expect(readVirtualKeyboardHeight()).toBe(0);
    });
});
