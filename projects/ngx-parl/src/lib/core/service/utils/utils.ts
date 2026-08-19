import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';


@Injectable({
    providedIn: 'root'
})
export class UtilsService {

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
            return cleanedPath.slice(assetsIndex);
        }

        return cleanedPath.replace(/^\.{1,2}\//, '/');
    }

    filterAllowedHtml(source: string): string {
        const content = source ?? '';
        if (!content) {
            return '';
        }

        return content.replace(
            /<\/?([a-zA-Z][a-zA-Z0-9-]*)\b([^>]*)>/g,
            (fullTag, rawName: string, rawAttrs: string) => {
                const tagName = rawName.toLowerCase();
                const isClosing = fullTag.startsWith('</');

                if (!this.allowedMessageTags.has(tagName)) {
                    return this.escapeHtml(fullTag);
                }

                if (isClosing) {
                    return `</${tagName}>`;
                }

                if (tagName === 'br') {
                    return '<br>';
                }

                if (tagName === 'a') {
                    const href = this.readSafeHref(rawAttrs);
                    if (!href) {
                        return '';
                    }

                    return `<a href="${href}" target="_blank" rel="noopener noreferrer">`;
                }

                return `<${tagName}>`;
            },
        );
    }

    private readonly allowedMessageTags = new Set([
        'a',
        'b',
        'br',
        'code',
        'em',
        'i',
        'pre',
        's',
        'strong',
        'u',
    ]);

    private escapeHtml(value: string): string {
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    private readSafeHref(attrs: string): string {
        const match = attrs.match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
        const href = (match?.[1] ?? match?.[2] ?? match?.[3] ?? '').trim();
        if (!/^(https?:|mailto:|tel:)/i.test(href)) {
            return '';
        }

        return href.replace(/"/g, '&quot;');
    }
}
