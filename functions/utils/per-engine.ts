// Pre-Enrolment Review (PER) Risk Flag Engine
// Processes Section A (Course Suitability) and Section B (Early LLND Self-Assessment)
// Generates structured risk flags and narrative summaries
// ALL logic is server-side; NO decision logic in UI layer

// ============================================
// Type Definitions
// ============================================

export interface SectionAResponses {
  A1: string; // Course Selection Motivation
  A2: string; // Provider Selection Rationale
  A3: string; // Academic Progression
  A3_dropdown?: string; // Direct progression / Skill upgrade / Career change
  A4: string; // Expected Employment Outcomes
  A4_dropdown?: string;
  A5: string; // Long-Term Career Goals
  A6: string[]; // Study Commitment checkboxes (all required)
  A7: string; // Study Management Plan
  A8: string; // English Study Background (radio)
  A9: string; // Previous Withdrawal (yes/no)
  A9_explanation?: string;
  // International only
  A10?: string; // Funding Source (radio)
  A10_explanation?: string;
  A11?: string; // Cost of Living (yes/no)
  A11_estimate?: string;
  A12?: string; // Post-Qualification Plans
}

export interface SectionBItem {
  domain: string;
  item_id: string;
  value: number; // 2=Confident, 1=Somewhat, 0=May Need Support
}

export interface SectionBResponses {
  items: SectionBItem[];
}

export interface WordCountThresholds {
  A1_required_min: number;
  A1_low_threshold: number;
  A2_required_min: number;
  A2_low_threshold: number;
  A3_required_min: number;
  A5_required_min: number;
  A7_required_min: number;
  A9_explanation_min: number;
  A10_explanation_min: number;
  A12_required_min: number;
  domain_high_min_percent: number;
  domain_moderate_min_percent: number;
  overall_mns_risk_threshold: number;
  domain_mns_threshold: number;
}

export interface SectionAFlags {
  career_clarity_score: 'Strong' | 'Moderate' | 'Weak';
  course_alignment_score: 'Aligned' | 'Partial' | 'Weak';
  academic_progression_score: 'Strong' | 'Moderate' | 'Weak';
  study_readiness_status: 'Confirmed' | 'Review Required';
  english_preparedness_status: 'Adequate' | 'Review Required';
  financial_preparedness_status: 'Sufficient' | 'Review Required' | null;
  interview_recommended: boolean;
  flags: string[];
  raw_word_counts: Record<string, number>;
}

export interface SectionBDomainResult {
  domain: string;
  confidence_level: 'High' | 'Moderate' | 'Low';
  domain_percentage: number;
  may_need_support_count: number;
  total_items: number;
  support_flag: boolean;
}

export interface SectionBRiskFlags {
  overall_llnd_self_risk: boolean;
  reading_support_flag: boolean;
  writing_support_flag: boolean;
  numeracy_support_flag: boolean;
  learning_support_flag: boolean;
  digital_support_flag: boolean;
  high_digital_risk_flag: boolean;
  total_may_need_support: number;
}

export interface PERReport {
  module: string;
  version: string;
  student_id: string;
  application_id: string;
  rto_id: string;
  submitted_at: string;
  section_a: SectionAFlags;
  section_b: {
    domain_confidence: Record<string, string>;
    risk_flags: SectionBRiskFlags;
    item_counts: Record<string, number>;
    domain_results: SectionBDomainResult[];
  };
  narrative: string;
  admin: {
    decision_status: string;
    decision_notes: string;
    reviewed_by: string | null;
    reviewed_at: string | null;
  };
}

// ============================================
// Default Thresholds
// ============================================

export const DEFAULT_THRESHOLDS: WordCountThresholds = {
  A1_required_min: 120,
  A1_low_threshold: 80,
  A2_required_min: 100,
  A2_low_threshold: 70,
  A3_required_min: 100,
  A5_required_min: 120,
  A7_required_min: 100,
  A9_explanation_min: 80,
  A10_explanation_min: 50,
  A12_required_min: 100,
  domain_high_min_percent: 75,
  domain_moderate_min_percent: 50,
  overall_mns_risk_threshold: 5,
  domain_mns_threshold: 3
};

// ============================================
// Utility Functions
// ============================================

