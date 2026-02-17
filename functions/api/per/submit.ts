// POST /api/per/submit - Submit a Pre-Enrolment Review
// Public route (student access via token or direct)

import {
  processSectionA,
  processSectionB,
  generatePERReport,
  DEFAULT_THRESHOLDS,
  SectionAResponses,
  SectionBResponses,
  WordCountThresholds
} from '../../utils/per-engine';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  try {
    const body = await request.json() as any;
    const {
      tenant_id, student_name, student_id, student_email,
      application_id, is_international,
      section_a, section_b
    } = body;

    if (!tenant_id || !student_name) {
      return new Response(JSON.stringify({ error: 'tenant_id and student_name are required' }), { status: 400 });
    }

    if (!section_a || !section_b) {
      return new Response(JSON.stringify({ error: 'Both section_a and section_b responses are required' }), { status: 400 });
    }

    // Load configurable thresholds from DB or use defaults
    let thresholds = DEFAULT_THRESHOLDS;
    try {
      const configRows = await env.DB.prepare(
        'SELECT config_key, config_value FROM per_config'
      ).all();

      if (configRows.results.length > 0) {
        const configMap: Record<string, string> = {};
        for (const row of configRows.results) {
          configMap[row.config_key as string] = row.config_value as string;
        }
        thresholds = {
          A1_required_min: parseInt(configMap['A1_required_min'] || '120'),
          A1_low_threshold: parseInt(configMap['A1_low_threshold'] || '80'),
          A2_required_min: parseInt(configMap['A2_required_min'] || '100'),
          A2_low_threshold: parseInt(configMap['A2_low_threshold'] || '70'),
          A3_required_min: parseInt(configMap['A3_required_min'] || '100'),
          A5_required_min: parseInt(configMap['A5_required_min'] || '120'),
          A7_required_min: parseInt(configMap['A7_required_min'] || '100'),
          A9_explanation_min: parseInt(configMap['A9_explanation_min'] || '80'),
          A10_explanation_min: parseInt(configMap['A10_explanation_min'] || '50'),
          A12_required_min: parseInt(configMap['A12_required_min'] || '100'),
          domain_high_min_percent: parseInt(configMap['domain_high_min_percent'] || '75'),
          domain_moderate_min_percent: parseInt(configMap['domain_moderate_min_percent'] || '50'),
          overall_mns_risk_threshold: parseInt(configMap['overall_mns_risk_threshold'] || '5'),
          domain_mns_threshold: parseInt(configMap['domain_mns_threshold'] || '3')
        };
      }
    } catch (_) {
      // Use defaults if config table doesn't exist yet
    }

    // Process Section A
    const sectionAFlags = processSectionA(
      section_a as SectionAResponses,
      !!is_international,
      thresholds
    );

    // Process Section B
    const sectionBResults = processSectionB(
      section_b as SectionBResponses,
      thresholds
    );

    // Generate full report
    const report = generatePERReport(
      sectionAFlags,
      sectionBResults,
      student_id || '',
      application_id || '',
      tenant_id
    );

    const submissionId = crypto.randomUUID();
    const flagId = crypto.randomUUID();
    const riskFlagId = crypto.randomUUID();

    const dbStatements = [];

    // Insert main submission
    dbStatements.push(env.DB.prepare(`
      INSERT INTO per_submissions (
        submission_id, tenant_id, student_name, student_id, student_email,
        application_id, is_international, status,
        section_a_responses, section_b_responses, report_json, submitted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'submitted', ?, ?, ?, datetime('now'))
    `).bind(
      submissionId, tenant_id, student_name, student_id || null, student_email || null,
      application_id || null, is_international ? 1 : 0,
      JSON.stringify(section_a), JSON.stringify(section_b), JSON.stringify(report)
    ));

    // Insert Section A flags
    dbStatements.push(env.DB.prepare(`
      INSERT INTO per_section_a_flags (
        flag_id, submission_id, career_clarity_score, course_alignment_score,
        academic_progression_score, study_readiness_status, english_preparedness_status,
        financial_preparedness_status, interview_recommended, flags, raw_word_counts
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      flagId, submissionId,
      sectionAFlags.career_clarity_score,
      sectionAFlags.course_alignment_score,
      sectionAFlags.academic_progression_score,
      sectionAFlags.study_readiness_status,
      sectionAFlags.english_preparedness_status,
      sectionAFlags.financial_preparedness_status,
      sectionAFlags.interview_recommended ? 1 : 0,
      JSON.stringify(sectionAFlags.flags),
      JSON.stringify(sectionAFlags.raw_word_counts)
    ));

    // Insert Section B domain scores
    for (const dr of sectionBResults.domainResults) {
      dbStatements.push(env.DB.prepare(`
        INSERT INTO per_domain_scores (
          score_id, submission_id, domain, confidence_level,
          domain_percentage, may_need_support_count, total_items, support_flag
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        crypto.randomUUID(), submissionId, dr.domain, dr.confidence_level,
        dr.domain_percentage, dr.may_need_support_count, dr.total_items,
        dr.support_flag ? 1 : 0
      ));
    }

    // Insert risk flags
    dbStatements.push(env.DB.prepare(`
      INSERT INTO per_risk_flags (
        flag_id, submission_id, overall_llnd_self_risk,
        reading_support_flag, writing_support_flag, numeracy_support_flag,
        learning_support_flag, digital_support_flag, high_digital_risk_flag,
        total_may_need_support
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      riskFlagId, submissionId,
      sectionBResults.riskFlags.overall_llnd_self_risk ? 1 : 0,
      sectionBResults.riskFlags.reading_support_flag ? 1 : 0,
      sectionBResults.riskFlags.writing_support_flag ? 1 : 0,
      sectionBResults.riskFlags.numeracy_support_flag ? 1 : 0,
      sectionBResults.riskFlags.learning_support_flag ? 1 : 0,
      sectionBResults.riskFlags.digital_support_flag ? 1 : 0,
      sectionBResults.riskFlags.high_digital_risk_flag ? 1 : 0,
      sectionBResults.riskFlags.total_may_need_support
    ));

    // Audit log
    dbStatements.push(env.DB.prepare(`
      INSERT INTO per_audit (tenant_id, submission_id, action, actor_id, actor_type, details)
      VALUES (?, ?, 'submitted', ?, 'student', ?)
    `).bind(
      tenant_id, submissionId, student_id || 'anonymous',
      JSON.stringify({ student_name, application_id, is_international })
    ));

    await env.DB.batch(dbStatements);

    return new Response(JSON.stringify({
      success: true,
      submission_id: submissionId,
      report
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (e: any) {
    console.error('PER Submit Error:', e);
    return new Response(JSON.stringify({ error: 'Submission failed', debug: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
