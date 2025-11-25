import { Injectable } from '@angular/core';
import { TranslocoLoader, Translation } from '@ngneat/transloco';
import { Observable, of } from 'rxjs';

import en from '../../assets/i18n/en.json';
import uk from '../../assets/i18n/uk.json';

@Injectable()
export class ParlTranslocoLoader implements TranslocoLoader {
    getTranslation(lang: string): Observable<Translation> {
        switch (lang) {
            case 'uk':
                return of(uk as Translation);
            case 'en':
            default:
                return of(en as Translation);
        }
    }
}
