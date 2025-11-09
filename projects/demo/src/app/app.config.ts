import {
    ApplicationConfig,
    provideBrowserGlobalErrorListeners,
    provideZoneChangeDetection
} from '@angular/core';
import {provideRouter} from '@angular/router';
import {routes} from './app.routes';
import {provideHttpClient, withFetch} from '@angular/common/http';
import {provideTransloco, translocoConfig} from '@ngneat/transloco';
import { AppTranslocoLoader } from '../../../ngx-parl/src/lib/core/service/transloco';

export const appConfig: ApplicationConfig = {
    providers: [
        provideBrowserGlobalErrorListeners(),
        provideZoneChangeDetection({eventCoalescing: true}),
        provideRouter(routes),
        provideHttpClient(withFetch()),
        provideTransloco({
            config: translocoConfig({
                availableLangs: ['uk', 'en'],
                defaultLang: 'en',
                reRenderOnLangChange: true,
                prodMode: false,
            }),
            loader: AppTranslocoLoader
        })
    ]
};
