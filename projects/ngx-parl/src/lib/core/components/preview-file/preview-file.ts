import {Component, HostListener, computed, effect, input, model} from '@angular/core';
import {TranslocoPipe} from '@ngneat/transloco';

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
    public closeHandler = input<(() => unknown) | null>(null);

    public activeIndex = model<number>(0);

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
            const nextIndex = Math.max(0, Math.min(initial, maxIndex));

            this.activeIndex.set(nextIndex);
        });
    }

    @HostListener('document:keydown.escape')
    public onEscape() {
        return this.requestClose();
    }

    @HostListener('document:keydown.arrowright')
    public onArrowRight() {
        return this.next();
    }

    @HostListener('document:keydown.arrowleft')
    public onArrowLeft() {
        return this.prev();
    }

    public requestClose() {
        const handler = this.closeHandler();
        if (handler) {
            handler();
        }

        return this;
    }

    public prev() {
        const list = this.srcList();
        if (list.length < 2) {
            return this;
        }
        const nextIndex = (this.activeIndex() - 1 + list.length) % list.length;
        this.activeIndex.set(nextIndex);

        return this;
    }

    public next() {
        const list = this.srcList();
        if (list.length < 2) {
            return this;
        }
        const nextIndex = (this.activeIndex() + 1) % list.length;
        this.activeIndex.set(nextIndex);

        return this;
    }

    public select(index: number) {
        const list = this.srcList();
        if (!list.length) {
            return this;
        }

        const nextIndex = Math.max(0, Math.min(index, list.length - 1));
        this.activeIndex.set(nextIndex);

        return this;
    }
}
