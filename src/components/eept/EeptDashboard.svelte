<script lang="ts">
  import { onMount } from 'svelte';

  // ============================================
  // State
  // ============================================
  let loading = $state(true);
  let error = $state('');

  // Dashboard data
  let assessments = $state<any[]>([]);
  let statusCounts = $state<Record<string, number>>({});
  let reviewQueue = $state<any[]>([]);

  // Tabs
  type Tab = 'dashboard' | 'issue' | 'review' | 'export';
  let activeTab = $state<Tab>('dashboard');

  // Filters
  let statusFilter = $state('');
  let searchQuery = $state('');
  let expandedRows = $state<Set<string>>(new Set());

  // Issue form
  let issueFirstName = $state('');
  let issueLastName = $state('');
  let issueEmail = $state('');
  let issueMobile = $state('');
  let issueStudentId = $state('');
  let issueCourse = $state('');
  let issueCohort = $state('');
  let issuing = $state(false);
  let issueError = $state('');
  let issueSuccess = $state('');

  // CSV bulk
  let csvFile = $state<File | null>(null);
  let csvUploading = $state(false);
  let csvResults = $state<any>(null);

  // Review
  let selectedReview = $state<any>(null);
  let reviewScores = $state<Record<string, number>>({});
  let reviewNotes = $state('');
  let reviewSubmitting = $state(false);
  let reviewError = $state('');

  // Detail modal
  let showDetail = $state(false);
  let detailData = $state<any>(null);
  let detailLoading = $state(false);

  // ============================================
  // Derived
  // ============================================
  let filteredAssessments = $derived.by(() => {
    let result = assessments;
    if (statusFilter) {
      result = result.filter(a => a.status === statusFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(a =>
        (a.first_name?.toLowerCase().includes(q)) ||
        (a.last_name?.toLowerCase().includes(q)) ||
        (a.email?.toLowerCase().includes(q)) ||
        (a.student_id?.toLowerCase().includes(q)) ||
        (a.assessment_id?.toLowerCase().includes(q)) ||
        (a.cohort_tag?.toLowerCase().includes(q))
      );
    }
    return result;
  });

  let totalIssued = $derived(statusCounts['issued'] || 0);
  let totalStarted = $derived(statusCounts['started'] || 0);
  let totalSubmitted = $derived(statusCounts['submitted'] || 0);
  let totalFinalised = $derived(statusCounts['finalised'] || 0);
  let totalReview = $derived(statusCounts['review_required'] || 0);

  // ============================================
  // Lifecycle
  // ============================================
  onMount(async () => {
    await loadData();
  });

  function getToken() {
    return localStorage.getItem('llnd_token') || '';
  }

  function authHeaders() {
    return { 'Authorization': `Bearer ${getToken()}` };
  }

  async function loadData() {
    loading = true;
    error = '';
    try {
      const [assessRes, reviewRes] = await Promise.all([
        fetch('/api/ebpa/assessment/list', { headers: authHeaders() }),
        fetch('/api/ebpa/review/queue', { headers: authHeaders() }),
      ]);

      if (!assessRes.ok) throw new Error('Failed to load assessments');

      const assessData = await assessRes.json();
      assessments = assessData.assessments || [];
      statusCounts = assessData.status_counts || {};

      if (reviewRes.ok) {
        const reviewData = await reviewRes.json();
        reviewQueue = reviewData.queue || [];
      }
    } catch (e: any) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  // ============================================
  // Issue Assessment
  // ============================================
  async function issueManual(e: Event) {
    e.preventDefault();
    issuing = true;
    issueError = '';
    issueSuccess = '';

    try {
      const res = await fetch('/api/ebpa/issue/manual', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: issueFirstName,
          last_name: issueLastName,
          email: issueEmail,
          mobile: issueMobile || undefined,
          student_id: issueStudentId || undefined,
          course_intended: issueCourse || undefined,
          cohort_tag: issueCohort || undefined,
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to issue assessment');

      const link = `${window.location.origin}${data.assessment_link}`;
      issueSuccess = link;

      // Reset form
      issueFirstName = '';
      issueLastName = '';
      issueEmail = '';
      issueMobile = '';
      issueStudentId = '';
      issueCourse = '';
      issueCohort = '';

      await loadData();
    } catch (e: any) {
      issueError = e.message;
    } finally {
      issuing = false;
    }
  }

  async function uploadCSV() {
    if (!csvFile) return;
    csvUploading = true;
    csvResults = null;

    try {
      const text = await csvFile.text();
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length < 2) throw new Error('CSV must have a header row and at least one data row');

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const rows = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim());
        const row: any = {};
        headers.forEach((h, i) => { row[h] = values[i] || ''; });
        return row;
      });

      const res = await fetch('/api/ebpa/issue/csv', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'CSV upload failed');

      csvResults = data;
      csvFile = null;
      await loadData();
    } catch (e: any) {
      csvResults = { error: e.message };
    } finally {
      csvUploading = false;
    }
  }

  // ============================================
  // View Detail
  // ============================================
  async function viewDetail(assessmentId: string) {
    showDetail = true;
    detailLoading = true;
    detailData = null;

    try {
      const res = await fetch(`/api/ebpa/assessment/${assessmentId}/detail`, {
        headers: authHeaders()
      });
      if (!res.ok) throw new Error('Failed to load detail');
      detailData = await res.json();
    } catch (e: any) {
      detailData = { error: e.message };
    } finally {
      detailLoading = false;
    }
  }

  function closeDetail() {
    showDetail = false;
    detailData = null;
  }

  // ============================================
  // Review
  // ============================================
  function openReview(item: any) {
    selectedReview = item;
    reviewScores = {};
    reviewNotes = '';
    reviewError = '';
  }

  async function submitReview() {
    if (!selectedReview) return;
    reviewSubmitting = true;
    reviewError = '';

    try {
      const res = await fetch('/api/ebpa/review/complete', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          writing_submission_id: selectedReview.submission_id,
          domain_scores: reviewScores,
          notes: reviewNotes,
          review_reason: selectedReview.review_reason || 'flagged',
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Review submission failed');
      }

      selectedReview = null;
      await loadData();
    } catch (e: any) {
      reviewError = e.message;
    } finally {
      reviewSubmitting = false;
    }
  }

  // ============================================
  // Export
  // ============================================
  async function exportCSV() {
    try {
      const res = await fetch('/api/ebpa/export/candidates', {
        headers: authHeaders()
      });
      if (!res.ok) throw new Error('Export failed');

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `eept-export-${new Date().toISOString().slice(0,10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      error = e.message;
    }
  }

  // ============================================
  // Helpers
  // ============================================
  function getStatusBadge(status: string) {
      const map: Record<string, string> = {
          'issued': 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800',
          'started': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800',
          'submitted': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800',
          'scoring_in_progress': 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300 border border-orange-200 dark:border-orange-800',
          'review_required': 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300 border border-red-200 dark:border-red-800',
          'finalised': 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300 border border-green-200 dark:border-green-800',
          'cancelled': 'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-300 border border-gray-200 dark:border-gray-600',
      };
      return map[status] || map['cancelled'];
  }

  function getCefrColor(cefr: string) {
      const map: Record<string, string> = {
          'A2': 'text-red-400', 'B1': 'text-amber-400', 'B2': 'text-blue-400', 'C1': 'text-green-400'
      };
      return map[cefr] || 'text-slate-400';
  }

  function getBenchmarkBadge(bm: string) {
      if (bm === 'GREEN') return 'bg-green-500/20 text-green-400 border-green-500/30';
      if (bm === 'AMBER') return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      if (bm === 'RED') return 'bg-red-500/20 text-red-400 border-red-500/30';
      return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
  }

  function formatDate(d: string | null) {
    if (!d) return '-';
    return new Date(d).toLocaleDateString();
  }

  function formatDateTime(d: string | null) {
    if (!d) return '-';
    return new Date(d).toLocaleString();
  }

  function toggleRow(id: string) {
    const newSet = new Set(expandedRows);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    expandedRows = newSet;
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
  }
</script>

<div class="space-y-6">
  {#if error}
      <div class="rounded-lg bg-red-500/10 border border-red-500/20 p-4 text-red-600 dark:text-red-400">
          <p class="text-sm font-medium">Error: {error}</p>
      </div>
  {/if}

  <!-- Stats Row -->
  <div class="grid grid-cols-2 sm:grid-cols-5 gap-4">
      <div class="glass-panel rounded-xl p-5 relative group">
          <dt class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Issued</dt>
          <dd class="mt-1 text-2xl font-bold text-blue-600 dark:text-blue-400">{loading ? '-' : totalIssued}</dd>
      </div>
      <div class="glass-panel rounded-xl p-5 relative group">
          <dt class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">In Progress</dt>
          <dd class="mt-1 text-2xl font-bold text-yellow-600 dark:text-yellow-400">{loading ? '-' : totalStarted}</dd>
      </div>
      <div class="glass-panel rounded-xl p-5 relative group">
          <dt class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Submitted</dt>
          <dd class="mt-1 text-2xl font-bold text-indigo-600 dark:text-indigo-400">{loading ? '-' : totalSubmitted}</dd>
      </div>
      <div class="glass-panel rounded-xl p-5 relative group">
          <dt class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Needs Review</dt>
          <dd class="mt-1 text-2xl font-bold text-red-600 dark:text-red-400">{loading ? '-' : totalReview}</dd>
      </div>
      <div class="glass-panel rounded-xl p-5 relative group">
          <dt class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Finalised</dt>
          <dd class="mt-1 text-2xl font-bold text-green-600 dark:text-green-400">{loading ? '-' : totalFinalised}</dd>
      </div>
  </div>

  <!-- Tab Navigation -->
  <div class="flex gap-1 border-b border-slate-200/20 dark:border-slate-700/50">
      {#each ([['dashboard', 'Assessment History'], ['issue', 'Issue Assessment'], ['review', 'Review Queue'], ['export', 'Export']] as [Tab, string][]) as [tab, label]}
          <button
              onclick={() => activeTab = tab}
              class="px-4 py-2.5 text-sm font-medium transition-colors border-b-2
                  {activeTab === tab
                      ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                      : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}"
          >
              {label}
              {#if tab === 'review' && reviewQueue.length > 0}
                  <span class="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-red-500 text-white">{reviewQueue.length}</span>
              {/if}
          </button>
      {/each}
  </div>

  <!-- TAB: DASHBOARD / ASSESSMENT HISTORY -->
  {#if activeTab === 'dashboard'}
    <div class="glass-panel rounded-xl overflow-hidden">
        <div class="px-6 py-4 border-b border-gray-200/50 dark:border-gray-700/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div class="flex items-center gap-3">
                <h3 class="text-lg font-bold text-slate-900 dark:text-white">Assessment History</h3>
                <select
                    bind:value={statusFilter}
                    onchange={() => loadData()}
                    class="glass-input text-xs rounded-lg px-2 py-1.5"
                >
                    <option value="">All Statuses</option>
                    <option value="issued">Issued</option>
                    <option value="started">Started</option>
                    <option value="submitted">Submitted</option>
                    <option value="review_required">Review Required</option>
                    <option value="finalised">Finalised</option>
                </select>
            </div>
            <div class="relative">
                <input
                    type="text"
                    bind:value={searchQuery}
                    placeholder="Search by name, email, ID..."
                    class="glass-input w-full sm:w-64 pl-10 pr-4 py-2 text-sm rounded-lg"
                />
                <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
            </div>
        </div>

        <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200/50 dark:divide-gray-700/50">
                <thead class="bg-gray-50/50 dark:bg-slate-800/50">
                    <tr>
                        <th class="px-4 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Candidate</th>
                        <th class="px-4 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
                        <th class="px-4 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">CEFR</th>
                        <th class="px-4 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Score</th>
                        <th class="px-4 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Benchmark</th>
                        <th class="px-4 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Date</th>
                        <th class="relative px-4 py-3 w-12"><span class="sr-only">Actions</span></th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-200/50 dark:divide-gray-700/50">
                    {#each filteredAssessments as a}
                        <tr class="hover:bg-white/40 dark:hover:bg-slate-700/40 transition-colors cursor-pointer" onclick={() => toggleRow(a.assessment_id)}>
                            <td class="px-4 py-3.5 whitespace-nowrap">
                                <div class="text-sm font-medium text-slate-900 dark:text-white">{a.first_name} {a.last_name}</div>
                                <div class="text-xs text-slate-500 dark:text-slate-400">{a.email}</div>
                            </td>
                            <td class="px-4 py-3.5 whitespace-nowrap">
                                <span class={`px-2 py-0.5 inline-flex text-xs leading-5 font-bold rounded-full ${getStatusBadge(a.status)}`}>
                                    {a.status.replace(/_/g, ' ').toUpperCase()}
                                </span>
                            </td>
                            <td class="px-4 py-3.5 whitespace-nowrap">
                                {#if a.overall_cefr}
                                    <span class={`text-sm font-bold ${getCefrColor(a.overall_cefr)}`}>{a.overall_cefr}</span>
                                {:else}
                                    <span class="text-xs text-slate-500">-</span>
                                {/if}
                            </td>
                            <td class="px-4 py-3.5 whitespace-nowrap">
                                {#if a.composite_score != null}
                                    <span class="text-sm font-medium text-slate-200">{a.composite_score}</span>
                                    <span class="text-xs text-slate-500">/100</span>
                                {:else}
                                    <span class="text-xs text-slate-500">-</span>
                                {/if}
                            </td>
                            <td class="px-4 py-3.5 whitespace-nowrap">
                                {#if a.benchmark_result}
                                    <span class={`px-2 py-0.5 text-xs font-bold rounded-full border ${getBenchmarkBadge(a.benchmark_result)}`}>
                                        {a.benchmark_result}
                                    </span>
                                {:else}
                                    <span class="text-xs text-slate-500">-</span>
                                {/if}
                            </td>
                            <td class="px-4 py-3.5 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                                {formatDate(a.issued_at)}
                            </td>
                            <td class="px-4 py-3.5 whitespace-nowrap text-right">
                                <button class="text-slate-400 hover:text-slate-200 transition-colors">
                                    <svg class={`w-5 h-5 transition-transform ${expandedRows.has(a.assessment_id) ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>
                            </td>
                        </tr>

                        {#if expandedRows.has(a.assessment_id)}
                            <tr class="bg-slate-200/80 dark:bg-slate-700/60 border-l-4 border-purple-500">
                                <td colspan="7" class="px-6 py-4">
                                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                        <div class="space-y-2">
                                            <div><span class="font-medium text-slate-500">Student ID:</span> <span class="ml-1 text-slate-200">{a.student_id || '-'}</span></div>
                                            <div><span class="font-medium text-slate-500">Cohort:</span> <span class="ml-1 text-slate-200">{a.cohort_tag || '-'}</span></div>
                                            <div><span class="font-medium text-slate-500">Course:</span> <span class="ml-1 text-slate-200">{a.course_intended || '-'}</span></div>
                                        </div>
                                        <div class="space-y-2">
                                            <div><span class="font-medium text-slate-500">Started:</span> <span class="ml-1 text-slate-200">{formatDateTime(a.started_at)}</span></div>
                                            <div><span class="font-medium text-slate-500">Submitted:</span> <span class="ml-1 text-slate-200">{formatDateTime(a.submitted_at)}</span></div>
                                            <div><span class="font-medium text-slate-500">Finalised:</span> <span class="ml-1 text-slate-200">{formatDateTime(a.finalised_at)}</span></div>
                                        </div>
                                        <div class="space-y-2">
                                            {#if a.ielts_indicative}
                                                <div><span class="font-medium text-slate-500">IELTS Indicative:</span> <span class="ml-1 text-slate-200 font-bold">{a.ielts_indicative}</span></div>
                                            {/if}
                                            {#if a.reading_cefr}
                                                <div><span class="font-medium text-slate-500">Reading CEFR:</span> <span class="ml-1 {getCefrColor(a.reading_cefr)} font-bold">{a.reading_cefr}</span></div>
                                            {/if}
                                            {#if a.writing_cefr}
                                                <div><span class="font-medium text-slate-500">Writing CEFR:</span> <span class="ml-1 {getCefrColor(a.writing_cefr)} font-bold">{a.writing_cefr}</span></div>
                                            {/if}
                                        </div>
                                    </div>
                                    <div class="mt-4 flex gap-2">
                                        <button
                                            onclick={(e) => { e.stopPropagation(); viewDetail(a.assessment_id); }}
                                            class="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg text-white bg-purple-600 hover:bg-purple-700 transition-colors"
                                        >
                                            View Full Detail
                                        </button>
                                        {#if a.status === 'issued'}
                                            <button
                                                onclick={(e) => { e.stopPropagation(); copyToClipboard(`${window.location.origin}/assess-eept?token=${a.secure_token}`); }}
                                                class="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 transition-colors"
                                            >
                                                Copy Link
                                            </button>
                                        {/if}
                                    </div>
                                </td>
                            </tr>
                        {/if}
                    {:else}
                        <tr>
                            <td colspan="7" class="px-6 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                                {loading ? 'Loading...' : 'No assessments found.'}
                            </td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        </div>
    </div>

  <!-- TAB: ISSUE ASSESSMENT -->
  {:else if activeTab === 'issue'}
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <!-- Manual Issue -->
        <div class="glass-panel rounded-xl p-6">
            <div class="flex items-center gap-3 mb-1">
                <div class="p-2 rounded-lg bg-purple-500/10">
                    <svg class="w-5 h-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                </div>
                <h3 class="text-lg font-bold text-slate-900 dark:text-white">Issue Individual Assessment</h3>
            </div>
            <p class="text-sm text-slate-500 dark:text-slate-400 mb-5">Generate a secure assessment link for a single candidate.</p>

            <form class="space-y-4" onsubmit={issueManual}>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">First Name *</label>
                        <input type="text" bind:value={issueFirstName} required class="glass-input w-full text-sm rounded-lg p-2.5" placeholder="Jane" />
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Last Name *</label>
                        <input type="text" bind:value={issueLastName} required class="glass-input w-full text-sm rounded-lg p-2.5" placeholder="Smith" />
                    </div>
                </div>
                <div>
                    <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email *</label>
                    <input type="email" bind:value={issueEmail} required class="glass-input w-full text-sm rounded-lg p-2.5" placeholder="jane@example.com" />
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Mobile</label>
                        <input type="text" bind:value={issueMobile} class="glass-input w-full text-sm rounded-lg p-2.5" placeholder="04xx xxx xxx" />
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Student ID</label>
                        <input type="text" bind:value={issueStudentId} class="glass-input w-full text-sm rounded-lg p-2.5" placeholder="S12345" />
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Course Intended</label>
                        <input type="text" bind:value={issueCourse} class="glass-input w-full text-sm rounded-lg p-2.5" placeholder="BSB50820" />
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Cohort Tag</label>
                        <input type="text" bind:value={issueCohort} class="glass-input w-full text-sm rounded-lg p-2.5" placeholder="2026-T1" />
                    </div>
                </div>

                {#if issueError}
                    <p class="text-sm text-red-600 dark:text-red-400">{issueError}</p>
                {/if}

                <button
                    type="submit"
                    disabled={issuing || !issueFirstName || !issueLastName || !issueEmail}
                    class="w-full px-4 py-2.5 text-sm font-medium rounded-lg text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    {issuing ? 'Generating...' : 'Generate Assessment Link'}
                </button>
            </form>

            {#if issueSuccess}
                <div class="mt-6 rounded-lg bg-green-500/10 border border-green-500/20 p-4">
                    <h4 class="text-sm font-bold text-green-700 dark:text-green-400 mb-2">Assessment Issued!</h4>
                    <code class="block w-full bg-white/50 dark:bg-black/20 px-3 py-2 rounded border border-green-500/20 text-xs font-mono break-all select-all text-slate-700 dark:text-slate-300">{issueSuccess}</code>
                    <button
                        onclick={() => copyToClipboard(issueSuccess)}
                        class="mt-2 text-xs text-green-600 dark:text-green-400 hover:underline"
                    >
                        Copy to clipboard
                    </button>
                </div>
            {/if}
        </div>

        <!-- CSV Upload -->
        <div class="glass-panel rounded-xl p-6">
            <div class="flex items-center gap-3 mb-1">
                <div class="p-2 rounded-lg bg-blue-500/10">
                    <svg class="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                </div>
                <h3 class="text-lg font-bold text-slate-900 dark:text-white">Bulk CSV Upload</h3>
            </div>
            <p class="text-sm text-slate-500 dark:text-slate-400 mb-5">Upload a CSV file to issue multiple assessments at once.</p>

            <div class="mb-4 p-4 rounded-lg bg-slate-800/30 border border-slate-700/50">
                <p class="text-xs font-bold text-slate-400 uppercase mb-2">Required CSV columns:</p>
                <code class="text-xs text-slate-300">first_name, last_name, email</code>
                <p class="text-xs text-slate-500 mt-1">Optional: mobile, student_id, course_intended, cohort_tag</p>
            </div>

            <div class="space-y-4">
                <input
                    type="file"
                    accept=".csv"
                    onchange={(e) => { csvFile = (e.target as HTMLInputElement).files?.[0] || null; }}
                    class="glass-input w-full text-sm rounded-lg p-2"
                />

                <button
                    onclick={uploadCSV}
                    disabled={csvUploading || !csvFile}
                    class="w-full px-4 py-2.5 text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    {csvUploading ? 'Processing...' : 'Upload & Issue'}
                </button>
            </div>

            {#if csvResults}
                <div class="mt-4 rounded-lg p-4 {csvResults.error ? 'bg-red-500/10 border border-red-500/20' : 'bg-green-500/10 border border-green-500/20'}">
                    {#if csvResults.error}
                        <p class="text-sm text-red-400">{csvResults.error}</p>
                    {:else}
                        <p class="text-sm text-green-400 font-bold">
                            {csvResults.results?.length || 0} assessments issued successfully
                        </p>
                        {#if csvResults.errors?.length > 0}
                            <p class="text-sm text-amber-400 mt-1">{csvResults.errors.length} rows had errors</p>
                        {/if}
                    {/if}
                </div>
            {/if}
        </div>
    </div>

  <!-- TAB: REVIEW QUEUE -->
  {:else if activeTab === 'review'}
    <div class="glass-panel rounded-xl overflow-hidden">
        <div class="px-6 py-4 border-b border-gray-200/50 dark:border-gray-700/50">
            <h3 class="text-lg font-bold text-slate-900 dark:text-white">Writing Review Queue</h3>
            <p class="text-sm text-slate-500 dark:text-slate-400">Flagged writing submissions requiring human review.</p>
        </div>

        {#if reviewQueue.length === 0}
            <div class="p-10 text-center text-slate-500">
                <svg class="w-12 h-12 mx-auto mb-3 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <p>No items pending review.</p>
            </div>
        {:else}
            <div class="divide-y divide-gray-200/50 dark:divide-gray-700/50">
                {#each reviewQueue as item}
                    <div class="p-4 hover:bg-white/30 dark:hover:bg-slate-700/30 transition-colors">
                        <div class="flex items-center justify-between">
                            <div>
                                <div class="text-sm font-medium text-white">{item.candidate_name || 'Unknown'}</div>
                                <div class="text-xs text-slate-400">{item.task_type === 'task1' ? 'Writing Task 1' : 'Writing Task 2'} &bull; {item.word_count} words</div>
                                {#if item.flags}
                                    <div class="flex gap-1 mt-1">
                                        {#each (typeof item.flags === 'string' ? JSON.parse(item.flags) : item.flags || []) as flag}
                                            <span class="text-xs px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">{flag}</span>
                                        {/each}
                                    </div>
                                {/if}
                            </div>
                            <button
                                onclick={() => openReview(item)}
                                class="px-3 py-1.5 text-xs font-medium rounded-lg text-white bg-purple-600 hover:bg-purple-700 transition-colors"
                            >
                                Review
                            </button>
                        </div>
                    </div>
                {/each}
            </div>
        {/if}
    </div>

    <!-- Review Modal -->
    {#if selectedReview}
        <div class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onclick={() => selectedReview = null}>
            <div class="glass-panel-fixed rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto" onclick={(e) => e.stopPropagation()}>
                <h3 class="text-xl font-bold text-white mb-4">Review Writing Submission</h3>

                <div class="mb-4 p-4 rounded-lg bg-slate-800/50 border border-slate-700 max-h-[200px] overflow-y-auto custom-scrollbar">
                    <p class="text-sm text-slate-300 whitespace-pre-line">{selectedReview.text}</p>
                </div>

                <p class="text-sm text-slate-400 mb-4">Assign domain scores (0-5):</p>
                <div class="grid grid-cols-2 gap-4 mb-4">
                    {#each ['task_achievement', 'coherence_cohesion', 'lexical_resource', 'grammar_accuracy'] as domain}
                        <div>
                            <label class="block text-xs font-bold text-slate-400 uppercase mb-1">{domain.replace(/_/g, ' ')}</label>
                            <input
                                type="number"
                                min="0"
                                max="5"
                                step="0.5"
                                bind:value={reviewScores[domain]}
                                class="glass-input-fixed w-full text-sm rounded-lg p-2 text-center"
                            />
                        </div>
                    {/each}
                </div>

                <div class="mb-4">
                    <label class="block text-xs font-bold text-slate-400 uppercase mb-1">Notes</label>
                    <textarea bind:value={reviewNotes} class="glass-input-fixed w-full text-sm rounded-lg p-3 h-20" placeholder="Reviewer notes..."></textarea>
                </div>

                {#if reviewError}
                    <p class="text-sm text-red-400 mb-3">{reviewError}</p>
                {/if}

                <div class="flex gap-3">
                    <button onclick={() => selectedReview = null} class="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-white transition-colors border border-slate-700">
                        Cancel
                    </button>
                    <button
                        onclick={submitReview}
                        disabled={reviewSubmitting || Object.keys(reviewScores).length < 4}
                        class="flex-1 px-4 py-2 rounded-lg text-sm font-bold text-white bg-green-600 hover:bg-green-500 disabled:opacity-50 transition-colors"
                    >
                        {reviewSubmitting ? 'Submitting...' : 'Submit Review'}
                    </button>
                </div>
            </div>
        </div>
    {/if}

  <!-- TAB: EXPORT -->
  {:else if activeTab === 'export'}
    <div class="glass-panel rounded-xl p-6 max-w-lg">
        <h3 class="text-lg font-bold text-slate-900 dark:text-white mb-2">Export Data</h3>
        <p class="text-sm text-slate-500 dark:text-slate-400 mb-6">Download assessment data as CSV files for reporting and analysis.</p>

        <div class="space-y-3">
            <button
                onclick={exportCSV}
                class="w-full flex items-center gap-3 p-4 rounded-xl border border-slate-700/50 bg-slate-800/30 hover:bg-slate-700/50 transition-colors text-left"
            >
                <div class="p-2 rounded-lg bg-green-500/10">
                    <svg class="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                </div>
                <div>
                    <div class="text-sm font-medium text-white">Candidate Summary Export</div>
                    <div class="text-xs text-slate-400">All candidates with scores, CEFR levels, and benchmark results</div>
                </div>
            </button>
        </div>
    </div>
  {/if}

  <!-- Detail Modal -->
  {#if showDetail}
    <div class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onclick={closeDetail}>
        <div class="glass-panel-fixed rounded-2xl p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto custom-scrollbar" onclick={(e) => e.stopPropagation()}>
            {#if detailLoading}
                <div class="text-center py-10">
                    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto mb-3"></div>
                    <p class="text-slate-400">Loading details...</p>
                </div>
            {:else if detailData?.error}
                <p class="text-red-400">{detailData.error}</p>
            {:else if detailData}
                <div class="flex items-center justify-between mb-6">
                    <h3 class="text-xl font-bold text-white">Assessment Detail</h3>
                    <button onclick={closeDetail} class="text-slate-400 hover:text-white transition-colors">
                        <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <!-- Summary -->
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div class="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50 text-center">
                        <div class="text-xs text-slate-500 uppercase">Overall CEFR</div>
                        <div class="text-2xl font-bold {getCefrColor(detailData.results?.overall_cefr || '')}">{detailData.results?.overall_cefr || '-'}</div>
                    </div>
                    <div class="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50 text-center">
                        <div class="text-xs text-slate-500 uppercase">Composite Score</div>
                        <div class="text-2xl font-bold text-white">{detailData.results?.composite_score ?? '-'}</div>
                    </div>
                    <div class="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50 text-center">
                        <div class="text-xs text-slate-500 uppercase">IELTS Indicative</div>
                        <div class="text-2xl font-bold text-white">{detailData.results?.ielts_indicative || '-'}</div>
                    </div>
                    <div class="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50 text-center">
                        <div class="text-xs text-slate-500 uppercase">Status</div>
                        <div class={`text-sm font-bold mt-1 px-2 py-0.5 rounded-full inline-flex ${getStatusBadge(detailData.assessment?.status || '')}`}>
                            {(detailData.assessment?.status || '').replace(/_/g, ' ').toUpperCase()}
                        </div>
                    </div>
                </div>

                <!-- Section scores -->
                {#if detailData.results}
                    <div class="mb-6">
                        <h4 class="text-sm font-bold text-slate-400 uppercase mb-3">Section Scores</h4>
                        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div class="p-3 rounded-lg bg-slate-800/30 border border-slate-700/40">
                                <div class="text-xs text-purple-400">Grammar</div>
                                <div class="text-lg font-bold text-white">{detailData.results.grammar_score}/20</div>
                            </div>
                            <div class="p-3 rounded-lg bg-slate-800/30 border border-slate-700/40">
                                <div class="text-xs text-blue-400">Reading</div>
                                <div class="text-lg font-bold text-white">{detailData.results.reading_score}/30</div>
                            </div>
                            <div class="p-3 rounded-lg bg-slate-800/30 border border-slate-700/40">
                                <div class="text-xs text-emerald-400">Writing T1</div>
                                <div class="text-lg font-bold text-white">{detailData.results.writing_task1_score}/20</div>
                            </div>
                            <div class="p-3 rounded-lg bg-slate-800/30 border border-slate-700/40">
                                <div class="text-xs text-amber-400">Writing T2</div>
                                <div class="text-lg font-bold text-white">{detailData.results.writing_task2_score}/30</div>
                            </div>
                        </div>
                    </div>
                {/if}

                <!-- Candidate info -->
                <div class="mb-6">
                    <h4 class="text-sm font-bold text-slate-400 uppercase mb-3">Candidate Information</h4>
                    <div class="grid grid-cols-2 gap-2 text-sm">
                        <div><span class="text-slate-500">Name:</span> <span class="text-slate-200 ml-1">{detailData.assessment?.first_name} {detailData.assessment?.last_name}</span></div>
                        <div><span class="text-slate-500">Email:</span> <span class="text-slate-200 ml-1">{detailData.assessment?.email}</span></div>
                        <div><span class="text-slate-500">Student ID:</span> <span class="text-slate-200 ml-1">{detailData.assessment?.student_id || '-'}</span></div>
                        <div><span class="text-slate-500">Course:</span> <span class="text-slate-200 ml-1">{detailData.assessment?.course_intended || '-'}</span></div>
                    </div>
                </div>
            {/if}
        </div>
    </div>
  {/if}
</div>

<style>
    .custom-scrollbar::-webkit-scrollbar { width: 6px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: rgba(30, 41, 59, 0.5); }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(71, 85, 105, 0.8); border-radius: 4px; }
</style>
