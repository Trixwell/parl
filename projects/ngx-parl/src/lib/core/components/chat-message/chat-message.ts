import {
    Component,
    computed,
    DestroyRef,
    effect,
    ElementRef,
    inject,
    input,
    model,
    SecurityContext,
    signal,
    Signal,
    ViewChild,
} from '@angular/core';
import {DatePipe, NgClass, NgOptimizedImage} from '@angular/common';
import {DomSanitizer} from '@angular/platform-browser';
import {
    ChatMessage,
    MessageReaction,
    MessageType,
    PARL_DEFAULT_REACTION_EMOJIS,
} from '../../entity/chat';
import {MatMenu, MatMenuItem, MatMenuTrigger} from '@angular/material/menu';
import {TranslocoPipe} from '@ngneat/transloco';
import {PreviewFile} from '../preview-file/preview-file';
import {EmojiPicker} from '../emoji-picker/emoji-picker';
import {UtilsService} from '../../service/utils/utils';
import {ensureEmojiMartReady} from '../../service/emoji-mart/emoji-mart';
import {ParlQuickAction, ParlQuickActionClickEvent} from '../../entity/quick-actions';
import {FlowTheme} from '../../entity/theme';

export type ChatMessageUiAction =
    | 'reply'
    | 'goto-reply'
    | 'react'
    | 'copy'
    | 'edit'
    | 'delete'
    | 'pin'
    | 'unpin'
    | 'retry'
    | 'history'
    | 'read'
    | 'select';

export interface ChatMessageActionRequest {
    action: ChatMessageUiAction;
    message: ChatMessage;
    emoji?: string;
}

/** Only one inline reaction picker across all messages. */
const openReactionPickerMessageId = signal<number | null>(null);

@Component({
    selector: 'lib-chat-message',
    imports: [
        NgClass,
        NgOptimizedImage,
        DatePipe,
        MatMenu,
        MatMenuItem,
        MatMenuTrigger,
        TranslocoPipe,
        PreviewFile,
        EmojiPicker,
    ],
    templateUrl: './chat-message.html',
    styleUrl: './chat-message.scss',
    standalone: true,
})

export class ChatMessageComponent {
    private readonly utils = inject(UtilsService);
    private readonly sanitizer = inject(DomSanitizer);
    private readonly destroyRef = inject(DestroyRef);
    private readonly hostElement = inject(ElementRef<HTMLElement>);
    private readonly isCoarsePointer = signal(this.detectCoarsePointer());

    @ViewChild('messageBody') messageBodyRef?: ElementRef<HTMLElement>;

    private longPressTimer: ReturnType<typeof setTimeout> | null = null;
    private longPressOriginX = 0;
    private longPressOriginY = 0;
    private longPressOpened = false;
    private longPressFromPointer = false;
    private readonly longPressDurationMs = 480;
    private readonly longPressMoveThresholdPx = 12;
    private readonly doubleTapWindowMs = 350;
    private readonly doubleTapMoveThresholdPx = 24;
    private lastTapAt = 0;
    private lastTapX = 0;
    private lastTapY = 0;

    private swipeStartX = 0;
    private swipeStartY = 0;
    private swipeActive = false;
    private readonly swipeReplyThresholdPx = 56;

    public currentMessage = input.required<ChatMessage>();
    public edit = model<boolean>(false);
    public previewList = model<string[]>([]);
    public previewIndex = model<number>(0);
    public previewOpener = model<HTMLElement | null>(null);
    public closePreviewHandler = (): this => this.closePreview();
    public highlighted = input<boolean>(false);
    public showUnreadMarker = input<boolean>(false);
    public selectionMode = input<boolean>(false);
    public selected = input<boolean>(false);

    public requestEdit = model<ChatMessage | null>(null);
    public requestDelete = model<number | null>(null);
    public requestMessageActions = model<ChatMessage | null>(null);
    public messageActionRequest = model<ChatMessageActionRequest | null>(null);

