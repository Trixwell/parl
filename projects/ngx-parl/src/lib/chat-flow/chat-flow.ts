import {
    AfterViewInit,
    afterNextRender,
    Component,
    computed,
    effect,
    ElementRef,
    inject,
    Injector,
    input,
    model,
    OnDestroy,
    signal,
    ViewEncapsulation,
    ViewChild,
} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {ChatMessage, MessageType, PARL_DEFAULT_REACTION_EMOJIS} from '../core/entity/chat';
import {
    ChatMessageActionRequest,
    ChatMessageComponent,
    ChatMessageUiAction,
} from '../core/components/chat-message/chat-message';
import {TranslocoPipe} from '@ngneat/transloco';
import {DatePipe, NgOptimizedImage} from '@angular/common';
import {InfiniteScrollDirective} from 'ngx-infinite-scroll';
import {ToggleDisplayChatStartDayPipe} from '../core/pipes/toggle-display-chat-start-day-pipe';
import {ChatStartDayPipe} from '../core/pipes/chat-start-day-pipe';
import {UtilsService} from '../core/service/utils/utils';
import {FlowTheme} from '../core/entity/theme';
import {
    ParlQuickAction,
    ParlQuickActionClickEvent,
    ParlQuickActionsResolver,
    ParlQuickActionsWhen,
    resolveParlQuickActions,
} from '../core/entity/quick-actions';
import {ensureEmojiMartReady} from '../core/service/emoji-mart/emoji-mart';

@Component({
    selector: 'app-chat-flow',
    imports: [
        FormsModule,
        ChatMessageComponent,
        TranslocoPipe,
        NgOptimizedImage,
        InfiniteScrollDirective,
        ToggleDisplayChatStartDayPipe,
        ChatStartDayPipe,
    ],
    templateUrl: './chat-flow.html',
    styleUrl: './chat-flow.scss',
    standalone: true,
    encapsulation: ViewEncapsulation.None,
})

export class ChatFlowComponent implements AfterViewInit, OnDestroy {
    @ViewChild('chatFlowRef') flowRef?: ElementRef<HTMLElement>;
    @ViewChild('deleteConfirmDialog') deleteConfirmDialog?: ElementRef<HTMLElement>;
    @ViewChild('messageActionsDialog') messageActionsDialog?: ElementRef<HTMLElement>;
    @ViewChild('searchInput') searchInputRef?: ElementRef<HTMLInputElement>;

    private utils = inject(UtilsService);
    private injector = inject(Injector);

    public scrollToBottomTrigger = model<number>(0);
    public loadHistory = model<boolean>(false);
    public scrollToMessageId = model<number | null>(null);

    public messageListInput = model.required<ChatMessage[]>();
    public messageList = computed(() => this.messageListInput());
    public hasMessages = computed(() => this.messageList().length > 0);

    public selectedForEdit = model.required<ChatMessage | null>();
    public replyTo = model<ChatMessage | null>(null);
    public requestDelete = model<number | null>(null);
    public messageUiAction = model<ChatMessageActionRequest | null>(null);
    public pendingActionsMessage = signal<ChatMessage | null>(null);
    public messageActionsOpen = signal(false);
    public reactionPickerOpen = signal(false);

    public language = input<'en' | 'uk'>('en');
    public mobileMode = input<boolean>(false);
    public theme = input<FlowTheme>(FlowTheme.PRIMARY);
    public isSecondaryTheme = computed(() => this.theme() === FlowTheme.SECONDARY);
    public selectCheckIcon = computed(() =>
        this.isSecondaryTheme()
            ? 'assets/ngx-parl/icons/select-check.svg'
            : 'assets/ngx-parl/icons/select-check-primary.svg'
    );
    public hasMoreHistory = input<boolean>(true);
    public enableSearch = input<boolean>(true);
    public quickActionsWhen = input<ParlQuickActionsWhen>(ParlQuickActionsWhen.ALWAYS);
    public logoChat = input<string>('');
    public incomingAvatar = input<string>('');
    public reactionEmojis = input<readonly string[]>(PARL_DEFAULT_REACTION_EMOJIS);
    public logoChatSrc = computed(() => {
        const trimmed = (this.logoChat() ?? '').trim();
        const path =
            trimmed.length > 0
                ? trimmed
                : 'assets/ngx-parl/icons/avatar_anonym.svg';

        return this.utils.normalizeSourcePath(path);
    });

    public quickActionsResolver = input<ParlQuickActionsResolver | null>(null);
    public quickActionClick = model<ParlQuickActionClickEvent | null>(null);

