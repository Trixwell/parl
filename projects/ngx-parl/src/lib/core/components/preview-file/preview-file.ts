import {Component, ElementRef, ViewChild, computed, effect, input, model, inject} from '@angular/core';
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
export class PreviewFile {
    public srcList = input<string[]>([]);
    public startIndex = input<number>(0);
    public title = input<string>('');
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
    }

    ngAfterViewInit() {
        this.viewReady.set(true);
        return this;
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
}
