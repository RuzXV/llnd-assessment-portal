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
      <h1 class="text-3xl font-bold text-white mb-4">{assessmentData.title || 'Assessment'}</h1>
      <p class="text-slate-300 mb-6">{assessmentData.description || 'Welcome to your assessment.'}</p>

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
          <button onclick={startAssessment} class="w-full px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold transition-colors">
              Start Assessment
          </button>
      </div>
  </div>
{/if}