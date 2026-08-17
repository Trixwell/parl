# NgxParl Component Documentation

## Overview

![chat_view.png](chat_view.png)

NgxParl is a backend-agnostic Angular 21 chat UI. It renders the messenger, composer, attachments, scroll, and mobile gestures. The host application owns HTTP, STOMP, sessions, and business rules.

Library class: `NgxParlComponent`. Selector: `ngx-parl`.

# GitHub Repository: [Trixwell/parl](https://github.com/Trixwell/parl)

## Installation

```
npm install @trixwell/ngx-parl
```

## Required peer dependencies

```
npm install @angular/material @angular/cdk @ngneat/transloco ngx-infinite-scroll
```

`@ionic/angular` and `@ionic/core` are optional peers. Ionic is not imported by the library. For a full-page Ionic chat, use `[layout]="'fill'"`, disable `ion-content` scrolling, and pass `[keyboardInset]` from the host.

## Providers

```
import {provideNgxParl, NgxParlComponent} from '@trixwell/ngx-parl';

export const appConfig: ApplicationConfig = {
    providers: [provideHttpClient(), provideNgxParl()]
};
```

`provideNgxParl()` registers Transloco (`en` / `uk`) and locales. `provideHttpClient()` is required because the library injects `HttpClient`.

## Assets Setup

```
"assets": [
  {
    "glob": "**/*",
    "input": "node_modules/@trixwell/ngx-parl/src/assets",
    "output": "assets/ngx-parl"
  }
]
```

Assets are available at `assets/ngx-parl/...`.

## Public API

Import from `@trixwell/ngx-parl`:

- `NgxParlComponent`, `provideNgxParl`
- `ChatMessage`, `ChatMessageDTO`, `MessageActionEvent`, `MessageType`
- `FlowTheme`, `ParlLayout`
- `ParlQuickAction`, `ParlQuickActionsResolver`, `ParlQuickActionsWhen`, `defaultParlQuickActionsResolver`

There are no `@Output()` events. Bind `model()` two-way (`[(messageList)]`, `[(messageAction)]`, `[(loadHistory)]`, …).

## Inputs and models

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `layout` | `'dialog' \| 'fill'` | `'dialog'` | Dialog keeps 800×600. Fill stretches to the host. |
| `header` | `boolean` | `true` | Title bar with hide/close. |
| `theme` | `FlowTheme` | `primary` | `FlowTheme.PRIMARY` or `FlowTheme.SECONDARY`. |
| `language` | `'en' \| 'uk'` | `'en'` | Transloco language. |
| `messageList` | `ChatMessage[]` | `[]` | Canonical list. Two-way. |
| `messageUpdate` | `ChatMessage` | | Incoming upsert. Scrolls only when the user is at the bottom. |
| `messageAction` | `MessageActionEvent` | | Pulse: `send` / `edit` / `delete`, then `null`. |
| `loadHistory` | `boolean` | `false` | Pulse when older messages are needed. |
| `hasMoreHistory` | `boolean` | `true` | Stop history pulses when the host has no older pages. |
| `incomingUser` | `string` | `''` | Header name. |
| `transportType` | `string` | `''` | Header transport label. |
| `transportTypeIcon` | `string` | `''` | Header transport icon. |
| `logoChat` | `string` | `''` | Outgoing default avatar and (desktop) list header icon. Empty uses the anonymous icon. |
| `incomingAvatar` | `string` | `''` | Incoming default avatar when a message has no `avatar`. |
| `mobileMode` | `boolean` | `false` | Mobile layout, long-press action sheet, native textarea composer, fullscreen image preview. |
| `keyboardInset` | `number` | `0` | Keyboard overlap in CSS pixels. Host measures; Parl applies padding. |
| `autoFocus` | `boolean` | `true` | Focus the composer on init. Set `false` on mobile so the IME does not open by itself. |
| `scrollToBottomOnKeyboard` | `boolean` | `true` | Scroll to latest when `keyboardInset` becomes greater than 0. |
| `quickActionsResolver` | `ParlQuickActionsResolver` | | Custom mapping. Default uses `message.actions`. |
| `quickActionsWhen` | `ParlQuickActionsWhen` | `ParlQuickActionsWhen.ALWAYS` | Gate for default and custom resolvers. |
| `quickActionsAutoSend` | `boolean` | `true` | Send `action.value` on click. |
| `quickActionClick` | `ParlQuickActionClickEvent` | | Click pulse. Two-way. |
| `hideHandler` / `closeHandler` | `() => unknown` | | Header actions. |

## Host methods

- `scrollToBottom()` — jump to the latest message.
- `confirmPending(tempId, dto)` — replace an optimistic message after the backend ACK.
- `rejectPending(tempId)` — remove an optimistic message on send failure.

Optimistic sends use **negative temp ids** so they cannot collide with backend ids.

## Scrolling

Inner `.chat__flow` owns scroll. `loadHistory` is only a request for older pages; it does not scroll.

```
this.scrollToBottomTrigger.update(value => value + 1);
```

## Ionic fill-page recipe

```
<ion-content [scrollY]="false">
  <ngx-parl [layout]="'fill'"
            [mobileMode]="true"
            [autoFocus]="false"
            [keyboardInset]="keyboardInset()"
            [incomingAvatar]="peerAvatarUrl()"
            [(messageList)]="messageList"
            [(messageAction)]="messageAction"
            [(loadHistory)]="loadHistory"
            [hasMoreHistory]="hasMoreHistory()">
  </ngx-parl>
</ion-content>
```

Keep Capacitor / native keyboard measurement in the application. Pass the overlap into `[keyboardInset]`.

## Template

```
<ngx-parl [header]="true"
          [layout]="'dialog'"
          [theme]="theme()"
          [(messageList)]="messageList"
          [(messageUpdate)]="messageUpdate"
          [(messageAction)]="messageAction"
          [(loadHistory)]="loadHistory"
          [hasMoreHistory]="hasMoreHistory()"
          [quickActionsWhen]="quickActionsWhen"
          [quickActionsAutoSend]="true"
          [mobileMode]="mobileMode()"
          [(quickActionClick)]="quickActionClick"
          [transportType]="transportType()"
          [transportTypeIcon]="transportTypeIcon()"
          [logoChat]="logoChat()">
</ngx-parl>
```

## Quick actions

Outgoing `message.actions` become buttons. Set `quickActionsWhen` to `ParlQuickActionsWhen.MOBILE` to hide them on desktop without a custom resolver.

`quickActionsAutoSend` defaults to `true` and sends once per click.

## Mobile mode

`[mobileMode]="true"`:

- Hides outgoing avatars and the sender name under the bubble.
- Uses long-press on the bubble + bottom action sheet (edit / delete). No kebab button.
- Incoming bubbles are white with a light violet border; outgoing bubbles use violet with timestamps under the bubble.
- Pill composer with attach on the left and send on the right.
- Native iOS and Android emoji from the system keyboard (Apple Color Emoji / Noto Color Emoji fallbacks).
- On-screen send button is always available; Enter still sends, Shift+Enter inserts a newline.
