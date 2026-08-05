# ARCHITECTURE V2 — USER DRIVE BACKUP

> **Supersedes:** V1 (centralized backend / GAS-stored user data)
> **Status:** Proposal — awaiting decisions in "Open Decisions Before Implementation" section
> **Pattern:** WhatsApp-style E2E-encrypted backup to user's own Google Drive

## What Changes from V1

| Concern | V1 (current) | V2 (this doc) |
|---------|--------------|---------------|
| User data location | Central backend (GAS / DB) | User's own Google Drive (`appDataFolder`) |
| Read/write path | Network request → backend | Local IndexedDB → background sync to Drive |
| Offline support | Limited / none | Full — app is local-first |
| Our data custody | Yes — we hold user data | **None — we hold zero user data** |
| Privacy posture | "Trust us not to look" | "Mathematically cannot read it" (E2E encrypted) |
| Cross-device | Backend serves any device | Same Google account = restore from Drive |
| Failure mode if we go down | Users lose access | Users still have local + Drive copy |

## Summary

V2 is an architectural shift from **centralized user data** (V1) to **user-owned Drive backup** using the WhatsApp model.

After this change:
- App is **local-first** (works fully offline via IndexedDB)
- Cloud state lives in the **user's own Google Drive** (hidden `appDataFolder`)
- Data is **end-to-end encrypted** with a user-derived key — Google sees only ciphertext
- No central database holds user records — only their own Drive account does

## Why This Change

V1 (current state):
- User data lives in a backend store (Firestore / GAS sheets / centralized DB)
- We have custody of data even if access-scoped
- Privacy posture is "trust us not to look"

V2 (this proposal):
- We hold **zero user data** at rest
- Each user's data is in **their** Drive, hidden, encrypted with their key
- Privacy posture is "we mathematically cannot read it"
- Same Google account on a new device = full restore, no server involvement

This matches how WhatsApp does backups (and why their privacy claim is credible).

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  React App (react-app/)                                     │
│                                                              │
│  ┌────────────────────┐                                     │
│  │  UI Layer          │                                     │
│  └─────────┬──────────┘                                     │
│            │                                                 │
│  ┌─────────▼──────────┐                                     │
│  │  Local DB          │  ← single source of truth on device │
│  │  (IndexedDB)       │     all reads/writes go here first  │
│  └─────────┬──────────┘                                     │
│            │                                                 │
│  ┌─────────▼──────────┐                                     │
│  │  Sync Engine       │  ← periodic snapshot + upload       │
│  │  (background)      │     handles offline → online        │
│  └─────────┬──────────┘                                     │
│            │                                                 │
│  ┌─────────▼──────────┐                                     │
│  │  Encryption Layer  │  ← AES-GCM with key derived from    │
│  │  (libsodium-js)    │     user password (Argon2id)         │
│  └─────────┬──────────┘                                     │
└────────────┼─────────────────────────────────────────────────┘
             │ HTTPS + Bearer token (drive.appdata scope)
             ▼
   ┌──────────────────────────────────────┐
   │  User's Google Drive                  │
   │  ┌─────────────────────────────────┐ │
   │  │  appDataFolder (hidden)         │ │
   │  │   capital-friends-backup-N.enc  │ │
   │  │   capital-friends-backup-N-1.enc│ │
   │  │   capital-friends-backup-N-2.enc│ │
   │  └─────────────────────────────────┘ │
   └──────────────────────────────────────┘
```

Key principle: **the local IndexedDB is the source of truth; Drive is a remote backup, not a sync target.**

---

## Components

### 1. Local DB (IndexedDB via RxDB or Dexie)
- Stores all user data: portfolio, watchlists, screener results, settings
- Reactive queries → UI re-renders on changes
- All writes go here first (offline-safe by default)

### 2. Encryption Layer
- Uses `libsodium-js` (battle-tested NaCl bindings) for AES-GCM + Argon2id
- Key derivation: `key = Argon2id(password, salt)` — slow by design (~500ms)
- Salt is generated once per user, stored locally + included in backup metadata
- Backup is encrypted as a single blob before upload

### 3. Sync Engine
- Triggered by:
  - Periodic timer (e.g., every 5 min while dirty)
  - User explicit "Backup now"
  - On app close (before unload)
- Logic:
  1. Snapshot local DB → JSON
  2. Encrypt blob
  3. Upload to Drive `appDataFolder`
  4. Delete older backups (keep last N, e.g., 3)

### 4. Restore Engine
- Triggered on:
  - Fresh install / new device, after Google sign-in
  - User explicit "Restore from Drive"
- Logic:
  1. List files in `appDataFolder` (sorted by modifiedTime desc)
  2. Download latest
  3. Prompt user for password
  4. Derive key, decrypt
  5. Bulk insert into local DB

### 5. Auth
- Firebase Auth (or direct Google OAuth) with `drive.appdata` scope
- Access token cached in memory only, refreshed on demand
- No server-side credentials

---

## OAuth Scope (THE Key Choice)

| Scope | Use? | Why |
|-------|------|-----|
| `drive` | ❌ | Full Drive access — requires CASA security assessment ($15K-75K) |
| `drive.file` | ❌ | Per-file access — sensitive scope, verification needed |
| **`drive.appdata`** | ✅ | **Hidden per-app folder — narrowest scope, easiest verification** |

Full URL: `https://www.googleapis.com/auth/drive.appdata`

