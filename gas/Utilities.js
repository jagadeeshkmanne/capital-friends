/**
 * ============================================================================
 * UTILITIES.GS - Helper Functions for Capital Friends V2
 * ============================================================================
 */

/**
 * Save Questionnaire Responses ONLY (for updates)
 * Called from updateQuestionnaire() when user updates their security check
 * UPDATES the existing row instead of appending
 */
function saveQuestionnaire(answers) {
  try {
    const spreadsheet = getSpreadsheet();
    let questionnaireSheet = getSheet(CONFIG.questionnaireSheet);

    // Create Questionnaire sheet if it doesn't exist
    if (!questionnaireSheet) {
      questionnaireSheet = spreadsheet.insertSheet(CONFIG.questionnaireSheet);

      // Add developer credit
      addDeveloperCredit(questionnaireSheet, 10);

      // Add headers
      questionnaireSheet.appendRow([
        'Date',
        'Health Insurance',
        'Term Insurance',
        'Emergency Fund',
        'Family Awareness',
        'Will',
        'Nominees',
        'Goals',
        'Score',
        'Total'
      ]);

      // Format header
      formatHeaderRow(questionnaireSheet, questionnaireSheet.getRange('A2:J2'), 40);
      applyStandardFormatting(questionnaireSheet);

      // Set tab color (Emerald for security check)
      questionnaireSheet.setTabColor('#10b981');
    }

    // UPDATE the last row (don't append new row)
    const lastRow = questionnaireSheet.getLastRow();

    if (lastRow <= 2) {
      // No existing data, append first row
      questionnaireSheet.appendRow([
        new Date(),
        answers.q1_healthInsurance || '',
        answers.q2_termInsurance || '',
        answers.q3_emergencyFund || '',
        answers.q4_familyAwareness || '',
        answers.q5_will || '',
        answers.q6_nominees || '',
        answers.q7_goals || '',
        answers.score || 0,
        answers.totalQuestions || 7
      ]);
    } else {
      // Update the last existing row
      questionnaireSheet.getRange(lastRow, 1, 1, 10).setValues([[
        new Date(),
        answers.q1_healthInsurance || '',
        answers.q2_termInsurance || '',
        answers.q3_emergencyFund || '',
        answers.q4_familyAwareness || '',
        answers.q5_will || '',
        answers.q6_nominees || '',
        answers.q7_goals || '',
        answers.score || 0,
        answers.totalQuestions || 7
      ]]);
    }

    log('Questionnaire responses updated');

    // Prepare summary message (NO sheet creation)
    let summary = `✅ Financial Health Check Updated! Score: ${answers.score}/${answers.totalQuestions}\n\n`;
    summary += `📊 Your responses have been saved.\n`;

    // Show recommendations based on score
    const recommendations = getRecommendations(answers);
    if (recommendations.length > 0) {
      summary += `\n💡 Recommendations:\n`;
      recommendations.forEach(rec => {
        summary += `  ${rec}\n`;
      });
    }

    return {
      success: true,
      message: 'Financial health check updated successfully!',
      summary: summary
    };

  } catch (error) {
    log('Error updating questionnaire: ' + error.toString());
    return {
      success: false,
      message: 'Error: ' + error.message
    };
  }
}

/**
 * Save Questionnaire AND Create All Sheets (for ONE-CLICK SETUP)
 * Called from oneClickSetup() during initial setup
 * APPENDS a new row
 */
