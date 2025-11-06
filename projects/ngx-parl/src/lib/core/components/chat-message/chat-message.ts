import {ChangeDetectionStrategy, Component, computed, input, model} from '@angular/core';
import {DatePipe, NgClass, NgOptimizedImage} from '@angular/common';
import {MatIcon, MatIconRegistry} from '@angular/material/icon';
import {ChatMessage, MessageType} from '../../entity/chat';
import {DomSanitizer} from '@angular/platform-browser';

@Component({
    selector: 'lib-chat-message',
    imports: [
        NgClass,
        NgOptimizedImage,
        MatIcon,
        DatePipe,
    ],
    templateUrl: './chat-message.html',
    styleUrl: './chat-message.scss',
    standalone: true,
})
export class ChatMessageComponent {
    currentMessage = input.required<ChatMessage>();

    edit = model<boolean>(false);

    constructor(private iconRegistry: MatIconRegistry, private sanitizer: DomSanitizer) {
        this.iconRegistry.addSvgIcon(
            'checked-message',
            this.sanitizer.bypassSecurityTrustResourceUrl('../../assets/icons/checked-message.svg')
        );
    }

    // список вкладень (картинки)
    attachments = computed(() => {
        const raw = this.currentMessage()?.file_path?.trim() ?? '';

        return raw ? raw.split(',').map(s => s.trim()).filter(Boolean) : [];
    });

    // аватар за типом
    avatarSrc = computed(() => {
        const message = this.currentMessage();
        const fallback = message.type === 'incoming'
            ? '../../assets/icons/avatar_anonym.svg'
            : '../../assets/icons/avatar_manager.svg';

        return message.avatar || fallback;
    });

    public readonly messageType = MessageType;
}
