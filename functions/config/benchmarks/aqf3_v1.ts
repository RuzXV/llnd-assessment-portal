// AQF3 Benchmark Configuration v1
// Used for scoring and report generation

export const AQF3_V1_BENCHMARK = {
  version: 'AQF3_V1',
  name: 'AQF 3 Universal LLND Assessment',
  description: 'Benchmark for Certificate III Health & Community Services context',

  // Domain weights for overall score calculation
  domainWeights: {
    Reading: 0.29,
    Writing: 0.14,
    Numeracy: 0.29,
    Oral: 0.14,
    Digital: 0.14
  },

  // Per-question weights based on domain
  questionWeights: {
    Reading: 3.625,    // 29% / 8 questions
    Writing: 3.5,      // 14% / 4 questions
    Numeracy: 3.625,   // 29% / 8 questions
    Oral: 3.5,         // 14% / 4 questions
    Digital: 3.5       // 14% / 4 questions
  },

  // Domain outcome thresholds (as percentages)
  domainThresholds: {
    meetsExpected: 75,   // >= 75% = Meets expected
    monitor: 60,         // >= 60% and < 75% = Monitor
    supportRequired: 0   // < 60% = Support required
  },

  // ACSF band inference thresholds
  acsfThresholds: {
    acsf3CoreMeets: 70,      // ACSF3 core items >= 70%
    acsf3StretchMeets: 50,   // ACSF3 stretch items >= 50%
    acsf2Meets: 70,          // ACSF2 items >= 70%
    acsf2Fail: 60            // ACSF2 items < 60% = Below ACSF 2
  },

  // Safety rules - these domains trigger overall support_required if they fail
  safetyRules: {
    criticalDomains: ['Reading', 'Numeracy'],
    criticalFailThreshold: 60  // If < 60% in critical domain, overall = support_required
  },

  // Writing rubric configuration
  writingRubric: {
    maxScore: 3,
    acsf2MinWords: 8,
    acsf3MinWords: 20,
    causeWords: ['because', 'due to', 'as', 'since', 'reason'],
    impactWords: ['affected', 'delayed', 'could not', 'resulted in', 'so that', 'impact', 'consequence'],
    requestWords: ['please', 'can you', 'could you', 'clarify', 'confirm', 'would you']
  },

  // Numeric tolerance for numeric questions
  numericTolerance: 0.01
};

// Domain outcome determination
export function getDomainOutcome(percentage: number): 'meets_expected' | 'monitor' | 'support_required' {
  const thresholds = AQF3_V1_BENCHMARK.domainThresholds;
  if (percentage >= thresholds.meetsExpected) return 'meets_expected';
  if (percentage >= thresholds.monitor) return 'monitor';
  return 'support_required';
}

// ACSF band inference
export function getEstimatedACSFBand(
  acsf2Percent: number,
  acsf3CorePercent: number,
  acsf3StretchPercent: number
): string {
  const t = AQF3_V1_BENCHMARK.acsfThresholds;

  if (acsf3CorePercent >= t.acsf3CoreMeets && acsf3StretchPercent >= t.acsf3StretchMeets) {
    return 'ACSF 3 (confident)';
  }
  if (acsf3CorePercent >= t.acsf3CoreMeets && acsf3StretchPercent < t.acsf3StretchMeets) {
    return 'ACSF 3 (monitor)';
  }
  if (acsf2Percent >= t.acsf2Meets && acsf3CorePercent < 60) {
    return 'ACSF 2-3 (borderline)';
  }
  if (acsf2Percent < t.acsf2Fail) {
    return 'Below ACSF 2';
  }
  return 'ACSF 2-3 (borderline)';
}

// Overall outcome determination with safety rules
export function getOverallOutcome(
  domainOutcomes: Record<string, string>,
  stretchMostlyMeets: boolean
): 'meets_confident' | 'meets_monitor' | 'support_required' {
  const criticalDomains = AQF3_V1_BENCHMARK.safetyRules.criticalDomains;

  // Safety rule: if critical domains have support_required, overall is support_required
  for (const domain of criticalDomains) {
    if (domainOutcomes[domain] === 'support_required') {
      return 'support_required';
    }
  }

  // Check if any domain needs support
  const hasSupport = Object.values(domainOutcomes).includes('support_required');
  if (hasSupport) return 'support_required';

  // Check if all domains meet expected
  const allMeet = Object.values(domainOutcomes).every(o => o === 'meets_expected');
  if (allMeet && stretchMostlyMeets) return 'meets_confident';

  return 'meets_monitor';
}

