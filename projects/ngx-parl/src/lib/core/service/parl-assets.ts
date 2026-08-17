import {DOCUMENT} from '@angular/common';
import {Injectable, inject} from '@angular/core';

const parlAssetsFolder = 'assets/ngx-parl';

@Injectable({
    providedIn: 'root',
})
export class ParlAssets {
    private readonly document = inject(DOCUMENT);

    icon(fileName: string): string {
        return this.url(`icons/${fileName}`);
    }

    url(relativePath: string): string {
        const path = `${parlAssetsFolder}/${relativePath.replace(/^\//, '')}`;

        return new URL(path, this.document.baseURI).toString();
    }
}
