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
    const mfDataSheet = getSpreadsheet().getSheetByName('MutualFundData');
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

// getBaseFundName() lives in MutualFunds.js (single regex version)

// ============================================================================
// HEALTH CHECK API FUNCTIONS (for React App)
// ============================================================================

/**
 * Get health check completion status
 * Returns whether the user has completed the Financial Health Check
 */
function getHealthCheckStatus() {
  try {
    const questionnaireSheet = getSheet(CONFIG.questionnaireSheet);

    if (!questionnaireSheet) {
      return { completed: false, score: 0, total: 7 };
    }

    const lastRow = questionnaireSheet.getLastRow();
    if (lastRow <= 2) {
      return { completed: false, score: 0, total: 7 };
    }

    // Get score from the last data row (10 columns: Date + 7 answers + Score + Total)
    const data = questionnaireSheet.getRange(lastRow, 1, 1, 10).getValues()[0];
    return {
      completed: true,
      score: data[8] || 0,  // Column I: Score
      total: data[9] || 7   // Column J: Total
    };
  } catch (error) {
    log('Error getting health check status: ' + error.toString());
    return { completed: false, score: 0, total: 7 };
  }
}

/**
 * Save health check answers (7 questions from React app)
 * Creates/updates the Questionnaire sheet with standard 7-question format
 */
function saveHealthCheck(params) {
  try {
    const spreadsheet = getSpreadsheet();
    let questionnaireSheet = getSheet(CONFIG.questionnaireSheet);

    const HEADERS = [
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
    ];

    // Create Questionnaire sheet if it doesn't exist
    if (!questionnaireSheet) {
      questionnaireSheet = spreadsheet.insertSheet(CONFIG.questionnaireSheet);
      addDeveloperCredit(questionnaireSheet, HEADERS.length);
      questionnaireSheet.appendRow(HEADERS);
      formatHeaderRow(questionnaireSheet, questionnaireSheet.getRange('A2:J2'), 40);
      applyStandardFormatting(questionnaireSheet);
      questionnaireSheet.setTabColor('#10b981');
    }

    const row = [
      new Date(),
      params.healthIns || 'No',
      params.termLife || 'No',
      params.emergencyFund || 'No',
      params.familyAware || 'No',
      params.hasWill || 'No',
      params.nominees || 'No',
      params.goals || 'No',
      params.score || 0,
      params.total || 7
    ];

    const lastRow = questionnaireSheet.getLastRow();

    if (lastRow <= 2) {
      questionnaireSheet.appendRow(row);
    } else {
      // Update existing row
      questionnaireSheet.getRange(lastRow, 1, 1, 10).setValues([row]);
    }

    // Persist a simple flag in Settings so clients can check without loading the Questionnaire sheet
    try { updateSetting('HealthCheckAnswered', 'true'); } catch (e) { log('Warning: could not set HealthCheckAnswered flag: ' + e); }

    log('Health check saved: ' + params.score + '/' + params.total);

    return {
      success: true,
      completed: true,
      score: params.score,
      total: params.total
    };
  } catch (error) {
    log('Error saving health check: ' + error.toString());
    return { success: false, message: error.message };
  }
}

/**
 * Get latest health check responses for pre-populating the form
 * Returns 7 answers from the Questionnaire sheet
 */