    public deleteConfirmOpen = signal(false);
    public pendingDeleteMessageId = signal<number | null>(null);
    public pendingDeleteIds = signal<number[]>([]);
    public messageActionsInteractive = signal(true);
    private messageActionsGuardTimer: ReturnType<typeof setTimeout> | null = null;

    public searchQuery = signal('');
    public searchMatchIds = signal<number[]>([]);
    public searchMatchIndex = signal(0);
    public highlightedMessageId = signal<number | null>(null);
    public pinnedPreviewIndex = signal(0);
    public selectedMessageIds = signal<number[]>([]);

    public selectionMode = computed(() => this.selectedMessageIds().length > 0);

    public selectedCount = computed(() => this.selectedMessageIds().length);

    public selectedMessages = computed(() => {
        const ids = new Set(this.selectedMessageIds());
        return this.messageList().filter(message => ids.has(message.id));
    });

    public canReplySelected = computed(() => this.selectedCount() === 1);

    public canDeleteSelected = computed(() => {
        const selected = this.selectedMessages();
        return selected.length > 0
            && selected.every(message => message.type === MessageType.Outgoing && !message.pending);
    });

    public selectedIdsSet = computed(() => new Set(this.selectedMessageIds()));

    /** All pinned messages in chat order (Telegram-style multi-pin). */
    public pinnedMessages = computed(() =>
        this.messageList().filter(message => message.pinned),
    );

    public activePinnedMessage = computed(() => {
        const pins = this.pinnedMessages();
        if (!pins.length) {
            return null;
        }

        const index = ((this.pinnedPreviewIndex() % pins.length) + pins.length) % pins.length;
        return pins[index];
    });

    public pinnedPreviewLabel = computed(() => {
        const pins = this.pinnedMessages();
        if (pins.length <= 1) {
            return null;
        }

        return {
            current: (this.pinnedPreviewIndex() % pins.length) + 1,
            total: pins.length,
        };
    });

    public firstUnreadMessageId = computed(() => {
        const unread = this.messageList().find(
            message => message.unread === true && message.type === MessageType.Incoming,
        );
        return unread?.id ?? null;
    });

    public unreadCount = computed(() =>
        this.messageList().filter(
            message => message.unread === true && message.type === MessageType.Incoming,
        ).length,
    );

    public quickActionsByMessageId = computed(() => {
        const messages = this.messageList();
        const resolver = this.quickActionsResolver();
        const isMobile = this.mobileMode();
        const when = this.quickActionsWhen();
        const map = new Map<number, ParlQuickAction[]>();

        if (when === ParlQuickActionsWhen.NEVER) {
            return map;
        }

        for (const message of messages) {
            if (when === ParlQuickActionsWhen.MOBILE && !isMobile) {
                continue;
            }

            const actions = resolveParlQuickActions({message, isMobile}, resolver);
            if (actions.length > 0) {
                map.set(message.id, actions);
            }
        }

        return map;
    });

    private viewInitialized = false;
    private scrollContainerReady = false;
    private previousMessageCount = 0;
    private previousFirstMessageId: number | null = null;
    private previousLastMessageId: number | null = null;
    private pendingHistoryRestore = false;

    private previousScrollHeight = 0;
    private previousScrollTop = 0;
    private isUserAtBottom = true;
    private resizeObserver: ResizeObserver | null = null;
    private scrollListener: (() => void) | null = null;
    private intersectionObserver: IntersectionObserver | null = null;

    public showScrollToBottom = signal(false);

    public historyLoadThreshold = signal(1);

