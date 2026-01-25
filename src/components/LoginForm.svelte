<script lang="ts">
  let email = $state('');
  let password = $state('');
  let error = $state('');
  let loading = $state(false);

  async function handleLogin(e: Event) {
    e.preventDefault(); 
    loading = true;
    error = '';

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data: any = await response.json();
      if (!response.ok) throw new Error(data.error || 'Login failed');

      localStorage.setItem('llnd_token', data.token);
      localStorage.setItem('llnd_user', JSON.stringify(data.user));
      window.location.href = '/dashboard';

    } catch (err: any) {
      error = err.message;
    } finally {
      loading = false;
    }
  }
</script>

<div class="w-full max-w-md glass-panel-fixed p-8 rounded-2xl relative">
  
  <div class="mb-8 text-center border-b border-slate-700/50 pb-6">
    <h1 class="text-3xl font-bold text-white">RTO Admin Portal</h1>
    <p class="text-slate-400 text-sm mt-2">Sign in to manage LLND assessments</p>
  </div>

  {#if error}
    <div class="mb-6 p-4 bg-red-500/10 text-red-400 text-sm rounded-lg border border-red-500/20 flex items-start">
      <svg class="h-5 w-5 mr-2 shrink-0" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
      </svg>
      {error}
    </div>
  {/if}

  <form onsubmit={handleLogin} class="space-y-6">
    <div>
      <label for="email" class="block text-sm font-semibold text-slate-300 mb-1.5">Email Address</label>
      <input 
        id="email" 
        type="email" 
        bind:value={email} 
        required
        class="glass-input-fixed w-full px-4 py-3 rounded-lg outline-none transition-all placeholder-slate-500"
        placeholder="admin@rto.com"
      />
    </div>

    <div>
      <label for="password" class="block text-sm font-semibold text-slate-300 mb-1.5">Password</label>
      <input 
        id="password" 
        type="password" 
        bind:value={password} 
        required
        class="glass-input-fixed w-full px-4 py-3 rounded-lg outline-none transition-all placeholder-slate-500"
        placeholder="••••••••"
      />
    </div>

    <button 
      type="submit" 
      disabled={loading}
      class="w-full flex justify-center py-3 px-4 rounded-lg text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-none"
    >
      {#if loading}
        <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Signing in...
      {:else}
        Sign In
      {/if}
    </button>
  </form>
</div>