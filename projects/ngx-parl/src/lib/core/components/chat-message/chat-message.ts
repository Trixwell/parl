import {Component, computed, input, model} from '@angular/core';
import {DatePipe, NgClass, NgOptimizedImage} from '@angular/common';
import {ChatMessage, MessageType} from '../../entity/chat';
import {MatMenu, MatMenuItem, MatMenuTrigger} from '@angular/material/menu';
import {TranslocoPipe} from '@ngneat/transloco';
import {PreviewFile} from '../preview-file/preview-file';
import {UtilsService} from '../../service/utils/utils';

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
    public currentMessage = input.required<ChatMessage>();
    public edit = model<boolean>(false);
    public previewList = model<string[]>([]);
    public previewIndex = model<number>(0);
    public previewOpener = model<HTMLElement | null>(null);
    public closePreviewHandler = () => this.closePreview();

    public requestEdit = model<ChatMessage | null>(null);
    public requestDelete = model<number | null>(null);

    constructor(private utils: UtilsService) {}

    attachments = computed(() => {
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
            } catch {}
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

    avatarSrc = computed(() => {
        const message = this.currentMessage();
        const fallback = message.type === 'incoming'
            ? 'assets/ngx-parl/icons/avatar_anonym.svg'
            : 'assets/ngx-parl/icons/avatar_manager.svg';

        return message.avatar || fallback;
    });

    openContextMenu(event: Event, trigger: MatMenuTrigger, triggerElement: HTMLElement) {
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

    editMessage(message: ChatMessage) {
        this.edit.set(true);
        this.requestEdit.set(message);

        return this;
    }

    openPreview(index: number, event: MouseEvent) {
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

    closePreview() {
        this.previewList.set([]);
        this.previewIndex.set(0);
        this.previewOpener.set(null);

        return this;
    }

    deleteMessage(message: ChatMessage) {
        this.requestDelete.set(message.id);
        queueMicrotask(() => this.requestDelete.set(null));

        return this;
    }

    canDelete(message: ChatMessage): boolean {
        return message.type === this.messageType.Outgoing;
    }

    public readonly messageType = MessageType;
}