    constructor() {
        void ensureEmojiMartReady();
        effect(() => {
            const messages = this.messageList();
            const firstMessageId = messages[0]?.id ?? null;
            const lastMessageId = messages.at(-1)?.id ?? null;

            if (!this.viewInitialized) {
                this.previousMessageCount = messages.length;
                this.previousFirstMessageId = firstMessageId;
                this.previousLastMessageId = lastMessageId;
                return;
            }

            if (messages.length === 0) {
                this.teardownScrollContainer();
                this.previousMessageCount = 0;
                this.previousFirstMessageId = null;
                this.previousLastMessageId = null;
                return;
            }

            if (!this.scrollContainerReady) {
                afterNextRender(() => this.setupScrollContainer(), {injector: this.injector});
            }

            const hasMoreMessages = messages.length > this.previousMessageCount;
            const hasFewerMessages = messages.length < this.previousMessageCount;
            const hasPrependedMessages =
                hasMoreMessages &&
                this.previousFirstMessageId !== null &&
                firstMessageId !== this.previousFirstMessageId;
            const hasAppendedMessages =
                hasMoreMessages &&
                this.previousLastMessageId !== null &&
                lastMessageId !== this.previousLastMessageId;

            const shouldRestoreHistory =
                !this.isUserAtBottom &&
                hasMoreMessages &&
                (hasPrependedMessages || (this.pendingHistoryRestore && !hasAppendedMessages));

            if (shouldRestoreHistory) {
                this.restoreScrollAfterHistoryPrepend();
                this.pendingHistoryRestore = false;
            }

            if (hasMoreMessages && this.isUserAtBottom) {
                queueMicrotask(() => this.scrollToBottom());
            }

            if (hasMoreMessages && hasAppendedMessages && !hasPrependedMessages) {
                this.pendingHistoryRestore = false;
            }

            if (hasFewerMessages && this.hasMoreHistory()) {
                this.pendingHistoryRestore = true;
                queueMicrotask(() => this.loadHistory.set(true));
            }

            this.previousMessageCount = messages.length;
            this.previousFirstMessageId = firstMessageId;
            this.previousLastMessageId = lastMessageId;

            queueMicrotask(() => this.observeUnreadMessages());
        });

        effect(() => {
            this.scrollToBottomTrigger();

            if (this.viewInitialized && this.hasMessages()) {
                queueMicrotask(() => this.scrollToBottomSmooth());
            }
        });

        effect(() => {
            const messageId = this.scrollToMessageId();
            if (messageId == null) {
                return;
            }

            queueMicrotask(() => {
                this.scrollToMessage(messageId, true);
                this.scrollToMessageId.set(null);
            });
        });

        effect(() => {
            const query = this.searchQuery().trim().toLowerCase();
            if (!query) {
                this.searchMatchIds.set([]);
                this.searchMatchIndex.set(0);
                return;
            }

            const matches = this.messageList()
                .filter(message => (message.content ?? '').toLowerCase().includes(query))
                .map(message => message.id);

            this.searchMatchIds.set(matches);
            this.searchMatchIndex.set(0);

            if (matches.length) {
                queueMicrotask(() => this.scrollToMessage(matches[0], true));
            }
        });

        effect(() => {
            const pins = this.pinnedMessages();
            if (!pins.length) {
                this.pinnedPreviewIndex.set(0);
                return;
            }

            if (this.pinnedPreviewIndex() >= pins.length) {
                this.pinnedPreviewIndex.set(pins.length - 1);
            }
        });
    }

    ngAfterViewInit(): void {
        this.viewInitialized = true;
        afterNextRender(() => this.setupScrollContainer(), {injector: this.injector});
    }

    private setupScrollContainer(): this {
        const element = this.flowRef?.nativeElement;
        if (!this.hasMessages() || !element || this.scrollContainerReady) {
            return this;
        }

        this.scrollContainerReady = true;
        this.scrollListener = () => {
            this.previousScrollHeight = element.scrollHeight;
            this.previousScrollTop = element.scrollTop;

            this.isUserAtBottom =
                element.scrollTop + element.clientHeight >=
                element.scrollHeight - 10;
            this.showScrollToBottom.set(!this.isUserAtBottom);
        };
        element.addEventListener('scroll', this.scrollListener);

        queueMicrotask(() => this.scrollToBottom());
        this.observeScrollContainerForEmptySpace(element);
        this.observeUnreadMessages();

        return this;
    }

    private teardownScrollContainer(): this {
        const element = this.flowRef?.nativeElement;
        if (element && this.scrollListener) {
            element.removeEventListener('scroll', this.scrollListener);
        }

        this.scrollListener = null;
        this.resizeObserver?.disconnect();
        this.resizeObserver = null;
        this.intersectionObserver?.disconnect();
        this.intersectionObserver = null;
        this.scrollContainerReady = false;
        this.showScrollToBottom.set(false);

        return this;
    }

