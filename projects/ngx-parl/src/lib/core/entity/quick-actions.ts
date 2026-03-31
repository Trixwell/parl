import {ChatMessage} from './chat';

export interface ParlQuickAction {
    id: string;
    title: string;
    value: string;
    disabled?: boolean;
}

export interface ParlQuickActionContext {
    message: ChatMessage;
    isMobile: boolean;
}

export interface ParlQuickActionClickEvent {
    actionId: string;
    messageId: number;
    value: string;
}

export type ParlQuickActionsResolver = (context: ParlQuickActionContext) => ParlQuickAction[];

