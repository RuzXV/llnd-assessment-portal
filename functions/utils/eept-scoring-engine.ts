/**
 * EEPT Scoring Engine (ebpaScoreEngine)
 * Version: ebpa-score-v1.0
 *
 * Deterministic scoring engine for the EduX English Placement Test.
 * Config-driven: all thresholds loaded from DB (eept_scoring_maps).
 *
 * IMPORTANT: This engine runs ONLY in the finalisation job.
 * NEVER run scoring logic in the frontend.
 */

// ============================================
// Types
// ============================================

export interface EEPTScoringInput {
  grammarCorrect: number;    // 0–20
  readingCorrect: number;    // 0–20
  t1: WritingDomainScores;   // Task 1 domain scores
  t2: WritingDomainScores;   // Task 2 domain scores
}

export interface WritingDomainScores {
  taskAchievement: number;   // 0–5
  coherence: number;         // 0–5
  lexical: number;           // 0–5
  grammar: number;           // 0–5
}

export interface CEFRCutoff {
  min: number;
  max: number;
  band: string;
}

export interface ACSFMapping {
  min: number;
  max: number;
  band: number;
}

export interface IELTSMappingTable {
  [cefrBand: string]: {
    low: string;
    mid: string;
    high: string;
  };
}

export interface EEPTScoringConfig {
  version: string;
  skillFloorRuleEnabled: boolean;
  cefrCutoffsOverall: CEFRCutoff[];
  cefrCutoffsReading: CEFRCutoff[];
  cefrCutoffsWriting: CEFRCutoff[];
  ieltsMappingTable: IELTSMappingTable;
  acsfReadingMap: ACSFMapping[];
  acsfWritingMap: ACSFMapping[];
  integrityPolicy: {
    mode: string;
    similarity_review_threshold: number;
    similarity_high_threshold: number;
    low_confidence_threshold: number;
  };
}

export interface EEPTScoringResult {
  grammarScore: number;
  readingScore: number;
  writingTask1Score: number;
  writingTask2Score: number;
  writingRawTotal: number;
  compositeScore: number;
  readingCEFR: string;
  writingCEFR: string;
  overallCEFR_preFloor: string;
  overallCEFR_final: string;
  skillFloorApplied: boolean;
  skillFloorReason: string | null;
  ieltsIndicative: string;
  readingACSF: number;
  writingACSF: number;
  auditDecisionLog: AuditStep[];
}

export interface AuditStep {
  step: string;
  [key: string]: any;
}

// ============================================
// CEFR Level Ordering
// ============================================

const LEVEL_ORDER: Record<string, number> = { A2: 1, B1: 2, B2: 3, C1: 4 };

function minCEFR(...levels: string[]): string {
  return levels.reduce((min, l) =>
    (LEVEL_ORDER[l] ?? 0) < (LEVEL_ORDER[min] ?? 0) ? l : min,
    levels[0]
  );
}

// ============================================
// Band Lookup (config-driven)
// ============================================

function bandFromCutoffs(score: number, cutoffs: CEFRCutoff[]): string {
  const row = cutoffs.find(r => score >= r.min && score <= r.max);
  if (!row) throw new Error(`Score ${score} out of range for cutoffs`);
  return row.band;
}

function acsfFromMap(score: number, mapping: ACSFMapping[]): number {
  const row = mapping.find(r => score >= r.min && score <= r.max);
  if (!row) throw new Error(`Score ${score} out of range for ACSF map`);
  return row.band;
}

// ============================================
// Main Scoring Function
// ============================================

