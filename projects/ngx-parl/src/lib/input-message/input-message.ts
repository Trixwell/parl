import {
    AfterViewInit, ChangeDetectionStrategy,
    Component,
    computed,
    ElementRef, model,
    OnDestroy,
    signal,
    ViewChild
} from '@angular/core';
import {MatIcon, MatIconRegistry} from '@angular/material/icon';
import {DomSanitizer} from '@angular/platform-browser';
import {FileType, PreviewItem} from '../core/entity/file';
import {TranslocoPipe} from '@ngneat/transloco';


@Component({
    selector: 'app-input-message',
    imports: [MatIcon, TranslocoPipe],
    templateUrl: './input-message.html',
    styleUrl: './input-message.scss',
    standalone: true,
})

export class InputMessageComponent implements AfterViewInit, OnDestroy {
    @ViewChild('inputText', {static: false})
    public inputTextElement!: ElementRef<HTMLDivElement>;

    @ViewChild('mirror', {static: false})
    public mirrorElement!: ElementRef<HTMLDivElement>;

    /** Публічні сигнали */
    public input_text = model<string>('');     // останній відправлений текст (output-модель)
    public draft = signal<string>('');         // поточний чорновик
    public focused = signal<boolean>(false);
    public sending = signal<boolean>(false);
    public hasText = computed(() => this.draft().trim().length > 0);

    /** Внутрішні поля для стабільного autoresize */
    private lastHeightPx = 0;
    private lastRows = 1;
    private resizeRaf: number | null = null;

    /** Файлы + превью (всегда статичные) */
    public files = model<File[]>([]);
    public previews = model<PreviewItem[]>([]);

    constructor(
        private iconRegistry: MatIconRegistry,
        private sanitizer: DomSanitizer
    ) {
        this.iconRegistry.addSvgIcon(
            'attach-filled',
            this.sanitizer.bypassSecurityTrustResourceUrl('../../assets/icons/attach-filled.svg')
        );
        this.iconRegistry.addSvgIcon(
            'send',
            this.sanitizer.bypassSecurityTrustResourceUrl('.../../assets/icons/send.svg')
        );
        this.iconRegistry.addSvgIcon(
            'remove',
            this.sanitizer.bypassSecurityTrustResourceUrl('../../assets/icons/remove-badge.svg')
        );
        this.iconRegistry.addSvgIcon(
            'play',
            this.sanitizer.bypassSecurityTrustResourceUrl('../../assets/icons/play.svg')
        );
        this.iconRegistry.addSvgIcon(
            'file',
            this.sanitizer.bypassSecurityTrustResourceUrl('../../assets/icons/file.svg')
        );
    }

    ngAfterViewInit() {
        const elemInput = this.inputTextElement.nativeElement;
        elemInput.style.transition = 'height 160ms ease';

        this.initMirror();

        const computedStyle = getComputedStyle(elemInput);
        const lineHeight = this.cssNum(computedStyle.lineHeight, 24);

        elemInput.style.height = `${lineHeight}px`;
        this.lastHeightPx = lineHeight;
        this.lastRows = 1;
        this.updateOverflow(1);

        requestAnimationFrame(() => {
            const {rows, nextHeightPx} = this.measureByMirror();
            elemInput.style.height = `${nextHeightPx}px`;
            this.lastRows = rows;
            this.lastHeightPx = nextHeightPx;
            this.updateOverflow(rows);
        });
    }

    ngOnDestroy() {
        if (this.resizeRaf) {
            cancelAnimationFrame(this.resizeRaf);
            this.resizeRaf = null;
        }
    }


    inputFileChange(event: Event) {
        const input = event.target as HTMLInputElement;
        const selectedFiles = input.files;

        if (selectedFiles?.length) {
            const list = Array.from(selectedFiles);
            this.appendFiles(list).then(() => {
                input.value = '';
            });
        } else {
            input.value = '';
        }

        return this;
    }

    private async appendFiles(list: File[]) {
        const newFiles = [...(this.files() ?? []), ...list];
        this.files.set(newFiles);

        for (const file of list) {
            const item = await this.fileToStaticPreview(file);
            if (item) {
                const previewItems = [...this.previews()];
                previewItems.push(item);
                this.previews.set(previewItems);
            }
        }

        return this;
    }

