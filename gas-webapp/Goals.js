/**
 * ============================================================================
 * GOALS.GS - Goals Management Functions for Capital Friends V2
 * ============================================================================
 * Handles goal planning, calculation, and portfolio mapping
 */

// ============================================================================
// GOAL CRUD OPERATIONS
// ============================================================================

/**
 * Get all active goals
 */
function getAllGoals() {
  Logger.log('=== getAllGoals called ===');

  const sheet = getSheet('Goals');
  if (!sheet) {
    Logger.log('ERROR: Goals sheet not found!');
    return [];
  }
  Logger.log('Goals sheet found');

  // Find the last row with actual data in column A (Goal ID)
  const dataRange = sheet.getRange('A3:A').getValues();
  Logger.log('Data range A3:A has ' + dataRange.length + ' rows');

  let lastDataRow = 2; // Start from header row
  for (let i = 0; i < dataRange.length; i++) {
    if (dataRange[i][0]) { // If there's a Goal ID
      lastDataRow = i + 3; // +3 because data starts at row 3
      Logger.log('Found data in row ' + lastDataRow + ': ' + dataRange[i][0]);
    }
  }
  Logger.log('Last data row: ' + lastDataRow);

  // If no goals exist, return empty array
  if (lastDataRow < 3) {
    Logger.log('No goals found (lastDataRow < 3)');
    return [];
  }

  // Read only rows that have data
  const numRows = lastDataRow - 2; // Number of rows from row 3 to lastDataRow
  Logger.log('Reading ' + numRows + ' rows starting from row 3');

  const data = sheet.getRange(3, 1, numRows, 21).getValues();
  const goals = [];

  data.forEach((row, index) => {
    if (row[0]) { // If Goal ID exists
      Logger.log('Processing row ' + (index + 3) + ': Goal ID = ' + row[0]);

      // Serialize dates to ISO strings for proper client-side JSON handling
      // Handle both Date objects AND string dates (in case editGoal wrote a string)
      let targetDate, createdDate;
      try {
        if (row[5] instanceof Date) {
          targetDate = row[5].toISOString();
        } else if (row[5]) {
          targetDate = new Date(row[5]).toISOString();
        } else {
          targetDate = new Date().toISOString();
        }
      } catch (e) {
        Logger.log('Error parsing targetDate for row ' + (index + 3) + ': ' + e);
        targetDate = new Date().toISOString();
      }

      try {
        if (row[11] instanceof Date) {
          createdDate = row[11].toISOString();
        } else if (row[11]) {
          createdDate = new Date(row[11]).toISOString();
        } else {
          createdDate = new Date().toISOString();
        }
      } catch (e) {
        Logger.log('Error parsing createdDate for row ' + (index + 3) + ': ' + e);
        createdDate = new Date().toISOString();
      }

      goals.push({
        goalId: row[0],                     // A
        goalType: row[1],                   // B
        goalName: row[2],                   // C
        familyMemberId: '',                 // Not stored separately — resolved via familyMemberName
        familyMemberName: row[3],           // D (React field name)
        targetAmount: Number(row[4]) || 0,  // E (inflated future value)
        targetDate: targetDate,             // F (serialized)
        monthlyInvestment: Number(row[6]) || 0,  // G (React: monthlyInvestment)
        lumpsumNeeded: Number(row[7]) || 0,      // H
        currentValue: Number(row[8]) || 0,       // I (React: currentValue)
        gapAmount: Number(row[9]) || 0,          // J
        progressPercent: Number(row[10]) || 0,   // K
        createdDate: createdDate,           // L (serialized)
        priority: row[12] || 'Medium',      // M
        status: row[13] || 'Behind',        // N
        isActive: Boolean(row[14]),         // O
        notes: row[15] || '',               // P
        expectedInflation: Number(row[16]) || 0.06,  // Q (hidden)
        expectedCAGR: Number(row[17]) || 0.12,       // R (hidden)
        monthlyExpenses: Number(row[18]) || null,    // S (for Retirement/Emergency Fund)
        emergencyMonths: Number(row[19]) || null,    // T (for Emergency Fund)
        lumpsumInvested: Number(row[20]) || null      // U (user's committed lumpsum)
      });
    }
  });

  Logger.log('Returning ' + goals.length + ' goals');
  return goals;
}

/**
 * Get all goals with their portfolio mappings (for dashboard)
 */
