/**
 * POST /api/ebpa/review/complete
 * Protected - Reviewer submits review with domain score overrides
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env, data } = context;
  const userId = (data as any).user;
  const tenantId = (data as any).tenant_id;

  try {
    const body = await request.json() as any;
    const { writing_submission_id, domain_scores, notes, review_reason } = body;

    if (!writing_submission_id || !domain_scores) {
      return jsonResponse({ error: 'writing_submission_id and domain_scores required' }, 400);
    }

    // Validate domain scores
    const { task_achievement, coherence_cohesion, lexical_resource, grammar_range_accuracy } = domain_scores;
    for (const [key, val] of Object.entries({ task_achievement, coherence_cohesion, lexical_resource, grammar_range_accuracy })) {
      if (typeof val !== 'number' || val < 0 || val > 5) {
        return jsonResponse({ error: `Invalid ${key}: must be 0-5` }, 400);
      }
    }

    // Verify submission exists and belongs to tenant
    const sub = await env.DB.prepare(`
      SELECT ws.submission_id, ws.assessment_id, ws.task_type,
             a.tenant_id, a.status
      FROM eept_writing_submissions ws
      JOIN eept_assessments a ON ws.assessment_id = a.assessment_id
      WHERE ws.submission_id = ? AND a.tenant_id = ?
    `).bind(writing_submission_id, tenantId).first();

    if (!sub) {
      return jsonResponse({ error: 'Submission not found' }, 404);
    }

    const rawTotal = task_achievement + coherence_cohesion + lexical_resource + grammar_range_accuracy;
    const scaledTotal = sub.task_type === 'task2' ? rawTotal * 1.5 : rawTotal;

    // Save human review
    const reviewId = crypto.randomUUID();
    await env.DB.prepare(`
      INSERT INTO eept_human_reviews (
        review_id, writing_submission_id, reviewer_user_id,
        review_reason, final_domain_scores_json, final_raw_total, final_notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      reviewId, writing_submission_id, userId,
      review_reason || 'flagged',
      JSON.stringify(domain_scores), rawTotal, notes || null
    ).run();

    // Update writing_scores final scores
    await env.DB.prepare(`
      UPDATE eept_writing_scores SET
        final_scores_json = ?,
        raw_total_0_20 = ?,
        scaled_total = ?,
        needs_human_review = 0
      WHERE writing_submission_id = ?
    `).bind(JSON.stringify(domain_scores), rawTotal, scaledTotal, writing_submission_id).run();

    // Audit log
    await env.DB.prepare(`
      INSERT INTO eept_audit_log (tenant_id, assessment_id, actor_user_id, actor_type, event_type, event_data_json)
      VALUES (?, ?, ?, 'user', 'HUMAN_REVIEW_COMPLETED', ?)
    `).bind(tenantId, sub.assessment_id, userId, JSON.stringify({
      submission_id: writing_submission_id,
      task_type: sub.task_type,
      domain_scores,
      raw_total: rawTotal,
    })).run();

    // Check if all reviews are complete, then try finalisation
    const pendingReviews = await env.DB.prepare(`
      SELECT COUNT(*) as cnt FROM eept_writing_scores wsc
      JOIN eept_writing_submissions ws ON wsc.writing_submission_id = ws.submission_id
      WHERE ws.assessment_id = ? AND wsc.needs_human_review = 1
    `).bind(sub.assessment_id).first();

    let finalised = false;
    if ((pendingReviews?.cnt as number) === 0) {
      // All reviews done - trigger finalisation
      try {
        const { scoreEEPT, evaluateBenchmark } = await import('../../../utils/eept-scoring-engine');

        // Reload MCQ scores
        const grammarCount = await env.DB.prepare(
          "SELECT COUNT(*) as cnt FROM eept_responses_mcq r JOIN eept_questions q ON r.question_id = q.question_id WHERE r.assessment_id = ? AND q.section = 'grammar' AND r.is_correct = 1"
        ).bind(sub.assessment_id).first();
        const readingCount = await env.DB.prepare(
          "SELECT COUNT(*) as cnt FROM eept_responses_mcq r JOIN eept_questions q ON r.question_id = q.question_id WHERE r.assessment_id = ? AND q.section = 'reading' AND r.is_correct = 1"
        ).bind(sub.assessment_id).first();

        // Reload writing scores
        const wsRows = await env.DB.prepare(`
          SELECT ws.task_type, wsc.final_scores_json
          FROM eept_writing_scores wsc
          JOIN eept_writing_submissions ws ON wsc.writing_submission_id = ws.submission_id
          WHERE ws.assessment_id = ?
        `).bind(sub.assessment_id).all();

        let t1 = { taskAchievement: 0, coherence: 0, lexical: 0, grammar: 0 };
        let t2 = { taskAchievement: 0, coherence: 0, lexical: 0, grammar: 0 };

        for (const row of wsRows.results as any[]) {
          const scores = JSON.parse(row.final_scores_json);
          const mapped = {
            taskAchievement: scores.task_achievement || 0,
            coherence: scores.coherence_cohesion || 0,
            lexical: scores.lexical_resource || 0,
            grammar: scores.grammar_range_accuracy || 0,
          };
          if (row.task_type === 'task1') t1 = mapped;
          else t2 = mapped;
        }

        const configRow = await env.DB.prepare(
          "SELECT map_json FROM eept_scoring_maps WHERE map_type = 'cefr_cutoffs' AND is_active = 1 AND tenant_id IS NULL"
        ).first();
        const config = JSON.parse(configRow!.map_json as string);

        const result = scoreEEPT({
          grammarCorrect: (grammarCount?.cnt as number) || 0,
          readingCorrect: (readingCount?.cnt as number) || 0,
          t1, t2,
        }, config);

        const reportId = crypto.randomUUID();
        const validUntil = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        await env.DB.prepare(`
          INSERT OR REPLACE INTO eept_assessment_results (
            assessment_id, grammar_score, reading_score,
            writing_task1_score, writing_task2_score, writing_raw_total,
            composite_score, reading_cefr, writing_cefr,
            overall_cefr_pre_floor, overall_cefr, ielts_indicative,
            reading_acsf, writing_acsf, skill_floor_applied, skill_floor_reason,
            integrity_json, benchmark_json, report_id, report_valid_until,
            scoring_config_version, score_engine_version
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '{}', '{}', ?, ?, ?, ?)
        `).bind(
          sub.assessment_id, result.grammarScore, result.readingScore,
          result.writingTask1Score, result.writingTask2Score, result.writingRawTotal,
          result.compositeScore, result.readingCEFR, result.writingCEFR,
          result.overallCEFR_preFloor, result.overallCEFR_final, result.ieltsIndicative,
          result.readingACSF, result.writingACSF,
          result.skillFloorApplied ? 1 : 0, result.skillFloorReason,
          reportId, validUntil, config.version || 'v1.0-pilot', 'ebpa-score-v1.0'
        ).run();

        await env.DB.prepare(
          "UPDATE eept_assessments SET status = 'finalised', finalised_at = datetime('now') WHERE assessment_id = ?"
        ).bind(sub.assessment_id).run();

        finalised = true;
      } catch (finErr: any) {
        console.error('Post-review finalisation error:', finErr);
      }
    }

    return jsonResponse({
      success: true,
      review_id: reviewId,
      assessment_finalised: finalised,
    });

  } catch (e: any) {
    console.error('EEPT review complete error:', e);
    return jsonResponse({ error: 'Failed to complete review', debug: e.message }, 500);
  }
};

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}
