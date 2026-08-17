import {
    Component,
    ElementRef,
    ViewChild,
    computed,
    effect,
    input,
    model,
    inject,
    OnDestroy,
    AfterViewInit,
    signal,
} from '@angular/core';
import {TranslocoPipe} from '@ngneat/transloco';
import {FocusTrap, FocusTrapFactory} from '@angular/cdk/a11y';

@Component({
    selector: 'lib-preview-file',
    imports: [
        TranslocoPipe,
    ],
    templateUrl: './preview-file.html',
    styleUrl: './preview-file.scss',
    standalone: true,
})
export class PreviewFile implements OnDestroy, AfterViewInit {
    public srcList = input<string[]>([]);
    public startIndex = input<number>(0);
    public title = input<string>('');
    public language = input<'en' | 'uk'>('en');
    public mobileMode = input<boolean>(false);
    public openerElement = input<HTMLElement | null>(null);
    public closeHandler = input<(() => unknown) | null>(null);
    public focusTrapFactory = inject(FocusTrapFactory);

    public activeIndex = model<number>(0);
    public viewReady = model<boolean>(false);
    public userNavigated = model<boolean>(false);
    public previousListLength = model<number>(0);
    public focusTrap: FocusTrap | null = null;

    @ViewChild('dialog') public dialogElement?: ElementRef<HTMLElement>;
    @ViewChild('closeButton') public closeButton?: ElementRef<HTMLButtonElement>;
    @ViewChild('viewport') public viewportElement?: ElementRef<HTMLElement>;
    @ViewChild('previewImage') public imageElement?: ElementRef<HTMLImageElement>;

    public readonly scale = signal(1);
    public readonly translateX = signal(0);
    public readonly translateY = signal(0);
    public readonly isZoomed = computed(() => this.scale() > 1);
    public readonly imageTransform = computed(
        () => `translate3d(${this.translateX()}px, ${this.translateY()}px, 0) scale(${this.scale()})`,
    );

    private readonly minScale = 1;
    private readonly desktopMaxScale = 4;
    private readonly mobileMaxScale = 5;

    private currentMaxScale(): number {
        return this.mobileMode() ? this.mobileMaxScale : this.desktopMaxScale;
    }
    private readonly doubleTapScale = 2.5;
    private readonly doubleTapMs = 280;
    private readonly doubleTapDistancePx = 24;
    private readonly activePointers = new Map<number, {clientX: number; clientY: number}>();
    private pinchStartDistance = 0;
    private pinchStartScale = 1;
    private pinchStartTranslateX = 0;
    private pinchStartTranslateY = 0;
    private pinchStartFocalX = 0;
    private pinchStartFocalY = 0;
    private panStartClientX = 0;
    private panStartClientY = 0;
    private panStartTranslateX = 0;
    private panStartTranslateY = 0;
    private lastTapTime = 0;
    private lastTapClientX = 0;
    private lastTapClientY = 0;
    private suppressImageClick = false;
    private gestureMoved = false;
    private readonly onTouchStartBound = (event: TouchEvent) => this.onViewportTouchStart(event);
    private readonly onTouchMoveBound = (event: TouchEvent) => this.onViewportTouchMove(event);
    private readonly onTouchEndBound = (event: TouchEvent) => this.onViewportTouchEnd(event);

    public currentSrc = computed(() => {
        const list = this.srcList();
        const index = this.activeIndex();

        return list[index] ?? '';
    });

    constructor() {
        effect(() => {
            const list = this.srcList();
            const initial = this.startIndex();
            const maxIndex = Math.max(0, list.length - 1);
            const currentIndex = this.activeIndex();
            const lengthChanged = this.previousListLength() !== list.length;

            if (!list.length) {
                this.activeIndex.set(0);
                this.userNavigated.set(false);
                this.previousListLength.set(0);
                return;
            }

            if (currentIndex > maxIndex) {
                this.activeIndex.set(maxIndex);
                this.previousListLength.set(list.length);
                return;
            }

            if (!this.userNavigated() || lengthChanged) {
                const nextIndex = Math.max(0, Math.min(initial, maxIndex));
                this.activeIndex.set(nextIndex);
            }

            this.previousListLength.set(list.length);

        });

        effect(() => {
            const isOpen = this.srcList().length > 0;
            const isReady = this.viewReady();

            if (!isReady) {
                return;
            }

            if (isOpen) {
                queueMicrotask(() => this.activateFocus());
                return;
            }

            this.destroyFocusTrap();
        });

        effect(() => {
            this.currentSrc();
            this.resetZoom();
        });
    }

    ngAfterViewInit() {
        this.viewReady.set(true);
        this.bindTouchZoomListeners();
    }

    ngOnDestroy() {
        this.unbindTouchZoomListeners();
        this.destroyFocusTrap();
    }

