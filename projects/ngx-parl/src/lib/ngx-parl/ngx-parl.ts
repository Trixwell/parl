import {Component, computed, effect, input, model, ViewChild} from '@angular/core';
import {NgClass, NgOptimizedImage} from '@angular/common';
import {ChatFlowComponent} from '../chat-flow/chat-flow';
import {MatDialogContent, MatDialogTitle} from '@angular/material/dialog';
import {
    ChatMessage,
    ChatMessageDTO,
    ChatMessageType,
    CurrMessage,
    MessageActionEvent,
    MessageType
} from '../core/entity/chat';
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
    @ViewChild(ChatFlowComponent) chatFlow?: ChatFlowComponent;
    @ViewChild(InputMessageComponent) inputMessage?: InputMessageComponent;

    public ai_run_in_progress = false;
    public dragActive = model<boolean>(false);
    private dragDepth = 0;
    private lastUpdateKey: string | null = null;

    public theme = input<FlowTheme>(FlowTheme.PRIMARY);
    public header = input<boolean>(true);
    public language = input<'en' | 'uk'>('en');

    public messageList = model<ChatMessage[]>([]);
    public messageUpdate = model<ChatMessage>();
    public selectedForEdit = model<ChatMessage | null>(null);
    public messageAction = model<MessageActionEvent | null>(null);

    public incomingUser = input<string>('');

    public hideHandler = input<(() => unknown) | null>(null);
    public closeHandler = input<(() => unknown) | null>(null);

    public scrollToBottomTrigger = model<number>(0);
    public loadHistory = model<boolean>(false);

    constructor(private utils: UtilsService,
                private transloco: TranslocoService) {
        effect(() => {
            this.transloco.setActiveLang(this.language());
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

            this.messageList.update(list => {
                const index = list.findIndex(m => m.id === updatedMessage.id);

                if (index > -1) {
                    const updated = [...list];
                    updated[index] = updatedMessage;
                    return updated;
                }

                return [...list, updatedMessage];
            });

            this.scrollToBottomTrigger.update(v => v + 1);
        });
    }

    onCancelEdit(messageId: number | null) {
        if (messageId != null) {
            this.messageList.update(list => {
                const updated = [...list];
                const index = updated.findIndex(m => m.id === messageId);
                if (index > -1) {
                    updated[index].edit = false;
                }
                return updated;
            });
        }

        this.selectedForEdit.set(null);

        return this;
    }

    onRequestDelete(messageId: number | null) {
        if (messageId == null) {
            return this;
        }

        this.messageList.update(list => list.filter(m => m.id !== messageId));

        this.pushMessageAction({
            action: 'delete',
            chatMessageId: messageId,
            content: '',
        });

        return this;
    }

    sendMessage(
        event:
            | CurrMessage
            | string
            | undefined
    ) {
        if (!event) {
            return this;
        }

        // edit message
        if (this.isCurrMessage(event) && event.id !== undefined) {
            const hasFiles = Array.isArray(event.file_path) && event.file_path.length > 0;
            if (!hasFiles) {
                const {id, content, file_path, file_list, user_id, user,} = event;

                this.messageList.update((currentList) => {
                    const updatedList = [...currentList];
                    const index = updatedList.findIndex(
                        (message) => message.id === id,
                    );

                    if (index > -1) {
                        updatedList[index].content = (content ?? '').trim();

                        if (Array.isArray(file_path)) {
                            updatedList[index].file_path = file_path.length ? file_path : null;
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
                    file_path: Array.isArray(file_path) && file_path.length ? file_path : [],
                    file_list: Array.isArray(file_list) && file_list.length ? file_list : [],
                    user_id: user_id,
                    user: user,
                });

                return this;
            }
        }

        // new message
        if (this.isCurrMessage(event)) {
            const hasFiles = Array.isArray(event.file_path) && event.file_path.length > 0;

            if (!hasFiles) {
                const {id, content, file_path, file_list, user_id, user} = event;

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
                    content: content,
                    avatar: lastOutgoing?.avatar ?? null,
                    file_path: [],
                    file_list: [],
                    checked: true,
                };

                this.messageList.update((list) => [...list, new ChatMessage(dto)]);
                this.scrollToBottomTrigger.update(v => v + 1);
                this.pushMessageAction({
                    action: 'send',
                    chatMessageId: dto.id,
                    content: content,
                    user_id: user_id,
                    user: user,
                });

                return this;
            }
        }

        // new message + files
        if (!this.isCurrMessage(event)) {
            return this;
        }

        const {content, file_path, file_list, user_id, user} = event;
        const text = (content ?? '').trim();
        const hasFiles = Array.isArray(file_path) && file_path.length > 0;
        const hasFileList = Array.isArray(file_list) && file_list.length > 0;

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
            file_path: hasFiles ? file_path : [],
            file_list: hasFileList ? file_list : [],
            checked: true,
        };

        this.messageList.update((list) => [...list, new ChatMessage(dto)]);
        this.scrollToBottomTrigger.update(v => v + 1);
        this.pushMessageAction({
            action: 'send',
            chatMessageId: dto.id,
            content: text,
            file_path: hasFiles ? file_path : [],
            file_list: hasFileList ? file_list : [],
            user_id: user_id,
            user: user,
        });

        return this;
    }

    isCurrMessage(event: unknown): event is CurrMessage {
        return typeof event === 'object' && event !== null && 'content' in event;
    }

    pushMessageAction(event: MessageActionEvent) {
        this.messageAction.set(event);
        setTimeout(() => this.messageAction.set(null), 0);
        return this;
    }

    scrollToBottom(): this {
        this.chatFlow?.scrollToBottom();

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

    onDragOver(event: DragEvent) {
        event.preventDefault();
        event.stopPropagation();
        if (event.dataTransfer) {
            event.dataTransfer.dropEffect = 'copy';
        }
        this.dragActive.set(true);

        return this;
    }

    onDragEnter(event: DragEvent) {
        event.preventDefault();
        event.stopPropagation();
        this.dragDepth += 1;
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

        this.inputMessage?.addFiles(Array.from(files));

        return this;
    }

    protected readonly FlowTheme = FlowTheme;
}
