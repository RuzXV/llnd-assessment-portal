<script lang="ts">
    import { onMount } from 'svelte';

    let token = $state<string | null>(null);
    let loading = $state(true);
    let error = $state<string | null>(null);
    let assessmentData = $state<any>(null);

    let studentNameInput = $state('');
    let studentIdInput = $state('');
    let showNameInput = $state(false);
    let consentChecked = $state(false);

    // Pre-filled student info from admin
    let prefilledName = $state<string | null>(null);
    let prefilledId = $state<string | null>(null);

    onMount(async () => {
      // Extract token from URL query parameter: /assess?token=xxx
      const urlParams = new URLSearchParams(window.location.search);
      token = urlParams.get('token');

      if (!token) {
          error = "Invalid Token";
          loading = false;
          return;
      }

      try {
        const res = await fetch(`/api/assessments/${token}`);

        if (!res.ok) {
           const err: any = await res.json();
           throw new Error(err.error || 'Invalid Link');
        }

        assessmentData = await res.json();

        if (assessmentData.student && assessmentData.student.name) {
            // Student info is pre-filled from admin
            prefilledName = assessmentData.student.name;
            prefilledId = assessmentData.student.id || null;
        } else {
            // No student info - need to collect it
            showNameInput = true;
        }

      } catch (e: any) {
        error = e.message || 'System Error';
      } finally {
        loading = false;
      }
    });

    function startAssessment() {
        if (showNameInput) {
            if (!studentNameInput.trim()) {
                alert("Please enter your full name to continue.");
                return;
            }
            if (!consentChecked) {
                alert("You must confirm your details to proceed.");
                return;
            }
            sessionStorage.setItem(`student_name_${token}`, studentNameInput);
            if(studentIdInput) {
                sessionStorage.setItem(`student_id_${token}`, studentIdInput);
            }
        } else if (prefilledName) {
            // Require confirmation for pre-filled info
            if (!consentChecked) {
                alert("Please confirm your identity to proceed.");
                return;
            }
        }
        window.location.href = `/assess-start?token=${token}`;
    }
</script>

{#if loading}
  <div class="glass-panel-fixed p-12 rounded-xl text-center max-w-md mx-auto">
      <h2 class="text-xl font-bold text-white">Loading Assessment...</h2>
  </div>
{:else if error}
  <div class="glass-panel-fixed p-8 rounded-xl text-center">
     <h1 class="text-xl font-bold text-white mb-2">Access Denied</h1>
     <p class="text-slate-300">{error}</p>
  </div>
{:else}
  <div class="glass-panel-fixed p-8 rounded-xl max-w-2xl mx-auto">
      <h1 class="text-3xl font-bold text-white mb-4">LLND Assessment</h1>
      <p class="text-slate-300 mb-6">Welcome to your {assessmentData.product_name || 'LLND'} assessment.</p>

      <!-- Assessment Context Info -->
      <div class="mb-6 bg-slate-800/50 p-6 rounded-lg border border-slate-700">
          <h3 class="text-white font-bold mb-3">About This Assessment</h3>
          <ul class="space-y-2 text-sm text-slate-300">
              <li class="flex items-start gap-2">
                  <svg class="w-5 h-5 text-blue-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  <span>This assessment contains <strong class="text-white">{assessmentData.questions?.length || 0} questions</strong>.</span>
              </li>
              <li class="flex items-start gap-2">
                  <svg class="w-5 h-5 text-blue-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                  <span>You will be assessed across <strong class="text-white">Reading, Writing, Numeracy, Oral Communication and Digital Literacy</strong>.</span>
              </li>
              <li class="flex items-start gap-2">
                  <svg class="w-5 h-5 text-blue-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <span>This should take approximately <strong class="text-white">30-45 minutes</strong> to complete.</span>
              </li>
              <li class="flex items-start gap-2">
                  <svg class="w-5 h-5 text-blue-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" /></svg>
                  <span>Your results will be communicated to you by your <strong class="text-white">institution instructor</strong>.</span>
              </li>
          </ul>
      </div>

      {#if prefilledName}
          <!-- Confirmation for pre-filled student info -->
          <div class="mb-6 bg-slate-800/50 p-6 rounded-lg border border-slate-700">
              <h3 class="text-white font-bold mb-4">Confirm Your Identity</h3>
              <div class="space-y-3">
                  <div class="flex items-center gap-3">
                      <span class="text-slate-400 text-sm w-24">Name:</span>
                      <span class="text-white font-medium text-lg">{prefilledName}</span>
                  </div>
                  {#if prefilledId}
                      <div class="flex items-center gap-3">
                          <span class="text-slate-400 text-sm w-24">Student ID:</span>
                          <span class="text-white font-medium text-lg">{prefilledId}</span>
                      </div>
                  {/if}
              </div>
              <div class="mt-4 pt-4 border-t border-slate-700">
                  <label class="flex items-start gap-3 p-3 rounded-lg border border-slate-700 bg-slate-800/30 cursor-pointer hover:bg-slate-800/50">
                      <input type="checkbox" bind:checked={consentChecked} class="mt-1 w-4 h-4 rounded border-slate-600 bg-slate-700">
                      <span class="text-sm text-slate-300">I confirm that I am the student listed above and I am ready to begin this assessment.</span>
                  </label>
              </div>
          </div>
      {:else if showNameInput}
          <!-- Input form when no student info is pre-filled -->
          <div class="mb-6 bg-slate-800/50 p-6 rounded-lg border border-slate-700">
              <h3 class="text-white font-bold mb-4">Student Details Required</h3>
              <div class="space-y-4">
                  <div>
                      <label for="sname" class="block text-sm text-slate-400 mb-1">Full Name *</label>
                      <input id="sname" type="text" bind:value={studentNameInput} class="w-full glass-input-fixed px-4 py-2 rounded-lg" placeholder="Enter full name" />
                  </div>
                  <div>
                      <label for="sid" class="block text-sm text-slate-400 mb-1">Student ID</label>
                      <input id="sid" type="text" bind:value={studentIdInput} class="w-full glass-input-fixed px-4 py-2 rounded-lg" />
                  </div>
                  <div class="pt-2">
                      <label class="flex items-start gap-3 p-3 rounded-lg border border-slate-700 bg-slate-800/30 cursor-pointer hover:bg-slate-800/50">
                          <input type="checkbox" bind:checked={consentChecked} class="mt-1 w-4 h-4 rounded border-slate-600 bg-slate-700">
                          <span class="text-sm text-slate-300">I confirm the information provided is accurate.</span>
                      </label>
                  </div>
              </div>
          </div>
      {/if}

      <div class="mt-8">
          <button onclick={startAssessment} disabled={!consentChecked} class="w-full px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-600">
              Start Assessment
          </button>
      </div>
  </div>
{/if}