    private async fileToStaticPreview(file: File): Promise<PreviewItem | null> {
        const type = file.type || '';
        const isGif = type === 'image/gif';
        const isImage = type.startsWith('image/') && !isGif;
        const isVideo = type.startsWith('video/');

        try {
            if (isImage) {
                const src = await this.readFileAsDataURL(file);
                return {src, originalKind: 'image', name: file.name, type, size: file.size};
            }

            if (isGif) {
                const bitmap = await createImageBitmap(file);
                const dataUrl = this.imageBitmapToPngDataURL(bitmap);
                bitmap.close();
                return {src: dataUrl, originalKind: 'gif', name: file.name, type, size: file.size};
            }

            if (isVideo) {
                const {dataUrl, duration} = await this.captureVideoFrameAsPng(file);
                return {src: dataUrl, originalKind: 'video', name: file.name, type, size: file.size, duration};
            }

            const fallback = await this.readFileAsDataURL(file).catch(() => '');
            return {src: fallback, originalKind: 'image', name: file.name, type, size: file.size};
        } catch {
            return null;
        }
    }

    private readFileAsDataURL(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve((e.target?.result as string) || '');
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    private imageBitmapToPngDataURL(bitmap: ImageBitmap): string {
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const context = canvas.getContext('2d')!;
        context.drawImage(bitmap, 0, 0);

        return canvas.toDataURL('image/png');
    }

    private captureVideoFrameAsPng(file: File): Promise<{ dataUrl: string; duration?: number }> {
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(file);
            const video = document.createElement('video');
            video.preload = 'metadata';
            video.muted = true;
            video.src = url;

            const cleanup = () => {
                URL.revokeObjectURL(url);
                video.src = '';
                video.remove();
            };

            const drawFrame = () => {
                try {
                    const canvas = document.createElement('canvas');
                    const videoWidth = video.videoWidth || 320;
                    const videoHeight = video.videoHeight || 240;
                    canvas.width = videoWidth;
                    canvas.height = videoHeight;
                    const ctx = canvas.getContext('2d')!;
                    ctx.drawImage(video, 0, 0, videoWidth, videoHeight);
                    const dataUrl = canvas.toDataURL('image/png');
                    const duration = Number.isFinite(video.duration) ? Math.max(0, video.duration) : undefined;
                    cleanup();
                    resolve({dataUrl, duration});
                } catch (e) {
                    cleanup();
                    reject(e);
                }
            };

            const onLoaded = () => {
                if (video.readyState >= 2) {
                    const target = Math.min(0.1, (isFinite(video.duration) ? video.duration : 1) - 0.01);
                    video.currentTime = Math.max(0, target);
                } else {
                    video.load();
                }
            };

            const onSeeked = () => drawFrame();
            const onError = (e: any) => {
                cleanup();
                reject(e);
            };

            video.addEventListener('loadedmetadata', onLoaded, {once: true});
            video.addEventListener('seeked', onSeeked, {once: true});
            video.addEventListener('error', onError, {once: true});
        });
    }

    removeFile(index: number, event?: MouseEvent) {
        event?.stopPropagation();
        event?.preventDefault();

        const prevs = [...this.previews()];
        prevs.splice(index, 1);
        this.previews.set(prevs);

        const filesArr = [...(this.files() ?? [])];
        if (index >= 0 && index < filesArr.length) {
            filesArr.splice(index, 1);
            this.files.set(filesArr);
        }
    }

    openPreview(item: PreviewItem, index: number) {
        // Здесь можно открыть модалку/лайтбокс
        return this;
    }

    formatDuration(sec?: number): string {
        if (!sec || !Number.isFinite(sec)) {
            return '';
        }

        const seconds = Math.floor(sec % 60).toString().padStart(2, '0');
        const minutes = Math.floor((sec / 60) % 60).toString();
        const hours = Math.floor(sec / 3600);
        return hours > 0 ? `${hours}:${minutes.padStart(2, '0')}:${seconds}` : `${minutes}:${seconds}`;
    }

    attachFilled() {
        return this;
    }

    enterDown() {
        const elemInput = this.inputTextElement.nativeElement;
        const textInput = this.draft().trim();
        if (!textInput) {
            return this;
        }

        this.sending.set(true);
        this.input_text.set(textInput);

        this.draft.set('');
        elemInput.innerHTML = '';
        elemInput.focus();

        this.autoResizeByRows();

        setTimeout(() => this.sending.set(false), 200);

        return this;
    }

    onFocus() {
        const elemInput = this.inputTextElement.nativeElement;
        if (elemInput.innerHTML === '<br>') {
            elemInput.innerHTML = '';
        }
        this.focused.set(true);

        return this;
    }

    onBlur() {
        this.focused.set(false);

        return this;
    }

    onKeyDown(event: KeyboardEvent) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            this.enterDown();
            return this;
        }
        queueMicrotask(() => this.autoResizeByRows());

        return this;
    }

    onInput() {
        const textInput = this.inputTextElement.nativeElement.innerText ?? '';
        this.draft.set(textInput);
        this.autoResizeByRows();

        return this;
    }

    onPaste() {
        queueMicrotask(() => {
            const textInput = this.inputTextElement.nativeElement.innerText ?? '';
            this.draft.set(textInput);
            this.autoResizeByRows();
        });

        return this;
    }

    private autoResizeByRows() {
        const elemInput = this.inputTextElement.nativeElement;
        const {rows, nextHeightPx} = this.measureByMirror();

        if (rows === this.lastRows) {
            this.updateOverflow(rows);
            return this;
        }

        if (this.resizeRaf) cancelAnimationFrame(this.resizeRaf);
        elemInput.style.height = `${this.lastHeightPx}px`;

        this.resizeRaf = requestAnimationFrame(() => {
            elemInput.style.height = `${nextHeightPx}px`;
            this.lastHeightPx = nextHeightPx;
            this.lastRows = rows;
            this.updateOverflow(rows);
        });

        return this;
    }

    private measureByMirror(): { rows: number; nextHeightPx: number } {
        const inputEl = this.inputTextElement.nativeElement;
        const mirrorEl = this.mirrorElement.nativeElement;
        const computedStyle = getComputedStyle(inputEl);

        let text = inputEl.innerText;
        if (!text || text === '\n') text = '\u00A0';

        mirrorEl.style.width = computedStyle.width;
        mirrorEl.textContent = text;

        const lineHeight = this.cssNum(computedStyle.lineHeight, 24);
        const paddingTop = this.cssNum(computedStyle.paddingTop, 0);
        const paddingBottom = this.cssNum(computedStyle.paddingBottom, 0);
        const paddingY = paddingTop + paddingBottom;

        const maxRowsCss = computedStyle.getPropertyValue('--max-rows').trim();
        const maxRows = maxRowsCss ? this.cssNum(maxRowsCss, 8) : 8;

        const contentH = mirrorEl.offsetHeight;

        const rawRows = Math.max(1, Math.ceil(contentH / lineHeight));
        const rows = Math.min(rawRows, maxRows);

        const nextHeightPx = Math.round(rows * lineHeight + paddingY);
        return {rows, nextHeightPx};
    }

    private initMirror() {
        const mirrorElem = this.mirrorElement.nativeElement;
        const inputElem = this.inputTextElement.nativeElement;
        const computedStyle = getComputedStyle(inputElem);

        mirrorElem.style.position = 'absolute';
        mirrorElem.style.visibility = 'hidden';
        mirrorElem.style.pointerEvents = 'none';
        mirrorElem.style.zIndex = '-1';
        mirrorElem.style.whiteSpace = 'pre-wrap';
        mirrorElem.style.overflowWrap = 'break-word';
        mirrorElem.style.wordBreak = 'normal';

        const props = [
            'font', 'font-size', 'font-family', 'font-weight', 'font-style',
            'line-height', 'letter-spacing', 'word-spacing',
            'padding-top', 'padding-bottom', 'padding-left', 'padding-right',
            'border-top-width', 'border-bottom-width', 'border-left-width', 'border-right-width',
            'white-space', 'text-transform', 'box-sizing',
        ];
        props.forEach((el) => (mirrorElem.style as any)[el] = computedStyle.getPropertyValue(el));

        mirrorElem.style.paddingTop = '0px';
        mirrorElem.style.paddingBottom = '0px';
    }

    private updateOverflow(rows: number) {
        const elemInput = this.inputTextElement.nativeElement;
        const computedStyle = getComputedStyle(elemInput);
        const maxRowsCss = computedStyle.getPropertyValue('--max-rows').trim();
        const maxRows = maxRowsCss ? this.cssNum(maxRowsCss, 8) : 8;

        elemInput.style.overflowY = rows >= maxRows ? 'auto' : 'hidden';
        return this;
    }

    private cssNum(value: string, fallback = 0): number {
        const num = parseFloat(value);
        return Number.isFinite(num) ? num : fallback;
    }

    protected readonly fileType = FileType;
}
