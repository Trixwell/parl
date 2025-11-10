import {
    AfterViewInit,
    Component,
    computed,
    effect,
    ElementRef,
    input,
    model,
    OnDestroy,
    signal,
    ViewChild
} from '@angular/core';
import {MatIcon, MatIconRegistry} from '@angular/material/icon';
import {DomSanitizer} from '@angular/platform-browser';
import {FileType, OriginalKind, PreviewItem} from '../core/entity/file';
import {TranslocoPipe} from '@ngneat/transloco';
import {currMessage} from '../core/entity/chat';


@Component({
    selector: 'app-input-message',
    imports: [MatIcon, TranslocoPipe],
    templateUrl: './input-message.html',
    styleUrl: './input-message.scss',
    standalone: true,
})

export class InputMessageComponent implements AfterViewInit, OnDestroy {
    @ViewChild('inputText', {static: false}) inputTextElement!: ElementRef<HTMLDivElement>;
    @ViewChild('mirror', {static: false}) mirrorElement!: ElementRef<HTMLDivElement>;

    public editMessage = input<currMessage | null>(null);

    public hasOriginalAttachments = computed(() => {
        const fp = this.editMessage()?.file_path ?? null;
        return Array.isArray(fp) && fp.length > 0;
    });

    public hasNewAttachments = computed(() => (this.previews()?.length ?? 0) > 0);

    public cancelEdit = model<number | null>(null);
    public input_text = model<string | currMessage>('');

    // Стан
    public draft = signal<string>('');
    public focused = signal<boolean>(false);
    public sending = signal<boolean>(false);
    public hasText = computed(() => this.draft().trim().length > 0);

    public isEditMode = computed(() => !!this.editMessage());
    public canSend = computed(() => {
        if (this.hasText()) return true;
        if (this.hasNewAttachments()) return true;
        if (this.isEditMode() && this.hasOriginalAttachments()) return true;
        return false;
    });

    // Файли/прев’ю (тільки зображення/GIF)
    public files = model<File[]>([]);
    public previews = model<PreviewItem[]>([]);

    private lastHeightPx = 0;
    private lastRows = 1;
    private resizeRaf: number | null = null;

