<script lang="ts">
    import { onMount } from 'svelte';
    import html2pdf from 'html2pdf.js';

    let attemptId: string | null = null;
    let loading = true;
    let error = '';
    let report: any = null;
    let reportElement: HTMLElement;
    let isDownloading = false;

    onMount(async () => {
      // Extract attemptId from URL query parameter: /report?id=xxx
      const urlParams = new URLSearchParams(window.location.search);
      attemptId = urlParams.get('id');

      if (!attemptId) {
        window.location.href = '/dashboard';
        return;
      }

      const token = localStorage.getItem('llnd_token');
      if (!token) { window.location.href = '/'; return; }

      try {
        const res = await fetch('/api/reports/generate', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ attempt_id: attemptId })
        });

        if (!res.ok) throw new Error('Report not found');

        const data: any = await res.json();
        report = data.report_data;

      } catch (e: any) {
        error = e.message;
      } finally {
        loading = false;
      }
    });

    function getOutcomeColor(outcome: string) {
      switch (outcome) {
        case 'meets_confident':
        case 'meets_expected':
          return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
        case 'meets_monitor':
        case 'monitor':
          return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
        case 'support_required':
          return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
        default:
          return 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300';
      }
    }

    function getOutcomeLabel(outcome: string) {
      switch (outcome) {
        case 'meets_confident':
          return 'Meets - Confident';
        case 'meets_expected':
          return 'Meets Expected';
        case 'meets_monitor':
          return 'Meets - Monitor';
        case 'monitor':
          return 'Monitor';
        case 'support_required':
          return 'Support Required';
        default:
          return outcome?.replace(/_/g, ' ') || 'Unknown';
      }
    }

    function getProgressBarColor(percentage: number) {
      if (percentage >= 75) return 'bg-green-500';
      if (percentage >= 60) return 'bg-yellow-500';
      return 'bg-red-500';
    }

    function getACSFBandColor(band: string) {
      if (band === 'ACSF 3+') return 'text-green-600 dark:text-green-400';
      if (band === 'ACSF 3') return 'text-blue-600 dark:text-blue-400';
      if (band === 'ACSF 2-3') return 'text-yellow-600 dark:text-yellow-400';
      return 'text-red-600 dark:text-red-400';
    }

    async function downloadPDF() {
      if (!reportElement || isDownloading) return;

      isDownloading = true;

      try {
        const studentName = report.student_name || report.student?.name || 'Unknown';
        const opt: any = {
          margin: [10, 10, 10, 10],
          filename: `LLND_Report_${studentName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff'
          },
          jsPDF: {
            unit: 'mm',
            format: 'a4',
            orientation: 'portrait',
            compress: true
          },
          pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
        };

        await html2pdf().from(reportElement).set(opt).save();
      } catch (e) {
        console.error('PDF generation failed:', e);
        alert('Failed to generate PDF. Please try again.');
      } finally {
        isDownloading = false;
      }
    }
  </script>

  {#if loading}
    <div class="p-12 text-center text-slate-500">Generating Report...</div>
  {:else if error}
    <div class="p-8 bg-red-50 text-red-600 rounded-lg border border-red-200 text-center">
      <h3 class="font-bold">Error Loading Report</h3>
      <p>{error}</p>
    </div>
  {:else if report}
    <div class="mb-6 flex justify-end gap-4">
      <button
        onclick={downloadPDF}
        disabled={isDownloading}
        class="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-bold rounded-lg
               hover:from-blue-600 hover:to-purple-700 transition-all duration-200
               disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl
               flex items-center gap-2"
      >
        {#if isDownloading}
          <svg class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Generating PDF...
        {:else}
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" />
          </svg>
          Download PDF Report
        {/if}
      </button>
    </div>

    <div bind:this={reportElement} class="bg-white rounded-xl shadow-lg overflow-hidden border border-slate-200" style="color: #1e293b;">
      <!-- Header with branding -->
      <div class="p-8 border-b border-slate-200 flex justify-between items-start" style="background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);">
        <div>
          <h1 class="text-3xl font-bold mb-2" style="color: #0f172a;">LLND Assessment Report</h1>
          <p style="color: #64748b;">AQF {report.aqf_level || 3} - {report.context || 'Health & Community Services'}</p>
        </div>
        {#if report.logo_url}
          <img src={report.logo_url} alt="RTO Logo" class="h-16 object-contain" />
        {:else}
          <div class="text-xl font-bold" style="color: #94a3b8;">{report.rto_name}</div>
        {/if}
      </div>

      <!-- Student Info -->
      <div class="p-8 border-b border-slate-200 grid grid-cols-2 md:grid-cols-4 gap-6" style="background-color: #f8fafc;">
        <div>
          <div class="text-xs font-bold uppercase mb-1" style="color: #64748b;">Student Name</div>
          <div class="text-lg font-medium" style="color: #1e293b;">{report.student_name || 'Not Provided'}</div>
        </div>
        {#if report.student_id}
        <div>
          <div class="text-xs font-bold uppercase mb-1" style="color: #64748b;">Student ID</div>
          <div class="text-lg font-medium" style="color: #1e293b;">{report.student_id}</div>
        </div>
        {/if}
        <div>
          <div class="text-xs font-bold uppercase mb-1" style="color: #64748b;">Date Completed</div>
          <div class="text-lg font-medium" style="color: #1e293b;">{new Date(report.completion_date * 1000).toLocaleDateString()}</div>
        </div>
        <div>
          <div class="text-xs font-bold uppercase mb-1" style="color: #64748b;">Benchmark Version</div>
          <div class="text-lg font-medium" style="color: #1e293b;">{report.benchmark_version || 'AQF3_V1'}</div>
        </div>
      </div>

      <!-- Overall Outcome Banner -->
      {#if report.overall}
        <div class="p-6 border-b border-slate-200" style="background-color: {report.overall.outcome_code === 'meets_confident' ? '#dcfce7' : report.overall.outcome_code === 'meets_monitor' ? '#fef9c3' : '#fee2e2'};">
          <div class="flex items-center justify-between">
            <div>
              <div class="text-sm font-bold uppercase mb-1" style="color: #64748b;">Overall Outcome</div>
              <div class="text-2xl font-bold" style="color: {report.overall.outcome_code === 'meets_confident' ? '#166534' : report.overall.outcome_code === 'meets_monitor' ? '#854d0e' : '#991b1b'};">
                {report.overall.outcome_label}
              </div>
            </div>
            <div class="text-right">
              <div class="text-sm font-bold uppercase mb-1" style="color: #64748b;">Weighted Score</div>
              <div class="text-3xl font-bold" style="color: #1e293b;">{report.overall.score?.toFixed(1) || 0}%</div>
            </div>
          </div>
          {#if report.overall.key_flags && report.overall.key_flags.length > 0}
            <div class="mt-4 flex flex-wrap gap-2">
              {#each report.overall.key_flags as flag}
                <span class="px-3 py-1 rounded-full text-xs font-bold" style="background-color: #fecaca; color: #991b1b;">
                  {flag}
                </span>
              {/each}
            </div>
          {/if}
        </div>
      {/if}

      <!-- Domain Scores -->
      <div class="p-8">
        <h2 class="text-xl font-bold mb-6" style="color: #0f172a;">Domain Outcomes</h2>

        {#if report.domains && report.domains.length > 0}
          <!-- New AQF3 format -->
          {#each report.domains as domain}
            <div class="mb-6 p-6 rounded-lg border border-slate-200 break-inside-avoid" style="background-color: #fafafa;">
              <!-- Domain Header -->
              <div class="flex justify-between items-start mb-4">
                <div>
                  <h3 class="text-lg font-bold" style="color: #1e293b;">{domain.name}</h3>
                  <span class="text-sm font-medium {getACSFBandColor(domain.estimated_acsf_band)}">
                    Estimated: {domain.estimated_acsf_band || 'N/A'}
                  </span>
                </div>
                <span class="px-3 py-1 rounded-full text-xs font-bold print-force-color {getOutcomeColor(domain.outcome)}">
                  {getOutcomeLabel(domain.outcome)}
                </span>
              </div>

              <!-- Progress Bar -->
              <div class="mb-4">
                <div class="flex justify-between text-sm mb-1">
                  <span style="color: #64748b;">Score: {domain.raw_score}/{domain.max_score}</span>
                  <span class="font-bold" style="color: #1e293b;">{domain.percentage?.toFixed(1)}%</span>
                </div>
                <div class="h-3 rounded-full overflow-hidden" style="background-color: #e2e8f0;">
                  <div
                    class="h-full print-force-color {getProgressBarColor(domain.percentage)}"
                    style="width: {domain.percentage}%"
                  ></div>
                </div>
              </div>

              <!-- ACSF Breakdown -->
              {#if domain.acsf_breakdown}
                <div class="grid grid-cols-3 gap-4 mb-4 p-4 rounded border" style="background-color: #f1f5f9; border-color: #e2e8f0;">
                  <div class="text-center">
                    <div class="text-xs font-bold uppercase" style="color: #64748b;">ACSF 2</div>
                    <div class="text-lg font-bold" style="color: #1e293b;">{domain.acsf_breakdown.acsf2_percent?.toFixed(0) || 0}%</div>
                  </div>
                  <div class="text-center">
                    <div class="text-xs font-bold uppercase" style="color: #64748b;">ACSF 3 Core</div>
                    <div class="text-lg font-bold" style="color: #1e293b;">{domain.acsf_breakdown.acsf3_core_percent?.toFixed(0) || 0}%</div>
                  </div>
                  <div class="text-center">
                    <div class="text-xs font-bold uppercase" style="color: #64748b;">ACSF 3 Stretch</div>
                    <div class="text-lg font-bold" style="color: #1e293b;">{domain.acsf_breakdown.acsf3_stretch_percent?.toFixed(0) || 0}%</div>
                  </div>
                </div>
              {/if}

              <!-- Justification -->
              {#if domain.justification}
                <div class="p-4 rounded border mb-4" style="background-color: #ffffff; border-color: #e2e8f0;">
                  <div class="text-xs font-bold uppercase mb-2" style="color: #64748b;">Assessment Justification</div>
                  <p class="text-sm" style="color: #475569;">{domain.justification}</p>
                </div>
              {/if}

              <!-- Support Strategies -->
              {#if domain.strategies && domain.strategies.length > 0}
                <div class="p-4 rounded border" style="background-color: #eff6ff; border-color: #bfdbfe;">
                  <div class="text-xs font-bold uppercase mb-2" style="color: #1e40af;">Recommended Strategies</div>
                  <ul class="list-disc list-inside space-y-1">
                    {#each domain.strategies as strategy}
                      <li class="text-sm" style="color: #1e40af;">{strategy}</li>
                    {/each}
                  </ul>
                </div>
              {/if}
            </div>
          {/each}
        {:else if report.scores}
          <!-- Legacy format fallback -->
          {#each Object.entries(report.scores) as [domain, data] (domain)}
            {@const d = data as any}
            <div class="mb-6 p-6 rounded-lg border border-slate-200 break-inside-avoid" style="background-color: #fafafa;">
              <div class="flex justify-between items-center mb-4">
                <h3 class="text-lg font-bold capitalize" style="color: #1e293b;">{domain}</h3>
                <span class="px-3 py-1 rounded-full text-xs font-bold print-force-color {getOutcomeColor(d.status)}">
                  {d.status?.replace('_', ' ') || 'Unknown'}
                </span>
              </div>

              <div class="flex items-center gap-4 mb-4">
                <div class="text-sm font-bold w-24" style="color: #64748b;">ACSF Level {d.acsf_level || 3}</div>
                <div class="flex-1 h-3 rounded-full overflow-hidden" style="background-color: #e2e8f0;">
                  <div
                    class="h-full print-force-color {getProgressBarColor((d.score / d.max) * 100)}"
                    style="width: {(d.score / d.max) * 100}%"
                  ></div>
                </div>
                <div class="text-xs w-12 text-right" style="color: #94a3b8;">{d.score}/{d.max}</div>
              </div>

              {#if d.recommendation}
                <div class="p-4 rounded border" style="background-color: #ffffff; border-color: #e2e8f0;">
                  <strong>Recommendation:</strong> {d.recommendation}
                </div>
              {/if}
            </div>
          {/each}
        {/if}
      </div>

      <!-- Footer -->
      <div class="p-8 border-t border-slate-200" style="background-color: #f8fafc;">
        <p class="text-xs text-center leading-relaxed" style="color: #64748b;">
          This LLND assessment has been conducted to support pre-training review and identification of learner support needs in accordance with Outcome Standards 2025.
          <br/>Verification Hash: <span class="font-mono">{report.verification_hash?.substring(0, 12) || 'N/A'}...</span>
          {#if report.generated_at}
            <br/>Report generated: {new Date(report.generated_at).toLocaleString()}
          {/if}
        </p>
      </div>
    </div>
  {/if}

<style>
  :global(.print-force-color) {
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }

  :global(.bg-red-500),
  :global(.bg-yellow-500),
  :global(.bg-green-500),
  :global(.bg-green-100),
  :global(.bg-orange-100),
  :global(.bg-red-100),
  :global(.bg-yellow-100) {
    print-color-adjust: exact !important;
    -webkit-print-color-adjust: exact !important;
  }
</style>
