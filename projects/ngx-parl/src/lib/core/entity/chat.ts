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
        this.file_path = data.file_path ?? null;
        this.file_list = data.file_list ?? null;
        this.actions = Array.isArray(data.actions) ? data.actions : [];
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
    actions?: ChatQuickButton[] | null;
}

export interface ChatQuickButton {
    id: number;
    title: string;
    value: string;
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
}

export type MessageActionType = 'send' | 'edit' | 'delete';

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
}
