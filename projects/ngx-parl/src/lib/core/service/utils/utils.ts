import {DOCUMENT} from '@angular/common';
import {Injectable, inject} from '@angular/core';
import {HttpClient} from '@angular/common/http';


@Injectable({
    providedIn: 'root'
})
export class UtilsService {
    private readonly document = inject(DOCUMENT);

    constructor(protected http: HttpClient) {
    }

    langToLocale(lang: string): string {
        switch (lang) {
            case 'uk':
                return 'uk-UA';
            case 'en':
            default:
                return 'en-US';
        }
    }

    getLocalISODate(): string {
        const d = new Date();

        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');

        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        const seconds = String(d.getSeconds()).padStart(2, '0');

        return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
    }

    normalizeSourcePath(sourcePath: string): string {
        const cleanedPath = (sourcePath ?? '').trim();
        if (!cleanedPath) {
            return '';
        }

        if (cleanedPath.startsWith('data:') || cleanedPath.startsWith('blob:') || /^https?:\/\//i.test(cleanedPath)) {
            return cleanedPath;
        }

        const assetsIndex = cleanedPath.indexOf('assets/');
        if (assetsIndex >= 0) {
            return new URL(cleanedPath.slice(assetsIndex), this.document.baseURI).toString();
        }

        return cleanedPath.replace(/^\.{1,2}\//, '/');
    }
}
