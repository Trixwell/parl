export class ChatMessage {
    public id: number;
    public chat_id: number;
    public cr_time: string;
    public type: ChatMessageType;
    public user: string;
    public content: string;
    public avatar: string | null;
    public file_path: string[] | null;
    public file_list: File[] | null;

    public checked: boolean | null;
    public edit = false;

    constructor(data: ChatMessageDTO) {
        this.id = data.id;
        this.chat_id = data.chat_id;
        this.cr_time = data.cr_time;
        this.type = data.type;
        this.user = data.user;
        this.content = data.content;
        this.avatar = data.avatar ?? null;
        this.checked = data.checked ?? null;
        this.file_path = data.file_path ?? null;
        this.file_list = data.file_list ?? null;
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
    user: string;
    content: string;
    avatar?: string | null;
    file_path?: string[] | [] | null;
    file_list?: File[] | [] | null;
    checked?: boolean | null;
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
}