function countWords(text: string): number {
  if (!text || text.trim().length === 0) return 0;
  return text.trim().split(/\s+/).filter(w => w.length > 0).length;
}

function assessResponseDepth(text: string, minWords: number, lowThreshold: number): 'Strong' | 'Moderate' | 'Weak' {
  const wc = countWords(text);
  if (wc >= minWords) return 'Strong';
  if (wc >= lowThreshold) return 'Moderate';
  return 'Weak';
}

// ============================================
// Section A Processing
// ============================================

export function processSectionA(
  responses: SectionAResponses,
  isInternational: boolean,
  thresholds: WordCountThresholds = DEFAULT_THRESHOLDS
): SectionAFlags {
  const flags: string[] = [];
  const rawWordCounts: Record<string, number> = {};

  // Count words for all text fields
  rawWordCounts['A1'] = countWords(responses.A1);
  rawWordCounts['A2'] = countWords(responses.A2);
  rawWordCounts['A3'] = countWords(responses.A3);
  rawWordCounts['A4'] = countWords(responses.A4);
  rawWordCounts['A5'] = countWords(responses.A5);
  rawWordCounts['A7'] = countWords(responses.A7);
  if (responses.A9_explanation) rawWordCounts['A9_explanation'] = countWords(responses.A9_explanation);
  if (responses.A10_explanation) rawWordCounts['A10_explanation'] = countWords(responses.A10_explanation);
  if (responses.A12) rawWordCounts['A12'] = countWords(responses.A12);

  // A1: Career Clarity
  const careerClarity = assessResponseDepth(responses.A1, thresholds.A1_required_min, thresholds.A1_low_threshold);
  if (careerClarity === 'Weak') flags.push('Low Response Depth - Course Motivation');

  // A2: Provider Rationale
  const providerDepth = assessResponseDepth(responses.A2, thresholds.A2_required_min, thresholds.A2_low_threshold);
  if (providerDepth === 'Weak') flags.push('Provider Rationale Weak');

  // A3: Academic Progression
  const progressionDepth = assessResponseDepth(responses.A3, thresholds.A3_required_min, 70);
  let academicProgression: 'Strong' | 'Moderate' | 'Weak' = progressionDepth;
  if (responses.A3_dropdown === 'Career change' && rawWordCounts['A3'] < thresholds.A3_required_min) {
    academicProgression = 'Weak';
    flags.push('Unexplained Career Change');
  }

  // A5: Long-Term Career Goals (feeds into career clarity)
  const goalsDepth = assessResponseDepth(responses.A5, thresholds.A5_required_min, 80);
  // Combine A1 and A5 for overall career clarity
  const combinedCareerClarity = careerClarity === 'Weak' || goalsDepth === 'Weak' ? 'Weak' :
    careerClarity === 'Moderate' || goalsDepth === 'Moderate' ? 'Moderate' : 'Strong';

  // Course alignment (A1 + A3 combined)
  const courseAlignment = careerClarity === 'Weak' || academicProgression === 'Weak' ? 'Weak' :
    careerClarity === 'Moderate' || academicProgression === 'Moderate' ? 'Partial' : 'Aligned';

  // A6: Study Commitment
  const allCommitmentChecked = responses.A6 && responses.A6.length >= 4;
  const studyReadiness = allCommitmentChecked ? 'Confirmed' as const : 'Review Required' as const;
  if (!allCommitmentChecked) flags.push('Study Commitment Incomplete');

  // A7: Study Management Plan
  const planDepth = assessResponseDepth(responses.A7, thresholds.A7_required_min, 70);
  if (planDepth === 'Weak') flags.push('No Realistic Study Plan');

  // A8: English Preparedness
  const englishPrep = responses.A8 === 'No prior English' ? 'Review Required' as const : 'Adequate' as const;
  if (englishPrep === 'Review Required') flags.push('Limited English Background');

  // A9: Previous Withdrawal
  if (responses.A9 === 'yes') {
    if (!responses.A9_explanation || countWords(responses.A9_explanation) < thresholds.A9_explanation_min) {
      flags.push('Previous Withdrawal - Insufficient Explanation');
    }
  }

  // International-specific flags
  let financialPreparedness: 'Sufficient' | 'Review Required' | null = null;
  if (isInternational) {
    // A10: Funding Source
    if (!responses.A10 || responses.A10 === '') {
      financialPreparedness = 'Review Required';
      flags.push('Funding Source Not Specified');
    } else {
      financialPreparedness = 'Sufficient';
    }

    // A11: Cost of Living
    if (responses.A11 === 'no' || !responses.A11) {
      financialPreparedness = 'Review Required';
      flags.push('Cost of Living Awareness Gap');
    }

    // A12: Post-Qualification Plans
    if (responses.A12 && countWords(responses.A12) < thresholds.A12_required_min) {
      flags.push('Weak Post-Qualification Plans');
    }
  }

  // Interview recommendation logic
  const interviewRecommended =
    combinedCareerClarity === 'Weak' ||
    academicProgression === 'Weak' ||
    financialPreparedness === 'Review Required' ||
    flags.length >= 3;

  if (interviewRecommended) flags.push('Interview Recommended');

  return {
    career_clarity_score: combinedCareerClarity,
    course_alignment_score: courseAlignment,
    academic_progression_score: academicProgression,
    study_readiness_status: studyReadiness,
    english_preparedness_status: englishPrep,
    financial_preparedness_status: financialPreparedness,
    interview_recommended: interviewRecommended,
    flags,
    raw_word_counts: rawWordCounts
  };
}

