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

  it('returns today and yesterday labels', () => {
    const utils = { langToLocale: (lang: string) => (lang === 'uk' ? 'uk-UA' : 'en-US') } as UtilsService;
    const transloco = { getActiveLang: () => 'uk' } as TranslocoService;
    const pipe = new ChatStartDayPipe(utils, transloco);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    expect(pipe.transform(today.toISOString(), 'd MMMM', 'uk')).toBe('Сьогодні');
    expect(pipe.transform(yesterday.toISOString(), 'd MMMM', 'uk')).toBe('Вчора');
  });
});