    requestClose() {
        const handler = this.closeHandler();
        if (handler) {
            handler();
        }

        this.restoreFocus();

        return this;
    }

    onKeyDown(event: KeyboardEvent) {
        if (event.key === 'Escape') {
            return this.requestClose();
        }
        if (event.key === 'ArrowRight') {
            return this.next();
        }
        if (event.key === 'ArrowLeft') {
            return this.prev();
        }
        return this;
    }

    prev() {
        const list = this.srcList();
        if (list.length < 2) {
            return this;
        }
        const nextIndex = (this.activeIndex() - 1 + list.length) % list.length;
        this.activeIndex.set(nextIndex);
        this.userNavigated.set(true);

        return this;
    }

    next() {
        const list = this.srcList();
        if (list.length < 2) {
            return this;
        }
        const nextIndex = (this.activeIndex() + 1) % list.length;
        this.activeIndex.set(nextIndex);
        this.userNavigated.set(true);

        return this;
    }

    onImageClick(event: MouseEvent): this {
        if (this.suppressImageClick || this.isZoomed() || this.isTouchPointer(event)) {
            this.suppressImageClick = false;
            event.preventDefault();
            event.stopPropagation();

            return this;
        }

        return this.next();
    }

    onViewportPointerDown(event: PointerEvent): this {
        if (event.pointerType === 'touch' && this.supportsTouchEvents()) {
            return this;
        }

        if (!this.isTouchPointer(event)) {
            return this;
        }

        event.preventDefault();
        this.capturePointer(event.pointerId);
        this.activePointers.set(event.pointerId, {clientX: event.clientX, clientY: event.clientY});
        this.gestureMoved = false;
        this.suppressImageClick = true;

        if (this.activePointers.size === 2) {
            this.suppressImageClick = true;
            this.beginPinch();
            return this;
        }

        if (this.activePointers.size === 1 && this.isZoomed()) {
            this.beginPan(event);
        }

        return this;
    }

    onViewportPointerMove(event: PointerEvent): this {
        if (!this.activePointers.has(event.pointerId)) {
            return this;
        }

        this.activePointers.set(event.pointerId, {clientX: event.clientX, clientY: event.clientY});

        if (this.activePointers.size >= 2) {
            this.gestureMoved = true;
            this.suppressImageClick = true;
            return this.updatePinch();
        }

        if (this.isZoomed()) {
            const distanceX = event.clientX - this.panStartClientX;
            const distanceY = event.clientY - this.panStartClientY;
            if (Math.hypot(distanceX, distanceY) > 2) {
                this.gestureMoved = true;
                this.suppressImageClick = true;
            }
            return this.updatePan(event);
        }

        return this;
    }

    onViewportPointerUp(event: PointerEvent): this {
        if (!this.activePointers.has(event.pointerId)) {
            return this;
        }

        const releasedPointer = this.activePointers.get(event.pointerId);
        this.activePointers.delete(event.pointerId);
        this.releasePointer(event.pointerId);

        if (this.activePointers.size >= 2) {
            this.beginPinch();
            return this;
        }

        if (this.activePointers.size === 1) {
            const remaining = this.getFirstPointer();
            if (remaining) {
                this.beginPanFromPoint(remaining.clientX, remaining.clientY);
            }
            return this;
        }

        if (
            releasedPointer
            && !this.gestureMoved
            && this.isTouchPointer(event)
        ) {
            this.handleDoubleTap(releasedPointer.clientX, releasedPointer.clientY);
        }

        this.gestureMoved = false;

        return this;
    }

    resetZoom(): this {
        this.scale.set(1);
        this.translateX.set(0);
        this.translateY.set(0);
        this.activePointers.clear();
        this.pinchStartDistance = 0;
        this.gestureMoved = false;

        return this;
    }

    select(index: number) {
        const list = this.srcList();
        if (!list.length) {
            return this;
        }

        const nextIndex = Math.max(0, Math.min(index, list.length - 1));
        this.activeIndex.set(nextIndex);
        this.userNavigated.set(true);

        return this;
    }

    activateFocus() {
        const dialog = this.dialogElement?.nativeElement;
        if (!dialog) {
            return this;
        }

        if (!this.focusTrap) {
            this.focusTrap = this.focusTrapFactory.create(dialog);
        }

        const closeButton = this.closeButton?.nativeElement;
        if (closeButton) {
            closeButton.focus();
            return this;
        }

        dialog.focus();
        return this;
    }

    destroyFocusTrap() {
        if (this.focusTrap) {
            this.focusTrap.destroy();
            this.focusTrap = null;
        }
        return this;
    }

    restoreFocus() {
        const opener = this.openerElement();
        if (opener) {
            queueMicrotask(() => opener.focus());
        }
        return this;
    }