// ============================================
// Section B Processing
// ============================================

export function processSectionB(
  responses: SectionBResponses,
  thresholds: WordCountThresholds = DEFAULT_THRESHOLDS
): { domainResults: SectionBDomainResult[]; riskFlags: SectionBRiskFlags } {
  const domains = ['Reading', 'Writing', 'Numeracy', 'Learning', 'Digital'];
  const domainResults: SectionBDomainResult[] = [];
  let totalMNS = 0;

  const domainMNSCounts: Record<string, number> = {};

  for (const domain of domains) {
    const domainItems = responses.items.filter(i => i.domain === domain);
    const totalItems = domainItems.length;
    const totalScore = domainItems.reduce((sum, i) => sum + i.value, 0);
    const maxScore = totalItems * 2; // max value per item is 2
    const percentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;
    const mnsCount = domainItems.filter(i => i.value === 0).length;

    totalMNS += mnsCount;
    domainMNSCounts[domain] = mnsCount;

    let confidenceLevel: 'High' | 'Moderate' | 'Low';
    if (percentage >= thresholds.domain_high_min_percent) {
      confidenceLevel = 'High';
    } else if (percentage >= thresholds.domain_moderate_min_percent) {
      confidenceLevel = 'Moderate';
    } else {
      confidenceLevel = 'Low';
    }

    domainResults.push({
      domain,
      confidence_level: confidenceLevel,
      domain_percentage: Math.round(percentage * 10) / 10,
      may_need_support_count: mnsCount,
      total_items: totalItems,
      support_flag: percentage < thresholds.domain_moderate_min_percent
    });
  }

  // Check for high digital risk (upload AND virtual class both = 0)
  const uploadItem = responses.items.find(i => i.item_id === 'B5_upload' || i.item_id === 'B5_4');
  const virtualClassItem = responses.items.find(i => i.item_id === 'B5_virtual' || i.item_id === 'B5_3');
  const highDigitalRisk = (uploadItem?.value === 0) && (virtualClassItem?.value === 0);

  // Overall LLND risk
  const overallRisk = totalMNS >= thresholds.overall_mns_risk_threshold ||
    domains.some(d => (domainMNSCounts[d] || 0) >= thresholds.domain_mns_threshold);

  const riskFlags: SectionBRiskFlags = {
    overall_llnd_self_risk: overallRisk,
    reading_support_flag: domainResults.find(d => d.domain === 'Reading')?.support_flag || false,
    writing_support_flag: domainResults.find(d => d.domain === 'Writing')?.support_flag || false,
    numeracy_support_flag: domainResults.find(d => d.domain === 'Numeracy')?.support_flag || false,
    learning_support_flag: domainResults.find(d => d.domain === 'Learning')?.support_flag || false,
    digital_support_flag: domainResults.find(d => d.domain === 'Digital')?.support_flag || false,
    high_digital_risk_flag: highDigitalRisk,
    total_may_need_support: totalMNS
  };

  return { domainResults, riskFlags };
}

// ============================================
// Narrative Template Library
// Pre-approved templates only - NO dynamic AI text
// ============================================

