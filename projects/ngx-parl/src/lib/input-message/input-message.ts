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
import {TranslocoPipe, TranslocoService} from '@ngneat/transloco';
import {
    ChatMessage,
    CurrMessage,
    MessageActionEvent,
    MessageActionType,
    PARL_DEFAULT_MAX_FILE_SIZE_BYTES,
} from '../core/entity/chat';
import {NgOptimizedImage} from '@angular/common';
import {clearMessageDraft, loadMessageDraft, saveMessageDraft} from '../core/service/draft/message-draft';
import {FlowTheme} from '../core/entity/theme';
import {
    createEmojiMartPicker,
    ensureEmojiMartReady,
} from '../core/service/emoji-mart/emoji-mart';

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
    private readonly transloco = inject(TranslocoService);

    public editMessage = input<ChatMessage | { id: number; content: string; file_path?: string[] | null } | null>(null);
    public replyTo = model<ChatMessage | null>(null);
    public language = input<'en' | 'uk'>('en');
    public autoFocus = input<boolean>(true);
    public mobileMode = input<boolean>(false);
    public theme = input<FlowTheme>(FlowTheme.PRIMARY);
    public isSecondaryTheme = computed(() => this.theme() === FlowTheme.SECONDARY);
    public showEmojiButton = computed(() => this.mobileMode() || this.isSecondaryTheme());
    public draftKey = input<string>('default');
    public draftTtlMs = input<number>(24 * 60 * 60 * 1000);
    public maxFileSizeBytes = input<number>(PARL_DEFAULT_MAX_FILE_SIZE_BYTES);
    public fileError = signal<string | null>(null);

    public hasOriginalAttachments = computed(() => {
        const filePaths = this.editFilePaths();
        return filePaths.length > 0;
    });

    public hasNewAttachments = computed(() =>
        (this.previews() ?? []).some(item => item.status === 'ready' || (!item.status && !!item.src)),
    );

    public cancelEdit = model<number | null>(null);
    public input_text = model<string | CurrMessage>('');

    public draft = signal<string>('');
    public focused = signal<boolean>(false);
    public sending = signal<boolean>(false);
    public hasText = computed(() => hasComposerText(this.draft()));
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
    private lastFocusedReplyId: number | null = null;

    public messageEvent = model<MessageActionEvent | null>(null);

    constructor() {
        void ensureEmojiMartReady();
        effect(() => {
            const message = this.editMessage();
            const element = this.inputTextElement?.nativeElement;

            if (!element) {
                return;
            }

            if (message) {
                const content = message.content ?? '';
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

        effect(() => {
            const reply = this.replyTo();
            if (!reply || this.isEditMode()) {
                this.lastFocusedReplyId = null;
                return;
            }

            if (this.lastFocusedReplyId === reply.id) {
                return;
            }

            this.lastFocusedReplyId = reply.id;
            queueMicrotask(() => this.focusInput());
        });

        effect(() => {
            const content = this.draft();
            const reply = this.replyTo();
            if (this.isEditMode()) {
                return;
            }

            saveMessageDraft(
                this.draftKey(),
                content,
                reply?.id ?? null,
                this.draftTtlMs(),
            );
        });
    }

    ngAfterViewInit() {
        const element = this.inputTextElement.nativeElement;
        this.restoreDraft();
        if (element instanceof HTMLTextAreaElement && !element.value.trim() && !this.draft()) {
            element.value = '';
            this.draft.set('');
        }
        if (!(element instanceof HTMLTextAreaElement)) {
            element.style.transition = 'height 160ms ease';
        }
        if (this.mirrorElement) {
            this.initMirror();
        }

        if (!(element instanceof HTMLTextAreaElement)) {
            const computedStyle = getComputedStyle(element);
            const lineHeight = this.cssNum(computedStyle.lineHeight, 24);
            element.style.height = `${lineHeight}px`;
            this.lastHeightPx = lineHeight;
        }

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

        const file_path = message.file_path;

        return Array.isArray(file_path) ? file_path : [];
    }

    restoreDraft(): this {
        if (this.editMessage()) {
            return this;
        }

        const saved = loadMessageDraft(this.draftKey());
        if (!saved) {
            return this;
        }

        this.draft.set(saved.content);
        this.writeComposerText(saved.content);
        queueMicrotask(() => this.autoResizeByRows());

        return this;
    }

    cancelReply(): this {
        this.replyTo.set(null);
        return this;
    }

    formatMaxSize(): string {
        const bytes = this.maxFileSizeBytes();
        if (bytes >= 1024 * 1024) {
            return `${Math.round(bytes / (1024 * 1024))} MB`;
        }
        return `${Math.round(bytes / 1024)} KB`;
    }

    collectAttachmentSources(): string[] {
        const newAttachments = (this.previews() ?? [])
            .filter(item => item.status === 'ready' || (!item.status && !!item.src))
            .map(p => p.src)
            .filter(Boolean);
        if (!this.isEditMode()) {
            return newAttachments;
        }

        const originalAttachments = this.editFilePaths().filter(Boolean);
        return Array.from(new Set([...originalAttachments, ...newAttachments]));
    }

    cancelEditMessage() {
        const message = this.editMessage();
        this.cancelEdit.set(message?.id ?? null);
        queueMicrotask(() => this.cancelEdit.set(null));

        this.draft.set('');
        this.writeComposerText('');
        this.closeEmojiPicker();
        const element = this.inputTextElement?.nativeElement;

        if (element) {
            this.resetComposerHeight();
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

            element.focus({preventScroll: true});
            this.focused.set(true);
            this.setCaretToEnd(element);
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
        this.syncDraftFromComposer();
        const text = this.readComposerText().trim();

        if (!hasComposerText(text) || !this.canSend()) {
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

        const reply = this.replyTo();
        const payload: CurrMessage = message ? {
            id: message.id,
            content: text,
            file_path: files.length ? files : [],
            file_list: fileList.length ? fileList : [],
        } : {
            content: text,
            file_path: files.length ? files : [],
            file_list: fileList.length ? fileList : [],
            reply_to: reply
                ? {id: reply.id, user: reply.user, content: reply.content}
                : null,
        };

        this.input_text.set(payload);

        this.draft.set('');
        this.writeComposerText('');
        this.files.set([]);
        this.previews.set([]);
        this.replyTo.set(null);
        this.fileError.set(null);
        clearMessageDraft(this.draftKey());
        this.closeEmojiPicker();
        element.focus();
        this.resetComposerHeight();

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
            element.setSelectionRange(nextCaret, nextCaret);
            this.composerCaretStart = nextCaret;
            this.composerCaretEnd = nextCaret;
            this.syncDraftFromComposer();
            element.dispatchEvent(new Event('input', {bubbles: true}));
            this.autoResizeByRows();

            return this;
        }

        const currentText = element.innerText ?? '';
        const nextText = `${currentText}${emoji}`;
        element.innerText = nextText;
        this.syncDraftFromComposer();
        element.dispatchEvent(new Event('input', {bubbles: true}));
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
            if (!this.showEmojiButton() || !this.emojiPickerOpen()) {
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

    private async mountEmojiMartPicker() {
        const host = await this.resolvePickerHost();
        if (!host || !this.emojiPickerOpen()) {
            return this;
        }

        const mountGeneration = this.emojiMartMountGeneration;

        try {
            const theme = this.readPickerTheme();
            this.lastPickerTheme = theme;
            const picker = await createEmojiMartPicker({
                theme,
                navPosition: 'none',
                skinTonePosition: 'search',
                emojiSize: 24,
                maxFrequentRows: 2,
                onEmojiSelect: emoji => {
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
        this.syncDraftFromComposer();
        this.autoResizeByRows();

        return this;
    }

    onCompositionEnd() {
        this.syncDraftFromComposer();
        this.autoResizeByRows();

        return this;
    }

    onPaste() {
        queueMicrotask(() => {
            this.syncDraftFromComposer();
            this.autoResizeByRows();
        });

        return this;
    }

    private syncDraftFromComposer(): this {
        this.draft.set(this.readComposerText());

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

    private resetComposerHeight(): this {
        this.lastRows = 0;
        this.autoResizeByRows();
        requestAnimationFrame(() => this.autoResizeByRows());

        return this;
    }

    private autoResizeNativeComposer(element: HTMLTextAreaElement): this {
        const computedStyle = getComputedStyle(element);
        const lineHeight = this.cssNum(
            computedStyle.lineHeight,
            this.cssNum(computedStyle.getPropertyValue('--lh').trim(), 24),
        );
        const paddingTop = this.cssNum(computedStyle.paddingTop, 0);
        const paddingBottom = this.cssNum(computedStyle.paddingBottom, 0);
        const paddingY = paddingTop + paddingBottom;
        const maxRowsCss = computedStyle.getPropertyValue('--max-rows').trim();
        const maxRows = maxRowsCss ? this.cssNum(maxRowsCss, 8) : 8;
        const minHeightPx = Math.round(lineHeight + paddingY);
        const maxHeightPx = Math.round(lineHeight * maxRows + paddingY);

        element.style.transition = 'none';
        element.style.height = '0px';
        const contentHeight = element.scrollHeight;
        const nextHeightPx = Math.max(minHeightPx, Math.min(contentHeight, maxHeightPx));
        const rows = Math.min(
            maxRows,
            Math.max(1, Math.round((nextHeightPx - paddingY) / Math.max(lineHeight, 1))),
        );

        element.style.height = `${nextHeightPx}px`;
        element.rows = rows;
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

        properties.forEach(property => {
            mirror.style.setProperty(property, computedStyle.getPropertyValue(property));
        });
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

    readFileAsDataURL(
        file: File,
        onProgress?: (progress: number) => void,
    ): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onprogress = event => {
                if (event.lengthComputable && onProgress) {
                    onProgress(Math.round((event.loaded / event.total) * 100));
                }
            };
            reader.onload = e => resolve((e.target?.result as string) || '');
            reader.onerror = () => reject(new Error('read_failed'));
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

        const maxBytes = this.maxFileSizeBytes();
        const accepted: File[] = [];
        let hasOversized = false;

        for (const file of list) {
            if (file.size > maxBytes) {
                hasOversized = true;
                const preview: PreviewItem = {
                    src: '',
                    originalKind: (file.type || '') === 'image/gif' ? FileType.GIF : FileType.IMAGE,
                    name: file.name,
                    type: file.type || '',
                    size: file.size,
                    progress: 0,
                    status: 'oversized',
                    error: this.transloco.translate('chat.file_too_large', {max: this.formatMaxSize()}),
                };
                this.previews.set([...(this.previews() ?? []), preview]);
                continue;
            }
            accepted.push(file);
        }

        this.fileError.set(
            hasOversized
                ? this.transloco.translate('chat.file_too_large', {max: this.formatMaxSize()})
                : null,
        );

        if (!accepted.length) {
            return this;
        }

        const startIndex = (this.previews() ?? []).length;
        this.files.set([...(this.files() ?? []), ...accepted]);

        accepted.forEach((file, offset) => {
            const previewIndex = startIndex + offset;
            const originalKind: OriginalKind = (file.type || '') === 'image/gif' ? FileType.GIF : FileType.IMAGE;
            const placeholder: PreviewItem = {
                src: '',
                originalKind,
                name: file.name,
                type: file.type || '',
                size: file.size,
                progress: 0,
                status: 'reading',
                error: null,
            };
            this.previews.set([...(this.previews() ?? []), placeholder]);

            this.readFileAsDataURL(file, progress => {
                this.patchPreview(previewIndex, {progress, status: 'reading'});
            })
                .then(src => {
                    this.patchPreview(previewIndex, {
                        src,
                        progress: 100,
                        status: 'ready',
                        error: null,
                    });
                })
                .catch(() => {
                    this.patchPreview(previewIndex, {
                        progress: 0,
                        status: 'error',
                        error: this.transloco.translate('chat.file_upload_error'),
                    });
                    this.fileError.set(this.transloco.translate('chat.file_upload_error'));
                });
        });

        return this;
    }

    retryPreview(index: number): this {
        const preview = this.previews()[index];
        const file = this.files().find(item => item.name === preview?.name && item.size === preview?.size);
        if (!preview || !file || preview.status === 'oversized') {
            return this;
        }

        this.patchPreview(index, {status: 'reading', progress: 0, error: null});
        this.readFileAsDataURL(file, progress => {
            this.patchPreview(index, {progress, status: 'reading'});
        })
            .then(src => {
                this.patchPreview(index, {src, progress: 100, status: 'ready', error: null});
                this.fileError.set(null);
            })
            .catch(() => {
                this.patchPreview(index, {
                    status: 'error',
                    error: this.transloco.translate('chat.file_upload_error'),
                });
            });

        return this;
    }

    private patchPreview(index: number, patch: Partial<PreviewItem>): this {
        const list = [...(this.previews() ?? [])];
        if (index < 0 || index >= list.length) {
            return this;
        }

        list[index] = {...list[index], ...patch};
        this.previews.set(list);

        return this;
    }

    protected readonly FileType = FileType;
}

function hasComposerText(value: string | null | undefined): boolean {
    if (!value) {
        return false;
    }

    return [...value.trim()].length > 0;
}