    private isTouchPointer(event: Event): boolean {
        if (!(event instanceof PointerEvent)) {
            return false;
        }

        return event.pointerType === 'touch' || event.pointerType === 'pen';
    }

    private supportsTouchEvents(): boolean {
        return typeof window !== 'undefined' && 'ontouchstart' in window;
    }

    private bindTouchZoomListeners(): this {
        const viewport = this.viewportElement?.nativeElement;
        if (!viewport || !this.supportsTouchEvents()) {
            return this;
        }

        viewport.addEventListener('touchstart', this.onTouchStartBound, {passive: false});
        viewport.addEventListener('touchmove', this.onTouchMoveBound, {passive: false});
        viewport.addEventListener('touchend', this.onTouchEndBound, {passive: false});
        viewport.addEventListener('touchcancel', this.onTouchEndBound, {passive: false});

        return this;
    }

    private unbindTouchZoomListeners(): this {
        const viewport = this.viewportElement?.nativeElement;
        if (!viewport) {
            return this;
        }

        viewport.removeEventListener('touchstart', this.onTouchStartBound);
        viewport.removeEventListener('touchmove', this.onTouchMoveBound);
        viewport.removeEventListener('touchend', this.onTouchEndBound);
        viewport.removeEventListener('touchcancel', this.onTouchEndBound);

        return this;
    }

    onViewportTouchStart(event: TouchEvent): this {
        this.syncPointersFromTouches(event.touches);
        if (event.touches.length >= 2) {
            event.preventDefault();
            this.suppressImageClick = true;
            this.gestureMoved = true;

            return this.beginPinch();
        }

        if (event.touches.length === 1) {
            const touch = event.touches[0];
            this.gestureMoved = false;
            this.suppressImageClick = true;
            if (this.isZoomed()) {
                this.beginPanFromPoint(touch.clientX, touch.clientY);
            }
        }

        return this;
    }

    onViewportTouchMove(event: TouchEvent): this {
        this.syncPointersFromTouches(event.touches);
        if (event.touches.length >= 2) {
            event.preventDefault();
            this.gestureMoved = true;
            this.suppressImageClick = true;

            return this.updatePinch();
        }

        if (this.isZoomed() && event.touches.length === 1) {
            event.preventDefault();
            const touch = event.touches[0];
            const distanceX = touch.clientX - this.panStartClientX;
            const distanceY = touch.clientY - this.panStartClientY;
            if (Math.hypot(distanceX, distanceY) > 2) {
                this.gestureMoved = true;
                this.suppressImageClick = true;
            }

            return this.updatePanFromPoint(touch.clientX, touch.clientY);
        }

        return this;
    }

    onViewportTouchEnd(event: TouchEvent): this {
        const remainingTouches = event.touches;
        if (remainingTouches.length >= 2) {
            this.syncPointersFromTouches(remainingTouches);

            return this.beginPinch();
        }

        if (remainingTouches.length === 1) {
            this.syncPointersFromTouches(remainingTouches);
            const remaining = remainingTouches[0];
            this.beginPanFromPoint(remaining.clientX, remaining.clientY);

            return this;
        }

        const endedTouch = event.changedTouches[0];
        this.activePointers.clear();
        if (endedTouch && !this.gestureMoved) {
            this.handleDoubleTap(endedTouch.clientX, endedTouch.clientY);
        }

        this.gestureMoved = false;

        return this;
    }

    private syncPointersFromTouches(touches: TouchList): this {
        this.activePointers.clear();
        for (let index = 0; index < touches.length; index += 1) {
            const touch = touches.item(index);
            if (touch) {
                this.activePointers.set(touch.identifier, {
                    clientX: touch.clientX,
                    clientY: touch.clientY,
                });
            }
        }

        return this;
    }

    private capturePointer(pointerId: number): this {
        const viewport = this.viewportElement?.nativeElement;
        try {
            viewport?.setPointerCapture(pointerId);
        } catch {
        }

        return this;
    }

    private releasePointer(pointerId: number): this {
        const viewport = this.viewportElement?.nativeElement;
        try {
            viewport?.releasePointerCapture(pointerId);
        } catch {
        }

        return this;
    }

    private getFirstPointer(): {clientX: number; clientY: number} | null {
        for (const pointer of this.activePointers.values()) {
            return pointer;
        }

        return null;
    }

    private getPointerPair(): [{clientX: number; clientY: number}, {clientX: number; clientY: number}] | null {
        const pointers = [...this.activePointers.values()];
        if (pointers.length < 2) {
            return null;
        }

        return [pointers[0], pointers[1]];
    }

