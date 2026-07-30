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
import {ChatMessage} from '../core/entity/chat';
import {ChatMessageComponent} from '../core/components/chat-message/chat-message';
import {TranslocoPipe} from '@ngneat/transloco';
import {NgOptimizedImage} from '@angular/common';
import {InfiniteScrollDirective} from 'ngx-infinite-scroll';
import {ToggleDisplayChatStartDayPipe} from '../core/pipes/toggle-display-chat-start-day-pipe';
import {ChatStartDayPipe} from '../core/pipes/chat-start-day-pipe';
import {UtilsService} from '../core/service/utils/utils';
import {
    ParlQuickAction,
    ParlQuickActionClickEvent,
    ParlQuickActionsResolver,
    resolveParlQuickActions,
} from '../core/entity/quick-actions';

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

    private utils = inject(UtilsService);
    private injector = inject(Injector);

    public scrollToBottomTrigger = model<number>(0);
    public loadHistory = model<boolean>(false);

    public messageListInput = model.required<ChatMessage[]>();
    public messageList = computed(() => this.messageListInput());
    public hasMessages = computed(() => this.messageList().length > 0);

    public selectedForEdit = model.required<ChatMessage | null>();
    public requestDelete = model<number | null>(null);

    public language = input<'en' | 'uk'>('en');
    public mobileMode = input<boolean>(false);
    public logoChat = input<string>('');
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

    public quickActionsByMessageId = computed(() => {
        const messages = this.messageList();
        const resolver = this.quickActionsResolver();
        const isMobile = this.mobileMode();
        const map = new Map<number, ParlQuickAction[]>();

        for (const message of messages) {
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

    public showScrollToBottom = signal(false);

    public historyLoadThreshold = signal(1);

    constructor() {
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

            if (hasFewerMessages) {
                this.pendingHistoryRestore = true;
                queueMicrotask(() => this.loadHistory.set(true));
            }

            this.previousMessageCount = messages.length;
            this.previousFirstMessageId = firstMessageId;
            this.previousLastMessageId = lastMessageId;
        });

        effect(() => {
            this.scrollToBottomTrigger();

            if (this.viewInitialized && this.hasMessages()) {
                queueMicrotask(() => this.scrollToBottomSmooth());
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
        this.scrollContainerReady = false;
        this.showScrollToBottom.set(false);

        return this;
    }

    onScrollUp(): this {
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

    private observeScrollContainerForEmptySpace(element: HTMLElement): void {
        const checkAndLoadIfNeeded = () => {
            if (
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

    closeDeleteConfirm(): this {
        this.deleteConfirmOpen.set(false);
        this.pendingDeleteMessageId.set(null);
        return this;
    }

    confirmDelete(): this {
        const messageId = this.pendingDeleteMessageId();
        if (messageId == null) {
            return this.closeDeleteConfirm();
        }

        this.closeDeleteConfirm();
        this.requestDelete.set(messageId);
        queueMicrotask(() => this.requestDelete.set(null));
        return this;
    }

    trackByMessageId(index: number, message: ChatMessage): string {
        return `${message.chat_id}-${message.type}-${message.id}-${index}`;
    }

    protected readonly Math = Math;
}