const NARRATIVE_TEMPLATES = {
  career_clarity: {
    Weak: 'The student\'s responses indicate limited clarity regarding how the course aligns with their stated career goals. Further discussion is recommended to confirm suitability.',
    Moderate: 'The student has outlined career intentions; however, further clarification may assist in confirming alignment with the selected qualification.',
    Strong: 'The student has demonstrated clear and structured alignment between their career goals and the selected qualification.'
  },
  academic_progression: {
    Weak: 'The progression between previous study/work experience and the selected course requires further review to confirm suitability.',
    Moderate: 'The student shows some progression alignment, though additional context may strengthen the suitability evidence.',
    Strong: 'The selected course demonstrates logical progression from the student\'s previous study or work background.'
  },
  digital_risk: {
    high: 'The student has indicated limited confidence in core digital learning tasks, including online participation and assignment submission. Immediate LMS orientation support is recommended.',
    support: 'The student may benefit from additional digital learning support during course commencement.'
  },
  overall_llnd_risk: {
    true: 'Based on the student\'s self-assessment responses, early LLND support may be required. A structured LLND benchmark assessment during orientation is recommended.',
    false: 'The student\'s self-assessment responses indicate adequate confidence across core skill areas.'
  },
  interview: {
    true: 'An enrolment interview is recommended to confirm readiness and support planning.',
    false: ''
  }
};

export function generateNarrative(
  sectionAFlags: SectionAFlags,
  riskFlags: SectionBRiskFlags,
  domainResults: SectionBDomainResult[]
): string {
  const parts: string[] = [];

  // Career clarity narrative
  parts.push(NARRATIVE_TEMPLATES.career_clarity[sectionAFlags.career_clarity_score]);

  // Academic progression
  parts.push(NARRATIVE_TEMPLATES.academic_progression[sectionAFlags.academic_progression_score]);

  // Digital risk
  if (riskFlags.high_digital_risk_flag) {
    parts.push(NARRATIVE_TEMPLATES.digital_risk.high);
  } else if (riskFlags.digital_support_flag) {
    parts.push(NARRATIVE_TEMPLATES.digital_risk.support);
  }

  // Overall LLND risk
  parts.push(NARRATIVE_TEMPLATES.overall_llnd_risk[riskFlags.overall_llnd_self_risk ? 'true' : 'false']);

  // Domain-specific support flags
  const supportDomains = domainResults.filter(d => d.support_flag).map(d => d.domain);
  if (supportDomains.length > 0) {
    parts.push(`Potential support needs identified in: ${supportDomains.join(', ')}.`);
  }

  // Interview recommendation
  if (sectionAFlags.interview_recommended) {
    parts.push(NARRATIVE_TEMPLATES.interview.true);
  }

  return parts.filter(p => p.length > 0).join(' ');
}

// ============================================
// Full PER Report Generator
// ============================================

export function generatePERReport(
  sectionAFlags: SectionAFlags,
  sectionBResults: { domainResults: SectionBDomainResult[]; riskFlags: SectionBRiskFlags },
  studentId: string,
  applicationId: string,
  rtoId: string
): PERReport {
  const narrative = generateNarrative(sectionAFlags, sectionBResults.riskFlags, sectionBResults.domainResults);

  const domainConfidence: Record<string, string> = {};
  const itemCounts: Record<string, number> = {
    total_may_need_support: sectionBResults.riskFlags.total_may_need_support
  };

  for (const dr of sectionBResults.domainResults) {
    domainConfidence[dr.domain.toLowerCase()] = dr.confidence_level;
    itemCounts[`${dr.domain.toLowerCase()}_mns`] = dr.may_need_support_count;
  }

  return {
    module: 'pre_enrolment_review',
    version: '2.0',
    student_id: studentId,
    application_id: applicationId,
    rto_id: rtoId,
    submitted_at: new Date().toISOString(),
    section_a: sectionAFlags,
    section_b: {
      domain_confidence: domainConfidence,
      risk_flags: sectionBResults.riskFlags,
      item_counts: itemCounts,
      domain_results: sectionBResults.domainResults
    },
    narrative,
    admin: {
      decision_status: 'Pending',
      decision_notes: '',
      reviewed_by: null,
      reviewed_at: null
    }
  };
}