    constructor(private iconRegistry: MatIconRegistry, private sanitizer: DomSanitizer) {
        this.iconRegistry.addSvgIcon('attach-filled',
            this.sanitizer.bypassSecurityTrustResourceUrl('../../assets/icons/attach-filled.svg'));
        this.iconRegistry.addSvgIcon('send',
            this.sanitizer.bypassSecurityTrustResourceUrl('../../assets/icons/send.svg'));
        this.iconRegistry.addSvgIcon('remove',
            this.sanitizer.bypassSecurityTrustResourceUrl('../../assets/icons/remove-badge.svg'));
        this.iconRegistry.addSvgIcon('close',
            this.sanitizer.bypassSecurityTrustResourceUrl('../../assets/icons/close.svg'));

        effect(() => {
            const message = this.editMessage();
            const element = this.inputTextElement?.nativeElement;
            if (!element) {
                return;
            }

            if (message) {
                this.draft.set(message.content ?? '');
                element.innerText = message.content ?? '';

                queueMicrotask(() => {
                    this.autoResizeByRows();
                    element.focus();
                    this.focused.set(true);
                });
            }
        });
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

    private collectAttachmentSources(): string[] {
        return (this.previews() ?? []).map(preview => preview.src).filter(Boolean);
    }

    /** Закрити поле редагування (клік по “хрестику”) */
    cancelEditMessage() {
        const currentMessage = this.editMessage();
        this.cancelEdit.set(currentMessage?.id ?? null);
        queueMicrotask(() => this.cancelEdit.set(null));

        this.draft.set('');
        const element = this.inputTextElement?.nativeElement;
        if (element) {
            element.innerHTML = '';
            this.autoResizeByRows();
            element.focus();
        }

        return this;
    }

    enterDown() {
        const element = this.inputTextElement.nativeElement;
        const text = this.draft().trim();
        if (!this.canSend()) {
            return this;
        }

        this.sending.set(true);

        const files = this.collectAttachmentSources();
        const editMessage = this.editMessage();

        if (editMessage) {
            this.input_text.set({id: editMessage.id, content: text, files: files.length ? files : undefined});
        } else {
            this.input_text.set({content: text, files: files.length ? files : undefined});
        }

        this.draft.set('');
        element.innerHTML = '';
        this.files.set([]);
        this.previews.set([]);
        element.focus();
        this.autoResizeByRows();

        setTimeout(() => this.sending.set(false), 150);

        return this;
    }

    onFocus() {
        if (this.inputTextElement.nativeElement.innerHTML === '<br>') {
            this.inputTextElement.nativeElement.innerHTML = '';
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
        this.draft.set(this.inputTextElement.nativeElement.innerText ?? '');
        this.autoResizeByRows();

        return this;
    }

    onPaste() {
        queueMicrotask(() => {
            this.draft.set(this.inputTextElement.nativeElement.innerText ?? '');
            this.autoResizeByRows();
        });

        return this;
    }

    /** ✅ Спрощено: один метод читає вибрані файли і формує прев’ю */
    inputFileChange(event: Event) {
        const input = event.target as HTMLInputElement;
        const selected = input.files;

        if (!selected?.length) {
            input.value = '';
            return this;
        }

        const list = Array.from(selected).filter(f => this.isImageFile(f));
        if (!list.length) {
            input.value = '';
            return this;
        }

        // Оновлюємо state файлів
        this.files.set([...(this.files() ?? []), ...list]);

        // Читаємо всі зображення в data URL та будуємо прев’ю
        Promise
            .all(list.map(async f => {
                const src = await this.readFileAsDataURL(f);
                const originalKind: OriginalKind = this.getOriginalKind(f);
                return <PreviewItem>{
                    src,
                    originalKind,
                    name: f.name,
                    type: f.type || '',
                    size: f.size
                };
            }))
            .then(items => this.previews.set([...(this.previews() ?? []), ...items]))
            .finally(() => (input.value = ''));

        return this;
    }

    removeFile(index: number, event?: MouseEvent) {
        event?.stopPropagation();
        event?.preventDefault();

        const prevs = [...(this.previews() ?? [])];
        prevs.splice(index, 1);
        this.previews.set(prevs);

        const filesArr = [...(this.files() ?? [])];
        if (index >= 0 && index < filesArr.length) {
            filesArr.splice(index, 1);
            this.files.set(filesArr);
        }

        return this;
    }

    openPreview(_item: PreviewItem, _index: number) {
        return this;
    }

    private isImageFile(file: File): boolean {
        return (file.type || '').startsWith('image/');
    }

    private getOriginalKind(file: File): OriginalKind {
        return (file.type || '') === 'image/gif' ? FileType.GIF : FileType.IMAGE;
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

        const styleProperties = [
            'font', 'font-size', 'font-family', 'font-weight', 'font-style',
            'line-height', 'letter-spacing', 'word-spacing',
            'padding-top', 'padding-bottom', 'padding-left', 'padding-right',
            'border-top-width', 'border-bottom-width', 'border-left-width', 'border-right-width',
            'white-space', 'text-transform', 'box-sizing'
        ];
        styleProperties.forEach(props => (mirrorElem.style as any)[props] = computedStyle.getPropertyValue(props));
        mirrorElem.style.paddingTop = '0px';
        mirrorElem.style.paddingBottom = '0px';

        return this;
    }

    private updateOverflow(rows: number) {
        const elementInput = this.inputTextElement.nativeElement;
        const computedStyle = getComputedStyle(elementInput);
        const maxRowsCss = computedStyle.getPropertyValue('--max-rows').trim();
        const maxRows = maxRowsCss ? this.cssNum(maxRowsCss, 8) : 8;
        elementInput.style.overflowY = rows >= maxRows ? 'auto' : 'hidden';

        return this;
    }

    private readFileAsDataURL(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = event => resolve((event.target?.result as string) || '');
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    private cssNum(v: string, fb = 0): number {
        const n = parseFloat(v);

        return Number.isFinite(n) ? n : fb;
    }

    protected readonly FileType = FileType;
}
