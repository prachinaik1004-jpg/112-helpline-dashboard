(function(){
  'use strict';

  // Shorthands
  const $ = (id) => document.getElementById(id);
  const byName = (name) => Array.from(document.querySelectorAll(`[name="${name}"]`));
  const on = (el, ev, fn) => el && el.addEventListener(ev, fn);

  // LocalStorage helpers
  const saveLS = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  const readLS = (k, fb) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? fb; } catch { return fb; } };

  // Keys
  const KEYS = {
    role: 'settings.role',
    modules: 'settings.modules',
    map: 'settings.map',
    security: 'settings.security',
    logs: 'settings.access_logs'
  };

  // State
  const state = {
    role: 'operator',
    modules: { tourism: false, ride: true, wsi: true },
    map: { provider: 'osm', apiKey: '' },
    security: { encrypt: false, audit: true },
    logs: []
  };

  // Logging
  function logEvent(msg, type = 'info') {
    if (!state.security.audit && type !== 'system') return; // only log if auditing enabled (except for system messages)
    const entry = { 
      t: Date.now(), 
      msg,
      type,
      id: Date.now() + Math.random().toString(36).substr(2, 9) // Unique ID for each log entry
    };
    
    state.logs.unshift(entry);
    if (state.logs.length > 200) state.logs.pop();
    saveLS(KEYS.logs, state.logs);
    
    // Render logs and highlight the new entry
    renderLogs(entry.id);
  }

  // Load persisted settings
  function load(){
    state.role = readLS(KEYS.role, state.role);
    state.modules = readLS(KEYS.modules, state.modules);
    state.map = readLS(KEYS.map, state.map);
    state.security = readLS(KEYS.security, state.security);
    state.logs = readLS(KEYS.logs, state.logs);
  }

  // Render form from state
  function render(){
    // Role radios
    byName('role').forEach(r => r.checked = (r.value === state.role));
    // Modules
    const modTourism = $('#modTourism'); if (modTourism) modTourism.checked = !!state.modules.tourism;
    const modRide = $('#modRide'); if (modRide) modRide.checked = !!state.modules.ride;
    const modWSI = $('#modWSI'); if (modWSI) modWSI.checked = !!state.modules.wsi;
    // Map
    const mapProvider = $('#mapProvider'); if (mapProvider) mapProvider.value = state.map.provider;
    const mapApiKey = $('#mapApiKey'); if (mapApiKey) mapApiKey.value = state.map.apiKey || '';
    // Security
    const enc = $('#encryptToggle'); if (enc) enc.checked = !!state.security.encrypt;
    const aud = $('#auditToggle'); if (aud) aud.checked = !!state.security.audit;
    renderLogs();
  }

  // Save all (pull from form first)
  function saveAll(){
    const chosen = byName('role').find(r => r.checked);
    if (chosen) state.role = chosen.value;

    const modTourism = $('#modTourism'); if (modTourism) state.modules.tourism = modTourism.checked;
    const modRide = $('#modRide'); if (modRide) state.modules.ride = modRide.checked;
    const modWSI = $('#modWSI'); if (modWSI) state.modules.wsi = modWSI.checked;

    const mapProvider = $('#mapProvider'); if (mapProvider) state.map.provider = mapProvider.value;
    const mapApiKey = $('#mapApiKey'); if (mapApiKey) state.map.apiKey = (mapApiKey.value || '').trim();

    const enc = $('#encryptToggle'); if (enc) state.security.encrypt = enc.checked;
    const aud = $('#auditToggle'); if (aud) state.security.audit = aud.checked;

    saveLS(KEYS.role, state.role);
    saveLS(KEYS.modules, state.modules);
    saveLS(KEYS.map, state.map);
    saveLS(KEYS.security, state.security);
    saveLS(KEYS.logs, state.logs);
  }

  // Reset all to defaults
  function resetAll(){
    if (!confirm('Are you sure you want to reset all settings to default values?')) {
      logEvent('Reset operation cancelled', 'warning');
      return;
    }
    
    state.role = 'operator';
    state.modules = { tourism: false, ride: true, wsi: true };
    state.map = { provider: 'osm', apiKey: '' };
    state.security = { encrypt: false, audit: true };
    
    // Keep the logs but add a system message
    logEvent('All settings have been reset to default values', 'system');
    
    saveAll();
    render();
  }

  // Render access logs
  function renderLogs(highlightId = null) {
    const ul = $('#logList');
    if (!ul) return;
    
    // Show message if no logs
    if (state.logs.length === 0) {
      ul.innerHTML = '<li class="no-logs">No log entries found</li>';
      return;
    }
    
    // Store scroll position
    const wasScrolledToBottom = ul.scrollHeight - ul.scrollTop - ul.clientHeight < 50;
    
    ul.innerHTML = '';
    state.logs.forEach(entry => {
      const li = document.createElement('li');
      li.className = `log-entry ${entry.type || 'info'}`;
      li.dataset.id = entry.id;
      
      // Add highlight class if this is the new entry
      if (entry.id === highlightId) {
        li.classList.add('highlight');
      }
      
      const left = document.createElement('div'); 
      left.className = 'log-message';
      left.textContent = entry.msg;
      
      const right = document.createElement('div'); 
      right.className = 'log-time';
      right.textContent = new Date(entry.t).toLocaleString();
      
      // Add context menu for log entries
      li.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        // You could add a context menu here if needed
      });
      
      li.appendChild(left); 
      li.appendChild(right);
      ul.appendChild(li);
    });
    
    // Restore scroll position or scroll to bottom if was at bottom
    if (wasScrolledToBottom) {
      ul.scrollTop = ul.scrollHeight;
    }
  }

  // Generate a random IP address for demo purposes
  function getRandomIP() {
    return Array(4).fill(0).map(() => Math.floor(Math.random() * 255)).join('.');
  }

  // Generate a random user agent for demo purposes
  function getRandomUserAgent() {
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Mobile/15E148 Safari/604.1',
      'Mozilla/5.0 (Linux; Android 10; SM-G981B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.162 Mobile Safari/537.36'
    ];
    return userAgents[Math.floor(Math.random() * userAgents.length)];
  }

  // Generate a realistic log entry
  function generateTestLog() {
    const actions = [
      { type: 'info', msg: 'User logged in from IP: ' + getRandomIP() },
      { type: 'info', msg: 'Settings updated successfully' },
      { type: 'warning', msg: 'Failed login attempt from IP: ' + getRandomIP() },
      { type: 'success', msg: 'Backup completed successfully' },
      { type: 'error', msg: 'Connection timeout to database server' },
      { type: 'info', msg: 'User agent detected: ' + getRandomUserAgent() },
      { type: 'warning', msg: 'High memory usage detected' },
      { type: 'success', msg: 'Data synchronized with cloud storage' }
    ];
    
    return actions[Math.floor(Math.random() * actions.length)];
  }

  // Bind interactions
  function bind(){
    // Save / Reset
    on($('#saveBtn'), 'click', () => { 
      saveAll(); 
      logEvent('Settings saved successfully', 'success');
      
      // Show a temporary success message
      const btn = $('#saveBtn');
      const originalText = btn.textContent;
      btn.textContent = '✓ Saved!';
      btn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
      
      setTimeout(() => {
        btn.textContent = originalText;
        btn.style.background = 'linear-gradient(135deg,#0f5132,#14532d,#10b981)';
      }, 2000);
    });
    
    on($('#resetBtn'), 'click', () => { resetAll(); });

    // Add/Clear logs
    on($('#addLog'), 'click', () => { 
      const log = generateTestLog();
      logEvent(log.msg, log.type);
    });
    
    // Add multiple test logs at once
    on($('#addLog'), 'dblclick', (e) => {
      e.preventDefault();
      for (let i = 0; i < 5; i++) {
        setTimeout(() => {
          const log = generateTestLog();
          logEvent(log.msg, log.type);
        }, i * 100);
      }
    });
    
    // Clear logs with confirmation
    on($('#clearLog'), 'click', () => { 
      if (state.logs.length === 0) {
        logEvent('Log is already empty', 'warning');
        return;
      }
      
      if (confirm('Are you sure you want to clear all log entries? This action cannot be undone.')) {
        state.logs = []; 
        saveLS(KEYS.logs, state.logs); 
        renderLogs();
        logEvent('Log entries cleared by user', 'system');
      }
    });

    // Role changes
    byName('role').forEach(r => on(r, 'change', () => { if (r.checked) { state.role = r.value; saveLS(KEYS.role, state.role); logEvent(`Role changed to ${state.role}`); } }));

    // Module toggles
    on($('#modTourism'), 'change', (e)=>{ state.modules.tourism = e.target.checked; saveLS(KEYS.modules, state.modules); logEvent(`Tourism Safety Mode ${e.target.checked? 'enabled' : 'disabled'}`); });
    on($('#modRide'), 'change', (e)=>{ state.modules.ride = e.target.checked; saveLS(KEYS.modules, state.modules); logEvent(`Ride-Monitoring ${e.target.checked? 'enabled' : 'disabled'}`); });
    on($('#modWSI'), 'change', (e)=>{ state.modules.wsi = e.target.checked; saveLS(KEYS.modules, state.modules); logEvent(`WSI ${e.target.checked? 'enabled' : 'disabled'}`); });

    // Map provider/key
    on($('#mapProvider'), 'change', (e)=>{ state.map.provider = e.target.value; saveLS(KEYS.map, state.map); logEvent(`Map provider set to ${state.map.provider}`); });
    on($('#mapApiKey'), 'input', (e)=>{ state.map.apiKey = e.target.value; saveLS(KEYS.map, state.map); });

    // Security toggles
    on($('#encryptToggle'), 'change', (e)=>{ state.security.encrypt = e.target.checked; saveLS(KEYS.security, state.security); logEvent(`Encryption ${e.target.checked? 'enabled' : 'disabled'}`); });
    on($('#auditToggle'), 'change', (e)=>{ state.security.audit = e.target.checked; saveLS(KEYS.security, state.security); logEvent(`Audit logging ${e.target.checked? 'enabled' : 'disabled'}`); });
  }

  function init(){
    load();
    render();
    bind();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }
})();
