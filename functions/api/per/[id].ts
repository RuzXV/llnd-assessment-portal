// GET /api/per/:id - Get full PER submission details (admin)
// POST /api/per/:id - Record admin decision on PER submission

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { params, env, data } = context;
  const submissionId = params.id as string;

  if (!data.user || (data.user_role !== 'rto_admin' && data.user_role !== 'super_admin')) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
  }

  try {
    // Get full submission with all related data
    const submission = await env.DB.prepare(`
      SELECT * FROM per_submissions WHERE submission_id = ? AND tenant_id = ?
    `).bind(submissionId, data.tenant_id).first();

    if (!submission) {
      return new Response(JSON.stringify({ error: 'Submission not found' }), { status: 404 });
    }

    // Get Section A flags
    const sectionAFlags = await env.DB.prepare(`
      SELECT * FROM per_section_a_flags WHERE submission_id = ?
    `).bind(submissionId).first();

    // Get Section B domain scores
    const domainScores = await env.DB.prepare(`
      SELECT * FROM per_domain_scores WHERE submission_id = ? ORDER BY domain
    `).bind(submissionId).all();

    // Get risk flags
    const riskFlags = await env.DB.prepare(`
      SELECT * FROM per_risk_flags WHERE submission_id = ?
    `).bind(submissionId).first();

    // Get audit history
    const auditHistory = await env.DB.prepare(`
      SELECT * FROM per_audit WHERE submission_id = ? ORDER BY created_at DESC
    `).bind(submissionId).all();

    return new Response(JSON.stringify({
      submission,
      section_a_flags: sectionAFlags,
      domain_scores: domainScores.results,
      risk_flags: riskFlags,
      audit_history: auditHistory.results,
      report: submission.report_json ? JSON.parse(submission.report_json as string) : null
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (e: any) {
    return new Response(JSON.stringify({ error: 'Server error', debug: e.message }), { status: 500 });
  }
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, params, env, data } = context;
  const submissionId = params.id as string;

  if (!data.user || (data.user_role !== 'rto_admin' && data.user_role !== 'super_admin')) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
  }

  try {
    const body = await request.json() as any;
    const { decision, notes } = body;

    const validDecisions = [
      'suitable_to_proceed',
      'proceed_with_interview',
      'further_evidence_required',
      'support_plan_required'
    ];

    if (!decision || !validDecisions.includes(decision)) {
      return new Response(JSON.stringify({
        error: 'Invalid decision. Must be one of: ' + validDecisions.join(', ')
      }), { status: 400 });
    }

    // Verify submission exists and belongs to tenant
    const submission = await env.DB.prepare(`
      SELECT submission_id, status FROM per_submissions
      WHERE submission_id = ? AND tenant_id = ?
    `).bind(submissionId, data.tenant_id).first();

    if (!submission) {
      return new Response(JSON.stringify({ error: 'Submission not found' }), { status: 404 });
    }

    // Update submission with admin decision
    await env.DB.batch([
      env.DB.prepare(`
        UPDATE per_submissions
        SET admin_decision = ?, admin_notes = ?, reviewed_by = ?,
            reviewed_at = datetime('now'), status = 'decided'
        WHERE submission_id = ?
      `).bind(decision, notes || '', data.user, submissionId),

      // Update report JSON with admin decision
      env.DB.prepare(`
        UPDATE per_submissions
        SET report_json = json_set(
          report_json,
          '$.admin.decision_status', ?,
          '$.admin.decision_notes', ?,
          '$.admin.reviewed_by', ?,
          '$.admin.reviewed_at', datetime('now')
        )
        WHERE submission_id = ?
      `).bind(decision, notes || '', data.user, submissionId),

      // Audit log
      env.DB.prepare(`
        INSERT INTO per_audit (tenant_id, submission_id, action, actor_id, actor_type, details)
        VALUES (?, ?, 'decision_made', ?, 'admin', ?)
      `).bind(
        data.tenant_id, submissionId, data.user,
        JSON.stringify({ decision, notes: notes || '' })
      )
    ]);

    return new Response(JSON.stringify({
      success: true,
      submission_id: submissionId,
      decision,
      reviewed_by: data.user
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (e: any) {
    return new Response(JSON.stringify({ error: 'Server error', debug: e.message }), { status: 500 });
  }
};
