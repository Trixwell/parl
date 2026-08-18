import {
    AfterViewInit,
    Component,
    computed,
    DestroyRef,
    effect,
    ElementRef,
    inject,
    input,
    model,
    NgZone,
    OnDestroy,
    Optional,
    signal,
    ViewChild,
} from '@angular/core';
import {takeUntilDestroyed, toObservable} from '@angular/core/rxjs-interop';
import {NgClass, NgOptimizedImage} from '@angular/common';
import {ChatFlowComponent} from '../chat-flow/chat-flow';
import {MatDialogContent, MatDialogRef, MatDialogTitle} from '@angular/material/dialog';
import {
    ChatMessage,
    ChatMessageDTO,
    ChatMessageType,
    CurrMessage,
    MessageActionEvent,
    MessageType
} from '../core/entity/chat';
import {MatProgressSpinner} from '@angular/material/progress-spinner';
import {InputMessageComponent} from '../input-message/input-message';
import {
    TranslocoModule,
    TranslocoPipe,
    TranslocoService,
} from '@ngneat/transloco';
import {UtilsService} from '../core/service/utils/utils';
import {FlowTheme, ParlLayout} from '../core/entity/theme';
import {distinctUntilChanged, map, Subscription, switchMap} from 'rxjs';
import {ParlQuickActionClickEvent, ParlQuickActionsResolver, ParlQuickActionsWhen} from '../core/entity/quick-actions';
import {
    measureVisualViewportOverlap,
    pickKeyboardOverlap,
    readKeyboardEventHeight,
    readNativeOverlayHeight,
    readVirtualKeyboardHeight,
} from '../core/service/keyboard/keyboard-overlap';

@Component({
    selector: 'ngx-parl',
    standalone: true,
    imports: [
        NgOptimizedImage, NgClass, MatDialogContent, MatDialogTitle, MatProgressSpinner, ChatFlowComponent, InputMessageComponent,
        TranslocoModule,
        TranslocoPipe
    ],
    templateUrl: './ngx-parl.html',
    styleUrl: './ngx-parl.scss',
    providers: [],
    host: {
        '[class.ngx-parl--fill]': 'isFillLayout()',
        '[class.ngx-parl--mobile]': 'mobileMode()',
        '[class.ngx-parl--keyboard-open]': 'isKeyboardOpen()',
        '[class.ngx-parl--emoji-open]': 'emojiPickerOpen()',
        '[style.--parl-keyboard-inset]': 'keyboardInsetCss()',
    },
})
export class NgxParlComponent implements AfterViewInit, OnDestroy {
    @ViewChild(ChatFlowComponent) chatFlow?: ChatFlowComponent;
    @ViewChild(InputMessageComponent) inputMessage?: InputMessageComponent;

    public ai_run_in_progress = false;
    public dragActive = model<boolean>(false);
    private dragDepth = 0;
    private lastUpdateKey: string | null = null;
    private nextTempId = -1;
    private lastKeyboardInset = 0;

    public theme = input<FlowTheme>(FlowTheme.PRIMARY);
    public header = input<boolean>(true);
    public language = input<'en' | 'uk'>('en');
    public layout = input<ParlLayout>('dialog');
    public keyboardInset = input<number>(0);
    public autoFocus = input<boolean>(true);
    public scrollToBottomOnKeyboard = input<boolean>(true);
    public hasMoreHistory = input<boolean>(true);
    public quickActionsWhen = input<ParlQuickActionsWhen>(ParlQuickActionsWhen.ALWAYS);
    public isFillLayout = computed(() => this.layout() === 'fill');
    public emojiPickerOpen = signal(false);
    private readonly detectedKeyboardInset = signal(0);
    private pluginKeyboardInset = 0;
    public readonly resolvedKeyboardInset = computed(() =>
        pickKeyboardOverlap([this.keyboardInset(), this.detectedKeyboardInset()]),
    );
    public isKeyboardOpen = computed(() => this.resolvedKeyboardInset() > 0 && !this.emojiPickerOpen());
    public keyboardInsetCss = computed(() =>
        this.emojiPickerOpen() ? '0px' : `${this.resolvedKeyboardInset()}px`
    );

