/**
 * GET /api/ebpa/review/queue
 * Protected - Reviewer/RTO Manager views flagged scripts
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, data } = context;
  const tenantId = (data as any).tenant_id;

  try {
    const queue = await env.DB.prepare(`
      SELECT
        ws.submission_id, ws.assessment_id, ws.task_type, ws.text, ws.word_count,
        wsc.rule_scores_json, wsc.llm_scores_json, wsc.final_scores_json,
        wsc.confidence_score, wsc.flags_json, wsc.review_reason,
        c.first_name, c.last_name, c.email,
        a.submitted_at, a.course_intended,
        wp.prompt, wp.requirement_1, wp.requirement_2, wp.requirement_3
      FROM eept_writing_scores wsc
      JOIN eept_writing_submissions ws ON wsc.writing_submission_id = ws.submission_id
      JOIN eept_assessments a ON ws.assessment_id = a.assessment_id
      JOIN eept_candidates c ON a.candidate_user_id = c.candidate_id
      JOIN eept_writing_prompts wp ON ws.prompt_id = wp.prompt_id
      WHERE a.tenant_id = ? AND wsc.needs_human_review = 1
      AND NOT EXISTS (
        SELECT 1 FROM eept_human_reviews hr WHERE hr.writing_submission_id = ws.submission_id
      )
      ORDER BY a.submitted_at ASC
    `).bind(tenantId).all();

    const parseJSON = (val: any) => {
      if (!val) return null;
      try { return JSON.parse(val as string); } catch { return val; }
    };

    return new Response(JSON.stringify({
      queue: queue.results.map((item: any) => ({
        submission_id: item.submission_id,
        assessment_id: item.assessment_id,
        task_type: item.task_type,
        candidate_name: `${item.first_name} ${item.last_name}`,
        email: item.email,
        submitted_at: item.submitted_at,
        course_intended: item.course_intended,
        writing_text: item.text,
        word_count: item.word_count,
        prompt: item.prompt,
        requirements: [item.requirement_1, item.requirement_2, item.requirement_3].filter(Boolean),
        rule_scores: parseJSON(item.rule_scores_json),
        llm_scores: parseJSON(item.llm_scores_json),
        final_scores: parseJSON(item.final_scores_json),
        confidence: item.confidence_score,
        flags: parseJSON(item.flags_json),
        review_reason: item.review_reason,
      })),
      total: queue.results.length,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (e: any) {
    console.error('EEPT review queue error:', e);
    return new Response(JSON.stringify({ error: 'Failed to load review queue' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
};
