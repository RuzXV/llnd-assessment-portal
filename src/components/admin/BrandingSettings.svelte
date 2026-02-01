<script lang="ts">
  import { onMount } from 'svelte';

  let loading = $state(true);
  let saving = $state(false);
  let error = $state('');
  let success = $state('');

  let rtoName = $state('');
  let legalName = $state('');
  let logoUrl = $state('');
  let brandColor = $state('#000000');

  onMount(async () => {
    await loadBrandingData();
  });

  async function loadBrandingData() {
    loading = true;
    error = '';

    try {
      const token = localStorage.getItem('llnd_token');
      const res = await fetch('/api/admin/branding', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) throw new Error('Failed to load branding settings');

      const data: any = await res.json();
      rtoName = data.name || '';
      legalName = data.legal_name || '';
      logoUrl = data.logo_url || '';
      brandColor = data.brand_primary_color || '#000000';

    } catch (e: any) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  async function saveBranding(e: Event) {
    e.preventDefault();
    saving = true;
    error = '';
    success = '';

    try {
      const token = localStorage.getItem('llnd_token');
      const res = await fetch('/api/admin/branding', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: rtoName,
          legal_name: legalName,
          logo_url: logoUrl,
          brand_primary_color: brandColor
        })
      });

      if (!res.ok) {
        const data: any = await res.json();
        throw new Error(data.error || 'Failed to save branding settings');
      }

      success = 'Branding settings saved successfully!';
      setTimeout(() => { success = ''; }, 3000);

    } catch (e: any) {
      error = e.message;
    } finally {
      saving = false;
    }
  }
</script>

<div class="space-y-6">
  <div>
    <h2 class="text-2xl font-bold text-slate-900 dark:text-white">White-Labeling & Branding</h2>
    <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
      Customize your portal's appearance with your organization's branding.
    </p>
  </div>

  {#if error}
    <div class="rounded-lg bg-red-500/10 border border-red-500/20 p-4 text-red-600 dark:text-red-400">
      <p class="text-sm font-medium">Error: {error}</p>
    </div>
  {/if}

  {#if success}
    <div class="rounded-lg bg-green-500/10 border border-green-500/20 p-4 text-green-600 dark:text-green-400">
      <p class="text-sm font-medium">{success}</p>
    </div>
  {/if}

  {#if loading}
    <div class="glass-panel rounded-xl p-12 text-center">
      <div class="animate-pulse text-slate-500 dark:text-slate-400">Loading branding settings...</div>
    </div>
  {:else}
    <form onsubmit={saveBranding} class="space-y-6">
      <div class="glass-panel rounded-xl p-6 space-y-6">

        <!-- Organization Name -->
        <div>
          <label for="rto-name" class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Organization Name
          </label>
          <input
            type="text"
            id="rto-name"
            bind:value={rtoName}
            required
            class="glass-input w-full px-4 py-2.5 rounded-lg text-sm"
            placeholder="e.g., ABC Training Institute"
          />
          <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
            This name appears on assessment reports and student portals.
          </p>
        </div>

        <!-- Legal Name -->
        <div>
          <label for="legal-name" class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Legal Name (Optional)
          </label>
          <input
            type="text"
            id="legal-name"
            bind:value={legalName}
            class="glass-input w-full px-4 py-2.5 rounded-lg text-sm"
            placeholder="e.g., ABC Training Institute Pty Ltd"
          />
          <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Official registered business name for compliance documentation.
          </p>
        </div>

        <!-- Logo URL -->
        <div>
          <label for="logo-url" class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Logo URL
          </label>
          <input
            type="url"
            id="logo-url"
            bind:value={logoUrl}
            class="glass-input w-full px-4 py-2.5 rounded-lg text-sm"
            placeholder="https://example.com/logo.png"
          />
          <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Direct link to your organization's logo image (PNG, JPG, SVG recommended).
          </p>

          {#if logoUrl}
            <div class="mt-3 p-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
              <p class="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">Preview:</p>
              <img src={logoUrl} alt="Logo preview" class="h-16 object-contain" onerror={() => error = 'Logo failed to load'} />
            </div>
          {/if}
        </div>

        <!-- Brand Color -->
        <div>
          <label for="brand-color" class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Primary Brand Color
          </label>
          <div class="flex items-center gap-4">
            <input
              type="color"
              id="brand-color"
              bind:value={brandColor}
              class="h-12 w-20 rounded-lg border-2 border-slate-300 dark:border-slate-600 cursor-pointer"
            />
            <input
              type="text"
              bind:value={brandColor}
              class="glass-input flex-1 px-4 py-2.5 rounded-lg text-sm font-mono"
              placeholder="#000000"
              pattern="^#[0-9A-Fa-f]{6}$"
            />
          </div>
          <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Used for accents and branding elements throughout the assessment portal.
          </p>

          <div class="mt-3 p-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
            <p class="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">Preview:</p>
            <div class="flex items-center gap-3">
              <div class="w-16 h-16 rounded-lg border border-slate-300 dark:border-slate-600" style="background-color: {brandColor}"></div>
              <div class="flex-1 space-y-2">
                <div class="h-3 rounded-full" style="background-color: {brandColor}; width: 100%; opacity: 0.8;"></div>
                <div class="h-3 rounded-full" style="background-color: {brandColor}; width: 75%; opacity: 0.6;"></div>
                <div class="h-3 rounded-full" style="background-color: {brandColor}; width: 50%; opacity: 0.4;"></div>
              </div>
            </div>
          </div>
        </div>

      </div>

      <!-- Action Buttons -->
      <div class="flex justify-end gap-3">
        <button
          type="button"
          onclick={loadBrandingData}
          disabled={saving}
          class="px-6 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Reset
        </button>
        <button
          type="submit"
          disabled={saving}
          class="px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          {#if saving}
            <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Saving...
          {:else}
            Save Changes
          {/if}
        </button>
      </div>
    </form>
  {/if}
</div>
