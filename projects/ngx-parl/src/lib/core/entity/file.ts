export class ImageFile {
    constructor(
        public id: string,
        public url: string,
        public cr_time: string,
    ) {}
}

export type OriginalKind = 'image' | 'gif';

export interface PreviewItem {
    originalKind: OriginalKind;
    duration?: number;
    src: string;
    name: string;
    type: string;
    size: number;
}

export enum FileType {
    IMAGE = 'image',
    GIF = 'gif'
}
