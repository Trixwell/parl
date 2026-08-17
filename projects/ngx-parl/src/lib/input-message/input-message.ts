import {
    AfterViewInit,
    ChangeDetectorRef,
    Component,
    computed,
    effect,
    ElementRef,
    inject,
    input,
    model,
    NgZone,
    OnDestroy,
    signal,
    ViewChild
} from '@angular/core';
import {FileType, OriginalKind, PreviewItem} from '../core/entity/file';
import {TranslocoPipe} from '@ngneat/transloco';
import {ChatMessage, CurrMessage, MessageActionEvent, MessageActionType} from '../core/entity/chat';
import {NgOptimizedImage} from '@angular/common';

interface EmojiMartSelection {
    native?: string;
}

@Component({
    selector: 'app-input-message',
    imports: [TranslocoPipe, NgOptimizedImage],
    templateUrl: './input-message.html',
    styleUrl: './input-message.scss',
    standalone: true,
})

export class InputMessageComponent implements AfterViewInit, OnDestroy {
    @ViewChild('inputText', {static: false}) inputTextElement!: ElementRef<HTMLElement>;
    @ViewChild('mirror', {static: false}) mirrorElement?: ElementRef<HTMLDivElement>;
    @ViewChild('emojiMartHost', {static: false}) emojiMartHost?: ElementRef<HTMLElement>;

    private readonly changeDetector = inject(ChangeDetectorRef);
    private readonly ngZone = inject(NgZone);

    public editMessage = input<ChatMessage | { id: number; content: string; file_path?: string[] | null } | null>(null);
    public language = input<'en' | 'uk'>('en');
    public autoFocus = input<boolean>(true);
    public mobileMode = input<boolean>(false);

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
    public dragActive = signal<boolean>(false);
    public emojiPickerOpen = model<boolean>(false);
    public composerInputMode = signal<'text' | 'none'>('text');

    public isEditMode = computed(() => !!this.editMessage());
    public canSend = computed(() =>
        !this.sending() && (
            this.hasText() ||
            this.hasNewAttachments() ||
            (this.isEditMode() && this.hasOriginalAttachments())
        )
    );

    public files = model<File[]>([]);
    public previews = model<PreviewItem[]>([]);

    private lastHeightPx = 0;
    private lastRows = 1;
    private resizeRaf: number | null = null;
    private dragDepth = 0;
    private composerCaretStart = 0;
    private composerCaretEnd = 0;
    private emojiMartPicker: HTMLElement | null = null;
    private emojiMartMountGeneration = 0;
    private emojiToggleFromPointer = false;
    private lastPickerTheme: 'light' | 'dark' = 'light';
    private themeObserver: MutationObserver | null = null;

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
                this.writeComposerText(content);