export function scoreEEPT(input: EEPTScoringInput, config: EEPTScoringConfig): EEPTScoringResult {
  const audit: AuditStep[] = [];

  // ---- Section Scores ----
  const grammarScore = input.grammarCorrect * 1.0;
  const readingScore = input.readingCorrect * 1.5;

  const t1raw = input.t1.taskAchievement + input.t1.coherence + input.t1.lexical + input.t1.grammar;
  const t2raw = input.t2.taskAchievement + input.t2.coherence + input.t2.lexical + input.t2.grammar;

  const writingTask1Score = t1raw;          // max 20
  const writingTask2Score = t2raw * 1.5;    // max 30
  const writingRawTotal = t1raw + t2raw;    // max 40 (for writing CEFR + ACSF)

  const compositeScore = grammarScore + readingScore + writingTask1Score + writingTask2Score;

  audit.push({
    step: 'section_scores',
    grammarScore, readingScore,
    writingTask1Score, writingTask2Score,
    writingRawTotal, compositeScore
  });

  // ---- CEFR Bands ----
  const readingCEFR = bandFromCutoffs(readingScore, config.cefrCutoffsReading);
  const writingCEFR = bandFromCutoffs(writingRawTotal, config.cefrCutoffsWriting);
  const overallPre = bandFromCutoffs(compositeScore, config.cefrCutoffsOverall);

  audit.push({ step: 'cefr_pre_floor', readingCEFR, writingCEFR, overallPre });

  // ---- Skill Floor Rule ----
  let overallFinal = overallPre;
  let skillFloorApplied = false;
  let skillFloorReason: string | null = null;

  if (config.skillFloorRuleEnabled) {
    overallFinal = minCEFR(overallPre, readingCEFR, writingCEFR);
    if (overallFinal !== overallPre) {
      skillFloorApplied = true;
      const reasons: string[] = [];
      if (LEVEL_ORDER[readingCEFR] < LEVEL_ORDER[overallPre]) reasons.push('Reading');
      if (LEVEL_ORDER[writingCEFR] < LEVEL_ORDER[overallPre]) reasons.push('Writing');
      skillFloorReason = `Capped by ${reasons.join(' and ')}`;
    }
  }

  audit.push({ step: 'skill_floor', overallFinal, skillFloorApplied, skillFloorReason });

  // ---- IELTS Indicative ----
  // Find the band row for the final CEFR level
  const overallBandRow = config.cefrCutoffsOverall.find(
    r => r.band === overallFinal && compositeScore >= r.min && compositeScore <= r.max
  ) || config.cefrCutoffsOverall.find(
    r => compositeScore >= r.min && compositeScore <= r.max
  );

  let ieltsIndicative = 'N/A';
  let pos = 'mid';

  if (overallBandRow) {
    const bandMin = overallBandRow.min;
    const bandMax = overallBandRow.max;
    const p = bandMax === bandMin ? 1 : (compositeScore - bandMin) / (bandMax - bandMin);
    pos = p < 0.33 ? 'low' : p <= 0.66 ? 'mid' : 'high';
    ieltsIndicative = config.ieltsMappingTable[overallFinal]?.[pos as 'low' | 'mid' | 'high'] ?? 'N/A';
  }

  audit.push({ step: 'ielts', pos, ieltsIndicative });

  // ---- ACSF Mapping ----
  const readingACSF = acsfFromMap(readingScore, config.acsfReadingMap);
  const writingACSF = acsfFromMap(writingRawTotal, config.acsfWritingMap);

  audit.push({ step: 'acsf', readingACSF, writingACSF });

  return {
    grammarScore,
    readingScore,
    writingTask1Score,
    writingTask2Score,
    writingRawTotal,
    compositeScore,
    readingCEFR,
    writingCEFR,
    overallCEFR_preFloor: overallPre,
    overallCEFR_final: overallFinal,
    skillFloorApplied,
    skillFloorReason,
    ieltsIndicative,
    readingACSF,
    writingACSF,
    auditDecisionLog: audit,
  };
}


// ============================================
// Benchmark Traffic-Light Engine
// ============================================

export interface BenchmarkResult {
  benchmark_status: 'GREEN' | 'AMBER' | 'RED';
  benchmark_rule_id_applied: string;
  benchmark_rule_name: string;
  actions: string[];
  thresholds: any;
  misses: { field: string; drop: number }[];
  ielts_delta: number;
  reasons: string[];
}

interface BenchmarkRule {
  rule_id: string;
  name: string;
  applies_to: { course_code: string; delivery_type: string };
  thresholds: {
    overall_cefr_min: string | null;
    reading_cefr_min: string | null;
    writing_cefr_min: string | null;
    ielts_indicative_min: string | null;
  };
  traffic_light_logic: {
    green: { all_met: boolean };
    amber: { conditions: any[] };
    red: { otherwise: boolean };
  };
  actions: { green: string[]; amber: string[]; red: string[] };
}

interface BenchmarkConfig {
  version: string;
  defaults: any;
  rules: BenchmarkRule[];
  level_order: string[];
}

function cefrToIndex(level: string | null): number {
  if (!level) return -999;
  return LEVEL_ORDER[level] ?? -999;
}

function isAtLeast(actual: string, required: string): boolean {
  return cefrToIndex(actual) >= cefrToIndex(required);
}

function bandDrop(actual: string, required: string): number {
  return Math.max(0, cefrToIndex(required) - cefrToIndex(actual));
}

