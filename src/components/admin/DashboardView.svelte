<script lang="ts">
  import { onMount } from 'svelte';
  import BulkUpload from './BulkUpload.svelte';

  let rawSeats = $state<any[]>([]);
  let assessments = $state<any[]>([]);
  let loading = $state(true);
  let error = $state('');

  let selectedProduct = $state('');
  let studentName = $state('');
  let studentId = $state('');
  let issuing = $state(false);
  let successLink = $state('');
  let formError = $state('');

  // Search and expanded rows
  let searchQuery = $state('');
  let expandedRows = $state<Set<string>>(new Set());

  // Custom dropdown state
  let dropdownOpen = $state(false);
  let dropdownRef = $state<HTMLDivElement | null>(null);

  // Get selected product display name
  let selectedProductName = $derived(() => {
    const seat = availableSeats.find(s => s.product_id === selectedProduct);
    if (seat) return `${seat.product_name || seat.product_id} (${seat.count} left)`;
    return 'Select assessment type...';
  });

  let availableSeats = $derived(rawSeats.filter(s => s.status === 'available'));
  let totalSeatsRemaining = $derived(availableSeats.reduce((acc, s) => acc + s.count, 0));
  let totalIssued = $derived(assessments.length);
  let totalCompleted = $derived(assessments.filter(a => a.status === 'submitted').length);

  // Filtered assessments based on search
  let filteredAssessments = $derived(
    assessments.filter(a => {
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      return (
        (a.student_name?.toLowerCase().includes(query)) ||
        (a.student_id?.toLowerCase().includes(query)) ||
        (a.product_name?.toLowerCase().includes(query)) ||
        (a.status?.toLowerCase().includes(query)) ||
        (a.attempt_id?.toLowerCase().includes(query))
      );
    })
  );

  onMount(async () => {
      await loadDashboardData();

      // Close dropdown when clicking outside
      const handleClickOutside = (e: MouseEvent) => {
          if (dropdownRef && !dropdownRef.contains(e.target as Node)) {
              dropdownOpen = false;
          }
      };
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
  });

  function selectProduct(productId: string) {
      selectedProduct = productId;
      dropdownOpen = false;
  }

  async function loadDashboardData() {
      loading = true;
      try {
          const token = localStorage.getItem('llnd_token');
          const headers = { 'Authorization': `Bearer ${token}` };

          const [seatsRes, assessmentsRes] = await Promise.all([
              fetch('/api/seats', { headers }),
              fetch('/api/assessments/list', { headers })
          ]);

          if (!seatsRes.ok) throw new Error('Failed to load seats');
          if (!assessmentsRes.ok) throw new Error('Failed to load assessment history');

          rawSeats = await seatsRes.json();
          assessments = await assessmentsRes.json();

          if(availableSeats.length > 0 && !selectedProduct) {
              selectedProduct = availableSeats[0].product_id;
          }

      } catch (e: any) {
          error = e.message;
      } finally {
          loading = false;
      }
  }

  async function issueAssessment(e: Event) {
      e.preventDefault();
      issuing = true;
      successLink = '';
      formError = '';

      try {
          const token = localStorage.getItem('llnd_token');
          const res = await fetch('/api/seats', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ product_id: selectedProduct, student_name: studentName, student_id: studentId })
          });

          const data: any = await res.json();
          if (!res.ok) throw new Error(data.error || 'Failed to issue');

          const origin = window.location.origin;
          successLink = `${origin}/assess?token=${data.token}`;
          await loadDashboardData();
          studentName = '';
          studentId = '';

      } catch (e: any) {
          formError = e.message;
      } finally {
          issuing = false;
      }
  }

  function toggleRow(attemptId: string) {
      const newSet = new Set(expandedRows);
      if (newSet.has(attemptId)) {
          newSet.delete(attemptId);
      } else {
          newSet.add(attemptId);
      }
      expandedRows = newSet;
  }

  function getStatusBadge(status: string) {
      switch(status) {
          case 'submitted': return 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300 border border-green-200 dark:border-green-800';
          case 'in_progress': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800';
          case 'issued': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800';
          default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-300 border border-gray-200 dark:border-gray-600';
      }
  }

  function parseDate(value: string | number | null): Date | null {
      if (!value) return null;
      if (typeof value === 'string' && /^\d+$/.test(value)) {
          return new Date(parseInt(value) * 1000);
      }
      if (typeof value === 'number') {
          return new Date(value < 1e12 ? value * 1000 : value);
      }
      return new Date(value);
  }

  function formatDate(value: string | number | null) {
      if (!value) return 'Not started';
      const d = parseDate(value);
      if (!d || isNaN(d.getTime())) return 'Not started';
      return d.toLocaleDateString();
  }

  function formatDateTime(value: string | number | null) {
      if (!value) return '-';
      const d = parseDate(value);
      if (!d || isNaN(d.getTime())) return '-';
      return d.toLocaleString();
  }

  function getAssessmentLink(assessment: any) {
      if (assessment.token_hash) {
          return `${window.location.origin}/assess?token=${assessment.token_hash}`;
      }
      return null;
  }

  function copyToClipboard(text: string) {
      navigator.clipboard.writeText(text);
  }
