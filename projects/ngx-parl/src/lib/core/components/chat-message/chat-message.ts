import {Component, computed, input, model} from '@angular/core';
import {DatePipe, NgClass, NgOptimizedImage} from '@angular/common';
import {MatIcon, MatIconRegistry} from '@angular/material/icon';
import {ChatMessage, MessageType} from '../../entity/chat';
import {DomSanitizer} from '@angular/platform-browser';
import {MatMenu, MatMenuItem, MatMenuTrigger} from '@angular/material/menu';

@Component({
    selector: 'lib-chat-message',
    imports: [
        NgClass,
        NgOptimizedImage,
        MatIcon,
        DatePipe,
        MatMenu,
        MatMenuItem,
        MatMenuTrigger,
    ],
    templateUrl: './chat-message.html',
    styleUrl: './chat-message.scss',
    standalone: true,
})

// export class ChatMessageComponent {
//     public currentMessage = input.required<ChatMessage>();
//     public edit = model<boolean>(false);
//
//     public delete_message = model<ChatMessage>();
//     public edit_message = model<ChatMessage>();
//
//     public requestEdit = model<ChatMessage | null>(null);
//     public requestDelete = model<number | null>(null);
//
//     constructor(private iconRegistry: MatIconRegistry, private sanitizer: DomSanitizer) {
//         this.iconRegistry.addSvgIcon('checked-message',
//             this.sanitizer.bypassSecurityTrustResourceUrl('../../assets/icons/checked-message.svg'));
//         this.iconRegistry.addSvgIcon('no-check',
//             this.sanitizer.bypassSecurityTrustResourceUrl('../../assets/icons/no-check.svg'));
//         this.iconRegistry.addSvgIcon('trash',
//             this.sanitizer.bypassSecurityTrustResourceUrl('../../assets/icons/trash.svg'));
//         this.iconRegistry.addSvgIcon('icon-edit',
//             this.sanitizer.bypassSecurityTrustResourceUrl('../../assets/icons/icon-edit.svg'));
//     }
//
//     private normalizeSourcePath(sourcePath: string): string {
//         const cleanedPath = (sourcePath ?? '').trim();
//         if (!cleanedPath) return '';
//
//         // Якщо це вже data/blob або URL — повертаємо як є
//         if (
//             cleanedPath.startsWith('data:') ||
//             cleanedPath.startsWith('blob:') ||
//             /^https?:\/\//i.test(cleanedPath)
//         ) {
//             return cleanedPath;
//         }
//
//         // Завжди повертаємо шлях із кореня assets
//         const assetsIndex = cleanedPath.indexOf('assets/');
//         if (assetsIndex >= 0) {
//             return '/' + cleanedPath.slice(assetsIndex); // → /assets/...
//         }
//
//         // Відносні шляхи типу ../assets/... теж нормалізуємо
//         return cleanedPath.replace(/^\.{1,2}\//, '/');
//     }
//
// // ✅ Працюємо з масивом; є м’який fallback для старих форматів
//     attachments = computed(() => {
//         const message = this.currentMessage();
//         const filePath = message.file_path;
//
//         // Новий формат — масив
//         if (Array.isArray(filePath)) {
//             return filePath
//                 .map(path => this.normalizeSourcePath(path))
//                 .filter(Boolean);
//         }
//
//         // Старий формат — рядок
//         const rawFilePath = (filePath as unknown as string) ?? '';
//         if (typeof rawFilePath !== 'string' || !rawFilePath.trim) return [];
//
//         // Якщо це JSON-масив
//         if (rawFilePath.trim().startsWith('[')) {
//             try {
//                 const parsedArray = JSON.parse(rawFilePath);
//                 if (Array.isArray(parsedArray)) {
//                     return parsedArray
//                         .map(item =>
//                             typeof item === 'string' ? this.normalizeSourcePath(item) : ''
//                         )
//                         .filter(Boolean);
//                 }
//             } catch {
//                 // ігноруємо помилку
//             }
//         }
//
//         // Якщо один data:URL
//         if (rawFilePath.startsWith('data:')) {
//             return [rawFilePath];
//         }
//
//         if (rawFilePath.includes('|')) {
//             return rawFilePath
//                 .split('|')
//                 .map(path => this.normalizeSourcePath(path))
//                 .filter(Boolean);
//         }
//         if (rawFilePath.includes(',')) {
//             return rawFilePath
//                 .split(',')
//                 .map(path => this.normalizeSourcePath(path))
//                 .filter(Boolean);
//         }
//
//         return [];
//     });
//
//     avatarSrc = computed(() => {
//         const message = this.currentMessage();
//         const fallback = message.type === 'incoming'
//             ? '../../assets/icons/avatar_anonym.svg'
//             : '../../assets/icons/avatar_manager.svg';
//
//         return message.avatar || fallback;
//     });
//
//     openContextMenu(event: Event, trigger: any) {
//         event.preventDefault();
//         event.stopPropagation();
//         trigger.openMenu();
//
//         return this;
//     }
//
//     editMessage(message: ChatMessage) {
//         this.edit.set(true);
//         this.edit_message.set(message);
//         this.requestEdit.set(message);
//
//         return this;
//     }
//
//     deleteMessage(message: ChatMessage) {
//         this.requestDelete.set(message.id);
//         queueMicrotask(() => this.requestDelete.set(null));
//
//         return this;
//     }
//
//     canDelete(message: ChatMessage): boolean {
//         return message.type === this.messageType.Outgoing;
//     }
//
//     public readonly messageType = MessageType;
// }


