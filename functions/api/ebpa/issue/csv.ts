/**
 * POST /api/ebpa/issue/csv
 * Bulk issue EEPT assessments via CSV upload
 * Requires: rto_manager or super_admin role
 */
import { hashToken } from '../../services/security';

interface CSVRow {
  first_name: string;
  last_name: string;
  email: string;
  mobile?: string;
  candidate_id?: string;
  cohort_tag?: string;
  agent?: string;
  course_intended?: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env, data } = context;
  const tenantId = (data as any).tenant_id;
  const userId = (data as any).user;
  const userRole = (data as any).user_role;

  if (!['rto_admin', 'super_admin'].includes(userRole)) {
    return jsonResponse({ error: 'Forbidden' }, 403);
  }

  try {
    const body = await request.json() as any;
    const { csv_data, form_id } = body;

    if (!csv_data || !Array.isArray(csv_data)) {
      return jsonResponse({ error: 'csv_data must be an array of row objects' }, 400);
    }

    const selectedFormId = form_id || 'eept-form-1';
    const form = await env.DB.prepare('SELECT form_id FROM eept_test_forms WHERE form_id = ? AND is_active = 1')
      .bind(selectedFormId).first();
    if (!form) {
      return jsonResponse({ error: 'Test form not found' }, 400);
    }

    const settings = await env.DB.prepare('SELECT token_expiry_days FROM eept_tenant_settings WHERE tenant_id = ?')
      .bind(tenantId).first();
    const expiryDays = (settings?.token_expiry_days as number) || 14;

    const results: any[] = [];
    const errors: any[] = [];

    for (let i = 0; i < csv_data.length; i++) {
      const row: CSVRow = csv_data[i];
      const rowNum = i + 1;

      // Validate
      if (!row.first_name || !row.last_name || !row.email) {
        errors.push({ row: rowNum, error: 'Missing required fields (first_name, last_name, email)', data: row });
        continue;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(row.email)) {
        errors.push({ row: rowNum, error: 'Invalid email format', data: row });
        continue;
      }

      try {
        // Create or find candidate
        const email = row.email.toLowerCase().trim();
        const existing = await env.DB.prepare(
          'SELECT candidate_id FROM eept_candidates WHERE tenant_id = ? AND email = ?'
        ).bind(tenantId, email).first();

        const candidateId = existing ? (existing.candidate_id as string) : crypto.randomUUID();

        if (!existing) {
          await env.DB.prepare(
            'INSERT INTO eept_candidates (candidate_id, tenant_id, first_name, last_name, email, mobile, student_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
          ).bind(candidateId, tenantId, row.first_name.trim(), row.last_name.trim(), email, row.mobile || null, row.candidate_id || null).run();
        }

        // Generate token
        const rawToken = crypto.randomUUID() + '-' + crypto.randomUUID();
        const tokenHash = await hashToken(rawToken);
        const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString();

        // Create assessment
        const assessmentId = crypto.randomUUID();
        await env.DB.prepare(`
          INSERT INTO eept_assessments (
            assessment_id, tenant_id, candidate_user_id, form_id, status,
            course_intended, cohort_tag, agent_name,
            secure_token, token_hash, token_expires_at, issued_by
          ) VALUES (?, ?, ?, ?, 'issued', ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          assessmentId, tenantId, candidateId, selectedFormId,
          row.course_intended || null, row.cohort_tag || null, row.agent || null,
          rawToken, tokenHash, expiresAt, userId
        ).run();

        results.push({
          row: rowNum,
          assessment_id: assessmentId,
          candidate_id: candidateId,
          email,
          assessment_link: `/assess-eept?token=${rawToken}`,
          status: 'issued',
        });
      } catch (rowErr: any) {
        errors.push({ row: rowNum, error: rowErr.message, data: row });
      }
    }

    // Audit log
    await env.DB.prepare(`
      INSERT INTO eept_audit_log (tenant_id, assessment_id, actor_user_id, actor_type, event_type, event_data_json)
      VALUES (?, NULL, ?, 'user', 'BULK_ISSUE', ?)
    `).bind(tenantId, userId, JSON.stringify({
      total_rows: csv_data.length,
      successful: results.length,
      failed: errors.length,
      method: 'csv'
    })).run();

    return jsonResponse({
      success: true,
      total: csv_data.length,
      issued: results.length,
      failed: errors.length,
      results,
      errors,
    });

  } catch (e: any) {
    console.error('EEPT CSV issue error:', e);
    return jsonResponse({ error: 'Failed to process CSV', debug: e.message }, 500);
  }
};

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
