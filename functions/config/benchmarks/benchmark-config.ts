// Universal Benchmark Configuration System
// Config-driven: loads from benchmark_config DB table
// Supports AQF 3, 4, 5, 6, 8-9 with no code changes needed for new levels

// ============================================
// Type Definitions
// ============================================

export interface BenchmarkConfig {
  configId: string;
  aqfLevel: string;
  version: string;
  isActive: boolean;

  // Domain weights
  weights: {
    Reading: number;
    Writing: number;
    Numeracy: number;
    Digital: number;
    Oral: number;
  };

  // Writing rubric
  writingScaleMax: number;
  writingMaxPoints: number;

  // Classification bands
  thresholds: {
    strong: number;
    meets: number;
    monitor: number;
  };

  // Override rules
  overrideRules: OverrideRules;

  // Risk flag thresholds per domain
  riskThresholds: Record<string, number>;

  // Monitor trigger thresholds
  monitorTriggers: Record<string, number>;

  // ACSF configuration
  acsfConfig: {
    coreMeets: number;
    stretchMeets: number;
    acsf2Meets: number;
    acsf2Fail: number;
  };

  // Safety rules
  criticalDomains: string[];
  criticalFailThreshold: number;
}

export interface OverrideRules {
  auto_support: OverrideRule[];
  monitor_cap: MonitorCapRule[];
  multi_domain_rule: MultiDomainRule | null;
}

export interface OverrideRule {
  condition: 'OR' | 'AND' | 'SINGLE' | 'ANY_2_CORE';
  rules?: { domain: string; threshold: number }[];
  core_domains?: string[];
  threshold?: number;
}

export interface MonitorCapRule {
  condition: 'single_below' | 'multi_below';
  domain?: string;
  threshold: number;
  count?: number;
}

export interface MultiDomainRule {
  threshold: number;
  count: number;
  domains?: string[];
}

// ============================================
// Classification Labels per AQF Level
// ============================================

export const CLASSIFICATION_LABELS: Record<string, Record<string, string>> = {
  '3': {
    exceeds: 'Exceeds Entry Benchmark',
    meets: 'Meets Entry Benchmark',
    monitor: 'Borderline – Monitor',
    support_required: 'Support Required'
  },
  '4': {
    exceeds: 'Strong Capability',
    meets: 'Meets Benchmark',
    monitor: 'Monitor',
    support_required: 'Support Required'
  },
  '5': {
    exceeds: 'Strong Diploma Readiness',
    meets: 'Meets Diploma Benchmark',
    monitor: 'Monitor',
    support_required: 'Support Required'
  },
  '6': {
    exceeds: 'Advanced Capability',
    meets: 'Meets Advanced Diploma Benchmark',
    monitor: 'Monitor',
    support_required: 'Support Required'
  },
  '8-9': {
    exceeds: 'Postgraduate Readiness – Strong',
    meets: 'Meets Postgraduate Benchmark',
    monitor: 'Monitor',
    support_required: 'Support Required'
  }
};

// ============================================
// AQF Level Display Names
// ============================================

export const AQF_LEVEL_NAMES: Record<string, string> = {
  '3': 'Certificate III',
  '4': 'Certificate IV',
  '5': 'Diploma',
  '6': 'Advanced Diploma',
  '8-9': 'Graduate Diploma'
};

// ============================================
// Parse DB row into typed BenchmarkConfig
// ============================================

