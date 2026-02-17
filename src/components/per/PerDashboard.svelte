<script lang="ts">
  import { onMount } from 'svelte';

  let submissions = $state<any[]>([]);
  let loading = $state(true);
  let error = $state('');
  let statusFilter = $state('');
  let searchQuery = $state('');
  let expandedRow = $state<string | null>(null);

  // Decision modal
  let showDecisionModal = $state(false);
  let selectedSubmission = $state<any>(null);
  let decisionLoading = $state(false);
  let decisionChoice = $state('');
  let decisionNotes = $state('');
  let decisionError = $state('');
  let decisionSuccess = $state('');

  // Detail view
  let showDetailModal = $state(false);
  let detailData = $state<any>(null);
  let detailLoading = $state(false);

  // Stats
  let totalPending = $derived(submissions.filter(s => s.status === 'submitted').length);
  let totalDecided = $derived(submissions.filter(s => s.status === 'decided').length);
  let totalFlagged = $derived(submissions.filter(s => s.overall_llnd_self_risk).length);

  let filteredSubmissions = $derived.by(() => {
    let result = submissions;
    if (statusFilter) {
      result = result.filter(s => s.status === statusFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(s =>
        (s.student_name?.toLowerCase().includes(q)) ||
        (s.student_id?.toLowerCase().includes(q)) ||
        (s.application_id?.toLowerCase().includes(q)) ||
        (s.submission_id?.toLowerCase().includes(q))
      );
    }
    return result;
  });

  onMount(async () => {
    await loadSubmissions();
  });

  async function loadSubmissions() {
    loading = true;
    error = '';
    try {
      const token = localStorage.getItem('llnd_token');
      const url = statusFilter ? `/api/per/list?status=${statusFilter}` : '/api/per/list';
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load PER submissions');
      const data: any = await res.json();
      submissions = data.submissions || [];
    } catch (e: any) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  async function viewDetail(submissionId: string) {
    detailLoading = true;
    showDetailModal = true;
    detailData = null;
    try {
      const token = localStorage.getItem('llnd_token');
      const res = await fetch(`/api/per/${submissionId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load submission details');
      detailData = await res.json();
    } catch (e: any) {
      error = e.message;
      showDetailModal = false;
    } finally {
      detailLoading = false;
    }
  }

  function openDecisionModal(submission: any) {
    selectedSubmission = submission;
    decisionChoice = '';
    decisionNotes = '';
    decisionError = '';
    decisionSuccess = '';
    showDecisionModal = true;
  }

  async function submitDecision() {
    if (!decisionChoice) {
      decisionError = 'Please select a decision.';
      return;
    }
    decisionLoading = true;
    decisionError = '';
    try {
      const token = localStorage.getItem('llnd_token');
      const res = await fetch(`/api/per/${selectedSubmission.submission_id}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ decision: decisionChoice, notes: decisionNotes })
      });
      const result: any = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to record decision');
      decisionSuccess = `Decision recorded: ${decisionChoice.replace(/_/g, ' ')}`;
      showDecisionModal = false;
      await loadSubmissions();
    } catch (e: any) {
      decisionError = e.message;
    } finally {
      decisionLoading = false;
    }
  }

  function getStatusBadge(status: string) {
    switch(status) {
      case 'submitted': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800';
      case 'decided': return 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300 border border-green-200 dark:border-green-800';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-300 border border-gray-200 dark:border-gray-600';
    }
  }

  function getRiskBadge(hasRisk: boolean) {
    if (hasRisk) return 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300 border border-red-200 dark:border-red-800';
    return 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300 border border-green-200 dark:border-green-800';
  }

  function getConfidenceColor(level: string) {
    switch(level) {
      case 'High': return 'text-green-600 dark:text-green-400';
      case 'Moderate': return 'text-yellow-600 dark:text-yellow-400';
      case 'Low': return 'text-red-600 dark:text-red-400';
      default: return 'text-slate-500';
    }
  }

  function formatDate(value: string | number | null) {
    if (!value) return '-';
    const d = new Date(value);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString();
  }

  function formatDateTime(value: string | number | null) {
    if (!value) return '-';
    const d = new Date(value);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleString();
  }

  const decisionOptions = [
    { value: 'suitable_to_proceed', label: 'Suitable to Proceed', color: 'text-green-600 dark:text-green-400' },
    { value: 'proceed_with_interview', label: 'Proceed with Interview', color: 'text-blue-600 dark:text-blue-400' },
    { value: 'further_evidence_required', label: 'Further Evidence Required', color: 'text-yellow-600 dark:text-yellow-400' },
    { value: 'support_plan_required', label: 'Support Plan Required', color: 'text-red-600 dark:text-red-400' }
  ];