    private observeUnreadMessages(): this {
        const root = this.flowRef?.nativeElement;
        if (!root || typeof IntersectionObserver === 'undefined') {
            return this;
        }

        this.intersectionObserver?.disconnect();
        this.intersectionObserver = new IntersectionObserver(
            entries => {
                for (const entry of entries) {
                    if (!entry.isIntersecting) {
                        continue;
                    }

                    const messageId = Number((entry.target as HTMLElement).dataset['messageId']);
                    if (!Number.isFinite(messageId)) {
                        continue;
                    }

                    const message = this.messageList().find(item => item.id === messageId);
                    if (!message || !message.unread) {
                        continue;
                    }

                    this.emitUiAction({action: 'read' as ChatMessageUiAction, message});
                }
            },
            {root, threshold: 0.6},
        );

        root.querySelectorAll<HTMLElement>('[data-message-id]').forEach(node => {
            this.intersectionObserver?.observe(node);
        });

        return this;
    }

    onScrollUp(): this {
        if (!this.hasMoreHistory()) {
            return this;
        }

        this.pendingHistoryRestore = true;
        this.loadHistory.set(true);

        setTimeout(() => this.loadHistory.set(false), 0);

        return this;
    }

    restoreScrollAfterHistoryPrepend(): this {
        const element = this.flowRef?.nativeElement;
        if (!element) {
            return this;
        }

        const savedScrollTop = this.previousScrollTop;
        const savedScrollHeight = this.previousScrollHeight;

        queueMicrotask(() => {
            const newScrollHeight = element.scrollHeight;
            const heightDiff = newScrollHeight - savedScrollHeight;
            const previousBehavior = element.style.scrollBehavior;
            element.style.scrollBehavior = 'auto';
            element.scrollTop = savedScrollTop + heightDiff;
            element.style.scrollBehavior = previousBehavior;
        });

        return this;
    }

    scrollToBottomSmooth(): this {
        const element = this.flowRef?.nativeElement;
        if (!element) {
            return this;
        }

        element.scrollTo({
            top: element.scrollHeight,
            behavior: 'smooth',
        });
        this.isUserAtBottom = true;
        this.showScrollToBottom.set(false);

        return this;
    }

    scrollToBottom(): this {
        const element = this.flowRef?.nativeElement;
        if (!element) {
            return this;
        }

        element.scrollTop = element.scrollHeight;
        this.isUserAtBottom = true;
        this.showScrollToBottom.set(false);
        return this;
    }

    isAtBottom(): boolean {
        return this.isUserAtBottom;
    }

    scrollToMessage(messageId: number, highlight = false): this {
        const root = this.flowRef?.nativeElement;
        if (!root) {
            return this;
        }

        const target = root.querySelector<HTMLElement>(`[data-message-id="${messageId}"]`);
        if (!target) {
            return this;
        }

        // Scroll only inside .chat__flow — never use scrollIntoView (it moves the page
        // and can hide the pinned bar / leave empty space under the composer).
        const rootRect = root.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        const offset =
            root.scrollTop +
            (targetRect.top - rootRect.top) -
            root.clientHeight / 2 +
            targetRect.height / 2;
        const maxScroll = Math.max(0, root.scrollHeight - root.clientHeight);
        const nextTop = Math.max(0, Math.min(offset, maxScroll));
        root.scrollTo({
            top: nextTop,
            behavior: 'smooth',
        });

        this.isUserAtBottom = nextTop >= maxScroll - 10;
        this.showScrollToBottom.set(!this.isUserAtBottom);

        if (highlight) {
            this.highlightedMessageId.set(messageId);
            setTimeout(() => {
                if (this.highlightedMessageId() === messageId) {
                    this.highlightedMessageId.set(null);
                }
            }, 1600);
        }

        return this;
    }

    toggleSearch(): this {
        return this.clearSearchQuery();
    }

    onSearchInput(event: Event): this {
        const value = (event.target as HTMLInputElement).value ?? '';
        this.searchQuery.set(value);
        return this;
    }

    clearSearchQuery(): this {
        this.searchQuery.set('');
        this.highlightedMessageId.set(null);
        queueMicrotask(() => this.searchInputRef?.nativeElement.focus());
        return this;
    }

    onSearchKeydown(event: KeyboardEvent): this {
        if (event.key === 'Escape') {
            event.preventDefault();
            return this.clearSearchQuery();
        }

        if (event.key === 'Enter') {
            event.preventDefault();
            return this.goToSearchMatch(event.shiftKey ? -1 : 1);
        }

        return this;
    }

    goToSearchMatch(direction: 1 | -1): this {
        const matches = this.searchMatchIds();
        if (!matches.length) {
            return this;
        }

        const nextIndex = (this.searchMatchIndex() + direction + matches.length) % matches.length;
        this.searchMatchIndex.set(nextIndex);
        this.scrollToMessage(matches[nextIndex], true);

        return this;
    }