// Justification templates per domain and outcome
export const JUSTIFICATION_TEMPLATES: Record<string, Record<string, string>> = {
  Reading: {
    meets_expected: 'The learner demonstrates solid reading comprehension skills at the expected level for AQF 3 qualifications. They can interpret workplace documents, follow multi-step procedures, and identify key information from various text types.',
    monitor: 'The learner shows developing reading skills but may benefit from additional scaffolding when engaging with complex workplace texts. Early monitoring during initial training modules is recommended.',
    support_required: 'Gap identified in Reading. The learner requires targeted literacy intervention to build foundational comprehension skills before engaging with complex training materials. OS25-aligned support is recommended.'
  },
  Writing: {
    meets_expected: 'The learner demonstrates functional writing skills appropriate for AQF 3 requirements. They can produce clear explanations, confirmations, and requests relevant to workplace contexts.',
    monitor: 'The learner shows emerging writing skills but may need support with structuring longer responses or expressing cause-and-effect relationships clearly.',
    support_required: 'Gap identified in Writing. The learner requires targeted literacy support to develop workplace writing skills. Consider providing templates and guided practice activities.'
  },
  Numeracy: {
    meets_expected: 'The learner demonstrates competent numeracy skills at the expected level. They can perform calculations, interpret data, and apply mathematical reasoning to workplace scenarios.',
    monitor: 'The learner shows functional numeracy skills but may benefit from additional practice with multi-step calculations or percentage-based problems.',
    support_required: 'Gap identified in Numeracy. The learner requires targeted numeracy intervention, particularly in time calculations, percentages, or data interpretation. OS25-aligned support is recommended.'
  },
  Oral: {
    meets_expected: 'The learner demonstrates effective oral communication comprehension skills. They can follow spoken instructions, identify key messages, and determine appropriate responses in workplace scenarios.',
    monitor: 'The learner shows adequate oral communication skills but may benefit from practice with clarification techniques and prioritisation in dynamic situations.',
    support_required: 'Gap identified in Oral Communication. The learner may need support with understanding spoken instructions and formulating appropriate responses. Consider paired practice activities.'
  },
  Digital: {
    meets_expected: 'The learner demonstrates competent digital literacy skills. They understand basic digital workflows, file management, and digital safety practices required in modern workplaces.',
    monitor: 'The learner shows developing digital skills but may benefit from additional orientation to workplace digital systems and security practices.',
    support_required: 'Gap identified in Digital Literacy. The learner requires foundational digital skills training before engaging with workplace technology systems.'
  }
};

// Support strategies per domain and outcome
export const SUPPORT_STRATEGIES: Record<string, Record<string, string[]>> = {
  Reading: {
    meets_expected: ['Continue with standard training delivery', 'Provide extension reading materials if interested'],
    monitor: ['Pre-teach key vocabulary before each unit', 'Provide reading guides and glossaries', 'Check comprehension regularly during training'],
    support_required: ['Implement 1:1 or small group literacy support', 'Use simplified texts initially with gradual complexity increase', 'Provide visual aids and graphic organisers', 'Schedule regular progress reviews']
  },
  Writing: {
    meets_expected: ['Continue with standard assessment tasks', 'Encourage reflective writing practice'],
    monitor: ['Provide writing templates and scaffolds', 'Offer formative feedback on drafts', 'Use sentence starters for complex responses'],
    support_required: ['Implement structured writing support program', 'Provide extensive modelling and templates', 'Consider alternative demonstration methods initially', 'Build writing skills progressively']
  },
  Numeracy: {
    meets_expected: ['Continue with standard numeracy requirements', 'Provide calculator access as standard'],
    monitor: ['Pre-teach mathematical concepts before application', 'Provide step-by-step worked examples', 'Allow additional time for numeracy-based tasks'],
    support_required: ['Implement targeted numeracy intervention', 'Use concrete materials and visual representations', 'Break multi-step problems into smaller components', 'Provide extensive practice opportunities']
  },
  Oral: {
    meets_expected: ['Continue with standard verbal instruction methods', 'Include group discussion activities'],
    monitor: ['Repeat and rephrase key instructions', 'Check understanding before proceeding', 'Encourage questions and clarification'],
    support_required: ['Provide written backup for all verbal instructions', 'Use visual aids to support spoken content', 'Allow processing time after instructions', 'Practice clarification techniques']
  },
  Digital: {
    meets_expected: ['Continue with standard digital tool requirements', 'Introduce advanced features progressively'],
    monitor: ['Provide step-by-step digital guides', 'Offer additional practice time with systems', 'Pair with confident digital user initially'],
    support_required: ['Implement basic digital skills orientation', 'Provide extensive hands-on practice', 'Use simplified interfaces where possible', 'Consider alternative submission methods initially']
  }
};
