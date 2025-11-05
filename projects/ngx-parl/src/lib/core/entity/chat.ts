export class ChatMessage {
    public edit = false;

    constructor(
        public id: number,
        public chat_id: number,
        public cr_time: string,
        public type: string,
        public user: string,
        public content: string,
        public avatar: string | null = null,
        public file_path: string | null = null,
        public checked: boolean | null = null,
    ) {
    }
}

export enum MessageType {
    Incoming = 'incoming',
    Outgoing = 'outgoing'
}
