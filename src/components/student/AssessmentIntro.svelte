<script lang="ts">
    let { data, token } = $props(); 
    
    let confirmed = $state(false);
    let starting = $state(false);
  
    let branding = $derived(data?.branding || {});
    let studentName = $derived(data?.student?.name || 'Student');
  
    function startAssessment() {
      starting = true;
      window.location.href = `/assess/${token}/start`; 
    }
  </script>
  
  <div class="glass-panel-fixed rounded-2xl overflow-hidden shadow-2xl">
    
    <div class="bg-slate-800/50 p-6 border-b border-slate-700/50 text-center">
      {#if branding.logo}
        <img src={branding.logo} alt="RTO Logo" class="h-12 mx-auto mb-4 object-contain" />
      {/if}
      <h1 class="text-2xl font-bold text-white">{branding.rto_name || 'LLND Assessment'}</h1>
    </div>
  
    <div class="p-8">
      <div class="mb-8">
        <h2 class="text-xl font-semibold text-white mb-2">Welcome, {studentName}</h2>
        <p class="text-slate-300">
          You are about to begin your Language, Literacy, and Numeracy assessment.
        </p>
      </div>
  
      <div class="bg-slate-800/40 rounded-lg p-5 mb-8 border border-slate-700/50">
        <h3 class="text-sm font-bold text-slate-200 uppercase tracking-wide mb-3">Instructions</h3>
        <ul class="space-y-2 text-sm text-slate-300">
          <li class="flex items-start gap-2">
            <svg class="w-5 h-5 text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <span>This assessment is untimed, but typically takes 30-45 minutes.</span>
          </li>
          <li class="flex items-start gap-2">
            <svg class="w-5 h-5 text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            <span>One attempt only. You cannot restart once submitted.</span>
          </li>
          <li class="flex items-start gap-2">
            <svg class="w-5 h-5 text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <span>Calculators are permitted for numeracy questions.</span>
          </li>
        </ul>
      </div>
  
      <div class="flex items-start gap-3 mb-8">
        <input 
          type="checkbox" 
          id="confirm" 
          bind:checked={confirmed}
          class="mt-1 w-5 h-5 rounded border-gray-500 bg-slate-700 text-blue-600 focus:ring-blue-500"
        />
        <label for="confirm" class="text-sm text-slate-300">
          I confirm that I am <strong>{studentName}</strong> and I am completing this assessment on my own without assistance.
        </label>
      </div>
  
      <button 
        onclick={startAssessment}
        disabled={!confirmed || starting}
        class="w-full py-4 px-6 rounded-lg font-bold text-white text-lg shadow-lg transition-all 
               {confirmed && !starting ? 'bg-blue-600 hover:bg-blue-500' : 'bg-slate-700 cursor-not-allowed opacity-50'}"
      >
        {starting ? 'Loading Assessment...' : 'Start Assessment'}
      </button>
    </div>
  </div>