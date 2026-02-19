/**
 * POST /api/ebpa/issue/manual
 * Issue a single EEPT assessment to a candidate
 * Requires: rto_manager or super_admin role
 */
import { hashToken } from '../../services/security';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env, data } = context;
  const tenantId = (data as any).tenant_id;
  const userId = (data as any).user;
  const userRole = (data as any).user_role;

  if (!['rto_admin', 'super_admin'].includes(userRole)) {
    return jsonResponse({ error: 'Forbidden: insufficient role' }, 403);
  }

  try {
    const body = await request.json() as any;
    const { first_name, last_name, email, mobile, student_id, agent_name, cohort_tag, course_intended, notes, form_id } = body;

    if (!first_name || !last_name || !email) {
      return jsonResponse({ error: 'first_name, last_name, and email are required' }, 400);
    }

    const selectedFormId = form_id || 'eept-form-1';

    // Verify form exists
    const form = await env.DB.prepare('SELECT form_id FROM eept_test_forms WHERE form_id = ? AND is_active = 1')
      .bind(selectedFormId).first();
    if (!form) {
      return jsonResponse({ error: 'Test form not found or inactive' }, 400);
    }

    // Create or find candidate
    const candidateId = crypto.randomUUID();
    const existing = await env.DB.prepare(
      'SELECT candidate_id FROM eept_candidates WHERE tenant_id = ? AND email = ?'
    ).bind(tenantId, email.toLowerCase().trim()).first();

    const finalCandidateId = existing ? (existing.candidate_id as string) : candidateId;

    if (!existing) {
      await env.DB.prepare(
        'INSERT INTO eept_candidates (candidate_id, tenant_id, first_name, last_name, email, mobile, student_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).bind(finalCandidateId, tenantId, first_name.trim(), last_name.trim(), email.toLowerCase().trim(), mobile || null, student_id || null).run();
    }

    // Generate secure token
    const rawToken = crypto.randomUUID() + '-' + crypto.randomUUID();
    const tokenHash = await hashToken(rawToken);

    // Calculate expiry (default 14 days)
    const settings = await env.DB.prepare('SELECT token_expiry_days FROM eept_tenant_settings WHERE tenant_id = ?')
      .bind(tenantId).first();
    const expiryDays = settings?.token_expiry_days || 14;
    const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString();

    // Create assessment
    const assessmentId = crypto.randomUUID();
    await env.DB.prepare(`
      INSERT INTO eept_assessments (
        assessment_id, tenant_id, candidate_user_id, form_id, status,
        course_intended, cohort_tag, agent_name, notes,
        secure_token, token_hash, token_expires_at, issued_by
      ) VALUES (?, ?, ?, ?, 'issued', ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      assessmentId, tenantId, finalCandidateId, selectedFormId,
      course_intended || null, cohort_tag || null, agent_name || null, notes || null,
      rawToken, tokenHash, expiresAt, userId
    ).run();

    // Audit log
    await env.DB.prepare(`
      INSERT INTO eept_audit_log (tenant_id, assessment_id, actor_user_id, actor_type, event_type, event_data_json)
      VALUES (?, ?, ?, 'user', 'ASSESSMENT_ISSUED', ?)
    `).bind(tenantId, assessmentId, userId, JSON.stringify({
      candidate_email: email, form_id: selectedFormId, method: 'manual'
    })).run();

    // Build assessment link
    const assessmentLink = `/assess-eept?token=${rawToken}`;

    return jsonResponse({
      success: true,
      assessment_id: assessmentId,
      candidate_id: finalCandidateId,
      assessment_link: assessmentLink,
      token_expires_at: expiresAt,
    });

  } catch (e: any) {
    console.error('EEPT issue manual error:', e);
    return jsonResponse({ error: 'Failed to issue assessment', debug: e.message }, 500);
  }
};

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
