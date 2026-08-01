# Pew — Design

This is the design reference: the visual system and the user flows. It doesn't duplicate `conception.md` (stack, architecture, security) or `STEPS.md` (engineering steps) — this is what the person actually sees and feels moving through the app.

**Guiding principle for this whole document: smoothness comes from restraint, not decoration.** Every motion below exists to explain a state change, not to impress. If an animation doesn't answer "where did this come from" or "what just happened," cut it.

---

## 1. Design tokens

### Color

| Token | Value | Use |
|---|---|---|
| `primary` | `#22C55E` (green) | Primary actions, user's own message bubbles, enabled badges |
| `accent` | `#38BDF8` (light blue) | Secondary actions, AI message bubbles, links |
| `background` | `#FFFFFF` | Screen background |
| `surface` | `#F8FAFC` | Cards, bottom sheets, input fields — one step off pure white so layered surfaces read as layered |
| `border` | `#E2E8F0` | Dividers, input outlines |
| `text-primary` | `#0F172A` | Body text |
| `text-secondary` | `#64748B` | Timestamps, subtitles, placeholder text |
| `success` | reuse `primary` | Don't introduce a second green — a connection succeeding and a primary action are the same color language |
| `warning` | `#F59E0B` | Pending tool-call approval card |
| `error` | `#EF4444` | Failed connection, failed action, destructive confirm (delete chat) |
| `disabled` | `#CBD5E1` | Disabled toggle, disabled send button |

**Rule:** never introduce a new color for a one-off case. If nothing in this table fits, that's a sign the interaction needs to be re-thought as one of the existing states, not a sign the palette needs to grow.

### Typography

One type family, four sizes — resist adding a fifth:

| Token | Size / weight | Use |
|---|---|---|
| `text-title` | 20px / semibold | Screen headers |
| `text-body` | 16px / regular | Message content, list item names |
| `text-caption` | 13px / regular | Timestamps, subtitles, token counters |
| `text-label` | 13px / medium | Badges, buttons, filter chips |

### Spacing

4px base unit, matching NativeWind/Tailwind's default scale so tokens and code stay the same vocabulary: `4, 8, 12, 16, 24, 32, 48`. Screen edge padding is always `16`. Vertical rhythm between list items is always `8`. Don't invent one-off values — if `16` feels slightly wrong somewhere, that's usually a sign the layout needs restructuring, not a `14`.

### Radius

| Token | Value | Use |
|---|---|---|
| `radius-sm` | 8px | Input fields, filter chips |
| `radius-md` | 16px | Cards, bottom sheets (top corners only) |
| `radius-full` | 9999px | Message bubbles, badges, avatar/icon circles, send button |

### Elevation

Two levels only. Flat surfaces (list items, screen background) have no shadow at all. Anything that floats above the base layer (bottom sheet, approval card, toast) gets exactly one soft shadow token — don't stack multiple shadow strengths across the app, it reads as visual noise rather than hierarchy.

### Motion

This is the section that actually makes the app *feel* smooth — treat it as seriously as color.

| Token | Duration | Use |
|---|---|---|
| `motion-fast` | 150ms | Toggle switches, badge state changes, button press feedback |
| `motion-base` | 250ms | Bottom sheet open/close, screen transitions, message bubble appearing |
| `motion-slow` | 400ms | Approval card expanding to show detail |

**Easing:** ease-out for anything entering the screen (feels responsive), ease-in for anything leaving (feels intentional, not abrupt). Never linear — linear motion is the single most common reason an interface feels mechanical instead of smooth.

**Specific interactions worth getting right, since they're the moments the app is actually judged on:**
- **Sending a message:** the bubble appears already in its final position with a brief fade + slight upward slide (`motion-fast`), never a jarring pop-in.
- **AI is typing:** three-dot typing indicator with a gentle staggered pulse, replacing itself with the real message the instant it arrives — no jump in vertical position when the swap happens.
- **Recording voice input:** the mic button scales up slightly and a soft pulsing ring animates outward continuously while held — this is the app's one clearly "alive" moment, worth it being genuinely nice.
- **Bottom sheet (app detail, connect modal):** slides up from the bottom over `motion-base`, with a dimming overlay fading in simultaneously, not sequentially.
- **Approval card arriving:** distinct from a normal message bubble — expands open with `motion-slow` rather than just fading in, since this is the one moment in the app that deserves to visually say "pay attention, this is different."
- **Toggle enable/disable:** the switch thumb slides and the badge color crossfades at the same time, same duration — two things changing for one reason should always move together, not stagger.

---

## 2. Component patterns

Defining each once here so it's never quietly reinvented slightly differently per screen.

