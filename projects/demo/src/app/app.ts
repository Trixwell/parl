import {Component, effect, model, OnInit, signal} from '@angular/core';
import {RouterOutlet} from '@angular/router';
import {NgxParlComponent} from 'ngx-parl';
import {ChatMessage} from './core/entity/chat';
import {CHAT_MESSAGE_MOCK, CHAT_MESSAGE_SECOND_MOCK, CHAT_MESSAGE_THIRD_MOCK, CHAT_MOCK} from '../mocks/mock-data';

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [RouterOutlet, NgxParlComponent],
    templateUrl: './app.html',
    styleUrl: './app.scss'
})

export class App implements OnInit {
    public messageList = model<ChatMessage[]>(CHAT_MOCK);
    public messageUpdate = model<ChatMessage>();
    public header = signal(true);

    constructor() {
        effect(() => {
            const updateList = this.messageList();

            console.log(updateList);
        });
    }

    ngOnInit() {
        setTimeout(() => {
            this.messageUpdate.set(CHAT_MESSAGE_MOCK)
        }, 2500)

        setTimeout(() => {
            this.messageUpdate.set(CHAT_MESSAGE_SECOND_MOCK)
        }, 5000)

        setTimeout(() => {
            this.messageUpdate.set(CHAT_MESSAGE_THIRD_MOCK)
        }, 7500)
    }

    protected readonly title = signal('demo');
}