    private getPointerDistance(
        first: {clientX: number; clientY: number},
        second: {clientX: number; clientY: number},
    ): number {
        return Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY);
    }

    private getFocalPoint(clientX: number, clientY: number): {x: number; y: number} {
        const viewport = this.viewportElement?.nativeElement;
        if (!viewport) {
            return {x: 0, y: 0};
        }

        const rect = viewport.getBoundingClientRect();

        return {
            x: clientX - rect.left - rect.width / 2,
            y: clientY - rect.top - rect.height / 2,
        };
    }

    private beginPinch(): this {
        const pair = this.getPointerPair();
        if (!pair) {
            return this;
        }

        const [first, second] = pair;
        const distance = this.getPointerDistance(first, second);
        if (distance < 1) {
            return this;
        }

        const focal = this.getFocalPoint(
            (first.clientX + second.clientX) / 2,
            (first.clientY + second.clientY) / 2,
        );

        this.pinchStartDistance = distance;
        this.pinchStartScale = this.scale();
        this.pinchStartTranslateX = this.translateX();
        this.pinchStartTranslateY = this.translateY();
        this.pinchStartFocalX = focal.x;
        this.pinchStartFocalY = focal.y;

        return this;
    }

    private updatePinch(): this {
        const pair = this.getPointerPair();
        if (!pair || this.pinchStartDistance < 1) {
            return this;
        }

        const [first, second] = pair;
        const distance = this.getPointerDistance(first, second);
        const nextScale = this.pinchStartScale * (distance / this.pinchStartDistance);
        const focal = this.getFocalPoint(
            (first.clientX + second.clientX) / 2,
            (first.clientY + second.clientY) / 2,
        );
        const scaleRatio = nextScale / this.pinchStartScale;
        const nextX = focal.x - (this.pinchStartFocalX - this.pinchStartTranslateX) * scaleRatio;
        const nextY = focal.y - (this.pinchStartFocalY - this.pinchStartTranslateY) * scaleRatio;

        return this.applyZoom(nextScale, nextX, nextY);
    }

    private beginPan(event: PointerEvent): this {
        return this.beginPanFromPoint(event.clientX, event.clientY);
    }

    private beginPanFromPoint(clientX: number, clientY: number): this {
        this.panStartClientX = clientX;
        this.panStartClientY = clientY;
        this.panStartTranslateX = this.translateX();
        this.panStartTranslateY = this.translateY();

        return this;
    }

    private updatePan(event: PointerEvent): this {
        return this.updatePanFromPoint(event.clientX, event.clientY);
    }

    private updatePanFromPoint(clientX: number, clientY: number): this {
        const nextX = this.panStartTranslateX + (clientX - this.panStartClientX);
        const nextY = this.panStartTranslateY + (clientY - this.panStartClientY);

        return this.applyZoom(this.scale(), nextX, nextY);
    }

    private handleDoubleTap(clientX: number, clientY: number): this {
        const now = Date.now();
        const isDoubleTap =
            now - this.lastTapTime <= this.doubleTapMs
            && Math.hypot(clientX - this.lastTapClientX, clientY - this.lastTapClientY) <= this.doubleTapDistancePx;

        this.lastTapTime = now;
        this.lastTapClientX = clientX;
        this.lastTapClientY = clientY;

        if (!isDoubleTap) {
            return this;
        }

        this.suppressImageClick = true;
        this.lastTapTime = 0;

        if (this.isZoomed()) {
            return this.resetZoom();
        }

        const focal = this.getFocalPoint(clientX, clientY);
        const nextScale = this.doubleTapScale;

        return this.applyZoom(
            nextScale,
            focal.x * (1 - nextScale),
            focal.y * (1 - nextScale),
        );
    }

    private applyZoom(nextScale: number, nextX: number, nextY: number): this {
        const clampedScale = Math.min(this.currentMaxScale(), Math.max(this.minScale, nextScale));
        if (clampedScale <= 1.01) {
            this.scale.set(1);
            this.translateX.set(0);
            this.translateY.set(0);

            return this;
        }

        const clamped = this.clampTranslate(nextX, nextY, clampedScale);
        this.scale.set(clampedScale);
        this.translateX.set(clamped.translateX);
        this.translateY.set(clamped.translateY);

        return this;
    }

    private clampTranslate(
        nextX: number,
        nextY: number,
        nextScale: number,
    ): {translateX: number; translateY: number} {
        const viewport = this.viewportElement?.nativeElement;
        const image = this.imageElement?.nativeElement;
        if (!viewport || !image) {
            return {translateX: nextX, translateY: nextY};
        }

        const maxX = Math.max(0, (image.offsetWidth * nextScale - viewport.clientWidth) / 2);
        const maxY = Math.max(0, (image.offsetHeight * nextScale - viewport.clientHeight) / 2);

        return {
            translateX: Math.min(maxX, Math.max(-maxX, nextX)),
            translateY: Math.min(maxY, Math.max(-maxY, nextY)),
        };
    }
}