function saveQuestionnaireAndSetup(answers) {
  try {
    const spreadsheet = getSpreadsheet();

    // Check if this is first-time setup or re-running
    // Check Questionnaire sheet - if it has data rows, it's not first-time setup
    let questionnaireSheet = getSheet(CONFIG.questionnaireSheet);
    const isFirstTimeSetup = !questionnaireSheet || questionnaireSheet.getLastRow() <= 2;

    // Create Questionnaire sheet if it doesn't exist
    if (!questionnaireSheet) {
      questionnaireSheet = spreadsheet.insertSheet(CONFIG.questionnaireSheet);

      // Add developer credit
      addDeveloperCredit(questionnaireSheet, 10);

      // Add headers
      questionnaireSheet.appendRow([
        'Date',
        'Health Insurance',
        'Term Insurance',
        'Emergency Fund',
        'Family Awareness',
        'Will',
        'Nominees',
        'Goals',
        'Score',
        'Total'
      ]);

      // Format header
      formatHeaderRow(questionnaireSheet, questionnaireSheet.getRange('A2:J2'), 40);
      applyStandardFormatting(questionnaireSheet);

      // Set tab color (Emerald for security check)
      questionnaireSheet.setTabColor('#10b981');
    }

    // Only save questionnaire response if this is first-time setup
    // Otherwise, user is just re-running setup (sheets already exist)
    if (isFirstTimeSetup) {
      questionnaireSheet.appendRow([
        new Date(),
        answers.q1_healthInsurance || '',
        answers.q2_termInsurance || '',
        answers.q3_emergencyFund || '',
        answers.q4_familyAwareness || '',
        answers.q5_will || '',
        answers.q6_nominees || '',
        answers.q7_goals || '',
        answers.score || 0,
        answers.totalQuestions || 7
      ]);
      log('Questionnaire responses saved (first-time setup)');
    } else {
      log('Questionnaire responses NOT saved (sheets already exist, skipping duplicate entry)');
    }

    // Now create all sheets (will skip existing ones)
    const createResults = createAllSheets();

    // Prepare summary message
    let summary = `✅ Questionnaire completed! Score: ${answers.score}/${answers.totalQuestions}\n\n`;

    if (createResults.created.length > 0) {
      summary += `🎉 Created ${createResults.created.length} new sheets:\n`;
      createResults.created.forEach(name => {
        summary += `   ✓ ${name}\n`;
      });
    }

    if (createResults.existing.length > 0) {
      summary += `\n📋 ${createResults.existing.length} sheets already existed:\n`;
      createResults.existing.forEach(name => {
        summary += `   ✓ ${name}\n`;
      });
    }

    if (createResults.errors.length > 0) {
      summary += `\n⚠️ ${createResults.errors.length} errors:\n`;
      createResults.errors.forEach(error => {
        summary += `   ✗ ${error}\n`;
      });
    }

    summary += `\n🚀 Setup complete! You can now start using Capital Friends.`;
    summary += `\n\n📧 Don't forget to configure email settings to receive automated reports!`;
    summary += `\n   Menu: Capital Friends → Email Settings`;

    // Show recommendations based on score
    const recommendations = getRecommendations(answers);
    if (recommendations.length > 0) {
      summary += `\n\n💡 Recommendations:\n`;
      recommendations.forEach(rec => {
        summary += `  ${rec}\n`;
      });
    }

    return {
      success: true,
      message: 'Questionnaire saved and setup completed!',
      summary: summary
    };

  } catch (error) {
    log('Error saving questionnaire: ' + error.toString());
    return {
      success: false,
      message: 'Error: ' + error.message
    };
  }
}

/**
 * Get Latest Questionnaire Responses
 * Returns the most recent questionnaire answers for pre-population
 */
function getLatestQuestionnaireResponses() {
  try {
    const questionnaireSheet = getSheet(CONFIG.questionnaireSheet);

    if (!questionnaireSheet) {
      return null; // No questionnaire sheet exists
    }

    const lastRow = questionnaireSheet.getLastRow();

    if (lastRow <= 2) {
      return null; // No data rows (only header rows)
    }

    // Get the last row of data
    const data = questionnaireSheet.getRange(lastRow, 1, 1, 10).getValues()[0];

    return {
      q1_healthInsurance: data[1] || '',
      q2_termInsurance: data[2] || '',
      q3_emergencyFund: data[3] || '',
      q4_familyAwareness: data[4] || '',
      q5_will: data[5] || '',
      q6_nominees: data[6] || '',
      q7_goals: data[7] || '',
      score: data[8] || 0,
      totalQuestions: data[9] || 7
    };

  } catch (error) {
    log('Error getting latest questionnaire responses: ' + error.toString());
    return null;
  }
}

