# NgxParl Component Documentation

## Overview

![chat_view.png](chat_view.png)

NgxParl is an Angular chat component that renders a fully interactive, customizable messaging interface. It supports features such as real-time message updates from external sources, sending and editing messages, deleting messages, day separators, and smooth auto-scrolling. The component is backend-agnostic, works with any data source, and integrates seamlessly with Angular Material, making it easy to plug into different projects as an open-source chat UI.

# GitHub Repository: [Trixwell/parl](https://github.com/Trixwell/parl)

## Installation

To use NgxParl, ensure you have Angular and Angular Material installed. Then, import the component into your module:

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

|     Name      |        Type        |                            Description                            |
|:-------------:|:------------------:|:-----------------------------------------------------------------:|
|    header     |      boolean       |     Display the chat title with the name of the interlocutor      |
|     theme     |       string       |     Choose a theme color   (```primary``` or ```secondary```)     |
|   language    |       string       |       Set language (```uk``` or ```en```). Default ```en```       |
|  messageList  |   ChatMessage[]    |              List of chat messages, user information              |
| messageUpdate |    ChatMessage     | Incoming message from external source (signal/subject/observable) |
| messageAction | MessageActionEvent |               Emits chat events: send, edit, delete               |


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
    user: string;
    content: string;
    avatar?: string | null;
    file_path?: string[] | null;
    checked?: boolean | null;
}

export type ChatMessageType = 'incoming' | 'outgoing';
```

## Template

```
<ngx-parl [header]="header()"
          [(messageList)]="messageList"
          [(messageUpdate)]="messageUpdate"
          [(messageAction)]="messageAction">
</ngx-parl>
```

Use the scrollToBottom() to control scrolling down.

