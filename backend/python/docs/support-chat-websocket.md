# Support Chat WebSocket

The support-chat socket endpoint is:

```text
wss://api.example.com/fintech/user/help/chat
```

Authenticate the handshake with an `Authorization: Bearer <JWT>` header or an
`access_token` cookie. The token must pass the same account, device, and session
checks as HTTP requests. Do not put bearer tokens in the URL.

After connecting, send a join event for the user's own chat:

```json
{"action":"join","chatId":123}
```

The server confirms successful membership with `chat.joined`. It then relays
persisted `chat.message` events and client-defined events to sockets connected
to that chat. A client event has this shape:

```json
{"event":"typing","data":{"active":true}}
```

Custom event names are limited to 64 alphanumeric, period, underscore, colon,
or hyphen characters, must begin with an alphanumeric character, and cannot
use reserved server events (`chat.message`, `chat.closed`, `chat.created`) or
the `system.` prefix. Event data must be a JSON object; each frame is limited
to 16 KiB.

The current event hub is process-local. Run a single application worker if
HTTP-generated events and WebSocket connections must share an event stream.
Multi-process or multi-instance deployments need a shared broker before being
considered supported.
