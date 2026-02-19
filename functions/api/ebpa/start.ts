/**
 * GET /api/ebpa/start?token=...
 * Public route - Candidate starts assessment via secure token
 * Returns form definition (questions, passages, prompts)
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const token = url.searchParams.get('token');

  if (!token) {
    return jsonResponse({ error: 'Missing token parameter' }, 400);
  }

  try {
    // Find assessment by raw token (stored directly for lookup)
    const assessment = await env.DB.prepare(`
      SELECT
        a.assessment_id, a.tenant_id, a.candidate_user_id, a.form_id,
        a.status, a.token_expires_at,
        c.first_name, c.last_name, c.email,
        t.name as rto_name, t.logo_url, t.brand_primary_color,
        f.name as form_name
      FROM eept_assessments a
      JOIN eept_candidates c ON a.candidate_user_id = c.candidate_id
      JOIN tenants t ON a.tenant_id = t.tenant_id
      JOIN eept_test_forms f ON a.form_id = f.form_id
      WHERE a.secure_token = ?
    `).bind(token).first();

    if (!assessment) {
      return jsonResponse({ error: 'Invalid assessment link' }, 404);
    }

    // Check expiry
    if (assessment.token_expires_at) {
      const expiry = new Date(assessment.token_expires_at as string).getTime();
      if (Date.now() > expiry && assessment.status !== 'submitted' && assessment.status !== 'finalised') {
        await env.DB.prepare("UPDATE eept_assessments SET status = 'cancelled' WHERE assessment_id = ?")
          .bind(assessment.assessment_id).run();
        return jsonResponse({ error: 'Assessment link has expired' }, 403);
      }
    }

    // Check status
    if (['submitted', 'scoring_in_progress', 'review_required', 'finalised', 'cancelled'].includes(assessment.status as string)) {
      return jsonResponse({
        error: 'Assessment is no longer available',
        status: assessment.status,
      }, 403);
    }

    // Mark as started if first access
    if (assessment.status === 'issued') {
      await env.DB.prepare(
        "UPDATE eept_assessments SET status = 'started', started_at = datetime('now') WHERE assessment_id = ?"
      ).bind(assessment.assessment_id).run();

      await env.DB.prepare(`
        INSERT INTO eept_audit_log (tenant_id, assessment_id, actor_type, event_type, event_data_json)
        VALUES (?, ?, 'candidate', 'ASSESSMENT_STARTED', '{}')
      `).bind(assessment.tenant_id, assessment.assessment_id).run();
    }

    // Load grammar questions
    const grammarQs = await env.DB.prepare(`
      SELECT question_id, prompt, option_a, option_b, option_c, option_d, cefr
      FROM eept_questions
      WHERE form_id = ? AND section = 'grammar'
      ORDER BY order_index ASC
    `).bind(assessment.form_id).all();

    // Load reading passages
    const passages = await env.DB.prepare(`
      SELECT passage_id, cefr, title, text, word_count
      FROM eept_passages
      WHERE form_id = ?
      ORDER BY order_index ASC
    `).bind(assessment.form_id).all();

    // Load reading questions grouped by passage
    const readingQs = await env.DB.prepare(`
      SELECT question_id, passage_id, prompt, option_a, option_b, option_c, option_d, cefr
      FROM eept_questions
      WHERE form_id = ? AND section = 'reading'
      ORDER BY order_index ASC
    `).bind(assessment.form_id).all();

    // Load writing prompts
    const writingPrompts = await env.DB.prepare(`
      SELECT prompt_id, task_type, cefr_target, prompt, requirement_1, requirement_2, requirement_3,
             word_limit_min, word_limit_max
      FROM eept_writing_prompts
      WHERE form_id = ?
      ORDER BY task_type ASC
    `).bind(assessment.form_id).all();

    return jsonResponse({
      assessment_id: assessment.assessment_id,
      form_name: assessment.form_name,
      candidate: {
        first_name: assessment.first_name,
        last_name: assessment.last_name,
      },
      branding: {
        rto_name: assessment.rto_name,
        logo_url: assessment.logo_url,
        brand_color: assessment.brand_primary_color,
      },
      sections: {
        grammar: {
          time_minutes: 15,
          questions: grammarQs.results,
        },
        reading: {
          time_minutes: 25,
          passages: passages.results,
          questions: readingQs.results,
        },
        writing_task1: {
          time_minutes: 15,
          prompt: writingPrompts.results.find((p: any) => p.task_type === 'task1') || null,
        },
        writing_task2: {
          time_minutes: 20,
          prompt: writingPrompts.results.find((p: any) => p.task_type === 'task2') || null,
        },
      },
    });

  } catch (e: any) {
    console.error('EEPT start error:', e);
    return jsonResponse({ error: 'Failed to load assessment', debug: e.message }, 500);
  }
};

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
