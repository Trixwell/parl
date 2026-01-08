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
import {FileType, OriginalKind, PreviewItem} from '../core/entity/file';
import {TranslocoPipe} from '@ngneat/transloco';
import {ChatMessage, CurrMessage, MessageActionEvent, MessageActionType} from '../core/entity/chat';
import {NgOptimizedImage} from '@angular/common';

@Component({
    selector: 'app-input-message',
    imports: [TranslocoPipe, NgOptimizedImage],
    templateUrl: './input-message.html',
    styleUrl: './input-message.scss',
    standalone: true,
})

export class InputMessageComponent implements AfterViewInit, OnDestroy {
    @ViewChild('inputText', {static: false}) inputTextElement!: ElementRef<HTMLDivElement>;
    @ViewChild('mirror', {static: false}) mirrorElement!: ElementRef<HTMLDivElement>;

    public editMessage = input<ChatMessage | { id: number; content: string; file_path?: string[] | null } | null>(null);

    public hasOriginalAttachments = computed(() => {
        const filePaths = this.editFilePaths();
        return filePaths.length > 0;
    });

    public hasNewAttachments = computed(() => (this.previews()?.length ?? 0) > 0);

    public cancelEdit = model<number | null>(null);
    public input_text = model<string | CurrMessage>('');

    public draft = signal<string>('');
    public focused = signal<boolean>(false);
    public sending = signal<boolean>(false);
    public hasText = computed(() => this.draft().trim().length > 0);

    public isEditMode = computed(() => !!this.editMessage());
    public canSend = computed(() =>
        this.hasText() ||
        this.hasNewAttachments() ||
        (this.isEditMode() && this.hasOriginalAttachments())
    );

    public files = model<File[]>([]);
    public previews = model<PreviewItem[]>([]);

    private lastHeightPx = 0;
    private lastRows = 1;
    private resizeRaf: number | null = null;

    public messageEvent = model<MessageActionEvent | null>(null);

    constructor() {
        effect(() => {
            const message = this.editMessage();
            const element = this.inputTextElement?.nativeElement;

            if (!element) {
                return;
            }

            if (message) {
                const content = (message as any).content ?? '';
                this.draft.set(content);
                element.innerText = content;

                queueMicrotask(() => {
                    this.autoResizeByRows();
                    element.focus();
                    this.focused.set(true);
                });
            }
        });
    }

