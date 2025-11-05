import {ChangeDetectionStrategy, Component, inject, signal} from '@angular/core';
import {NgOptimizedImage} from '@angular/common';
import {ChatFlow} from '../chat-flow/chat-flow';
import {MatDialogContent, MatDialogTitle} from '@angular/material/dialog';
import {ChatMessage} from '../core/entity/chat';
import {MatProgressSpinner} from '@angular/material/progress-spinner';
import {InputMessageComponent} from '../input-message/input-message';
import {TranslocoPipe, TranslocoService} from '@ngneat/transloco';
import {CHAT_MOCK} from '../../mocks/mock-data';

@Component({
    selector: 'ngx-parl',
    imports: [NgOptimizedImage, ChatFlow, MatDialogContent, MatDialogTitle, MatProgressSpinner, InputMessageComponent, InputMessageComponent, InputMessageComponent, InputMessageComponent, TranslocoPipe],
    standalone: true,
    templateUrl: './ngx-parl.html',
    styleUrl: './ngx-parl.scss',
    changeDetection: ChangeDetectionStrategy.OnPush// this.cdr.markForCheck(); // або detectChanges()
})
export class NgxParlComponent {
    public ai_run_in_progress = false;
    public message_list: ChatMessage[] = CHAT_MOCK;

    constructor() {
    }

    sendMessage(message: string | undefined) {
        if (!message) {
            return this;
        }

        this.message_list = [
            ...this.message_list,
            new ChatMessage(
                (this.message_list.length + 1),
                1,
                '',
                'outgoing',
                message,
                'qwe',
                '',
            )
        ];

        return this;
    }
}