    public messageList = model<ChatMessage[]>([]);
    public messageUpdate = model<ChatMessage>();
    public selectedForEdit = model<ChatMessage | null>(null);
    public messageAction = model<MessageActionEvent | null>(null);

    public incomingUser = input<string>('');
    public transportType = input<string>('');
    public transportTypeIcon = input<string>('');
    public transportTypeIconSrc = computed(() => this.utils.normalizeSourcePath(this.transportTypeIcon()));

    public logoChat = input<string>('');
    public incomingAvatar = input<string>('');

    public mobileMode = input<boolean>(false);
    public quickActionsResolver = input<ParlQuickActionsResolver | null>(null);
    public quickActionClick = model<ParlQuickActionClickEvent | null>(null);
    public quickActionsAutoSend = input<boolean>(true);

    public hideHandler = input<(() => unknown) | null>(null);
    public closeHandler = input<(() => unknown) | null>(null);

    public scrollToBottomTrigger = model<number>(0);
    public loadHistory = model<boolean>(false);
    private focusTimers: number[] = [];
    private afterOpenedSubscription?: Subscription;

    private readonly hostElement = inject(ElementRef<HTMLElement>);
    private readonly ngZone = inject(NgZone);
    private readonly destroyRef = inject(DestroyRef);
    private keyboardSyncRaf: number | null = null;
    private focusPollId: ReturnType<typeof setInterval> | null = null;
    private capacitorKeyboardRemovers: Array<() => void> = [];

    constructor(private utils: UtilsService,
                private transloco: TranslocoService,
                @Optional() private dialogRef?: MatDialogRef<NgxParlComponent>) {
        toObservable(this.language)
            .pipe(
                distinctUntilChanged(),
                switchMap(language =>
                    this.transloco.load(language).pipe(map(() => language)),
                ),
                takeUntilDestroyed(),
            )
            .subscribe(language => {
                this.transloco.setActiveLang(language);
            });

        effect(() => {
            const updatedMessage = this.messageUpdate();

            if (!updatedMessage) {
                return;
            }

            const key = `${updatedMessage.id}-${updatedMessage.cr_time}-${updatedMessage.type}`;
            if (this.lastUpdateKey === key) {
                return;
            }

            this.lastUpdateKey = key;

            queueMicrotask(() => {
                this.messageList.update(list => {
                    const index = list.findIndex(m => m.id === updatedMessage.id);

                    if (index > -1) {
                        const updated = [...list];
                        updated[index] = updatedMessage;
                        return updated;
                    }

                    return [...list, updatedMessage];
                });

                if (this.chatFlow?.isAtBottom() ?? true) {
                    this.scrollToBottom();
                }
            });
        });

        effect(() => {
            this.emojiPickerOpen();
            this.mobileMode();
            this.scheduleKeyboardOverlapSync();
        });

        effect(() => {
            const inset = this.emojiPickerOpen() ? 0 : this.resolvedKeyboardInset();
            if (this.scrollToBottomOnKeyboard() && inset > 0 && this.lastKeyboardInset === 0) {
                queueMicrotask(() => this.scrollToBottom());
            }
            this.lastKeyboardInset = inset;
        });
    }

    onQuickActionClick(event: ParlQuickActionClickEvent | null): this {
        this.quickActionClick.set(event);

        if (!event) {
            return this;
        }

        const content = (event.value ?? '').trim();

        if (this.quickActionsAutoSend() && content) {
            try {
                this.sendMessage({content});
            } catch (error) {
                console.error('Quick action send failed', error);
            }
        }

        return this;
    }

    ngAfterViewInit() {
        this.bindKeyboardOverlapListeners();
        if (this.dialogRef) {
            this.afterOpenedSubscription = this.dialogRef.afterOpened().subscribe(() => {
                this.queueInitialFocus();
            });
        } else {
            this.queueInitialFocus();
        }
    }

