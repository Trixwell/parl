import {Pipe, PipeTransform} from '@angular/core';
import {DatePipe} from '@angular/common';
import {ChatMessage} from '../entity/chat';
import {UtilsService} from '../service/utils/utils';
import {TranslocoService} from '@ngneat/transloco';

@Pipe({
    name: 'toggleDisplayChatStartDay',
})
export class ToggleDisplayChatStartDayPipe implements PipeTransform {

    constructor(protected utils: UtilsService, private transloco: TranslocoService) {}

    transform(message: ChatMessage, messages: ChatMessage[], i: number, language?: string): boolean {
        const activeLang = language || this.transloco.getActiveLang();
        const locale = this.utils.langToLocale(activeLang);
        const datePipe = new DatePipe(locale);

        const prev = i > 0 ? messages[i - 1] : undefined;

        const currDay = datePipe.transform(new Date(message.cr_time), 'shortDate');
        const prevDay = prev ? datePipe.transform(new Date(prev.cr_time), 'shortDate') : undefined;

        return prev ? currDay !== prevDay : true;
    }
}