export class ChatMessageComponent {
    public currentMessage = input.required<ChatMessage>();
    public edit = model<boolean>(false);

    // ❌ НЕ ВИКОРИСТОВУЮТЬСЯ: внутрішні копії, події вже йдуть через model-виходи нижче
    // public delete_message = model<ChatMessage>();
    // public edit_message = model<ChatMessage>();

    // Виходи-методи через model(): на них підписаний ChatFlow як (requestEditChange)/(requestDeleteChange)
    public requestEdit = model<ChatMessage | null>(null);
    public requestDelete = model<number | null>(null);

    constructor(private iconRegistry: MatIconRegistry, private sanitizer: DomSanitizer) {
        this.iconRegistry.addSvgIcon('checked-message',
            this.sanitizer.bypassSecurityTrustResourceUrl('../../assets/icons/checked-message.svg'));
        this.iconRegistry.addSvgIcon('no-check',
            this.sanitizer.bypassSecurityTrustResourceUrl('../../assets/icons/no-check.svg'));
        this.iconRegistry.addSvgIcon('trash',
            this.sanitizer.bypassSecurityTrustResourceUrl('../../assets/icons/trash.svg'));
        this.iconRegistry.addSvgIcon('icon-edit',
            this.sanitizer.bypassSecurityTrustResourceUrl('../../assets/icons/icon-edit.svg'));
    }

    private normalizeSourcePath(sourcePath: string): string {
        const cleanedPath = (sourcePath ?? '').trim();
        if (!cleanedPath) return '';
        if (cleanedPath.startsWith('data:') || cleanedPath.startsWith('blob:') || /^https?:\/\//i.test(cleanedPath)) {
            return cleanedPath;
        }
        const assetsIndex = cleanedPath.indexOf('assets/');
        if (assetsIndex >= 0) return '/' + cleanedPath.slice(assetsIndex);
        return cleanedPath.replace(/^\.{1,2}\//, '/');
    }

    attachments = computed(() => {
        const message = this.currentMessage();
        const filePath = message.file_path;

        if (Array.isArray(filePath)) {
            return filePath.map(p => this.normalizeSourcePath(p)).filter(Boolean);
        }

        const rawFilePath = (filePath as unknown as string) ?? '';
        if (typeof rawFilePath !== 'string' || !rawFilePath.trim) return [];

        if (rawFilePath.trim().startsWith('[')) {
            try {
                const parsed = JSON.parse(rawFilePath);
                if (Array.isArray(parsed)) {
                    return parsed
                        .map(item => (typeof item === 'string' ? this.normalizeSourcePath(item) : ''))
                        .filter(Boolean);
                }
            } catch {}
        }

        if (rawFilePath.startsWith('data:')) return [rawFilePath];

        if (rawFilePath.includes('|')) {
            return rawFilePath.split('|').map(p => this.normalizeSourcePath(p)).filter(Boolean);
        }
        if (rawFilePath.includes(',')) {
            return rawFilePath.split(',').map(p => this.normalizeSourcePath(p)).filter(Boolean);
        }
        return [];
    });

    avatarSrc = computed(() => {
        const message = this.currentMessage();
        const fallback = message.type === 'incoming'
            ? '../../assets/icons/avatar_anonym.svg'
            : '../../assets/icons/avatar_manager.svg';
        return message.avatar || fallback;
    });

    openContextMenu(event: Event, trigger: any) {
        event.preventDefault();
        event.stopPropagation();
        trigger.openMenu();
        return this;
    }

    editMessage(message: ChatMessage) {
        this.edit.set(true);
        // ❌ this.edit_message.set(message); // внутрішня копія не потрібна
        this.requestEdit.set(message);
        return this;
    }

    deleteMessage(message: ChatMessage) {
        this.requestDelete.set(message.id);
        queueMicrotask(() => this.requestDelete.set(null));
        return this;
    }

    canDelete(message: ChatMessage): boolean {
        return message.type === this.messageType.Outgoing;
    }

    public readonly messageType = MessageType;
}
