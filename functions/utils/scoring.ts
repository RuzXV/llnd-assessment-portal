// AQF3 Scoring Engine
// Implements the scoring algorithm from the implementation instructions

import {
  AQF3_V1_BENCHMARK,
  getDomainOutcome,
  getEstimatedACSFBand,
  getOverallOutcome,
  JUSTIFICATION_TEMPLATES,
  SUPPORT_STRATEGIES
} from '../config/benchmarks/aqf3_v1';

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
  acsf2Percent: number;
  acsf3CorePercent: number;
  acsf3StretchPercent: number;
  estimatedACSFBand: string;
  outcome: string;
  justification: string;
  strategies: string[];
}

export interface ScoringResult {
  totalScore: number;
  overallOutcome: string;
  domainScores: DomainScore[];
  questionScores: QuestionScore[];
  benchmarkVersion: string;
}

// Score a single MCQ or numeric question
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
    // Numeric comparison with tolerance
    const answerNum = parseFloat(normalizedAnswer);
    const correctNum = parseFloat(normalizedCorrect);

    if (isNaN(answerNum) || isNaN(correctNum)) {
      return { score: 0, isCorrect: false };
    }

    const isCorrect = Math.abs(answerNum - correctNum) <= AQF3_V1_BENCHMARK.numericTolerance;
    return { score: isCorrect ? question.max_score : 0, isCorrect };
  }

  // MCQ - exact match
  const isCorrect = normalizedAnswer === normalizedCorrect;
  return { score: isCorrect ? question.max_score : 0, isCorrect };
}

// Score a writing question using deterministic rubric
function scoreWritingQuestion(
  question: Question,
  answer: string
): { score: number; isCorrect: boolean } {
  if (!answer || answer.trim().length === 0) {
    return { score: 0, isCorrect: false };
  }

  const text = answer.trim().toLowerCase();
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const wordCount = words.length;
  const rubric = AQF3_V1_BENCHMARK.writingRubric;

  // Determine minimum word count based on ACSF level
  const minWords = question.acsf_level === 2 ? rubric.acsf2MinWords : rubric.acsf3MinWords;

  // Check for sentence structure (periods, line breaks, or conjunctions)
  const hasSentenceStructure = text.includes('.') || text.includes('\n') ||
    /\b(and|but|so|then|because|however)\b/.test(text);

  // Check for cause/reason indicators
  const hasCauseIndicator = rubric.causeWords.some(w => text.includes(w));

  // Check for impact indicators (for W-S1 cause and impact question)
  const hasImpactIndicator = rubric.impactWords.some(w => text.includes(w));

  // Check for request language (for clarification request question)
  const hasRequestIndicator = rubric.requestWords.some(w => text.includes(w));

  // Scoring logic (0-3 scale)
  let score = 0;

  // Score 0: blank or irrelevant (handled above)

  // Score 1: meaning partly clear but incomplete OR too short
  if (wordCount >= 3 && wordCount < minWords) {
    score = 1;
  }

  // Score 2: meaning clear, mostly relevant, basic structure
  if (wordCount >= minWords && hasSentenceStructure) {
    score = 2;
  }

  // Score 3: clear, relevant, structured; meets prompt requirements
  if (wordCount >= minWords && hasSentenceStructure) {
    // Additional checks based on question type (using acsf_skill or question_id patterns)
    if (question.acsf_level === 3 && question.difficulty_tag === 'stretch') {
      // W-S1: Cause and Impact - needs both cause and impact
      if (hasCauseIndicator && hasImpactIndicator) {
        score = 3;
      }
    } else if (question.acsf_level === 3) {
      // W2.2: Request for clarification - needs request language
      if (hasRequestIndicator || hasCauseIndicator) {
        score = 3;
      }
    } else {
      // ACSF 2 questions - simpler requirements
      if (hasCauseIndicator || wordCount >= minWords * 1.5) {
        score = 3;
      }
    }
  }

  // Cap at max_score
  score = Math.min(score, question.max_score);

  return { score, isCorrect: score === question.max_score };
}

