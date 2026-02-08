export const onRequestPost: PagesFunction<Env> = async (context) => {
    const { request, env, data } = context;

    if (!data?.user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        const { attempt_id } = await request.json() as any;

        const attempt = await env.DB.prepare(`
            SELECT a.*, t.name as rto_name, t.logo_url, t.brand_primary_color
            FROM assessment_attempts a
            JOIN tenants t ON a.tenant_id = t.tenant_id
            WHERE a.attempt_id = ? AND a.tenant_id = ?
        `).bind(attempt_id, data.tenant_id).first();

        if (!attempt || attempt.status !== 'submitted') {
            return new Response(JSON.stringify({ error: 'Report not available' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Audit log report generation
        await env.DB.prepare(`
          INSERT INTO audit_logs (tenant_id, actor_id, action, entity_id, details)
          VALUES (?, ?, 'GENERATE_REPORT', ?, ?)
        `).bind(data.tenant_id, data.user, attempt_id, `Report for ${attempt.student_name}`).run();

        // Use new report_json if available, otherwise fall back to legacy format
        let reportData: any;

        if (attempt.report_json) {
            // New AQF3 format with full report data
            const storedReport = JSON.parse(attempt.report_json as string);
            reportData = {
                // Student info
                student_name: storedReport.student?.name || attempt.student_name,
                student_id: storedReport.student?.id || attempt.student_id,

                // Branding
                rto_name: storedReport.branding?.rto_name || attempt.rto_name,
                logo_url: storedReport.branding?.logo_url || attempt.logo_url,

                // Assessment info
                completion_date: storedReport.assessment?.submitted_at || attempt.submitted_at,
                attempt_id: storedReport.assessment?.attempt_id || attempt.attempt_id,
                aqf_level: storedReport.assessment?.aqf_level || 3,
                context: storedReport.assessment?.context || 'General',

                // Overall results
                overall: storedReport.overall || {
                    score: attempt.total_score,
                    outcome_code: attempt.overall_outcome || 'unknown',
                    outcome_label: attempt.overall_outcome === 'meets_confident' ? 'Meets AQF 3 - with confidence' :
                                   attempt.overall_outcome === 'meets_monitor' ? 'Meets AQF 3 - monitor' :
                                   'Support Required',
                    key_flags: []
                },

                // Domain scores with ACSF bands, justifications, strategies
                domains: storedReport.domains || [],

                // Benchmark version for audit
                benchmark_version: storedReport.version || attempt.benchmark_version || 'AQF3_V1',

                // Verification
                verification_hash: attempt.token_hash,
                generated_at: storedReport.generated_at || Date.now()
            };
        } else {
            // Legacy format for older assessments
            reportData = {
                student_name: attempt.student_name,
                rto_name: attempt.rto_name,
                logo_url: attempt.logo_url,
                completion_date: attempt.submitted_at,
                total_score: attempt.total_score,
                scores: JSON.parse(attempt.domain_breakdown as string || '{}'),
                verification_hash: attempt.token_hash,
                legacy_format: true
            };
        }

        return new Response(JSON.stringify({
            success: true,
            report_data: reportData
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (e: any) {
        console.error('Report generation error:', e);
        return new Response(JSON.stringify({ error: 'Failed to generate report', debug: e.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};