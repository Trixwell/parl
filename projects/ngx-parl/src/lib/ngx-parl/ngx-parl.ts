import {Component, model} from '@angular/core';
import {NgOptimizedImage} from '@angular/common';
import {ChatFlowComponent} from '../chat-flow/chat-flow';
import {MatDialogContent, MatDialogTitle} from '@angular/material/dialog';
import {ChatMessage, ChatMessageDTO, ChatMessageType, currMessage, MessageType} from '../core/entity/chat';
import {MatProgressSpinner} from '@angular/material/progress-spinner';
import {InputMessageComponent} from '../input-message/input-message';
import {TranslocoPipe} from '@ngneat/transloco';

@Component({
    selector: 'ngx-parl',
    imports: [NgOptimizedImage, ChatFlowComponent, MatDialogContent, MatDialogTitle, MatProgressSpinner, InputMessageComponent, InputMessageComponent, InputMessageComponent, InputMessageComponent, TranslocoPipe, ChatFlowComponent, InputMessageComponent],
    standalone: true,
    templateUrl: './ngx-parl.html',
    styleUrl: './ngx-parl.scss',
})

export class NgxParlComponent {
    public ai_run_in_progress = false;

    public message_list = model<ChatMessage[]>([]);
    public selectedForEdit = model<ChatMessage | null>(null);

    onCancelEdit(messageId: number | null) {
        if (messageId != null) {
            this.message_list.update(curr => {
                const next = [...curr];
                const i = next.findIndex(m => m.id === messageId);
                if (i > -1) next[i].edit = false;
                return next;
            });
        }
        this.selectedForEdit.set(null);

        return this;
    }

    sendMessage(event: | string | currMessage | undefined) {
        if (!event) {
            return this;
        }

        if (typeof event !== 'string' && 'id' in event) {
            const {id, content, files} = event;
            this.message_list.update(curr => {
                const next = [...curr];
                const findIndex = next.findIndex(m => m.id === id);
                if (findIndex > -1) {
                    next[findIndex].content = (content ?? '').trim();
                    if (Array.isArray(files)) next[findIndex].file_path = files.length ? files : null;
                    next[findIndex].edit = false;
                }
                return next;
            });

            this.selectedForEdit.set(null);

            return this;
        }

        if (typeof event === 'string') {
            const text = event.trim();
            if (!text) {
                return this;
            }

            const lastId = this.message_list().at(-1)?.id ?? 0;
            const dto: ChatMessageDTO = {
                id: lastId + 1,
                chat_id: 1,
                cr_time: new Date().toISOString(),
                type: MessageType.Outgoing as ChatMessageType,
                user: 'Alex',
                content: text,
                avatar: null,
                file_path: null,
                checked: false
            };

            this.message_list.update(list => [...list, new ChatMessage(dto)]);

            return this;
        }

        const {content, files} = event;
        const text = (content ?? '').trim();
        const hasFiles = Array.isArray(files) && files.length > 0;
        if (!text && !hasFiles) {
            return this;
        }

        const lastId = this.message_list().at(-1)?.id ?? 0;
        const dto: ChatMessageDTO = {
            id: lastId + 1,
            chat_id: 1,
            cr_time: new Date().toISOString(),
            type: MessageType.Outgoing as ChatMessageType,
            user: 'Alex',
            content: text,
            avatar: null,
            file_path: hasFiles ? files! : null,
            checked: false
        };

        this.message_list.update(list => [...list, new ChatMessage(dto)]);

        return this;
    }
}