    public mobileMode = input<boolean>(false);
    public theme = input<FlowTheme>(FlowTheme.PRIMARY);
    public isSecondaryTheme = computed(() => this.theme() === FlowTheme.SECONDARY);
    public selectCheckIcon = computed(() =>
        this.isSecondaryTheme()
            ? 'assets/ngx-parl/icons/select-check.svg'
            : 'assets/ngx-parl/icons/select-check-primary.svg'
    );
    public language = input<'en' | 'uk'>('en');
    public logoChat = input<string>('');
    public incomingAvatar = input<string>('');
    public quickActions = input<ParlQuickAction[]>([]);
    public quickActionClick = model<ParlQuickActionClickEvent | null>(null);
    public reactionEmojis = input<readonly string[]>(PARL_DEFAULT_REACTION_EMOJIS);

    public readonly messageType = MessageType;
    private readonly anonymAvatarPath = 'assets/ngx-parl/icons/avatar_anonym.svg';
    public readonly avatarLoadFailed = signal(false);
    public readonly showReactionPicker = computed(
        () => openReactionPickerMessageId() === this.currentMessage().id,
    );
    public readonly swipeOffset = signal(0);
    public readonly copyFeedback = signal(false);

    public readonly attachments: Signal<string[]> = computed(() => {
        const message = this.currentMessage();
        const fromFilePath = this.normalizeAttachmentPaths(message.file_path);
        if (fromFilePath.length) {
            return fromFilePath;
        }

        if (this.isMediaSource(message.transport_type)) {
            const normalized = this.utils.normalizeSourcePath(message.transport_type ?? '');
            return normalized ? [normalized] : [];
        }

        return [];
    });

    public readonly avatarSrc: Signal<string> = computed(() => {
        const message = this.currentMessage();
        const anonymFallback = this.anonymAvatarPath;
        const logoTrimmed = (this.logoChat() ?? '').trim();
        const incomingTrimmed = (this.incomingAvatar() ?? '').trim();
        const outgoingFallback =
            logoTrimmed.length > 0 ? logoTrimmed : anonymFallback;
        const incomingFallback =
            incomingTrimmed.length > 0 ? incomingTrimmed : anonymFallback;
        const fallback =
            message.type === this.messageType.Incoming ? incomingFallback : outgoingFallback;
        const raw =
            message.avatar && String(message.avatar).trim().length > 0
                ? message.avatar
                : fallback;
        const normalized = this.utils.normalizeSourcePath(raw);

        return normalized || this.utils.normalizeSourcePath(anonymFallback);
    });

    public readonly displayedAvatarSrc: Signal<string> = computed(() => {
        if (this.avatarLoadFailed()) {
            return this.utils.normalizeSourcePath(this.anonymAvatarPath);
        }

        return this.avatarSrc();
    });

    public readonly safeMessageHtml: Signal<string> = computed(() => {
        const filtered = this.utils.filterAllowedHtml(this.currentMessage().content ?? '');

        return this.sanitizer.sanitize(SecurityContext.HTML, filtered) ?? '';
    });

    public readonly isOutgoingMessage: Signal<boolean> = computed(
        () => this.currentMessage().type === this.messageType.Outgoing,
    );

    public readonly hasQuickActionButtons: Signal<boolean> = computed(
        () => this.isOutgoingMessage() && this.quickActions().length > 0,
    );

    public readonly showMessageBubble: Signal<boolean> = computed(() => {
        const msg = this.currentMessage();
        if (msg.type !== this.messageType.Outgoing) {
            return true;
        }
        if (!this.hasQuickActionButtons()) {
            return true;
        }
        return !!(msg.content && String(msg.content).trim().length > 0);
    });

    public readonly showMessageBody: Signal<boolean> = computed(
        () => this.showMessageBubble()
            || this.attachments().length > 0
            || !!this.currentMessage().reply_to,
    );

    public readonly showAvatar: Signal<boolean> = computed(() => {
        const isMobile = this.mobileMode();
        return !(isMobile && this.isOutgoingMessage());
    });

    public readonly canOpenContextMenu: Signal<boolean> = computed(() => {
        if (this.selectionMode()) {
            return false;
        }

        const message = this.currentMessage();
        return message.pending !== true;
    });

