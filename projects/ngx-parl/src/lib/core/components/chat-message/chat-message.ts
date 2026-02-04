import {Component, computed, input, model} from '@angular/core';
import {DatePipe, NgClass, NgOptimizedImage} from '@angular/common';
import {ChatMessage, MessageType} from '../../entity/chat';
import {MatMenu, MatMenuItem, MatMenuTrigger} from '@angular/material/menu';
import {TranslocoPipe} from '@ngneat/transloco';
import {PreviewFile} from '../preview-file/preview-file';

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
    public closePreviewHandler = () => this.closePreview();

    public requestEdit = model<ChatMessage | null>(null);
    public requestDelete = model<number | null>(null);

    constructor() {}

    public normalizeSourcePath(sourcePath: string): string {
        const cleanedPath = (sourcePath ?? '').trim();
        if (!cleanedPath) {
            return '';
        }

        if (cleanedPath.startsWith('data:') || cleanedPath.startsWith('blob:') || /^https?:\/\//i.test(cleanedPath)) {
            return cleanedPath;
        }

        const assetsIndex = cleanedPath.indexOf('assets/');
        if (assetsIndex >= 0) {
            return '/' + cleanedPath.slice(assetsIndex);
        }

        return cleanedPath.replace(/^\.{1,2}\//, '/');
    }

    public attachments = computed(() => {
        const message = this.currentMessage();
        const filePath = message.file_path;

        if (Array.isArray(filePath)) {
            return filePath.map(p => this.normalizeSourcePath(p)).filter(Boolean);
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
                        .map(item => (typeof item === 'string' ? this.normalizeSourcePath(item) : ''))
                        .filter(Boolean);
                }
            } catch {}
        }

        if (rawFilePath.startsWith('data:')) {
            return [rawFilePath];
        }

        if (rawFilePath.includes('|')) {
            return rawFilePath.split('|').map(p => this.normalizeSourcePath(p)).filter(Boolean);
        }
        if (rawFilePath.includes(',')) {
            return rawFilePath.split(',').map(p => this.normalizeSourcePath(p)).filter(Boolean);
        }

        return [];
    });

    public avatarSrc = computed(() => {
        const message = this.currentMessage();
        const fallback = message.type === 'incoming'
            ? 'assets/ngx-parl/icons/avatar_anonym.svg'
            : 'assets/ngx-parl/icons/avatar_manager.svg';

        return message.avatar || fallback;
    });

    public openContextMenu(event: Event, trigger: MatMenuTrigger, triggerElement: HTMLElement) {
        event.preventDefault();
        event.stopPropagation();

        if (event instanceof MouseEvent) {
            triggerElement.style.left = `${event.clientX}px`;
            triggerElement.style.top = `${event.clientY}px`;
        }

        trigger.openMenu();

        return this;
    }

    public editMessage(message: ChatMessage) {
        this.edit.set(true);
        this.requestEdit.set(message);

        return this;
    }

    public openPreview(index: number) {
        const list = this.attachments();
        if (!list.length) {
            return this;
        }

        this.previewList.set(list);
        this.previewIndex.set(Math.max(0, Math.min(index, list.length - 1)));

        return this;
    }

    public closePreview() {
        this.previewList.set([]);
        this.previewIndex.set(0);

        return this;
    }

    public deleteMessage(message: ChatMessage) {
        this.requestDelete.set(message.id);
        queueMicrotask(() => this.requestDelete.set(null));

        return this;
    }

    public canDelete(message: ChatMessage): boolean {
        return message.type === this.messageType.Outgoing;
    }

    public readonly messageType = MessageType;
}
