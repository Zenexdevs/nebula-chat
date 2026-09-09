# Nebula Chat

A password-protected, end-to-end encrypted private chat room — dark, neon,
glassmorphic UI, real-time messaging, file sharing, reactions, typing
indicators, read receipts, and mesh WebRTC voice/video calls with screen
share. Runs entirely on free tiers (Vercel + Supabase).

---

## 1. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript + Tailwind CSS + Framer Motion | Free hosting on Vercel, fast dev loop, first-class animation support |
| Realtime + DB | Supabase (Postgres + Realtime + Storage), free tier | One service for message storage, live updates, presence, and file storage — no server to run |
| E2E encryption | TweetNaCl.js (`nacl.secretbox`, XSalsa20-Poly1305) + Web Crypto PBKDF2 | Small, audited, battle-tested crypto library; key derivation via the browser's native `SubtleCrypto` |
| Calls | Native WebRTC (mesh) signaled over a Supabase Realtime broadcast channel | No media server (SFU) needed for small rooms; zero extra cost |

Total hosting cost: **$0** on Vercel's free tier + Supabase's free tier.

---

## 2. Project structure

```
nebula-chat/
├─ app/
│  ├─ layout.tsx           # root layout, ambient background
│  ├─ page.tsx             # "/" — join screen
│  ├─ globals.css          # dark/neon/glass design tokens
│  └─ room/[roomId]/page.tsx  # "/room/xyz" — shareable invite link, pre-fills room name
├─ components/
│  ├─ App.tsx              # top-level step machine: join → profile → chat
│  ├─ JoinScreen.tsx        # room name + password, create-or-verify a room
│  ├─ ProfileSetup.tsx      # display name, generated/uploaded avatar, status
│  ├─ ChatRoom.tsx          # wires chat + call hooks into the room layout
│  ├─ Sidebar.tsx           # member list, invite link, sound toggle, leave
│  ├─ MessageList.tsx / MessageBubble.tsx / MessageInput.tsx
│  ├─ TypingIndicator.tsx / ReactionPicker.tsx
│  ├─ CallOverlay.tsx / ParticipantTile.tsx   # call UI
│  └─ Avatar.tsx / GlassPanel.tsx             # shared UI primitives
├─ lib/
│  ├─ crypto.ts            # ALL encryption/key-derivation logic
│  ├─ supabase.ts          # Supabase client
│  ├─ useChatRoom.ts       # messages, presence, typing, reactions, files
│  ├─ useCall.ts           # WebRTC mesh calling
│  ├─ avatar.ts / sound.ts # avatar generation, notification sounds
├─ supabase/schema.sql     # run once in the Supabase SQL editor
├─ types/index.ts
└─ .env.example
```

---

## 3. Setup

### 3.1 Create a Supabase project (free)

