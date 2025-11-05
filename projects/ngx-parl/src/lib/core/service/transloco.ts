import {Injectable} from '@angular/core';
import {TranslocoLoader} from '@ngneat/transloco';
import {HttpClient} from '@angular/common/http';

@Injectable({providedIn: 'root'})
export class AppTranslocoLoader implements TranslocoLoader {
    constructor(private http: HttpClient) {
    }

    getTranslation(lang: string) {
        return this.http.get(`../../assets/i18n/${lang}.json`);
    }
}
