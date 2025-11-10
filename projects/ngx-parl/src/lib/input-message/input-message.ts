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
import {ChatMessage, CurrMessage} from '../core/entity/chat';


@Component({
    selector: 'app-input-message',
    imports: [MatIcon, TranslocoPipe],
    templateUrl: './input-message.html',
    styleUrl: './input-message.scss',
    standalone: true,
})

export class InputMessageComponent implements AfterViewInit, OnDestroy {
    @ViewChild('inputText', { static: false }) inputTextElement!: ElementRef<HTMLDivElement>;
    @ViewChild('mirror', { static: false }) mirrorElement!: ElementRef<HTMLDivElement>;

    // ❗ Тепер приймаємо і ChatMessage, і DTO, і null
    public editMessage = input<ChatMessage | { id: number; content: string; file_path?: string[] | null } | null>(null);

    public hasOriginalAttachments = computed(() => {
        const fp = this.editFilePaths();
        return fp.length > 0;
    });

    public hasNewAttachments = computed(() => (this.previews()?.length ?? 0) > 0);

    public cancelEdit = model<number | null>(null);
    public input_text = model<string | CurrMessage>('');

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
            const msg = this.editMessage();
            const el = this.inputTextElement?.nativeElement;
            if (!el) return;

            if (msg) {
                const content = (msg as any).content ?? '';
                this.draft.set(content);
                el.innerText = content;
                queueMicrotask(() => {
                    this.autoResizeByRows();
                    el.focus();
                    this.focused.set(true);
                });
            }
        });
    }

    ngAfterViewInit() {
        const el = this.inputTextElement.nativeElement;
        el.style.transition = 'height 160ms ease';
        this.initMirror();

        const cs = getComputedStyle(el);
        const lineHeight = this.cssNum(cs.lineHeight, 24);

        el.style.height = `${lineHeight}px`;
        this.lastHeightPx = lineHeight;
        this.lastRows = 1;
        this.updateOverflow(1);

        requestAnimationFrame(() => {
            const { rows, nextHeightPx } = this.measureByMirror();
            el.style.height = `${nextHeightPx}px`;
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

    /** Повертає file_path редагованого повідомлення як масив */
    private editFilePaths(): string[] {
        const msg = this.editMessage();
        if (!msg) return [];
        const fp = (msg as any).file_path;
        return Array.isArray(fp) ? fp : [];
        // за твоїми останніми правками file_path — масив або null
    }

    private collectAttachmentSources(): string[] {
        return (this.previews() ?? []).map(p => p.src).filter(Boolean);
    }

    cancelEditMessage() {
        const msg = this.editMessage();
        this.cancelEdit.set((msg as any)?.id ?? null);
        queueMicrotask(() => this.cancelEdit.set(null));

        this.draft.set('');
        const el = this.inputTextElement?.nativeElement;
        if (el) {
            el.innerHTML = '';
            this.autoResizeByRows();
            el.focus();
        }
        return this;
    }

    enterDown() {
        const el = this.inputTextElement.nativeElement;
        const text = this.draft().trim();
        if (!this.canSend()) return this;

        this.sending.set(true);

        const files = this.collectAttachmentSources();
        const msg = this.editMessage();

        if (msg) {
            this.input_text.set({ id: (msg as any).id, content: text, files: files.length ? files : undefined });
        } else {
            this.input_text.set({ content: text, files: files.length ? files : undefined });
        }

        this.draft.set('');
        el.innerHTML = '';
        this.files.set([]);
        this.previews.set([]);
        el.focus();
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

    /** Один метод читає вибрані файли і формує прев’ю */
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
                return <PreviewItem>{ src, originalKind, name: f.name, type: f.type || '', size: f.size };
            })
        )
            .then(items => this.previews.set([...(this.previews() ?? []), ...items]))
            .finally(() => (inputEl.value = ''));

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

    // ——— Допоміжні ———

    private autoResizeByRows() {
        const el = this.inputTextElement.nativeElement;
        const { rows, nextHeightPx } = this.measureByMirror();

        if (rows === this.lastRows) {
            this.updateOverflow(rows);
            return this;
        }

        if (this.resizeRaf) cancelAnimationFrame(this.resizeRaf);
        el.style.height = `${this.lastHeightPx}px`;

        this.resizeRaf = requestAnimationFrame(() => {
            el.style.height = `${nextHeightPx}px`;
            this.lastHeightPx = nextHeightPx;
            this.lastRows = rows;
            this.updateOverflow(rows);
        });
        return this;
    }

    private measureByMirror(): { rows: number; nextHeightPx: number } {
        const inputEl = this.inputTextElement.nativeElement;
        const mirrorEl = this.mirrorElement.nativeElement;
        const cs = getComputedStyle(inputEl);

        let text = inputEl.innerText;
        if (!text || text === '\n') text = '\u00A0';

        mirrorEl.style.width = cs.width;
        mirrorEl.textContent = text;

        const lineHeight = this.cssNum(cs.lineHeight, 24);
        const pt = this.cssNum(cs.paddingTop, 0);
        const pb = this.cssNum(cs.paddingBottom, 0);
        const paddingY = pt + pb;

        const maxRowsCss = cs.getPropertyValue('--max-rows').trim();
        const maxRows = maxRowsCss ? this.cssNum(maxRowsCss, 8) : 8;

        const contentH = mirrorEl.offsetHeight;
        const rawRows = Math.max(1, Math.ceil(contentH / lineHeight));
        const rows = Math.min(rawRows, maxRows);

        const nextHeightPx = Math.round(rows * lineHeight + paddingY);
        return { rows, nextHeightPx };
    }

    private initMirror() {
        const mirror = this.mirrorElement.nativeElement;
        const input = this.inputTextElement.nativeElement;
        const cs = getComputedStyle(input);

        mirror.style.position = 'absolute';
        mirror.style.visibility = 'hidden';
        mirror.style.pointerEvents = 'none';
        mirror.style.zIndex = '-1';
        mirror.style.whiteSpace = 'pre-wrap';
        mirror.style.overflowWrap = 'break-word';
        mirror.style.wordBreak = 'normal';

        const props = [
            'font', 'font-size', 'font-family', 'font-weight', 'font-style',
            'line-height', 'letter-spacing', 'word-spacing',
            'padding-top', 'padding-bottom', 'padding-left', 'padding-right',
            'border-top-width', 'border-bottom-width', 'border-left-width', 'border-right-width',
            'white-space', 'text-transform', 'box-sizing'
        ];
        props.forEach(p => (mirror.style as any)[p] = cs.getPropertyValue(p));
        mirror.style.paddingTop = '0px';
        mirror.style.paddingBottom = '0px';
    }

    private updateOverflow(rows: number) {
        const el = this.inputTextElement.nativeElement;
        const cs = getComputedStyle(el);
        const maxRowsCss = cs.getPropertyValue('--max-rows').trim();
        const maxRows = maxRowsCss ? this.cssNum(maxRowsCss, 8) : 8;
        el.style.overflowY = rows >= maxRows ? 'auto' : 'hidden';
        return this;
    }

    private readFileAsDataURL(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve((e.target?.result as string) || '');
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
