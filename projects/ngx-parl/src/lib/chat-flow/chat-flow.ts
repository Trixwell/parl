import {Component, computed, effect, ElementRef, model, ViewChild,} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {ChatMessage} from '../core/entity/chat';
import {ChatMessageComponent} from '../core/components/chat-message/chat-message';
import {ChatStartDayPipe} from '../core/pipes/chat-start-day-pipe';
import {ToggleDisplayChatStartDayPipe} from '../core/pipes/toggle-display-chat-start-day-pipe';
import {TranslocoPipe} from '@ngneat/transloco';
import {MatIcon, MatIconRegistry} from '@angular/material/icon';
import {DomSanitizer} from '@angular/platform-browser';

@Component({
    selector: 'app-chat-flow',
    imports: [
        FormsModule,
        ChatMessageComponent,
        ChatStartDayPipe,
        ToggleDisplayChatStartDayPipe,
        ChatMessageComponent,
        TranslocoPipe,
        MatIcon
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

    constructor(private iconRegistry: MatIconRegistry, private sanitizer: DomSanitizer) {
        this.iconRegistry.addSvgIcon('lucide_send',
            this.sanitizer.bypassSecurityTrustResourceUrl('assets/ngx-parl/icons/lucide_send.svg'));

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
        const messageList = this.messageList().find(message => message.id === id);
        if (!messageList) {
            return this;
        }

        if (isEdit) {
            return this.startEdit(messageList);
        } else {
            messageList.edit = false;

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

        const updatedList = this.messageList().filter(m => m.id !== messageId);
        this.selectedForEdit.set(null);

        queueMicrotask(() => this.messageListInput.set(updatedList));

        return this;
    }

    trackByMessageId(_index: number, message: ChatMessage): string {
        // return message.id;
        return `${message.chat_id}-${message.type}-${message.id}`;
    }
}
