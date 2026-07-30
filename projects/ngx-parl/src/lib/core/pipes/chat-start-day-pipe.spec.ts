import { ChatStartDayPipe } from './chat-start-day-pipe';
import { UtilsService } from '../service/utils/utils';
import { TranslocoService } from '@ngneat/transloco';

describe('ChatStartDayPipe', () => {
  it('create an instance', () => {
    const utils = { langToLocale: (lang: string) => (lang === 'uk' ? 'uk-UA' : 'en-US') } as UtilsService;
    const transloco = { getActiveLang: () => 'en' } as TranslocoService;
    const pipe = new ChatStartDayPipe(utils, transloco);
    expect(pipe).toBeTruthy();
  });
});
