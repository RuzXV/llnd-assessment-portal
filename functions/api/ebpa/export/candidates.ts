/**
 * GET /api/ebpa/export/candidates
 * Protected - Export candidate summary CSV data
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, data } = context;
  const tenantId = (data as any).tenant_id;
  const userRole = (data as any).user_role;

  try {
    let query = `
      SELECT
        a.assessment_id, a.status, a.issued_at, a.started_at, a.submitted_at, a.finalised_at,
        a.form_id, a.course_intended, a.cohort_tag, a.agent_name,
        c.candidate_id, c.first_name, c.last_name, c.email, c.student_id,
        r.grammar_score, r.reading_score, r.writing_task1_score, r.writing_task2_score,
        r.writing_raw_total, r.composite_score,
        r.reading_cefr, r.writing_cefr, r.overall_cefr, r.overall_cefr_pre_floor,
        r.ielts_indicative, r.reading_acsf, r.writing_acsf,
        r.skill_floor_applied, r.skill_floor_reason,
        r.benchmark_json, r.report_id, r.report_valid_until
      FROM eept_assessments a
      JOIN eept_candidates c ON a.candidate_user_id = c.candidate_id
      LEFT JOIN eept_assessment_results r ON a.assessment_id = r.assessment_id
    `;

    if (userRole !== 'super_admin') {
      query += ' WHERE a.tenant_id = ?';
    }
    query += ' ORDER BY a.issued_at DESC';

    const results = userRole === 'super_admin'
      ? await env.DB.prepare(query).all()
      : await env.DB.prepare(query).bind(tenantId).all();

    // Build CSV
    const headers = [
      'assessment_id', 'candidate_id', 'first_name', 'last_name', 'email', 'student_id',
      'form_id', 'status', 'issued_at', 'started_at', 'submitted_at', 'finalised_at',
      'course_intended', 'cohort_tag', 'agent_name',
      'grammar_score', 'reading_score', 'writing_task1_score', 'writing_task2_score',
      'writing_raw_total', 'composite_score',
      'reading_cefr', 'writing_cefr', 'overall_cefr', 'ielts_indicative',
      'reading_acsf', 'writing_acsf', 'skill_floor_applied', 'skill_floor_reason',
      'report_id'
    ];

    let csv = headers.join(',') + '\n';
    for (const row of results.results as any[]) {
      const values = headers.map(h => {
        const val = row[h];
        if (val === null || val === undefined) return '';
        const str = String(val);
        return str.includes(',') || str.includes('"') || str.includes('\n')
          ? `"${str.replace(/"/g, '""')}"` : str;
      });
      csv += values.join(',') + '\n';
    }

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="eept_candidates_export_${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });

  } catch (e: any) {
    console.error('EEPT export error:', e);
    return new Response(JSON.stringify({ error: 'Export failed' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
};