</script>

<div class="space-y-8">
  {#if error}
      <div class="rounded-lg bg-red-500/10 border border-red-500/20 p-4 text-red-600 dark:text-red-400">
          <p class="text-sm font-medium">Error: {error}</p>
      </div>
  {/if}

  <div class="grid grid-cols-1 gap-5 sm:grid-cols-3">
      <div class="glass-panel rounded-xl overflow-hidden p-6 relative group">
          <dt class="text-sm font-medium text-slate-500 dark:text-slate-400 truncate">Total Seats Available</dt>
          <dd class="mt-2 text-3xl font-bold text-slate-900 dark:text-white">{loading ? '-' : totalSeatsRemaining}</dd>
          <div class="absolute right-4 top-4 opacity-80 group-hover:opacity-100 transition-opacity">
              <svg class="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="#3b82f6" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
          </div>
      </div>

      <div class="glass-panel rounded-xl overflow-hidden p-6 relative group">
          <dt class="text-sm font-medium text-slate-500 dark:text-slate-400 truncate">Assessments Issued</dt>
          <dd class="mt-2 text-3xl font-bold text-slate-900 dark:text-white">{loading ? '-' : totalIssued}</dd>
          <div class="absolute right-4 top-4 opacity-80 group-hover:opacity-100 transition-opacity">
               <svg class="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="#a855f7" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"></path></svg>
          </div>
      </div>

      <div class="glass-panel rounded-xl overflow-hidden p-6 relative group">
          <dt class="text-sm font-medium text-slate-500 dark:text-slate-400 truncate">Completed</dt>
          <dd class="mt-2 text-3xl font-bold text-slate-900 dark:text-white">{loading ? '-' : totalCompleted}</dd>
          <div class="absolute right-4 top-4 opacity-80 group-hover:opacity-100 transition-opacity">
              <svg class="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="#10b981" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          </div>
      </div>
  </div>

  <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div class="lg:col-span-1">
          <div class="glass-panel rounded-xl p-6">
              <h3 class="text-lg leading-6 font-bold text-slate-900 dark:text-white">Issue New Assessment</h3>
              <div class="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  <p>Reserves 1 seat immediately.</p>
              </div>

              <form class="mt-6 space-y-4" onsubmit={issueAssessment}>
                  <div>
                      <label for="product" class="block text-sm font-medium text-slate-700 dark:text-slate-300">Assessment Type</label>
                      <div class="relative mt-1" bind:this={dropdownRef}>
                          <button
                              type="button"
                              onclick={() => dropdownOpen = !dropdownOpen}
                              class="glass-input w-full pl-3 pr-10 py-2.5 text-left text-sm rounded-lg flex items-center justify-between cursor-pointer hover:bg-white/60 dark:hover:bg-slate-700/60 transition-colors"
                          >
                              <span class={availableSeats.length === 0 ? 'text-slate-400' : 'text-slate-900 dark:text-white'}>
                                  {#if loading}
                                      Loading...
                                  {:else if availableSeats.length === 0}
                                      No seats available
                                  {:else}
                                      {selectedProductName()}
                                  {/if}
                              </span>
                              <svg class={`w-5 h-5 text-slate-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                              </svg>
                          </button>

                          {#if dropdownOpen && availableSeats.length > 0}
                              <div class="absolute z-50 mt-1 w-full rounded-lg bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shadow-xl overflow-hidden">
                                  <ul class="max-h-60 overflow-auto py-1">
                                      {#each availableSeats as seat}
                                          <li>
                                              <button
                                                  type="button"
                                                  onclick={() => selectProduct(seat.product_id)}
                                                  class={`w-full px-4 py-3 text-left text-sm transition-colors flex items-center justify-between gap-3 ${
                                                      selectedProduct === seat.product_id
                                                          ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                                                          : 'text-slate-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700/50'
                                                  }`}
                                              >
                                                  <span class="font-medium">{seat.product_name || seat.product_id}</span>
                                                  <span class={`text-xs px-2 py-0.5 rounded-full ${
                                                      selectedProduct === seat.product_id
                                                          ? 'bg-blue-100 dark:bg-blue-800/50 text-blue-600 dark:text-blue-300'
                                                          : 'bg-gray-100 dark:bg-slate-600/50 text-gray-600 dark:text-slate-300'
                                                  }`}>
                                                      {seat.count} left
                                                  </span>
                                              </button>
                                          </li>
                                      {/each}
                                  </ul>
                              </div>
                          {/if}
                      </div>
                  </div>

                  <div>
                      <label for="name" class="block text-sm font-medium text-slate-700 dark:text-slate-300">Student Name</label>
                      <input type="text" id="name" bind:value={studentName} class="glass-input mt-1 block w-full sm:text-sm rounded-lg p-2.5" placeholder="John Doe">
                  </div>

                  <div>
                      <label for="sid" class="block text-sm font-medium text-slate-700 dark:text-slate-300">Student ID (Optional)</label>
                      <input type="text" id="sid" bind:value={studentId} class="glass-input mt-1 block w-full sm:text-sm rounded-lg p-2.5" placeholder="S123456">
                  </div>

                  {#if formError}
                       <p class="text-sm text-red-600 dark:text-red-400">{formError}</p>
                  {/if}

                  <div class="pt-2">
                      <button
                          type="submit"
                          disabled={issuing || availableSeats.length === 0}
                          class="w-full inline-flex justify-center items-center px-4 py-2.5 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                          {issuing ? 'Reserving Seat...' : 'Generate Assessment Link'}
                      </button>
                  </div>
              </form>

              {#if successLink}
                  <div class="mt-6 rounded-lg bg-green-500/10 border border-green-500/20 p-4">
                      <h3 class="text-sm font-bold text-green-700 dark:text-green-400">Assessment Generated!</h3>
                      <div class="mt-2">
                          <code class="block w-full bg-white/50 dark:bg-black/20 px-3 py-2 rounded border border-green-500/20 text-xs font-mono break-all select-all text-slate-700 dark:text-slate-300">{successLink}</code>
                      </div>
                  </div>
              {/if}

              <!-- Divider -->
              <div class="relative my-6">
                  <div class="absolute inset-0 flex items-center">
                      <div class="w-full border-t border-slate-200 dark:border-slate-700"></div>
                  </div>
                  <div class="relative flex justify-center text-xs">
                      <span class="px-2 bg-white/80 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400">or upload multiple</span>
                  </div>
              </div>

              <!-- Bulk Upload -->
              <BulkUpload {availableSeats} oncomplete={loadDashboardData} />
          </div>
      </div>

      <div class="lg:col-span-2">
          <div class="glass-panel rounded-xl overflow-hidden flex flex-col h-full">
              <div class="px-6 py-5 border-b border-gray-200/50 dark:border-gray-700/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <h3 class="text-lg leading-6 font-bold text-slate-900 dark:text-white">Assessment History</h3>
                  <div class="relative">
                      <input
                          type="text"
                          bind:value={searchQuery}
                          placeholder="Search by name, ID, status..."
                          class="glass-input w-full sm:w-64 pl-10 pr-4 py-2 text-sm rounded-lg"
                      />
                      <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                  </div>
              </div>

              <div class="overflow-x-auto flex-1">
                  <table class="min-w-full divide-y divide-gray-200/50 dark:divide-gray-700/50 table-fixed">
                      <thead class="bg-gray-50/50 dark:bg-slate-800/50">
                          <tr>
                              <th class="px-6 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-1/5">Student</th>
                              <th class="px-6 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-2/5">Type</th>
                              <th class="px-6 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-1/6">Date</th>
                              <th class="px-6 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-1/6">Status</th>
                              <th class="relative px-6 py-3 w-12"><span class="sr-only">Actions</span></th>
                          </tr>
                      </thead>
                      <tbody class="divide-y divide-gray-200/50 dark:divide-gray-700/50">
                          {#each filteredAssessments as assessment}
                              <tr
                                  class="hover:bg-white/40 dark:hover:bg-slate-700/40 transition-colors cursor-pointer"
                                  onclick={() => toggleRow(assessment.attempt_id)}
                              >
                                  <td class="px-6 py-4 whitespace-nowrap">
                                      <div class="text-sm font-medium text-slate-900 dark:text-white">{assessment.student_name || 'Unassigned'}</div>
                                      {#if assessment.student_id}
                                          <div class="text-xs text-slate-500 dark:text-slate-400">{assessment.student_id}</div>
                                      {/if}
                                  </td>
                                  <td class="px-6 py-4">
                                      <div class="text-sm text-slate-600 dark:text-slate-300 max-w-xs">{assessment.product_name || 'Assessment'}</div>
                                  </td>
                                  <td class="px-6 py-4 whitespace-nowrap">
                                      <div class="text-sm text-slate-500 dark:text-slate-400">
                                          {formatDate(assessment.started_at || assessment.submitted_at || assessment.issued_at)}
                                      </div>
                                  </td>
                                  <td class="px-6 py-4 whitespace-nowrap">
                                      <span class={`px-2.5 py-0.5 inline-flex text-xs leading-5 font-bold rounded-full ${getStatusBadge(assessment.status)}`}>
                                          {assessment.status.toUpperCase()}
                                      </span>
                                  </td>
                                  <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                      <button class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                                          <svg class={`w-5 h-5 transition-transform ${expandedRows.has(assessment.attempt_id) ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                                          </svg>
                                      </button>
                                  </td>
                              </tr>

                              {#if expandedRows.has(assessment.attempt_id)}
                                  <tr class="bg-slate-200/80 dark:bg-slate-700/60 border-l-4 border-blue-500">
                                      <td colspan="5" class="px-6 py-4">
                                          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                              <div class="space-y-2">
                                                  <div>
                                                      <span class="font-medium text-slate-600 dark:text-slate-400">Attempt ID:</span>
                                                      <span class="ml-2 text-slate-800 dark:text-slate-200 font-mono text-xs">{assessment.attempt_id}</span>
                                                  </div>
                                                  <div>
                                                      <span class="font-medium text-slate-600 dark:text-slate-400">Student ID:</span>
                                                      <span class="ml-2 text-slate-800 dark:text-slate-200">{assessment.student_id || 'Not provided'}</span>
                                                  </div>
                                                  <div>
                                                      <span class="font-medium text-slate-600 dark:text-slate-400">Started:</span>
                                                      <span class="ml-2 text-slate-800 dark:text-slate-200">{formatDateTime(assessment.started_at)}</span>
                                                  </div>
                                                  <div>
                                                      <span class="font-medium text-slate-600 dark:text-slate-400">Submitted:</span>
                                                      <span class="ml-2 text-slate-800 dark:text-slate-200">{formatDateTime(assessment.submitted_at)}</span>
                                                  </div>
                                              </div>
                                              <div class="space-y-2">
                                                  {#if assessment.total_score !== null && assessment.total_score !== undefined}
                                                      <div>
                                                          <span class="font-medium text-slate-600 dark:text-slate-400">Score:</span>
                                                          <span class="ml-2 text-slate-800 dark:text-slate-200">{assessment.total_score}%</span>
                                                      </div>
                                                  {/if}
                                                  {#if assessment.outcome_flag}
                                                      <div>
                                                          <span class="font-medium text-slate-600 dark:text-slate-400">Outcome:</span>
                                                          <span class="ml-2 text-slate-800 dark:text-slate-200">{assessment.outcome_flag.replace('_', ' ')}</span>
                                                      </div>
                                                  {/if}
                                                  {#if assessment.token_hash && assessment.status === 'issued'}
                                                      <div class="pt-2">
                                                          <span class="font-medium text-slate-600 dark:text-slate-400 block mb-1">Assessment Link:</span>
                                                          <div class="flex items-center gap-2">
                                                              <code class="flex-1 bg-white/50 dark:bg-black/20 px-2 py-1 rounded text-xs font-mono break-all text-slate-700 dark:text-slate-300">
                                                                  {`${window.location.origin}/assess?token=${assessment.token_hash}`}
                                                              </code>
                                                              <button
                                                                  onclick={(e) => { e.stopPropagation(); copyToClipboard(`${window.location.origin}/assess?token=${assessment.token_hash}`); }}
                                                                  class="p-1.5 rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 transition-colors"
                                                                  title="Copy link"
                                                              >
                                                                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                                  </svg>
                                                              </button>
                                                          </div>
                                                      </div>
                                                  {/if}
                                              </div>
                                          </div>
                                          <div class="mt-4 flex gap-2">
                                              {#if assessment.status === 'submitted'}
                                                  <a
                                                      href={`/report?id=${assessment.attempt_id}`}
                                                      class="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                                                      onclick={(e) => e.stopPropagation()}
                                                  >
                                                      View Report
                                                  </a>
                                              {/if}
                                          </div>
                                      </td>
                                  </tr>
                              {/if}
                          {:else}
                              <tr>
                                  <td colspan="5" class="px-6 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                                      {loading ? 'Loading...' : searchQuery ? 'No matching assessments found.' : 'No assessments found.'}
                                  </td>
                              </tr>
                          {/each}
                      </tbody>
                  </table>
              </div>
          </div>
      </div>
  </div>
</div>
