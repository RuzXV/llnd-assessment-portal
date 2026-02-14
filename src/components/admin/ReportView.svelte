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
      const urlParams = new URLSearchParams(window.location.search);
      attemptId = urlParams.get('id');

      if (!attemptId) {
        window.location.href = '/portal/llnd';
        return;
      }

      const token = localStorage.getItem('llnd_token');
      if (!token) { window.location.href = '/login'; return; }

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

    function getOutcomeStyle(outcome: string) {
      switch (outcome) {
        case 'meets_confident':
        case 'meets_expected':
          return 'background-color: #dcfce7; color: #166534;';
        case 'meets_monitor':
        case 'monitor':
          return 'background-color: #fef9c3; color: #854d0e;';
        case 'support_required':
          return 'background-color: #fee2e2; color: #991b1b;';
        default:
          return 'background-color: #f1f5f9; color: #1e293b;';
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

    function getProgressBarBg(percentage: number) {
      if (percentage >= 75) return '#22c55e';
      if (percentage >= 60) return '#eab308';
      return '#ef4444';
    }

    function getACSFBandColorHex(band: string) {
      if (band?.includes('confident') || band === 'ACSF 3+') return '#16a34a';
      if (band?.includes('monitor') || band === 'ACSF 3') return '#2563eb';
      if (band?.includes('borderline') || band === 'ACSF 2-3') return '#ca8a04';
      return '#dc2626';
    }

    function getOutcomeBannerBg(code: string) {
      if (code === 'meets_confident') return '#dcfce7';
      if (code === 'meets_monitor') return '#fef9c3';
      return '#fee2e2';
    }

    function getOutcomeBannerText(code: string) {
      if (code === 'meets_confident') return '#166534';
      if (code === 'meets_monitor') return '#854d0e';
      return '#991b1b';
    }

    function generateResultsSummary(report: any): string {
      if (!report?.overall || !report?.domains) return '';

      const score = report.overall.score?.toFixed(1) || '0';
      const outcomeCode = report.overall.outcome_code;
      const domains = report.domains || [];
      const studentName = report.student_name || report.student?.name || 'The student';

      const meetsDomains = domains.filter((d: any) => d.outcome === 'meets_expected').map((d: any) => d.name);
      const monitorDomains = domains.filter((d: any) => d.outcome === 'monitor').map((d: any) => d.name);
      const supportDomains = domains.filter((d: any) => d.outcome === 'support_required').map((d: any) => d.name);

      let summary = `${studentName} achieved an overall weighted score of ${score}%. `;

      if (outcomeCode === 'meets_confident') {
        summary += `This result indicates confident performance at the ACSF Level 3 benchmark, demonstrating readiness for AQF 3 level training across all assessed domains.`;
      } else if (outcomeCode === 'meets_monitor') {
        summary += `This result meets the ACSF Level 3 benchmark overall, however some areas may benefit from monitoring during initial training delivery.`;
      } else {
        summary += `This result indicates that targeted support is recommended before or during training delivery to ensure the learner can engage effectively with AQF 3 level materials.`;
      }

      if (meetsDomains.length > 0) {
        summary += ` Strengths were demonstrated in ${meetsDomains.join(', ')}.`;
      }
      if (monitorDomains.length > 0) {
        summary += ` ${monitorDomains.join(', ')} ${monitorDomains.length === 1 ? 'is' : 'are'} recommended for early monitoring.`;
      }
      if (supportDomains.length > 0) {
        summary += ` ${supportDomains.join(', ')} ${supportDomains.length === 1 ? 'has' : 'have'} been flagged for targeted support intervention.`;
      }

      return summary;
    }

    async function downloadPDF() {
      if (!reportElement || isDownloading) return;

      isDownloading = true;

      try {
        const studentName = report.student_name || report.student?.name || 'Unknown';

        // Constrain the report width to match A4 proportions before rendering
        // A4 at 96dpi ~794px wide, minus 10mm margins each side (~76px) = ~718px content
        const originalWidth = reportElement.style.width;
        reportElement.style.width = '710px';

        const opt: any = {
          margin: [10, 10, 10, 10],
          filename: `LLND_Report_${studentName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
            ignoreElements: (el: Element) => el.tagName === 'LINK' || el.tagName === 'STYLE',
            windowWidth: 750
          },
          jsPDF: {
            unit: 'mm',
            format: 'a4',
            orientation: 'portrait',
            compress: true
          },
          pagebreak: { mode: ['css'], before: '.pdf-page-break-before', after: '.pdf-page-break-after', avoid: '.pdf-no-break' }
        };

        await html2pdf().from(reportElement).set(opt).save();

        // Restore original width
        reportElement.style.width = originalWidth;
      } catch (e) {
        console.error('PDF generation failed:', e);
        alert('Failed to generate PDF. Please try again.');
      } finally {
        isDownloading = false;
      }
    }
  </script>

  {#if loading}
    <div style="padding: 3rem; text-align: center; color: #64748b;">Generating Report...</div>
  {:else if error}
    <div style="padding: 2rem; background-color: #fef2f2; color: #dc2626; border-radius: 0.5rem; border: 1px solid #fecaca; text-align: center;">
      <h3 style="font-weight: 700;">Error Loading Report</h3>
      <p>{error}</p>
    </div>
  {:else if report}
    <div style="margin-bottom: 1.5rem; display: flex; justify-content: flex-end; gap: 1rem;">
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

    <!-- REPORT: 100% inline styles, zero Tailwind classes — required for html2canvas/html2pdf compatibility -->
    <div bind:this={reportElement} style="background-color: #ffffff; border-radius: 0.75rem; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); overflow: hidden; border: 1px solid #e2e8f0; color: #1e293b; font-family: system-ui, -apple-system, sans-serif;">

      <!-- Header with branding -->
      <div style="padding: 2rem; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: flex-start; background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);">
        <div>
          <h1 style="font-size: 1.875rem; font-weight: 700; margin: 0 0 0.5rem 0; color: #0f172a;">LLND Assessment Report</h1>
          <p style="color: #64748b; margin: 0;">AQF {report.aqf_level || 3} - {report.context || 'Health & Community Services'}</p>
        </div>
        {#if report.logo_url}
          <img src={report.logo_url} alt="RTO Logo" style="height: 4rem; object-fit: contain;" />
        {:else}
          <div style="font-size: 1.25rem; font-weight: 700; color: #94a3b8;">{report.rto_name}</div>
        {/if}
      </div>

      <!-- Student Info -->
      <div style="padding: 2rem; border-bottom: 1px solid #e2e8f0; display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.5rem; background-color: #f8fafc;">
        <div>
          <div style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; margin-bottom: 0.25rem; color: #64748b;">Student Name</div>
          <div style="font-size: 1.125rem; font-weight: 500; color: #1e293b;">{report.student_name || 'Not Provided'}</div>
        </div>
        {#if report.student_id}
        <div>
          <div style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; margin-bottom: 0.25rem; color: #64748b;">Student ID</div>
          <div style="font-size: 1.125rem; font-weight: 500; color: #1e293b;">{report.student_id}</div>
        </div>
        {/if}
        <div>
          <div style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; margin-bottom: 0.25rem; color: #64748b;">Date Completed</div>
          <div style="font-size: 1.125rem; font-weight: 500; color: #1e293b;">{new Date(report.completion_date * 1000).toLocaleDateString()}</div>
        </div>
        <div>
          <div style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; margin-bottom: 0.25rem; color: #64748b;">Benchmark Version</div>
          <div style="font-size: 1.125rem; font-weight: 500; color: #1e293b;">{report.benchmark_version || 'AQF3_V1'}</div>
        </div>
      </div>

      <!-- Overall Outcome Banner -->
      {#if report.overall}
        <div style="padding: 1.5rem; border-bottom: 1px solid #e2e8f0; background-color: {getOutcomeBannerBg(report.overall.outcome_code)};">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <div>
              <div style="font-size: 0.875rem; font-weight: 700; text-transform: uppercase; margin-bottom: 0.25rem; color: #64748b;">Overall Outcome</div>
              <div style="font-size: 1.5rem; font-weight: 700; color: {getOutcomeBannerText(report.overall.outcome_code)};">
                {report.overall.outcome_label}
              </div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 0.875rem; font-weight: 700; text-transform: uppercase; margin-bottom: 0.25rem; color: #64748b;">Weighted Score</div>
              <div style="font-size: 1.875rem; font-weight: 700; color: #1e293b;">{report.overall.score?.toFixed(1) || 0}%</div>
            </div>
          </div>
          {#if report.overall.key_flags && report.overall.key_flags.length > 0}
            <div style="margin-top: 1rem; display: flex; flex-wrap: wrap; gap: 0.5rem;">
              {#each report.overall.key_flags as flag}
                <span style="padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 700; background-color: #fecaca; color: #991b1b;">
                  {flag}
                </span>
              {/each}
            </div>
          {/if}
          <!-- Results Summary -->
          <div style="margin-top: 1rem; padding: 1rem; border-radius: 0.375rem; background-color: rgba(255,255,255,0.5); border: 1px solid #e2e8f0;">
            <div style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; margin-bottom: 0.5rem; color: #64748b;">Results Summary</div>
            <p style="font-size: 0.875rem; color: #334155; margin: 0; line-height: 1.6;">{generateResultsSummary(report)}</p>
          </div>
        </div>
      {/if}

      <!-- Domain Scores -->
      <div style="padding: 2rem;">
        <h2 style="font-size: 1.25rem; font-weight: 700; margin: 0 0 1.5rem 0; color: #0f172a;">Domain Outcomes</h2>

        {#if report.domains && report.domains.length > 0}
          {#each report.domains as domain}
            <div style="margin-bottom: 1.5rem; padding: 1.5rem; border-radius: 0.5rem; border: 1px solid #e2e8f0; background-color: #fafafa;">
              <!-- Domain Header + Score (keep together) -->
              <div style="break-inside: avoid; page-break-inside: avoid;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
                  <div>
                    <h3 style="font-size: 1.125rem; font-weight: 700; color: #1e293b; margin: 0 0 0.25rem 0;">{domain.name}</h3>
                    <span style="font-size: 0.875rem; font-weight: 500; color: {getACSFBandColorHex(domain.estimated_acsf_band)};">
                      Estimated: {domain.estimated_acsf_band || 'N/A'}
                    </span>
                  </div>
                  <span style="padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 700; {getOutcomeStyle(domain.outcome)}">
                    {getOutcomeLabel(domain.outcome)}
                  </span>
                </div>

                <!-- Progress Bar -->
                <div style="margin-bottom: 1rem;">
                  <div style="display: flex; justify-content: space-between; font-size: 0.875rem; margin-bottom: 0.25rem;">
                    <span style="color: #64748b;">Score: {domain.raw_score}/{domain.max_score}</span>
                    <span style="font-weight: 700; color: #1e293b;">{domain.percentage?.toFixed(1)}%</span>
                  </div>
                  <div style="height: 0.75rem; border-radius: 9999px; overflow: hidden; background-color: #e2e8f0;">
                    <div style="height: 100%; width: {domain.percentage}%; background-color: {getProgressBarBg(domain.percentage)}; border-radius: 9999px;"></div>
                  </div>
                </div>
              </div>

              <!-- ACSF Breakdown -->
              {#if domain.acsf_breakdown}
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 1rem; padding: 1rem; border-radius: 0.375rem; border: 1px solid #e2e8f0; background-color: #f1f5f9; break-inside: avoid; page-break-inside: avoid;">
                  <div style="text-align: center;">
                    <div style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: #64748b;">ACSF 2</div>
                    <div style="font-size: 1.125rem; font-weight: 700; color: #1e293b;">{domain.acsf_breakdown.acsf2_percent?.toFixed(0) || 0}%</div>
                  </div>
                  <div style="text-align: center;">
                    <div style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: #64748b;">ACSF 3 Core</div>
                    <div style="font-size: 1.125rem; font-weight: 700; color: #1e293b;">{domain.acsf_breakdown.acsf3_core_percent?.toFixed(0) || 0}%</div>
                  </div>
                  <div style="text-align: center;">
                    <div style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: #64748b;">ACSF 3 Stretch</div>
                    <div style="font-size: 1.125rem; font-weight: 700; color: #1e293b;">{domain.acsf_breakdown.acsf3_stretch_percent?.toFixed(0) || 0}%</div>
                  </div>
                </div>
              {/if}

              <!-- Justification -->
              {#if domain.justification}
                <div style="padding: 1rem; border-radius: 0.375rem; border: 1px solid #e2e8f0; margin-bottom: 1rem; background-color: #ffffff; break-inside: avoid; page-break-inside: avoid;">
                  <div style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; margin-bottom: 0.5rem; color: #64748b;">Assessment Justification</div>
                  <p style="font-size: 0.875rem; color: #475569; margin: 0;">{domain.justification}</p>
                </div>
              {/if}

              <!-- Support Strategies -->
              {#if domain.strategies && domain.strategies.length > 0}
                <div style="padding: 1rem; border-radius: 0.375rem; border: 1px solid #bfdbfe; background-color: #eff6ff; break-inside: avoid; page-break-inside: avoid;">
                  <div style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; margin-bottom: 0.5rem; color: #1e40af;">Recommended Strategies</div>
                  <ul style="list-style-type: disc; padding-left: 1.25rem; margin: 0;">
                    {#each domain.strategies as strategy}
                      <li style="font-size: 0.875rem; color: #1e40af; margin-bottom: 0.25rem;">{strategy}</li>
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
            <div style="margin-bottom: 1.5rem; padding: 1.5rem; border-radius: 0.5rem; border: 1px solid #e2e8f0; background-color: #fafafa;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <h3 style="font-size: 1.125rem; font-weight: 700; text-transform: capitalize; color: #1e293b; margin: 0;">{domain}</h3>
                <span style="padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 700; {getOutcomeStyle(d.status)}">
                  {d.status?.replace('_', ' ') || 'Unknown'}
                </span>
              </div>

              <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem;">
                <div style="font-size: 0.875rem; font-weight: 700; width: 6rem; color: #64748b;">ACSF Level {d.acsf_level || 3}</div>
                <div style="flex: 1; height: 0.75rem; border-radius: 9999px; overflow: hidden; background-color: #e2e8f0;">
                  <div style="height: 100%; width: {(d.score / d.max) * 100}%; background-color: {getProgressBarBg((d.score / d.max) * 100)}; border-radius: 9999px;"></div>
                </div>
                <div style="font-size: 0.75rem; width: 3rem; text-align: right; color: #94a3b8;">{d.score}/{d.max}</div>
              </div>

              {#if d.recommendation}
                <div style="padding: 1rem; border-radius: 0.375rem; border: 1px solid #e2e8f0; background-color: #ffffff;">
                  <strong>Recommendation:</strong> {d.recommendation}
                </div>
              {/if}
            </div>
          {/each}
        {/if}
      </div>

      <!-- Footer -->
      <div style="padding: 2rem; border-top: 1px solid #e2e8f0; background-color: #f8fafc;">
        <p style="font-size: 0.75rem; text-align: center; line-height: 1.625; color: #64748b; margin: 0;">
          This LLND assessment has been conducted to support pre-training review and identification of learner support needs in accordance with Outcome Standards 2025.
          <br/>Verification Hash: <span style="font-family: monospace;">{report.verification_hash?.substring(0, 12) || 'N/A'}...</span>
          {#if report.generated_at}
            <br/>Report generated: {new Date(report.generated_at).toLocaleString()}
          {/if}
        </p>
      </div>
    </div>
  {/if}
