import {
    afterNextRender,
    ChangeDetectionStrategy,
    Component, computed, effect, ElementRef,
    input, model, ViewChild,
} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {ChatMessage} from '../core/entity/chat';
import {ChatMessageComponent} from '../core/components/chat-message/chat-message';
import {ChatStartDayPipe} from '../core/pipes/chat-start-day-pipe';
import {ToggleDisplayChatStartDayPipe} from '../core/pipes/toggle-display-chat-start-day-pipe';

@Component({
    selector: 'app-chat-flow',
    imports: [
        FormsModule,
        ChatMessageComponent,
        ChatStartDayPipe,
        ToggleDisplayChatStartDayPipe
    ],
    templateUrl: './chat-flow.html',
    styleUrl: './chat-flow.scss',
})
export class ChatFlow {
    // message_list = input.required<ChatMessage[]>();
    // delete_message = model<ChatMessage>();
    // edit_message = model<ChatMessage>();
    // active_message: ChatMessage | null = null;
    //
    // @ViewChild('chatFlowRef', {static: true})
    // private flowRef!: ElementRef<HTMLElement>;
    //
    // constructor(private iconRegistry: MatIconRegistry, private sanitizer: DomSanitizer) {
    //     this.iconRegistry.addSvgIcon(
    //         'checked-message',
    //         this.sanitizer.bypassSecurityTrustResourceUrl('../../ssets/icons/checked-message.svg')
    //     );
    //
    //     afterNextRender(() => this.scrollToBottomInstant());
    //
    //     effect(() => {
    //         const len = this.message_list().length;
    //         if (len > 0) {
    //             queueMicrotask(() => this.scrollToBottomSmooth());
    //         }
    //     });
    // }
    //
    // trackByMessageId(_index: number, message: ChatMessage): number {
    //     return message.id;
    // }
    //
    // scrollToBottomInstant() {
    //     const el = this.flowRef?.nativeElement;
    //     if (!el) return;
    //     const prev = el.style.scrollBehavior;
    //     el.style.scrollBehavior = 'auto';
    //     el.scrollTop = el.scrollHeight;
    //     el.style.scrollBehavior = prev;
    //
    //     return this;
    // }
    //
    // scrollToBottomSmooth() {
    //     const el = this.flowRef?.nativeElement;
    //     if (!el) return;
    //     el.scrollTo({top: el.scrollHeight, behavior: 'smooth'});
    //
    //     return this;
    // }
    //
    // confirmDelete(message: ChatMessage) {
    //     this.active_message = message;
    //
    //     return this;
    // }
    //
    // deleteMessage() {
    //     if (this.active_message) {
    //         this.delete_message.set(this.active_message);
    //     }
    //
    //     return this;
    // }
    //
    // updateMessage(message: ChatMessage) {
    //     message.edit = false;
    //     this.edit_message.set(message);
    //
    //     return this;
    // }
    //
    // public readonly messageType = MessageType;


    messageListInput = input.required<ChatMessage[]>();
    messageList = computed(() => this.messageListInput());
    // ===== моделі дій (як у старому коді)
    delete_message = model<ChatMessage>();
    edit_message = model<ChatMessage>();
    active_message: ChatMessage | null = null;

    // ===== ViewChild для скролу
    @ViewChild('chatFlowRef', {static: true}) private flowRef!: ElementRef<HTMLElement>;

    // vm як проєкція — залишається
    // vm = computed(() => this.message_list());

    constructor() {
        // миттєво у самий низ після першого рендеру
        afterNextRender(() => this.scrollToBottomInstant());

        // плавний доскрол при кожній зміні довжини списку
        effect(() => {
            const len = this.messageList().length;
            if (len > 0) {
                queueMicrotask(() => this.scrollToBottomSmooth());
            }
        });
    }

    // ===== скроли
    scrollToBottomInstant() {
        const el = this.flowRef?.nativeElement;
        if (!el) return;
        const prev = el.style.scrollBehavior;
        el.style.scrollBehavior = 'auto';
        el.scrollTop = el.scrollHeight;
        el.style.scrollBehavior = prev;

        return this;
    }

    scrollToBottomSmooth() {
        const el = this.flowRef?.nativeElement;
        if (!el) return;
        el.scrollTo({top: el.scrollHeight, behavior: 'smooth'});

        return this;
    }

    // ===== дії з повідомленнями (логіка зі старого коду)
    confirmDelete(message: ChatMessage) {
        this.active_message = message;

        return this;
    }

    deleteMessage() {
        if (this.active_message) {
            this.delete_message.set(this.active_message);
            this.active_message = null;
        }

        return this;
    }

    updateMessage(message: ChatMessage) {
        // Після редагування знімаємо edit і віддаємо нагору зміну
        message.edit = false;
        this.edit_message.set(message);

        return this;
    }

    // приймаємо двобінд з дочірнього компоненту і піднімаємо зміну нагору (бо input.required)
    onEditChange(id: number, isEdit: boolean) {
        const next = this.messageList().map(m => m.id === id ? {...m, edit: isEdit} : m);

        return this;
        // важливо: для input.required оновлює БАТЬКО; тут лише піднімаємо намір,
        // або, якщо у вас є локальний signal, можна set(next).
        // this.messageList.set(next);
    }

    trackByMessageId(_index: number, message: ChatMessage): number {
        return message.id;
    }
}
