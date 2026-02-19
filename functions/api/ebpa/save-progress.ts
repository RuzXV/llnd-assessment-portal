/**
 * POST /api/ebpa/save-progress
 * Public endpoint - saves candidate progress (autosave)
 * Stores current answers in a progress JSON field
 */

import { hashToken } from '../services/security';

// D1Database type is available from Cloudflare Workers types at runtime

export const onRequestPost: PagesFunction = async (context) => {
  const { request, env } = context;

  try {
    const body: any = await request.json();
    const { token, mcq_answers, writing_text_1, writing_text_2 } = body;

    if (!token) {
      return new Response(JSON.stringify({ error: 'Missing token' }), { status: 400 });
    }

    // Look up assessment by token hash
    const tokenHash = await hashToken(token);
    const assessment = await env.DB.prepare(
      `SELECT assessment_id, status FROM eept_assessments WHERE token_hash = ?`
    ).bind(tokenHash).first<any>();

    if (!assessment) {
      return new Response(JSON.stringify({ error: 'Assessment not found' }), { status: 404 });
    }

    if (!['issued', 'started'].includes(assessment.status)) {
      return new Response(JSON.stringify({ error: 'Assessment is no longer active' }), { status: 400 });
    }

    // Store progress as notes JSON (reusing notes field for autosave data)
    const progressData = JSON.stringify({
      mcq_answers: mcq_answers || {},
      writing_text_1: writing_text_1 || '',
      writing_text_2: writing_text_2 || '',
      saved_at: new Date().toISOString(),
    });

    await env.DB.prepare(
      `UPDATE eept_assessments SET notes = ?, status = CASE WHEN status = 'issued' THEN 'started' ELSE status END WHERE assessment_id = ?`
    ).bind(progressData, assessment.assessment_id).run();

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error('save-progress error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
};