export function parseBenchmarkConfig(row: any): BenchmarkConfig {
  return {
    configId: row.config_id,
    aqfLevel: row.aqf_level,
    version: row.version,
    isActive: row.is_active === 1,
    weights: {
      Reading: row.reading_weight,
      Writing: row.writing_weight,
      Numeracy: row.numeracy_weight,
      Digital: row.digital_weight,
      Oral: row.oral_weight
    },
    writingScaleMax: row.writing_scale_max,
    writingMaxPoints: row.writing_max_points,
    thresholds: {
      strong: row.threshold_strong,
      meets: row.threshold_meets,
      monitor: row.threshold_monitor
    },
    overrideRules: JSON.parse(row.override_rules || '{}'),
    riskThresholds: JSON.parse(row.risk_thresholds || '{}'),
    monitorTriggers: JSON.parse(row.monitor_triggers || '{}'),
    acsfConfig: {
      coreMeets: row.acsf_core_meets,
      stretchMeets: row.acsf_stretch_meets,
      acsf2Meets: row.acsf2_meets,
      acsf2Fail: row.acsf2_fail
    },
    criticalDomains: JSON.parse(row.critical_domains || '["Reading","Numeracy"]'),
    criticalFailThreshold: row.critical_fail_threshold
  };
}

// ============================================
// Load benchmark config from D1 database
// ============================================

export async function loadBenchmarkConfig(
  db: D1Database,
  aqfLevel: string
): Promise<BenchmarkConfig | null> {
  const row = await db.prepare(
    'SELECT * FROM benchmark_config WHERE aqf_level = ? AND is_active = 1 ORDER BY version DESC LIMIT 1'
  ).bind(aqfLevel).first();

  if (!row) return null;
  return parseBenchmarkConfig(row);
}

// ============================================
// Fallback: In-memory configs for when DB is unavailable
// These mirror the seed data in schema.sql
// ============================================

