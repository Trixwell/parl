import {afterNextRender, Component, effect, ElementRef, input, model, ViewChild} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {NgClass, NgOptimizedImage} from '@angular/common';
import {ChatMessage, MessageType} from '../../entity/chat';

@Component({
    selector: 'app-chat-flow',
    imports: [
        FormsModule,
        NgOptimizedImage,
        NgClass
    ],
    templateUrl: './chat-flow.html',
    styleUrl: './chat-flow.scss',
})
export class ChatFlow {
    message_list = input.required<ChatMessage[]>();
    delete_message = model<ChatMessage>();
    edit_message = model<ChatMessage>();
    active_message: ChatMessage | null = null;

    @ViewChild('chatFlowRef', {static: true})
    private flowRef!: ElementRef<HTMLElement>;

    constructor() {
        afterNextRender(() => this.scrollToBottomInstant());

        effect(() => {
            const len = this.message_list().length;
            if (len > 0) {
                queueMicrotask(() => this.scrollToBottomSmooth());
            }
        });
    }

    scrollToBottomInstant() {
        const el = this.flowRef?.nativeElement;
        if (!el) return;
        const prev = el.style.scrollBehavior;
        el.style.scrollBehavior = 'auto';
        el.scrollTop = el.scrollHeight;
        el.style.scrollBehavior = prev;

        return this;
    }

    scrollToBottomSmooth() {
        const el = this.flowRef?.nativeElement;
        if (!el) return;
        el.scrollTo({top: el.scrollHeight, behavior: 'smooth'});

        return this;
    }

    confirmDelete(message: ChatMessage) {
        this.active_message = message;

        return this;
    }

    deleteMessage() {
        if (this.active_message) {
            this.delete_message.set(this.active_message);
        }

        return this;
    }

    updateMessage(message: ChatMessage) {
        message.edit = false;
        this.edit_message.set(message);

        return this;
    }

    public readonly messageType = MessageType;
}
