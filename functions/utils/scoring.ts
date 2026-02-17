// Universal LLND Scoring Engine
// Config-driven: supports AQF 3, 4, 5, 6, 8-9 via benchmark_config
// Replaces the previous AQF3-only hardcoded engine

import {
  BenchmarkConfig,
  CLASSIFICATION_LABELS,
  AQF_LEVEL_NAMES,
  FALLBACK_CONFIGS
} from '../config/benchmarks/benchmark-config';

// ============================================
// Type Definitions
// ============================================

export interface Question {
  question_id: string;
  domain: string;
  acsf_level: number;
  difficulty_tag: string;
  response_type: string;
  correct_response: string | null;
  max_score: number;
  weight: number;
}

export interface StudentResponse {
  questionId: string;
  answer: string;
}

export interface QuestionScore {
  questionId: string;
  domain: string;
  acsfLevel: number;
  difficultyTag: string;
  responseType: string;
  scoreAwarded: number;
  maxScore: number;
  isCorrect: boolean;
}

export interface DomainScore {
  domain: string;
  rawScore: number;
  maxScore: number;
  percentage: number;
  weightedContribution: number;
  acsf2Percent: number;
  acsf3CorePercent: number;
  acsf3StretchPercent: number;
  estimatedACSFBand: string;
  outcome: string;
  riskFlag: boolean;
  riskFlagDetail: string;
  justification: string;
  strategies: string[];
}

export interface RiskFlag {
  domain: string;
  detail: string;
  threshold: number;
  actual: number;
}

export interface ScoringResult {
  totalScore: number;
  overallOutcome: string;
  overallClassification: string;
  overrideTriggered: boolean;
  riskFlags: RiskFlag[];
  domainScores: DomainScore[];
  questionScores: QuestionScore[];
  benchmarkVersion: string;
  aqfLevel: string;
}

// ============================================
// Question Scoring Functions
// ============================================

function scoreObjectiveQuestion(
  question: Question,
  answer: string
): { score: number; isCorrect: boolean } {
  if (!answer || !question.correct_response) {
    return { score: 0, isCorrect: false };
  }

  const normalizedAnswer = String(answer).trim().toLowerCase();
  const normalizedCorrect = String(question.correct_response).trim().toLowerCase();

  if (question.response_type === 'numeric') {
    const answerNum = parseFloat(normalizedAnswer);
    const correctNum = parseFloat(normalizedCorrect);
    if (isNaN(answerNum) || isNaN(correctNum)) {
      return { score: 0, isCorrect: false };
    }
    const isCorrect = Math.abs(answerNum - correctNum) <= 0.01;
    return { score: isCorrect ? question.max_score : 0, isCorrect };
  }

  const isCorrect = normalizedAnswer === normalizedCorrect;
  return { score: isCorrect ? question.max_score : 0, isCorrect };
}

function scoreWritingQuestion(
  question: Question,
  answer: string,
  config: BenchmarkConfig
): { score: number; isCorrect: boolean } {
  if (!answer || answer.trim().length === 0) {
    return { score: 0, isCorrect: false };
  }

  const text = answer.trim().toLowerCase();
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const wordCount = words.length;
  const scaleMax = config.writingScaleMax;

  // Minimum word counts based on ACSF level
  const minWords = question.acsf_level <= 2 ? 8 : 20;

  // Check for sentence structure
  const hasSentenceStructure = text.includes('.') || text.includes('\n') ||
    /\b(and|but|so|then|because|however|therefore|furthermore)\b/.test(text);

  // Check for reasoning indicators (important for AQF 4+)
  const hasReasoningIndicators = /\b(because|due to|as a result|therefore|consequently|since|thus|hence)\b/.test(text);

  // Check for analytical depth (important for AQF 6+)
  const hasAnalyticalDepth = /\b(analysis|evaluate|assess|compare|contrast|evidence|demonstrates|indicates|suggests)\b/.test(text);

  // Check for cause/impact language
  const hasCauseIndicator = /\b(because|due to|as|since|reason|cause)\b/.test(text);
  const hasImpactIndicator = /\b(affected|delayed|could not|resulted in|so that|impact|consequence|outcome)\b/.test(text);

  // Check for request language
  const hasRequestIndicator = /\b(please|can you|could you|clarify|confirm|would you)\b/.test(text);

  // Dynamic scoring based on writing scale max
  let score = 0;

  if (wordCount < 3) {
    score = 0; // No meaningful response
  } else if (wordCount < minWords) {
    score = 1; // Limited clarity
  } else if (hasSentenceStructure) {
    score = 2; // Basic structure

    // Score 3: Clear, structured (available at all AQF levels)
    if (scaleMax >= 3) {
      if (hasCauseIndicator || hasRequestIndicator || wordCount >= minWords * 1.5) {
        score = 3;
      }
    }

    // Score 4: Well-structured with reasoning (AQF 4+)
    if (scaleMax >= 4 && score >= 3) {
      if (hasReasoningIndicators && wordCount >= minWords * 1.5) {
        score = 4;
      }
    }

    // Score 5: Structured argument with analysis (AQF 6+)
    if (scaleMax >= 5 && score >= 4) {
      if (hasAnalyticalDepth && hasCauseIndicator && hasImpactIndicator) {
        score = 5;
      }
    }

    // Score 6: Analytical, synthesised, professional (AQF 8-9)
    if (scaleMax >= 6 && score >= 5) {
      if (hasAnalyticalDepth && hasReasoningIndicators && wordCount >= minWords * 2.5) {
        score = 6;
      }
    }
  }

  // Cap at max_score for the question
  score = Math.min(score, question.max_score);

  return { score, isCorrect: score === question.max_score };
}