/**
 * Get recommendations based on questionnaire answers
 */
function getRecommendations(answers) {
  const recommendations = [];

  if (answers.q1_healthInsurance === 'No') {
    recommendations.push('🏥 Get good health insurance for all family members');
  }

  if (answers.q2_termInsurance === 'No') {
    recommendations.push('🛡️ Get term life insurance — coverage 10-15x your annual income');
  }

  if (answers.q3_emergencyFund === 'No') {
    recommendations.push('💰 Build an emergency fund — 6 months of household expenses');
  }

  if (answers.q4_familyAwareness === 'No') {
    recommendations.push('📢 Make sure your family knows where all your assets are');
  }

  if (answers.q5_will === 'No') {
    recommendations.push('📝 Create a registered Will for smooth asset transfer');
  }

  if (answers.q6_nominees === 'No') {
    recommendations.push('👥 Update nominees on all bank accounts, investments, insurance, PF, PPF');
  }

  if (answers.q7_goals === 'No') {
    recommendations.push('🎯 Set clear financial goals with a plan — use the Goal Planner');
  }

  if (recommendations.length === 0) {
    recommendations.push('🎉 Great! Your family is well-prepared financially.');
  }

  return recommendations;
}

/**
 * Custom function for Google Sheets to extract base fund name
 * Usage in sheets: =GET_BASE_FUND_NAME(A4)
 * @customfunction
 */
function GET_BASE_FUND_NAME(schemeCode) {
  if (!schemeCode) return '';

  try {
    const mfDataSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('MutualFundData');
    if (!mfDataSheet) return '';

    const data = mfDataSheet.getDataRange().getValues();

    // MutualFundData structure: Row 1 = Headers, Row 2+ = Data
    // Skip header (row 0 in array), start from row 1 (data row 2 in sheet)
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] && data[i][0].toString() === schemeCode.toString()) {
        const fullName = data[i][1];
        return getBaseFundName(fullName);
      }
    }

    return '';
  } catch (error) {
    return '';
  }
}

/**
 * Extract base fund name without plan details (Growth/Direct/IDCW/etc)
 * Used by GET_BASE_FUND_NAME and other backend functions
 */
function getBaseFundName(fullName) {
  if (!fullName) return '';

  // Plan keywords that usually appear at the end - remove these
  // Ordered from most specific to least specific to match correctly
  const planKeywords = [
    // Direct Plan variations
    ' - Direct Plan - Growth Option',
    ' - Direct Plan - IDCW Option',
    ' - Direct Plan - Dividend Option',
    ' - Direct Plan - Monthly IDCW',
    ' - Direct Plan - Quarterly IDCW',
    ' - Direct Plan - Annual IDCW',
    ' - Direct Plan - Weekly IDCW',
    ' - Direct Plan - Half Yearly IDCW',
    ' - Direct Plan - Periodic IDCW',
    ' - Direct Plan - Bonus Option',
    ' - Direct Plan - Growth',
    ' - Direct Plan - IDCW',
    ' - Direct Plan - Dividend',
    ' - Direct Plan',

    // Regular Plan variations
    ' - Regular Plan - Growth Option',
    ' - Regular Plan - IDCW Option',
    ' - Regular Plan - Dividend Option',
    ' - Regular Plan - Monthly IDCW',
    ' - Regular Plan - Quarterly IDCW',
    ' - Regular Plan - Annual IDCW',
    ' - Regular Plan - Weekly IDCW',
    ' - Regular Plan - Half Yearly IDCW',
    ' - Regular Plan - Periodic IDCW',
    ' - Regular Plan - Bonus Option',
    ' - Regular Plan - Growth',
    ' - Regular Plan - IDCW',
    ' - Regular Plan - Dividend',
    ' - Regular Plan',

    // Other plan types
    ' - Retail Plan - Growth Option',
    ' - Retail Plan - Growth',
    ' - Institutional Plan - Growth Option',
    ' - Institutional Plan - Growth',

    // Short forms
    ' - Direct - IDCW',
    ' - Direct - Growth',
    ' - Regular - IDCW',
    ' - Regular - Growth',

    // Standalone options (rare, but just in case)
    ' - Growth Option',
    ' - IDCW Option',
    ' - Dividend Option',
    ' - Growth',
    ' - IDCW',
    ' - Dividend'
  ];

  // Try to remove plan keywords from the end
  let baseName = fullName.trim();
  for (const keyword of planKeywords) {
    if (baseName.endsWith(keyword)) {
      baseName = baseName.substring(0, baseName.length - keyword.length).trim();
      break; // Only remove once
    }
  }

  return baseName;
}

