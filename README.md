# NgxParl

## Overview

![img_1.png](img_1.png)

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

Signal Data

|     Name      |     Type      |                            Description                            |
|:-------------:|:-------------:|:-----------------------------------------------------------------:|
|    header     |    boolean    |     Display the chat title with the name of the interlocutor      |
|  messageList  | ChatMessage[] |              List of chat messages, user information              |
| messageUpdate |  ChatMessage  |  Subject / Observable / Signal, який надсилає нове повідомлення   |

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
          [(messageUpdate)]="messageUpdate">
</ngx-parl>
```
