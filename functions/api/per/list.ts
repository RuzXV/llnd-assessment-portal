// GET /api/per/list - List PER submissions for tenant (admin)
// Query params: ?status=submitted|under_review|decided

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env, data } = context;

  if (!data.user || (data.user_role !== 'rto_admin' && data.user_role !== 'super_admin')) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
  }

  try {
    const url = new URL(request.url);
    const status = url.searchParams.get('status');

    let query = `
      SELECT s.submission_id, s.student_name, s.student_id, s.student_email,
             s.application_id, s.is_international, s.status,
             s.admin_decision, s.reviewed_by, s.reviewed_at,
             s.submitted_at, s.created_at,
             f.career_clarity_score, f.course_alignment_score,
             f.interview_recommended,
             r.overall_llnd_self_risk, r.total_may_need_support
      FROM per_submissions s
      LEFT JOIN per_section_a_flags f ON s.submission_id = f.submission_id
      LEFT JOIN per_risk_flags r ON s.submission_id = r.submission_id
      WHERE s.tenant_id = ?
    `;
    const bindings: any[] = [data.tenant_id];

    if (status) {
      query += ' AND s.status = ?';
      bindings.push(status);
    }

    query += ' ORDER BY s.created_at DESC LIMIT 100';

    const result = await env.DB.prepare(query).bind(...bindings).all();

    return new Response(JSON.stringify({
      submissions: result.results,
      total: result.results.length
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (e: any) {
    return new Response(JSON.stringify({ error: 'Server error', debug: e.message }), { status: 500 });
  }
};
