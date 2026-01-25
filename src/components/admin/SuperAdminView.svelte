<script lang="ts">
    import { onMount } from 'svelte';
  
    let tenants = $state<any[]>([]);
    let loading = $state(true);
    let showModal = $state(false);
    
    let newName = $state('');
    let newSubdomain = $state('');
    let newEmail = $state('');
    let newPassword = $state('');
    let creating = $state(false);
  
    onMount(loadTenants);
  
    async function loadTenants() {
      try {
          const token = localStorage.getItem('llnd_token');
          const res = await fetch('/api/admin/tenants', {
              headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) tenants = await res.json();
      } catch (e) { console.error(e); } 
      finally { loading = false; }
    }
  
    async function createTenant(e: Event) {
      e.preventDefault();
      creating = true;
      const token = localStorage.getItem('llnd_token');
  
      try {
          const tRes = await fetch('/api/admin/tenants', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify({ name: newName, subdomain: newSubdomain, legal_name: newName })
          });
          const tData: any = await tRes.json();
          if (!tRes.ok) throw new Error(tData.error);
  
          const uRes = await fetch('/api/admin/users', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify({ 
                  email: newEmail, 
                  password: newPassword, 
                  role: 'rto_admin', 
                  target_tenant_id: tData.tenant_id 
              })
          });
          
          if (!uRes.ok) throw new Error('Tenant created, but user failed.');
  
          await fetch('/api/admin/purchase', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify({ 
                  target_tenant_id: tData.tenant_id, 
                  product_id: 'cert_3_generic', 
                  quantity: 10 
              })
          });
  
          alert(`Tenant "${newName}" created successfully! Login: ${newEmail}`);
          showModal = false;
          loadTenants();
          
      } catch (e: any) {
          alert('Error: ' + e.message);
      } finally {
          creating = false;
      }
    }
  </script>
  
  <div class="space-y-6">
      <div class="flex justify-between items-center">
          <h1 class="text-2xl font-bold text-white">Tenants & Clients</h1>
          <button onclick={() => showModal = true} class="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg font-bold transition-all">
              + Onboard New RTO
          </button>
      </div>
  
      {#if loading}
          <div class="text-slate-400">Loading clients...</div>
      {:else}
          <div class="grid gap-4">
              {#each tenants as t}
                  <div class="bg-slate-800/50 border border-slate-700/50 p-6 rounded-xl flex items-center justify-between">
                      <div>
                          <h3 class="text-lg font-bold text-white">{t.name}</h3>
                          <div class="text-sm text-slate-400 flex gap-4 mt-1">
                              <span>ID: {t.subdomain}</span>
                              <span>•</span>
                              <span>Created: {new Date(t.created_at * 1000).toLocaleDateString()}</span>
                          </div>
                      </div>
                      <div class="text-right">
                          <div class="text-2xl font-bold text-white">{t.total_seats - t.used_seats} / {t.total_seats}</div>
                          <div class="text-xs text-slate-500 uppercase font-bold">Seats Available</div>
                      </div>
                  </div>
              {/each}
          </div>
      {/if}
  
      {#if showModal}
          <div class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div class="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl p-8">
                  <h2 class="text-xl font-bold text-white mb-6">Onboard New RTO</h2>
                  <form onsubmit={createTenant} class="space-y-4">
                      <div>
                          <label for="rto_name" class="block text-sm text-slate-400 mb-1">RTO Name</label>
                          <input id="rto_name" type="text" bind:value={newName} required class="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white">
                      </div>
                      <div>
                          <label for="subdomain" class="block text-sm text-slate-400 mb-1">Subdomain / ID</label>
                          <input id="subdomain" type="text" bind:value={newSubdomain} required placeholder="e.g. tafe-nsw" class="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white">
                      </div>
                      <div class="pt-4 border-t border-slate-800">
                          <label for="admin_email" class="block text-sm text-slate-400 mb-1">Admin Email</label>
                          <input id="admin_email" type="email" bind:value={newEmail} required class="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white">
                      </div>
                      <div>
                          <label for="admin_password" class="block text-sm text-slate-400 mb-1">Initial Password</label>
                          <input id="admin_password" type="text" bind:value={newPassword} required class="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white">
                      </div>
                      
                      <div class="flex gap-3 pt-4">
                          <button type="button" onclick={() => showModal = false} class="flex-1 py-2 text-slate-400 hover:text-white">Cancel</button>
                          <button type="submit" disabled={creating} class="flex-1 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-bold">
                              {creating ? 'Creating...' : 'Create RTO'}
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      {/if}
  </div>