This folder:
- Is **invisible** in drive.google.com UI under normal browsing (only "Manage apps" shows usage)
- Is **app-isolated** — only capital-friends can read/write its own appData folder
- Survives reinstall — same Google account = same folder reappears
- Counts toward user's Drive quota but typically <1 MB total

---

## Backup Flow

```javascript
// pseudocode
async function backup() {
  // 1. Snapshot local DB
  const snapshot = await db.dumpAll();
  // → { portfolio: [...], watchlists: [...], settings: {...}, version: 1 }

  // 2. Encrypt with user's key (cached in memory after login)
  const key = sessionStore.encryptionKey;
  const encrypted = sodium.crypto_secretbox_easy(
    JSON.stringify(snapshot),
    nonce,
    key
  );

  // 3. Compose upload blob (nonce + ciphertext + metadata)
  const payload = concat(nonce, encrypted);

  // 4. Upload to drive.appdata via multipart
  const metadata = {
    name: `cf-backup-${Date.now()}.enc`,
    parents: ['appDataFolder'],
  };
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', new Blob([payload], { type: 'application/octet-stream' }));

  await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    }
  );

  // 5. Prune older backups (keep last 3)
  await pruneOldBackups(3);
}
```

---

## Restore Flow

```javascript
async function restore(userPassword) {
  // 1. List backups in appDataFolder
  const list = await fetch(
    'https://www.googleapis.com/drive/v3/files' +
      '?spaces=appDataFolder' +
      '&orderBy=modifiedTime%20desc' +
      '&fields=files(id,name,modifiedTime,size)',
    { headers: { Authorization: `Bearer ${accessToken}` } }
  ).then((r) => r.json());

  if (list.files.length === 0) throw new Error('No backups found');

  const latest = list.files[0];

  // 2. Download latest
  const blob = await fetch(
    `https://www.googleapis.com/drive/v3/files/${latest.id}?alt=media`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  ).then((r) => r.arrayBuffer());

  // 3. Split nonce + ciphertext
  const nonce = blob.slice(0, sodium.crypto_secretbox_NONCEBYTES);
  const ciphertext = blob.slice(sodium.crypto_secretbox_NONCEBYTES);

  // 4. Derive key from user password + stored salt
  const salt = await getStoredSalt(); // local or from a small metadata file
  const key = await deriveKey(userPassword, salt);

  // 5. Decrypt
  const plaintext = sodium.crypto_secretbox_open_easy(ciphertext, nonce, key);
  const snapshot = JSON.parse(plaintext);

  // 6. Bulk insert into local DB
  await db.restoreAll(snapshot);
  sessionStore.encryptionKey = key;
}
```

---

## Encryption Strategy

### Key Derivation
- **Algorithm**: Argon2id (libsodium default)
- **Memory cost**: 64 MB (slow, defeats brute force)
- **Salt**: 16 bytes, generated once on user signup, stored:
  - Locally (IndexedDB `meta` table)
  - In a tiny `salt.json` file in `appDataFolder` (so restore on a new device can find it)

### Encryption
- **Algorithm**: XSalsa20-Poly1305 (`crypto_secretbox_easy` in libsodium)
- **Nonce**: 24 bytes, fresh per backup (prepended to ciphertext)
- **No password ever leaves the device** — only ciphertext is uploaded

### Password Recovery
- **None.** If user forgets password, backup is unrecoverable.
- **Mitigation options:**
  - Show a 12-word BIP39 recovery phrase at signup (user writes it down)
  - Or: explicit "no recovery, save your password" warning (Standard Notes model)

This is the cost of true E2E encryption. Standard Notes, Bitwarden, WhatsApp E2E backup all work this way.

---

## Migration Path (Phased)

### Phase 1 — Add local-first store alongside existing backend
- Add IndexedDB layer to React app (RxDB or Dexie)
- All reads/writes happen locally first
- Existing backend continues to receive a copy (dual-write)
- No user-visible change

### Phase 2 — Add Drive backup as opt-in
- Add "Backup to Google Drive" toggle in settings
- Users who enable it: app does local-first + Drive backup
- Users who don't: app continues using existing backend (or local only)

### Phase 3 — Make Drive backup the default
- New users start with local-first + Drive backup
- Existing users prompted to migrate
- Existing backend goes read-only for legacy users

### Phase 4 — Sunset central backend
- All users on local-first + Drive
- Central DB deleted
- We hold zero user data

---

## Verification Path (Google OAuth)

For production with >100 users:

1. **Develop and test under 100-user cap** — no verification needed, "unverified app" warning shown
2. **Submit for verification** when nearing 100 users
3. **Scope: `drive.appdata`** — easier to verify than `drive.file` or `drive`
4. **No CASA security assessment required** — only full `drive` scope needs that ($15K-75K)
5. **Typical timeline**: 1-3 weeks for `drive.appdata` review
6. **Required for submission**:
   - Privacy policy URL
   - Homepage URL
   - YouTube demo showing scope usage
   - Justification (250 words): "Used to back up user app data in their own Google Drive"

---

## Stack Decisions

| Concern | Pick | Why |
|---------|------|-----|
| Local DB | **RxDB** (or Dexie if simpler is fine) | Reactive queries, plugin architecture, sync-ready |
| Encryption | **libsodium-js** | Hardened, audited, used by Signal/WhatsApp |
| OAuth | **Firebase Auth** (Google provider) + manual scope add | Already integrated, handles refresh |
| Drive API | **Direct REST calls** (no client library needed) | Simpler than `gapi.js`, smaller bundle |
| Snapshot format | **Single JSON blob, gzipped before encrypt** | Simple, easy to version |
| Backup frequency | **Periodic (5 min while dirty) + on unload** | Mirrors WhatsApp daily/auto |

---

## Open Decisions Before Implementation

1. **Password vs passphrase vs Google session as key source?**
   - Password: user remembers it, no recovery
   - 12-word phrase (BIP39): more secure, harder UX
   - Google session-derived: easier UX but loses E2E guarantee if Google compromised
   - **Recommendation**: password + optional recovery phrase

2. **Single backup file vs multiple?**
   - Single: simpler, atomic
   - Multiple (per record): finer granularity, more API calls
   - **Recommendation**: single file, gzipped, until total exceeds ~10 MB

3. **What about the GAS webapp?**
   - Phase out gradually — its current role (centralized data) goes away
   - May still serve a role for shared / public data (master-mf-db, screener)
   - **Decision needed**: split between "user data" (Drive) and "shared data" (GAS / static)

4. **What about master-mf-db and screener data?**
   - These are **not user-specific** — they're reference data
   - They stay in their current form (GAS / API)
   - Only user-generated state (portfolio, watchlists, scores) moves to Drive

5. **Multi-device behavior?**
   - Backup model = device A backs up, device B restores → device B is now source of truth
   - True sync (both devices edit simultaneously) is NOT in scope
   - Acceptable for now (WhatsApp had this limitation for years)

---

## What This Does NOT Solve

- **Real-time multi-device editing** — needs CRDTs / sync protocol (out of scope)
- **Account sharing** — one Drive = one account's view
- **Server-side analytics on user data** — by design, we can't do this anymore
- **Server-side email of "your portfolio update"** — we don't have the data to send
- **Forgot-password recovery** — true E2E means we cannot recover

These are conscious trade-offs for the privacy posture.

---

## Implementation Order

1. Add RxDB / Dexie to react-app and migrate one slice (e.g., watchlist) to local-first
2. Add libsodium-js + key derivation utilities
3. Add Google OAuth flow with `drive.appdata` scope (Firebase or direct)
4. Build backup function (snapshot → encrypt → upload)
5. Build restore function (list → download → decrypt → restore)
6. Add UI: "Backup to Drive" toggle + manual "Backup now" + "Restore from Drive"
7. Run dual-write phase (local + existing backend) for 2-4 weeks to validate
8. Cut over per the migration plan above

---

## References

- WhatsApp E2E encrypted backups: https://faq.whatsapp.com/490592613091019
- Google `drive.appdata` scope docs: https://developers.google.com/drive/api/guides/appdata
- libsodium-js: https://github.com/jedisct1/libsodium.js
- RxDB: https://rxdb.info
- Argon2 spec: RFC 9106

---

## Status

- [x] Architecture documented
- [ ] Decision on password vs passphrase
- [ ] Decision on master-mf-db / screener separation
- [ ] Local DB slice prototype (one feature)
- [ ] Encryption layer prototype
- [ ] Drive backup prototype
- [ ] Verification submission
- [ ] Phase 1 dual-write rollout
- [ ] Phase 2 opt-in Drive backup
- [ ] Phase 3 default Drive backup
- [ ] Phase 4 backend sunset
