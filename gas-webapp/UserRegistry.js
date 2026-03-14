/**
 * ============================================================================
 * CAPITAL FRIENDS - User Registry & Family Sharing
 * ============================================================================
 *
 * Uses Script Properties as the user registry (key-value store).
 * No shared spreadsheet needed — fully server-side, invisible to users.
 *
 * Key format:
 *   "user:{email}" → JSON: { spreadsheetId, role, displayName, invitedBy,
 *                             createdDate, lastLogin, status }
 *
 * With the Execution API, functions run as the calling user.
 * DriveApp/SpreadsheetApp operate on the USER's Google account.
 * The app developer has zero access to user spreadsheets.
 *
 * ============================================================================
 */

// ============================================================================
// REGISTRY ACCESS (Script Properties)
// ============================================================================

/**
 * Find a user by email in Script Properties
 * @returns {Object|null} User record or null
 */
function findUserByEmail(email) {
  var props = PropertiesService.getScriptProperties();
  var data = props.getProperty('user:' + email.toLowerCase());
  if (!data) return null;

  var record = JSON.parse(data);
  record.email = email.toLowerCase();
  return record;
}

/**
 * Save a user record to Script Properties
 */
function saveUserRecord(email, record) {
  var props = PropertiesService.getScriptProperties();
  // Don't store email inside the value (it's the key)
  var toSave = {
    spreadsheetId: record.spreadsheetId,
    role: record.role,
    displayName: record.displayName,
    invitedBy: record.invitedBy || '',
    createdDate: record.createdDate,
    lastLogin: record.lastLogin,
    status: record.status
  };
  props.setProperty('user:' + email.toLowerCase(), JSON.stringify(toSave));
}

// ============================================================================
// USER LOOKUP & CREATION
// ============================================================================

/**
 * Get or create a user record.
 * - If user exists and is active/pending → return record (activate if pending)
 * - If user doesn't exist → create new spreadsheet and register as owner
 */
/**
 * Create a brand-new spreadsheet for a user, register it, and set up all sheets.
 * Lock must NOT be held when this is called — createAllSheets() is slow (minutes).
 */
function createNewUser(email, name) {
  email = email.toLowerCase();

  var spreadsheet = SpreadsheetApp.create('Capital Friends - ' + name);
  var spreadsheetId = spreadsheet.getId();

  var record = {
    spreadsheetId: spreadsheetId,
    role: 'owner',
    displayName: name,
    invitedBy: '',
    createdDate: new Date().toISOString(),
    lastLogin: new Date().toISOString(),
    status: 'Active'
  };
  saveUserRecord(email, record); // register immediately so concurrent calls see it
  log('Registered new user: ' + email + ' → ' + spreadsheetId);

  _currentUserSpreadsheetId = spreadsheetId;
  try {
    createAllSheets();
    log('All sheets created for: ' + email);
    var ss = SpreadsheetApp.openById(spreadsheetId);
    var sheet1 = ss.getSheetByName('Sheet1');
    if (sheet1 && ss.getSheets().length > 1) ss.deleteSheet(sheet1);
  } catch (e) {
    log('Warning: createAllSheets failed for ' + email + ': ' + e.toString());
  }

  try { installDailyTriggerForUser(); } catch (e) { log('Warning: trigger: ' + e); }
  try { installReminderTrigger(); } catch (e) { log('Warning: reminder trigger: ' + e); }

  record.email = email;
  record.isNew = true; // signal to client that this is a fresh account
  return record;
}

function getOrCreateUser(email, name) {
  email = email.toLowerCase();

  // Fast path: check without lock first (existing users — majority of calls)
  var existing = findUserByEmail(email);
  if (existing) {
    // Verify the spreadsheet still exists (user may have deleted it from Drive)
    try {
      SpreadsheetApp.openById(existing.spreadsheetId);
    } catch (e) {
      // Spreadsheet deleted or inaccessible — recreate for this user
      log('Spreadsheet missing for ' + email + ' (id: ' + existing.spreadsheetId + '). Recreating...');
      return createNewUser(email, existing.displayName || name);
    }

    // Heal any missing sheets if setup was interrupted on first login
    // Only runs createAllSheets if a required sheet is absent (cheap check first)
    _currentUserSpreadsheetId = existing.spreadsheetId;
    try {
      if (!sheetExists('FamilyMembers') || !sheetExists('Goals') || !sheetExists('AllPortfolios')) {
        log('Missing sheets detected for ' + email + ' — running createAllSheets to heal');
        createAllSheets();
      }
    } catch (e) {
      log('Warning: sheet healing failed for ' + email + ': ' + e.toString());
    }

    // Update last login
    existing.lastLogin = new Date().toISOString();

    // Activate pending invites on first login
    if (existing.status === 'Pending') {
      existing.status = 'Active';
    }

    saveUserRecord(email, existing);
    return existing;
  }

  // New user — acquire lock briefly: just to prevent duplicate creation from concurrent calls.
  // Lock is held only during the re-check + record save (~2s). createNewUser runs outside.
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);

    // Re-check inside the lock — another concurrent call may have just created the user
    existing = findUserByEmail(email);
    if (existing) {
      existing.lastLogin = new Date().toISOString();
      saveUserRecord(email, existing);
      return existing;
    }

    // Save a placeholder record first so any concurrent call finds it immediately
    var spreadsheet = SpreadsheetApp.create('Capital Friends - ' + name);
    var spreadsheetId = spreadsheet.getId();
    var record = {
      spreadsheetId: spreadsheetId,
      role: 'owner',
      displayName: name,
      invitedBy: '',
      createdDate: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
      status: 'Active'
    };
    saveUserRecord(email, record);
    log('Registered new user in lock: ' + email + ' → ' + spreadsheetId);

    lock.releaseLock(); // release before slow sheet setup

    // Set up sheets outside the lock
    _currentUserSpreadsheetId = spreadsheetId;
    try {
      createAllSheets();
      log('All sheets created for: ' + email);
      var ss = SpreadsheetApp.openById(spreadsheetId);
      var sheet1 = ss.getSheetByName('Sheet1');
      if (sheet1 && ss.getSheets().length > 1) ss.deleteSheet(sheet1);
    } catch (e) {
      log('Warning: createAllSheets failed for ' + email + ': ' + e.toString());
    }

    try { installDailyTriggerForUser(); } catch (e) { log('Warning: trigger: ' + e); }
    try { installReminderTrigger(); } catch (e) { log('Warning: reminder trigger: ' + e); }

    record.email = email;
    record.isNew = true; // signal to client that this is a fresh account
    return record;
  } catch (e) {
    // Lock timeout or unexpected error — try creating without lock as last resort
    log('Lock/create error for ' + email + ': ' + e.toString() + ' — attempting direct create');
    try { lock.releaseLock(); } catch (_) {}
    return createNewUser(email, name);
  }
}


