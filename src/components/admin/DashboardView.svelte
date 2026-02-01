<script lang="ts">
  import { onMount } from 'svelte';

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

  let availableSeats = $derived(rawSeats.filter(s => s.status === 'available'));
  let totalSeatsRemaining = $derived(availableSeats.reduce((acc, s) => acc + s.count, 0));
  let totalIssued = $derived(assessments.length);
  let totalCompleted = $derived(assessments.filter(a => a.status === 'submitted').length);
  let studentsFlaggedForSupport = $derived(assessments.filter(a => a.status === 'submitted' && a.outcome_flag === 'support_required').length);

  onMount(async () => {
      await loadDashboardData();
  });

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
          successLink = `${origin}/assess/${data.token}`;
          await loadDashboardData();
          studentName = '';
          studentId = '';

      } catch (e: any) {
          formError = e.message;
      } finally {
          issuing = false;
      }
  }

  function getStatusBadge(status: string) {
      switch(status) {
          case 'submitted': return 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300 border border-green-200 dark:border-green-800';
          case 'in_progress': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800';
          case 'issued': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800';
          default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-300 border border-gray-200 dark:border-gray-600';
      }
  }

  function formatDate(isoString: string | null) {
      if (!isoString) return 'Not started'; 
      return new Date(isoString).toLocaleDateString();
  }
</script>

<div class="space-y-8">
  {#if error}
      <div class="rounded-lg bg-red-500/10 border border-red-500/20 p-4 text-red-600 dark:text-red-400">
          <p class="text-sm font-medium">Error: {error}</p>
      </div>
  {/if}

  <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
      <div class="glass-panel rounded-xl overflow-hidden p-6 relative group">
          <dt class="text-sm font-medium text-slate-500 dark:text-slate-400 truncate">Total Seats Available</dt>
          <dd class="mt-2 text-3xl font-bold text-slate-900 dark:text-white">{loading ? '-' : totalSeatsRemaining}</dd>
          <div class="absolute right-4 top-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <svg class="w-12 h-12 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
          </div>
      </div>

      <div class="glass-panel rounded-xl overflow-hidden p-6 relative group">
          <dt class="text-sm font-medium text-slate-500 dark:text-slate-400 truncate">Assessments Issued</dt>
          <dd class="mt-2 text-3xl font-bold text-slate-900 dark:text-white">{loading ? '-' : totalIssued}</dd>
          <div class="absolute right-4 top-4 opacity-10 group-hover:opacity-20 transition-opacity">
               <svg class="w-12 h-12 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4v16m8-8H4"></path></svg>
          </div>
      </div>

      <div class="glass-panel rounded-xl overflow-hidden p-6 relative group">
          <dt class="text-sm font-medium text-slate-500 dark:text-slate-400 truncate">Completed</dt>
          <dd class="mt-2 text-3xl font-bold text-slate-900 dark:text-white">{loading ? '-' : totalCompleted}</dd>
          <div class="absolute right-4 top-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <svg class="w-12 h-12 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          </div>
      </div>

      <div class="glass-panel rounded-xl overflow-hidden p-6 relative group">
          <dt class="text-sm font-medium text-slate-500 dark:text-slate-400 truncate">Students Flagged for Support</dt>
          <dd class="mt-2 text-3xl font-bold text-slate-900 dark:text-white">{loading ? '-' : studentsFlaggedForSupport}</dd>
          <div class="absolute right-4 top-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <svg class="w-12 h-12 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
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
                      <select 
                          id="product" 
                          bind:value={selectedProduct} 
                          class="glass-input mt-1 block w-full pl-3 pr-10 py-2.5 text-base sm:text-sm rounded-lg"
                      >
                          {#if availableSeats.length === 0 && !loading}
                              <option disabled>No seats available</option>
                          {:else}
                              {#each availableSeats as seat}
                                  <option value={seat.product_id} class="text-slate-900 bg-white">
                                      {seat.product_name || seat.product_id} ({seat.count} left)
                                  </option>
                              {/each}
                          {/if}
                      </select>
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
          </div>
      </div>

      <div class="lg:col-span-2">
          <div class="glass-panel rounded-xl overflow-hidden flex flex-col h-full">
              <div class="px-6 py-5 border-b border-gray-200/50 dark:border-gray-700/50">
                  <h3 class="text-lg leading-6 font-bold text-slate-900 dark:text-white">Assessment History</h3>
              </div>
              
              <div class="overflow-x-auto flex-1">
                  <table class="min-w-full divide-y divide-gray-200/50 dark:divide-gray-700/50">
                      <thead class="bg-gray-50/50 dark:bg-slate-800/50">
                          <tr>
                              <th class="px-6 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Student</th>
                              <th class="px-6 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Type</th>
                              <th class="px-6 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Date</th>
                              <th class="px-6 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
                              <th class="relative px-6 py-3"><span class="sr-only">View</span></th>
                          </tr>
                      </thead>
                      <tbody class="divide-y divide-gray-200/50 dark:divide-gray-700/50">
                          {#each assessments as assessment}
                              <tr class="hover:bg-white/40 dark:hover:bg-slate-700/40 transition-colors">
                                  <td class="px-6 py-4 whitespace-nowrap">
                                      <div class="text-sm font-medium text-slate-900 dark:text-white">{assessment.student_name || 'Unassigned'}</div>
                                  </td>
                                  <td class="px-6 py-4 whitespace-nowrap">
                                      <div class="text-sm text-slate-600 dark:text-slate-300">{assessment.product_name || 'Assessment'}</div>
                                  </td>
                                  <td class="px-6 py-4 whitespace-nowrap">
                                      <div class="text-sm text-slate-500 dark:text-slate-400">
                                          {formatDate(assessment.started_at || assessment.submitted_at)}
                                      </div>
                                  </td>
                                  <td class="px-6 py-4 whitespace-nowrap">
                                      <span class={`px-2.5 py-0.5 inline-flex text-xs leading-5 font-bold rounded-full ${getStatusBadge(assessment.status)}`}>
                                          {assessment.status.toUpperCase()}
                                      </span>
                                  </td>
                                  <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                      {#if assessment.status === 'submitted'}
                                          <a href={`/report?id=${assessment.attempt_id}`} class="text-blue-600 dark:text-blue-400 hover:underline">View</a>
                                      {/if}
                                  </td>
                              </tr>
                          {:else}
                              <tr>
                                  <td colspan="5" class="px-6 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                                      {loading ? 'Loading...' : 'No assessments found.'}
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