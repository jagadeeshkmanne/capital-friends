# Capital Friends — rules for every change

## Two views: phone (Ionic) and laptop
- `components/native` `useIsPhone()` = `matchMedia('(max-width: 1023.98px)')`. `Layout.jsx` renders `phone/PhoneLayout.jsx` (Ionic shell) on phones, the normal layout otherwise. It switches live on resize.
- Pages with a separate phone screen: Dashboard → `DashboardPhone.jsx`, Mutual Funds → `MutualFundsPhone.jsx`, Goals → `GoalsPhone.jsx`, Settings → `SettingsPhone.jsx`. List pages (bank, family, insurance, loans, other investments, reminders, investment accounts) switch to `phone/PhoneList` inside the same file. Every other page is one responsive page for both.
- **Every feature must work in both views.** Build it as a shared component or hook (logic in `utils/` / `hooks/`, UI as one component), then place it in the desktop page AND, if the page has a phone screen, in its `*Phone.jsx`. Never put logic only in a desktop page.
- Before committing a UI change, check both widths: 390px (phone) and 1440px (laptop). Dialogs open as full pages on phones (Modal does this).

## Standing rules
- Don't break existing users' data (Google Sheet columns, Settings keys).
- Commit after each step; deploy only from main; Jagadeesh deploys.
- SEBI-safe wording: never "Buy / Strong Buy"; say "below peak / far below peak".
- Tests: `cd react-app && npx vitest run` (some node:test files: `node --test`).
