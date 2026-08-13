import {provideHttpClient} from '@angular/common/http';
import {ComponentFixture, TestBed} from '@angular/core/testing';

import {provideNgxParl} from '../../../ngx-parl.providers';
import {PreviewFile} from './preview-file';

function createTouchEvent(type: string, touches: Touch[]): TouchEvent {
    const touchList = {
        length: touches.length,
        item: (index: number) => touches[index] ?? null,
    } as TouchList;

    return {
        type,
        touches: touchList,
        changedTouches: touchList,
        preventDefault: () => undefined,
    } as unknown as TouchEvent;
}

function touchPointer(
    type: string,
    pointerId: number,
    clientX: number,
    clientY: number,
): PointerEvent {
    return new PointerEvent(type, {
        pointerId,
        pointerType: 'pen',
        clientX,
        clientY,
        bubbles: true,
        cancelable: true,
    });
}

describe('PreviewFile', () => {
    let component: PreviewFile;
    let fixture: ComponentFixture<PreviewFile>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [PreviewFile],
            providers: [provideHttpClient(), provideNgxParl()],
        }).compileComponents();

        fixture = TestBed.createComponent(PreviewFile);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('srcList', ['a.png', 'b.png']);
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('zooms in with a pinch gesture', () => {
        component.onViewportPointerDown(touchPointer('pointerdown', 1, 100, 100));
        component.onViewportPointerDown(touchPointer('pointerdown', 2, 200, 100));
        component.onViewportPointerMove(touchPointer('pointermove', 2, 300, 100));

        expect(component.scale()).toBe(2);
        expect(component.isZoomed()).toBe(true);
    });

    it('clamps pinch zoom to the maximum scale', () => {
        component.onViewportPointerDown(touchPointer('pointerdown', 1, 100, 100));
        component.onViewportPointerDown(touchPointer('pointerdown', 2, 140, 100));
        component.onViewportPointerMove(touchPointer('pointermove', 2, 400, 100));

        expect(component.scale()).toBe(4);
    });

    it('zooms in on double-tap and resets on the next double-tap', () => {
        component.onViewportPointerDown(touchPointer('pointerdown', 1, 50, 50));
        component.onViewportPointerUp(touchPointer('pointerup', 1, 50, 50));
        component.onViewportPointerDown(touchPointer('pointerdown', 1, 50, 50));
        component.onViewportPointerUp(touchPointer('pointerup', 1, 50, 50));

        expect(component.scale()).toBe(2.5);

        component.onViewportPointerDown(touchPointer('pointerdown', 1, 50, 50));
        component.onViewportPointerUp(touchPointer('pointerup', 1, 50, 50));
        component.onViewportPointerDown(touchPointer('pointerdown', 1, 50, 50));
        component.onViewportPointerUp(touchPointer('pointerup', 1, 50, 50));

        expect(component.scale()).toBe(1);
        expect(component.isZoomed()).toBe(false);
    });

    it('resets zoom when switching images', () => {
        component.onViewportPointerDown(touchPointer('pointerdown', 1, 50, 50));
        component.onViewportPointerUp(touchPointer('pointerup', 1, 50, 50));
        component.onViewportPointerDown(touchPointer('pointerdown', 1, 50, 50));
        component.onViewportPointerUp(touchPointer('pointerup', 1, 50, 50));
        expect(component.scale()).toBe(2.5);

        component.next();
        fixture.detectChanges();

        expect(component.scale()).toBe(1);
        expect(component.translateX()).toBe(0);
        expect(component.translateY()).toBe(0);
    });

    it('keeps mouse click-to-next when the image is not zoomed', () => {
        const click = new MouseEvent('click', {bubbles: true, cancelable: true});
        component.onImageClick(click);

        expect(component.activeIndex()).toBe(1);
    });

    it('zooms in with an iOS/Android touch pinch', () => {
        const first = {identifier: 1, clientX: 100, clientY: 100} as Touch;
        const secondStart = {identifier: 2, clientX: 200, clientY: 100} as Touch;
        const secondMoved = {identifier: 2, clientX: 300, clientY: 100} as Touch;

        component.onViewportTouchStart(createTouchEvent('touchstart', [first, secondStart]));
        component.onViewportTouchMove(createTouchEvent('touchmove', [first, secondMoved]));

        expect(component.scale()).toBe(2);
        expect(component.isZoomed()).toBe(true);
    });
});