function parseIELTS(value: string | null): number | null {
  if (!value) return null;
  const cleaned = value.replace('+', '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function ieltsDelta(actualStr: string | null, requiredStr: string | null): number {
  if (!requiredStr) return 0;
  const actual = parseIELTS(actualStr);
  const required = parseIELTS(requiredStr);
  if (actual === null || required === null) return 999;
  return required - actual;
}

function wildcardMatch(pattern: string, text: string): boolean {
  if (pattern === '*' || !pattern) return true;
  const regex = new RegExp('^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
  return regex.test(text || '');
}

function selectApplicableRule(rules: BenchmarkRule[], courseCode: string, deliveryType: string): BenchmarkRule | null {
  const candidates: { rule: BenchmarkRule; specificity: number }[] = [];

  for (const rule of rules) {
    const pCourse = rule.applies_to.course_code || '*';
    const pDeliv = rule.applies_to.delivery_type || '*';
    if (wildcardMatch(pCourse, courseCode) && wildcardMatch(pDeliv, deliveryType)) {
      const specificity = (pCourse.match(/\*/g) || []).length + (pDeliv.match(/\*/g) || []).length;
      candidates.push({ rule, specificity });
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.specificity - b.specificity);
  return candidates[0].rule;
}

export function evaluateBenchmark(
  benchmarkConfig: BenchmarkConfig,
  candidate: {
    overall_cefr: string;
    reading_cefr: string;
    writing_cefr: string;
    ielts_indicative: string;
    course_code: string;
  },
  context: { delivery_type?: string }
): BenchmarkResult {
  const rule = selectApplicableRule(
    benchmarkConfig.rules,
    candidate.course_code || '*',
    context.delivery_type || '*'
  );

  const thresholds = rule ? rule.thresholds : benchmarkConfig.defaults;
  const logic = rule ? rule.traffic_light_logic : { green: { all_met: true }, amber: { conditions: [] }, red: { otherwise: true } };
  const actions = rule ? rule.actions : { green: ['Proceed'], amber: ['Manual review recommended'], red: ['Not recommended'] };

  // Step 1: Threshold checks
  const reqOverall = thresholds.overall_cefr_min;
  const reqReading = thresholds.reading_cefr_min;
  const reqWriting = thresholds.writing_cefr_min;
  const reqIELTS = thresholds.ielts_indicative_min;

  const metOverall = !reqOverall || isAtLeast(candidate.overall_cefr, reqOverall);
  const metReading = !reqReading || isAtLeast(candidate.reading_cefr, reqReading);
  const metWriting = !reqWriting || isAtLeast(candidate.writing_cefr, reqWriting);

  const ieltsReqEnabled = !!reqIELTS;
  let metIELTS = true;
  let deltaIELTS = 0;
  if (ieltsReqEnabled) {
    deltaIELTS = ieltsDelta(candidate.ielts_indicative, reqIELTS);
    metIELTS = deltaIELTS <= 0;
  }

  const misses: { field: string; drop: number }[] = [];
  if (!metOverall && reqOverall) misses.push({ field: 'overall_cefr', drop: bandDrop(candidate.overall_cefr, reqOverall) });
  if (!metReading && reqReading) misses.push({ field: 'reading_cefr', drop: bandDrop(candidate.reading_cefr, reqReading) });
  if (!metWriting && reqWriting) misses.push({ field: 'writing_cefr', drop: bandDrop(candidate.writing_cefr, reqWriting) });

  const allCEFRMet = misses.length === 0;
  const allMet = allCEFRMet && metIELTS;

  const buildResult = (status: 'GREEN' | 'AMBER' | 'RED', actionList: string[], amberReasons?: string[]): BenchmarkResult => ({
    benchmark_status: status,
    benchmark_rule_id_applied: rule?.rule_id ?? 'DEFAULTS',
    benchmark_rule_name: rule?.name ?? 'Defaults',
    actions: actionList || [],
    thresholds,
    misses,
    ielts_delta: deltaIELTS,
    reasons: amberReasons || [],
  });

  // Step 2: GREEN
  if (logic.green?.all_met && allMet) {
    return buildResult('GREEN', actions.green);
  }

  // Step 3: AMBER evaluation
  let amberOk = false;
  const amberReasons: string[] = [];

  for (const cond of (logic.amber?.conditions || [])) {
    if (cond.type === 'one_threshold_missed_by_one_band') {
      const fields = cond.fields || ['reading_cefr', 'writing_cefr', 'overall_cefr'];
      const nominatedMisses = misses.filter(m => fields.includes(m.field));
      if (nominatedMisses.length === 1 && nominatedMisses[0].drop === 1) {
        amberOk = true;
        amberReasons.push(`One CEFR threshold missed by one band: ${nominatedMisses[0].field}`);
      }
    }

    if (cond.type === 'writing_below_min_only') {
      const maxDrop = cond.max_band_drop || 1;
      const wDrop = metWriting ? 0 : (reqWriting ? bandDrop(candidate.writing_cefr, reqWriting) : 0);
      if (!metWriting && wDrop >= 1 && wDrop <= maxDrop && metReading && metOverall) {
        amberOk = true;
        amberReasons.push(`Writing below minimum only (drop ${wDrop})`);
      }
    }

    if (cond.type === 'ielts_below_by') {
      const maxDelta = cond.max_delta || 0.5;
      if (ieltsReqEnabled && deltaIELTS > 0 && deltaIELTS <= maxDelta) {
        amberOk = true;
        amberReasons.push(`IELTS indicative below requirement by ${deltaIELTS}`);
      }
    }
  }

  if (amberOk) {
    return buildResult('AMBER', actions.amber, amberReasons);
  }

  // Step 4: RED
  return buildResult('RED', actions.red);
}
