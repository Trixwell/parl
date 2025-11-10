import {Component, computed, effect, ElementRef, model, ViewChild,} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {ChatMessage} from '../core/entity/chat';
import {ChatMessageComponent} from '../core/components/chat-message/chat-message';
import {ChatStartDayPipe} from '../core/pipes/chat-start-day-pipe';
import {ToggleDisplayChatStartDayPipe} from '../core/pipes/toggle-display-chat-start-day-pipe';

@Component({
    selector: 'app-chat-flow',
    imports: [
        FormsModule,
        ChatMessageComponent,
        ChatStartDayPipe,
        ToggleDisplayChatStartDayPipe,
        ChatMessageComponent
    ],
    templateUrl: './chat-flow.html',
    styleUrl: './chat-flow.scss',
    standalone: true,
})

export class ChatFlowComponent {
    @ViewChild('chatFlowRef', {static: true}) private flowRef!: ElementRef<HTMLElement>;

    public messageListInput = model.required<ChatMessage[]>();
    public messageList = computed(() => this.messageListInput());

    public selectedForEdit = model.required<ChatMessage | null>();

    constructor() {
        effect(() => {
            const length = this.messageList().length;
            if (length > 0) {
                queueMicrotask(() => this.scrollToBottomSmooth());
            }
        });
    }

    private scrollToBottomSmooth() {
        const element = this.flowRef?.nativeElement;
        if (!element) {
            return this;
        }
        element.scrollTo({top: element.scrollHeight, behavior: 'smooth'});

        return this;
    }

    startEdit(message: ChatMessage) {
        this.messageList().forEach(currMessage => {
            if (currMessage.id !== message.id && currMessage.edit) {
                currMessage.edit = false;
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

    onEditChange(id: number, isEdit: boolean) {
        const message = this.messageList().find(m => m.id === id);
        if (!message) {
            return this;
        }

        if (isEdit) {
            return this.startEdit(message);
        } else {
            message.edit = false;
            if (this.selectedForEdit()?.id === id) {
                this.selectedForEdit.set(null);
            }
        }

        return this;
    }

    onRequestEdit(message: ChatMessage | null) {
        if (message) {
            return this.startEdit(message);
        }
        this.selectedForEdit.set(null);

        return this;
    }

    onRequestDelete(messageId: number | null) {
        if (!messageId) {
            return this;
        }

        const next = this.messageList().filter(m => m.id !== messageId);
        this.selectedForEdit.set(null);
        queueMicrotask(() => this.messageListInput.set(next));

        return this;
    }

    trackByMessageId(_index: number, message: ChatMessage): number {
        return message.id;
    }
}