    ngOnDestroy() {
        this.focusTimers.forEach(timerId => clearTimeout(timerId));
        this.focusTimers = [];
        this.afterOpenedSubscription?.unsubscribe();
        this.stopFocusPoll();
        if (this.keyboardSyncRaf !== null) {
            cancelAnimationFrame(this.keyboardSyncRaf);
            this.keyboardSyncRaf = null;
        }
        this.capacitorKeyboardRemovers.forEach(remove => remove());
        this.capacitorKeyboardRemovers = [];
    }

    private bindKeyboardOverlapListeners(): this {
        if (typeof window === 'undefined') {
            return this;
        }

        const onSync = () => this.scheduleKeyboardOverlapSync();
        const onShow = (event: Event) => {
            const detail = (event as CustomEvent<{ dismissed?: boolean }>).detail;
            this.pluginKeyboardInset = detail?.dismissed ? 0 : readKeyboardEventHeight(event);
            this.syncDetectedKeyboardInset();
        };
        const onHide = () => {
            this.pluginKeyboardInset = 0;
            this.syncDetectedKeyboardInset();
        };
        const onFocusChange = () => {
            if (this.hasComposerFocus()) {
                this.startFocusPoll();
            } else {
                this.stopFocusPoll();
            }
            this.scheduleKeyboardOverlapSync();
        };

        const viewport = window.visualViewport;
        this.ngZone.runOutsideAngular(() => {
            viewport?.addEventListener('resize', onSync);
            viewport?.addEventListener('scroll', onSync);
            window.addEventListener('resize', onSync);
            window.addEventListener('orientationchange', onSync);
            window.addEventListener('keyboardWillShow', onShow);
            window.addEventListener('keyboardDidShow', onShow);
            window.addEventListener('keyboardWillHide', onHide);
            window.addEventListener('keyboardDidHide', onHide);
            window.addEventListener('ionKeyboardDidShow', onShow);
            window.addEventListener('ionKeyboardDidHide', onHide);
            window.addEventListener('nativekeyboardoverlay', onShow);
            document.addEventListener('focusin', onFocusChange);
            document.addEventListener('focusout', onFocusChange);
            this.bindVirtualKeyboardListener(onSync);
            void this.bindCapacitorKeyboardListeners();
        });

        this.destroyRef.onDestroy(() => {
            viewport?.removeEventListener('resize', onSync);
            viewport?.removeEventListener('scroll', onSync);
            window.removeEventListener('resize', onSync);
            window.removeEventListener('orientationchange', onSync);
            window.removeEventListener('keyboardWillShow', onShow);
            window.removeEventListener('keyboardDidShow', onShow);
            window.removeEventListener('keyboardWillHide', onHide);
            window.removeEventListener('keyboardDidHide', onHide);
            window.removeEventListener('ionKeyboardDidShow', onShow);
            window.removeEventListener('ionKeyboardDidHide', onHide);
            window.removeEventListener('nativekeyboardoverlay', onShow);
            document.removeEventListener('focusin', onFocusChange);
            document.removeEventListener('focusout', onFocusChange);
        });

        this.scheduleKeyboardOverlapSync();

        return this;
    }

    private bindVirtualKeyboardListener(onSync: () => void): this {
        const virtualKeyboard = (navigator as Navigator & {
            virtualKeyboard?: {
                addEventListener?: (type: string, listener: () => void) => void;
                removeEventListener?: (type: string, listener: () => void) => void;
            };
        }).virtualKeyboard;
        if (!virtualKeyboard?.addEventListener) {
            return this;
        }

        virtualKeyboard.addEventListener('geometrychange', onSync);
        this.destroyRef.onDestroy(() => {
            virtualKeyboard.removeEventListener?.('geometrychange', onSync);
        });

        return this;
    }

