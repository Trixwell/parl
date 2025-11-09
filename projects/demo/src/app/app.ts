import {Component, model, signal} from '@angular/core';
import {RouterOutlet} from '@angular/router';
import {NgxParlComponent} from 'ngx-parl';
import {ChatMessage} from './core/entity/chat';
import {CHAT_MOCK} from '../mocks/mock-data';

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [RouterOutlet, NgxParlComponent],
    templateUrl: './app.html',
    styleUrl: './app.scss'
})

export class App {
    message_list = model<ChatMessage[]>(CHAT_MOCK);

    protected readonly title = signal('demo');
}
