# NgxParl Component Documentation

## Overview

![chat_view.png](chat_view.png)

NgxParl is an Angular chat component that renders a fully interactive, customizable messaging interface. It supports features such as real-time message updates from external sources, sending and editing messages, deleting messages, day separators, and smooth auto-scrolling. The component is backend-agnostic, works with any data source, and integrates seamlessly with Angular Material, making it easy to plug into different projects as an open-source chat UI.

# GitHub Repository: [Trixwell/parl](https://github.com/Trixwell/parl)

## Installation

To use [NgxParl](https://www.npmjs.com/package/@trixwell/ngx-parl), ensure you have Angular and Angular Material installed. Then, import the component into your module:

```
npm install @trixwell/ngx-parl
```

## Required peer dependencies:

```
npm install @angular/material
npm install @ngneat/transloco
```

In your app.module.ts:

```
import { NgxParl } from 'ngx-parl';

@NgModule({
declarations: [AppComponent],
imports: [NgxParl],
bootstrap: [AppComponent],
})
export class AppModule {}
```

Add the NgxParl providers to your application configuration:

```
export const appConfig: ApplicationConfig = {
    providers: [provideNgxParl()] 
}
```

Enables i18n, translations and core chat configuration

## Assets Setup

To enable media files (icons, images, etc.) used by @trixwell/ngx-parl, you must add the library’s assets path to your project’s angular.json:

```
"assets": [
  {
    "glob": "**/*",
    "input": "node_modules/@trixwell/ngx-parl/src/assets",
    "output": "assets/ngx-parl"
  }
]
```

This makes the assets available at:

```
assets/ngx-parl/...
```

## Signal Data

|         Name         |           Type            |                                  Description                                   |
|:--------------------:|:-------------------------:|:------------------------------------------------------------------------------:|
|        header        |          boolean          |            Display the chat title with the name of the interlocutor            |
|        theme         |          string           |           Choose a theme color   (```primary``` or ```secondary```)            |
|       language       |          string           |             Set language (```uk``` or ```en```). Default ```en```              |
|     messageList      |       ChatMessage[]       |                    List of chat messages, user information                     |
|    messageUpdate     |        ChatMessage        |       Incoming message from external source (signal/subject/observable)        |
|    messageAction     |    MessageActionEvent     |                     Emits chat events: send, edit, delete                      |
|     loadHistory      |          boolean          |                          Use scroll for load history                           |
|     incomingUser     |          string           |                           User writing in messenger                            |
|    transportType     |          string           |                     Transport type label (Telegram, etc.)                      |
|  transportTypeIcon   |          string           |               Path to transport icon (e.g. assets/ngx-parl/...)                |
|      mobileMode      |          boolean          |     Mobile layout (e.g. hide outgoing avatar); does not gate quick actions     |
| quickActionsResolver | ParlQuickActionsResolver  | Optional custom mapping; if omitted, `message.actions` is mapped automatically |
| quickActionsAutoSend |          boolean          |              Auto-send quick action text on click. Default `true`              |
|   quickActionClick   | ParlQuickActionClickEvent |              Emits when a quick action is clicked (two-way bind)               |

## Scrolling to the Bottom

Scrolling to the latest message is handled internally via the scrollToBottomTrigger signal.

To trigger scrolling programmatically, update the scrollToBottomTrigger value (for example, increment it). Each update triggers a scroll to the bottom.

- use the scrollToBottom() to control scrolling down.
- loadHistory is used only for loading older messages and does not control scrolling.

```
this.scrollToBottomTrigger.update(value => value + 1);
```

# Example Usage

## Component Setup

```
public header = input<boolean>(true);
public messageList = model<ChatMessage[]>([]);
public messageUpdate = model<ChatMessage>();
```

## Entity

```
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

export type ChatMessageType = 'incoming' | 'outgoing';

export interface ChatQuickButton {
    id: number;
    title: string;
    value: string;
}

export interface MessageActionEvent {
    action: MessageActionType;
    chatMessageId?: number;
    content: string;
    file_path?: string[];
    file_list?: File[];
    user_id?: number;
    user?: string;
}
```

## Quick actions

If your `ChatMessage` contains `actions`, they are shown as quick action buttons for **outgoing** messages in both desktop and mobile layouts (`mobileMode` does not hide them).

- If you omit `[quickActionsResolver]`, the library uses `defaultParlQuickActionsResolver`, which maps `message.actions` to buttons.
- Provide a custom `[quickActionsResolver]` to filter, reorder, or replace actions; the context includes `isMobile` if you need different behavior per layout.
- `ChatQuickButton.title` is the button text; `ChatQuickButton.value` is the text that will be sent.
- Each action must include a stable `id`.
- `quickActionsAutoSend` defaults to `true` (clicking a quick action triggers `sendMessage()`).

### Types

```
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

export function defaultParlQuickActionsResolver(context: ParlQuickActionContext): ParlQuickAction[];
```

### Example resolver

```
public quickActionsResolver: ParlQuickActionsResolver = ({ message }) => {
    if (message.type !== 'outgoing') {
        return [];
    }

    const actions = message.actions ?? [];
    return actions.map((a) => ({
        id: String(a.id),
        title: a.title,   // button text
        value: a.value,   // sent text
    }));
};
```

## Mobile mode

Set `[mobileMode]="true"` to enable mobile UI behavior:

- Outgoing message avatars are hidden to save space.
- Quick actions use the default resolver from `message.actions` when `[quickActionsResolver]` is omitted, or your custom resolver when set (desktop and mobile).
- Quick actions are shown as a separate “buttons-only” outgoing message when the resolver returns actions for that message.

To use quick actions:

- Put `actions` on outgoing `ChatMessage` instances, and optionally omit `[quickActionsResolver]` to use the default mapping.
- Or provide `[quickActionsResolver]` for full control.
- Optionally bind `[(quickActionClick)]` to observe clicks (analytics/logging).
- Keep `[quickActionsAutoSend]="true"` to send `action.value` on click (default).

## Template

```
<ngx-parl [header]="header()"
          [(messageList)]="messageList"
          [(messageUpdate)]="messageUpdate"
          [(messageAction)]="messageAction"
          [quickActionsAutoSend]="true"
          [mobileMode]="false"
          [(quickActionClick)]="quickActionClick"
          [transportType]="transportType()"
          [transportTypeIcon]="transportTypeIcon()"
          [(isScrolledToTop)]="isScrolledToTop">
</ngx-parl>
```

