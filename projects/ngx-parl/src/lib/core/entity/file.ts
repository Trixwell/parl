export class ImageFile {
    constructor(
        public id: string,
        public url: string,
        public cr_time: string,
    ) {}
}

export type OriginalKind = 'image' | 'gif';

export type PreviewUploadStatus = 'ready' | 'reading' | 'error' | 'oversized';

export interface PreviewItem {
    originalKind: OriginalKind;
    duration?: number;
    src: string;
    name: string;
    type: string;
    size: number;
    progress?: number;
    status?: PreviewUploadStatus;
    error?: string | null;
}

export enum FileType {
    IMAGE = 'image',
    GIF = 'gif'
}
