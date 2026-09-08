# Parl (`@trixwell/ngx-parl`)

Angular 21 chat UI library plus a local Demo App. Backend-agnostic: the host owns HTTP, STOMP/SSE, and persistence.

Full API docs: [`projects/ngx-parl/README.md`](projects/ngx-parl/README.md)

## Quick start

```
npm install
npm start
```

Demo: `http://localhost:4200` — sidebar controls + mocked realtime/upload/network behaviour.

## Implemented chat features

- Realtime send/receive via `messageAction` + `messageUpdate` (optimistic pending)
- Reply / quote, reactions, pin/unpin (multiple pins)
- Unread separator + mark-as-read when visible
- File attach with progress, oversized warning, error + retry
- Message search with jump to match
- Image fullscreen preview (zoom / pinch / pan)
- Actions: reply, react, copy, edit, delete, pin, retry
- Temporary drafts (`localStorage`, TTL, cleared on send)
- Edit history + Edited label
- Scroll: auto-bottom only when already at bottom; history prepend keeps position
- Mobile: long-press sheet, swipe-to-reply, keyboard inset hooks
- Accessibility: keyboard open menu (Shift+F10), dialogs, ARIA on search/progress

### Works without backend changes (UI / local)

Reply UI, reactions toggle, pin bar, search in loaded messages, drafts, edit history in-session, unread UI, scroll behaviour, image preview, file size checks / read progress, copy.

### Needs host API / realtime

Persisting messages, reactions, pins, read receipts, real file upload, multi-device fan-out, server-side search over unloaded history. Wire:

- `[(messageList)]`, `[(messageUpdate)]`, `[(messageAction)]`, `[(loadHistory)]`
- `confirmPending` / `rejectPending`
- optional patches to `upload` / `failed` / `checked` / `unread`

### Demo App

- `projects/demo/src/app/demo-chat-backend.ts` — ACK, upload progress, offline/fail, incoming push
- `projects/demo/src/mocks/mock-data.ts` — seed data with short feature comments
- Controls: mobile mode, network, upload fail, push incoming, dialog

No production backend configuration is required for the demo.

## Library install (consumers)

See [`projects/ngx-parl/README.md`](projects/ngx-parl/README.md) for `provideNgxParl()`, assets, Ionic fill recipe, and binding tables.
