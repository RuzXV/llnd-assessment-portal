import { scoreAttempt, generateReportJSON, Question, Response } from '../../../utils/scoring';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, params, env } = context;
  const token = params.token as string;

  try {
    const body = await request.json() as any;
    const { responses } = body;

    // Get attempt with tenant info
    const attempt = await env.DB.prepare(`
      SELECT a.attempt_id, a.seat_id, a.version_id, a.status, a.student_name, a.student_id,
             t.name as rto_name, t.logo_url
      FROM assessment_attempts a
      JOIN tenants t ON a.tenant_id = t.tenant_id
      WHERE a.token_hash = ?
    `).bind(token).first();

    if (!attempt || attempt.status !== 'in_progress') {
      return new Response(JSON.stringify({ error: 'Invalid submission state' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get all questions for this assessment version with new fields
    const questionData = await env.DB.prepare(`
      SELECT question_id, domain, acsf_level, difficulty_tag, response_type,
             correct_response, correct_answer, max_score, weight
      FROM questions
      WHERE version_id = ?
      ORDER BY order_index
    `).bind(attempt.version_id).all();

    // Map questions to scoring format
    const questions: Question[] = questionData.results.map((q: any) => ({
      question_id: q.question_id,
      domain: q.domain || q.acsf_domain,
      acsf_level: q.acsf_level || 3,
      difficulty_tag: q.difficulty_tag || 'core',
      response_type: q.response_type || 'mcq',
      correct_response: q.correct_response || q.correct_answer,
      max_score: q.max_score || 1.0,
      weight: q.weight || 1.0
    }));

    // Map responses to scoring format
    const responsesForScoring: Response[] = responses.map((r: any) => ({
      questionId: r.questionId,
      answer: String(r.answer || '')
    }));

    // Score the attempt using the new scoring engine
    const scoringResult = scoreAttempt(questions, responsesForScoring);

    // Generate the report JSON
    const submittedAt = Math.floor(Date.now() / 1000);
    const reportJSON = generateReportJSON(
      scoringResult,
      attempt.student_name as string || 'Unknown',
      attempt.student_id as string || '',
      attempt.rto_name as string || 'RTO',
      attempt.logo_url as string | null,
      submittedAt,
      attempt.attempt_id as string
    );

    // Build database statements
    const dbStatements = [];

    // Insert individual responses
    for (const qs of scoringResult.questionScores) {
      const originalResponse = responses.find((r: any) => r.questionId === qs.questionId);
      dbStatements.push(env.DB.prepare(`
        INSERT INTO responses (response_id, attempt_id, question_id, response_data, is_correct, points_awarded)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        crypto.randomUUID(),
        attempt.attempt_id,
        qs.questionId,
        JSON.stringify(originalResponse?.answer || ''),
        qs.isCorrect ? 1 : 0,
        qs.scoreAwarded
      ));
    }

    // Insert domain scores
    for (const ds of scoringResult.domainScores) {
      dbStatements.push(env.DB.prepare(`
        INSERT OR REPLACE INTO domain_scores
        (score_id, attempt_id, domain, raw_score, max_score, percentage,
         acsf2_percent, acsf3_core_percent, acsf3_stretch_percent,
         estimated_acsf_band, outcome, justification, strategies)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        crypto.randomUUID(),
        attempt.attempt_id,
        ds.domain,
        ds.rawScore,
        ds.maxScore,
        ds.percentage,
        ds.acsf2Percent,
        ds.acsf3CorePercent,
        ds.acsf3StretchPercent,
        ds.estimatedACSFBand,
        ds.outcome,
        ds.justification,
        JSON.stringify(ds.strategies)
      ));
    }

    // Update attempt with results
    dbStatements.push(env.DB.prepare(`
      UPDATE assessment_attempts
      SET status = 'submitted',
          submitted_at = ?,
          total_score = ?,
          domain_breakdown = ?,
          report_json = ?,
          benchmark_version = ?,
          overall_outcome = ?,
          outcome_flag = ?,
          draft_responses = NULL
      WHERE attempt_id = ?
    `).bind(
      submittedAt,
      scoringResult.totalScore,
      JSON.stringify(reportJSON.domains),
      JSON.stringify(reportJSON),
      scoringResult.benchmarkVersion,
      scoringResult.overallOutcome,
      scoringResult.overallOutcome === 'support_required' ? 'support_required' : 'competent',
      attempt.attempt_id
    ));

    // Update seat status
    dbStatements.push(env.DB.prepare(`
      UPDATE seats
      SET status = 'consumed', consumed_at = ?
      WHERE seat_id = ?
    `).bind(submittedAt, attempt.seat_id));

    // Execute all statements
    await env.DB.batch(dbStatements);

    return new Response(JSON.stringify({
      success: true,
      message: 'Assessment submitted successfully',
      result: {
        totalScore: scoringResult.totalScore,
        overallOutcome: scoringResult.overallOutcome
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (e: any) {
    console.error("Submission Error:", e);
    return new Response(JSON.stringify({ error: 'Submission failed', debug: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
