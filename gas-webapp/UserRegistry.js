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
function getOrCreateUser(email, name) {
  email = email.toLowerCase();
  var existing = findUserByEmail(email);

  if (existing) {
    // Update last login
    existing.lastLogin = new Date().toISOString();

    // Activate pending invites on first login
    if (existing.status === 'Pending') {
      existing.status = 'Active';
    }

    saveUserRecord(email, existing);
    return existing;
  }

  // New user — create their spreadsheet
  return createNewUser(email, name);
}

/**
 * Create a new user with their own spreadsheet.
 * Creates a fresh spreadsheet in the user's Drive and sets up all sheets.
 * No template needed — createAllSheets() builds everything from code.
 * With Execution API, create() runs as the user → spreadsheet goes to THEIR Drive.
 */
function createNewUser(email, name) {
  email = email.toLowerCase();

  // Create a fresh spreadsheet in the user's Drive (no template needed)
  var spreadsheet = SpreadsheetApp.create('Capital Friends - ' + name);
  var spreadsheetId = spreadsheet.getId();

  // Delete the default "Sheet1" that comes with every new spreadsheet
  try {
    var defaultSheet = spreadsheet.getSheetByName('Sheet1');
    if (defaultSheet && spreadsheet.getSheets().length > 0) {
      // Can't delete the only sheet — createAllSheets will add sheets first
      // We'll delete it after setup
    }
  } catch (e) {
    // Ignore — will be cleaned up after setup
  }

  // Create all required sheets from code (always latest structure)
  _currentUserSpreadsheetId = spreadsheetId;
  try {
    createAllSheets();
    log('All sheets created for new user: ' + email);

    // Now delete the default "Sheet1" if it still exists
    var ss = SpreadsheetApp.openById(spreadsheetId);
    var sheet1 = ss.getSheetByName('Sheet1');
    if (sheet1 && ss.getSheets().length > 1) {
      ss.deleteSheet(sheet1);
    }
  } catch (e) {
    log('Warning: createAllSheets failed for ' + email + ': ' + e.toString());
  }

  // Save user record in Script Properties
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

  // Install daily trigger for this user (auto-refresh master data + email alerts)
  try {
    installDailyTriggerForUser();
    log('Daily trigger installed for ' + email);
  } catch (e) {
    log('Warning: Could not install daily trigger for ' + email + ': ' + e.toString());
  }

  log('Created new user: ' + email + ' → Spreadsheet: ' + spreadsheetId);

  record.email = email;
  return record;
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
