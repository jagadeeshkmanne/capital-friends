/**
 * ============================================================================
 * FAMILYMEMBERS.GS - Family Members Management for Capital Friends V2
 * ============================================================================
 */

/**
 * Add new family member
 * @param {Object} data - Member data object
 * @returns {Object} - Success/error response
 */
function addFamilyMember(data) {
  try {
    // Validate required fields
    isRequired(data.memberName, 'Member Name');
    isRequired(data.relationship, 'Relationship');
    isRequired(data.pan, 'PAN');
    isRequired(data.aadhar, 'Aadhar');
    isRequired(data.email, 'Email');
    isRequired(data.mobile, 'Mobile');

    // Validate formats
    if (!isValidPAN(data.pan)) {
      throw new Error('Invalid PAN format. Expected: ABCDE1234F');
    }
    if (!isValidAadhar(data.aadhar)) {
      throw new Error('Invalid Aadhar format. Expected: 12 digits');
    }
    if (!isValidEmail(data.email)) {
      throw new Error('Invalid email format');
    }
    if (!isValidPhone(data.mobile)) {
      throw new Error('Invalid mobile format. Expected: 10 digits');
    }

    // Get sheet
    const sheet = getSheet(CONFIG.familyMembersSheet);
    if (!sheet) {
      throw new Error('FamilyMembers sheet not found. Please run ONE-CLICK SETUP first.');
    }

    // Check for duplicate PAN/Aadhar
    const existingData = sheet.getRange(3, 1, Math.max(1, sheet.getLastRow() - 2), 12).getValues();
    for (let i = 0; i < existingData.length; i++) {
      if (existingData[i][3] && existingData[i][3].toString().toUpperCase() === data.pan.toUpperCase()) {
        throw new Error('PAN already exists for another member');
      }
      if (existingData[i][4] && existingData[i][4].toString() === data.aadhar.toString()) {
        throw new Error('Aadhar already exists for another member');
      }
    }

    // Generate Member ID
    const existingIds = existingData.map(row => row[0]);
    const memberId = generateId('FM', existingIds);

    // Prepare dynamic fields JSON
    const dynamicFields = JSON.stringify(data.dynamicFields || {});

    // Add member
    const now = getCurrentTimestamp();
    const includeInEmailReports = data.includeInEmailReports !== false ? 'Yes' : 'No';

    sheet.appendRow([
      memberId,            // Column A: Member ID
      data.memberName,     // Column B: Member Name
      data.relationship,   // Column C: Relationship
      data.pan.toUpperCase(), // Column D: PAN
      data.aadhar,         // Column E: Aadhar
      data.email,          // Column F: Email
      data.mobile,         // Column G: Mobile
      includeInEmailReports, // Column H: Include in Email Reports
      'Active',            // Column I: Status
      now,                 // Column J: Created Date
      now,                 // Column K: Last Updated
      dynamicFields        // Column L: Dynamic Fields
    ]);

    // Apply formatting to the new row (borders only, no background)
    const newRow = sheet.getLastRow();
    applyDataRowFormatting(sheet, newRow, newRow, 12);

    log(`Family member added: ${memberId} - ${data.memberName}`);

    // Optionally share sheet with the member's email (if requested)
    let shareMessage = '';
    if (data.shareSheet === true) {
      try {
        const spreadsheet = getSpreadsheet();
        spreadsheet.addViewer(data.email);
        shareMessage = ` Sheet has been shared with ${data.email} as Viewer.`;
        log(`Sheet shared with ${data.email} (Viewer access)`);
      } catch (shareError) {
        log(`Warning: Could not share sheet with ${data.email}: ${shareError.toString()}`);
        shareMessage = ` Note: Could not automatically share sheet. Please share manually.`;
      }
    }

    return {
      success: true,
      message: `Family member "${data.memberName}" added successfully!${shareMessage}`,
      memberId: memberId
    };

  } catch (error) {
    log('Error adding family member: ' + error.toString());
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * Get all family members
 * @returns {Array} - Array of member objects
 */
function getAllFamilyMembers() {
  try {
    log('getAllFamilyMembers() called');

    const sheet = getSheet(CONFIG.familyMembersSheet);
    if (!sheet) {
      log('ERROR: FamilyMembers sheet not found');
      return [];
    }
    log('FamilyMembers sheet found');

    const lastRow = sheet.getLastRow();
    log('Last row: ' + lastRow);

    if (lastRow <= 2) {
      log('No members data (lastRow <= 2), returning empty array');
      return []; // No members yet
    }

    const data = sheet.getRange(3, 1, lastRow - 2, 12).getValues();
    log('Data rows read: ' + data.length);

    const members = [];

    data.forEach(row => {
      if (row[0]) { // If Member ID exists (Column A)
        let dynamicFields = {};
        try {
          dynamicFields = row[11] ? JSON.parse(row[11]) : {};
        } catch (e) {
          log('Error parsing dynamic fields for member ' + row[0] + ': ' + e.toString());
          dynamicFields = {};
        }

        members.push({
          memberId: row[0],        // Column A
          memberName: row[1],      // Column B
          relationship: row[2],    // Column C
          pan: row[3],             // Column D
          aadhar: row[4],          // Column E
          email: row[5],           // Column F
          mobile: row[6],          // Column G
          includeInEmailReports: row[7],  // Column H
          status: row[8],          // Column I
          createdDate: row[9] ? row[9].toString() : '',     // Column J - Convert Date to String
          lastUpdated: row[10] ? row[10].toString() : '',   // Column K - Convert Date to String
          dynamicFields: dynamicFields  // Column L
        });
      }
    });

    log('Returning ' + members.length + ' members');
    return members;

  } catch (error) {
    log('ERROR in getAllFamilyMembers: ' + error.toString());
    log('Stack trace: ' + error.stack);
    // Return empty array instead of null to avoid issues in UI
    return [];
  }
}

/**
 * Get family member by ID
 * @param {string} memberId - Member ID
 * @returns {Object|null} - Member object or null
 */
function getFamilyMemberById(memberId) {
  try {
    const members = getAllFamilyMembers();
    return members.find(m => m.memberId === memberId) || null;
  } catch (error) {
    log('Error getting family member: ' + error.toString());
    return null;
  }
}

/**
 * Get family member name by ID
 * @param {string} memberId - Member ID (e.g., "FM-001")
 * @returns {string} - Member name or empty string if not found
 */
function getFamilyMemberName(memberId) {
  try {
    if (!memberId) return '';
    const member = getFamilyMemberById(memberId);
    return member ? member.memberName : '';
  } catch (error) {
    log('Error getting family member name: ' + error.toString());
    return '';
  }
}

/**
 * Update family member
 * @param {Object} data - Updated member data
 * @returns {Object} - Success/error response
 */
function updateFamilyMember(data) {
  try {
    // Validate required fields
    isRequired(data.memberId, 'Member ID');
    isRequired(data.memberName, 'Member Name');
    isRequired(data.relationship, 'Relationship');
    isRequired(data.pan, 'PAN');
    isRequired(data.aadhar, 'Aadhar');
    isRequired(data.email, 'Email');
    isRequired(data.mobile, 'Mobile');

    // Validate formats
    if (!isValidPAN(data.pan)) {
      throw new Error('Invalid PAN format. Expected: ABCDE1234F');
    }
    if (!isValidAadhar(data.aadhar)) {
      throw new Error('Invalid Aadhar format. Expected: 12 digits');
    }
    if (!isValidEmail(data.email)) {
      throw new Error('Invalid email format');
    }
    if (!isValidPhone(data.mobile)) {
      throw new Error('Invalid mobile format. Expected: 10 digits');
    }

    // Get sheet
    const sheet = getSheet(CONFIG.familyMembersSheet);
    if (!sheet) {
      throw new Error('FamilyMembers sheet not found');
    }

    // Find member row (Member ID is in Column A)
    const lastRow = sheet.getLastRow();
    const memberIds = sheet.getRange(3, 1, lastRow - 2, 1).getValues(); // Column A
    let rowIndex = -1;

    for (let i = 0; i < memberIds.length; i++) {
      if (memberIds[i][0] === data.memberId) {
        rowIndex = i + 3; // +3 because of credit row + header row + 0-index
        break;
      }
    }

    if (rowIndex === -1) {
      throw new Error('Member not found');
    }

    // Check for duplicate PAN/Aadhar (excluding current member)
    const existingData = sheet.getRange(3, 1, lastRow - 2, 12).getValues();
    for (let i = 0; i < existingData.length; i++) {
      if (existingData[i][0] !== data.memberId) { // Column A is Member ID
        if (existingData[i][3] && existingData[i][3].toString().toUpperCase() === data.pan.toUpperCase()) { // Column D is PAN
          throw new Error('PAN already exists for another member');
        }
        if (existingData[i][4] && existingData[i][4].toString() === data.aadhar.toString()) { // Column E is Aadhar
          throw new Error('Aadhar already exists for another member');
        }
      }
    }

    // Prepare dynamic fields JSON
    const dynamicFields = JSON.stringify(data.dynamicFields || {});

    // Update member (keep Member ID, Created Date, update rest)
    const createdDate = sheet.getRange(rowIndex, 10).getValue(); // Column J is Created Date
    const includeInEmailReports = data.includeInEmailReports !== false ? 'Yes' : 'No';

    sheet.getRange(rowIndex, 1, 1, 12).setValues([[
      data.memberId,           // Column A: Member ID
      data.memberName,         // Column B: Member Name
      data.relationship,       // Column C: Relationship
      data.pan.toUpperCase(),  // Column D: PAN
      data.aadhar,             // Column E: Aadhar
      data.email,              // Column F: Email
      data.mobile,             // Column G: Mobile
      includeInEmailReports,   // Column H: Include in Email Reports
      data.status || 'Active', // Column I: Status
      createdDate,             // Column J: Created Date
      getCurrentTimestamp(),   // Column K: Last Updated
      dynamicFields            // Column L: Dynamic Fields
    ]]);

    log(`Family member updated: ${data.memberId} - ${data.memberName}`);

    return {
      success: true,
      message: `Family member "${data.memberName}" updated successfully!`
    };

  } catch (error) {
    log('Error updating family member: ' + error.toString());
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * Delete family member (set status to Inactive)
 * @param {string} memberId - Member ID
 * @returns {Object} - Success/error response
 */
function deleteFamilyMember(memberId) {
  try {
    isRequired(memberId, 'Member ID');

    const sheet = getSheet(CONFIG.familyMembersSheet);
    if (!sheet) {
      throw new Error('FamilyMembers sheet not found');
    }

    // Find member row
    const lastRow = sheet.getLastRow();
    const memberIds = sheet.getRange(3, 1, lastRow - 2, 1).getValues();
    let rowIndex = -1;
    let memberName = '';

    for (let i = 0; i < memberIds.length; i++) {
      if (memberIds[i][0] === memberId) {
        rowIndex = i + 3;
        memberName = sheet.getRange(rowIndex, 2).getValue();
        break;
      }
    }

    if (rowIndex === -1) {
      throw new Error('Member not found');
    }

    // Set status to Inactive
    sheet.getRange(rowIndex, 9).setValue('Inactive');
    sheet.getRange(rowIndex, 11).setValue(getCurrentTimestamp());

    log(`Family member deleted (status=Inactive): ${memberId} - ${memberName}`);

    return {
      success: true,
      message: `Family member "${memberName}" deleted successfully!`
    };

  } catch (error) {
    log('Error deleting family member: ' + error.toString());
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * Get family member dropdown options for other forms
 * @returns {Array} - Array of {id, name} objects
 */
function getFamilyMemberOptions() {
  const members = getAllFamilyMembers();
  return members
    .filter(m => m.status === 'Active')
    .map(m => ({
      id: m.memberId,
      name: `${m.memberName} (${m.relationship})`
    }));
}

/**
 * Get family members included in email reports
 * @returns {Array} - Array of member objects with includeInEmailReports = 'Yes'
 */
function getFamilyMembersForEmailReports() {
  const members = getAllFamilyMembers();
  return members.filter(m => m.status === 'Active' && m.includeInEmailReports === 'Yes');
}

// ============================================================================
// END OF FAMILYMEMBERS.GS
// ============================================================================