    public readonly showSelectionCheck: Signal<boolean> = computed(() => this.selectionMode());

    public readonly useMobileMessageActions: Signal<boolean> = computed(
        () => this.mobileMode() || this.isCoarsePointer(),
    );

    public readonly reactions: Signal<MessageReaction[]> = computed(
        () => this.currentMessage().reactions ?? [],
    );

    /** A message shows at most one reaction. */
    public readonly primaryReaction: Signal<MessageReaction | null> = computed(() => {
        const list = this.reactions();
        return list.length ? list[0] : null;
    });

    public readonly firstReactionEmoji: Signal<string> = computed(
        () => this.reactionEmojis()[0] ?? '❤️',
    );

    public readonly uploadProgress: Signal<number | null> = computed(() => {
        const upload = this.currentMessage().upload;
        if (!upload || upload.status !== 'uploading') {
            return null;
        }
        return Math.max(0, Math.min(100, Math.round(upload.progress ?? 0)));
    });

    public readonly hasUploadError: Signal<boolean> = computed(() => {
        const upload = this.currentMessage().upload;
        return upload?.status === 'error' || this.currentMessage().failed === true;
    });

    constructor() {
        void ensureEmojiMartReady();
        this.bindCoarsePointerListener();
        this.bindReactionPickerOutsideClose();
        this.destroyRef.onDestroy(() => {
            this.clearLongPressTimer();
            this.closeReactionPicker();
        });
        effect(() => {
            this.avatarSrc();
            this.avatarLoadFailed.set(false);
        });
    }

    onAvatarError(): this {
        if (!this.avatarLoadFailed()) {
            this.avatarLoadFailed.set(true);
        }

        return this;
    }

    openContextMenu(event: Event, trigger: MatMenuTrigger, triggerElement: HTMLElement): this {
        if (this.selectionMode()) {
            event.preventDefault();
            event.stopPropagation();
            return this.emitAction('select');
        }

        if (!this.canOpenContextMenu()) {
            return this;
        }

        event.preventDefault();
        event.stopPropagation();

        if (this.useMobileMessageActions()) {
            return this.openMobileActionSheet();
        }

        const point = this.getEventClientPoint(event);
        if (point) {
            triggerElement.style.setProperty('inset-inline-start', `${point.x}px`);
            triggerElement.style.setProperty('inset-block-start', `${point.y}px`);
            triggerElement.style.removeProperty('left');
            triggerElement.style.removeProperty('top');
        }

        trigger.openMenu();

        return this;
    }

    onMessageClick(event: MouseEvent): this {
        if (!this.selectionMode()) {
            return this;
        }

        event.preventDefault();
        event.stopPropagation();
        return this.emitAction('select');
    }

    onMessageDoubleClick(event: MouseEvent): this {
        if (this.selectionMode() || !this.canOpenContextMenu()) {
            return this;
        }

        event.preventDefault();
        event.stopPropagation();
        return this.reactWithFirstEmoji();
    }

    selectMessage(): this {
        return this.emitAction('select');
    }

    onMessagePointerDown(event: PointerEvent): this {
        if (event.pointerType === 'mouse') {
            return this;
        }

        if (this.selectionMode()) {
            return this;
        }

        this.swipeStartX = event.clientX;
        this.swipeStartY = event.clientY;
        this.swipeActive = true;

        if (!this.canOpenContextMenu() || !this.useMobileMessageActions()) {
            return this;
        }

        this.longPressFromPointer = true;

        return this.beginLongPress(event.clientX, event.clientY, 'select');
    }

    onMessagePointerMove(event: PointerEvent): this {
        if (this.swipeActive) {
            this.updateSwipe(event.clientX, event.clientY);
        }

        return this.updateLongPressPosition(event.clientX, event.clientY);
    }

