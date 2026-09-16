let nextMessageClientKey = 1;

function allocateMessageClientKey(): number {
    return nextMessageClientKey++;
}

export class ChatMessage {
    /** Stable @for track key; survives temp-id → server-id ACK without remounting the bubble. */
    public readonly clientKey: number;
    public id: number;
    public chat_id: number;
    public cr_time: string;
    public type: ChatMessageType;
    public transport_type: string | null;
    public transport_type_icon: string | null;
    public user: string;
    public content: string;
    public avatar: string | null;
    public file_path: string[] | null;
    public file_list: File[] | null;
    public actions: ChatQuickButton[];

    public checked: boolean | null;
    public edit = false;
    public pending = false;
    public failed = false;
    public edited = false;
    public pinned = false;
    public unread = false;
    public reply_to: MessageReplyTo | null = null;
    public reactions: MessageReaction[] = [];
    public edit_history: MessageEditHistoryEntry[] = [];
    public upload: MessageUploadState | null = null;

    constructor(data: ChatMessageDTO, clientKey = allocateMessageClientKey()) {
        this.clientKey = clientKey;
        this.id = data.id;
        this.chat_id = data.chat_id;
        this.cr_time = data.cr_time;
        this.type = data.type;
        this.transport_type = data.transport_type ?? null;
        this.transport_type_icon = data.transport_type_icon ?? null;
        this.user = data.user;
        this.content = data.content;
        this.avatar = data.avatar ?? null;
        this.checked = data.checked ?? null;
        this.pending = data.pending ?? false;
        this.failed = data.failed ?? false;
        this.edited = data.edited ?? false;
        this.pinned = data.pinned ?? false;
        this.unread = data.unread ?? false;
        this.file_path = data.file_path ?? null;
        this.file_list = data.file_list ?? null;
        this.actions = Array.isArray(data.actions) ? data.actions : [];
        this.reply_to = data.reply_to ?? null;
        this.reactions = Array.isArray(data.reactions) ? data.reactions : [];
        this.edit_history = Array.isArray(data.edit_history) ? data.edit_history : [];
        this.upload = data.upload ?? null;
    }

    /** Immutable field update; keeps clientKey (and edit unless overridden). */
    clone(overrides: Partial<ChatMessageDTO> = {}, edit = this.edit): ChatMessage {
        const next = new ChatMessage(
            {
                id: overrides.id ?? this.id,
                chat_id: overrides.chat_id ?? this.chat_id,
                cr_time: overrides.cr_time ?? this.cr_time,
                type: overrides.type ?? this.type,
                transport_type: overrides.transport_type !== undefined
                    ? overrides.transport_type
                    : this.transport_type,
                transport_type_icon: overrides.transport_type_icon !== undefined
                    ? overrides.transport_type_icon
                    : this.transport_type_icon,
                user: overrides.user ?? this.user,
                content: overrides.content ?? this.content,
                avatar: overrides.avatar !== undefined ? overrides.avatar : this.avatar,
                file_path: overrides.file_path !== undefined ? overrides.file_path : this.file_path,
                file_list: overrides.file_list !== undefined ? overrides.file_list : this.file_list,
                checked: overrides.checked !== undefined ? overrides.checked : this.checked,
                pending: overrides.pending ?? this.pending,
                failed: overrides.failed ?? this.failed,
                edited: overrides.edited ?? this.edited,
                pinned: overrides.pinned ?? this.pinned,
                unread: overrides.unread ?? this.unread,
                actions: overrides.actions !== undefined ? overrides.actions : this.actions,
                reply_to: overrides.reply_to !== undefined ? overrides.reply_to : this.reply_to,
                reactions: overrides.reactions !== undefined ? overrides.reactions : this.reactions,
                edit_history: overrides.edit_history !== undefined
                    ? overrides.edit_history
                    : this.edit_history,
                upload: overrides.upload !== undefined ? overrides.upload : this.upload,
            },
            this.clientKey,
        );
        next.edit = edit;

        return next;
    }

