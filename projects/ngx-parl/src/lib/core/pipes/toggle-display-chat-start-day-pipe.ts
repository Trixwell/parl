import {Pipe, PipeTransform} from '@angular/core';
import {DatePipe} from '@angular/common';
import {ChatMessage} from '../entity/chat';

@Pipe({
    name: 'toggleDisplayChatStartDay'
})
export class ToggleDisplayChatStartDayPipe implements PipeTransform {

    // transform(message: ChatMessage, messages: ChatMessage[], i: number): boolean {
    //     const datePipe: DatePipe = new DatePipe('uk-UA');
    //     const previousMessage: ChatMessage | undefined = messages[i + 1];
    //
    //     return previousMessage
    //         ? datePipe.transform(message.cr_time, 'shortDate') !== datePipe.transform(previousMessage.cr_time, 'shortDate')
    //         : true;
    // }

    transform(message: ChatMessage, messages: ChatMessage[], i: number): boolean {
        const datePipe: DatePipe = new DatePipe('uk-UA'); // en-US
        const previousMessage: ChatMessage | undefined = messages[i + 1];

        return previousMessage
            ? datePipe.transform(message.cr_time, 'shortDate') !==
            datePipe.transform(previousMessage.cr_time, 'shortDate')
            : true;
    }
}