    ngAfterViewInit() {
        const element = this.inputTextElement.nativeElement;
        element.style.transition = 'height 160ms ease';
        this.initMirror();

        const computedStyle = getComputedStyle(element);
        const lineHeight = this.cssNum(computedStyle.lineHeight, 24);

        element.style.height = `${lineHeight}px`;
        this.lastHeightPx = lineHeight;
        this.lastRows = 1;
        this.updateOverflow(1);

        requestAnimationFrame(() => {
            const {rows, nextHeightPx} = this.measureByMirror();
            element.style.height = `${nextHeightPx}px`;

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

    editFilePaths(): string[] {
        const message = this.editMessage();
        if (!message) {
            return [];
        }

        const file_path = (message as any).file_path;

        return Array.isArray(file_path) ? file_path : [];
    }

    collectAttachmentSources(): string[] {
        return (this.previews() ?? []).map(p => p.src).filter(Boolean);
    }

    cancelEditMessage() {
        const message = this.editMessage();
        this.cancelEdit.set((message as any)?.id ?? null);
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
        const fileList = this.files();

        const message = this.editMessage();
        const action: MessageActionType = message ? 'edit' : 'send';

        this.messageEvent.set({
            action,
            chatMessageId: message ? message.id : undefined,
            content: text,
            files: files.length ? files : [],
            file_list: fileList.length ? fileList : [],
        });

        queueMicrotask(() => this.messageEvent.set(null));

        if (message) {
            this.input_text.set({
                id: message.id,
                content: text,
                files: files.length ? files : [],
                file_list: fileList.length ? fileList : [],
            });
        } else {
            this.input_text.set({
                content: text,
                files: files.length ? files : [],
                file_list: fileList.length ? fileList : [],
            });
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

    inputFileChange(event: Event) {
        const inputEl = event.target as HTMLInputElement;
        const selected = inputEl.files;

        if (!selected?.length) {
            inputEl.value = '';

            return this;
        }

        const list = Array.from(selected).filter(f => (f.type || '').startsWith('image/'));
        if (!list.length) {
            inputEl.value = '';

            return this;
        }

        this.files.set([...(this.files() ?? []), ...list]);

        Promise.all(
            list.map(async f => {
                const src = await this.readFileAsDataURL(f);
                const originalKind: OriginalKind = (f.type || '') === 'image/gif' ? FileType.GIF : FileType.IMAGE;
                return <PreviewItem>{src, originalKind, name: f.name, type: f.type || '', size: f.size};
            })
        )
            .then(items => this.previews.set([...(this.previews() ?? []), ...items]))
            .finally(() => (inputEl.value = ''));

        return this;
    }

    removeFile(index: number, event?: MouseEvent) {
        event?.stopPropagation();
        event?.preventDefault();

        const previews = [...(this.previews() ?? [])];
        previews.splice(index, 1);
        this.previews.set(previews);

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

    autoResizeByRows() {
        const element = this.inputTextElement.nativeElement;
        const {rows, nextHeightPx} = this.measureByMirror();

        if (rows === this.lastRows) {
            this.updateOverflow(rows);

            return this;
        }

        if (this.resizeRaf) {
            cancelAnimationFrame(this.resizeRaf);
        }

        element.style.height = `${this.lastHeightPx}px`;

        this.resizeRaf = requestAnimationFrame(() => {
            element.style.height = `${nextHeightPx}px`;
            this.lastHeightPx = nextHeightPx;
            this.lastRows = rows;
            this.updateOverflow(rows);
        });

        return this;
    }

    measureByMirror(): { rows: number; nextHeightPx: number } {
        const inputEl = this.inputTextElement.nativeElement;
        const mirrorEl = this.mirrorElement.nativeElement;
        const computedStyle = getComputedStyle(inputEl);

        let text = inputEl.innerText;
        if (!text || text === '\n') {
            text = '\u00A0';
        }

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

    initMirror() {
        const mirror = this.mirrorElement.nativeElement;
        const input = this.inputTextElement.nativeElement;
        const computedStyle = getComputedStyle(input);

        mirror.style.position = 'absolute';
        mirror.style.visibility = 'hidden';
        mirror.style.pointerEvents = 'none';
        mirror.style.zIndex = '-1';
        mirror.style.whiteSpace = 'pre-wrap';
        mirror.style.overflowWrap = 'break-word';
        mirror.style.wordBreak = 'normal';

        const properties = [
            'font', 'font-size', 'font-family', 'font-weight', 'font-style',
            'line-height', 'letter-spacing', 'word-spacing',
            'padding-top', 'padding-bottom', 'padding-left', 'padding-right',
            'border-top-width', 'border-bottom-width', 'border-left-width', 'border-right-width',
            'white-space', 'text-transform', 'box-sizing'
        ];

        properties.forEach(property => (mirror.style as any)[property] = computedStyle.getPropertyValue(property));
        mirror.style.paddingTop = '0px';
        mirror.style.paddingBottom = '0px';
    }

    updateOverflow(rows: number) {
        const element = this.inputTextElement.nativeElement;
        const computedStyle = getComputedStyle(element);
        const maxRowsCss = computedStyle.getPropertyValue('--max-rows').trim();
        const maxRows = maxRowsCss ? this.cssNum(maxRowsCss, 8) : 8;
        element.style.overflowY = rows >= maxRows ? 'auto' : 'hidden';

        return this;
    }

    readFileAsDataURL(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve((e.target?.result as string) || '');
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    cssNum(v: string, fb = 0): number {
        const n = parseFloat(v);
        return Number.isFinite(n) ? n : fb;
    }

    protected readonly FileType = FileType;
}
