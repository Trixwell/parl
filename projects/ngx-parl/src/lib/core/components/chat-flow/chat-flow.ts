import {Component, effect, ElementRef, input, model} from '@angular/core';
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

    constructor(private hostRef: ElementRef) {
        effect(() => {
            if (this.message_list().length > 0)
                setTimeout(() => {
                    hostRef.nativeElement.parentElement.parentElement.scrollTo({
                        top: hostRef.nativeElement.parentElement.scrollHeight,
                        behavior: 'instant'
                    });

                    window.scrollTo({
                        top: hostRef.nativeElement.parentElement.scrollHeight,
                        behavior: 'instant'
                    });
                });
        });
    }

    confirmDelete(message: ChatMessage) {
        this.active_message = message;
    }

    deleteMessage() {
        if (this.active_message)
            this.delete_message.set(this.active_message);
    }

    updateMessage(message: ChatMessage) {
        // message.content = content;
        message.edit = false;
        this.edit_message.set(message);
    }

    public readonly messageType = MessageType;
}
