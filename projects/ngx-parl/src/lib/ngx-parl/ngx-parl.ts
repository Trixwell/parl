import {Component, computed, effect, input, model} from '@angular/core';
import {NgClass, NgOptimizedImage} from '@angular/common';
import {ChatFlowComponent} from '../chat-flow/chat-flow';
import {MatDialogContent, MatDialogTitle} from '@angular/material/dialog';
import {ChatMessage, ChatMessageDTO, ChatMessageType, MessageActionEvent, MessageType} from '../core/entity/chat';
import {MatProgressSpinner} from '@angular/material/progress-spinner';
import {InputMessageComponent} from '../input-message/input-message';
import {
    TranslocoModule,
    TranslocoPipe,
    TranslocoService,
} from '@ngneat/transloco';
import {UtilsService} from '../core/service/utils/utils';
import {FlowTheme} from '../core/entity/theme';

@Component({
    selector: 'ngx-parl',
    standalone: true,
    imports: [
        NgOptimizedImage, NgClass, MatDialogContent, MatDialogTitle, MatProgressSpinner, ChatFlowComponent, InputMessageComponent,
        TranslocoModule,
        TranslocoPipe
    ],
    templateUrl: './ngx-parl.html',
    styleUrl: './ngx-parl.scss',
    providers: [],
})

export class NgxParlComponent {
    public ai_run_in_progress = false;
    private lastUpdateKey: string | null = null;

    public theme = input<FlowTheme>(FlowTheme.PRIMARY);
    public header = input<boolean>(true);
    public language = input<'en' | 'uk'>('en');

    public messageList = model<ChatMessage[]>([]);
    public messageUpdate = model<ChatMessage>();
    public selectedForEdit = model<ChatMessage | null>(null);
    public messageAction = model<MessageActionEvent | null>(null);

    public incomingUser = computed(() => {
        return (
            this.messageList().find((message) => message.type === MessageType.Incoming)?.user ?? ''
        );
    });

    public hideHandler = input<(() => unknown) | null>(null);
    public closeHandler = input<(() => unknown) | null>(null);

    constructor(private utils: UtilsService,
                private transloco: TranslocoService) {
        effect(() => {
            const lang = this.language();
            this.transloco.setActiveLang(lang);
        });

        effect(() => {
            const updatedMessage = this.messageUpdate();

            if (!updatedMessage) {
                return;
            }

            const key = `${updatedMessage.id}-${updatedMessage.cr_time}-${updatedMessage.type}`;
            if (this.lastUpdateKey === key) {
                return;
            }

            this.lastUpdateKey = key;

            if (updatedMessage.type !== MessageType.Incoming) {
                return;
            }

            this.messageList.update((currentList) => {
                const list = [...currentList];

                const incomingIndex = list.findIndex(
                    (message) =>
                        message.id === updatedMessage.id &&
                        message.type === MessageType.Incoming,
                );

                if (incomingIndex > -1) {
                    list[incomingIndex] = updatedMessage;
                    return list;
                }

                list.push(updatedMessage);

                return list;
            });
        });
    }

    onCancelEdit(messageId: number | null) {
        if (messageId != null) {
            this.messageList.update((currentList) => {
                const updatedList = [...currentList];
                const index = updatedList.findIndex(
                    (message) => message.id === messageId,
                );

                if (index > -1) {
                    updatedList[index].edit = false;
                }

                return updatedList;
            });
        }

        this.selectedForEdit.set(null);

        return this;
    }

    onRequestDelete(messageId: number | null) {
        if (messageId == null) {
            return this;
        }

        this.messageList.update((currentList) => {
            const updatedList = currentList.filter((m) => m.id !== messageId);
            return [...updatedList];
        });

        this.pushMessageAction({
            action: 'delete',
            chatMessageId: messageId,
            content: '',
        });

        return this;
    }
    sendMessage(
        event:
            | string
            | { id: number; content: string; files?: string[]; }
            | { content: string; files?: string[]; }
            | undefined
    ) {
        if (!event) {
            return this;
        }

        // edit message
        if (typeof event !== 'string' && 'id' in event) {
            const {id, content, files} = event;

            this.messageList.update((currentList) => {
                const updatedList = [...currentList];
                const index = updatedList.findIndex(
                    (message) => message.id === id,
                );

                if (index > -1) {
                    updatedList[index].content = (content ?? '').trim();

                    if (Array.isArray(files)) {
                        updatedList[index].file_path = files.length ? files : null;
                    }

                    updatedList[index].edit = false;
                }

                return updatedList;
            });

            this.selectedForEdit.set(null);

            this.pushMessageAction({
                action: 'edit',
                chatMessageId: id,
                content: (content ?? '').trim(),
                files: Array.isArray(files) && files.length ? files : undefined,
            });


            return this;
        }

        // new message
        if (typeof event === 'string') {
            const text = event.trim();

            if (!text) {
                return this;
            }

            const messages = this.messageList();
            const lastId = messages.at(-1)?.id ?? 0;

            const lastOutgoing = [...messages]
                .reverse()
                .find((message) => message.type === MessageType.Outgoing,);

            const dto: ChatMessageDTO = {
                id: lastId + 1,
                chat_id: lastOutgoing?.chat_id ?? 1,
                cr_time: this.utils.getLocalISODate(),
                type: MessageType.Outgoing as ChatMessageType,
                user: lastOutgoing?.user ?? '',
                content: text,
                avatar: lastOutgoing?.avatar ?? null,
                file_path: null,
                checked: false,
            };

            this.messageList.update((list) => [...list, new ChatMessage(dto)]);

            this.pushMessageAction({
                action: 'send',
                chatMessageId: dto.id,
                content: text,
            });

            return this;
        }

        // new message + files
        const {content, files} = event;
        const text = (content ?? '').trim();
        const hasFiles = Array.isArray(files) && files.length > 0;

        if (!text && !hasFiles) {
            return this;
        }

        const messages = this.messageList();
        const lastId = messages.at(-1)?.id ?? 0;

        const lastOutgoing = [...messages]
            .reverse()
            .find((message) => message.type === MessageType.Outgoing,);

        const dto: ChatMessageDTO = {
            id: lastId + 1,
            chat_id: lastOutgoing?.chat_id ?? 1,
            cr_time: this.utils.getLocalISODate(),
            type: MessageType.Outgoing as ChatMessageType,
            user: lastOutgoing?.user ?? '',
            content: text,
            avatar: lastOutgoing?.avatar ?? null,
            file_path: hasFiles ? files : null,
            checked: false,
        };

        this.messageList.update((list) => [...list, new ChatMessage(dto)]);

        this.pushMessageAction({
            action: 'send',
            chatMessageId: dto.id,
            content: text,
            files: hasFiles ? files : undefined,
        });

        return this;
    }

    pushMessageAction(event: MessageActionEvent) {
        this.messageAction.set(event);

        setTimeout(() => this.messageAction.set(null), 0);

        return this;
    }

    onHideClick() {
        const handler = this.hideHandler();

        if (handler) {
            handler();
        }

        return this;
    }

    onCloseClick() {
        const handler = this.closeHandler();

        if (handler) {
            handler();
        }

        return this;
    }

    protected readonly FlowTheme = FlowTheme;
}