// ============================================
// ACSF Band Inference
// ============================================

function getEstimatedACSFBand(
  acsf2Percent: number,
  acsf3CorePercent: number,
  acsf3StretchPercent: number,
  config: BenchmarkConfig
): string {
  const t = config.acsfConfig;

  if (acsf3CorePercent >= t.coreMeets && acsf3StretchPercent >= t.stretchMeets) {
    return 'ACSF 3 (confident)';
  }
  if (acsf3CorePercent >= t.coreMeets && acsf3StretchPercent < t.stretchMeets) {
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

// ============================================
// Domain Outcome Classification (4-band)
// ============================================

function getDomainOutcome(
  percentage: number,
  config: BenchmarkConfig
): string {
  if (percentage >= config.thresholds.strong) return 'exceeds';
  if (percentage >= config.thresholds.meets) return 'meets_expected';
  if (percentage >= config.thresholds.monitor) return 'monitor';
  return 'support_required';
}

// ============================================
// Override Logic Engine
// ============================================

interface OverrideResult {
  triggered: boolean;
  forcedOutcome: string | null;
  maxClassification: string | null;
}

function evaluateOverrides(
  domainPercentages: Record<string, number>,
  config: BenchmarkConfig
): OverrideResult {
  const result: OverrideResult = {
    triggered: false,
    forcedOutcome: null,
    maxClassification: null
  };

  const rules = config.overrideRules;
  if (!rules || !rules.auto_support) return result;

  // Evaluate auto_support rules (force "support_required")
  for (const rule of rules.auto_support) {
    let triggered = false;

    if (rule.condition === 'OR' && rule.rules) {
      // ANY domain below threshold triggers
      triggered = rule.rules.some(r => (domainPercentages[r.domain] || 0) < r.threshold);
    } else if (rule.condition === 'AND' && rule.rules) {
      // ALL domains below threshold triggers
      triggered = rule.rules.every(r => (domainPercentages[r.domain] || 0) < r.threshold);
    } else if (rule.condition === 'SINGLE' && rule.rules) {
      // Single domain below threshold
      triggered = rule.rules.some(r => (domainPercentages[r.domain] || 0) < r.threshold);
    } else if (rule.condition === 'ANY_2_CORE' && rule.core_domains && rule.threshold) {
      // Any 2 of the core domains below threshold
      const belowCount = rule.core_domains.filter(
        d => (domainPercentages[d] || 0) < rule.threshold
      ).length;
      triggered = belowCount >= 2;
    }

    if (triggered) {
      result.triggered = true;
      result.forcedOutcome = 'support_required';
      return result;
    }
  }

  // Evaluate monitor_cap rules (cap classification at "monitor")
  if (rules.monitor_cap) {
    for (const cap of rules.monitor_cap) {
      if (cap.condition === 'single_below' && cap.domain) {
        if ((domainPercentages[cap.domain] || 0) < cap.threshold) {
          result.maxClassification = 'monitor';
        }
      } else if (cap.condition === 'multi_below' && cap.count) {
        const domains = Object.keys(domainPercentages);
        const belowCount = domains.filter(d => domainPercentages[d] < cap.threshold).length;
        if (belowCount >= cap.count) {
          result.maxClassification = 'monitor';
        }
      }
    }
  }

  return result;
}

// ============================================
// Risk Flag Evaluation
// ============================================

function evaluateRiskFlags(
  domainPercentages: Record<string, number>,
  config: BenchmarkConfig
): RiskFlag[] {
  const flags: RiskFlag[] = [];

  for (const [domain, threshold] of Object.entries(config.riskThresholds)) {
    const actual = domainPercentages[domain] || 0;
    if (actual < threshold) {
      flags.push({
        domain,
        detail: `${domain} borderline`,
        threshold,
        actual: Math.round(actual * 10) / 10
      });
    }
  }

  return flags;
}

// ============================================
// Overall Outcome Determination
// ============================================

function determineOverallOutcome(
  totalScore: number,
  domainPercentages: Record<string, number>,
  config: BenchmarkConfig
): { outcome: string; classification: string; overrideTriggered: boolean } {
  // Step 1: Evaluate override rules
  const overrideResult = evaluateOverrides(domainPercentages, config);

  if (overrideResult.forcedOutcome) {
    const labels = CLASSIFICATION_LABELS[config.aqfLevel] || CLASSIFICATION_LABELS['3'];
    return {
      outcome: overrideResult.forcedOutcome,
      classification: labels[overrideResult.forcedOutcome] || 'Support Required',
      overrideTriggered: true
    };
  }

  // Step 2: Determine classification from overall score
  let outcome: string;
  if (totalScore >= config.thresholds.strong) {
    outcome = 'exceeds';
  } else if (totalScore >= config.thresholds.meets) {
    outcome = 'meets';
  } else if (totalScore >= config.thresholds.monitor) {
    outcome = 'monitor';
  } else {
    outcome = 'support_required';
  }

  // Step 3: Apply monitor cap if needed
  if (overrideResult.maxClassification === 'monitor') {
    const outcomeRank: Record<string, number> = { exceeds: 3, meets: 2, monitor: 1, support_required: 0 };
    if ((outcomeRank[outcome] || 0) > (outcomeRank['monitor'] || 0)) {
      outcome = 'monitor';
    }
  }

  const labels = CLASSIFICATION_LABELS[config.aqfLevel] || CLASSIFICATION_LABELS['3'];
  return {
    outcome,
    classification: labels[outcome] || outcome,
    overrideTriggered: false
  };
}

// ============================================
// Justification & Strategy Templates (All AQF Levels)
// ============================================

const JUSTIFICATION_TEMPLATES: Record<string, Record<string, Record<string, string>>> = {
  '3': {
    Reading: {
      exceeds: 'The learner demonstrates strong reading comprehension skills exceeding the expected level for AQF 3 qualifications.',
      meets_expected: 'The learner demonstrates solid reading comprehension skills at the expected level for AQF 3 qualifications. They can interpret workplace documents, follow multi-step procedures, and identify key information from various text types.',
      monitor: 'The learner shows developing reading skills but may benefit from additional scaffolding when engaging with complex workplace texts. Early monitoring during initial training modules is recommended.',
      support_required: 'Gap identified in Reading. The learner requires targeted literacy intervention to build foundational comprehension skills before engaging with complex training materials. OS25-aligned support is recommended.'
    },
    Writing: {
      exceeds: 'The learner demonstrates strong writing skills exceeding AQF 3 expectations.',
      meets_expected: 'The learner demonstrates functional writing skills appropriate for AQF 3 requirements. They can produce clear explanations, confirmations, and requests relevant to workplace contexts.',
      monitor: 'The learner shows emerging writing skills but may need support with structuring longer responses or expressing cause-and-effect relationships clearly.',
      support_required: 'Gap identified in Writing. The learner requires targeted literacy support to develop workplace writing skills. Consider providing templates and guided practice activities.'
    },
    Numeracy: {
      exceeds: 'The learner demonstrates strong numeracy skills exceeding AQF 3 expectations.',
      meets_expected: 'The learner demonstrates competent numeracy skills at the expected level. They can perform calculations, interpret data, and apply mathematical reasoning to workplace scenarios.',
      monitor: 'The learner shows functional numeracy skills but may benefit from additional practice with multi-step calculations or percentage-based problems.',
      support_required: 'Gap identified in Numeracy. The learner requires targeted numeracy intervention, particularly in time calculations, percentages, or data interpretation. OS25-aligned support is recommended.'
    },
    Oral: {
      exceeds: 'The learner demonstrates strong oral communication skills exceeding AQF 3 expectations.',
      meets_expected: 'The learner demonstrates effective oral communication comprehension skills. They can follow spoken instructions, identify key messages, and determine appropriate responses in workplace scenarios.',
      monitor: 'The learner shows adequate oral communication skills but may benefit from practice with clarification techniques and prioritisation in dynamic situations.',
      support_required: 'Gap identified in Oral Communication. The learner may need support with understanding spoken instructions and formulating appropriate responses. Consider paired practice activities.'
    },
    Digital: {
      exceeds: 'The learner demonstrates strong digital literacy skills exceeding AQF 3 expectations.',
      meets_expected: 'The learner demonstrates competent digital literacy skills. They understand basic digital workflows, file management, and digital safety practices required in modern workplaces.',
      monitor: 'The learner shows developing digital skills but may benefit from additional orientation to workplace digital systems and security practices.',
      support_required: 'Gap identified in Digital Literacy. The learner requires foundational digital skills training before engaging with workplace technology systems.'
    }
  },
  '4': {
    Reading: {
      exceeds: 'The learner demonstrates strong reading comprehension at the Certificate IV level, confidently interpreting complex workplace documents.',
      meets_expected: 'The learner demonstrates reading comprehension at the expected Certificate IV level. They can engage with moderately complex texts and apply instructions to unfamiliar situations.',
      monitor: 'The learner shows developing reading skills for Certificate IV demands. Additional support with complex document interpretation may be beneficial.',
      support_required: 'Gap identified in Reading. The learner requires structured reading comprehension support to meet Certificate IV expectations.'
    },
    Writing: {
      exceeds: 'The learner demonstrates strong written communication exceeding Certificate IV expectations, with clear reasoning and structure.',
      meets_expected: 'The learner demonstrates written communication skills appropriate for Certificate IV. They can produce structured responses with emerging reasoning.',
      monitor: 'The learner shows developing writing skills but needs support with structuring arguments and demonstrating reasoning in written responses.',
      support_required: 'Gap identified in Writing. The learner requires structured written communication development to meet Certificate IV requirements.'
    },
    Numeracy: {
      exceeds: 'The learner demonstrates strong numeracy skills exceeding Certificate IV expectations.',
      meets_expected: 'The learner demonstrates competent numeracy skills at the Certificate IV level. They can apply mathematical reasoning to workplace problems.',
      monitor: 'The learner shows developing numeracy skills but may benefit from applied numeracy workshops.',
      support_required: 'Gap identified in Numeracy. The learner requires applied numeracy intervention to meet Certificate IV requirements.'
    },
    Oral: {
      exceeds: 'The learner demonstrates strong oral communication exceeding Certificate IV expectations.',
      meets_expected: 'The learner demonstrates effective oral communication at the Certificate IV level.',
      monitor: 'The learner shows adequate oral communication but may benefit from communication confidence development.',
      support_required: 'Gap identified in Oral Communication. The learner requires communication confidence development support.'
    },
    Digital: {
      exceeds: 'The learner demonstrates strong digital literacy exceeding Certificate IV expectations.',
      meets_expected: 'The learner demonstrates competent digital literacy at the Certificate IV level with emerging workflow autonomy.',
      monitor: 'The learner shows developing digital skills but may benefit from LMS workflow training.',
      support_required: 'Gap identified in Digital Literacy. The learner requires LMS workflow and digital skills training.'
    }
  },
  '5': {
    Reading: {
      exceeds: 'The learner demonstrates strong integrated reading comprehension exceeding Diploma expectations.',
      meets_expected: 'The learner demonstrates integrated reading comprehension at the Diploma level. They can synthesise information across documents and apply critical interpretation.',
      monitor: 'The learner shows developing reading skills for Diploma demands. Advanced reading comprehension strategies may be beneficial.',
      support_required: 'Gap identified in Reading. The learner requires advanced reading comprehension strategies to meet Diploma-level expectations.'
    },
    Writing: {
      exceeds: 'The learner demonstrates strong justified reasoning in writing exceeding Diploma expectations.',
      meets_expected: 'The learner demonstrates writing skills with justified reasoning appropriate for Diploma level. They can construct structured arguments.',
      monitor: 'The learner shows developing writing skills but needs support with structured justification and argument development.',
      support_required: 'Gap identified in Writing. The learner requires structured argument and justification training to meet Diploma requirements.'
    },
    Numeracy: {
      exceeds: 'The learner demonstrates strong interpretive numeracy skills exceeding Diploma expectations.',
      meets_expected: 'The learner demonstrates competent interpretive numeracy at the Diploma level.',
      monitor: 'The learner shows developing numeracy skills. Applied numeracy interpretation support is recommended.',
      support_required: 'Gap identified in Numeracy. The learner requires applied numeracy interpretation support.'
    },
    Oral: {
      exceeds: 'The learner demonstrates strong professional communication exceeding Diploma expectations.',
      meets_expected: 'The learner demonstrates effective professional communication at the Diploma level.',
      monitor: 'The learner shows adequate professional communication but may benefit from refinement.',
      support_required: 'Gap identified in Oral Communication. Professional communication refinement is recommended.'
    },
    Digital: {
      exceeds: 'The learner demonstrates strong workflow autonomy exceeding Diploma expectations.',
      meets_expected: 'The learner demonstrates competent digital workflow autonomy at the Diploma level.',
      monitor: 'The learner shows developing digital workflow skills. Sequencing and LMS submission training is recommended.',
      support_required: 'Gap identified in Digital Literacy. Workflow sequencing and LMS submission training is required.'
    }
  },
  '6': {
    Reading: {
      exceeds: 'The learner demonstrates strong analytical reading exceeding Advanced Diploma expectations.',
      meets_expected: 'The learner demonstrates analytical reading skills at the Advanced Diploma level. They can interpret and evaluate complex texts.',
      monitor: 'The learner shows developing analytical reading skills. Analytical reading development is recommended.',
      support_required: 'Gap identified in Reading. The learner requires analytical reading development to meet Advanced Diploma requirements.'
    },
    Writing: {
      exceeds: 'The learner demonstrates strong analytical writing exceeding Advanced Diploma expectations, with evidence of structured argumentation.',
      meets_expected: 'The learner demonstrates analytical writing skills appropriate for Advanced Diploma. They can construct structured analytical arguments.',
      monitor: 'The learner shows developing analytical writing. Structured analytical writing workshops are recommended.',
      support_required: 'Gap identified in Writing. The learner requires structured analytical writing development to meet Advanced Diploma expectations.'
    },
    Numeracy: {
      exceeds: 'The learner demonstrates strong data interpretation and evaluation exceeding Advanced Diploma expectations.',
      meets_expected: 'The learner demonstrates competent data interpretation at the Advanced Diploma level.',
      monitor: 'The learner shows developing data interpretation skills. Evaluation training is recommended.',
      support_required: 'Gap identified in Numeracy. Data interpretation and evaluation training is required.'
    },
    Oral: {
      exceeds: 'The learner demonstrates strong professional presentation skills exceeding Advanced Diploma expectations.',
      meets_expected: 'The learner demonstrates effective professional engagement at the Advanced Diploma level.',
      monitor: 'The learner shows adequate professional communication. Presentation skills refinement is recommended.',
      support_required: 'Gap identified in Oral Communication. Professional presentation skills development is required.'
    },
    Digital: {
      exceeds: 'The learner demonstrates strong independent digital workflow exceeding Advanced Diploma expectations.',
      meets_expected: 'The learner demonstrates independent digital workflow and compliance skills at the Advanced Diploma level.',
      monitor: 'The learner shows developing digital workflow skills. Compliance review training is recommended.',
      support_required: 'Gap identified in Digital Literacy. Workflow sequencing and compliance review training is required.'
    }
  },
  '8-9': {
    Reading: {
      exceeds: 'The learner demonstrates strong analytical reading at the postgraduate level, with evidence of critical evaluation.',
      meets_expected: 'The learner demonstrates analytical reading skills at the expected postgraduate level. They can critically evaluate complex academic and professional texts.',
      monitor: 'The learner shows developing analytical reading for postgraduate demands. Critical reading strategy support is recommended.',
      support_required: 'Gap identified in Reading. The learner requires critical reading strategy support to meet postgraduate expectations.'
    },
    Writing: {
      exceeds: 'The learner demonstrates strong academic writing at the postgraduate level, with synthesis and coherent argumentation.',
      meets_expected: 'The learner demonstrates academic writing skills appropriate for postgraduate study. They can construct analytical, well-justified arguments.',
      monitor: 'The learner shows developing academic writing skills. Academic writing workshop recommendation is warranted.',
      support_required: 'Gap identified in Writing. The learner requires academic writing workshop support to meet postgraduate requirements.'
    },
    Numeracy: {
      exceeds: 'The learner demonstrates strong data interpretation exceeding postgraduate expectations.',
      meets_expected: 'The learner demonstrates competent data interpretation at the postgraduate level.',
      monitor: 'The learner shows developing data interpretation skills. Reinforcement support is recommended.',
      support_required: 'Gap identified in Numeracy. Data interpretation reinforcement is required.'
    },
    Oral: {
      exceeds: 'The learner demonstrates strong professional presentation skills at the postgraduate level.',
      meets_expected: 'The learner demonstrates effective professional communication at the postgraduate level.',
      monitor: 'The learner shows adequate professional communication. Coaching is recommended.',
      support_required: 'Gap identified in Oral Communication. Professional presentation coaching is required.'
    },
    Digital: {
      exceeds: 'The learner demonstrates strong research workflow and referencing skills at the postgraduate level.',
      meets_expected: 'The learner demonstrates competent research workflow and digital literacy at the postgraduate level.',
      monitor: 'The learner shows developing research workflow skills. Support is recommended.',
      support_required: 'Gap identified in Digital Literacy. Research workflow and referencing support is required.'
    }
  }
};

const SUPPORT_STRATEGIES: Record<string, Record<string, Record<string, string[]>>> = {
  '3': {
    Reading: {
      exceeds: ['Continue with standard training delivery', 'Provide extension reading materials if interested'],
      meets_expected: ['Continue with standard training delivery', 'Provide extension reading materials if interested'],
      monitor: ['Pre-teach key vocabulary before each unit', 'Provide reading guides and glossaries', 'Check comprehension regularly during training'],
      support_required: ['Implement 1:1 or small group literacy support', 'Use simplified texts initially with gradual complexity increase', 'Provide visual aids and graphic organisers', 'Schedule regular progress reviews']
    },
    Writing: {
      exceeds: ['Continue with standard assessment tasks', 'Encourage reflective writing practice'],
      meets_expected: ['Continue with standard assessment tasks', 'Encourage reflective writing practice'],
      monitor: ['Provide writing templates and scaffolds', 'Offer formative feedback on drafts', 'Use sentence starters for complex responses'],
      support_required: ['Implement structured writing support program', 'Provide extensive modelling and templates', 'Consider alternative demonstration methods initially', 'Build writing skills progressively']
    },
    Numeracy: {
      exceeds: ['Continue with standard numeracy requirements', 'Provide calculator access as standard'],
      meets_expected: ['Continue with standard numeracy requirements', 'Provide calculator access as standard'],
      monitor: ['Pre-teach mathematical concepts before application', 'Provide step-by-step worked examples', 'Allow additional time for numeracy-based tasks'],
      support_required: ['Implement targeted numeracy intervention', 'Use concrete materials and visual representations', 'Break multi-step problems into smaller components', 'Provide extensive practice opportunities']
    },
    Oral: {
      exceeds: ['Continue with standard verbal instruction methods', 'Include group discussion activities'],
      meets_expected: ['Continue with standard verbal instruction methods', 'Include group discussion activities'],
      monitor: ['Repeat and rephrase key instructions', 'Check understanding before proceeding', 'Encourage questions and clarification'],
      support_required: ['Provide written backup for all verbal instructions', 'Use visual aids to support spoken content', 'Allow processing time after instructions', 'Practice clarification techniques']
    },
    Digital: {
      exceeds: ['Continue with standard digital tool requirements', 'Introduce advanced features progressively'],
      meets_expected: ['Continue with standard digital tool requirements', 'Introduce advanced features progressively'],
      monitor: ['Provide step-by-step digital guides', 'Offer additional practice time with systems', 'Pair with confident digital user initially'],
      support_required: ['Implement basic digital skills orientation', 'Provide extensive hands-on practice', 'Use simplified interfaces where possible', 'Consider alternative submission methods initially']
    }
  },
  '4': {
    Reading: {
      exceeds: ['Continue with standard training delivery', 'Provide advanced reading materials'],
      meets_expected: ['Continue with standard training delivery', 'Provide extension reading materials'],
      monitor: ['Structured reading comprehension support', 'Pre-teach complex vocabulary', 'Provide document interpretation guides'],
      support_required: ['Implement structured reading comprehension support', 'Use guided reading techniques', 'Provide vocabulary development resources']
    },
    Writing: {
      exceeds: ['Encourage analytical writing practice', 'Provide peer review opportunities'],
      meets_expected: ['Continue with standard assessment tasks', 'Encourage structured written responses'],
      monitor: ['Structured written communication development', 'Provide reasoning frameworks', 'Offer formative writing feedback'],
      support_required: ['Implement structured written communication development', 'Provide extensive modelling of reasoning in writing', 'Use structured argument templates']
    },
    Numeracy: {
      exceeds: ['Continue with applied numeracy tasks', 'Introduce complex problem-solving'],
      meets_expected: ['Continue with standard numeracy requirements', 'Provide applied numeracy contexts'],
      monitor: ['Applied numeracy workshops', 'Provide step-by-step problem frameworks', 'Allow calculator access'],
      support_required: ['Implement applied numeracy workshops', 'Use workplace-context practice materials', 'Break complex problems into steps']
    },
    Oral: {
      exceeds: ['Include leadership communication opportunities', 'Provide presentation practice'],
      meets_expected: ['Continue with standard verbal instruction', 'Include group discussion activities'],
      monitor: ['Communication confidence development', 'Provide structured discussion frameworks'],
      support_required: ['Implement communication confidence development program', 'Provide paired practice activities']
    },
    Digital: {
      exceeds: ['Introduce advanced digital workflow tools', 'Encourage digital collaboration'],
      meets_expected: ['Continue with standard digital requirements', 'Introduce workflow tools'],
      monitor: ['LMS workflow training', 'Provide digital step-by-step guides'],
      support_required: ['Implement LMS workflow training', 'Provide extensive digital orientation', 'Pair with digital mentor']
    }
  },
  '5': {
    Reading: {
      exceeds: ['Provide advanced analytical reading materials', 'Encourage critical analysis practice'],
      meets_expected: ['Continue with Diploma-level reading expectations', 'Provide integration reading tasks'],
      monitor: ['Advanced reading comprehension strategies', 'Provide guided analysis frameworks'],
      support_required: ['Implement advanced reading comprehension strategies', 'Use structured text analysis methods', 'Provide vocabulary and concept mapping support']
    },
    Writing: {
      exceeds: ['Encourage research-informed writing', 'Provide peer review for analytical depth'],
      meets_expected: ['Continue with justified reasoning expectations', 'Encourage structured arguments'],
      monitor: ['Structured argument and justification training', 'Provide reasoning frameworks'],
      support_required: ['Implement structured argument and justification training', 'Use argument mapping tools', 'Provide extensive feedback on reasoning quality']
    },
    Numeracy: {
      exceeds: ['Provide complex data interpretation challenges', 'Encourage statistical reasoning'],
      meets_expected: ['Continue with interpretive numeracy requirements'],
      monitor: ['Applied numeracy interpretation support', 'Provide data analysis frameworks'],
      support_required: ['Implement applied numeracy interpretation support', 'Use visual data representation tools', 'Break interpretation tasks into steps']
    },
    Oral: {
      exceeds: ['Provide professional presentation opportunities', 'Encourage facilitation practice'],
      meets_expected: ['Continue with professional communication expectations'],
      monitor: ['Professional communication refinement', 'Provide structured presentation frameworks'],
      support_required: ['Implement professional communication refinement program', 'Provide presentation coaching']
    },
    Digital: {
      exceeds: ['Introduce advanced research tools', 'Encourage digital collaboration leadership'],
      meets_expected: ['Continue with workflow autonomy expectations'],
      monitor: ['Workflow sequencing and LMS submission training'],
      support_required: ['Implement workflow sequencing and LMS submission training', 'Provide extensive digital workflow orientation']
    }
  },
  '6': {
    Reading: {
      exceeds: ['Provide advanced analytical texts', 'Encourage critical evaluation practice'],
      meets_expected: ['Continue with analytical reading expectations'],
      monitor: ['Analytical reading development', 'Provide interpretation frameworks'],
      support_required: ['Implement analytical reading development program', 'Use structured analysis methods']
    },
    Writing: {
      exceeds: ['Encourage independent analytical writing', 'Provide advanced argumentation challenges'],
      meets_expected: ['Continue with analytical writing expectations'],
      monitor: ['Structured analytical writing workshops', 'Provide argument structure frameworks'],
      support_required: ['Implement structured analytical writing workshops', 'Use analytical writing templates', 'Provide extensive feedback on argument quality']
    },
    Numeracy: {
      exceeds: ['Provide advanced data evaluation challenges'],
      meets_expected: ['Continue with data interpretation expectations'],
      monitor: ['Data interpretation and evaluation training'],
      support_required: ['Implement data interpretation and evaluation training', 'Use visual data tools']
    },
    Oral: {
      exceeds: ['Provide leadership presentation opportunities'],
      meets_expected: ['Continue with professional engagement expectations'],
      monitor: ['Professional presentation skills refinement'],
      support_required: ['Implement professional presentation skills development program']
    },
    Digital: {
      exceeds: ['Introduce advanced compliance and workflow tools'],
      meets_expected: ['Continue with independent workflow expectations'],
      monitor: ['Workflow sequencing and compliance review training'],
      support_required: ['Implement workflow sequencing and compliance review training']
    }
  },
  '8-9': {
    Reading: {
      exceeds: ['Provide academic research reading challenges', 'Encourage systematic literature review practice'],
      meets_expected: ['Continue with postgraduate reading expectations'],
      monitor: ['Critical reading strategy support', 'Provide academic reading frameworks'],
      support_required: ['Implement critical reading strategy support', 'Use structured academic reading methods']
    },
    Writing: {
      exceeds: ['Encourage independent academic publication', 'Provide advanced synthesis challenges'],
      meets_expected: ['Continue with academic writing expectations'],
      monitor: ['Academic writing workshop recommendation', 'Provide synthesis frameworks'],
      support_required: ['Implement academic writing workshop program', 'Use academic writing templates', 'Provide intensive feedback on synthesis quality']
    },
    Numeracy: {
      exceeds: ['Provide advanced statistical analysis challenges'],
      meets_expected: ['Continue with data interpretation expectations'],
      monitor: ['Data interpretation reinforcement', 'Provide statistical reasoning frameworks'],
      support_required: ['Implement data interpretation reinforcement program']
    },
    Oral: {
      exceeds: ['Provide academic conference presentation opportunities'],
      meets_expected: ['Continue with professional communication expectations'],
      monitor: ['Professional presentation coaching'],
      support_required: ['Implement professional presentation coaching program']
    },
    Digital: {
      exceeds: ['Encourage advanced research tool proficiency'],
      meets_expected: ['Continue with research workflow expectations'],
      monitor: ['Research workflow and referencing support'],
      support_required: ['Implement research workflow and referencing support program']
    }
  }
};

// ============================================
// Main Scoring Function (Universal)
// ============================================

export function scoreAttempt(
  questions: Question[],
  responses: StudentResponse[],
  config: BenchmarkConfig
): ScoringResult {
  const responseMap = new Map(responses.map(r => [r.questionId, r.answer]));
  const questionScores: QuestionScore[] = [];

  // Score each question
  for (const question of questions) {
    const answer = responseMap.get(question.question_id) || '';
    let result: { score: number; isCorrect: boolean };

    if (question.response_type === 'short_text') {
      result = scoreWritingQuestion(question, answer, config);
    } else {
      result = scoreObjectiveQuestion(question, answer);
    }

    questionScores.push({
      questionId: question.question_id,
      domain: question.domain,
      acsfLevel: question.acsf_level,
      difficultyTag: question.difficulty_tag,
      responseType: question.response_type,
      scoreAwarded: result.score,
      maxScore: question.max_score,
      isCorrect: result.isCorrect
    });
  }

  // Calculate domain scores
  const domains = ['Reading', 'Writing', 'Numeracy', 'Oral', 'Digital'];
  const domainScores: DomainScore[] = [];
  const domainPercentages: Record<string, number> = {};
  const aqfLevel = config.aqfLevel;
  const levelJustifications = JUSTIFICATION_TEMPLATES[aqfLevel] || JUSTIFICATION_TEMPLATES['3'];
  const levelStrategies = SUPPORT_STRATEGIES[aqfLevel] || SUPPORT_STRATEGIES['3'];

  for (const domain of domains) {
    const domainQuestions = questionScores.filter(q => q.domain === domain);
    if (domainQuestions.length === 0) continue;

    const rawScore = domainQuestions.reduce((sum, q) => sum + q.scoreAwarded, 0);
    const maxScore = domainQuestions.reduce((sum, q) => sum + q.maxScore, 0);
    const percentage = maxScore > 0 ? (rawScore / maxScore) * 100 : 0;
    domainPercentages[domain] = percentage;

    // ACSF breakdown
    const acsf2Questions = domainQuestions.filter(q => q.acsfLevel === 2);
    const acsf3CoreQuestions = domainQuestions.filter(q => q.acsfLevel === 3 && q.difficultyTag === 'core');
    const acsf3StretchQuestions = domainQuestions.filter(q => q.acsfLevel === 3 && q.difficultyTag === 'stretch');

    const acsf2Score = acsf2Questions.reduce((sum, q) => sum + q.scoreAwarded, 0);
    const acsf2Max = acsf2Questions.reduce((sum, q) => sum + q.maxScore, 0);
    const acsf2Percent = acsf2Max > 0 ? (acsf2Score / acsf2Max) * 100 : 0;

    const acsf3CoreScore = acsf3CoreQuestions.reduce((sum, q) => sum + q.scoreAwarded, 0);
    const acsf3CoreMax = acsf3CoreQuestions.reduce((sum, q) => sum + q.maxScore, 0);
    const acsf3CorePercent = acsf3CoreMax > 0 ? (acsf3CoreScore / acsf3CoreMax) * 100 : 0;

    const acsf3StretchScore = acsf3StretchQuestions.reduce((sum, q) => sum + q.scoreAwarded, 0);
    const acsf3StretchMax = acsf3StretchQuestions.reduce((sum, q) => sum + q.maxScore, 0);
    const acsf3StretchPercent = acsf3StretchMax > 0 ? (acsf3StretchScore / acsf3StretchMax) * 100 : 0;

    const estimatedACSFBand = getEstimatedACSFBand(acsf2Percent, acsf3CorePercent, acsf3StretchPercent, config);
    const outcome = getDomainOutcome(percentage, config);
    const weight = config.weights[domain as keyof typeof config.weights] || 0;
    const weightedContribution = percentage * weight;

    // Risk flag check
    const riskThreshold = config.riskThresholds[domain];
    const riskFlag = riskThreshold ? percentage < riskThreshold : false;
    const riskFlagDetail = riskFlag ? `${domain} borderline` : '';

    // Get justification and strategies
    const justification = levelJustifications[domain]?.[outcome] || '';
    const strategies = levelStrategies[domain]?.[outcome] || [];

    domainScores.push({
      domain,
      rawScore,
      maxScore,
      percentage: Math.round(percentage * 10) / 10,
      weightedContribution: Math.round(weightedContribution * 10) / 10,
      acsf2Percent: Math.round(acsf2Percent * 10) / 10,
      acsf3CorePercent: Math.round(acsf3CorePercent * 10) / 10,
      acsf3StretchPercent: Math.round(acsf3StretchPercent * 10) / 10,
      estimatedACSFBand,
      outcome,
      riskFlag,
      riskFlagDetail,
      justification,
      strategies
    });
  }

  // Calculate overall score (weighted)
  let totalScore = 0;
  for (const ds of domainScores) {
    const weight = config.weights[ds.domain as keyof typeof config.weights] || 0;
    totalScore += ds.percentage * weight;
  }

  // Determine overall outcome with overrides
  const { outcome, classification, overrideTriggered } = determineOverallOutcome(
    totalScore, domainPercentages, config
  );

  // Evaluate risk flags
  const riskFlags = evaluateRiskFlags(domainPercentages, config);

  return {
    totalScore: Math.round(totalScore * 10) / 10,
    overallOutcome: outcome,
    overallClassification: classification,
    overrideTriggered,
    riskFlags,
    domainScores,
    questionScores,
    benchmarkVersion: `AQF${config.aqfLevel}_V${config.version}`,
    aqfLevel: config.aqfLevel
  };
}

// ============================================
// Report JSON Generator (Universal)
// ============================================

export function generateReportJSON(
  scoringResult: ScoringResult,
  studentName: string,
  studentId: string,
  rtoName: string,
  logoUrl: string | null,
  submittedAt: number,
  attemptId: string,
  stream: string = 'Health & Community Services'
) {
  const aqfLevel = scoringResult.aqfLevel;
  const levelName = AQF_LEVEL_NAMES[aqfLevel] || `AQF ${aqfLevel}`;

  // Key flags from domain outcomes
  const keyFlags: string[] = [];
  for (const ds of scoringResult.domainScores) {
    if (ds.outcome === 'support_required') {
      keyFlags.push(`${ds.domain} below benchmark`);
    }
  }

  // Add risk flags
  for (const rf of scoringResult.riskFlags) {
    if (!keyFlags.includes(`${rf.domain} below benchmark`)) {
      keyFlags.push(rf.detail);
    }
  }

  // ACSF alignment statement
  const acsfStatement = generateACSFAlignmentStatement(scoringResult, aqfLevel);

  // Suitability statement (OS25 QA2)
  const suitabilityStatement = generateSuitabilityStatement(scoringResult, aqfLevel, levelName);

  return {
    version: scoringResult.benchmarkVersion,
    generated_at: Date.now(),
    student: {
      name: studentName,
      id: studentId
    },
    assessment: {
      attempt_id: attemptId,
      aqf_level: aqfLevel,
      aqf_level_name: levelName,
      stream,
      submitted_at: submittedAt
    },
    branding: {
      rto_name: rtoName,
      logo_url: logoUrl
    },
    overall: {
      score: scoringResult.totalScore,
      outcome_code: scoringResult.overallOutcome,
      outcome_label: scoringResult.overallClassification,
      override_triggered: scoringResult.overrideTriggered,
      key_flags: keyFlags,
      risk_flags: scoringResult.riskFlags.map(rf => ({
        domain: rf.domain,
        detail: rf.detail,
        threshold: rf.threshold,
        actual: rf.actual
      })),
      acsf_alignment_statement: acsfStatement,
      suitability_statement: suitabilityStatement
    },
    domains: scoringResult.domainScores.map(ds => ({
      name: ds.domain,
      percentage: ds.percentage,
      weighted_contribution: ds.weightedContribution,
      raw_score: ds.rawScore,
      max_score: ds.maxScore,
      outcome: ds.outcome,
      risk_flag: ds.riskFlag,
      risk_flag_detail: ds.riskFlagDetail,
      estimated_acsf_band: ds.estimatedACSFBand,
      acsf_breakdown: {
        acsf2_percent: ds.acsf2Percent,
        acsf3_core_percent: ds.acsf3CorePercent,
        acsf3_stretch_percent: ds.acsf3StretchPercent
      },
      justification: ds.justification,
      strategies: ds.strategies
    }))
  };
}

// ============================================
// ACSF Alignment Statement Generator
// ============================================

function generateACSFAlignmentStatement(result: ScoringResult, aqfLevel: string): string {
  const meetsCount = result.domainScores.filter(d =>
    d.outcome === 'meets_expected' || d.outcome === 'exceeds'
  ).length;
  const totalDomains = result.domainScores.length;

  const levelDescriptors: Record<string, string> = {
    '3': 'ACSF Level 3 functional performance',
    '4': 'ACSF Level 3 high to Level 4 emerging performance',
    '5': 'consistent ACSF Level 4 performance',
    '6': 'ACSF Level 4 high analytical performance',
    '8-9': 'ACSF Level 4 high analytical and synthesis performance'
  };

  const descriptor = levelDescriptors[aqfLevel] || 'functional ACSF performance';

  if (meetsCount === totalDomains) {
    return `This assessment demonstrates ${descriptor} across all five ACSF core skill areas, meeting the expectations for the selected qualification level.`;
  } else if (meetsCount >= 3) {
    return `This assessment demonstrates ${descriptor} in most ACSF core skill areas. Some domains require monitoring or targeted support to achieve full benchmark alignment.`;
  } else {
    return `This assessment indicates areas requiring targeted support to achieve ${descriptor}. Structured intervention aligned with OS25 requirements is recommended.`;
  }
}

// ============================================
// Suitability Statement Generator (OS25 QA2)
// ============================================

function generateSuitabilityStatement(result: ScoringResult, aqfLevel: string, levelName: string): string {
  const outcome = result.overallOutcome;

  if (outcome === 'exceeds' || outcome === 'meets') {
    return `Based on this LLND benchmark assessment, the learner demonstrates the language, literacy, numeracy and digital skills expected for ${levelName} qualifications. The learner is considered suitable to commence training with standard support provisions.`;
  } else if (outcome === 'monitor') {
    return `Based on this LLND benchmark assessment, the learner demonstrates borderline performance for ${levelName} qualifications. The learner may commence training with enhanced monitoring and early intervention support in identified risk areas.`;
  } else {
    return `Based on this LLND benchmark assessment, the learner requires targeted LLND support before or during engagement with ${levelName} training. A structured support plan aligned with OS25 requirements should be implemented.`;
  }
}
