import {Component, computed, DestroyRef, effect, inject, input, model, signal, Signal} from '@angular/core';
import {DatePipe, NgClass} from '@angular/common';
import {ChatMessage, MessageType} from '../../entity/chat';
import {MatMenu, MatMenuItem, MatMenuTrigger} from '@angular/material/menu';
import {TranslocoPipe} from '@ngneat/transloco';
import {PreviewFile} from '../preview-file/preview-file';
import {UtilsService} from '../../service/utils/utils';
import {ParlAssets} from '../../service/parl-assets';
import {ParlQuickAction, ParlQuickActionClickEvent} from '../../entity/quick-actions';

@Component({
    selector: 'lib-chat-message',
    imports: [
        NgClass,
        DatePipe,
        MatMenu,
        MatMenuItem,
        MatMenuTrigger,
        TranslocoPipe,
        PreviewFile,
    ],
    templateUrl: './chat-message.html',
    styleUrl: './chat-message.scss',
    standalone: true,
})

export class ChatMessageComponent {
    private readonly utils = inject(UtilsService);
    public parlAssets = inject(ParlAssets);
    private readonly destroyRef = inject(DestroyRef);
    private readonly isCoarsePointer = signal(this.detectCoarsePointer());

    private longPressTimer: ReturnType<typeof setTimeout> | null = null;
    private longPressOriginX = 0;
    private longPressOriginY = 0;
    private longPressOpened = false;
    private longPressFromPointer = false;
    private readonly longPressDurationMs = 480;
    private readonly longPressMoveThresholdPx = 12;

    public currentMessage = input.required<ChatMessage>();
    public edit = model<boolean>(false);
    public previewList = model<string[]>([]);
    public previewIndex = model<number>(0);
    public previewOpener = model<HTMLElement | null>(null);
    public closePreviewHandler = (): this => this.closePreview();

    public requestEdit = model<ChatMessage | null>(null);
    public requestDelete = model<number | null>(null);
    public requestMessageActions = model<ChatMessage | null>(null);

    public mobileMode = input<boolean>(false);
    public language = input<'en' | 'uk'>('en');
    public logoChat = input<string>('');
    public incomingAvatar = input<string>('');
    public quickActions = input<ParlQuickAction[]>([]);
    public quickActionClick = model<ParlQuickActionClickEvent | null>(null);

    public readonly messageType = MessageType;
    private readonly anonymAvatarPath = this.parlAssets.icon('avatar_anonym.svg');
    public readonly avatarLoadFailed = signal(false);

    public readonly attachments: Signal<string[]> = computed(() => {
        const message = this.currentMessage();
        const filePath = message.file_path;

        if (Array.isArray(filePath)) {
            return filePath.map(p => this.utils.normalizeSourcePath(p)).filter(Boolean);
        }

        const rawFilePath = (filePath as unknown as string) ?? '';
        if (typeof rawFilePath !== 'string' || !rawFilePath.trim) {
            return [];
        }

        if (rawFilePath.trim().startsWith('[')) {
            try {
                const parsed = JSON.parse(rawFilePath);
                if (Array.isArray(parsed)) {
                    return parsed
                        .map(item => (typeof item === 'string' ? this.utils.normalizeSourcePath(item) : ''))
                        .filter(Boolean);
                }
            } catch {
            }
        }

        if (rawFilePath.startsWith('data:')) {
            return [rawFilePath];
        }

        if (rawFilePath.includes('|')) {
            return rawFilePath.split('|').map(p => this.utils.normalizeSourcePath(p)).filter(Boolean);
        }
        if (rawFilePath.includes(',')) {
            return rawFilePath.split(',').map(p => this.utils.normalizeSourcePath(p)).filter(Boolean);
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
        () => this.showMessageBubble() || this.attachments().length > 0,
    );

    public readonly showAvatar: Signal<boolean> = computed(() => {
        const isMobile = this.mobileMode();
        return !(isMobile && this.isOutgoingMessage());
    });

    public readonly canOpenContextMenu: Signal<boolean> = computed(() => {
        const message = this.currentMessage();
        return message.type === this.messageType.Outgoing && message.pending !== true;
    });

    public readonly useMobileMessageActions: Signal<boolean> = computed(
        () => this.mobileMode() || this.isCoarsePointer(),
    );

    constructor() {
        this.bindCoarsePointerListener();
        this.destroyRef.onDestroy(() => this.clearLongPressTimer());
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

    onMessagePointerDown(event: PointerEvent): this {
        if (!this.canOpenContextMenu() || !this.useMobileMessageActions()) {
            return this;
        }

        if (event.pointerType === 'mouse') {
            return this;
        }

        this.longPressFromPointer = true;

        return this.beginLongPress(event.clientX, event.clientY);
    }

    onMessagePointerMove(event: PointerEvent): this {
        return this.updateLongPressPosition(event.clientX, event.clientY);
    }

    onMessagePointerUp(): this {
        this.clearLongPressTimer();
        queueMicrotask(() => {
            this.longPressFromPointer = false;
        });

        return this;
    }

    onMessageTouchStart(event: TouchEvent): this {
        if (!this.canOpenContextMenu() || !this.useMobileMessageActions()) {
            return this;
        }

        if (this.longPressFromPointer) {
            return this;
        }

        if (event.touches.length !== 1) {
            this.clearLongPressTimer();

            return this;
        }

        const touch = event.touches[0];

        return this.beginLongPress(touch.clientX, touch.clientY);
    }

    onMessageTouchMove(event: TouchEvent): this {
        if (this.longPressFromPointer) {
            return this;
        }

        if (event.touches.length !== 1) {
            this.clearLongPressTimer();

            return this;
        }

        const touch = event.touches[0];

        return this.updateLongPressPosition(touch.clientX, touch.clientY);
    }

    onMessageTouchEnd(): this {
        if (!this.longPressFromPointer) {
            this.clearLongPressTimer();
        }

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
        this.requestMessageActions.set(this.currentMessage());
        queueMicrotask(() => this.requestMessageActions.set(null));

        return this;
    }

    editMessage(message: ChatMessage): this {
        this.edit.set(true);
        this.requestEdit.set(message);

        return this;
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

    private beginLongPress(clientX: number, clientY: number): this {
        this.clearLongPressTimer();
        this.longPressOpened = false;
        this.longPressOriginX = clientX;
        this.longPressOriginY = clientY;
        this.longPressTimer = setTimeout(() => {
            this.longPressTimer = null;
            this.longPressOpened = true;
            this.openMobileActionSheet();
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
}
