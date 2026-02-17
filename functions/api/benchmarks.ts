// GET /api/benchmarks - List all benchmark configurations
// GET /api/benchmarks?aqf_level=3 - Get config for specific level
// POST /api/benchmarks - Create/update benchmark config (super_admin only)

import { parseBenchmarkConfig } from '../config/benchmarks/benchmark-config';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env, data } = context;

  if (!data.user || (data.user_role !== 'rto_admin' && data.user_role !== 'super_admin')) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
  }

  const url = new URL(request.url);
  const aqfLevel = url.searchParams.get('aqf_level');

  try {
    if (aqfLevel) {
      const row = await env.DB.prepare(
        'SELECT * FROM benchmark_config WHERE aqf_level = ? AND is_active = 1 ORDER BY version DESC LIMIT 1'
      ).bind(aqfLevel).first();

      if (!row) {
        return new Response(JSON.stringify({ error: 'No configuration found for this AQF level' }), { status: 404 });
      }

      return new Response(JSON.stringify(parseBenchmarkConfig(row)), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // List all active configs
    const result = await env.DB.prepare(
      'SELECT * FROM benchmark_config WHERE is_active = 1 ORDER BY aqf_level'
    ).all();

    const configs = result.results.map(parseBenchmarkConfig);

    return new Response(JSON.stringify({ configs }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: 'Server error', debug: e.message }), { status: 500 });
  }
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env, data } = context;

  if (!data.user || data.user_role !== 'super_admin') {
    return new Response(JSON.stringify({ error: 'Forbidden: Super Admin only' }), { status: 403 });
  }

  try {
    const body = await request.json() as any;
    const {
      aqf_level, reading_weight, writing_weight, numeracy_weight, digital_weight, oral_weight,
      writing_scale_max, writing_max_points,
      threshold_strong, threshold_meets, threshold_monitor,
      override_rules, risk_thresholds, monitor_triggers,
      critical_domains, critical_fail_threshold
    } = body;

    if (!aqf_level) {
      return new Response(JSON.stringify({ error: 'aqf_level is required' }), { status: 400 });
    }

    // Validate weights sum to 1.0
    const weightSum = (reading_weight || 0) + (writing_weight || 0) + (numeracy_weight || 0) +
                      (digital_weight || 0) + (oral_weight || 0);
    if (Math.abs(weightSum - 1.0) > 0.01) {
      return new Response(JSON.stringify({ error: 'Domain weights must sum to 1.0' }), { status: 400 });
    }

    // Deactivate existing config for this level
    await env.DB.prepare(
      'UPDATE benchmark_config SET is_active = 0 WHERE aqf_level = ?'
    ).bind(aqf_level).run();

    // Get next version number
    const lastVersion = await env.DB.prepare(
      'SELECT MAX(CAST(version AS INTEGER)) as max_version FROM benchmark_config WHERE aqf_level = ?'
    ).bind(aqf_level).first();
    const newVersion = String(((lastVersion?.max_version as number) || 0) + 1);

    const configId = `bench_aqf${aqf_level.replace('-', '')}_v${newVersion}`;

    await env.DB.prepare(`
      INSERT INTO benchmark_config (
        config_id, aqf_level, version, is_active,
        reading_weight, writing_weight, numeracy_weight, digital_weight, oral_weight,
        writing_scale_max, writing_max_points,
        threshold_strong, threshold_meets, threshold_monitor,
        override_rules, risk_thresholds, monitor_triggers,
        critical_domains, critical_fail_threshold
      ) VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      configId, aqf_level, newVersion,
      reading_weight, writing_weight, numeracy_weight, digital_weight, oral_weight,
      writing_scale_max, writing_max_points,
      threshold_strong, threshold_meets, threshold_monitor,
      JSON.stringify(override_rules || {}),
      JSON.stringify(risk_thresholds || {}),
      JSON.stringify(monitor_triggers || {}),
      JSON.stringify(critical_domains || ['Reading', 'Numeracy']),
      critical_fail_threshold || 60
    ).run();

    // Audit log
    await env.DB.prepare(`
      INSERT INTO audit_logs (tenant_id, actor_id, action, entity_type, entity_id, details)
      VALUES ('system', ?, 'BENCHMARK_CONFIG_UPDATED', 'config', ?, ?)
    `).bind(
      data.user, configId,
      JSON.stringify({ aqf_level, version: newVersion })
    ).run();

    return new Response(JSON.stringify({
      success: true,
      config_id: configId,
      version: newVersion
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (e: any) {
    return new Response(JSON.stringify({ error: 'Server error', debug: e.message }), { status: 500 });
  }
};
