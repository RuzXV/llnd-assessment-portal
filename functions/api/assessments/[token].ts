import { calculateACSFOutcome } from '../../utils/acsf';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { params, env } = context;
  const token = params.token as string;

  try {
    // First, check if the attempt exists at all (without the JOIN)
    const attemptCheck = await env.DB.prepare(`
      SELECT attempt_id, tenant_id, version_id, status FROM assessment_attempts WHERE token_hash = ?
    `).bind(token).first();

    if (!attemptCheck) {
      return new Response(JSON.stringify({ error: 'Invalid assessment link - token not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Now get the full attempt with tenant info
    const attempt = await env.DB.prepare(`
      SELECT
        a.attempt_id, a.student_name, a.student_id, a.status, a.version_id, a.draft_responses, a.expires_at,
        t.name as rto_name, t.logo_url, t.brand_primary_color
      FROM assessment_attempts a
      JOIN tenants t ON a.tenant_id = t.tenant_id
      WHERE a.token_hash = ?
    `).bind(token).first();

    if (!attempt) {
      return new Response(JSON.stringify({
        error: 'Invalid assessment link - tenant join failed',
        debug: { attempt_id: attemptCheck.attempt_id, tenant_id: attemptCheck.tenant_id }
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if assessment has expired
    const now = Math.floor(Date.now() / 1000);
    if (attempt.expires_at && now > attempt.expires_at && attempt.status !== 'submitted') {
      await env.DB.prepare(`
        UPDATE assessment_attempts SET status = 'expired' WHERE attempt_id = ?
      `).bind(attempt.attempt_id).run();
      return new Response(JSON.stringify({ error: 'Assessment has expired' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (attempt.status === 'submitted' || attempt.status === 'expired') {
      return new Response(JSON.stringify({ error: 'Assessment already completed or expired' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (attempt.status === 'issued') {
      await env.DB.prepare("UPDATE assessment_attempts SET status = 'in_progress', started_at = unixepoch() WHERE attempt_id = ?")
        .bind(attempt.attempt_id).run();
    }

    // Check if version_id exists
    if (!attempt.version_id) {
      return new Response(JSON.stringify({ error: 'Assessment configuration error: no version assigned' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const questions = await env.DB.prepare(`
        SELECT question_id, text, type, options, domain
        FROM questions
        WHERE version_id = ?
        ORDER BY order_index ASC
    `).bind(attempt.version_id).all();

    const formattedQuestions = questions.results.map((q: any) => ({
        ...q,
        options: q.options ? JSON.parse(q.options) : null
    }));

    return new Response(JSON.stringify({
      student: { name: attempt.student_name, id: attempt.student_id },
      branding: {
        rto_name: attempt.rto_name,
        logo: attempt.logo_url,
        color: attempt.brand_primary_color
      },
      questions: formattedQuestions,
      draft_responses: attempt.draft_responses ? JSON.parse(attempt.draft_responses as string) : null,
      expires_at: attempt.expires_at
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (e: any) {
    console.error('Assessment fetch error:', e);
    return new Response(JSON.stringify({
      error: 'Failed to load assessment',
      debug: e.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, params, env } = context;
  const token = params.token as string;

  try {
    const body = await request.json() as any;
    const { responses } = body;

    const attempt = await env.DB.prepare(`
      SELECT attempt_id, seat_id, version_id, status FROM assessment_attempts WHERE token_hash = ?
    `).bind(token).first();

    if (!attempt || attempt.status !== 'in_progress') {
      return new Response(JSON.stringify({ error: 'Invalid submission state' }), { status: 400 });
    }

    const questionData = await env.DB.prepare(`
      SELECT question_id, correct_response, weight, domain 
      FROM questions 
      WHERE version_id = ?
    `).bind(attempt.version_id).all();

    const qMap = new Map(questionData.results.map((q: any) => [q.question_id, q]));

    let totalScore = 0;
    const domainScores: Record<string, { total: number, max: number }> = {};
    const dbStatements = [];

    questionData.results.forEach((q: any) => {
        if (!domainScores[q.domain]) domainScores[q.domain] = { total: 0, max: 0 };
        domainScores[q.domain].max += q.weight;
    });

    for (const r of responses) {
      const q = qMap.get(r.questionId) as any;
      if (!q) continue;

      let points = 0;
      let isCorrect = 0;

      if (String(r.answer).trim().toLowerCase() === String(q.correct_response).trim().toLowerCase()) {
          points = q.weight;
          isCorrect = 1;
      }

      totalScore += points;
      if (domainScores[q.domain]) {
          domainScores[q.domain].total += points;
      }

      dbStatements.push(env.DB.prepare(`
        INSERT INTO responses (response_id, attempt_id, question_id, response_data, is_correct, points_awarded)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(crypto.randomUUID(), attempt.attempt_id, r.questionId, JSON.stringify(r.answer), isCorrect, points));
    }

    const finalReportData: Record<string, any> = {};
    let globalSupportFlag = false;

    Object.keys(domainScores).forEach(domain => {
        const d = domainScores[domain];
        const outcome = calculateACSFOutcome(d.total, d.max, domain);
        
        finalReportData[domain] = {
            score: d.total,
            max: d.max,
            acsf_level: outcome.level,
            status: outcome.indicator,
            recommendation: outcome.recommendation
        };

        if (outcome.indicator === 'support_required') globalSupportFlag = true;
    });

    dbStatements.push(env.DB.prepare(`
      UPDATE assessment_attempts
      SET status = 'submitted',
          submitted_at = unixepoch(),
          total_score = ?,
          domain_breakdown = ?,
          outcome_flag = ?,
          draft_responses = NULL
      WHERE attempt_id = ?
    `).bind(
        totalScore,
        JSON.stringify(finalReportData),
        globalSupportFlag ? 'support_required' : 'competent',
        attempt.attempt_id
    ));

    dbStatements.push(env.DB.prepare(`
      UPDATE seats 
      SET status = 'consumed', consumed_at = unixepoch() 
      WHERE seat_id = ?
    `).bind(attempt.seat_id));

    await env.DB.batch(dbStatements);

    return new Response(JSON.stringify({ success: true, message: 'Assessment submitted successfully' }));

  } catch (e) {
    console.error("Submission Error:", e);
    return new Response(JSON.stringify({ error: 'Submission failed' }), { status: 500 });
  }
};