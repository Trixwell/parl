import {AfterViewInit, Component, computed, effect, ElementRef, model, ViewChild,} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {ChatMessage} from '../core/entity/chat';
import {ChatMessageComponent} from '../core/components/chat-message/chat-message';
import {ChatStartDayPipe} from '../core/pipes/chat-start-day-pipe';
import {ToggleDisplayChatStartDayPipe} from '../core/pipes/toggle-display-chat-start-day-pipe';
import {TranslocoPipe} from '@ngneat/transloco';
import {NgOptimizedImage} from '@angular/common';

@Component({
    selector: 'app-chat-flow',
    imports: [
        FormsModule,
        ChatMessageComponent,
        ChatStartDayPipe,
        ToggleDisplayChatStartDayPipe,
        ChatMessageComponent,
        TranslocoPipe,
        NgOptimizedImage
    ],
    templateUrl: './chat-flow.html',
    styleUrl: './chat-flow.scss',
    standalone: true,
})
export class ChatFlowComponent implements AfterViewInit {
    @ViewChild('chatFlowRef') flowRef?: ElementRef<HTMLElement>;

    public messageListInput = model.required<ChatMessage[]>();
    public messageList = computed(() => this.messageListInput());

    public selectedForEdit = model.required<ChatMessage | null>();
    public requestDelete = model<number | null>(null);

    public scrollToBottomTrigger = model<number>(0);
    public isScrolledToTop = model<boolean>(false);

    private viewInitialized = false;
    private previousScrollHeight = 0;
    private previousMessageCount = 0;

    constructor() {
        effect(() => {
            const messages = this.messageList();

            if (!this.viewInitialized) {
                this.previousMessageCount = messages.length;
                return;
            }

            const element = this.flowRef?.nativeElement;

            if (!element) {
                return;
            }

            const isHistoryPrepend =
                messages.length > this.previousMessageCount &&
                this.isScrolledToTop();

            if (!isHistoryPrepend) {
                this.previousMessageCount = messages.length;
                return;
            }

            const oldHeight = this.previousScrollHeight;

            queueMicrotask(() => {
                const newHeight = element.scrollHeight;
                element.scrollTop = newHeight - oldHeight;
            });

            this.previousMessageCount = messages.length;
        });

        effect(() => {
            this.scrollToBottomTrigger();

            if (!this.viewInitialized) {
                return;
            }

            if (this.isScrolledToTop()) {
                return;
            }

            queueMicrotask(() => this.scrollToBottomSmooth());
        });
    }

    ngAfterViewInit() {
        this.viewInitialized = true;

        const element = this.flowRef?.nativeElement;

        if (element) {
            element.addEventListener('scroll', () => {
                this.previousScrollHeight = element.scrollHeight;
                this.updateScrollTopState();
            });

            queueMicrotask(() => {
                this.previousScrollHeight = element.scrollHeight;
                element.scrollTop = element.scrollHeight;
            });
        }
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

        return this;
    }

    updateScrollTopState(): this {
        const element = this.flowRef?.nativeElement;

        if (!element) {
            return this;
        }

        this.isScrolledToTop.set(element.scrollTop === 0);

        return this;
    }

    startEdit(message: ChatMessage): this {
        this.messageList().forEach(currentMessage => {
            if (currentMessage.id !== message.id && currentMessage.edit) {
                currentMessage.edit = false;
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
        this.requestDelete.set(messageId);
        queueMicrotask(() => this.requestDelete.set(null));

        return this;
    }

    trackByMessageId(_index: number, message: ChatMessage): string {
        // return message.id;
        return `${message.chat_id}-${message.type}-${message.id}`;
    }
}
