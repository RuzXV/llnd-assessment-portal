<script lang="ts">
  let rtoName = $state('');
  let rtoCode = $state('');
  let contactName = $state('');
  let email = $state('');
  let password = $state('');
  let confirmPassword = $state('');
  let error = $state('');
  let loading = $state(false);
  let success = $state(false);

  async function handleRegister(e: Event) {
    e.preventDefault();
    loading = true;
    error = '';

    if (password !== confirmPassword) {
      error = 'Passwords do not match';
      loading = false;
      return;
    }

    if (password.length < 8) {
      error = 'Password must be at least 8 characters';
      loading = false;
      return;
    }

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rto_name: rtoName,
          rto_code: rtoCode,
          contact_name: contactName,
          email,
          password
        })
      });

      const data: any = await response.json();
      if (!response.ok) throw new Error(data.error || 'Registration failed');

      success = true;

    } catch (err: any) {
      error = err.message;
    } finally {
      loading = false;
    }
  }
</script>

{#if success}
  <div class="w-full max-w-md glass-panel-fixed p-8 rounded-2xl relative text-center">
    <div class="h-16 w-16 bg-green-600/20 border border-green-500/30 rounded-full flex items-center justify-center mx-auto mb-6">
      <svg class="h-8 w-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
    </div>
    <h2 class="text-2xl font-bold text-white mb-3">Registration Complete</h2>
    <p class="text-slate-400 text-sm mb-6">Your RTO account has been created. You can now sign in to access the platform.</p>
    <a href="/login" class="inline-flex justify-center w-full py-3 px-4 rounded-lg text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 transition-all no-underline">
      Go to Login
    </a>
  </div>
{:else}
  <div class="w-full max-w-md glass-panel-fixed p-8 rounded-2xl relative">

    <div class="mb-8 text-center border-b border-slate-700/50 pb-6">
      <h1 class="text-3xl font-bold text-white">Register Your RTO</h1>
      <p class="text-slate-400 text-sm mt-2">Create an account to start using the EduX platform</p>
    </div>

    {#if error}
      <div class="mb-6 p-4 bg-red-500/10 text-red-400 text-sm rounded-lg border border-red-500/20 flex items-start">
        <svg class="h-5 w-5 mr-2 shrink-0" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
        </svg>
        {error}
      </div>
    {/if}

    <form onsubmit={handleRegister} class="space-y-5">
      <div>
        <label for="rto-name" class="block text-sm font-semibold text-slate-300 mb-1.5">RTO Name <span class="text-red-400">*</span></label>
        <input
          id="rto-name"
          type="text"
          bind:value={rtoName}
          required
          class="glass-input-fixed w-full px-4 py-3 rounded-lg outline-none transition-all placeholder-slate-500"
          placeholder="Your Training Organisation"
        />
      </div>

      <div>
        <label for="rto-code" class="block text-sm font-semibold text-slate-300 mb-1.5">RTO Code</label>
        <input
          id="rto-code"
          type="text"
          bind:value={rtoCode}
          class="glass-input-fixed w-full px-4 py-3 rounded-lg outline-none transition-all placeholder-slate-500"
          placeholder="e.g. 12345"
        />
      </div>

      <div>
        <label for="contact-name" class="block text-sm font-semibold text-slate-300 mb-1.5">Primary Contact Name <span class="text-red-400">*</span></label>
        <input
          id="contact-name"
          type="text"
          bind:value={contactName}
          required
          class="glass-input-fixed w-full px-4 py-3 rounded-lg outline-none transition-all placeholder-slate-500"
          placeholder="Jane Smith"
        />
      </div>

      <div>
        <label for="reg-email" class="block text-sm font-semibold text-slate-300 mb-1.5">Email Address <span class="text-red-400">*</span></label>
        <input
          id="reg-email"
          type="email"
          bind:value={email}
          required
          class="glass-input-fixed w-full px-4 py-3 rounded-lg outline-none transition-all placeholder-slate-500"
          placeholder="admin@rto.com.au"
        />
      </div>

      <div>
        <label for="reg-password" class="block text-sm font-semibold text-slate-300 mb-1.5">Password <span class="text-red-400">*</span></label>
        <input
          id="reg-password"
          type="password"
          bind:value={password}
          required
          minlength="8"
          class="glass-input-fixed w-full px-4 py-3 rounded-lg outline-none transition-all placeholder-slate-500"
          placeholder="Min. 8 characters"
        />
      </div>

      <div>
        <label for="reg-confirm" class="block text-sm font-semibold text-slate-300 mb-1.5">Confirm Password <span class="text-red-400">*</span></label>
        <input
          id="reg-confirm"
          type="password"
          bind:value={confirmPassword}
          required
          class="glass-input-fixed w-full px-4 py-3 rounded-lg outline-none transition-all placeholder-slate-500"
          placeholder="Re-enter password"
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
          Creating account...
        {:else}
          Create Account
        {/if}
      </button>
    </form>
  </div>
{/if}
