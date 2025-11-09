import {Injectable} from '@angular/core';
import {TranslocoLoader} from '@ngneat/transloco';
import {HttpClient} from '@angular/common/http';


@Injectable({
    providedIn: 'root'
})
export class UtilsService {

    constructor(protected http: HttpClient) {
    }

    langToLocale(lang: string): string {
        switch (lang) {
            case 'uk': return 'uk-UA';
            case 'en':
            default:   return 'en-US';
        }
    }
}
