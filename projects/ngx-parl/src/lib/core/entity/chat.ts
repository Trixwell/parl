export class ChatMessage {
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

    constructor(data: ChatMessageDTO) {
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