- **Badge** — pill shape (`radius-full`), `text-label`, filled `primary` at 15% opacity background with `primary` text when enabled/success, `disabled` gray background with `text-secondary` when off, `warning`/`error` equivalents for pending/failed states.
- **List item (app row)** — icon circle, name (`text-body`), subtitle (`text-caption`), badge right-aligned. Entire row is the tap target, not just the text.
- **Bottom sheet** — used for app detail and the connect-credential modal. Rounded top corners (`radius-md`), drag handle bar centered at top, dimmed backdrop behind it. Never a full-screen modal for these — the backdrop keeping the previous screen dimly visible is what keeps the flow feeling continuous instead of a hard context switch.
- **Message bubble** — `radius-full`-style rounded rect (large radius, not a perfect pill given variable text length), right-aligned + `primary` for user, left-aligned + `accent` for AI. Tool-result messages render visually distinct from both — smaller, muted, timestamp-only style — since the user shouldn't read a tool's JSON result as if it were the AI talking to them directly.
- **Approval card** — the one component that should not look like a chat bubble at all. Bordered card (`warning` colored border), app icon + name, one-sentence plain-language summary of the action, two clearly separated buttons (Approve primary-filled, Reject outline-only, never both the same visual weight).
- **Input bar** — fixed to the bottom, text field + mic icon (idle) that morphs into the pulsing recording state in place rather than opening a separate screen, + send button that's disabled-gray until there's text or a completed recording.
- **Toast / flash message** — used for the connection success/fail feedback from Sprint 1. Slides in from the top, auto-dismisses after ~2.5s, never blocks interaction underneath it, never stacks more than one at a time (a second toast replaces the first rather than queuing).

---

## 3. Screen inventory

| Screen | Purpose |
|---|---|
| Apps & AIs list | Browse, search, and filter every registered app/provider; entry point to connecting anything |
| App detail (bottom sheet) | Enable/disable, view "how to enable" link, enter credential or start OAuth |
| Chat list | All conversations, most recent first, grouped by active/archived |
| Chat screen | The conversation itself: messages, voice input, approval cards, token indicator |
| Settings | Budget guardrail values, voice output toggle, confirmation requirement toggle |

Five screens for the full v1 scope — if a sixth ever feels necessary, treat that as a prompt to check whether it's really a new screen or a state of one of these five.

---

## 4. States

Every screen needs an explicit answer for these three — deciding them now is cheap, retrofitting them later reads as unfinished:

**Empty**
- Apps & AIs list: never actually empty (the seed data guarantees a starting list) — not applicable.
- Chat list, no chats yet: centered illustration-free message + a single clear "Start a chat" button, not a blank white screen.
- Chat screen, brand-new chat: no "empty history" state needed — the input bar plus a short one-line prompt ("Ask Pew anything") is enough.

**Loading**
- Verifying a connection (Sprint 1): the Connect button itself shows a spinner and disables, rather than a separate full-screen loading state — keeps the person anchored to what they just tapped.
- Sending a message: the typing-indicator pattern from the motion section above, not a generic spinner.
- Syncing models: an inline "last synced X ago" label that updates to "syncing…" during the call, not a blocking screen.

**Error**
- Connection failed: inline on the credential modal itself ("verify your credentials"), never a separate error screen — the person shouldn't lose their place.
- Message send failed (network issue): the message bubble itself shows a small retry icon, matching the familiar pattern from ordinary messaging apps.
- Tool action failed: the approval card updates in place to a `failed` state with the reason shown, rather than disappearing — the user needs to see what didn't happen, not have it silently vanish.

---

## 5. User flows

Text-based, screen by screen. Each step names what the person does and what the app shows back.

### Flow 1 — Connect an app (Sprint 1)

1. **Apps & AIs list** → person taps an app row (e.g. Gmail).
2. **App detail bottom sheet slides up** → shows current disabled badge, description, "How to enable this?" link, and a "Connect" button.
3. Person taps "Connect."
4. **If `api_key` type:** a text field appears inline in the same sheet → person pastes their key → taps "Connect" again.
   **If `oauth` type:** the device's browser opens to the provider's consent screen → person approves → returns automatically to Pew.
5. **Connect button shows a loading spinner** while verification runs.
6. **Success:** sheet dismisses, a toast confirms it, the list row's badge crossfades to "Enabled."
7. **Failure:** sheet stays open, inline "verify your credentials" message appears under the field, nothing is stored, person can retry without re-navigating.

### Flow 2 — Send a text message (Sprint 2)

1. **Chat list** → person taps an existing chat, or starts a new one (which first requires picking an enabled model if none is set).
2. **Chat screen** → person types in the input bar, taps send.
3. Message bubble appears immediately (optimistic, before the backend responds).
4. **Typing indicator** appears in the AI's position.
5. Reply arrives → indicator is replaced by the real message bubble, no layout jump.
6. If voice output is enabled in Settings, the reply is spoken aloud automatically as it appears.

### Flow 3 — Send a voice message (Sprint 2)

1. **Chat screen** → person presses and holds the mic icon.
2. Icon morphs into the pulsing recording state in place.
3. Person releases → recognized text populates the input field (not sent yet — person can review/edit first).
4. Person taps send → continues exactly as Flow 2 from step 3.

### Flow 4 — AI performs an approved action (Sprint 3)

1. Person sends a message that implies an action ("send an email to…").
2. **Approval card** appears in the thread instead of a normal AI bubble — expands open with the slower, deliberate motion from the token section, app icon, and a plain-language summary of exactly what will happen.
3. Person taps **Approve** or **Reject.**
4. Card updates in place to reflect the outcome (`completed` / `failed` / `rejected`) — it never disappears, since it's now part of the permanent record of what happened in this conversation.
5. A `role='tool'` message is inserted, and the AI's next reply (reacting to the outcome) appears using the normal Flow 2 typing-indicator pattern — from the person's perspective, the conversation simply continues.

---

*Keep this file and `conception.md` pointing at each other, not duplicating each other — stack/architecture/security lives there, look/feel/flow lives here.*