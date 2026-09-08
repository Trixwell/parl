# NgxParl Component Documentation

## Overview

![NgxParl Preview](https://raw.githubusercontent.com/Trixwell/parl/main/projects/ngx-parl/src/assets/img/view-chat.png)

NgxParl is an Angular chat component that renders a fully interactive, customizable messaging interface. It supports features such as real-time message updates from external sources, sending and editing messages, deleting messages, day separators, and smooth auto-scrolling. The component is backend-agnostic, works with any data source, and integrates seamlessly with Angular Material, making it easy to plug into different projects as an open-source chat UI.

# GitHub Repository: [Trixwell/parl](https://github.com/Trixwell/parl)

## Installation

To use [NgxParl](https://www.npmjs.com/package/@trixwell/ngx-parl), ensure you have Angular and Angular Material installed. Then, import the component into your module:

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

| Name                           | Type                        | Default                       | Description                                                                                 |
|--------------------------------|-----------------------------|-------------------------------|---------------------------------------------------------------------------------------------|
| `layout`                       | `'dialog' \| 'fill'`        | `'dialog'`                    | Dialog keeps 800×600. Fill stretches to the host.                                           |
| `header`                       | `boolean`                   | `true`                        | Title bar with hide/close.                                                                  |
| `theme`                        | `FlowTheme`                 | `primary`                     | `FlowTheme.PRIMARY` or `FlowTheme.SECONDARY`.                                               |
| `language`                     | `'en' \| 'uk'`              | `'en'`                        | Transloco language.                                                                         |
| `messageList`                  | `ChatMessage[]`             | `[]`                          | Canonical list. Two-way.                                                                    |
| `messageUpdate`                | `ChatMessage`               |                               | Incoming upsert. Scrolls only when the user is at the bottom.                               |
| `messageAction`                | `MessageActionEvent`        |                               | Pulse: `send` / `edit` / `delete`, then `null`.                                             |
| `loadHistory`                  | `boolean`                   | `false`                       | Pulse when older messages are needed.                                                       |
| `hasMoreHistory`               | `boolean`                   | `true`                        | Stop history pulses when the host has no older pages.                                       |
| `incomingUser`                 | `string`                    | `''`                          | Header name.                                                                                |
| `transportType`                | `string`                    | `''`                          | Header transport label.                                                                     |
| `transportTypeIcon`            | `string`                    | `''`                          | Header transport icon.                                                                      |
| `logoChat`                     | `string`                    | `''`                          | Outgoing default avatar and (desktop) list header icon. Empty uses the anonymous icon.      |
| `incomingAvatar`               | `string`                    | `''`                          | Incoming default avatar when a message has no `avatar`.                                     |
| `mobileMode`                   | `boolean`                   | `false`                       | Mobile layout, long-press action sheet, native textarea composer, fullscreen image preview. |
| `keyboardInset`                | `number`                    | `0`                           | Keyboard overlap in CSS pixels. Host measures; Parl applies padding.                        |
| `autoFocus`                    | `boolean`                   | `true`                        | Focus the composer on init. Set `false` on mobile so the IME does not open by itself.       |
| `scrollToBottomOnKeyboard`     | `boolean`                   | `true`                        | Scroll to latest when `keyboardInset` becomes greater than 0.                               |
| `quickActionsResolver`         | `ParlQuickActionsResolver`  |                               | Custom mapping. Default uses `message.actions`.                                             |
| `quickActionsWhen`             | `ParlQuickActionsWhen`      | `ParlQuickActionsWhen.ALWAYS` | Gate for default and custom resolvers.                                                      |
| `quickActionsAutoSend`         | `boolean`                   | `true`                        | Send `action.value` on click.                                                               |
| `quickActionClick`             | `ParlQuickActionClickEvent` |                               | Click pulse. Two-way.                                                                       |
| `hideHandler` / `closeHandler` | `() => unknown`             |                               | Header actions.                                                                             |

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
- Uses long-press on the bubble + bottom action sheet (reply / react / copy / pin / edit / delete / retry).
- Incoming bubbles are white with a light violet border; outgoing bubbles use violet with timestamps under the bubble.
- Pill composer with attach on the left and send on the right.
- Native iOS and Android emoji from the system keyboard (Apple Color Emoji / Noto Color Emoji fallbacks).
- On-screen send button is always available; Enter still sends, Shift+Enter inserts a newline.
- Swipe horizontally on a bubble to reply; pinch-to-zoom in fullscreen image preview.

## Chat features (UI-first)

| Feature                                     | UI-only                                                 | Needs host API / realtime                         |
|---------------------------------------------|---------------------------------------------------------|---------------------------------------------------|
| Send / edit / delete (optimistic)           | Local list + `messageAction` pulse                      | Persist + `confirmPending` / `rejectPending`      |
| Realtime receive                            | Upsert via `messageUpdate`                              | Host pushes STOMP/SSE/poll into `messageUpdate`   |
| Reply / quote                               | Local `reply_to` + composer bar                         | Persist `reply_to` on send if required            |
| Reactions                                   | Toggle locally + `react` pulse                          | Persist reactions across devices                  |
| Pin / unpin                                 | Multiple pins + top bar cycle (Telegram-style)          | Persist pin state                                 |
| Unread / read                               | `unread` flag, separator, IntersectionObserver → `read` | Host marks read on server                         |
| Search + jump                               | Client filter + scroll-to-message                       | Server search only if history is not fully loaded |
| Image preview / zoom / touch                | Fullscreen preview component                            | Host provides file URLs                           |
| File attach + progress + size error + retry | FileReader progress, `maxFileSizeBytes`                 | Real upload endpoint; host can patch `upload`     |
| Drafts with TTL                             | `localStorage` via `draftKey` / `draftTtlMs`            | Optional sync of drafts                           |
| Edit history / Edited                       | Local history on edit                                   | Persist history if required                       |
| Scroll / lazy history                       | Preserve position; `loadHistory` pulse                  | Host prepends older pages                         |
| Multi-device sync                           | Same as `messageUpdate` upserts                         | Host fan-out                                      |
| Network errors                              | `failed` / `upload.error` + retry action                | Host reports failures                             |

### Extra inputs / models

| Name                      | Description                                                            |
|---------------------------|------------------------------------------------------------------------|
| `replyTo`                 | Message being quoted in the composer.                                  |
| `enableSearch`            | Show message search toolbar (default `true`).                          |
| `maxFileSizeBytes`        | Attachment size limit (default 8 MB).                                  |
| `draftKey` / `draftTtlMs` | Local draft storage key and TTL.                                       |
| `reactionEmojis`          | Emoji set for the reaction picker.                                     |
| `scrollToMessageId`       | Programmatic scroll + highlight.                                       |
| `messageAction`           | Also pulses `react`, `reply`, `pin`, `unpin`, `copy`, `retry`, `read`. |

`ChatMessage` optional fields: `reply_to`, `reactions`, `pinned`, `edited`, `edit_history`, `unread`, `failed`, `upload`.