    jumpToPinned(): this {
        const pins = this.pinnedMessages();
        if (!pins.length) {
            return this;
        }

        const index = ((this.pinnedPreviewIndex() % pins.length) + pins.length) % pins.length;
        const current = pins[index];
        this.scrollToMessage(current.id, true);

        // Telegram: each tap advances to the next pinned message.
        if (pins.length > 1) {
            this.pinnedPreviewIndex.set((index + 1) % pins.length);
        }

        return this;
    }

    selectPinnedPreview(index: number): this {
        const pins = this.pinnedMessages();
        if (index < 0 || index >= pins.length) {
            return this;
        }

        this.pinnedPreviewIndex.set(index);
        this.scrollToMessage(pins[index].id, true);

        return this;
    }

    private observeScrollContainerForEmptySpace(element: HTMLElement): void {
        const checkAndLoadIfNeeded = () => {
            if (
                this.hasMoreHistory() &&
                this.messageList().length > 0 &&
                element.scrollHeight <= element.clientHeight + 10 &&
                !this.loadHistory()
            ) {
                this.pendingHistoryRestore = true;
                this.loadHistory.set(true);
            }
        };

        this.resizeObserver = new ResizeObserver(() => {
            requestAnimationFrame(checkAndLoadIfNeeded);
        });

        this.resizeObserver.observe(element);
    }

    ngOnDestroy(): void {
        this.teardownScrollContainer();
        this.clearMessageActionsGuard();
    }

    startEdit(message: ChatMessage): this {
        this.messageList().forEach(current => {
            if (current.id !== message.id && current.edit) {
                current.edit = false;
            }
        });

        message.edit = true;

        if (this.selectedForEdit()?.id === message.id) {
            this.selectedForEdit.set(null);
            queueMicrotask(() => this.selectedForEdit.set(message));
        } else {
            this.selectedForEdit.set(message);
        }

        return this;
    }

    onEditChange(id: number, isEdit: boolean): this {
        const message = this.messageList().find(item => item.id === id);
        if (!message) {
            return this;
        }

        if (isEdit) {
            return this.startEdit(message);
        }

        message.edit = false;

        if (this.selectedForEdit()?.id === id) {
            this.selectedForEdit.set(null);
        }

        return this;
    }

    onRequestEdit(message: ChatMessage | null): this {
        if (message) {
            return this.startEdit(message);
        }

        this.selectedForEdit.set(null);
        return this;
    }

    onRequestDelete(messageId: number | null): this {
        if (messageId == null) {
            return this;
        }

        this.selectedForEdit.set(null);
        this.pendingDeleteMessageId.set(messageId);
        this.deleteConfirmOpen.set(true);
        afterNextRender(() => this.deleteConfirmDialog?.nativeElement.focus(), {injector: this.injector});

        return this;
    }

    onRequestMessageActions(message: ChatMessage | null): this {
        if (!message) {
            return this;
        }

        this.pendingActionsMessage.set(message);
        this.messageActionsOpen.set(true);
        this.reactionPickerOpen.set(false);
        this.messageActionsInteractive.set(false);
        this.clearMessageActionsGuard();
        this.messageActionsGuardTimer = setTimeout(() => {
            this.messageActionsInteractive.set(true);
            this.messageActionsGuardTimer = null;
        }, 400);
        afterNextRender(() => this.messageActionsDialog?.nativeElement.focus(), {injector: this.injector});

        return this;
    }

    onMessageUiAction(request: ChatMessageActionRequest | null): this {
        if (!request) {
            return this;
        }

        if (request.action === 'reply') {
            this.replyTo.set(request.message);
            return this.emitUiAction(request);
        }

        if (request.action === 'goto-reply') {
            const replyId = request.message.reply_to?.id;
            if (replyId != null) {
                this.scrollToMessage(replyId, true);
            }
            return this;
        }

        if (request.action === 'select') {
            return this.toggleMessageSelection(request.message);
        }

        if (request.action === 'edit') {
            return this.startEdit(request.message);
        }

        if (request.action === 'delete') {
            return this.onRequestDelete(request.message.id);
        }

        return this.emitUiAction(request);
    }

    emitUiAction(request: ChatMessageActionRequest): this {
        this.messageUiAction.set(request);
        queueMicrotask(() => this.messageUiAction.set(null));
        return this;
    }

    closeMessageActions(): this {
        this.clearMessageActionsGuard();
        this.messageActionsOpen.set(false);
        this.pendingActionsMessage.set(null);
        this.messageActionsInteractive.set(true);
        this.reactionPickerOpen.set(false);

        return this;
    }

