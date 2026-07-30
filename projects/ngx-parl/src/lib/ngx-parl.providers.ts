import { isDevMode } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeEn from '@angular/common/locales/en';
import localeUk from '@angular/common/locales/uk';
import { provideTransloco } from '@ngneat/transloco';
import { ParlTranslocoLoader } from '../assets/i18n/parl-transloco.loader';

let parlLocalesRegistered = false;

function registerParlLocales(): void {
    if (parlLocalesRegistered) {
        return;
    }

    registerLocaleData(localeEn, 'en');
    registerLocaleData(localeEn, 'en-US');
    registerLocaleData(localeUk, 'uk');
    registerLocaleData(localeUk, 'uk-UA');
    parlLocalesRegistered = true;
}

export function provideNgxParl() {
    registerParlLocales();

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