                queueMicrotask(() => {
                    this.autoResizeByRows();
                    element.focus();
                    this.focused.set(true);
                    this.setCaretToEnd(element);
                });
            }
        });
    }

    ngAfterViewInit() {
        const element = this.inputTextElement.nativeElement;
        if (element instanceof HTMLTextAreaElement && !element.value.trim()) {
            element.value = '';
            this.draft.set('');
        }
        element.style.transition = 'height 160ms ease';
        if (this.mirrorElement) {
            this.initMirror();
        }

        const computedStyle = getComputedStyle(element);
        const lineHeight = this.cssNum(computedStyle.lineHeight, 24);

        element.style.height = `${lineHeight}px`;
        this.lastHeightPx = lineHeight;
        this.lastRows = 1;
        this.updateOverflow(1);

        requestAnimationFrame(() => {
            this.autoResizeByRows();

            if (this.autoFocus()) {
                this.focusInput();
            }
        });
        this.bindThemeObserver();
    }

    ngOnDestroy() {
        if (this.resizeRaf) {
            cancelAnimationFrame(this.resizeRaf);
            this.resizeRaf = null;
        }
        this.themeObserver?.disconnect();
        this.themeObserver = null;
        this.destroyEmojiMartPicker();
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
        const newAttachments = (this.previews() ?? []).map(p => p.src).filter(Boolean);
        if (!this.isEditMode()) {
            return newAttachments;
        }

        const originalAttachments = this.editFilePaths().filter(Boolean);
        return Array.from(new Set([...originalAttachments, ...newAttachments]));
    }

    cancelEditMessage() {
        const message = this.editMessage();
        this.cancelEdit.set((message as any)?.id ?? null);
        queueMicrotask(() => this.cancelEdit.set(null));

        this.draft.set('');
        this.writeComposerText('');
        this.closeEmojiPicker();
        const element = this.inputTextElement?.nativeElement;

        if (element) {
            this.autoResizeByRows();
            element.focus();
        }

        return this;
    }

    focusInput() {
        if (this.emojiPickerOpen()) {
            return this;
        }

        const element = this.inputTextElement?.nativeElement;
        if (!element) {
            return this;
        }
        queueMicrotask(() => {
            if (this.emojiPickerOpen()) {
                return;
            }

            element.focus();
            this.focused.set(true);
        });

        return this;
    }

    onComposerSurfaceClick(event: MouseEvent) {
        const target = event.target;
        if (!(target instanceof HTMLElement) || target.closest('button')) {
            return this;
        }

        const element = this.inputTextElement?.nativeElement;
        if (!element || target === element) {
            return this;
        }

        element.focus();
        this.focused.set(true);

        if (element instanceof HTMLTextAreaElement) {
            const caret = element.value.length;
            element.setSelectionRange(caret, caret);
        } else {
            this.setCaretToEnd(element);
        }

        return this;
    }

    private setCaretToEnd(element: HTMLElement): void {
        if (element instanceof HTMLTextAreaElement) {
            const length = element.value.length;
            element.setSelectionRange(length, length);
            return;
        }

        const range = document.createRange();
        const selection = window.getSelection();
        if (!selection) return;

        range.selectNodeContents(element);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
    }

    private readComposerText(): string {
        const element = this.inputTextElement?.nativeElement;
        if (!element) {
            return '';
        }

        if (element instanceof HTMLTextAreaElement) {
            return element.value ?? '';
        }

        return element.innerText ?? '';
    }

    private writeComposerText(text: string): this {
        const element = this.inputTextElement?.nativeElement;
        if (!element) {
            return this;
        }

        if (element instanceof HTMLTextAreaElement) {
            element.value = text;
        } else {
            element.innerText = text;
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
            file_path: files.length ? files : [],
            file_list: fileList.length ? fileList : [],
        });

        queueMicrotask(() => this.messageEvent.set(null));

        const payload: CurrMessage = message ? {
            id: message.id,
            content: text,
            file_path: files.length ? files : [],
            file_list: fileList.length ? fileList : [],
        } : {
            content: text,
            file_path: files.length ? files : [],
            file_list: fileList.length ? fileList : [],
        };

        this.input_text.set(payload);

        this.draft.set('');
        this.writeComposerText('');
        this.files.set([]);
        this.previews.set([]);
        this.closeEmojiPicker();
        element.focus();
        this.autoResizeByRows();

        setTimeout(() => this.sending.set(false), 150);

        return this;
    }

    onFocus() {
        const element = this.inputTextElement.nativeElement;
        if (!(element instanceof HTMLTextAreaElement) && element.innerHTML === '<br>') {
            element.innerHTML = '';
        }

        if (this.emojiPickerOpen()) {
            queueMicrotask(() => {
                if (this.emojiPickerOpen()) {
                    element.blur();
                }
            });

            return this;
        }

        this.focused.set(true);
        this.composerInputMode.set('text');

        return this;
    }

    onBlur() {
        this.captureComposerCaret();
        this.focused.set(false);

        return this;
    }

    onEmojiButtonPointerDown(event: PointerEvent) {
        event.preventDefault();
        event.stopPropagation();
        this.emojiToggleFromPointer = true;
        this.toggleEmojiPicker();

        return this;
    }

    onEmojiButtonClick(event: MouseEvent) {
        event.preventDefault();
        event.stopPropagation();
        if (this.emojiToggleFromPointer) {
            this.emojiToggleFromPointer = false;

            return this;
        }

        this.toggleEmojiPicker();

        return this;
    }

    onComposerTextPointerDown() {
        if (!this.emojiPickerOpen()) {
            return this;
        }

        this.closeEmojiPicker();
        this.composerInputMode.set('text');

        return this;
    }

    toggleEmojiPicker() {
        if (this.emojiPickerOpen()) {
            this.closeEmojiPicker();
            this.focusInput();

            return this;
        }

        this.captureComposerCaret();
        this.composerInputMode.set('none');
        this.emojiPickerOpen.set(true);
        this.inputTextElement?.nativeElement.blur();
        queueMicrotask(() => {
            void this.mountEmojiMartPicker();
        });

        return this;
    }

    insertEmoji(emoji: string) {
        const element = this.inputTextElement?.nativeElement;
        if (!element) {
            return this;
        }

        if (element instanceof HTMLTextAreaElement) {
            const value = element.value ?? '';
            const start = Math.max(0, Math.min(this.composerCaretStart, value.length));
            const end = Math.max(start, Math.min(this.composerCaretEnd, value.length));
            const nextValue = `${value.slice(0, start)}${emoji}${value.slice(end)}`;
            const nextCaret = start + emoji.length;

            element.value = nextValue;
            this.composerCaretStart = nextCaret;
            this.composerCaretEnd = nextCaret;
            this.draft.set(nextValue);
            this.autoResizeByRows();

            return this;
        }

        const currentText = element.innerText ?? '';
        const nextText = `${currentText}${emoji}`;
        element.innerText = nextText;
        this.draft.set(nextText);
        this.autoResizeByRows();

        return this;
    }

    private closeEmojiPicker() {
        this.composerInputMode.set('text');
        this.destroyEmojiMartPicker();
        this.emojiPickerOpen.set(false);

        return this;
    }

    private destroyEmojiMartPicker() {
        this.emojiMartMountGeneration += 1;
        this.emojiMartPicker?.remove();
        this.emojiMartPicker = null;
        this.emojiMartHost?.nativeElement.replaceChildren();

        return this;
    }

    private async resolvePickerHost(): Promise<HTMLElement | null> {
        this.changeDetector.detectChanges();
        if (this.emojiMartHost?.nativeElement) {
            return this.emojiMartHost.nativeElement;
        }

        await new Promise<void>(resolve => {
            requestAnimationFrame(() => resolve());
        });
        this.changeDetector.detectChanges();

        return this.emojiMartHost?.nativeElement ?? null;
    }

    private readPickerTheme(): 'light' | 'dark' {
        if (typeof document === 'undefined') {
            return 'light';
        }

        return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    }

    private bindThemeObserver(): this {
        if (this.themeObserver || typeof MutationObserver === 'undefined' || typeof document === 'undefined') {
            return this;
        }

        this.themeObserver = new MutationObserver(() => {
            if (!this.mobileMode() || !this.emojiPickerOpen()) {
                return;
            }

            const theme = this.readPickerTheme();
            if (theme === this.lastPickerTheme) {
                return;
            }

            this.destroyEmojiMartPicker();
            void this.mountEmojiMartPicker();
        });
        this.themeObserver.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['data-theme'],
        });

        return this;
    }

    private readPickerConstructor(emojiMart: unknown): (new (options: Record<string, unknown>) => HTMLElement) | null {
        const candidates = [emojiMart, this.readModuleExport(emojiMart)];
        for (const candidate of candidates) {
            if (candidate && typeof candidate === 'object' && 'Picker' in candidate) {
                const picker = (candidate as { Picker: unknown }).Picker;
                if (typeof picker === 'function') {
                    return picker as new (options: Record<string, unknown>) => HTMLElement;
                }
            }
        }

        return null;
    }

    private async mountEmojiMartPicker() {
        const host = await this.resolvePickerHost();
        if (!host || !this.emojiPickerOpen()) {
            return this;
        }

        const mountGeneration = this.emojiMartMountGeneration;
        const locale = this.language();

        try {
            const [emojiMart, dataModule, i18nModule] = await Promise.all([
                import('emoji-mart'),
                import('@emoji-mart/data'),
                locale === 'uk' ? import('@emoji-mart/data/i18n/uk.json') : Promise.resolve(null),
            ]);

            if (mountGeneration !== this.emojiMartMountGeneration || !this.emojiPickerOpen()) {
                return this;
            }

            const PickerConstructor = this.readPickerConstructor(emojiMart);
            if (!PickerConstructor) {
                return this;
            }

            const data = this.readModuleExport(dataModule);
            const theme = this.readPickerTheme();
            this.lastPickerTheme = theme;
            const picker = new PickerConstructor({
                data,
                i18n: i18nModule ? this.readModuleExport(i18nModule) : undefined,
                theme,
                set: 'native',
                locale,
                previewPosition: 'none',
                skinTonePosition: 'search',
                navPosition: 'none',
                searchPosition: 'sticky',
                dynamicWidth: true,
                emojiButtonSize: 36,
                emojiSize: 24,
                maxFrequentRows: 2,
                autoFocus: false,
                onEmojiSelect: (emoji: EmojiMartSelection) => {
                    this.ngZone.run(() => {
                        if (emoji.native) {
                            this.insertEmoji(emoji.native);
                            this.changeDetector.detectChanges();
                        }
                    });
                },
            });

            if (mountGeneration !== this.emojiMartMountGeneration || !this.emojiPickerOpen()) {
                picker.remove();

                return this;
            }

            this.fillPickerFrame(picker);
            host.replaceChildren(picker);
            this.emojiMartPicker = picker;
            this.fillPickerFrame(picker);
            this.lockPickerInputs(picker);
        } catch {
            return this;
        }

        return this;
    }

    private fillPickerFrame(picker: HTMLElement) {
        picker.style.setProperty('display', 'flex', 'important');
        picker.style.setProperty('width', '100%', 'important');
        picker.style.setProperty('min-width', '100%', 'important');
        picker.style.setProperty('max-width', 'none', 'important');
        picker.style.setProperty('height', '100%', 'important');
        picker.style.setProperty('box-sizing', 'border-box', 'important');

        if (this.readPickerTheme() === 'dark') {
            picker.style.setProperty('--rgb-background', '19, 22, 34');
            picker.style.setProperty('--rgb-input', '34, 40, 54');
            picker.style.setProperty('--rgb-color', '240, 242, 246');
            picker.style.setProperty('--rgb-accent', '89, 74, 225');
        }

        const shadow = picker.shadowRoot;
        if (shadow && !shadow.querySelector('style[data-parl-fill]')) {
            const sheet = document.createElement('style');
            sheet.setAttribute('data-parl-fill', '');
            sheet.textContent = `
                :host {
                    width: 100% !important;
                    min-width: 100% !important;
                    max-width: none !important;
                    height: 100% !important;
                }
                #root {
                    width: 100% !important;
                    height: 100% !important;
                    flex: 1 1 auto;
                }
            `;
            shadow.appendChild(sheet);
        }

        return this;
    }

    private lockPickerInputs(picker: HTMLElement) {
        const apply = (input: HTMLInputElement) => {
            input.inputMode = 'none';
            input.setAttribute('inputmode', 'none');
            input.setAttribute('autocomplete', 'off');
            input.setAttribute('autocorrect', 'off');
            input.setAttribute('spellcheck', 'false');
        };

        const scan = (root: ParentNode) => {
            root.querySelectorAll('input').forEach(input => apply(input));
        };

        scan(picker);
        if (picker.shadowRoot) {
            scan(picker.shadowRoot);
        }

        requestAnimationFrame(() => {
            scan(picker);
            if (picker.shadowRoot) {
                scan(picker.shadowRoot);
            }
        });

        picker.addEventListener('focusin', event => {
            const target = event.target;
            if (target instanceof HTMLInputElement) {
                apply(target);
            }
        });

        return this;
    }

    private readModuleExport(moduleValue: unknown): unknown {
        if (moduleValue && typeof moduleValue === 'object' && 'default' in moduleValue) {
            return (moduleValue as { default: unknown }).default ?? moduleValue;
        }

        return moduleValue;
    }

    private captureComposerCaret() {
        const element = this.inputTextElement?.nativeElement;
        if (!(element instanceof HTMLTextAreaElement)) {
            return this;
        }

        this.composerCaretStart = element.selectionStart ?? element.value.length;
        this.composerCaretEnd = element.selectionEnd ?? this.composerCaretStart;

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
        this.draft.set(this.readComposerText());
        this.autoResizeByRows();

        return this;
    }

    onPaste() {
        queueMicrotask(() => {
            this.draft.set(this.readComposerText());
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
        this.addFiles(Array.from(selected));
        inputEl.value = '';

        return this;
    }

    onDragEnter(event: DragEvent) {
        event.preventDefault();
        event.stopPropagation();
        this.dragDepth += 1;
        this.dragActive.set(true);

        return this;
    }

    onDragOver(event: DragEvent) {
        event.preventDefault();
        event.stopPropagation();
        if (event.dataTransfer) {
            event.dataTransfer.dropEffect = 'copy';
        }
        this.dragActive.set(true);

        return this;
    }

    onDragLeave(event: DragEvent) {
        event.preventDefault();
        event.stopPropagation();
        this.dragDepth = Math.max(0, this.dragDepth - 1);
        if (this.dragDepth === 0) {
            this.dragActive.set(false);
        }

        return this;
    }

    onDrop(event: DragEvent) {
        event.preventDefault();
        event.stopPropagation();
        this.dragDepth = 0;
        this.dragActive.set(false);

        const files = event.dataTransfer?.files;
        if (!files?.length) {
            return this;
        }

        this.addFiles(Array.from(files));

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
        if (element instanceof HTMLTextAreaElement) {
            return this.autoResizeNativeComposer(element);
        }

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

    private autoResizeNativeComposer(element: HTMLTextAreaElement): this {
        const computedStyle = getComputedStyle(element);
        const lineHeight = this.cssNum(computedStyle.lineHeight, 24);
        const maxRowsCss = computedStyle.getPropertyValue('--max-rows').trim();
        const maxRows = maxRowsCss ? this.cssNum(maxRowsCss, 8) : 8;
        const maxHeightPx = Math.round(lineHeight * maxRows);

        element.style.height = `${lineHeight}px`;
        const nextHeightPx = Math.min(element.scrollHeight, maxHeightPx);
        const rows = Math.min(maxRows, Math.max(1, Math.round(nextHeightPx / lineHeight)));

        element.style.height = `${nextHeightPx}px`;
        this.lastHeightPx = nextHeightPx;
        this.lastRows = rows;
        this.updateOverflow(rows);

        return this;
    }

    measureByMirror(): { rows: number; nextHeightPx: number } {
        const inputEl = this.inputTextElement.nativeElement;
        const mirrorEl = this.mirrorElement?.nativeElement;
        const computedStyle = getComputedStyle(inputEl);

        let text = this.readComposerText();
        if (!text || text === '\n') {
            text = '\u00A0';
        }

        if (!mirrorEl) {
            const lineHeight = this.cssNum(computedStyle.lineHeight, 24);
            return {rows: 1, nextHeightPx: lineHeight};
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
        const mirror = this.mirrorElement?.nativeElement;
        const input = this.inputTextElement.nativeElement;
        if (!mirror) {
            return;
        }
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

    public addFiles(files: File[]) {
        const list = files.filter(f => (f.type || '').startsWith('image/'));
        if (!list.length) {
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
            .then(items => this.previews.set([...(this.previews() ?? []), ...items]));

        return this;
    }

    protected readonly FileType = FileType;
}