    /** Server ACK / realtime merge as a new instance so signal inputs see a reference change. */
    withAck(dto: ChatMessageDTO): ChatMessage {
        const wasPending = this.pending;

        return this.clone({
            id: dto.id,
            chat_id: dto.chat_id ?? this.chat_id,
            cr_time: dto.cr_time ?? this.cr_time,
            type: dto.type ?? this.type,
            transport_type: dto.transport_type ?? this.transport_type,
            transport_type_icon: dto.transport_type_icon ?? this.transport_type_icon,
            user: dto.user ?? this.user,
            content: dto.content ?? this.content,
            avatar: dto.avatar ?? this.avatar,
            file_path: dto.file_path ?? this.file_path,
            file_list: dto.file_list ?? this.file_list,
            // Pending send ACK may omit checked → treat as delivered. Other upserts must not
            // invent a read/delivered state when the DTO left it unset (null/undefined).
            checked: dto.checked ?? (wasPending ? true : this.checked),
            pending: false,
            failed: false,
            edited: dto.edited ?? this.edited,
            pinned: dto.pinned ?? this.pinned,
            unread: dto.unread ?? false,
            actions: Array.isArray(dto.actions) ? dto.actions : this.actions,
            reply_to: dto.reply_to ?? this.reply_to,
            reactions: Array.isArray(dto.reactions) ? dto.reactions : this.reactions,
            edit_history: Array.isArray(dto.edit_history) ? dto.edit_history : this.edit_history,
            upload: dto.upload ?? {progress: 100, status: 'done'},
        });
    }

    get dateSimple(): string {
        const d = new Date(this.cr_time.replace(' ', 'T'));
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        return `${dd}.${mm}.${yyyy}`;
    }

    get timeHHmm(): string {
        const d = new Date(this.cr_time.replace(' ', 'T'));
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        return `${hh}:${mm}`;
    }
}

export interface ChatMessageDTO {
    id: number;
    chat_id: number;
    cr_time: string; // ISO or 'YYYY-MM-DD HH:mm:ss'
    type: ChatMessageType;
    transport_type?: string | null;
    transport_type_icon?: string | null;
    user: string;
    content: string;
    avatar?: string | null;
    file_path?: string[] | [] | null;
    file_list?: File[] | [] | null;
    checked?: boolean | null;
    pending?: boolean;
    failed?: boolean;
    edited?: boolean;
    pinned?: boolean;
    unread?: boolean;
    actions?: ChatQuickButton[] | null;
    reply_to?: MessageReplyTo | null;
    reactions?: MessageReaction[] | null;
    edit_history?: MessageEditHistoryEntry[] | null;
    upload?: MessageUploadState | null;
}

export interface ChatQuickButton {
    id: number;
    title: string;
    value: string;
}

export interface MessageReplyTo {
    id: number;
    user: string;
    content: string;
}

export interface MessageReaction {
    emoji: string;
    count: number;
    reactedByMe: boolean;
}

export interface MessageEditHistoryEntry {
    content: string;
    editedAt: string;
}

export type MessageUploadStatus = 'idle' | 'uploading' | 'error' | 'done';

export interface MessageUploadState {
    progress: number;
    status: MessageUploadStatus;
    error?: string | null;
}

export type ChatMessageType = 'incoming' | 'outgoing';

export enum MessageType {
    Incoming = 'incoming',
    Outgoing = 'outgoing'
}

export interface CurrMessage {
    id?: number;
    content: string;
    file_path?: string[];
    file_list?: File[];
    user_id?: number;
    user?: string;
    transport_type?: string | null;
    transport_type_icon?: string | null;
    reply_to?: MessageReplyTo | null;
}

export type MessageActionType =
    | 'send'
    | 'edit'
    | 'delete'
    | 'react'
    | 'reply'
    | 'pin'
    | 'unpin'
    | 'copy'
    | 'retry'
    | 'read';

export interface MessageActionEvent {
    action: MessageActionType;
    chatMessageId?: number;
    content: string;
    file_path?: string[];
    file_list?: File[];
    user_id?: number;
    user?: string;
    transport_type?: string | null;
    transport_type_icon?: string | null;
    reply_to?: MessageReplyTo | null;
    reactionEmoji?: string;
    pinned?: boolean;
}

/** Default max attachment size (8 MB). Hosts can override via maxFileSizeBytes. */
export const PARL_DEFAULT_MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024;

export const PARL_DEFAULT_REACTION_EMOJIS = ['❤️', '👍', '😂', '😮', '😢', '🙏', '🔥'] as const;