    onMessageActionsBackdropClick(): this {
        if (!this.messageActionsInteractive()) {
            return this;
        }

        return this.closeMessageActions();
    }

    onMessageActionsEdit(): this {
        const message = this.pendingActionsMessage();
        this.closeMessageActions();
        if (message) {
            return this.startEdit(message);
        }

        return this;
    }

    onMessageActionsDelete(): this {
        const message = this.pendingActionsMessage();
        this.closeMessageActions();
        if (message) {
            return this.onRequestDelete(message.id);
        }

        return this;
    }

    onMessageActionsReply(): this {
        const message = this.pendingActionsMessage();
        this.closeMessageActions();
        if (message) {
            this.replyTo.set(message);
        }
        return this;
    }

    toggleMessageSelection(message: ChatMessage): this {
        const id = message.id;
        this.selectedMessageIds.update(ids => {
            if (ids.includes(id)) {
                return ids.filter(item => item !== id);
            }
            return [...ids, id];
        });
        this.closeMessageActions();
        return this;
    }

    clearSelection(): this {
        this.selectedMessageIds.set([]);
        return this;
    }

    replyToSelected(): this {
        if (!this.canReplySelected()) {
            return this;
        }

        const message = this.selectedMessages()[0];
        if (!message) {
            return this;
        }

        this.replyTo.set(message);
        this.clearSelection();
        this.emitUiAction({action: 'reply', message});
        return this;
    }

    deleteSelected(): this {
        if (!this.canDeleteSelected()) {
            return this;
        }

        const ids = this.selectedMessages()
            .filter(message => message.type === MessageType.Outgoing)
            .map(message => message.id);

        if (!ids.length) {
            return this;
        }

        this.pendingDeleteMessageId.set(ids[0]);
        this.pendingDeleteIds.set(ids);
        this.deleteConfirmOpen.set(true);
        afterNextRender(() => this.deleteConfirmDialog?.nativeElement.focus(), {injector: this.injector});
        return this;
    }

    onMessageActionsSelect(): this {
        const message = this.pendingActionsMessage();
        this.closeMessageActions();
        if (message) {
            return this.toggleMessageSelection(message);
        }
        return this;
    }

    onMessageActionsCopy(): this {
        const message = this.pendingActionsMessage();
        this.closeMessageActions();
        if (message) {
            if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
                void navigator.clipboard.writeText(message.content ?? '');
            }
            this.emitUiAction({action: 'copy', message});
        }
        return this;
    }

    onMessageActionsPin(): this {
        const message = this.pendingActionsMessage();
        this.closeMessageActions();
        if (message) {
            this.emitUiAction({action: message.pinned ? 'unpin' : 'pin', message});
        }
        return this;
    }

    onMessageActionsReact(): this {
        this.reactionPickerOpen.update(open => !open);
        return this;
    }

    onMessageActionsPickReaction(emoji: string): this {
        const message = this.pendingActionsMessage();
        this.closeMessageActions();
        if (message) {
            this.emitUiAction({action: 'react', message, emoji});
        }
        return this;
    }

    onMessageActionsRetry(): this {
        const message = this.pendingActionsMessage();
        this.closeMessageActions();
        if (message) {
            this.emitUiAction({action: 'retry', message});
        }
        return this;
    }

    closeDeleteConfirm(): this {
        this.deleteConfirmOpen.set(false);
        this.pendingDeleteMessageId.set(null);
        this.pendingDeleteIds.set([]);
        return this;
    }

    confirmDelete(): this {
        const bulkIds = this.pendingDeleteIds();
        const singleId = this.pendingDeleteMessageId();
        const ids = bulkIds.length > 0
            ? bulkIds
            : (singleId != null ? [singleId] : []);

        this.closeDeleteConfirm();
        this.clearSelection();

        ids.forEach((messageId, index) => {
            setTimeout(() => {
                this.requestDelete.set(messageId);
                queueMicrotask(() => this.requestDelete.set(null));
            }, index);
        });

        return this;
    }

    trackByMessageId(index: number, message: ChatMessage): string {
        return `${message.chat_id}-${message.type}-${message.id}-${index}`;
    }

    private clearMessageActionsGuard(): this {
        if (this.messageActionsGuardTimer !== null) {
            clearTimeout(this.messageActionsGuardTimer);
            this.messageActionsGuardTimer = null;
        }

        return this;
    }

    protected readonly Math = Math;
}