// ============================================================================
// BIDIRECTIONAL LINKING - Investment & Liability Sync Functions
// ============================================================================

/**
 * Sync bidirectional link between investment and liability
 * @param {string} investmentId - Investment ID (or "" to unlink)
 * @param {string} liabilityId - Liability ID (or "" to unlink)
 */
function syncInvestmentLiabilityLink(investmentId, liabilityId) {
  if (investmentId) {
    updateInvestmentLiabilityLink(investmentId, liabilityId);
  }
  if (liabilityId) {
    updateLiabilityInvestmentLink(liabilityId, investmentId);
  }
}

/**
 * Update investment's linked liability ID
 * @param {string} investmentId - Investment ID
 * @param {string} liabilityId - Liability ID to link (or "" to unlink)
 */
function updateInvestmentLiabilityLink(investmentId, liabilityId) {
  try {
    const sheet = getSheet(CONFIG.otherInvestmentsSheet);
    if (!sheet) return;

    const investments = getAllInvestments();
    const inv = investments.find(i => i.investmentId === investmentId);
    if (inv) {
      sheet.getRange(inv.rowIndex, 10).setValue(liabilityId || ''); // Column J: Linked Liability ID
    }
  } catch (error) {
    Logger.log('Error in updateInvestmentLiabilityLink: ' + error.message);
  }
}

/**
 * Update liability's linked investment ID
 * @param {string} liabilityId - Liability ID
 * @param {string} investmentId - Investment ID to link (or "" to unlink)
 */
function updateLiabilityInvestmentLink(liabilityId, investmentId) {
  try {
    const sheet = getSheet(CONFIG.liabilitiesSheet);
    if (!sheet) return;

    const liabilities = getAllLiabilities();
    const liab = liabilities.find(l => l.liabilityId === liabilityId);
    if (liab) {
      sheet.getRange(liab.rowIndex, 11).setValue(investmentId || ''); // Column K: Linked Investment ID
    }
  } catch (error) {
    Logger.log('Error in updateLiabilityInvestmentLink: ' + error.message);
  }
}

/**
 * Get suggested loan type based on investment type
 * @param {string} investmentType - Investment type
 * @returns {string} Suggested loan type
 */
function getLoanTypeSuggestion(investmentType) {
  const suggestions = {
    'Real Estate': 'Home Loan',
    'Gold': 'Gold Loan',
    'Auto': 'Auto Loan',
    'Education': 'Education Loan',
    'Business': 'Business Loan'
  };
  return suggestions[investmentType] || 'Personal Loan';
}

/**
 * Unlink ALL investments from a liability
 * @param {string} liabilityId - Liability ID to unlink from all investments
 */
function unlinkAllInvestmentsFromLiability(liabilityId) {
  try {
    const sheet = getSheet(CONFIG.otherInvestmentsSheet);
    if (!sheet) return;

    const investments = getAllInvestments();

    // Find all investments linked to this liability
    investments.forEach(inv => {
      if (inv.linkedLiabilityId === liabilityId) {
        // Clear the linked liability ID for this investment
        sheet.getRange(inv.rowIndex, 10).setValue(''); // Column J: Linked Liability ID
        Logger.log(`Unlinked investment ${inv.investmentId} from liability ${liabilityId}`);
      }
    });

  } catch (error) {
    Logger.log('Error in unlinkAllInvestmentsFromLiability: ' + error.message);
  }
}

// ============================================================================
// END OF UTILITIES.GS
// ============================================================================
