/**
 * GET /api/ebpa/verify/:reportId
 * Public route - Report verification page
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { params, env } = context;
  const reportId = params.reportId as string;

  if (!reportId) {
    return jsonResponse({ error: 'Missing report ID' }, 400);
  }

  try {
    const result = await env.DB.prepare(`
      SELECT
        r.report_id, r.report_valid_until, r.overall_cefr, r.ielts_indicative,
        r.reading_cefr, r.writing_cefr, r.composite_score,
        a.finalised_at, a.status,
        c.first_name, c.last_name
      FROM eept_assessment_results r
      JOIN eept_assessments a ON r.assessment_id = a.assessment_id
      JOIN eept_candidates c ON a.candidate_user_id = c.candidate_id
      WHERE r.report_id = ?
    `).bind(reportId).first();

    if (!result) {
      return jsonResponse({
        valid: false,
        status: 'invalid',
        message: 'Report ID not found',
      });
    }

    // Check validity
    const validUntil = result.report_valid_until as string;
    const isExpired = validUntil && new Date(validUntil) < new Date();

    // PII masking - show only first initial + last name
    const maskedName = `${(result.first_name as string).charAt(0)}. ${result.last_name}`;

    return jsonResponse({
      valid: true,
      status: isExpired ? 'expired' : 'valid',
      report_id: result.report_id,
      candidate_name: maskedName,
      date_issued: result.finalised_at,
      valid_until: result.report_valid_until,
      overall_cefr: result.overall_cefr,
      ielts_indicative: result.ielts_indicative,
      reading_cefr: result.reading_cefr,
      writing_cefr: result.writing_cefr,
      message: isExpired ? 'This report has expired' : 'Report verified successfully',
    });

  } catch (e: any) {
    console.error('EEPT verify error:', e);
    return jsonResponse({ error: 'Verification failed' }, 500);
  }
};

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}
