-- Nebula Chat — Supabase schema
-- Run this in the Supabase SQL editor (Project -> SQL Editor -> New query).
-- Everything sensitive is stored as ciphertext; Supabase (and its operators)
-- never sees a plaintext message, file, or the room password itself.

create extension if not exists "uuid-ossp";

-- One row per room. verifier_hash is derived from the password with a
-- DIFFERENT context string than the encryption key, so knowing verifier_hash
-- never helps decrypt anything. It only gates the join screen.
create table if not exists rooms (
  id text primary key,                -- slugified room name, e.g. "team-standup"
  verifier_hash text not null,        -- base64 PBKDF2 output, verification-only
  verifier_salt text not null,        -- base64 salt used for the verifier
  created_at timestamptz not null default now()
);

-- Encrypted chat messages. `ciphertext` and `nonce` are base64 strings
-- produced by nacl.secretbox on the client; the server cannot read them.
create table if not exists messages (
  id uuid primary key default uuid_generate_v4(),
  room_id text not null references rooms(id) on delete cascade,
  sender_id text not null,            -- random per-session client id (not PII)
  sender_name_cipher text not null,   -- encrypted display name
  sender_name_nonce text not null,
  ciphertext text not null,
  nonce text not null,
  msg_type text not null default 'text', -- 'text' | 'file' | 'system'
  file_meta_cipher text,              -- encrypted JSON: {name, size, mime, path}
  file_meta_nonce text,
  reactions jsonb not null default '{}'::jsonb, -- { "👍": ["sender_id", ...] }
  reply_to uuid references messages(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists messages_room_created_idx on messages (room_id, created_at);

-- Row Level Security: content is opaque ciphertext, so we allow any holder
-- of a valid anon key to read/write within a room. Confidentiality comes
-- from encryption, not from database access control (documented tradeoff —
-- see README "Security model").
alter table rooms enable row level security;
alter table messages enable row level security;

create policy "rooms are readable by anyone with the anon key"
  on rooms for select using (true);

create policy "rooms can be created by anyone with the anon key"
  on rooms for insert with check (true);

create policy "messages are readable by anyone with the anon key"
  on messages for select using (true);

create policy "messages can be inserted by anyone with the anon key"
  on messages for insert with check (true);

create policy "messages can be updated (for reactions) by anyone with the anon key"
  on messages for update using (true);

-- Enable Realtime on the messages table.
alter publication supabase_realtime add table messages;

-- Storage bucket for encrypted files. Public bucket is safe here because
-- every object in it is ciphertext produced by nacl.secretbox — same
-- security model as the messages table above (see README "Security model").
insert into storage.buckets (id, name, public)
values ('nebula-files', 'nebula-files', true)
on conflict (id) do nothing;

create policy "anyone with the anon key can read encrypted files"
  on storage.objects for select
  using (bucket_id = 'nebula-files');

create policy "anyone with the anon key can upload encrypted files"
  on storage.objects for insert
  with check (bucket_id = 'nebula-files');