</script>

<div class="space-y-8">
  {#if error}
    <div class="rounded-lg bg-red-500/10 border border-red-500/20 p-4 text-red-600 dark:text-red-400">
      <p class="text-sm font-medium">Error: {error}</p>
    </div>
  {/if}

  {#if decisionSuccess}
    <div class="rounded-lg bg-green-500/10 border border-green-500/20 p-4 text-green-700 dark:text-green-400">
      <p class="text-sm font-medium">{decisionSuccess}</p>
    </div>
  {/if}

  <!-- Stats Cards -->
  <div class="grid grid-cols-1 gap-5 sm:grid-cols-3">
    <div class="glass-panel rounded-xl overflow-hidden p-6 relative group">
      <dt class="text-sm font-medium text-slate-500 dark:text-slate-400 truncate">Pending Review</dt>
      <dd class="mt-2 text-3xl font-bold text-slate-900 dark:text-white">{loading ? '-' : totalPending}</dd>
      <div class="absolute right-4 top-4 opacity-80 group-hover:opacity-100 transition-opacity">
        <svg class="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="#eab308" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
      </div>
    </div>
    <div class="glass-panel rounded-xl overflow-hidden p-6 relative group">
      <dt class="text-sm font-medium text-slate-500 dark:text-slate-400 truncate">Decisions Made</dt>
      <dd class="mt-2 text-3xl font-bold text-slate-900 dark:text-white">{loading ? '-' : totalDecided}</dd>
      <div class="absolute right-4 top-4 opacity-80 group-hover:opacity-100 transition-opacity">
        <svg class="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="#10b981" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
      </div>
    </div>
    <div class="glass-panel rounded-xl overflow-hidden p-6 relative group">
      <dt class="text-sm font-medium text-slate-500 dark:text-slate-400 truncate">Risk Flagged</dt>
      <dd class="mt-2 text-3xl font-bold text-slate-900 dark:text-white">{loading ? '-' : totalFlagged}</dd>
      <div class="absolute right-4 top-4 opacity-80 group-hover:opacity-100 transition-opacity">
        <svg class="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="#ef4444" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
      </div>
    </div>
  </div>

  <!-- Submissions Table -->
  <div class="glass-panel rounded-xl overflow-hidden">
    <div class="px-6 py-5 border-b border-gray-200/50 dark:border-gray-700/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <h3 class="text-lg leading-6 font-bold text-slate-900 dark:text-white">PER Submissions</h3>
      <div class="flex items-center gap-3">
        <select bind:value={statusFilter} onchange={loadSubmissions} class="glass-input px-3 py-2 text-sm rounded-lg">
          <option value="">All Statuses</option>
          <option value="submitted">Pending</option>
          <option value="decided">Decided</option>
        </select>
        <div class="relative">
          <input
            type="text"
            bind:value={searchQuery}
            placeholder="Search..."
            class="glass-input w-full sm:w-48 pl-10 pr-4 py-2 text-sm rounded-lg"
          />
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>
    </div>

    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200/50 dark:divide-gray-700/50">
        <thead class="bg-gray-50/50 dark:bg-slate-800/50">
          <tr>
            <th class="px-6 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Student</th>
            <th class="px-6 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Submitted</th>
            <th class="px-6 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Section A</th>
            <th class="px-6 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">LLND Risk</th>
            <th class="px-6 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
            <th class="px-6 py-3 text-right text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200/50 dark:divide-gray-700/50">
          {#each filteredSubmissions as sub}
            <tr class="hover:bg-white/40 dark:hover:bg-slate-700/40 transition-colors">
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm font-medium text-slate-900 dark:text-white">{sub.student_name}</div>
                {#if sub.student_id}
                  <div class="text-xs text-slate-500 dark:text-slate-400">{sub.student_id}</div>
                {/if}
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm text-slate-500 dark:text-slate-400">{formatDate(sub.submitted_at)}</div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                {#if sub.interview_recommended}
                  <span class="px-2 py-0.5 text-xs font-bold rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                    Interview
                  </span>
                {:else}
                  <span class="text-xs text-slate-500 dark:text-slate-400">OK</span>
                {/if}
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span class={`px-2 py-0.5 text-xs font-bold rounded-full ${getRiskBadge(!!sub.overall_llnd_self_risk)}`}>
                  {sub.overall_llnd_self_risk ? 'Flagged' : 'Clear'}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span class={`px-2.5 py-0.5 inline-flex text-xs leading-5 font-bold rounded-full ${getStatusBadge(sub.status)}`}>
                  {sub.status === 'submitted' ? 'PENDING' : sub.status.toUpperCase()}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <div class="flex items-center justify-end gap-2">
                  <button
                    onclick={() => viewDetail(sub.submission_id)}
                    class="px-3 py-1.5 text-xs font-medium rounded-lg text-teal-700 dark:text-teal-400 bg-teal-600/10 hover:bg-teal-600/20 border border-teal-500/20 transition-colors"
                  >
                    View
                  </button>
                  {#if sub.status === 'submitted'}
                    <button
                      onclick={() => openDecisionModal(sub)}
                      class="px-3 py-1.5 text-xs font-medium rounded-lg text-white bg-teal-600 hover:bg-teal-500 transition-colors"
                    >
                      Decide
                    </button>
                  {/if}
                </div>
              </td>
            </tr>
          {:else}
            <tr>
              <td colspan="6" class="px-6 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                {loading ? 'Loading...' : 'No PER submissions found.'}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
</div>

<!-- Detail Modal -->
{#if showDetailModal}
  <div class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto" onclick={(e) => { if (e.target === e.currentTarget) showDetailModal = false; }}>
    <div class="w-full max-w-3xl glass-panel rounded-2xl shadow-2xl my-8">
      <div class="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
        <h3 class="text-lg font-bold text-slate-900 dark:text-white">PER Submission Detail</h3>
        <button onclick={() => showDetailModal = false} class="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
          <svg class="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      <div class="p-6 max-h-[70vh] overflow-y-auto">
        {#if detailLoading}
          <div class="text-center py-8 text-slate-500 dark:text-slate-400">Loading...</div>
        {:else if detailData}
          <!-- Student Info -->
          <div class="mb-6">
            <h4 class="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Student Information</h4>
            <div class="grid grid-cols-2 gap-2 text-sm">
              <div><span class="text-slate-500">Name:</span> <span class="text-slate-900 dark:text-white font-medium">{detailData.submission.student_name}</span></div>
              <div><span class="text-slate-500">ID:</span> <span class="text-slate-900 dark:text-white font-medium">{detailData.submission.student_id || '-'}</span></div>
              <div><span class="text-slate-500">Email:</span> <span class="text-slate-900 dark:text-white font-medium">{detailData.submission.student_email || '-'}</span></div>
              <div><span class="text-slate-500">International:</span> <span class="text-slate-900 dark:text-white font-medium">{detailData.submission.is_international ? 'Yes' : 'No'}</span></div>
              <div><span class="text-slate-500">Submitted:</span> <span class="text-slate-900 dark:text-white font-medium">{formatDateTime(detailData.submission.submitted_at)}</span></div>
              <div><span class="text-slate-500">Status:</span> <span class={`px-2 py-0.5 text-xs font-bold rounded-full ${getStatusBadge(detailData.submission.status)}`}>{detailData.submission.status.toUpperCase()}</span></div>
            </div>
          </div>

          <!-- Section A Flags -->
          {#if detailData.section_a_flags}
            <div class="mb-6">
              <h4 class="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Section A: Course Suitability Flags</h4>
              <div class="grid grid-cols-2 gap-3">
                <div class="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/30">
                  <div class="text-xs text-slate-500 dark:text-slate-400">Career Clarity</div>
                  <div class="text-sm font-bold text-slate-900 dark:text-white">{detailData.section_a_flags.career_clarity_score}</div>
                </div>
                <div class="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/30">
                  <div class="text-xs text-slate-500 dark:text-slate-400">Course Alignment</div>
                  <div class="text-sm font-bold text-slate-900 dark:text-white">{detailData.section_a_flags.course_alignment_score}</div>
                </div>
                <div class="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/30">
                  <div class="text-xs text-slate-500 dark:text-slate-400">Academic Progression</div>
                  <div class="text-sm font-bold text-slate-900 dark:text-white">{detailData.section_a_flags.academic_progression_score}</div>
                </div>
                <div class="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/30">
                  <div class="text-xs text-slate-500 dark:text-slate-400">Study Readiness</div>
                  <div class="text-sm font-bold text-slate-900 dark:text-white">{detailData.section_a_flags.study_readiness_status}</div>
                </div>
                <div class="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/30">
                  <div class="text-xs text-slate-500 dark:text-slate-400">English Preparedness</div>
                  <div class="text-sm font-bold text-slate-900 dark:text-white">{detailData.section_a_flags.english_preparedness_status}</div>
                </div>
                {#if detailData.section_a_flags.financial_preparedness_status}
                  <div class="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/30">
                    <div class="text-xs text-slate-500 dark:text-slate-400">Financial Preparedness</div>
                    <div class="text-sm font-bold text-slate-900 dark:text-white">{detailData.section_a_flags.financial_preparedness_status}</div>
                  </div>
                {/if}
              </div>
              {#if detailData.section_a_flags.interview_recommended}
                <div class="mt-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm text-amber-700 dark:text-amber-400 font-medium">
                  Interview Recommended
                </div>
              {/if}
            </div>
          {/if}

          <!-- Section B Domain Scores -->
          {#if detailData.domain_scores?.length > 0}
            <div class="mb-6">
              <h4 class="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Section B: LLND Self-Assessment Domains</h4>
              <div class="space-y-2">
                {#each detailData.domain_scores as ds}
                  <div class="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/30">
                    <div>
                      <div class="text-sm font-medium text-slate-900 dark:text-white capitalize">{ds.domain}</div>
                      <div class="text-xs text-slate-500 dark:text-slate-400">{ds.may_need_support_count} MNS / {ds.total_items} items</div>
                    </div>
                    <div class="text-right">
                      <div class={`text-sm font-bold ${getConfidenceColor(ds.confidence_level)}`}>{ds.confidence_level}</div>
                      <div class="text-xs text-slate-500 dark:text-slate-400">{ds.domain_percentage}%</div>
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          {/if}

          <!-- Risk Flags -->
          {#if detailData.risk_flags}
            <div class="mb-6">
              <h4 class="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Risk Flags</h4>
              <div class="grid grid-cols-2 gap-2 text-sm">
                <div class="flex items-center gap-2">
                  <div class={`w-2 h-2 rounded-full ${detailData.risk_flags.overall_llnd_self_risk ? 'bg-red-500' : 'bg-green-500'}`}></div>
                  <span class="text-slate-600 dark:text-slate-400">Overall LLND Risk: <span class="font-medium text-slate-900 dark:text-white">{detailData.risk_flags.overall_llnd_self_risk ? 'Yes' : 'No'}</span></span>
                </div>
                <div class="flex items-center gap-2">
                  <div class={`w-2 h-2 rounded-full ${detailData.risk_flags.reading_support_flag ? 'bg-red-500' : 'bg-green-500'}`}></div>
                  <span class="text-slate-600 dark:text-slate-400">Reading: <span class="font-medium">{detailData.risk_flags.reading_support_flag ? 'Flagged' : 'OK'}</span></span>
                </div>
                <div class="flex items-center gap-2">
                  <div class={`w-2 h-2 rounded-full ${detailData.risk_flags.writing_support_flag ? 'bg-red-500' : 'bg-green-500'}`}></div>
                  <span class="text-slate-600 dark:text-slate-400">Writing: <span class="font-medium">{detailData.risk_flags.writing_support_flag ? 'Flagged' : 'OK'}</span></span>
                </div>
                <div class="flex items-center gap-2">
                  <div class={`w-2 h-2 rounded-full ${detailData.risk_flags.numeracy_support_flag ? 'bg-red-500' : 'bg-green-500'}`}></div>
                  <span class="text-slate-600 dark:text-slate-400">Numeracy: <span class="font-medium">{detailData.risk_flags.numeracy_support_flag ? 'Flagged' : 'OK'}</span></span>
                </div>
                <div class="flex items-center gap-2">
                  <div class={`w-2 h-2 rounded-full ${detailData.risk_flags.learning_support_flag ? 'bg-red-500' : 'bg-green-500'}`}></div>
                  <span class="text-slate-600 dark:text-slate-400">Learning: <span class="font-medium">{detailData.risk_flags.learning_support_flag ? 'Flagged' : 'OK'}</span></span>
                </div>
                <div class="flex items-center gap-2">
                  <div class={`w-2 h-2 rounded-full ${detailData.risk_flags.digital_support_flag ? 'bg-red-500' : 'bg-green-500'}`}></div>
                  <span class="text-slate-600 dark:text-slate-400">Digital: <span class="font-medium">{detailData.risk_flags.digital_support_flag ? 'Flagged' : 'OK'}</span></span>
                </div>
              </div>
              {#if detailData.risk_flags.high_digital_risk_flag}
                <div class="mt-2 p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-700 dark:text-red-400 font-medium">
                  High Digital Risk Flag Active
                </div>
              {/if}
            </div>
          {/if}

          <!-- Admin Decision -->
          {#if detailData.submission.admin_decision}
            <div class="mb-6 p-4 rounded-lg bg-teal-600/10 border border-teal-500/20">
              <h4 class="text-sm font-bold text-teal-700 dark:text-teal-400 mb-2">Admin Decision</h4>
              <div class="text-sm text-slate-700 dark:text-slate-300">
                <div><span class="text-slate-500">Decision:</span> <span class="font-bold">{detailData.submission.admin_decision.replace(/_/g, ' ')}</span></div>
                {#if detailData.submission.admin_notes}
                  <div class="mt-1"><span class="text-slate-500">Notes:</span> {detailData.submission.admin_notes}</div>
                {/if}
                <div class="mt-1"><span class="text-slate-500">Reviewed by:</span> {detailData.submission.reviewed_by}</div>
                <div><span class="text-slate-500">Reviewed at:</span> {formatDateTime(detailData.submission.reviewed_at)}</div>
              </div>
            </div>
          {/if}

          <!-- Narrative Summary (from report) -->
          {#if detailData.report?.narrative}
            <div class="mb-6">
              <h4 class="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Auto-Generated Narrative</h4>
              <div class="p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/30 text-sm text-slate-700 dark:text-slate-300 whitespace-pre-line">
                {detailData.report.narrative}
              </div>
            </div>
          {/if}

          <!-- Audit History -->
          {#if detailData.audit_history?.length > 0}
            <div>
              <h4 class="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Audit Trail</h4>
              <div class="space-y-2">
                {#each detailData.audit_history as audit}
                  <div class="flex items-start gap-3 text-xs text-slate-500 dark:text-slate-400">
                    <div class="w-2 h-2 rounded-full bg-slate-400 mt-1 shrink-0"></div>
                    <div>
                      <span class="font-medium text-slate-700 dark:text-slate-300">{audit.action}</span> by {audit.actor_id} ({audit.actor_type})
                      <span class="text-slate-400"> - {formatDateTime(audit.created_at)}</span>
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          {/if}
        {/if}
      </div>

      <div class="p-6 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
        {#if detailData?.submission?.status === 'submitted'}
          <button
            onclick={() => { showDetailModal = false; openDecisionModal(detailData.submission); }}
            class="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-bold rounded-lg transition-colors"
          >
            Make Decision
          </button>
        {/if}
        <button onclick={() => showDetailModal = false} class="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-lg hover:bg-white/50 dark:hover:bg-slate-700/50 transition-colors">
          Close
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Decision Modal -->
{#if showDecisionModal}
  <div class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onclick={(e) => { if (e.target === e.currentTarget) showDecisionModal = false; }}>
    <div class="w-full max-w-lg glass-panel rounded-2xl shadow-2xl">
      <div class="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
        <h3 class="text-lg font-bold text-slate-900 dark:text-white">Record Decision</h3>
        <button onclick={() => showDecisionModal = false} class="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
          <svg class="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      <div class="p-6">
        <p class="text-sm text-slate-600 dark:text-slate-400 mb-4">
          Student: <span class="font-bold text-slate-900 dark:text-white">{selectedSubmission?.student_name}</span>
        </p>

        <div class="space-y-2 mb-4">
          {#each decisionOptions as option}
            <label class="flex items-center gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/30 cursor-pointer hover:bg-white/80 dark:hover:bg-slate-800/50 transition-colors">
              <input type="radio" name="decision" value={option.value} bind:group={decisionChoice} class="w-4 h-4" />
              <span class={`text-sm font-medium ${option.color}`}>{option.label}</span>
            </label>
          {/each}
        </div>

        <div>
          <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Notes (optional)</label>
          <textarea bind:value={decisionNotes} rows="3" class="glass-input w-full px-4 py-2.5 rounded-lg text-sm resize-y" placeholder="Additional notes..."></textarea>
        </div>

        {#if decisionError}
          <p class="mt-3 text-sm text-red-600 dark:text-red-400">{decisionError}</p>
        {/if}
      </div>

      <div class="p-6 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
        <button onclick={() => showDecisionModal = false} class="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-lg hover:bg-white/50 dark:hover:bg-slate-700/50 transition-colors">
          Cancel
        </button>
        <button onclick={submitDecision} disabled={decisionLoading || !decisionChoice} class="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          {decisionLoading ? 'Saving...' : 'Confirm Decision'}
        </button>
      </div>
    </div>
  </div>
{/if}
