interface ACSFOutcome {
    level: number;
    indicator: 'support_required' | 'borderline' | 'competent';
    recommendation: string;
  }
  
  const ACSF_THRESHOLDS = {
    LEVEL_1: 0.20, // 0-20%
    LEVEL_2: 0.40, // 21-40%
    LEVEL_3: 0.60, // 41-60% (Common target for Cert III)
    LEVEL_4: 0.80  // 61-80%
    // 81%+ is Level 5
  };
  
  export function calculateACSFOutcome(score: number, maxScore: number, domain: string): ACSFOutcome {
    if (maxScore === 0) return { level: 0, indicator: 'support_required', recommendation: 'Insufficient data' };
  
    const percentage = score / maxScore;
    let level = 0;
  
    if (percentage <= ACSF_THRESHOLDS.LEVEL_1) level = 1;
    else if (percentage <= ACSF_THRESHOLDS.LEVEL_2) level = 2;
    else if (percentage <= ACSF_THRESHOLDS.LEVEL_3) level = 3;
    else if (percentage <= ACSF_THRESHOLDS.LEVEL_4) level = 4;
    else level = 5;
  
    const targetLevel = 3; 
    let indicator: ACSFOutcome['indicator'] = 'competent';
    let recommendation = 'Learner demonstrates competence at this level.';
  
    if (level < targetLevel) {
      indicator = 'support_required';
      recommendation = `Gap identified in ${domain}. OS25-aligned support recommended: targeted literacy intervention required.`;
    } else if (level === targetLevel && percentage < (ACSF_THRESHOLDS.LEVEL_3 + 0.05)) {
      indicator = 'borderline';
      recommendation = `Borderline result in ${domain}. Monitor progress during initial training modules.`;
    }
  
    return { level, indicator, recommendation };
  }