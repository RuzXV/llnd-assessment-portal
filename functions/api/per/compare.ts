// GET /api/per/compare?student_id=xxx - Compare PER self-assessment vs LLND measured results
// Requires admin auth. Returns side-by-side self-perception vs measured performance data.

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env, data } = context;

  if (!data.user || (data.user_role !== 'rto_admin' && data.user_role !== 'super_admin')) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
  }

  const url = new URL(request.url);
  const studentId = url.searchParams.get('student_id');
  const submissionId = url.searchParams.get('submission_id');

  if (!studentId && !submissionId) {
    return new Response(JSON.stringify({
      error: 'Either student_id or submission_id is required'
    }), { status: 400 });
  }

  try {
    // Get PER submission
    let perSubmission: any = null;
    let perDomainScores: any[] = [];
    let perRiskFlags: any = null;

    if (submissionId) {
      perSubmission = await env.DB.prepare(
        'SELECT * FROM per_submissions WHERE submission_id = ? AND tenant_id = ?'
      ).bind(submissionId, data.tenant_id).first();
    } else if (studentId) {
      // Get most recent PER for this student
      perSubmission = await env.DB.prepare(
        'SELECT * FROM per_submissions WHERE student_id = ? AND tenant_id = ? ORDER BY submitted_at DESC LIMIT 1'
      ).bind(studentId, data.tenant_id).first();
    }

    if (perSubmission) {
      const scores = await env.DB.prepare(
        'SELECT * FROM per_domain_scores WHERE submission_id = ? ORDER BY domain'
      ).bind(perSubmission.submission_id).all();
      perDomainScores = scores.results;

      perRiskFlags = await env.DB.prepare(
        'SELECT * FROM per_risk_flags WHERE submission_id = ?'
      ).bind(perSubmission.submission_id).first();
    }

    // Get LLND assessment results for same student
    let llndAttempt: any = null;
    let llndDomainScores: any[] = [];
    const sid = studentId || perSubmission?.student_id;

    if (sid) {
      llndAttempt = await env.DB.prepare(`
        SELECT a.attempt_id, a.student_name, a.student_id, a.total_score,
               a.overall_outcome, a.overall_classification, a.risk_flags as attempt_risk_flags,
               a.override_triggered, a.aqf_level, a.stream, a.submitted_at, a.status
        FROM assessment_attempts a
        WHERE a.student_id = ? AND a.tenant_id = ? AND a.status = 'submitted'
        ORDER BY a.submitted_at DESC LIMIT 1
      `).bind(sid, data.tenant_id).first();

      if (llndAttempt) {
        const scores = await env.DB.prepare(
          'SELECT * FROM domain_scores WHERE attempt_id = ? ORDER BY domain'
        ).bind(llndAttempt.attempt_id).all();
        llndDomainScores = scores.results;
      }
    }

    // Build comparison data
    const domains = ['reading', 'writing', 'numeracy', 'learning', 'digital'];
    const comparison = domains.map(domain => {
      const perScore = perDomainScores.find((s: any) => s.domain === domain);

      // Map PER 'learning' to LLND 'oral' for comparison
      const llndDomain = domain === 'learning' ? 'oral' : domain;
      const llndScore = llndDomainScores.find((s: any) => s.domain === llndDomain);

      return {
        domain,
        per: perScore ? {
          confidence_level: perScore.confidence_level,
          domain_percentage: perScore.domain_percentage,
          may_need_support_count: perScore.may_need_support_count,
          total_items: perScore.total_items,
          support_flag: !!perScore.support_flag
        } : null,
        llnd: llndScore ? {
          percentage: llndScore.percentage,
          outcome: llndScore.outcome,
          risk_flag: !!llndScore.risk_flag,
          estimated_acsf_band: llndScore.estimated_acsf_band,
          weighted_contribution: llndScore.weighted_contribution
        } : null,
        alignment: getAlignmentIndicator(perScore, llndScore)
      };
    });

    // Overall alignment summary
    const hasPerData = !!perSubmission;
    const hasLlndData = !!llndAttempt;
    let overallAlignment = 'insufficient_data';

    if (hasPerData && hasLlndData) {
      const mismatches = comparison.filter(c => c.alignment === 'mismatch').length;
      const matches = comparison.filter(c => c.alignment === 'aligned').length;
      if (mismatches >= 2) overallAlignment = 'significant_mismatch';
      else if (mismatches === 1) overallAlignment = 'partial_mismatch';
      else if (matches >= 3) overallAlignment = 'well_aligned';
      else overallAlignment = 'moderate';
    } else if (hasPerData) {
      overallAlignment = 'per_only';
    } else if (hasLlndData) {
      overallAlignment = 'llnd_only';
    }

    return new Response(JSON.stringify({
      student_id: sid,
      per_submission: perSubmission ? {
        submission_id: perSubmission.submission_id,
        student_name: perSubmission.student_name,
        submitted_at: perSubmission.submitted_at,
        status: perSubmission.status,
        is_international: !!perSubmission.is_international,
        admin_decision: perSubmission.admin_decision
      } : null,
      llnd_attempt: llndAttempt ? {
        attempt_id: llndAttempt.attempt_id,
        total_score: llndAttempt.total_score,
        overall_outcome: llndAttempt.overall_outcome,
        overall_classification: llndAttempt.overall_classification,
        aqf_level: llndAttempt.aqf_level,
        stream: llndAttempt.stream,
        submitted_at: llndAttempt.submitted_at,
        override_triggered: !!llndAttempt.override_triggered
      } : null,
      per_risk_flags: perRiskFlags ? {
        overall_llnd_self_risk: !!perRiskFlags.overall_llnd_self_risk,
        reading_support_flag: !!perRiskFlags.reading_support_flag,
        writing_support_flag: !!perRiskFlags.writing_support_flag,
        numeracy_support_flag: !!perRiskFlags.numeracy_support_flag,
        learning_support_flag: !!perRiskFlags.learning_support_flag,
        digital_support_flag: !!perRiskFlags.digital_support_flag,
        high_digital_risk_flag: !!perRiskFlags.high_digital_risk_flag
      } : null,
      domain_comparison: comparison,
      overall_alignment: overallAlignment
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (e: any) {
    return new Response(JSON.stringify({ error: 'Server error', debug: e.message }), { status: 500 });
  }
};

function getAlignmentIndicator(perScore: any, llndScore: any): string {
  if (!perScore || !llndScore) return 'no_data';

  const perConfidence = perScore.confidence_level;
  const llndOutcome = llndScore.outcome;

  // High self-confidence but poor measured performance = mismatch (over-confident)
  if (perConfidence === 'High' && (llndOutcome === 'support_required' || llndOutcome === 'monitor')) {
    return 'mismatch';
  }

  // Low self-confidence but strong measured performance = mismatch (under-confident)
  if (perConfidence === 'Low' && (llndOutcome === 'meets' || llndOutcome === 'exceeds')) {
    return 'mismatch';
  }

  // Close alignment
  if (
    (perConfidence === 'High' && (llndOutcome === 'meets' || llndOutcome === 'exceeds')) ||
    (perConfidence === 'Moderate' && (llndOutcome === 'meets' || llndOutcome === 'monitor')) ||
    (perConfidence === 'Low' && (llndOutcome === 'support_required' || llndOutcome === 'monitor'))
  ) {
    return 'aligned';
  }

  return 'partial';
}