function getAllGoalsWithMappings() {
  try {
    Logger.log('=== getAllGoalsWithMappings called ===');

    const goals = getAllGoals();
    Logger.log('getAllGoals returned: ' + (goals ? goals.length : 'null') + ' goals');

    if (!goals || goals.length === 0) {
      Logger.log('No goals found, returning empty array');
      return [];
    }

    // Serialize goals to ensure Date objects are converted to strings
    const serializedGoals = goals.map(goal => {
      Logger.log('Processing goal: ' + goal.goalId + ' - ' + goal.goalName);

      // Get portfolio mappings for this goal
      const portfolioMappings = getGoalPortfolioMappings(goal.goalId) || [];
      Logger.log('Found ' + portfolioMappings.length + ' portfolio mappings');

      // getAllGoals() already returns dates as ISO strings, so just pass them through
      return {
        goalId: goal.goalId,
        goalType: goal.goalType,
        goalName: goal.goalName,
        familyMember: goal.familyMember,
        targetAmount: Number(goal.targetAmount) || 0,
        targetDate: goal.targetDate || new Date().toISOString(),
        monthlyInvestment: Number(goal.monthlyInvestment) || 0,
        lumpsumNeeded: Number(goal.lumpsumNeeded) || 0,
        currentValue: Number(goal.currentValue) || 0,
        gapAmount: Number(goal.gapAmount) || 0,
        progressPercent: Number(goal.progressPercent) || 0,
        createdDate: goal.createdDate || new Date().toISOString(),
        priority: goal.priority || 'Medium',
        status: goal.status || 'Behind',
        isActive: Boolean(goal.isActive),
        notes: goal.notes || '',
        expectedInflation: Number(goal.expectedInflation) || 0.06,
        expectedCAGR: Number(goal.expectedCAGR) || 0.12,
        monthlyExpenses: goal.monthlyExpenses || null,
        emergencyMonths: goal.emergencyMonths || null,
        portfolioMappings: portfolioMappings
      };
    });

    Logger.log('Returning ' + serializedGoals.length + ' serialized goals');
    return serializedGoals;
  } catch (error) {
    Logger.log('ERROR in getAllGoalsWithMappings: ' + error.toString());
    Logger.log('Error stack: ' + error.stack);
    return [];
  }
}

/**
 * Get goal by ID
 */
function getGoalById(goalId) {
  const goals = getAllGoals();
  return goals.find(g => g.goalId === goalId);
}

/**
 * Create multiple goals (for Goal Planner wizard)
 */
function createMultipleGoals(formData) {
  const results = [];

  // Handle the formData object format from GoalPlanner.html
  // formData = { age: 30, goals: { house: {...}, education: {...} } }
  const goalsObject = formData.goals || formData;

  // Convert goals object to array and process each goal
  Object.keys(goalsObject).forEach(goalKey => {
    const goalData = goalsObject[goalKey];

    // Map goal types
    const goalTypeMap = {
      'emergency': 'Emergency Fund',
      'retirement': 'Retirement',
      'house': 'House Purchase',
      'education': 'Child Education',
      'marriage': 'Child Marriage',
      'car': 'Car Purchase',
      'vacation': 'Vacation'
    };

    // Determine goal type and name
    let goalType = goalTypeMap[goalKey] || 'Custom';
    let goalName = goalData.name || goalTypeMap[goalKey] || 'Custom Goal';

    // goalData.year is always the target year (e.g., 2043, 2032) from frontend
    // Create target date as December 31st of that year
    const targetDate = new Date(goalData.year, 11, 31); // December 31st of target year

    // Prepare goal data for addGoal function
    const goalToAdd = {
      goalType: goalType,
      goalName: goalName,
      familyMember: goalData.familyMember || 'Self',
      currentCost: goalData.currentCost || null,  // New field for current cost
      targetAmount: goalData.amount,
      targetDate: targetDate,
      expectedInflation: goalData.inflation,
      expectedCAGR: goalData.cagr,
      priority: goalData.priority || 'Medium',
      notes: goalData.notes || '',
      isRetirement: goalData.isRetirement || false,  // Flag for retirement goals
      monthlyExpenses: goalData.monthlyExpenses || null,  // Monthly expenses for Retirement/Emergency Fund
      emergencyMonths: goalData.emergencyMonths || null,  // Emergency months for Emergency Fund
      lumpsumInvested: goalData.lumpsumInvested || 0       // Lumpsum user plans to invest now
    };

    const result = addGoal(goalToAdd);
    results.push(result);
  });

  // Return success summary
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;

  if (successCount > 0 && failCount === 0) {
    return {
      success: true,
      message: `Created ${successCount} goal(s) successfully!`,
      results: results
    };
  } else if (successCount > 0 && failCount > 0) {
    return {
      success: true,
      message: `Created ${successCount} goal(s), but ${failCount} failed.`,
      results: results
    };
  } else {
    return {
      success: false,
      message: 'Failed to create goals.',
      results: results
    };
  }
}

/**
 * Add new goal
 */