    private async bindCapacitorKeyboardListeners(): Promise<this> {
        const keyboard = (window as Window & {
            Capacitor?: {
                Plugins?: {
                    Keyboard?: {
                        addListener?: (
                            eventName: string,
                            callback: (info: { keyboardHeight?: number }) => void,
                        ) => Promise<{ remove: () => Promise<void> }> | { remove: () => Promise<void> };
                    };
                };
            };
        }).Capacitor?.Plugins?.Keyboard;
        if (!keyboard?.addListener) {
            return this;
        }

        const onShow = (info: { keyboardHeight?: number }) => {
            this.pluginKeyboardInset = Math.max(0, Math.round(info.keyboardHeight ?? 0));
            this.scheduleKeyboardOverlapSync();
        };
        const onHide = () => {
            this.pluginKeyboardInset = 0;
            this.scheduleKeyboardOverlapSync();
        };

        const handles = await Promise.all([
            keyboard.addListener('keyboardWillShow', onShow),
            keyboard.addListener('keyboardDidShow', onShow),
            keyboard.addListener('keyboardWillHide', onHide),
            keyboard.addListener('keyboardDidHide', onHide),
        ]);

        this.capacitorKeyboardRemovers = handles.map(handle => () => {
            void handle.remove();
        });

        return this;
    }

    private scheduleKeyboardOverlapSync(): this {
        if (this.keyboardSyncRaf !== null) {
            return this;
        }

        this.keyboardSyncRaf = requestAnimationFrame(() => {
            this.keyboardSyncRaf = null;
            this.syncDetectedKeyboardInset();
        });

        return this;
    }

    private syncDetectedKeyboardInset(): this {
        const nextInset = this.emojiPickerOpen()
            ? 0
            : pickKeyboardOverlap([
                measureVisualViewportOverlap(this.hostElement.nativeElement),
                this.pluginKeyboardInset,
                readNativeOverlayHeight(),
                readVirtualKeyboardHeight(),
            ]);

        if (nextInset === this.detectedKeyboardInset()) {
            return this;
        }

        this.ngZone.run(() => this.detectedKeyboardInset.set(nextInset));

        return this;
    }

