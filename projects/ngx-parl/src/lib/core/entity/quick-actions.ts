import {ChatMessage, ChatQuickButton, MessageType} from './chat';

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

/**
 * Maps `message.actions` to quick action buttons for outgoing messages.
 * Used when `[quickActionsResolver]` is not provided. Independent of `mobileMode`.
 */
export function messageHasActionButtons(message: { type: unknown; actions?: ChatQuickButton[] | null }): boolean {
    const t = message.type;
    const outgoing =
        t === MessageType.Outgoing ||
        (typeof t === 'string' && t.toLowerCase() === MessageType.Outgoing);
    if (!outgoing) {
        return false;
    }
    return Array.isArray(message.actions) && message.actions.length > 0;
}

export function defaultParlQuickActionsResolver(context: ParlQuickActionContext): ParlQuickAction[] {
    const message = context.message;
    if (!messageHasActionButtons(message)) {
        return [];
    }
    const raw = message.actions as ChatQuickButton[];
    return raw.map((a) => ({
        id: String(a.id),
        title: a.title,
        value: a.value,
    }));
}

export function resolveParlQuickActions(
    context: ParlQuickActionContext,
    resolver: ParlQuickActionsResolver | null | undefined,
): ParlQuickAction[] {
    let actions = resolver ? resolver(context) : defaultParlQuickActionsResolver(context);
    if ((!actions || actions.length === 0) && messageHasActionButtons(context.message)) {
        actions = defaultParlQuickActionsResolver(context);
    }
    if (!Array.isArray(actions) || actions.length === 0) {
        return [];
    }
    return actions;
}

