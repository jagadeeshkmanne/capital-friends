# Trigger Architecture Issue
Currently, triggers are set up per user when they register. But because the web app runs as `USER_DEPLOYING`, all triggers are owned by the developer. When they fire, `Session.getEffectiveUser()` returns the developer's email, so the script only updates the developer's spreadsheet!

To fix this:
1. Create a `getAllActiveUsers()` in `UserRegistry.js`.
2. Modify `dailyUserSync()`, `sendScheduledDailyEmail()`, and `checkAndSendReminders()` to iterate over all active users, setting `_currentUserSpreadsheetId` for each one and processing them sequentially.
3. Remove the per-user trigger installation logic. Have a single manual initialization function (or run once on deploy) to install the global triggers once for the developer account.
