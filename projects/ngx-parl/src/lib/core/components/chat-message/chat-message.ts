import {Component, computed, inject, input, model, Signal} from '@angular/core';
import {DatePipe, NgClass, NgOptimizedImage} from '@angular/common';
import {ChatMessage, MessageType} from '../../entity/chat';
import {MatMenu, MatMenuItem, MatMenuTrigger} from '@angular/material/menu';
import {TranslocoPipe} from '@ngneat/transloco';
import {PreviewFile} from '../preview-file/preview-file';
import {UtilsService} from '../../service/utils/utils';
import {ParlQuickAction, ParlQuickActionClickEvent} from '../../entity/quick-actions';

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
    ],
    templateUrl: './chat-message.html',
    styleUrl: './chat-message.scss',
    standalone: true,
})

export class ChatMessageComponent {
    private readonly utils = inject(UtilsService);

    public currentMessage = input.required<ChatMessage>();
    public edit = model<boolean>(false);
    public previewList = model<string[]>([]);
    public previewIndex = model<number>(0);
    public previewOpener = model<HTMLElement | null>(null);
    public closePreviewHandler = (): this => this.closePreview();

    public requestEdit = model<ChatMessage | null>(null);
    public requestDelete = model<number | null>(null);

    public mobileMode = input<boolean>(false);
    public logoChat = input<string>('');
    public quickActions = input<ParlQuickAction[]>([]);
    public quickActionClick = model<ParlQuickActionClickEvent | null>(null);

    public readonly messageType = MessageType;

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
        const anonymFallback = 'assets/ngx-parl/icons/avatar_anonym.svg';
        const logoTrimmed = (this.logoChat() ?? '').trim();
        const outgoingFallback =
            logoTrimmed.length > 0 ? logoTrimmed : anonymFallback;
        const fallback =
            message.type === 'incoming' ? anonymFallback : outgoingFallback;
        const raw =
            message.avatar && String(message.avatar).trim().length > 0
                ? message.avatar
                : fallback;

        return this.utils.normalizeSourcePath(raw);
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

    openContextMenu(event: Event, trigger: MatMenuTrigger, triggerElement: HTMLElement): this {
        if (!this.canOpenContextMenu()) {
            return this;
        }

        event.preventDefault();
        event.stopPropagation();

        if (event instanceof MouseEvent) {
            triggerElement.style.setProperty('inset-inline-start', `${event.clientX}px`);
            triggerElement.style.setProperty('inset-block-start', `${event.clientY}px`);
            triggerElement.style.removeProperty('left');
            triggerElement.style.removeProperty('top');
        }

        trigger.openMenu();

        return this;
    }

    editMessage(message: ChatMessage): this {
        this.edit.set(true);
        this.requestEdit.set(message);

        return this;
    }

    openPreview(index: number, event: MouseEvent): this {
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
}