function addGoal(goalData) {
  try {
    const sheet = getSheet('Goals');
    if (!sheet) {
      return { success: false, error: 'Goals sheet not found' };
    }

    // Generate Goal ID
    // Find the last row with data in column A (Goal ID column)
    const dataRange = sheet.getRange('A3:A').getValues();
    let lastDataRow = 2; // Start from header row
    for (let i = 0; i < dataRange.length; i++) {
      if (dataRange[i][0]) { // If there's a Goal ID
        lastDataRow = i + 3; // +3 because data starts at row 3
      }
    }

    const goalId = generateGoalId(lastDataRow);

    // Calculate years to go
    const yearsToGo = calculateYearsToGo(goalData.targetDate);

    // NEW SIMPLIFIED STRUCTURE:
    // Column E: Target Amount - ALWAYS inflated future value (what you need to save)
    // We removed "Amount Today" column to avoid confusion

    let inflationAdjustedTarget;

    if (goalData.currentCost || goalData.isRetirement) {
      // Goals with "Current Cost Today" OR Retirement
      // Frontend already calculated the inflated future value
      inflationAdjustedTarget = goalData.targetAmount;
    } else {
      // Emergency Fund or Custom goals: targetAmount is today's value, need to inflate
      inflationAdjustedTarget = calculateInflationAdjustedTarget(
        goalData.targetAmount,
        goalData.expectedInflation,
        yearsToGo
      );
    }

    const lumpsumInvested = goalData.lumpsumInvested || 0;

    // Insert row after the last data row
    const newRow = lastDataRow + 1;

    // Prepare row data - static values only (formulas set separately)
    // IMPORTANT: targetDate must be a local-timezone Date object — UTC dates may not work as sheet dates
    const targetDate = parseSheetDate(goalData.targetDate);
    const rowData = [
      goalId,                                    // A: Goal ID
      goalData.goalType || '',                   // B: Goal Type
      goalData.goalName || '',                   // C: Goal Name
      goalData.familyMember || 'Self',           // D: Family Member
      inflationAdjustedTarget,                   // E: Target Amount (inflated future value)
      targetDate,                                // F: Target Date (local-timezone Date object)
      0,                                         // G: placeholder (formula below)
      0,                                         // H: placeholder (formula below)
      0,                                         // I: placeholder (formula below)
      0,                                         // J: placeholder (formula below)
      0,                                         // K: placeholder (formula below)
      new Date(),                                // L: Created Date
      goalData.priority || 'Medium',             // M: Priority
      '',                                        // N: placeholder (formula below)
      true,                                      // O: Is Active
      goalData.notes || '',                      // P: Notes
      goalData.expectedInflation || 0.06,        // Q: Expected Inflation (hidden, default 6%)
      goalData.expectedCAGR || 0.12,             // R: Expected CAGR (hidden, default 12%)
      goalData.monthlyExpenses || null,          // S: Monthly Expenses (for Retirement/Emergency Fund)
      goalData.emergencyMonths || null,          // T: Emergency Months (for Emergency Fund)
      lumpsumInvested || null                    // U: Lumpsum Invested (user's committed lumpsum)
    ];

    sheet.getRange(newRow, 1, 1, rowData.length).setValues([rowData]);

    // Set LIVE FORMULAS for calculated columns (auto-update when portfolio values change)
    setGoalFormulas(sheet, newRow);

    // Format the new row
    applyDataRowFormatting(sheet, newRow, newRow, 21);

    log(`Goal added: ${goalId} - ${goalData.goalName}`);

    return {
      success: true,
      goalId: goalId,
      message: `Goal "${goalData.goalName}" created successfully!`
    };

  } catch (error) {
    log('Error adding goal: ' + error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Edit existing goal
 */
function editGoal(goalId, goalData) {
  try {
    const sheet = getSheet('Goals');
    if (!sheet) {
      return { success: false, error: 'Goals sheet not found' };
    }

    // Find row with this Goal ID
    const data = sheet.getRange(3, 1, sheet.getLastRow() - 2, 1).getValues();
    let rowIndex = -1;

    for (let i = 0; i < data.length; i++) {
      if (data[i][0] === goalId) {
        rowIndex = i + 3; // +3 because data starts at row 3
        break;
      }
    }

    if (rowIndex === -1) {
      return { success: false, error: 'Goal not found' };
    }

    // goalData.targetAmount from EditGoal form is ALREADY the inflation-adjusted future value
    const inflationAdjustedTarget = goalData.targetAmount;

    // Get original created date (don't change it) - Column L
    const createdDate = sheet.getRange(rowIndex, 12).getValue();

    // Write static columns only (A-F, L-U) — skip formula columns G,H,I,J,K,N
    // A-F: Core goal data
    // IMPORTANT: targetDate must be a local-timezone Date object — UTC dates may not work as sheet dates
    const targetDate = parseSheetDate(goalData.targetDate);
    sheet.getRange(rowIndex, 1, 1, 6).setValues([[
      goalId,                                    // A: Goal ID (unchanged)
      goalData.goalType || '',                   // B: Goal Type
      goalData.goalName || '',                   // C: Goal Name
      goalData.familyMember || 'Self',           // D: Family Member
      inflationAdjustedTarget,                   // E: Target Amount
      targetDate                                 // F: Target Date (local-timezone Date object)
    ]]);

    // L-M: Metadata
    sheet.getRange(rowIndex, 12, 1, 2).setValues([[
      createdDate || new Date(),                 // L: Created Date (keep original)
      goalData.priority || 'Medium'              // M: Priority
    ]]);

    // O-U: Flags and hidden columns
    sheet.getRange(rowIndex, 15, 1, 7).setValues([[
      goalData.isActive !== undefined ? goalData.isActive : true, // O: Is Active
      goalData.notes || '',                      // P: Notes
      goalData.expectedInflation || 0.06,        // Q: Expected Inflation
      goalData.expectedCAGR || 0.12,             // R: Expected CAGR
      goalData.monthlyExpenses || null,          // S: Monthly Expenses
      goalData.emergencyMonths || null,          // T: Emergency Months
      goalData.lumpsumInvested || null           // U: Lumpsum Invested
    ]]);

    // Re-write live formulas for calculated columns (G, H, I, J, K, N)
    // These may need updating if E, F, or R changed
    setGoalFormulas(sheet, rowIndex);

    log(`Goal edited: ${goalId} - ${goalData.goalName}`);

    return {
      success: true,
      message: `Goal "${goalData.goalName}" updated successfully!`
    };

  } catch (error) {
    log('Error editing goal: ' + error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Mark goal as achieved
 */
function markGoalAsAchieved(goalId) {
  try {
    const sheet = getSheet('Goals');
    if (!sheet) {
      return { success: false, error: 'Goals sheet not found' };
    }

    // Find row with this Goal ID
    const data = sheet.getRange(3, 1, sheet.getLastRow() - 2, 18).getValues();
    let rowIndex = -1;
    let goalData = null;

    for (let i = 0; i < data.length; i++) {
      if (data[i][0] === goalId) {
        rowIndex = i + 3;
        goalData = data[i];
        break;
      }
    }

    if (rowIndex === -1) {
      return { success: false, error: 'Goal not found' };
    }

    // Update status to Achieved (overrides formula for this row — intentional)
    sheet.getRange(rowIndex, 14).setValue('Achieved'); // Column N: Status

    log(`Goal marked as achieved: ${goalId}`);

    return {
      success: true,
      goalName: goalData[2],
      currentValue: goalData[8],  // Column I: Current Value (index 8)
      portfolioMappings: getGoalPortfolioMappings(goalId),
      message: 'Goal marked as achieved! 🎉'
    };

  } catch (error) {
    log('Error marking goal as achieved: ' + error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Archive achieved goal (mark as inactive but keep data)
 */
function archiveGoal(goalId) {
  try {
    const sheet = getSheet('Goals');
    if (!sheet) {
      return { success: false, error: 'Goals sheet not found' };
    }

    // Find row with this Goal ID
    const data = sheet.getRange(3, 1, sheet.getLastRow() - 2, 1).getValues();
    let rowIndex = -1;

    for (let i = 0; i < data.length; i++) {
      if (data[i][0] === goalId) {
        rowIndex = i + 3;
        break;
      }
    }

    if (rowIndex === -1) {
      return { success: false, error: 'Goal not found' };
    }

    // Set Is Active to FALSE
    sheet.getRange(rowIndex, 15).setValue(false); // Column O: Is Active

    log(`Goal archived: ${goalId}`);

    return {
      success: true,
      message: 'Goal archived successfully!'
    };

  } catch (error) {
    log('Error archiving goal: ' + error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Delete goal and its mappings
 */
function deleteGoal(goalId) {
  try {
    const sheet = getSheet('Goals');
    if (!sheet) {
      return { success: false, error: 'Goals sheet not found' };
    }

    // Find row with this Goal ID
    const data = sheet.getRange(3, 1, sheet.getLastRow() - 2, 1).getValues();
    let rowIndex = -1;

    for (let i = 0; i < data.length; i++) {
      if (data[i][0] === goalId) {
        rowIndex = i + 3;
        break;
      }
    }

    if (rowIndex === -1) {
      return { success: false, error: 'Goal not found' };
    }

    // Delete the row
    sheet.deleteRow(rowIndex);

    // Also delete any portfolio mappings for this goal
    deleteGoalPortfolioMappings(goalId);

    log(`Goal deleted: ${goalId}`);

    return {
      success: true,
      message: 'Goal deleted successfully!'
    };

  } catch (error) {
    log('Error deleting goal: ' + error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

// ============================================================================
// GOAL PORTFOLIO MAPPING OPERATIONS
// ============================================================================

/**
 * Get goal portfolio mappings.
 * If goalId is provided, returns mappings for that goal only.
 * If goalId is omitted, returns ALL mappings (used by loadAllData and mappings-list route).
 */
function getGoalPortfolioMappings(goalId) {
  const sheet = getSheet('GoalPortfolioMapping');
  if (!sheet || sheet.getLastRow() < 3) {
    return [];
  }

  const numCols = Math.min(sheet.getLastColumn(), 7); // 7 cols if Investment Type exists, else 6
  const data = sheet.getRange(3, 1, sheet.getLastRow() - 2, numCols).getValues();
  const mappings = [];

  data.forEach(row => {
    if (!row[0]) return; // Skip empty rows
    if (goalId && row[1] !== goalId) return; // Filter by goalId if provided

    mappings.push({
      mappingId: row[0],
      goalId: row[1],
      goalName: row[2],
      portfolioId: row[3],
      portfolioName: row[4],
      allocationPct: Math.round((row[5] || 0) * 100), // Convert decimal → integer for React (0.80 → 80)
      investmentType: (numCols >= 7 && row[6]) ? row[6] : 'MF' // Column G, default to MF
    });
  });

  return mappings;
}

/**
 * Infer investment type from ID prefix
 */
function inferInvestmentType(id) {
  if (!id) return 'MF';
  if (id.startsWith('PFL-STK-')) return 'Stock';
  if (id.startsWith('INV-')) return 'Other';
  return 'MF';
}

/**
 * Resolve investment display name by looking up from the correct sheet
 */
function resolveInvestmentName(investmentId, investmentType) {
  try {
    if (investmentType === 'Stock') {
      const portfolios = getAllStockPortfolios();
      const p = portfolios.find(p => p.portfolioId === investmentId);
      return p ? p.portfolioName : investmentId;
    }
    if (investmentType === 'Other') {
      const investments = getAllInvestments();
      const inv = investments.find(i => i.investmentId === investmentId);
      return inv ? inv.investmentName : investmentId;
    }
    // MF portfolio
    const portfolios = getAllPortfolios();
    const p = portfolios.find(p => p.portfolioId === investmentId);
    return p ? p.portfolioName : investmentId;
  } catch (e) {
    return investmentId;
  }
}

/**
 * Map portfolios/investments to goal
 */
function mapPortfoliosToGoal(goalId, portfolioMappings) {
  try {
    const sheet = getSheet('GoalPortfolioMapping');
    if (!sheet) {
      return { success: false, error: 'GoalPortfolioMapping sheet not found' };
    }

    // Validate total allocation doesn't exceed 100%
    const totalAllocation = portfolioMappings.reduce((sum, m) => sum + (m.allocationPct || m.allocationPercent || 0), 0);
    if (totalAllocation > 100) {
      return {
        success: false,
        error: `Total allocation is ${totalAllocation}%, which exceeds 100%. Please adjust.`
      };
    }

    // Delete existing mappings for this goal
    deleteGoalPortfolioMappings(goalId);

    // Get goal name
    const goal = getGoalById(goalId);
    const goalName = goal ? goal.goalName : '';

    // Add new mappings
    portfolioMappings.forEach(mapping => {
      const mappingId = generateMappingId(sheet.getLastRow());
      const type = mapping.investmentType || inferInvestmentType(mapping.portfolioId);
      const name = mapping.portfolioName || resolveInvestmentName(mapping.portfolioId, type);

      const rowData = [
        mappingId,
        goalId,
        goalName,
        mapping.portfolioId,
        name,
        (mapping.allocationPct || mapping.allocationPercent) / 100, // Convert to decimal
        type // Column G: Investment Type (MF/Stock/Other)
      ];

      sheet.appendRow(rowData);

      // Format the new row
      const newRow = sheet.getLastRow();
      applyDataRowFormatting(sheet, newRow, newRow, 7);
    });

    // No need to recalculate — Goals column I has a live SUMPRODUCT formula
    // that auto-updates when GoalPortfolioMapping changes

    log(`Investments mapped to goal: ${goalId}`);

    return {
      success: true,
      message: 'Investments mapped successfully!'
    };

  } catch (error) {
    log('Error mapping investments to goal: ' + error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Delete all portfolio mappings for a goal
 */
function deleteGoalPortfolioMappings(goalId) {
  const sheet = getSheet('GoalPortfolioMapping');
  if (!sheet || sheet.getLastRow() < 3) {
    return;
  }

  const data = sheet.getRange(3, 2, sheet.getLastRow() - 2, 1).getValues(); // Column B: Goal ID
  const rowsToDelete = [];

  for (let i = data.length - 1; i >= 0; i--) {
    if (data[i][0] === goalId) {
      rowsToDelete.push(i + 3); // +3 because data starts at row 3
    }
  }

  // Delete rows in reverse order to avoid index shifting
  rowsToDelete.forEach(rowIndex => {
    sheet.deleteRow(rowIndex);
  });

  log(`Deleted ${rowsToDelete.length} portfolio mappings for goal ${goalId}`);
}

/**
 * Get all portfolios filtered by type (Mutual Funds only) and family members
 */
function getPortfoliosForGoalMapping(selectedFamilyMembers) {
  const sheet = getSheet('AllPortfolios');
  if (!sheet || sheet.getLastRow() < 4) {
    return [];
  }

  const data = sheet.getRange(4, 1, sheet.getLastRow() - 3, 16).getValues();
  const portfolios = [];

  // Get investment accounts to filter by owner
  const investmentAccounts = getAllInvestmentAccounts();

  data.forEach(row => {
    const portfolioId = row[0];
    const portfolioName = row[1];
    const investmentAccountName = row[2];
    const currentValue = row[8]; // Column I
    const status = row[15];

    // Only include Mutual Fund portfolios (PFL-MF-*)
    if (!portfolioId || !portfolioId.startsWith('PFL-MF-') || status !== 'Active') {
      return;
    }

    // Find the owner of this portfolio through investment account
    const account = investmentAccounts.find(a => a.accountName === investmentAccountName);
    if (!account) return;

    const ownerMemberId = account.memberId;
    const ownerMemberName = account.memberName;

    // Check if this portfolio's owner is in selected family members
    if (selectedFamilyMembers.includes(ownerMemberName) || selectedFamilyMembers.includes(ownerMemberId)) {
      portfolios.push({
        portfolioId: portfolioId,
        portfolioName: portfolioName,
        currentValue: currentValue,
        ownerMemberName: ownerMemberName
      });
    }
  });

  return portfolios;
}

// ============================================================================
// CALCULATION FUNCTIONS
// ============================================================================

/**
 * Calculate years to go until target date
 */
function calculateYearsToGo(targetDate) {
  const today = new Date();
  const target = new Date(targetDate);
  const diffTime = Math.abs(target - today);
  const diffYears = diffTime / (1000 * 60 * 60 * 24 * 365.25);
  return Math.max(diffYears, 0.08); // Minimum 1 month to avoid division by zero
}

/**
 * Set live formulas for calculated goal columns (G, H, I, J, K, N)
 * These auto-update when portfolio values change — no triggers needed.
 *
 * Formula chain: Portfolio Sheet → AllPortfolios col I → Goals col I → G,H,J,K,N
 *
 * @param {Sheet} sheet - Goals sheet
 * @param {number} row - Row number to set formulas on
 */
function setGoalFormulas(sheet, row) {
  // I: Current Allocated — SUMPRODUCT across MF, Stock, and Other investments
  // Only includes terms for sheets that actually exist (missing sheet refs cause #REF! that IFERROR can't catch)
  const ss = sheet.getParent();

  // MF term (AllPortfolios) — always exists
  const mfTerm = `SUMPRODUCT((GoalPortfolioMapping!B$3:B$200=A${row})*(GoalPortfolioMapping!G$3:G$200="MF")*GoalPortfolioMapping!F$3:F$200*IFERROR(INDEX(AllPortfolios!I$4:I$200,MATCH(GoalPortfolioMapping!D$3:D$200,AllPortfolios!A$4:A$200,0)),0))`;

  // Stock term — only if StockPortfolios sheet exists
  const hasStocks = !!ss.getSheetByName('StockPortfolios');
  const stockTerm = hasStocks
    ? `+SUMPRODUCT((GoalPortfolioMapping!B$3:B$200=A${row})*(GoalPortfolioMapping!G$3:G$200="Stock")*GoalPortfolioMapping!F$3:F$200*IFERROR(INDEX(StockPortfolios!F$3:F$200,MATCH(GoalPortfolioMapping!D$3:D$200,StockPortfolios!A$3:A$200,0)),0))`
    : '';

  // Other term — only if OtherInvestments sheet exists
  const hasOther = !!ss.getSheetByName('OtherInvestments');
  const otherTerm = hasOther
    ? `+SUMPRODUCT((GoalPortfolioMapping!B$3:B$200=A${row})*(GoalPortfolioMapping!G$3:G$200="Other")*GoalPortfolioMapping!F$3:F$200*IFERROR(INDEX(OtherInvestments!I$3:I$200,MATCH(GoalPortfolioMapping!D$3:D$200,OtherInvestments!A$3:A$200,0)),0))`
    : '';

  const currentAllocatedFormula = `=IFERROR(${mfTerm}${stockTerm}${otherTerm},0)`;

  // J: Gap Amount = Target - Current Allocated
  const gapFormula = `=IF(A${row}="","",MAX(0,E${row}-I${row}))`;

  // K: Progress % = Current Allocated / Target
  const progressFormula = `=IF(OR(A${row}="",E${row}=0),"",MIN(1,I${row}/E${row}))`;

  // G: Monthly SIP Needed — PMT formula using live current allocated
  // Uses monthly compounding: months = time to target, mr = CAGR/12
  // FV of current = I × (1+mr)^months, gap = Target - FV, SIP = PMT(mr, months, 0, gap)
  const sipFormula =
    `=IF(OR(A${row}="",E${row}=0),0,LET(mo,MAX(1,ROUND((F${row}-TODAY())/365.25*12)),mr,R${row}/12,fvI,I${row}*POWER(1+mr,mo),gap,MAX(0,E${row}-fvI),IF(gap<=0,0,-PMT(mr,mo,0,gap))))`;

  // H: Lumpsum Needed = PV of target minus current allocated
  const lumpsumFormula =
    `=IF(OR(A${row}="",E${row}=0),0,MAX(0,E${row}/POWER(1+R${row},MAX(0.08,(F${row}-TODAY())/365.25))-I${row}))`;

  // N: Status — compares actual vs expected progress using time value of money
  // Achieved (>=100%), On Track (>=90% of expected), Behind (>=70%), Critical (<70%)
  const statusFormula =
    `=IF(OR(A${row}="",E${row}=0),"",IF(K${row}>=1,"Achieved",LET(yrs,MAX(0.08,(F${row}-TODAY())/365.25),expected,E${row}/POWER(1+R${row},yrs),ratio,IF(expected<=0,1,I${row}/expected),IF(ratio>=0.9,"On Track",IF(ratio>=0.7,"Behind","Critical")))))`;

  sheet.getRange(row, 9).setFormula(currentAllocatedFormula);   // I
  sheet.getRange(row, 10).setFormula(gapFormula);               // J
  sheet.getRange(row, 11).setFormula(progressFormula);          // K
  sheet.getRange(row, 7).setFormula(sipFormula);                // G
  sheet.getRange(row, 8).setFormula(lumpsumFormula);            // H
  sheet.getRange(row, 14).setFormula(statusFormula);            // N
}

/**
 * Calculate inflation-adjusted target
 */
function calculateInflationAdjustedTarget(targetAmount, inflationRate, yearsToGo) {
  return targetAmount * Math.pow(1 + inflationRate, yearsToGo);
}

/**
 * Calculate monthly SIP needed
 */
function calculateMonthlySIP(futureValue, yearsToGo, expectedCAGR, currentAmount) {
  if (yearsToGo <= 0) return 0;

  const months = yearsToGo * 12;
  const monthlyRate = expectedCAGR / 12;

  // Future value of current amount
  const fvCurrent = currentAmount * Math.pow(1 + monthlyRate, months);

  // Gap to be filled by SIP
  const gap = futureValue - fvCurrent;

  if (gap <= 0) return 0;

  // SIP formula: PMT = Gap * (r / ((1 + r)^n - 1))
  const sipNeeded = gap * (monthlyRate / (Math.pow(1 + monthlyRate, months) - 1));

  return Math.max(Math.round(sipNeeded), 0);
}

/**
 * Calculate lumpsum needed today
 */
function calculateLumpsumNeeded(futureValue, yearsToGo, expectedCAGR, currentAmount) {
  if (yearsToGo <= 0) return futureValue - currentAmount;

  // Present value of future value
  const lumpsumNeeded = (futureValue / Math.pow(1 + expectedCAGR, yearsToGo)) - currentAmount;

  return Math.max(Math.round(lumpsumNeeded), 0);
}

/**
 * Determine goal status based on progress and time remaining
 * Uses proper time value of money calculation considering CAGR
 *
 * @param {number} currentAllocated - Current portfolio value (today's value)
 * @param {number} targetAmount - Future inflated target amount
 * @param {number} yearsToGo - Years remaining to achieve goal
 * @param {number} expectedCAGR - Expected annual return rate (e.g., 0.12 for 12%)
 * @returns {string} - Status: 'Achieved', 'On Track', 'Behind', or 'Critical'
 */
function determineGoalStatus(currentAllocated, targetAmount, yearsToGo, expectedCAGR) {
  // If already achieved
  const progressPercent = currentAllocated / targetAmount;
  if (progressPercent >= 1) {
    return 'Achieved';
  }

  // Calculate expected current value using compound growth
  // If we had started investing optimally from the beginning, what should our current value be?
  // We work backwards: what present value would grow to targetAmount in yearsToGo years?
  // PV = FV / (1 + r)^n
  const expectedCurrentValue = targetAmount / Math.pow(1 + expectedCAGR, yearsToGo);

  // Calculate actual progress vs expected progress
  const actualProgress = currentAllocated;
  const expectedProgress = expectedCurrentValue;

  // Status thresholds based on how close we are to expected value
  const ratio = actualProgress / expectedProgress;

  if (ratio >= 0.9) {
    // Within 10% of expected - On Track
    return 'On Track';
  } else if (ratio >= 0.7) {
    // Within 30% of expected - Behind
    return 'Behind';
  } else {
    // More than 30% behind - Critical
    return 'Critical';
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Parse a date string into a local-timezone Date object for Google Sheets.
 * new Date("YYYY-MM-DD") creates UTC midnight which GAS may not write as a
 * proper sheet date. Using new Date(year, month-1, day) creates local midnight.
 */
function parseSheetDate(dateStr) {
  if (!dateStr) return new Date();
  if (dateStr instanceof Date) return dateStr;
  // Take just YYYY-MM-DD from any format (ISO string, date string, etc.)
  const str = String(dateStr).substring(0, 10);
  const parts = str.split('-');
  if (parts.length === 3) {
    return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  }
  return new Date(dateStr);
}

/**
 * Generate Goal ID
 */
function generateGoalId(lastRow) {
  const count = Math.max(lastRow - 2, 0) + 1;
  return 'GOAL-' + String(count).padStart(3, '0');
}

/**
 * Generate Mapping ID
 */
function generateMappingId(lastRow) {
  const count = Math.max(lastRow - 2, 0) + 1;
  return 'GPM-' + String(count).padStart(3, '0');
}

/**
 * Get goal types for dropdown
 */
function getGoalTypes() {
  return [
    'Retirement',
    'Emergency Fund',
    'Child Education',
    'Child Marriage',
    'House Purchase',
    'Car Purchase',
    'Vacation',
    'Medical Emergency',
    'Debt Repayment',
    'Business Start',
    'Custom'
  ];
}

/**
 * Export withdrawal plan to sheet (update existing or create new)
 * Only maintains ONE row per goal - updates on subsequent exports
 */
function exportWithdrawalPlan(planData) {
  try {
    const ss = getSpreadsheet();
    const sheetName = 'Withdrawal Plans';

    // Get or create sheet
    let sheet = ss.getSheetByName(sheetName);
    let isNewSheet = false;

    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      isNewSheet = true;

      // Setup header row
      const headers = [
        'Goal ID',
        'Goal Name',
        'Strategy',
        'Total Amount',
        'Monthly SWP',
        'SWP Duration',
        'Portfolio Details',
        'Last Updated'
      ];

      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length)
        .setFontWeight('bold')
        .setBackground('#4CAF50')
        .setFontColor('white');

      sheet.setFrozenRows(1);
    }

    // Find existing row for this goal (search by Goal ID in column A)
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    let targetRow = -1;

    for (let i = 1; i < values.length; i++) {
      if (values[i][0] === planData.goalId) {
        targetRow = i + 1; // +1 because sheet rows are 1-indexed
        break;
      }
    }

    // If not found, append new row
    if (targetRow === -1) {
      targetRow = sheet.getLastRow() + 1;
    }

    // Prepare portfolio details text
    let portfolioDetailsText = '';
    planData.portfolioMappings.forEach(mapping => {
      const portfolio = planData.portfolioDetails.find(p => p.portfolioId === mapping.portfolioId);
      if (!portfolio) return;

      const alloc = mapping.allocationPct || mapping.allocationPercent;
      const withdrawalAmount = planData.strategy === 'lumpsum'
        ? planData.totalWithdrawal * alloc
        : planData.swpAmount * alloc;

      portfolioDetailsText += `${portfolio.portfolioName} (${(alloc * 100).toFixed(0)}%): ₹${Math.round(withdrawalAmount).toLocaleString('en-IN')}\n`;

      portfolio.funds.forEach(fund => {
        const portfolioTotalValue = portfolio.funds.reduce((sum, f) => sum + f.currentValue, 0);
        const fundPercentage = fund.currentValue / portfolioTotalValue;
        const fundWithdrawal = withdrawalAmount * fundPercentage;

        portfolioDetailsText += `  - ${fund.fundName}: ₹${Math.round(fundWithdrawal).toLocaleString('en-IN')}\n`;
      });
    });

    // Prepare row data
    const rowData = [
      planData.goalId,
      planData.goalName,
      planData.strategy === 'lumpsum' ? 'Lumpsum' : 'SWP',
      planData.totalWithdrawal,
      planData.strategy === 'swp' ? planData.swpAmount : '-',
      planData.strategy === 'swp' ? planData.swpDuration + ' months' : '-',
      portfolioDetailsText,
      new Date()
    ];

    // Write data to row
    sheet.getRange(targetRow, 1, 1, rowData.length).setValues([rowData]);

    // Format numbers
    sheet.getRange(targetRow, 4).setNumberFormat('₹#,##0');
    if (planData.strategy === 'swp') {
      sheet.getRange(targetRow, 5).setNumberFormat('₹#,##0');
    }
    sheet.getRange(targetRow, 8).setNumberFormat('dd-mmm-yyyy hh:mm');

    // Auto-resize columns
    sheet.autoResizeColumns(1, rowData.length);

    // Set column widths for better readability
    sheet.setColumnWidth(7, 400); // Portfolio Details column wider

    return {
      success: true,
      sheetName: sheetName,
      action: targetRow > sheet.getLastRow() - 1 ? 'created' : 'updated'
    };

  } catch (error) {
    Logger.log('Error exporting withdrawal plan: ' + error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * Show goal withdrawal plan dialog
 */
function showGoalWithdrawalPlanDialog() {
  const html = HtmlService.createHtmlOutputFromFile('GoalWithdrawalPlan')
    .setWidth(700)
    .setHeight(650);
  SpreadsheetApp.getUi().showModalDialog(html, '💸 Goal Withdrawal Planning');
}

// ============================================================================
// END OF GOALS.GS
// ============================================================================
