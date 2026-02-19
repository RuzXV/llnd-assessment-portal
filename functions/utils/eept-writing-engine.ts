/**
 * EEPT Hybrid Writing Scoring Engine
 * Version: hybrid-v1.0
 *
 * 5-layer pipeline:
 *   Layer 1: Structural compliance checks
 *   Layer 2: Rule-based linguistic metrics + domain scores
 *   Layer 3: LLM rubric scoring (CEFR-aligned)
 *   Layer 4: Score reconciliation (rule vs LLM)
 *   Layer 5: Integrity & risk flags + confidence score
 */

// ============================================
// Types
// ============================================

export interface WritingSubmission {
  submission_id: string;
  assessment_id: string;
  task_type: 'task1' | 'task2';
  prompt_id: string;
  text: string;
  word_count: number;
  paragraph_count: number;
}

export interface WritingPromptContext {
  prompt: string;
  requirement_1: string | null;
  requirement_2: string | null;
  requirement_3: string | null;
  cefr_target: string;
}

export interface DomainScores {
  task_achievement: number;
  coherence_cohesion: number;
  lexical_resource: number;
  grammar_range_accuracy: number;
}

export interface RuleMetrics {
  word_count: number;
  sentence_count: number;
  avg_sentence_length: number;
  paragraph_count: number;
  connector_count: number;
  type_token_ratio: number;
  repetition_index: number;
  complex_sentence_ratio: number;
  error_rate_100: number;
  prompt_coverage_score: number;
  structural_pass: boolean;
  structural_notes: string;
}

export interface WritingScoringResult {
  rule_scores: DomainScores;
  rule_metrics: RuleMetrics;
  llm_scores: DomainScores | null;
  llm_justifications: Record<string, string> | null;
  final_scores: DomainScores;
  raw_total_0_20: number;
  scaled_total: number;
  cefr_estimate: string;
  acsf_estimate: number;
  confidence_score: number;
  flags: string[];
  needs_human_review: boolean;
  review_reason: string | null;
}

// ============================================
// Layer 1: Structural Compliance
// ============================================

interface StructuralResult {
  pass: boolean;
  notes: string;
  prompt_coverage_score: number;
}

function checkStructuralCompliance(
  text: string,
  taskType: 'task1' | 'task2',
  wordCount: number,
  paragraphCount: number,
  requirements: string[]
): StructuralResult {
  const notes: string[] = [];
  let pass = true;
  let promptCoverage = 0;

  if (taskType === 'task1') {
    // Task 1: functional writing 120-150 words
    if (wordCount < 80) {
      pass = false;
      notes.push('Severely under word count (< 80 words)');
    } else if (wordCount < 110) {
      notes.push('Below recommended word count (< 110 words)');
    }

    // Check bullet point coverage with simple keyword heuristics
    const textLower = text.toLowerCase();
    for (const req of requirements.filter(Boolean)) {
      const keywords = req.toLowerCase().split(/\s+/).filter(w => w.length > 4);
      const found = keywords.some(kw => textLower.includes(kw));
      if (found) promptCoverage++;
    }
  } else {
    // Task 2: extended writing ~250 words
    if (wordCount < 150) {
      pass = false;
      notes.push('Severely under word count (< 150 words)');
    } else if (wordCount < 220) {
      notes.push('Below recommended word count (< 220 words)');
    }

    if (paragraphCount < 2) {
      notes.push('Insufficient paragraphing (< 2 paragraphs)');
    }

    // Check for position statement (opinion markers)
    const positionMarkers = ['i believe', 'in my opinion', 'i think', 'i agree', 'i disagree', 'my view', 'i would argue'];
    const hasPosition = positionMarkers.some(m => text.toLowerCase().includes(m));
    if (hasPosition) promptCoverage++;

    // Check for contrast/both sides
    const contrastMarkers = ['however', 'on the other hand', 'although', 'while', 'conversely', 'opponents', 'some people', 'others'];
    const hasContrast = contrastMarkers.some(m => text.toLowerCase().includes(m));
    if (hasContrast) promptCoverage++;

    // Check for conclusion
    const conclusionMarkers = ['in conclusion', 'to sum up', 'overall', 'in summary', 'to conclude'];
    const hasConclusion = conclusionMarkers.some(m => text.toLowerCase().includes(m));
    if (hasConclusion) promptCoverage++;
  }

  return {
    pass,
    notes: notes.join('; ') || 'Structural checks passed',
    prompt_coverage_score: promptCoverage,
  };
}

