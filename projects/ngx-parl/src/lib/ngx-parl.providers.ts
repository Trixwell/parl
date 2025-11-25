import { isDevMode } from '@angular/core';
import { provideTransloco } from '@ngneat/transloco';
import { ParlTranslocoLoader } from '../assets/i18n/parl-transloco.loader';

export function provideNgxParl() {
    return provideTransloco({
        config: {
            availableLangs: ['en', 'uk'],
            defaultLang: 'en',
            reRenderOnLangChange: true,
            prodMode: !isDevMode(),
        },
        loader: ParlTranslocoLoader,
    });
}