// Main scoring function
export function scoreAttempt(
  questions: Question[],
  responses: StudentResponse[]
): ScoringResult {
  const responseMap = new Map(responses.map(r => [r.questionId, r.answer]));
  const questionScores: QuestionScore[] = [];

  // Score each question
  for (const question of questions) {
    const answer = responseMap.get(question.question_id) || '';

    let result: { score: number; isCorrect: boolean };

    if (question.response_type === 'short_text') {
      result = scoreWritingQuestion(question, answer);
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

  for (const domain of domains) {
    const domainQuestions = questionScores.filter(q => q.domain === domain);

    if (domainQuestions.length === 0) continue;

    // Calculate raw scores
    const rawScore = domainQuestions.reduce((sum, q) => sum + q.scoreAwarded, 0);
    const maxScore = domainQuestions.reduce((sum, q) => sum + q.maxScore, 0);
    const percentage = maxScore > 0 ? (rawScore / maxScore) * 100 : 0;

    // Calculate ACSF breakdown
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

    // Get estimated ACSF band
    const estimatedACSFBand = getEstimatedACSFBand(acsf2Percent, acsf3CorePercent, acsf3StretchPercent);

    // Get domain outcome
    const outcome = getDomainOutcome(percentage);

    // Get justification and strategies
    const justification = JUSTIFICATION_TEMPLATES[domain]?.[outcome] || '';
    const strategies = SUPPORT_STRATEGIES[domain]?.[outcome] || [];

    domainScores.push({
      domain,
      rawScore,
      maxScore,
      percentage: Math.round(percentage * 10) / 10,
      acsf2Percent: Math.round(acsf2Percent * 10) / 10,
      acsf3CorePercent: Math.round(acsf3CorePercent * 10) / 10,
      acsf3StretchPercent: Math.round(acsf3StretchPercent * 10) / 10,
      estimatedACSFBand,
      outcome,
      justification,
      strategies
    });
  }

  // Calculate overall score (weighted average)
  const weights = AQF3_V1_BENCHMARK.domainWeights;
  let totalScore = 0;

  for (const ds of domainScores) {
    const weight = weights[ds.domain as keyof typeof weights] || 0;
    totalScore += ds.percentage * weight;
  }

  // Determine overall outcome
  const domainOutcomeMap: Record<string, string> = {};
  for (const ds of domainScores) {
    domainOutcomeMap[ds.domain] = ds.outcome;
  }

  // Check if stretch items mostly meet threshold
  const stretchQuestions = questionScores.filter(q => q.difficultyTag === 'stretch');
  const stretchCorrect = stretchQuestions.filter(q => q.isCorrect).length;
  const stretchMostlyMeets = stretchQuestions.length > 0 &&
    (stretchCorrect / stretchQuestions.length) >= 0.5;

  const overallOutcome = getOverallOutcome(domainOutcomeMap, stretchMostlyMeets);

  return {
    totalScore: Math.round(totalScore * 10) / 10,
    overallOutcome,
    domainScores,
    questionScores,
    benchmarkVersion: AQF3_V1_BENCHMARK.version
  };
}

// Generate report JSON structure
export function generateReportJSON(
  scoringResult: ScoringResult,
  studentName: string,
  studentId: string,
  rtoName: string,
  logoUrl: string | null,
  submittedAt: number,
  attemptId: string
) {
  const overallLabels: Record<string, string> = {
    meets_confident: 'Meets AQF 3 - with confidence',
    meets_monitor: 'Meets AQF 3 - monitor',
    support_required: 'Support Required'
  };

  // Identify key flags
  const keyFlags: string[] = [];
  for (const ds of scoringResult.domainScores) {
    if (ds.outcome === 'support_required') {
      keyFlags.push(`${ds.domain} below benchmark`);
    }
  }

  return {
    version: scoringResult.benchmarkVersion,
    generated_at: Date.now(),
    student: {
      name: studentName,
      id: studentId
    },
    assessment: {
      attempt_id: attemptId,
      aqf_level: 3,
      context: 'Health & Community Services',
      submitted_at: submittedAt
    },
    branding: {
      rto_name: rtoName,
      logo_url: logoUrl
    },
    overall: {
      score: scoringResult.totalScore,
      outcome_code: scoringResult.overallOutcome,
      outcome_label: overallLabels[scoringResult.overallOutcome] || scoringResult.overallOutcome,
      key_flags: keyFlags
    },
    domains: scoringResult.domainScores.map(ds => ({
      name: ds.domain,
      percentage: ds.percentage,
      raw_score: ds.rawScore,
      max_score: ds.maxScore,
      outcome: ds.outcome,
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
