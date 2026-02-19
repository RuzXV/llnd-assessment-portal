/**
 * GET /api/ebpa/assessment/:id/detail
 * Protected - RTO Manager views full assessment detail
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { params, env, data } = context;
  const assessmentId = params.id as string;
  const tenantId = (data as any).tenant_id;

  try {
    // Load assessment with candidate info
    const assessment = await env.DB.prepare(`
      SELECT a.*, c.first_name, c.last_name, c.email, c.mobile, c.student_id,
             f.name as form_name
      FROM eept_assessments a
      JOIN eept_candidates c ON a.candidate_user_id = c.candidate_id
      JOIN eept_test_forms f ON a.form_id = f.form_id
      WHERE a.assessment_id = ? AND a.tenant_id = ?
    `).bind(assessmentId, tenantId).first();

    if (!assessment) {
      return jsonResponse({ error: 'Assessment not found' }, 404);
    }

    // Load results (if finalised)
    const results = await env.DB.prepare(
      'SELECT * FROM eept_assessment_results WHERE assessment_id = ?'
    ).bind(assessmentId).first();

    // Load writing scores
    const writingScores = await env.DB.prepare(`
      SELECT ws.task_type, ws.word_count, ws.paragraph_count,
             wsc.rule_scores_json, wsc.llm_scores_json, wsc.final_scores_json,
             wsc.raw_total_0_20, wsc.scaled_total, wsc.confidence_score,
             wsc.flags_json, wsc.needs_human_review, wsc.engine_version
      FROM eept_writing_submissions ws
      LEFT JOIN eept_writing_scores wsc ON ws.submission_id = wsc.writing_submission_id
      WHERE ws.assessment_id = ?
    `).bind(assessmentId).all();

    // Load integrity checks
    const integrity = await env.DB.prepare(
      'SELECT check_type, score, details_json FROM eept_integrity_checks WHERE assessment_id = ?'
    ).bind(assessmentId).all();

    // Load audit trail
    const auditTrail = await env.DB.prepare(
      'SELECT event_type, actor_type, event_data_json, created_at FROM eept_audit_log WHERE assessment_id = ? ORDER BY created_at ASC'
    ).bind(assessmentId).all();

    // Load human reviews (if any)
    const reviews = await env.DB.prepare(`
      SELECT hr.*, u.email as reviewer_email
      FROM eept_human_reviews hr
      JOIN eept_writing_submissions ws ON hr.writing_submission_id = ws.submission_id
      LEFT JOIN users u ON hr.reviewer_user_id = u.user_id
      WHERE ws.assessment_id = ?
    `).bind(assessmentId).all();

    // Parse JSON fields safely
    const parseJSON = (val: any) => {
      if (!val) return null;
      try { return JSON.parse(val as string); } catch { return val; }
    };

    return jsonResponse({
      assessment: {
        assessment_id: assessment.assessment_id,
        status: assessment.status,
        form_name: assessment.form_name,
        issued_at: assessment.issued_at,
        started_at: assessment.started_at,
        submitted_at: assessment.submitted_at,
        finalised_at: assessment.finalised_at,
        course_intended: assessment.course_intended,
        cohort_tag: assessment.cohort_tag,
        agent_name: assessment.agent_name,
        notes: assessment.notes,
      },
      candidate: {
        first_name: assessment.first_name,
        last_name: assessment.last_name,
        email: assessment.email,
        mobile: assessment.mobile,
        student_id: assessment.student_id,
      },
      results: results ? {
        composite_score: results.composite_score,
        grammar_score: results.grammar_score,
        reading_score: results.reading_score,
        writing_task1_score: results.writing_task1_score,
        writing_task2_score: results.writing_task2_score,
        writing_raw_total: results.writing_raw_total,
        overall_cefr: results.overall_cefr,
        overall_cefr_pre_floor: results.overall_cefr_pre_floor,
        reading_cefr: results.reading_cefr,
        writing_cefr: results.writing_cefr,
        ielts_indicative: results.ielts_indicative,
        reading_acsf: results.reading_acsf,
        writing_acsf: results.writing_acsf,
        skill_floor_applied: results.skill_floor_applied,
        skill_floor_reason: results.skill_floor_reason,
        benchmark: parseJSON(results.benchmark_json),
        report_id: results.report_id,
        report_valid_until: results.report_valid_until,
      } : null,
      writing_details: writingScores.results.map((ws: any) => ({
        task_type: ws.task_type,
        word_count: ws.word_count,
        paragraph_count: ws.paragraph_count,
        rule_scores: parseJSON(ws.rule_scores_json),
        llm_scores: parseJSON(ws.llm_scores_json),
        final_scores: parseJSON(ws.final_scores_json),
        raw_total: ws.raw_total_0_20,
        scaled_total: ws.scaled_total,
        confidence: ws.confidence_score,
        flags: parseJSON(ws.flags_json),
        needs_review: ws.needs_human_review,
      })),
      integrity: integrity.results.map((ic: any) => ({
        type: ic.check_type,
        score: ic.score,
        details: parseJSON(ic.details_json),
      })),
      audit_trail: auditTrail.results.map((al: any) => ({
        event: al.event_type,
        actor: al.actor_type,
        data: parseJSON(al.event_data_json),
        timestamp: al.created_at,
      })),
      human_reviews: reviews.results,
    });

  } catch (e: any) {
    console.error('EEPT detail error:', e);
    return jsonResponse({ error: 'Failed to load assessment detail', debug: e.message }, 500);
  }
};

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