1. Go to [supabase.com](https://supabase.com) → New project (free tier).
2. Once it's ready, open **SQL Editor** → paste the entire contents of
   `supabase/schema.sql` → Run. This creates the `rooms` and `messages`
   tables, enables Realtime on `messages`, creates the `nebula-files`
   Storage bucket, and sets up the (documented, intentionally permissive —
   see §5) access policies.
3. Go to **Project Settings → API** and copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 3.2 Configure the app

```bash
cp .env.example .env.local
# then fill in the two Supabase values from step 3.1
```

### 3.3 Run locally

```bash
npm install
npm run dev
# open http://localhost:3000
```

Open the same URL in a second browser (or incognito window) with the same
room name + password to test chat and calls between two "people."

### 3.4 Deploy for free

**Vercel (recommended):**

1. Push this project to a GitHub repo.
2. [vercel.com](https://vercel.com) → New Project → import the repo.
3. Add the two environment variables from `.env.local` in Vercel's project
   settings (Environment Variables).
4. Deploy. Vercel's free tier is enough for a small private chat app.

**Netlify / Cloudflare Pages** work too — same idea: set the two
`NEXT_PUBLIC_*` env vars and use the Next.js build preset.

---

## 4. How the end-to-end encryption works

The room password **never leaves the browser** — it is never sent to
Supabase in any form, and it is not the encryption key itself.

1. **Room creation.** A random 16-byte `salt` is generated and stored
   (openly — salts aren't secret) alongside the room id.
2. **Two independent keys from one password.** Using PBKDF2-SHA256
   (210,000 iterations, via the browser's native `crypto.subtle`), the
   password + salt are stretched into two unrelated 256-bit values,
   distinguished only by a context string:
   - `verifierHash` (context `"nebula-verify-v1"`) — stored in Supabase.
     Used only so the join screen can tell you "wrong password" instead of
     silently failing. Knowing this value does **not** help derive the
     encryption key, because it's a separate derivation.
   - `secretKey` (context `"nebula-encrypt-v1"`) — **never stored or sent
     anywhere.** This is what encrypts everything below.
3. **Every message, display name, file, and reaction context is encrypted
   client-side** with `nacl.secretbox` (XSalsa20-Poly1305, a fresh random
   nonce per message) before it touches the network. Supabase's database
   and storage only ever contain ciphertext.
4. **Decryption** happens the same way, symmetrically, in every
   participant's browser — anyone with the right password derives the same
   `secretKey` and can read the room; anyone without it sees nothing
   (message rows fail to decrypt and are silently dropped).
5. **Files** are encrypted as raw bytes (not base64, to avoid the ~33%
   size overhead) and uploaded to a Storage bucket; the decryption nonce
   travels inside the (also encrypted) file-metadata blob attached to the
   message.

### Threat model, honestly

This is strong protection against a snooping server operator or a leaked
database — everything at rest is ciphertext. It is **not** a defense
against a malicious client inside the room (anyone with the password can
read everything, by design — that's what "shared room password" means),
and PBKDF2 alone won't save a weak, guessable password from an offline
dictionary attack against a leaked `verifier_hash`. Use a real passphrase.

---

## 5. Security model / access control tradeoff (read this)

Supabase's Row-Level Security policies in `schema.sql` are intentionally
permissive (`using (true)`) for `rooms`, `messages`, and the storage
bucket — **any request signed with your public `anon` key can read or
write rows.** This is safe *for confidentiality* only because everything
sensitive is already ciphertext (see §4) — a full database dump is
unreadable without the room passwords.

It is **not** protection against someone flooding a room with junk rows,
or deleting things (no delete policy is granted, so at least deletion is
blocked by default). For a hobby/private-friends chat this tradeoff is the
right one to stay on Supabase's free tier without standing up real user
accounts. If you want stronger access control later, the natural upgrade
path is Supabase Auth + per-room membership rows checked in RLS — the
encryption layer above doesn't need to change at all.

---

## 6. How the WebRTC calling works

- **Mesh topology:** every participant opens a direct `RTCPeerConnection`
  to every other participant. No media ever passes through a server.
  Comfortable up to ~6-8 people; beyond that, swap in an SFU (e.g. LiveKit
  Cloud's free tier) — `lib/useCall.ts` is where you'd plug it in.
- **Signaling:** SDP offers/answers and ICE candidates are exchanged over
  a Supabase Realtime **broadcast** channel (`call:{roomId}`) — no separate
  signaling server. Presence on that same channel is how participants
  discover each other and clean up when someone leaves.
- **Screen sharing:** replaces your outgoing camera track on the existing
  connection (`RTCRtpSender.replaceTrack`) rather than opening a second
  video stream, so no renegotiation dance is needed. A small signaling
  message tells peers to label your tile "(screen)". System audio is
  captured best-effort when the browser's share picker offers it (mainly
  Chrome tab/window sharing).
- **STUN only** (Google's public STUN servers) — sufficient for most
  home/office networks. If calls fail to connect across strict corporate
  NATs, add a TURN server (e.g. a free Metered.ca or Twilio TURN
  allocation) to the `ICE_SERVERS` array in `lib/useCall.ts`.

---

## 7. Feature checklist

- [x] Password-protected rooms (create-or-join, wrong password rejected)
- [x] Display name + generated (DiceBear) or uploaded avatar + status message
- [x] Real-time, end-to-end encrypted messaging
- [x] Encrypted file/image sharing
- [x] Emoji reactions
- [x] Typing indicators
- [x] Read receipts ("Read" under your own messages once someone catches up)
- [x] Message history for anyone currently in the room
- [x] One-click voice/video calls, mic/cam toggle, screen share, participant grid
- [x] Online/offline member sidebar, invite-link copy, clean "Leave room"
- [x] Toggleable sound notifications
- [x] Dark neon glassmorphic UI with Framer Motion animation throughout
- [x] Responsive layout (collapsible sidebar, adaptive call grid)

Not included, left as natural next steps: multi-device history sync of a
persisted local key (currently each session re-derives the key from the
password on join, by design, so nothing sensitive sits in browser storage),
an SFU for large calls, and TURN relay for restrictive networks.

---

## 8. A note on how this was verified

This project was written and manually reviewed end-to-end (types, data
flow between components, Supabase query/insert shapes against
`schema.sql`), but `npm install` / `next build` could not be run in the
sandboxed environment that generated this code — its outbound network
policy blocks the npm registry entirely. Please run `npm install && npm run
build` yourself right after unpacking (and definitely before deploying) to
catch anything a live compiler would catch that a careful read-through
couldn't. If something doesn't compile, the most likely culprits are a
dependency version drift in `package.json` — pin exact versions there if
needed.