export const FALLBACK_CONFIGS: Record<string, BenchmarkConfig> = {
  '3': {
    configId: 'bench_aqf3_v1',
    aqfLevel: '3',
    version: '1',
    isActive: true,
    weights: { Reading: 0.30, Writing: 0.15, Numeracy: 0.30, Digital: 0.15, Oral: 0.10 },
    writingScaleMax: 3,
    writingMaxPoints: 15,
    thresholds: { strong: 80, meets: 65, monitor: 50 },
    overrideRules: {
      auto_support: [{ condition: 'OR', rules: [{ domain: 'Reading', threshold: 60 }, { domain: 'Numeracy', threshold: 60 }] }],
      monitor_cap: [],
      multi_domain_rule: null
    },
    riskThresholds: { Reading: 70, Writing: 60, Numeracy: 70, Digital: 60 },
    monitorTriggers: { Writing: 50, Digital: 50 },
    acsfConfig: { coreMeets: 70, stretchMeets: 50, acsf2Meets: 70, acsf2Fail: 60 },
    criticalDomains: ['Reading', 'Numeracy'],
    criticalFailThreshold: 60
  },
  '4': {
    configId: 'bench_aqf4_v1',
    aqfLevel: '4',
    version: '1',
    isActive: true,
    weights: { Reading: 0.25, Writing: 0.20, Numeracy: 0.25, Digital: 0.20, Oral: 0.10 },
    writingScaleMax: 4,
    writingMaxPoints: 20,
    thresholds: { strong: 85, meets: 70, monitor: 55 },
    overrideRules: {
      auto_support: [
        { condition: 'AND', rules: [{ domain: 'Reading', threshold: 60 }, { domain: 'Numeracy', threshold: 60 }] },
        { condition: 'SINGLE', rules: [{ domain: 'Writing', threshold: 50 }] }
      ],
      monitor_cap: [{ condition: 'multi_below', threshold: 65, count: 2 }],
      multi_domain_rule: { threshold: 65, count: 2 }
    },
    riskThresholds: { Reading: 70, Writing: 65, Numeracy: 70, Digital: 65 },
    monitorTriggers: { Writing: 50, Digital: 50 },
    acsfConfig: { coreMeets: 70, stretchMeets: 50, acsf2Meets: 70, acsf2Fail: 60 },
    criticalDomains: ['Reading', 'Numeracy'],
    criticalFailThreshold: 60
  },
  '5': {
    configId: 'bench_aqf5_v1',
    aqfLevel: '5',
    version: '1',
    isActive: true,
    weights: { Reading: 0.25, Writing: 0.25, Numeracy: 0.20, Digital: 0.20, Oral: 0.10 },
    writingScaleMax: 4,
    writingMaxPoints: 20,
    thresholds: { strong: 85, meets: 70, monitor: 60 },
    overrideRules: {
      auto_support: [
        { condition: 'ANY_2_CORE', core_domains: ['Reading', 'Writing', 'Numeracy'], threshold: 60 },
        { condition: 'SINGLE', rules: [{ domain: 'Writing', threshold: 55 }] }
      ],
      monitor_cap: [{ condition: 'single_below', domain: 'Digital', threshold: 60 }],
      multi_domain_rule: { threshold: 60, count: 2, domains: ['Reading', 'Writing', 'Numeracy'] }
    },
    riskThresholds: { Reading: 70, Writing: 70, Numeracy: 70, Digital: 65 },
    monitorTriggers: { Digital: 60 },
    acsfConfig: { coreMeets: 70, stretchMeets: 50, acsf2Meets: 70, acsf2Fail: 60 },
    criticalDomains: ['Reading', 'Writing', 'Numeracy'],
    criticalFailThreshold: 60
  },
  '6': {
    configId: 'bench_aqf6_v1',
    aqfLevel: '6',
    version: '1',
    isActive: true,
    weights: { Reading: 0.20, Writing: 0.30, Numeracy: 0.20, Digital: 0.20, Oral: 0.10 },
    writingScaleMax: 5,
    writingMaxPoints: 25,
    thresholds: { strong: 90, meets: 75, monitor: 65 },
    overrideRules: {
      auto_support: [
        { condition: 'SINGLE', rules: [{ domain: 'Writing', threshold: 60 }] },
        { condition: 'SINGLE', rules: [{ domain: 'Reading', threshold: 65 }] }
      ],
      monitor_cap: [
        { condition: 'multi_below', threshold: 70, count: 2 },
        { condition: 'single_below', domain: 'Digital', threshold: 65 }
      ],
      multi_domain_rule: { threshold: 70, count: 2 }
    },
    riskThresholds: { Reading: 70, Writing: 70, Numeracy: 70, Digital: 70 },
    monitorTriggers: { Digital: 65 },
    acsfConfig: { coreMeets: 70, stretchMeets: 50, acsf2Meets: 70, acsf2Fail: 60 },
    criticalDomains: ['Reading', 'Writing'],
    criticalFailThreshold: 65
  },
  '8-9': {
    configId: 'bench_aqf89_v1',
    aqfLevel: '8-9',
    version: '1',
    isActive: true,
    weights: { Reading: 0.25, Writing: 0.35, Numeracy: 0.15, Digital: 0.15, Oral: 0.10 },
    writingScaleMax: 6,
    writingMaxPoints: 30,
    thresholds: { strong: 90, meets: 80, monitor: 70 },
    overrideRules: {
      auto_support: [
        { condition: 'SINGLE', rules: [{ domain: 'Writing', threshold: 70 }] },
        { condition: 'SINGLE', rules: [{ domain: 'Reading', threshold: 65 }] }
      ],
      monitor_cap: [
        { condition: 'multi_below', threshold: 70, count: 2 },
        { condition: 'single_below', domain: 'Digital', threshold: 65 }
      ],
      multi_domain_rule: { threshold: 70, count: 2 }
    },
    riskThresholds: { Reading: 75, Writing: 75, Numeracy: 65, Digital: 70 },
    monitorTriggers: { Digital: 65 },
    acsfConfig: { coreMeets: 70, stretchMeets: 50, acsf2Meets: 70, acsf2Fail: 60 },
    criticalDomains: ['Reading', 'Writing'],
    criticalFailThreshold: 65
  }
};

// Get config with DB fallback
export async function getBenchmarkConfig(
  db: D1Database | null,
  aqfLevel: string
): Promise<BenchmarkConfig> {
  if (db) {
    const config = await loadBenchmarkConfig(db, aqfLevel);
    if (config) return config;
  }
  const fallback = FALLBACK_CONFIGS[aqfLevel];
  if (!fallback) {
    throw new Error(`No benchmark configuration found for AQF level: ${aqfLevel}`);
  }
  return fallback;
}