    onMessageTouchStart(event: TouchEvent): this {
        if (event.touches.length !== 1) {
            this.clearLongPressTimer();
            this.resetSwipe();

            return this;
        }

        if (this.selectionMode()) {
            return this;
        }

        const touch = event.touches[0];
        this.swipeStartX = touch.clientX;
        this.swipeStartY = touch.clientY;
        this.swipeActive = true;

        if (!this.canOpenContextMenu() || !this.useMobileMessageActions()) {
            return this;
        }

        if (this.longPressFromPointer) {
            return this;
        }

        return this.beginLongPress(touch.clientX, touch.clientY, 'select');
    }

    onMessageTouchMove(event: TouchEvent): this {
        if (event.touches.length !== 1) {
            this.clearLongPressTimer();
            this.resetSwipe();

            return this;
        }

        const touch = event.touches[0];
        if (this.swipeActive) {
            this.updateSwipe(touch.clientX, touch.clientY);
        }

        if (this.longPressFromPointer) {
            return this;
        }

        return this.updateLongPressPosition(touch.clientX, touch.clientY);
    }

    onMessageTouchEnd(event?: TouchEvent): this {
        const touch = event?.changedTouches?.[0];
        if (touch && this.swipeActive) {
            this.finishSwipe(touch.clientX);
        }

        if (!this.longPressFromPointer) {
            this.clearLongPressTimer();
        }

        if (touch && !this.longPressFromPointer && !this.selectionMode() && !this.longPressOpened) {
            this.registerTapForDoubleTap(touch.clientX, touch.clientY);
        }

        return this;
    }

    onMessagePointerUp(event: PointerEvent): this {
        if (event.pointerType !== 'mouse' && this.swipeActive) {
            this.finishSwipe(event.clientX);
        }

        if (event.pointerType !== 'mouse' && !this.selectionMode() && !this.longPressOpened) {
            this.registerTapForDoubleTap(event.clientX, event.clientY);
        }

        this.clearLongPressTimer();
        queueMicrotask(() => {
            this.longPressFromPointer = false;
        });

        return this;
    }

    openMobileActionSheet(event?: Event): this {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }

        if (!this.canOpenContextMenu()) {
            return this;
        }

        this.clearLongPressTimer();
        this.closeReactionPicker();
        this.requestMessageActions.set(this.currentMessage());
        queueMicrotask(() => this.requestMessageActions.set(null));