    private hasComposerFocus(): boolean {
        const target = document.activeElement;
        if (!(target instanceof HTMLElement)) {
            return false;
        }

        return this.hostElement.nativeElement.contains(target)
            && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.isContentEditable);
    }

    private startFocusPoll(): this {
        if (this.focusPollId !== null) {
            return this;
        }

        this.focusPollId = setInterval(() => this.scheduleKeyboardOverlapSync(), 100);

        return this;
    }

    private stopFocusPoll(): this {
        if (this.focusPollId !== null) {
            clearInterval(this.focusPollId);
            this.focusPollId = null;
        }

        return this;
    }

    private queueInitialFocus() {
        if (!this.autoFocus()) {
            return;
        }

        const focusInputIfAppropriate = (allowStealingFocus: boolean) => {
            if (!this.inputMessage) {
                return;
            }
            if (!allowStealingFocus) {
                const activeElement = document.activeElement;
                if (activeElement && activeElement !== document.body) {
                    return;
                }
            }

            this.inputMessage.focusInput();
        };

        const immediateTimerId = window.setTimeout(() => {
            focusInputIfAppropriate(true);
        }, 0);
        this.focusTimers.push(immediateTimerId);

        const delayedTimerId = window.setTimeout(() => {
            focusInputIfAppropriate(false);
        }, 200);

        this.focusTimers.push(delayedTimerId);
    }

    onCancelEdit(messageId: number | null) {
        if (messageId != null) {
            this.messageList.update(list => {
                const updated = [...list];
                const index = updated.findIndex(m => m.id === messageId);
                if (index > -1) {
                    updated[index].edit = false;
                }
                return updated;
            });
        }

        this.selectedForEdit.set(null);

        return this;
    }

    onRequestDelete(messageId: number | null) {
        if (messageId == null) {
            return this;
        }

        const message = this.messageList().find(m => m.id === messageId);
        const content = (message as { content?: string })?.content ?? '';

        this.messageList.update(list => list.filter(m => m.id !== messageId));

        this.pushMessageAction({
            action: 'delete',
            chatMessageId: messageId,
            content,
        });

        return this;
    }

    sendMessage(
        event:
            | CurrMessage
            | string
            | undefined
    ) {
        if (!event) {
            return this;
        }

        // edit message
        if (this.isCurrMessage(event) && event.id !== undefined) {
            const {id, content, file_path, file_list, user_id, user, transport_type, transport_type_icon} = event;

            this.messageList.update((currentList) => {
                const updatedList = [...currentList];
                const index = updatedList.findIndex(
                    (message) => message.id === id,
                );

                if (index > -1) {
                    updatedList[index].content = (content ?? '').trim();

                    updatedList[index].file_path =
                        Array.isArray(file_path) && file_path.length ? file_path : null;
                    updatedList[index].file_list =
                        Array.isArray(file_list) && file_list.length ? file_list : null;
                    if (transport_type !== undefined) {
                        updatedList[index].transport_type = transport_type ?? null;
                    }
                    if (transport_type_icon !== undefined) {
                        updatedList[index].transport_type_icon = transport_type_icon ?? null;
                    }

                    updatedList[index].edit = false;
                }

                return updatedList;
            });

            this.selectedForEdit.set(null);

            this.pushMessageAction({
                action: 'edit',
                chatMessageId: id,
                content: (content ?? '').trim(),
                file_path: Array.isArray(file_path) && file_path.length ? file_path : [],
                file_list: Array.isArray(file_list) && file_list.length ? file_list : [],
                user_id: user_id,
                user: user,
                transport_type: transport_type ?? null,
                transport_type_icon: transport_type_icon ?? null,
            });

            return this;
        }

        // new message
        if (this.isCurrMessage(event)) {
            const hasFiles = Array.isArray(event.file_path) && event.file_path.length > 0;

            if (!hasFiles) {
                const {content, user_id, user, transport_type, transport_type_icon} = event;
                const text = (content ?? '').trim();
                if (!hasMessageText(text)) {
                    return this;
                }

                const dto = this.createOptimisticOutgoing({
                    content: text,
                    transport_type,
                    transport_type_icon,
                });

                this.messageList.update((list) => [...list, new ChatMessage(dto)]);
                this.scrollToBottomTrigger.update(v => v + 1);
                this.pushMessageAction({
                    action: 'send',
                    chatMessageId: dto.id,
                    content: text,
                    user_id: user_id,
                    user: user,
                    transport_type: dto.transport_type ?? null,
                    transport_type_icon: dto.transport_type_icon ?? null,
                });

                return this;
            }
        }

        // new message + files
        if (!this.isCurrMessage(event)) {
            return this;
        }

        const {content, file_path, file_list, user_id, user, transport_type, transport_type_icon} = event;
        const text = (content ?? '').trim();
        const hasFiles = Array.isArray(file_path) && file_path.length > 0;
        const hasFileList = Array.isArray(file_list) && file_list.length > 0;

        if (!hasMessageText(text) && !hasFiles) {
            return this;
        }

        const dto = this.createOptimisticOutgoing({
            content: text,
            file_path: hasFiles ? file_path : [],
            file_list: hasFileList ? file_list : [],
            transport_type,
            transport_type_icon,
        });

        this.messageList.update((list) => [...list, new ChatMessage(dto)]);
        this.scrollToBottomTrigger.update(v => v + 1);
        this.pushMessageAction({
            action: 'send',
            chatMessageId: dto.id,
            content: text,
            file_path: hasFiles ? file_path : [],
            file_list: hasFileList ? file_list : [],
            user_id: user_id,
            user: user,
            transport_type: dto.transport_type ?? null,
            transport_type_icon: dto.transport_type_icon ?? null,
        });

        return this;
    }

    confirmPending(tempId: number, dto: ChatMessageDTO): this {
        this.messageList.update(list => {
            const index = list.findIndex(message => message.id === tempId);
            if (index === -1) {
                return list;
            }

            const current = list[index];
            const updated = [...list];
            updated[index] = new ChatMessage({
                id: dto.id,
                chat_id: dto.chat_id ?? current.chat_id,
                cr_time: dto.cr_time ?? current.cr_time,
                type: dto.type ?? current.type,
                transport_type: dto.transport_type ?? current.transport_type,
                transport_type_icon: dto.transport_type_icon ?? current.transport_type_icon,
                user: dto.user ?? current.user,
                content: dto.content ?? current.content,
                avatar: dto.avatar ?? current.avatar,
                file_path: dto.file_path ?? current.file_path,
                file_list: dto.file_list ?? current.file_list,
                checked: dto.checked ?? true,
                pending: false,
                actions: dto.actions ?? current.actions,
            });

            return updated;
        });

        return this;
    }

    rejectPending(tempId: number): this {
        this.messageList.update(list => list.filter(message => message.id !== tempId));

        return this;
    }

    isCurrMessage(event: unknown): event is CurrMessage {
        return typeof event === 'object' && event !== null && 'content' in event;
    }

    private allocateTempId(): number {
        const existingIds = new Set(this.messageList().map(message => message.id));
        let tempId = this.nextTempId;

        while (tempId >= 0 || existingIds.has(tempId)) {
            tempId -= 1;
        }

        this.nextTempId = tempId - 1;

        return tempId;
    }

    private createOptimisticOutgoing(event: {
        content: string;
        file_path?: string[] | null;
        file_list?: File[] | null;
        transport_type?: string | null;
        transport_type_icon?: string | null;
    }): ChatMessageDTO {
        const messages = this.messageList();
        const lastOutgoing = [...messages]
            .reverse()
            .find((message) => message.type === MessageType.Outgoing);
        const fallbackTransport = lastOutgoing?.transport_type ?? this.transportType() ?? null;
        const fallbackTransportIcon = lastOutgoing?.transport_type_icon ?? this.transportTypeIcon() ?? null;
        const filePath = Array.isArray(event.file_path) ? event.file_path : [];
        const fileList = Array.isArray(event.file_list) ? event.file_list : [];

        return {
            id: this.allocateTempId(),
            chat_id: lastOutgoing?.chat_id ?? 1,
            cr_time: this.utils.getLocalISODate(),
            type: MessageType.Outgoing as ChatMessageType,
            transport_type: event.transport_type ?? fallbackTransport,
            transport_type_icon: event.transport_type_icon ?? fallbackTransportIcon,
            user: lastOutgoing?.user ?? '',
            content: event.content,
            avatar: lastOutgoing?.avatar ?? null,
            file_path: filePath,
            file_list: fileList,
            checked: true,
            pending: true,
            actions: [],
        };
    }

    pushMessageAction(event: MessageActionEvent) {
        this.messageAction.set(event);
        setTimeout(() => this.messageAction.set(null), 0);
        return this;
    }

    scrollToBottom(): this {
        this.chatFlow?.scrollToBottom();

        return this;
    }

    onHideClick() {
        const handler = this.hideHandler();

        if (handler) {
            handler();
        }
        return this;
    }

    onCloseClick() {
        const handler = this.closeHandler();

        if (handler) {
            handler();
        }

        return this;
    }

    onDragOver(event: DragEvent) {
        event.preventDefault();
        event.stopPropagation();
        if (event.dataTransfer) {
            event.dataTransfer.dropEffect = 'copy';
        }
        this.dragActive.set(true);

        return this;
    }

    onDragEnter(event: DragEvent) {
        event.preventDefault();
        event.stopPropagation();
        this.dragDepth += 1;
        this.dragActive.set(true);

        return this;
    }

    onDragLeave(event: DragEvent) {
        event.preventDefault();
        event.stopPropagation();
        this.dragDepth = Math.max(0, this.dragDepth - 1);
        if (this.dragDepth === 0) {
            this.dragActive.set(false);
        }

        return this;
    }

    onDrop(event: DragEvent) {
        event.preventDefault();
        event.stopPropagation();
        this.dragDepth = 0;
        this.dragActive.set(false);

        const files = event.dataTransfer?.files;
        if (!files?.length) {
            return this;
        }

        this.inputMessage?.addFiles(Array.from(files));

        return this;
    }

    protected readonly FlowTheme = FlowTheme;
}

function hasMessageText(value: string | null | undefined): boolean {
    if (!value) {
        return false;
    }

    return [...value.trim()].length > 0;
}