// ============================================
// Layer 2: Rule-Based Linguistic Analysis
// ============================================

function computeMetrics(text: string): Omit<RuleMetrics, 'prompt_coverage_score' | 'structural_pass' | 'structural_notes'> {
  // Sentence splitting
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const sentenceCount = sentences.length;
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const wordCount = words.length;
  const avgSentenceLength = sentenceCount > 0 ? wordCount / sentenceCount : 0;

  // Paragraph count
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  const paragraphCount = paragraphs.length || 1;

  // Connectors
  const connectorWords = [
    'however', 'therefore', 'although', 'furthermore', 'moreover',
    'nevertheless', 'consequently', 'in addition', 'for example',
    'for instance', 'as a result', 'in contrast', 'on the other hand',
    'similarly', 'meanwhile', 'in conclusion', 'to sum up'
  ];
  const textLower = text.toLowerCase();
  let connectorCount = 0;
  for (const c of connectorWords) {
    const regex = new RegExp(`\\b${c}\\b`, 'gi');
    const matches = textLower.match(regex);
    if (matches) connectorCount += matches.length;
  }

  // Type-Token Ratio
  const uniqueWords = new Set(words.map(w => w.toLowerCase().replace(/[^a-z']/g, '')));
  const typeTokenRatio = wordCount > 0 ? uniqueWords.size / wordCount : 0;

  // Repetition index (top 10 word frequency)
  const freq: Record<string, number> = {};
  const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'to', 'of', 'in', 'and', 'or', 'for', 'on', 'it', 'that', 'this', 'with', 'as', 'at', 'by', 'not', 'be', 'i']);
  for (const w of words) {
    const normalized = w.toLowerCase().replace(/[^a-z']/g, '');
    if (normalized.length > 2 && !stopWords.has(normalized)) {
      freq[normalized] = (freq[normalized] || 0) + 1;
    }
  }
  const sorted = Object.values(freq).sort((a, b) => b - a);
  const top10Sum = sorted.slice(0, 10).reduce((sum, v) => sum + v, 0);
  const contentWords = Object.values(freq).reduce((sum, v) => sum + v, 0);
  const repetitionIndex = contentWords > 0 ? top10Sum / contentWords : 0;

  // Complex sentence ratio (subordination markers)
  const complexMarkers = ['because', 'although', 'which', 'that', 'if', 'when', 'while', 'since', 'unless', 'where', 'whereas', 'who', 'whom'];
  let complexSentences = 0;
  for (const sent of sentences) {
    const sentLower = sent.toLowerCase();
    if (complexMarkers.some(m => sentLower.includes(m))) {
      complexSentences++;
    }
  }
  const complexSentenceRatio = sentenceCount > 0 ? complexSentences / sentenceCount : 0;

  // Error rate estimation (simplified - counts common patterns)
  // In production, this would call LanguageTool API or similar
  let estimatedErrors = 0;
  // Check for double spaces
  estimatedErrors += (text.match(/  +/g) || []).length;
  // Missing capitalization after period
  estimatedErrors += (text.match(/\.\s+[a-z]/g) || []).length;
  // Repeated words
  estimatedErrors += (text.match(/\b(\w+)\s+\1\b/gi) || []).length;
  // Missing articles (very basic)
  const errorRate100 = wordCount > 0 ? (estimatedErrors / wordCount) * 100 : 0;

  return {
    word_count: wordCount,
    sentence_count: sentenceCount,
    avg_sentence_length: Math.round(avgSentenceLength * 10) / 10,
    paragraph_count: paragraphCount,
    connector_count: connectorCount,
    type_token_ratio: Math.round(typeTokenRatio * 100) / 100,
    repetition_index: Math.round(repetitionIndex * 100) / 100,
    complex_sentence_ratio: Math.round(complexSentenceRatio * 100) / 100,
    error_rate_100: Math.round(errorRate100 * 10) / 10,
  };
}

function scoreFromRules(metrics: RuleMetrics, taskType: 'task1' | 'task2'): DomainScores {
  // Task Achievement (0-5)
  let ta = 0;
  if (taskType === 'task1') {
    if (metrics.word_count < 80) {
      ta = metrics.word_count < 30 ? 0 : 1;
    } else if (!metrics.structural_pass && metrics.prompt_coverage_score <= 1) {
      ta = 1;
    } else if (metrics.prompt_coverage_score === 1) {
      ta = 2;
    } else if (metrics.prompt_coverage_score === 2) {
      ta = 3;
    } else if (metrics.prompt_coverage_score >= 3 && metrics.word_count >= 110 && metrics.word_count <= 170) {
      ta = 4;
    } else if (metrics.prompt_coverage_score >= 3 && metrics.word_count >= 120 && metrics.word_count <= 150) {
      ta = 5;
    } else {
      ta = 3;
    }
    // Cap if structural fail
    if (!metrics.structural_pass && ta > 2) ta = 2;
  } else {
    // Task 2
    if (metrics.word_count < 150 || metrics.paragraph_count < 2) {
      ta = 1;
    } else if (metrics.prompt_coverage_score === 0) {
      ta = 2;
    } else if (metrics.prompt_coverage_score === 1) {
      ta = 3;
    } else if (metrics.prompt_coverage_score === 2) {
      ta = 4;
    } else if (metrics.prompt_coverage_score >= 3) {
      ta = 5;
    }
  }

  // Coherence & Cohesion (0-5)
  let cc = 0;
  if (metrics.paragraph_count <= 1) {
    cc = 1;
  } else if (metrics.paragraph_count === 2 && metrics.connector_count < 2) {
    cc = 2;
  } else if (metrics.paragraph_count >= 2 && metrics.connector_count >= 2 && metrics.connector_count <= 4) {
    cc = 3;
  } else if (metrics.paragraph_count >= 3 && metrics.connector_count >= 4 && metrics.connector_count <= 7) {
    cc = 4;
  } else if (metrics.paragraph_count >= 3 && metrics.connector_count >= 8) {
    cc = 5;
  } else {
    cc = 3; // default fallback
  }

  // Lexical Resource (0-5)
  let lr = 0;
  if (metrics.type_token_ratio < 0.32 || metrics.repetition_index > 0.55) {
    lr = 1;
  } else if (metrics.type_token_ratio < 0.38 && metrics.repetition_index > 0.45) {
    lr = 2;
  } else if (metrics.type_token_ratio < 0.45 && metrics.repetition_index > 0.35) {
    lr = 3;
  } else if (metrics.type_token_ratio < 0.52 && metrics.repetition_index > 0.28) {
    lr = 4;
  } else if (metrics.type_token_ratio >= 0.52 && metrics.repetition_index < 0.28) {
    lr = 5;
  } else {
    lr = 3;
  }

  // Grammar Range & Accuracy (0-5)
  let gra = 0;
  if (metrics.error_rate_100 > 14) {
    gra = 1;
  } else if (metrics.error_rate_100 >= 10) {
    gra = 2;
  } else if (metrics.error_rate_100 >= 6) {
    gra = 3;
  } else if (metrics.error_rate_100 >= 3) {
    gra = 4;
  } else {
    gra = 5;
  }
  // Range adjustment
  if (metrics.complex_sentence_ratio < 0.15 && gra >= 4) gra--;
  if (metrics.complex_sentence_ratio > 0.35 && metrics.error_rate_100 <= 5 && gra < 5) gra++;

  return {
    task_achievement: Math.max(0, Math.min(5, ta)),
    coherence_cohesion: Math.max(0, Math.min(5, cc)),
    lexical_resource: Math.max(0, Math.min(5, lr)),
    grammar_range_accuracy: Math.max(0, Math.min(5, gra)),
  };
}

// ============================================
// Layer 3: LLM Scoring (Prompt Builder)
// ============================================

export function buildLLMSystemPrompt(): string {
  return `You are an assessment marker for the EduX English Placement Assessment (EEPT).
You must score a candidate's writing using the EEPT analytic rubric across four domains:
1) Task Achievement
2) Coherence & Cohesion
3) Lexical Resource
4) Grammatical Range & Accuracy

Scoring scale for each domain: integer 0 to 5 only.

You must follow these rules:
- Output MUST be valid JSON only (no markdown, no extra text).
- Use the exact JSON schema provided in the user prompt.
- Scores must be integers from 0 to 5.
- Justifications must be brief and specific (1-2 sentences per domain).
- Do not reference any external tests or brands.
- Do not invent facts about the candidate.
- If the response is off-topic, incomplete, or fails core task requirements, Task Achievement must be 0-2 accordingly.
- Prefer cautious scoring. If uncertain between two scores, choose the lower score.

CEFR guidance (anchor expectations):
- B1: connected simple text; basic organisation; errors present but meaning generally clear.
- B2: clear, detailed writing; logical paragraphing; good vocabulary range; mostly controlled grammar.
- C1: well-structured argument; flexible cohesive devices; precise vocabulary; high grammatical control with rare slips.`;
}

export function buildLLMUserPrompt(
  taskType: 'task1' | 'task2',
  promptContext: WritingPromptContext,
  candidateText: string,
  metrics: RuleMetrics
): string {
  if (taskType === 'task1') {
    return `Return JSON only using this schema:
{
  "task_type": "task1",
  "prompt_id": "${promptContext.cefr_target}",
  "domain_scores": {
    "task_achievement": <int 0-5>,
    "coherence_cohesion": <int 0-5>,
    "lexical_resource": <int 0-5>,
    "grammar_range_accuracy": <int 0-5>
  },
  "justifications": {
    "task_achievement": "<string>",
    "coherence_cohesion": "<string>",
    "lexical_resource": "<string>",
    "grammar_range_accuracy": "<string>"
  },
  "cefr_band_estimate": "<A2|B1|B2|C1>"
}

Task context:
- EEPT Task 1 (Functional Writing), target level range: B1-B2
- Word count target: 120-150 (tolerance 110-170)
- Score using the rubric only.

Prompt:
${promptContext.prompt}

Requirements:
1) ${promptContext.requirement_1 || 'N/A'}
2) ${promptContext.requirement_2 || 'N/A'}
3) ${promptContext.requirement_3 || 'N/A'}

Candidate response:
${candidateText}

Structural checks (from system):
- word_count: ${metrics.word_count}
- paragraph_count: ${metrics.paragraph_count}
- structural_pass: ${metrics.structural_pass}
- structural_notes: "${metrics.structural_notes}"`;
  }

  return `Return JSON only using this schema:
{
  "task_type": "task2",
  "prompt_id": "${promptContext.cefr_target}",
  "domain_scores": {
    "task_achievement": <int 0-5>,
    "coherence_cohesion": <int 0-5>,
    "lexical_resource": <int 0-5>,
    "grammar_range_accuracy": <int 0-5>
  },
  "justifications": {
    "task_achievement": "<string>",
    "coherence_cohesion": "<string>",
    "lexical_resource": "<string>",
    "grammar_range_accuracy": "<string>"
  },
  "cefr_band_estimate": "<A2|B1|B2|C1>"
}

Task context:
- EEPT Task 2 (Extended Writing), target level range: B2-C1
- Word count target: ~250 (tolerance 220-320)
- Score using the rubric only.

Prompt:
${promptContext.prompt}

Candidate response:
${candidateText}

Structural checks (from system):
- word_count: ${metrics.word_count}
- paragraph_count: ${metrics.paragraph_count}
- structural_pass: ${metrics.structural_pass}
- structural_notes: "${metrics.structural_notes}"`;
}

export function parseLLMResponse(raw: string): { scores: DomainScores; justifications: Record<string, string> } | null {
  try {
    // Strip markdown code fences if present
    let cleaned = raw.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    }
    const parsed = JSON.parse(cleaned);
    if (!parsed.domain_scores) return null;

    const scores: DomainScores = {
      task_achievement: Math.max(0, Math.min(5, Math.round(parsed.domain_scores.task_achievement))),
      coherence_cohesion: Math.max(0, Math.min(5, Math.round(parsed.domain_scores.coherence_cohesion))),
      lexical_resource: Math.max(0, Math.min(5, Math.round(parsed.domain_scores.lexical_resource))),
      grammar_range_accuracy: Math.max(0, Math.min(5, Math.round(parsed.domain_scores.grammar_range_accuracy))),
    };

    const justifications = parsed.justifications || {};

    return { scores, justifications };
  } catch {
    return null;
  }
}

// ============================================
// Layer 4: Score Reconciliation
// ============================================

function reconcileScores(
  ruleScores: DomainScores,
  llmScores: DomainScores | null
): { finalScores: DomainScores; divergenceFlags: string[] } {
  if (!llmScores) {
    // LLM unavailable - use rule scores with flag
    return { finalScores: { ...ruleScores }, divergenceFlags: ['LLM_UNAVAILABLE'] };
  }

  const finalScores: DomainScores = {
    task_achievement: 0,
    coherence_cohesion: 0,
    lexical_resource: 0,
    grammar_range_accuracy: 0,
  };
  const divergenceFlags: string[] = [];

  const domains: (keyof DomainScores)[] = ['task_achievement', 'coherence_cohesion', 'lexical_resource', 'grammar_range_accuracy'];

  for (const domain of domains) {
    const rule = ruleScores[domain];
    const llm = llmScores[domain];
    const diff = Math.abs(rule - llm);

    if (diff <= 1) {
      // Accept LLM
      finalScores[domain] = llm;
    } else if (diff === 2) {
      // Average and round
      finalScores[domain] = Math.round((rule + llm) / 2);
    } else {
      // diff >= 3 - flag for review, use average
      finalScores[domain] = Math.round((rule + llm) / 2);
      divergenceFlags.push(`RULE_LLM_DIVERGENCE_${domain.toUpperCase()}`);
    }
  }

  return { finalScores, divergenceFlags };
}

// ============================================
// Layer 5: Confidence & Risk
// ============================================

function computeConfidenceScore(
  ruleScores: DomainScores,
  llmScores: DomainScores | null,
  similarityPercent: number,
  aiGeneratedProb: number,
  flags: string[]
): number {
  let confidence = 100;

  // LLM vs Rule agreement
  if (llmScores) {
    const domains: (keyof DomainScores)[] = ['task_achievement', 'coherence_cohesion', 'lexical_resource', 'grammar_range_accuracy'];
    for (const d of domains) {
      const diff = Math.abs(ruleScores[d] - llmScores[d]);
      if (diff >= 3) confidence -= 15;
      else if (diff === 2) confidence -= 5;
    }
  } else {
    confidence -= 20; // No LLM available
  }

  // Similarity
  if (similarityPercent > 25) confidence -= 20;
  else if (similarityPercent > 10) confidence -= 10;

  // AI generated probability
  if (aiGeneratedProb > 0.8) confidence -= 15;
  else if (aiGeneratedProb > 0.5) confidence -= 5;

  // Additional flags
  for (const flag of flags) {
    if (flag.includes('DIVERGENCE')) confidence -= 5;
    if (flag.includes('TIME_ANOMALY')) confidence -= 10;
  }

  return Math.max(0, Math.min(100, confidence));
}

// ============================================
// Main Pipeline (orchestrator)
// ============================================

export function runRuleBasedScoring(
  submission: WritingSubmission,
  promptContext: WritingPromptContext
): { ruleScores: DomainScores; metrics: RuleMetrics } {
  // Layer 1: Structural checks
  const structural = checkStructuralCompliance(
    submission.text,
    submission.task_type,
    submission.word_count,
    submission.paragraph_count,
    [promptContext.requirement_1 || '', promptContext.requirement_2 || '', promptContext.requirement_3 || '']
  );

  // Layer 2: Compute metrics
  const rawMetrics = computeMetrics(submission.text);
  const metrics: RuleMetrics = {
    ...rawMetrics,
    prompt_coverage_score: structural.prompt_coverage_score,
    structural_pass: structural.pass,
    structural_notes: structural.notes,
  };

  // Layer 2: Score from rules
  const ruleScores = scoreFromRules(metrics, submission.task_type);

  return { ruleScores, metrics };
}

export function reconcileAndFinalize(
  ruleScores: DomainScores,
  llmScores: DomainScores | null,
  taskType: 'task1' | 'task2',
  similarityPercent: number = 0,
  aiGeneratedProb: number = 0,
  existingFlags: string[] = []
): WritingScoringResult & { rule_scores: DomainScores; llm_scores: DomainScores | null } {
  // Layer 4: Reconciliation
  const { finalScores, divergenceFlags } = reconcileScores(ruleScores, llmScores);
  const allFlags = [...existingFlags, ...divergenceFlags];

  // Compute totals
  const rawTotal = finalScores.task_achievement + finalScores.coherence_cohesion +
    finalScores.lexical_resource + finalScores.grammar_range_accuracy;
  const scaledTotal = taskType === 'task2' ? rawTotal * 1.5 : rawTotal;

  // CEFR estimate from raw total
  let cefrEstimate: string;
  if (rawTotal <= 6) cefrEstimate = 'A2';
  else if (rawTotal <= 10) cefrEstimate = 'B1';
  else if (rawTotal <= 14) cefrEstimate = 'B2';
  else cefrEstimate = 'C1';

  // ACSF estimate
  let acsfEstimate: number;
  if (rawTotal <= 6) acsfEstimate = 2;
  else if (rawTotal <= 10) acsfEstimate = 3;
  else if (rawTotal <= 14) acsfEstimate = 4;
  else acsfEstimate = 5;

  // Layer 5: Confidence
  const confidence = computeConfidenceScore(ruleScores, llmScores, similarityPercent, aiGeneratedProb, allFlags);

  // Determine if human review needed
  let needsReview = false;
  let reviewReason: string | null = null;

  if (divergenceFlags.some(f => f.includes('DIVERGENCE'))) {
    needsReview = true;
    reviewReason = 'flagged';
  }
  if (similarity_check_exceeds_threshold(similarityPercent, 25)) {
    needsReview = true;
    reviewReason = 'flagged';
    allFlags.push('SIMILARITY_HIGH');
  } else if (similarity_check_exceeds_threshold(similarityPercent, 10)) {
    allFlags.push('SIMILARITY_REVIEW');
  }
  if (confidence < 65) {
    needsReview = true;
    reviewReason = reviewReason || 'flagged';
    allFlags.push('LOW_CONFIDENCE');
  }

  return {
    rule_scores: ruleScores,
    rule_metrics: {} as RuleMetrics, // caller should set this
    llm_scores: llmScores,
    llm_justifications: null,
    final_scores: finalScores,
    raw_total_0_20: rawTotal,
    scaled_total: scaledTotal,
    cefr_estimate: cefrEstimate,
    acsf_estimate: acsfEstimate,
    confidence_score: confidence,
    flags: allFlags,
    needs_human_review: needsReview,
    review_reason: reviewReason,
  };
}

function similarity_check_exceeds_threshold(value: number, threshold: number): boolean {
  return value > threshold;
}

// ============================================
// Writing CEFR from raw total (for combined writing)
// ============================================

export function writingCEFRFromRawTotal(rawTotal: number): string {
  if (rawTotal <= 12) return 'A2';
  if (rawTotal <= 20) return 'B1';
  if (rawTotal <= 28) return 'B2';
  return 'C1';
}
