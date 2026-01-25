<script lang="ts">
    import { onMount } from 'svelte';
  
    export let token: string | undefined = undefined;
    
    let loading = true;
    let error: string | null = null;
    let assessmentData: any = null;
    
    let studentNameInput = '';
    let studentIdInput = '';
    let showNameInput = false;

    onMount(async () => {
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

        if (!assessmentData.student || !assessmentData.student.name) {
            showNameInput = true;
        }

      } catch (e: any) {
        error = e.message || 'System Error';
      } finally {
        loading = false;
      }
    });

    let consentChecked = false;

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
        }
        window.location.href = `/assess/start/${token}`;
    }
  </script>
  
  {#if loading}
    <div class="glass-panel-fixed p-12 rounded-xl text-center max-w-md mx-auto">
        <div class="animate-spin mb-4 mx-auto h-8 w-8 text-blue-500">
            <svg class="circle" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
        </div>
        <h2 class="text-xl font-bold text-white">Loading Assessment...</h2>
    </div>
  {:else if error}
    <div class="glass-panel-fixed p-8 rounded-xl text-center max-w-md mx-auto">
       <div class="mb-4 inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100 text-red-600">
         <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
       </div>
       <h1 class="text-xl font-bold text-white mb-2">Access Denied</h1>
       <p class="text-slate-300">{error}</p>
       <p class="text-sm text-slate-400 mt-4">Please contact your training provider for a new link.</p>
    </div>
  {:else}
    <div class="glass-panel-fixed p-8 rounded-xl max-w-2xl mx-auto">
        <h1 class="text-3xl font-bold text-white mb-4">{assessmentData.title || 'Assessment'}</h1>
        <p class="text-slate-300 mb-6">{assessmentData.description || 'Welcome to your assessment. This tool will help us identify the best support for your learning journey.'}</p>
        
        {#if showNameInput}
            <div class="mb-6 bg-slate-800/50 p-6 rounded-lg border border-slate-700">
                <h3 class="text-white font-bold mb-4">Student Details Required</h3>
                <div class="space-y-4">
                    <div>
                        <label for="sname" class="block text-sm text-slate-400 mb-1">Full Name *</label>
                        <input 
                            id="sname"
                            type="text" 
                            bind:value={studentNameInput}
                            class="w-full glass-input-fixed px-4 py-2 rounded-lg"
                            placeholder="Enter your full name"
                        />
                    </div>
                    <div>
                        <label for="sid" class="block text-sm text-slate-400 mb-1">Student ID (Optional)</label>
                        <input 
                            id="sid"
                            type="text" 
                            bind:value={studentIdInput}
                            class="w-full glass-input-fixed px-4 py-2 rounded-lg"
                            placeholder="e.g. S123456"
                        />
                    </div>
                    <div class="pt-2">
                        <label class="flex items-start gap-3 p-3 rounded-lg border border-slate-700 bg-slate-800/30 cursor-pointer hover:bg-slate-800/50 transition-colors">
                            <input type="checkbox" bind:checked={consentChecked} class="mt-1 w-4 h-4 rounded border-slate-600 text-blue-600 focus:ring-blue-500 bg-slate-700">
                            <span class="text-sm text-slate-300">
                                I confirm that I am the student named above and the information provided is accurate. I understand this assessment is for LLND support purposes.
                            </span>
                        </label>
                    </div>
                </div>
            </div>
        {/if}

        <div class="flex items-center justify-between mt-8">
            <div class="text-sm text-slate-400 hidden sm:block">
                <span class="block">⏱ Estimated time: 20-30 mins</span>
                <span class="block">📝 One attempt allowed</span>
            </div>
            <button on:click={startAssessment} class="w-full sm:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold transition-all shadow-lg hover:shadow-blue-500/25">
                Start Assessment
            </button>
        </div>
    </div>
  {/if}