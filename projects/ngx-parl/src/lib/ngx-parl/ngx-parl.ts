import {Component} from '@angular/core';
import {NgOptimizedImage} from '@angular/common';
import {ChatFlow} from '../core/components/chat-flow/chat-flow';
import {InputMessage} from '../core/components/input-message/input-message';
import {MatDialogActions, MatDialogContent, MatDialogTitle} from '@angular/material/dialog';
import {ChatMessage} from '../core/entity/chat';
import {MatProgressSpinner} from '@angular/material/progress-spinner';

@Component({
    selector: 'ngx-parl',
    imports: [NgOptimizedImage, ChatFlow, InputMessage, MatDialogActions, MatDialogContent, MatDialogTitle, MatProgressSpinner],
    standalone: true,
    templateUrl: './ngx-parl.html',
    styleUrl: './ngx-parl.scss'
})
export class NgxParlComponent {
    public ai_run_in_progress = false;
    public message_list: ChatMessage[] = [];

    constructor() {
        this.loadMessageList();
    }

    loadMessageList() {
        this.message_list = [
            new ChatMessage(1, '19:30', 'incoming', 'Bogdan', 'Вітаю', null, null),
            new ChatMessage(2, '19:31', 'outgoing', 'Anna', 'Доброго дня. Я ваш віртуальний помічник.', null, null),
            new ChatMessage(3, '19:31', 'incoming', 'Bogdan', 'нема інтернету', null, null),
            new ChatMessage(4, '19:32', 'outgoing', 'Anna', 'Вибачте, я не зовсім зрозуміла ваше запитання. Будь ласка, уточніть, чим я можу вам допомогти?', null, null),
        ]
    }

    sendMessage(message: string | undefined) {
        if (!message) {
            return this;
        }

        this.message_list = [
            ...this.message_list,
            new ChatMessage(
                (this.message_list.length + 1),
                '',
                'outgoing',
                message,
                ''
            )
        ];

        return this;
    }
}
