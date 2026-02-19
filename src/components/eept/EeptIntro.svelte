<script lang="ts">
    import { onMount } from 'svelte';

    let token = $state<string | null>(null);
    let loading = $state(true);
    let error = $state<string | null>(null);
    let assessmentData = $state<any>(null);
    let consentChecked = $state(false);

    // Candidate info from API
    let candidateName = $state('');
    let candidateEmail = $state('');

    onMount(async () => {
      const urlParams = new URLSearchParams(window.location.search);
      token = urlParams.get('token');

      if (!token) {
          error = "Invalid or missing assessment token.";
          loading = false;
          return;
      }

      try {
        const res = await fetch(`/api/ebpa/start?token=${token}`);

        if (!res.ok) {
           const err: any = await res.json();
           throw new Error(err.error || 'Invalid or expired assessment link');
        }

        assessmentData = await res.json();
        candidateName = assessmentData.candidate?.first_name
            ? `${assessmentData.candidate.first_name} ${assessmentData.candidate.last_name}`
            : '';
        candidateEmail = assessmentData.candidate?.email || '';

      } catch (e: any) {
        error = e.message || 'System Error';
      } finally {
        loading = false;
      }
    });

    function startAssessment() {
        if (!consentChecked) {
            alert("Please confirm your identity and consent to proceed.");
            return;
        }
        // Store candidate info in sessionStorage
        sessionStorage.setItem(`eept_token`, token!);
        sessionStorage.setItem(`eept_candidate_name`, candidateName);
        // Navigate with the token
        window.location.href = `/assess-eept-start?token=${token}`;
    }
</script>

{#if loading}
  <div class="glass-panel-fixed p-12 rounded-xl text-center max-w-md mx-auto">
      <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-500 mx-auto mb-4"></div>
      <h2 class="text-xl font-bold text-white">Loading Assessment...</h2>
  </div>
{:else if error}
  <div class="glass-panel-fixed p-8 rounded-xl text-center">
     <div class="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/30">
        <svg class="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
     </div>
     <h1 class="text-xl font-bold text-white mb-2">Access Denied</h1>
     <p class="text-slate-300">{error}</p>
  </div>
{:else}
  <div class="glass-panel-fixed p-8 rounded-xl max-w-2xl mx-auto">
      <!-- Header -->
      <div class="text-center mb-6">
          <div class="inline-flex items-center px-3 py-1 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300 text-xs font-bold uppercase tracking-wider mb-4">
              English Placement Test
          </div>
          <h1 class="text-3xl font-bold text-white mb-2">EEPT Assessment</h1>
          <p class="text-slate-400">Evidence-based English Proficiency Assessment</p>
      </div>

      <!-- Assessment Info -->
      <div class="mb-6 bg-slate-800/50 p-6 rounded-lg border border-slate-700">
          <h3 class="text-white font-bold mb-3">About This Assessment</h3>
          <ul class="space-y-3 text-sm text-slate-300">
              <li class="flex items-start gap-3">
                  <svg class="w-5 h-5 text-purple-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  <span>This test has <strong class="text-white">4 sections</strong>: Grammar, Reading Comprehension, and two Writing Tasks.</span>
              </li>
              <li class="flex items-start gap-3">
                  <svg class="w-5 h-5 text-purple-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <span>The test should take approximately <strong class="text-white">60-90 minutes</strong> to complete.</span>
              </li>
              <li class="flex items-start gap-3">
                  <svg class="w-5 h-5 text-purple-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>
                  <span>Your results will be assessed against the <strong class="text-white">CEFR framework</strong> (A2-C1) with an indicative IELTS band.</span>
              </li>
              <li class="flex items-start gap-3">
                  <svg class="w-5 h-5 text-purple-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <span>Your progress is <strong class="text-white">saved automatically</strong>. You can navigate between sections freely.</span>
              </li>
          </ul>
      </div>

      <!-- Section breakdown -->
      <div class="mb-6 bg-slate-800/50 p-6 rounded-lg border border-slate-700">
          <h3 class="text-white font-bold mb-3">Test Structure</h3>
          <div class="grid grid-cols-2 gap-3">
              <div class="p-3 rounded-lg bg-slate-700/40 border border-slate-600/50">
                  <div class="text-xs font-bold text-purple-400 uppercase mb-1">Section A</div>
                  <div class="text-sm text-white font-medium">Grammar & Vocabulary</div>
                  <div class="text-xs text-slate-400 mt-1">20 multiple-choice questions</div>
              </div>
              <div class="p-3 rounded-lg bg-slate-700/40 border border-slate-600/50">
                  <div class="text-xs font-bold text-blue-400 uppercase mb-1">Section B</div>
                  <div class="text-sm text-white font-medium">Reading Comprehension</div>
                  <div class="text-xs text-slate-400 mt-1">4 passages, 20 questions</div>
              </div>
              <div class="p-3 rounded-lg bg-slate-700/40 border border-slate-600/50">
                  <div class="text-xs font-bold text-emerald-400 uppercase mb-1">Section C</div>
                  <div class="text-sm text-white font-medium">Writing Task 1</div>
                  <div class="text-xs text-slate-400 mt-1">Functional writing (120-150 words)</div>
              </div>
              <div class="p-3 rounded-lg bg-slate-700/40 border border-slate-600/50">
                  <div class="text-xs font-bold text-amber-400 uppercase mb-1">Section D</div>
                  <div class="text-sm text-white font-medium">Writing Task 2</div>
                  <div class="text-xs text-slate-400 mt-1">Extended writing (~250 words)</div>
              </div>
          </div>
      </div>

      <!-- Candidate confirmation -->
      {#if candidateName}
          <div class="mb-6 bg-slate-800/50 p-6 rounded-lg border border-slate-700">
              <h3 class="text-white font-bold mb-4">Confirm Your Identity</h3>
              <div class="space-y-3">
                  <div class="flex items-center gap-3">
                      <span class="text-slate-400 text-sm w-24">Name:</span>
                      <span class="text-white font-medium text-lg">{candidateName}</span>
                  </div>
                  {#if candidateEmail}
                      <div class="flex items-center gap-3">
                          <span class="text-slate-400 text-sm w-24">Email:</span>
                          <span class="text-white font-medium">{candidateEmail}</span>
                      </div>
                  {/if}
              </div>
              <div class="mt-4 pt-4 border-t border-slate-700">
                  <label class="flex items-start gap-3 p-3 rounded-lg border border-slate-700 bg-slate-800/30 cursor-pointer hover:bg-slate-800/50">
                      <input type="checkbox" bind:checked={consentChecked} class="mt-1 w-4 h-4 rounded border-slate-600 bg-slate-700">
                      <span class="text-sm text-slate-300">I confirm that I am the candidate listed above and I understand that this assessment is being conducted under test conditions. I will complete it independently without outside assistance.</span>
                  </label>
              </div>
          </div>
      {/if}

      <div class="mt-8">
          <button onclick={startAssessment} disabled={!consentChecked} class="w-full px-6 py-3.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-purple-600 shadow-lg shadow-purple-600/20">
              Begin Assessment
          </button>
      </div>
  </div>
{/if}
