<script lang="ts">
    import { onMount } from 'svelte';
    import html2pdf from 'html2pdf.js';

    export let attemptId: string;

    let loading = true;
    let error = '';
    let report: any = null;
    let reportElement: HTMLElement;
    let isDownloading = false;
  
    onMount(async () => {
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
  
    function getLevelColor(level: number) {
      if (level <= 2) return 'bg-red-500';
      if (level === 3) return 'bg-yellow-500';
      return 'bg-green-500';
    }

    async function downloadPDF() {
      if (!reportElement || isDownloading) return;

      isDownloading = true;

      try {
        const opt: any = {
          margin: [10, 10, 10, 10],
          filename: `LLND_Report_${report.student_name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`,
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

    <div bind:this={reportElement} class="glass-panel bg-white dark:bg-slate-800 rounded-xl shadow-lg overflow-hidden border border-slate-200 dark:border-slate-700">

      <div class="p-8 border-b border-slate-200 dark:border-slate-700 flex justify-between items-start">
        <div>
          <h1 class="text-3xl font-bold text-slate-900 dark:text-white mb-2">LLND Assessment Report</h1>
          <p class="text-slate-500">ACSF Alignment & Support Needs Analysis</p>
        </div>
        {#if report.logo_url}
          <img src={report.logo_url} alt="RTO Logo" class="h-16 object-contain" />
        {:else}
          <div class="text-xl font-bold text-slate-400">{report.rto_name}</div>
        {/if}
      </div>
  
      <div class="p-8 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 grid grid-cols-2 gap-8">
        <div>
          <div class="block text-xs font-bold text-slate-500 uppercase">Student Name</div>
          <div class="text-lg font-medium dark:text-white">{report.student_name || 'Not Provided'}</div>
        </div>
        <div>
          <div class="block text-xs font-bold text-slate-500 uppercase">Date Completed</div>
          <div class="text-lg font-medium dark:text-white">{new Date(report.completion_date * 1000).toLocaleDateString()}</div>
        </div>
      </div>
  
      <div class="p-8 space-y-8">
        <h2 class="text-xl font-bold text-slate-900 dark:text-white mb-4">Domain Outcomes</h2>
        
        {#each Object.entries(report.scores) as [domain, data] (domain)}
          {@const d = data as any} 
          <div class="p-6 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 break-inside-avoid">
            <div class="flex justify-between items-center mb-4">
              <h3 class="text-lg font-bold capitalize text-slate-800 dark:text-slate-100">{domain}</h3>
              <span class={`px-3 py-1 rounded-full text-xs font-bold uppercase print-force-color
                ${d.status === 'competent' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}`}>
                {d.status.replace('_', ' ')}
              </span>
            </div>
  
            <div class="flex items-center gap-4 mb-4">
              <div class="text-sm font-bold text-slate-500 w-24">ACSF Level {d.acsf_level}</div>
              <div class="flex-1 h-3 bg-slate-200 rounded-full overflow-hidden">
                <div 
                  class="h-full {getLevelColor(d.acsf_level)} print-force-color" 
                  style="width: {(d.score / d.max) * 100}%"
                ></div>
              </div>
              <div class="text-xs text-slate-400 w-12 text-right">{d.score}/{d.max}</div>
            </div>
  
            <div class="text-sm text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 p-4 rounded border border-slate-200 dark:border-slate-700">
              <strong>Recommendation:</strong> {d.recommendation}
            </div>
          </div>
        {/each}
      </div>
  
      <div class="p-8 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
        <p class="text-xs text-slate-500 text-center leading-relaxed">
          This LLND assessment has been conducted to support pre-training review and identification of learner support needs in accordance with Outcome Standards 2025. 
          <br/>Verification Hash: <span class="font-mono">{report.verification_hash.substring(0, 12)}...</span>
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
  :global(.bg-orange-100) {
    print-color-adjust: exact !important;
    -webkit-print-color-adjust: exact !important;
  }
</style>