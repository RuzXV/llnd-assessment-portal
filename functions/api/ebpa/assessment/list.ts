/**
 * GET /api/ebpa/assessment/list
 * Protected - RTO Manager views assessment history
 * Supports filtering by status, cohort, course
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env, data } = context;
  const tenantId = (data as any).tenant_id;
  const url = new URL(request.url);

  const status = url.searchParams.get('status');
  const cohort = url.searchParams.get('cohort');
  const course = url.searchParams.get('course');
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const offset = parseInt(url.searchParams.get('offset') || '0');

  try {
    let query = `
      SELECT
        a.assessment_id, a.status, a.issued_at, a.submitted_at, a.finalised_at,
        a.course_intended, a.cohort_tag, a.agent_name, a.form_id,
        c.first_name, c.last_name, c.email,
        r.composite_score, r.overall_cefr, r.ielts_indicative, r.reading_cefr, r.writing_cefr,
        r.report_id, r.benchmark_json
      FROM eept_assessments a
      JOIN eept_candidates c ON a.candidate_user_id = c.candidate_id
      LEFT JOIN eept_assessment_results r ON a.assessment_id = r.assessment_id
      WHERE a.tenant_id = ?
    `;
    const bindings: any[] = [tenantId];

    if (status) {
      query += ' AND a.status = ?';
      bindings.push(status);
    }
    if (cohort) {
      query += ' AND a.cohort_tag = ?';
      bindings.push(cohort);
    }
    if (course) {
      query += ' AND a.course_intended = ?';
      bindings.push(course);
    }

    query += ' ORDER BY a.issued_at DESC LIMIT ? OFFSET ?';
    bindings.push(limit, offset);

    const stmt = env.DB.prepare(query);
    const results = await stmt.bind(...bindings).all();

    // Get counts by status
    const counts = await env.DB.prepare(`
      SELECT status, COUNT(*) as count
      FROM eept_assessments WHERE tenant_id = ?
      GROUP BY status
    `).bind(tenantId).all();

    const statusCounts: Record<string, number> = {};
    for (const row of counts.results as any[]) {
      statusCounts[row.status] = row.count;
    }

    const parseJSON = (val: any) => {
      if (!val) return null;
      try { return JSON.parse(val as string); } catch { return val; }
    };

    return new Response(JSON.stringify({
      assessments: results.results.map((a: any) => ({
        assessment_id: a.assessment_id,
        candidate_name: `${a.first_name} ${a.last_name}`,
        email: a.email,
        status: a.status,
        form_id: a.form_id,
        issued_at: a.issued_at,
        submitted_at: a.submitted_at,
        finalised_at: a.finalised_at,
        course_intended: a.course_intended,
        cohort_tag: a.cohort_tag,
        agent_name: a.agent_name,
        composite_score: a.composite_score,
        overall_cefr: a.overall_cefr,
        ielts_indicative: a.ielts_indicative,
        reading_cefr: a.reading_cefr,
        writing_cefr: a.writing_cefr,
        report_id: a.report_id,
        benchmark: parseJSON(a.benchmark_json),
      })),
      status_counts: statusCounts,
      pagination: { limit, offset, has_more: results.results.length === limit },
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (e: any) {
    console.error('EEPT list error:', e);
    return new Response(JSON.stringify({ error: 'Failed to load assessments', debug: e.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
};