// ============================================================================
// FAMILY SHARING
// ============================================================================

/**
 * Invite a family member to share the owner's spreadsheet.
 * Runs as the owner → owner has permission to share their file.
 * Only owners can invite.
 */
function inviteToFamily(ownerRecord, memberEmail, memberName) {
  if (!memberEmail) {
    throw new Error('Email is required to invite a family member.');
  }

  memberEmail = memberEmail.trim().toLowerCase();

  // Check if already registered
  var existing = findUserByEmail(memberEmail);
  if (existing) {
    if (existing.spreadsheetId === ownerRecord.spreadsheetId) {
      throw new Error(memberEmail + ' is already a member of your family.');
    }
    throw new Error(memberEmail + ' already has their own Capital Friends account.');
  }

  // Share the spreadsheet with the family member (runs as owner who owns the file)
  var file = DriveApp.getFileById(ownerRecord.spreadsheetId);
  file.addEditor(memberEmail);

  // Register in Script Properties as pending member
  var record = {
    spreadsheetId: ownerRecord.spreadsheetId, // Same spreadsheet as owner
    role: 'member',
    displayName: memberName || memberEmail.split('@')[0],
    invitedBy: ownerRecord.email,
    createdDate: new Date().toISOString(),
    lastLogin: '',
    status: 'Pending'
  };
  saveUserRecord(memberEmail, record);

  log('Invited ' + memberEmail + ' to family of ' + ownerRecord.email);

  return {
    email: memberEmail,
    name: record.displayName,
    role: 'member',
    status: 'Pending'
  };
}

/**
 * Remove a family member's access.
 * Only owners can remove members.
 */
function removeFromFamily(ownerRecord, memberEmail) {
  if (!memberEmail) {
    throw new Error('Email is required.');
  }

  memberEmail = memberEmail.trim().toLowerCase();

  var member = findUserByEmail(memberEmail);
  if (!member) {
    throw new Error(memberEmail + ' is not registered.');
  }

  if (member.spreadsheetId !== ownerRecord.spreadsheetId) {
    throw new Error(memberEmail + ' is not a member of your family.');
  }

  if (member.role === 'owner') {
    throw new Error('Cannot remove the owner.');
  }

  // Remove spreadsheet access (runs as owner who owns the file)
  try {
    var file = DriveApp.getFileById(ownerRecord.spreadsheetId);
    file.removeEditor(memberEmail);
  } catch (e) {
    log('Warning: Could not remove editor access: ' + e.toString());
  }

  // Update status in Script Properties
  member.status = 'Suspended';
  saveUserRecord(memberEmail, member);

  log('Removed ' + memberEmail + ' from family of ' + ownerRecord.email);

  return { email: memberEmail, status: 'Suspended' };
}

/**
 * Get all members sharing a spreadsheet
 */
function getSharedMembers(spreadsheetId) {
  var props = PropertiesService.getScriptProperties();
  var all = props.getProperties();
  var members = [];

  for (var key in all) {
    if (key.indexOf('user:') === 0) {
      try {
        var record = JSON.parse(all[key]);
        if (record.spreadsheetId === spreadsheetId && record.status !== 'Suspended') {
          members.push({
            email: key.substring(5), // remove 'user:' prefix
            displayName: record.displayName,
            role: record.role,
            status: record.status
          });
        }
      } catch (e) {
        // Skip malformed entries
      }
    }
  }

  return members;
}

// ============================================================================
// END OF USERREGISTRY.JS
// ============================================================================