function getLatestHealthCheckResponses() {
  try {
    const questionnaireSheet = getSheet(CONFIG.questionnaireSheet);

    if (!questionnaireSheet) {
      return null;
    }

    const lastRow = questionnaireSheet.getLastRow();
    if (lastRow <= 2) {
      return null;
    }

    // 10 columns: Date, Health Insurance, Term Insurance, Emergency Fund, Family Awareness, Will, Nominees, Goals, Score, Total
    const data = questionnaireSheet.getRange(lastRow, 1, 1, 10).getValues()[0];

    return {
      healthIns: data[1] || 'No',
      termLife: data[2] || 'No',
      emergencyFund: data[3] || 'No',
      familyAware: data[4] || 'No',
      hasWill: data[5] || 'No',
      nominees: data[6] || 'No',
      goals: data[7] || 'No',
      score: data[8] || 0,
      total: data[9] || 7
    };
  } catch (error) {
    log('Error getting health check responses: ' + error.toString());
    return null;
  }
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
 * Update investment's linked liability ID (ADD to comma-separated list)
 * @param {string} investmentId - Investment ID
 * @param {string} liabilityId - Liability ID to add (or "" to clear all)
 */
function updateInvestmentLiabilityLink(investmentId, liabilityId) {
  try {
    var sheet = getSheet(CONFIG.otherInvestmentsSheet);
    if (!sheet) return;

    var investments = getAllInvestments();
    var inv = investments.find(function(i) { return i.investmentId === investmentId; });
    if (!inv) return;

    if (liabilityId) {
      // Add to comma-separated list (avoid duplicates)
      var existing = inv.linkedLiabilityId ? inv.linkedLiabilityId.split(',').map(function(s) { return s.trim(); }).filter(Boolean) : [];
      if (existing.indexOf(liabilityId) === -1) {
        existing.push(liabilityId);
      }
      sheet.getRange(inv.rowIndex, 10).setValue(existing.join(','));
    } else {
      // Clear all — only used when unlinking everything
      sheet.getRange(inv.rowIndex, 10).setValue('');
    }
  } catch (error) {
    Logger.log('Error in updateInvestmentLiabilityLink: ' + error.message);
  }
}

/**
 * Remove a specific liability from an investment's comma-separated list
 * @param {string} investmentId - Investment ID
 * @param {string} liabilityId - Liability ID to remove
 */
function removeInvestmentLiabilityLink(investmentId, liabilityId) {
  try {
    var sheet = getSheet(CONFIG.otherInvestmentsSheet);
    if (!sheet) return;

    var investments = getAllInvestments();
    var inv = investments.find(function(i) { return i.investmentId === investmentId; });
    if (!inv) return;

    var existing = inv.linkedLiabilityId ? inv.linkedLiabilityId.split(',').map(function(s) { return s.trim(); }).filter(Boolean) : [];
    var filtered = existing.filter(function(id) { return id !== liabilityId; });
    sheet.getRange(inv.rowIndex, 10).setValue(filtered.join(','));
  } catch (error) {
    Logger.log('Error in removeInvestmentLiabilityLink: ' + error.message);
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
  var suggestions = {
    'Real Estate': 'Home Loan'
  };
  return suggestions[investmentType] || 'Personal Loan';
}

/**
 * Unlink ALL investments from a liability (handles comma-separated lists)
 * @param {string} liabilityId - Liability ID to unlink from all investments
 */
function unlinkAllInvestmentsFromLiability(liabilityId) {
  try {
    var sheet = getSheet(CONFIG.otherInvestmentsSheet);
    if (!sheet) return;

    var investments = getAllInvestments();

    investments.forEach(function(inv) {
      if (!inv.linkedLiabilityId) return;
      var ids = inv.linkedLiabilityId.split(',').map(function(s) { return s.trim(); });
      if (ids.indexOf(liabilityId) !== -1) {
        var filtered = ids.filter(function(id) { return id !== liabilityId; });
        sheet.getRange(inv.rowIndex, 10).setValue(filtered.join(','));
        Logger.log('Unlinked investment ' + inv.investmentId + ' from liability ' + liabilityId);
      }
    });

  } catch (error) {
    Logger.log('Error in unlinkAllInvestmentsFromLiability: ' + error.message);
  }
}

// ============================================================================
// SHARED HELPERS (used by multiple files)
// ============================================================================

/**
 * Decode HTML entities from JSON strings
 * @param {string} text - Text with HTML entities
 * @returns {string} Decoded text
 */
function decodeHtmlEntities(text) {
  if (!text) return '';
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

/**
 * Escape HTML special characters to prevent XSS
 * @param {string} text - Raw text
 * @returns {string} HTML-safe text
 */
function escapeHtml(text) {
  if (!text) return '';
  return text.toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ============================================================================
// END OF UTILITIES.GS
// ============================================================================

/**
 * LIVE GOLD & SILVER PRICES (₹ per gram, Indian retail)
 *
 * International spot from api.gold-api.com (XAU/INR, XAG/INR, per troy ounce), converted to grams
 * and lifted to Indian retail level (import duty + GST + local premium). Calibrated 7 Oct 2026:
 * 24K India ₹14,957/g (Goodreturns) vs spot ₹12,730/g -> 1.175. Silver uses duty + GST (~1.10).
 * Shared cache 30 minutes; the last good price is kept, so a failed download never shows a made-up rate.
 */
var METAL_PREMIUM_ = { gold: 1.175, silver: 1.10 };
var GRAMS_PER_TROY_OZ_ = 31.1034768;

function getLiveMetalPrices() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get('LIVE_METALS_V2');
  if (hit) { try { return JSON.parse(hit); } catch (e) { } }
  var props = PropertiesService.getScriptProperties();
  var last = null;
  try { last = JSON.parse(props.getProperty('LIVE_METALS_LAST') || 'null'); } catch (e) { last = null; }
  function spot(sym) {
    var r = UrlFetchApp.fetch('https://api.gold-api.com/price/' + sym + '/INR', { muteHttpExceptions: true });
    if (r.getResponseCode() !== 200) return 0;
    var j = JSON.parse(r.getContentText());
    return j && j.price > 0 ? j.price / GRAMS_PER_TROY_OZ_ : 0;
  }
  var gold = 0, silver = 0;
  try { gold = spot('XAU'); } catch (e) { Logger.log('gold price fetch failed: ' + e.message); }
  try { silver = spot('XAG'); } catch (e) { Logger.log('silver price fetch failed: ' + e.message); }
  var out = {
    gold24: gold ? Math.round(gold * METAL_PREMIUM_.gold) : (last && last.gold24) || 0,
    silver999: silver ? Math.round(silver * METAL_PREMIUM_.silver * 100) / 100 : (last && last.silver999) || 0,
    asOf: new Date().toISOString(),
    stale: !(gold && silver)
  };
  if (gold && silver) {
    props.setProperty('LIVE_METALS_LAST', JSON.stringify(out));
    cache.put('LIVE_METALS_V2', JSON.stringify(out), 30 * 60);
  } else if (last) {
    out.asOf = last.asOf;
    cache.put('LIVE_METALS_V2', JSON.stringify(out), 5 * 60); // try again soon
  }
  return out;
}

/** 24K gold, ₹ per gram (kept for older callers). */
function getLiveGoldPrice() {
  return getLiveMetalPrices().gold24 || 0;
}

/**
 * Live value of a gold / silver holding from its weight and purity. Returns 0 when it can't be
 * calculated (not a metal, no weight, or no price yet) - callers then keep the saved value.
 */
function metalLiveValue_(investmentType, dynamicFields, prices) {
  var w = dynamicFields && Number(dynamicFields.weightGrams);
  if (!(w > 0)) return 0;
  var type = String(investmentType || '');
  var purity = String((dynamicFields && dynamicFields.purity) || '').toUpperCase().replace(/\s|KARAT|CARAT/g, '');
  var isGold = ['Physical Gold', 'Digital Gold', 'Sovereign Gold Bond'].indexOf(type) !== -1;
  var isSilver = /silver/i.test(type);
  if (isGold) {
    if (!prices.gold24) return 0;
    var gf = { '24K': 1, '24': 1, '999': 1, '995': 0.995, '22K': 0.9166, '22': 0.9166, '916': 0.9166, '18K': 0.75, '18': 0.75, '750': 0.75, '14K': 0.585, '14': 0.585 }[purity] || 1;
    // Sovereign Gold Bonds are valued at the IBJA 999 rate, which has no GST
    var per = type === 'Sovereign Gold Bond' ? prices.gold24 / 1.03 : prices.gold24 * gf;
    return Math.round(w * per);
  }
  if (isSilver) {
    if (!prices.silver999) return 0;
    var sf = { '999': 1, '925': 0.925, '900': 0.9, '800': 0.8 }[purity] || 1;
    return Math.round(w * prices.silver999 * sf);
  }
  return 0;
}
