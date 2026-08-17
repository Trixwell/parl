import { Pipe, PipeTransform } from '@angular/core';
import {DatePipe} from '@angular/common';
import {UtilsService} from '../service/utils/utils';
import {TranslocoService} from '@ngneat/transloco';

@Pipe({
  name: 'chatStartDay',
})
export class ChatStartDayPipe implements PipeTransform {
    constructor(protected utils: UtilsService, private transloco: TranslocoService) {}

    transform(value: string, format: string = 'd MMMM', language?: string): string {
        if (!value) {
            return '';
        }

        const activeLang = language || this.transloco.getActiveLang();
        const locale = this.utils.langToLocale(activeLang);
        const datePipe = new DatePipe(locale);

        const valueDate = new Date(value);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);

        const isToday = datePipe.transform(valueDate, 'shortDate') === datePipe.transform(today, 'shortDate');
        if (isToday) {
            return locale.startsWith('uk') ? 'Сьогодні' : 'Today';
        }

        const isYesterday = datePipe.transform(valueDate, 'shortDate') === datePipe.transform(yesterday, 'shortDate');
        if (isYesterday) {
            return locale.startsWith('uk') ? 'Вчора' : 'Yesterday';
        }

        return datePipe.transform(valueDate, format) ?? '';
    }

}
