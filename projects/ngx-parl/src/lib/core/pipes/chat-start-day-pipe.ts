import { Pipe, PipeTransform } from '@angular/core';
import {DatePipe} from '@angular/common';
import {UtilsService} from '../service/utils/utils';
import {TranslocoService} from '@ngneat/transloco';

@Pipe({
  name: 'chatStartDay'
})
export class ChatStartDayPipe implements PipeTransform {
    constructor(protected utils: UtilsService, private transloco: TranslocoService) {}

    transform(value: string, format: string = 'd MMMM'): string {
        if (!value) {
            return '';
        }

        const locale = this.utils.langToLocale(this.transloco.getActiveLang());
        const datePipe = new DatePipe(locale);

        const valueDate = new Date(value);
        const today = new Date();

        const isToday = datePipe.transform(valueDate, 'shortDate') === datePipe.transform(today, 'shortDate');

        return isToday
            ? (locale.startsWith('uk') ? 'Сьогодні' : 'Today')
            : (datePipe.transform(valueDate, format) ?? '');
    }

}