        return this;
    }

    emitAction(action: ChatMessageUiAction, emoji?: string): this {
        this.messageActionRequest.set({
            action,
            message: this.currentMessage(),
            emoji,
        });
        queueMicrotask(() => this.messageActionRequest.set(null));
        this.closeReactionPicker();

        return this;
    }

    editMessage(message: ChatMessage): this {
        this.edit.set(true);
        this.requestEdit.set(message);
        this.emitAction('edit');

        return this;
    }

    replyMessage(): this {
        return this.emitAction('reply');
    }

    openReplyTarget(event: Event): this {
        event.preventDefault();
        event.stopPropagation();

        const replyId = this.currentMessage().reply_to?.id;
        if (replyId == null) {
            return this;
        }

        return this.emitAction('goto-reply');
    }

    pinMessage(): this {
        return this.emitAction(this.currentMessage().pinned ? 'unpin' : 'pin');
    }

    copyMessage(): this {
        const text = this.currentMessage().content ?? '';
        if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
            void navigator.clipboard.writeText(text).then(() => {
                this.copyFeedback.set(true);
                setTimeout(() => this.copyFeedback.set(false), 1200);
            });
        }

        return this.emitAction('copy');
    }

    toggleReactionPicker(): this {
        const messageId = this.currentMessage().id;
        openReactionPickerMessageId.update(currentId =>
            currentId === messageId ? null : messageId,
        );

        return this;
    }

    closeReactionPicker(): this {
        if (openReactionPickerMessageId() === this.currentMessage().id) {
            openReactionPickerMessageId.set(null);
        }

        return this;
    }

    reactWith(emoji: string): this {
        return this.emitAction('react', emoji);
    }

    reactWithFirstEmoji(): this {
        return this.reactWith(this.firstReactionEmoji());
    }

    onReactionPicked(emoji: string | null): this {
        if (!emoji) {
            return this;
        }

        return this.reactWith(emoji);
    }

    toggleReaction(reaction: MessageReaction): this {
        return this.emitAction('react', reaction.emoji);
    }

    private registerTapForDoubleTap(clientX: number, clientY: number): this {
        if (!this.canOpenContextMenu()) {
            return this;
        }

        const now = Date.now();
        const withinTime = now - this.lastTapAt <= this.doubleTapWindowMs;
        const withinDistance =
            Math.abs(clientX - this.lastTapX) <= this.doubleTapMoveThresholdPx &&
            Math.abs(clientY - this.lastTapY) <= this.doubleTapMoveThresholdPx;

        this.lastTapAt = now;
        this.lastTapX = clientX;
        this.lastTapY = clientY;

        if (withinTime && withinDistance) {
            this.lastTapAt = 0;
            this.reactWithFirstEmoji();
        }

        return this;
    }

    retryMessage(): this {
        return this.emitAction('retry');
    }

    openPreview(index: number, event: MouseEvent): this {
        if (this.longPressOpened) {
            event.preventDefault();
            event.stopPropagation();
            this.longPressOpened = false;

            return this;
        }

        const list = this.attachments();
        if (!list.length) {
            return this;
        }

        const opener = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
        this.previewOpener.set(opener);
        this.previewList.set(list);
        this.previewIndex.set(Math.max(0, Math.min(index, list.length - 1)));

        return this;
    }

    closePreview(): this {
        this.previewList.set([]);
        this.previewIndex.set(0);
        this.previewOpener.set(null);

        return this;
    }

    deleteMessage(message: ChatMessage): this {
        this.requestDelete.set(message.id);
        queueMicrotask(() => this.requestDelete.set(null));

        return this;
    }

    onQuickAction(action: ParlQuickAction): this {
        const title = (action.title ?? '').trim();
        const value = (action.value ?? '').trim();
        const content = value || title;
        if (!content) {
            return this;
        }

        const messageId = this.currentMessage().id;
        this.quickActionClick.set({actionId: action.id, messageId, value: content});
        queueMicrotask(() => this.quickActionClick.set(null));

        return this;
    }

    private updateSwipe(clientX: number, clientY: number): this {
        const deltaX = clientX - this.swipeStartX;
        const deltaY = clientY - this.swipeStartY;

        if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 10) {
            this.resetSwipe();
            return this;
        }

        if (Math.abs(deltaX) > this.longPressMoveThresholdPx) {
            this.clearLongPressTimer();
        }

        const direction = this.isOutgoingMessage() ? -1 : 1;
        const offset = Math.max(0, Math.min(72, deltaX * direction));
        this.swipeOffset.set(offset);

        return this;
    }

    private finishSwipe(clientX: number): this {
        if (this.selectionMode()) {
            this.resetSwipe();
            return this;
        }

        const deltaX = clientX - this.swipeStartX;
        const direction = this.isOutgoingMessage() ? -1 : 1;
        const offset = deltaX * direction;

        this.resetSwipe();

        if (offset >= this.swipeReplyThresholdPx && this.canOpenContextMenu()) {
            this.replyMessage();
        }

        return this;
    }

    private resetSwipe(): this {
        this.swipeActive = false;
        this.swipeOffset.set(0);
        return this;
    }

    private detectCoarsePointer(): boolean {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
            return false;
        }

        return window.matchMedia('(pointer: coarse)').matches;
    }

    private bindCoarsePointerListener(): this {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
            return this;
        }

        const mediaQuery = window.matchMedia('(pointer: coarse)');
        const onChange = (event: MediaQueryListEvent) => {
            this.isCoarsePointer.set(event.matches);
        };

        mediaQuery.addEventListener('change', onChange);
        this.destroyRef.onDestroy(() => mediaQuery.removeEventListener('change', onChange));

        return this;
    }

    private bindReactionPickerOutsideClose(): this {
        effect((onCleanup) => {
            if (!this.showReactionPicker() || typeof document === 'undefined') {
                return;
            }

            const onPointerDown = (event: PointerEvent) => {
                const pickerRoot = this.hostElement.nativeElement.querySelector(
                    '.message__emoji-picker, .emoji-picker',
                );
                if (!pickerRoot) {
                    this.closeReactionPicker();

                    return;
                }

                const path = typeof event.composedPath === 'function'
                    ? event.composedPath()
                    : [];
                if (path.includes(pickerRoot)) {
                    return;
                }

                const target = event.target;
                if (target instanceof Node && pickerRoot.contains(target)) {
                    return;
                }

                this.closeReactionPicker();
            };

            // Defer so the menu click that opens the picker does not dismiss it immediately.
            const attachTimer = window.setTimeout(() => {
                document.addEventListener('pointerdown', onPointerDown, true);
            });

            onCleanup(() => {
                window.clearTimeout(attachTimer);
                document.removeEventListener('pointerdown', onPointerDown, true);
            });
        });

        return this;
    }

    private getEventClientPoint(event: Event): {x: number; y: number} | null {
        if (event instanceof MouseEvent) {
            return {x: event.clientX, y: event.clientY};
        }

        const touchEvent = event as TouchEvent;
        const touch = touchEvent.touches?.[0] ?? touchEvent.changedTouches?.[0];
        if (touch) {
            return {x: touch.clientX, y: touch.clientY};
        }

        return null;
    }

    private clearLongPressTimer(): this {
        if (this.longPressTimer !== null) {
            clearTimeout(this.longPressTimer);
            this.longPressTimer = null;
        }

        return this;
    }

    private beginLongPress(
        clientX: number,
        clientY: number,
        action: 'sheet' | 'select' = 'sheet',
    ): this {
        this.clearLongPressTimer();
        this.longPressOpened = false;
        this.longPressOriginX = clientX;
        this.longPressOriginY = clientY;
        this.longPressTimer = setTimeout(() => {
            this.longPressTimer = null;
            this.longPressOpened = true;
            if (action === 'select') {
                this.emitAction('select');
            } else {
                this.openMobileActionSheet();
            }
        }, this.longPressDurationMs);

        return this;
    }

    private updateLongPressPosition(clientX: number, clientY: number): this {
        if (!this.longPressTimer) {
            return this;
        }

        const deltaX = clientX - this.longPressOriginX;
        const deltaY = clientY - this.longPressOriginY;
        if (Math.hypot(deltaX, deltaY) > this.longPressMoveThresholdPx) {
            this.clearLongPressTimer();
        }

        return this;
    }

    private normalizeAttachmentPaths(filePath: string[] | string | null | undefined): string[] {
        if (Array.isArray(filePath)) {
            return filePath.map(path => this.utils.normalizeSourcePath(path)).filter(Boolean);
        }

        const rawFilePath = typeof filePath === 'string' ? filePath.trim() : '';
        if (!rawFilePath) {
            return [];
        }

        if (rawFilePath.startsWith('[')) {
            try {
                const parsed = JSON.parse(rawFilePath) as unknown;
                if (Array.isArray(parsed)) {
                    return parsed
                        .map(item => (typeof item === 'string' ? this.utils.normalizeSourcePath(item) : ''))
                        .filter(Boolean);
                }
            } catch {
            }
        }

        if (rawFilePath.includes('|')) {
            return rawFilePath.split('|').map(path => this.utils.normalizeSourcePath(path)).filter(Boolean);
        }

        if (this.isMediaSource(rawFilePath)) {
            const normalized = this.utils.normalizeSourcePath(rawFilePath);
            return normalized ? [normalized] : [];
        }

        if (rawFilePath.includes(',')) {
            return rawFilePath.split(',').map(path => this.utils.normalizeSourcePath(path)).filter(Boolean);
        }

        return [];
    }

    private isMediaSource(value: string | null | undefined): boolean {
        if (typeof value !== 'string') {
            return false;
        }

        const trimmed = value.trim();
        if (!trimmed) {
            return false;
        }

        return trimmed.startsWith('data:')
            || trimmed.startsWith('blob:')
            || /^https?:\/\//i.test(trimmed)
            || /(?:^|\/)(?:download\/file|files\/media)\//.test(trimmed)
            || trimmed.startsWith('/');
    }
}
