/**
 * POST /api/ebpa/submit-final
 * Public route - Candidate submits completed assessment
 * Auto-scores MCQ, stores writing submissions, triggers scoring pipeline
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  try {
    const body = await request.json() as any;
    const { token, mcq_responses, writing_task1, writing_task2, integrity_data } = body;

    if (!token) {
      return jsonResponse({ error: 'Missing token' }, 400);
    }

    // Validate assessment
    const assessment = await env.DB.prepare(`
      SELECT assessment_id, tenant_id, form_id, status, candidate_user_id
      FROM eept_assessments WHERE secure_token = ?
    `).bind(token).first();

    if (!assessment) {
      return jsonResponse({ error: 'Invalid assessment' }, 404);
    }

    if (!['issued', 'started'].includes(assessment.status as string)) {
      return jsonResponse({ error: 'Assessment already submitted' }, 403);
    }

    const assessmentId = assessment.assessment_id as string;
    const tenantId = assessment.tenant_id as string;
    const formId = assessment.form_id as string;

    // ---- Score MCQ Responses ----
    let grammarCorrect = 0;
    let readingCorrect = 0;

    if (mcq_responses && Array.isArray(mcq_responses)) {
      // Load answer key
      const questions = await env.DB.prepare(`
        SELECT question_id, section, correct_option, points
        FROM eept_questions WHERE form_id = ?
      `).bind(formId).all();

      const answerKey = new Map<string, { correct: string; section: string; points: number }>();
      for (const q of questions.results as any[]) {
        answerKey.set(q.question_id, {
          correct: q.correct_option,
          section: q.section,
          points: q.points,
        });
      }

      // Score and store each response
      const stmts = [];
      for (const resp of mcq_responses) {
        const key = answerKey.get(resp.question_id);
        if (!key) continue;

        const isCorrect = resp.selected_option?.toUpperCase() === key.correct ? 1 : 0;

        if (isCorrect) {
          if (key.section === 'grammar') grammarCorrect++;
          else if (key.section === 'reading') readingCorrect++;
        }

        stmts.push(
          env.DB.prepare(`
            INSERT INTO eept_responses_mcq (response_id, assessment_id, question_id, selected_option, is_correct, response_time_seconds)
            VALUES (?, ?, ?, ?, ?, ?)
          `).bind(
            crypto.randomUUID(), assessmentId, resp.question_id,
            resp.selected_option?.toUpperCase() || '', isCorrect,
            resp.response_time_seconds || null
          )
        );
      }

      if (stmts.length > 0) {
        await env.DB.batch(stmts);
      }
    }

    // ---- Store Writing Submissions ----
    const writingSubmissionIds: { task1?: string; task2?: string } = {};

    if (writing_task1?.text) {
      const subId = crypto.randomUUID();
      writingSubmissionIds.task1 = subId;
      const text = writing_task1.text;
      const wordCount = text.split(/\s+/).filter((w: string) => w.length > 0).length;
      const paraCount = text.split(/\n\s*\n/).filter((p: string) => p.trim().length > 0).length || 1;

      await env.DB.prepare(`
        INSERT INTO eept_writing_submissions (submission_id, assessment_id, task_type, prompt_id, text, word_count, paragraph_count)
        VALUES (?, ?, 'task1', ?, ?, ?, ?)
      `).bind(subId, assessmentId, writing_task1.prompt_id || '', text, wordCount, paraCount).run();
    }

    if (writing_task2?.text) {
      const subId = crypto.randomUUID();
      writingSubmissionIds.task2 = subId;
      const text = writing_task2.text;
      const wordCount = text.split(/\s+/).filter((w: string) => w.length > 0).length;
      const paraCount = text.split(/\n\s*\n/).filter((p: string) => p.trim().length > 0).length || 1;

      await env.DB.prepare(`
        INSERT INTO eept_writing_submissions (submission_id, assessment_id, task_type, prompt_id, text, word_count, paragraph_count)
        VALUES (?, ?, 'task2', ?, ?, ?, ?)
      `).bind(subId, assessmentId, writing_task2.prompt_id || '', text, wordCount, paraCount).run();
    }

    // ---- Store Integrity Data ----
    if (integrity_data) {
      const checks = [];
      if (integrity_data.tab_switch_count !== undefined) {
        checks.push(env.DB.prepare(`
          INSERT INTO eept_integrity_checks (check_id, assessment_id, check_type, score, details_json)
          VALUES (?, ?, 'tab_switch', ?, ?)
        `).bind(crypto.randomUUID(), assessmentId, integrity_data.tab_switch_count,
          JSON.stringify({ count: integrity_data.tab_switch_count })));
      }
      if (integrity_data.total_time_minutes !== undefined) {
        checks.push(env.DB.prepare(`
          INSERT INTO eept_integrity_checks (check_id, assessment_id, check_type, score, details_json)
          VALUES (?, ?, 'time_anomaly', ?, ?)
        `).bind(crypto.randomUUID(), assessmentId, integrity_data.total_time_minutes,
          JSON.stringify({ total_minutes: integrity_data.total_time_minutes })));
      }
      if (checks.length > 0) await env.DB.batch(checks);
    }

    // ---- Update Status ----
    await env.DB.prepare(`
      UPDATE eept_assessments SET status = 'scoring_in_progress', submitted_at = datetime('now')
      WHERE assessment_id = ?
    `).bind(assessmentId).run();

    // ---- Audit Log ----
    await env.DB.prepare(`
      INSERT INTO eept_audit_log (tenant_id, assessment_id, actor_type, event_type, event_data_json)
      VALUES (?, ?, 'candidate', 'ASSESSMENT_SUBMITTED', ?)
    `).bind(tenantId, assessmentId, JSON.stringify({
      grammar_correct: grammarCorrect,
      reading_correct: readingCorrect,
      writing_task1_submitted: !!writingSubmissionIds.task1,
      writing_task2_submitted: !!writingSubmissionIds.task2,
    })).run();

    // ---- Trigger Writing Scoring (inline for now, queue in production) ----
    // In production, this would enqueue to Cloudflare Queue.
    // For pilot, we run the rule-based scoring synchronously and skip LLM.
    try {
      await runInlineWritingScoring(env, assessmentId, formId);
      await runInlineFinalisation(env, assessmentId, tenantId, grammarCorrect, readingCorrect);
    } catch (scoringErr: any) {
      console.error('Inline scoring error (non-blocking):', scoringErr.message);
      // Assessment remains in 'scoring_in_progress' for manual finalisation
    }

    return jsonResponse({
      success: true,
      assessment_id: assessmentId,
      status: 'scoring_in_progress',
      mcq_scores: {
        grammar: { correct: grammarCorrect, total: 20, score: grammarCorrect * 1.0 },
        reading: { correct: readingCorrect, total: 20, score: readingCorrect * 1.5 },
      },
    });

  } catch (e: any) {
    console.error('EEPT submit error:', e);
    return jsonResponse({ error: 'Failed to submit assessment', debug: e.message }, 500);
  }
};

// ============================================
// Inline Scoring (Phase 1 - no queue)
// ============================================

async function runInlineWritingScoring(env: any, assessmentId: string, formId: string) {
  const { runRuleBasedScoring, reconcileAndFinalize } = await import('../../utils/eept-writing-engine');

  const submissions = await env.DB.prepare(`
    SELECT ws.*, wp.prompt, wp.requirement_1, wp.requirement_2, wp.requirement_3, wp.cefr_target
    FROM eept_writing_submissions ws
    JOIN eept_writing_prompts wp ON ws.prompt_id = wp.prompt_id
    WHERE ws.assessment_id = ?
  `).bind(assessmentId).all();

  for (const sub of submissions.results as any[]) {
    const promptContext = {
      prompt: sub.prompt,
      requirement_1: sub.requirement_1,
      requirement_2: sub.requirement_2,
      requirement_3: sub.requirement_3,
      cefr_target: sub.cefr_target,
    };

    const { ruleScores, metrics } = runRuleBasedScoring({
      submission_id: sub.submission_id,
      assessment_id: sub.assessment_id,
      task_type: sub.task_type,
      prompt_id: sub.prompt_id,
      text: sub.text,
      word_count: sub.word_count,
      paragraph_count: sub.paragraph_count,
    }, promptContext);

    // For Phase 1 (pilot): no LLM, use rule scores as final
    const result = reconcileAndFinalize(ruleScores, null, sub.task_type, 0, 0, []);

    await env.DB.prepare(`
      INSERT INTO eept_writing_scores (
        score_id, writing_submission_id, engine_version,
        rule_scores_json, rule_metrics_json, llm_scores_json,
        final_scores_json, raw_total_0_20, scaled_total,
        cefr_estimate, acsf_estimate, confidence_score, flags_json,
        needs_human_review, review_reason
      ) VALUES (?, ?, 'hybrid-v1.0', ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(), sub.submission_id,
      JSON.stringify(ruleScores), JSON.stringify(metrics),
      JSON.stringify(result.final_scores), result.raw_total_0_20, result.scaled_total,
      result.cefr_estimate, result.acsf_estimate, result.confidence_score,
      JSON.stringify(result.flags), result.needs_human_review ? 1 : 0,
      result.review_reason
    ).run();
  }
}

async function runInlineFinalisation(
  env: any, assessmentId: string, tenantId: string,
  grammarCorrect: number, readingCorrect: number
) {
  const { scoreEEPT, evaluateBenchmark } = await import('../../utils/eept-scoring-engine');

  // Load writing scores
  const writingScores = await env.DB.prepare(`
    SELECT ws.task_type, wsc.final_scores_json, wsc.needs_human_review
    FROM eept_writing_scores wsc
    JOIN eept_writing_submissions ws ON wsc.writing_submission_id = ws.submission_id
    WHERE ws.assessment_id = ?
  `).bind(assessmentId).all();

  // Check if any need review
  const needsReview = writingScores.results.some((ws: any) => ws.needs_human_review);

  if (needsReview) {
    await env.DB.prepare("UPDATE eept_assessments SET status = 'review_required' WHERE assessment_id = ?")
      .bind(assessmentId).run();
    return;
  }

  // Parse writing domain scores
  let t1Scores = { taskAchievement: 0, coherence: 0, lexical: 0, grammar: 0 };
  let t2Scores = { taskAchievement: 0, coherence: 0, lexical: 0, grammar: 0 };

  for (const ws of writingScores.results as any[]) {
    const scores = JSON.parse(ws.final_scores_json);
    const mapped = {
      taskAchievement: scores.task_achievement || 0,
      coherence: scores.coherence_cohesion || 0,
      lexical: scores.lexical_resource || 0,
      grammar: scores.grammar_range_accuracy || 0,
    };
    if (ws.task_type === 'task1') t1Scores = mapped;
    else if (ws.task_type === 'task2') t2Scores = mapped;
  }

  // Load scoring config
  const configRow = await env.DB.prepare(
    "SELECT map_json FROM eept_scoring_maps WHERE map_type = 'cefr_cutoffs' AND is_active = 1 AND tenant_id IS NULL"
  ).first();

  if (!configRow) {
    throw new Error('No scoring config found');
  }

  const config = JSON.parse(configRow.map_json as string);

  // Run scoring engine
  const result = scoreEEPT({
    grammarCorrect,
    readingCorrect,
    t1: t1Scores,
    t2: t2Scores,
  }, config);

  // Run benchmark engine
  const benchmarkConfigRow = await env.DB.prepare(
    "SELECT map_json FROM eept_scoring_maps WHERE map_type = 'course_benchmarks' AND is_active = 1 AND tenant_id IS NULL"
  ).first();

  let benchmarkResult = null;
  if (benchmarkConfigRow) {
    const assessment = await env.DB.prepare(
      'SELECT course_intended FROM eept_assessments WHERE assessment_id = ?'
    ).bind(assessmentId).first();

    const benchmarkConfig = JSON.parse(benchmarkConfigRow.map_json as string);
    benchmarkResult = evaluateBenchmark(benchmarkConfig, {
      overall_cefr: result.overallCEFR_final,
      reading_cefr: result.readingCEFR,
      writing_cefr: result.writingCEFR,
      ielts_indicative: result.ieltsIndicative,
      course_code: (assessment?.course_intended as string) || '*',
    }, { delivery_type: 'default' });
  }

  // Save results
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
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    assessmentId, result.grammarScore, result.readingScore,
    result.writingTask1Score, result.writingTask2Score, result.writingRawTotal,
    result.compositeScore, result.readingCEFR, result.writingCEFR,
    result.overallCEFR_preFloor, result.overallCEFR_final, result.ieltsIndicative,
    result.readingACSF, result.writingACSF,
    result.skillFloorApplied ? 1 : 0, result.skillFloorReason,
    JSON.stringify({}), JSON.stringify(benchmarkResult || {}),
    reportId, validUntil, config.version || 'v1.0-pilot', 'ebpa-score-v1.0'
  ).run();

  // Update assessment status
  await env.DB.prepare(
    "UPDATE eept_assessments SET status = 'finalised', finalised_at = datetime('now') WHERE assessment_id = ?"
  ).bind(assessmentId).run();

  // Audit logs
  await env.DB.batch([
    env.DB.prepare(`
      INSERT INTO eept_audit_log (tenant_id, assessment_id, actor_type, event_type, event_data_json)
      VALUES (?, ?, 'system', 'SCORE_ENGINE_APPLIED', ?)
    `).bind(tenantId, assessmentId, JSON.stringify({
      engine_version: 'ebpa-score-v1.0',
      config_version: config.version,
      composite_score: result.compositeScore,
    })),
    env.DB.prepare(`
      INSERT INTO eept_audit_log (tenant_id, assessment_id, actor_type, event_type, event_data_json)
      VALUES (?, ?, 'system', 'FINALISE_COMPLETED', ?)
    `).bind(tenantId, assessmentId, JSON.stringify({ report_id: reportId })),
  ]);
}

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
