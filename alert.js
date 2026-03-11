(function(){
  'use strict';

  const $ = (id) => document.getElementById(id);
  const CSV_FILE = 'dataset.csv';
  
  let currentAlerts = [];
  let selectedAlert = null;
  let callTypeChart;
  
  // Parse CSV data
  function parseCSV(csvText) {
    const lines = csvText.split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    const result = [];
    
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      
      const values = [];
      let inQuotes = false;
      let currentValue = '';
      
      for (let char of lines[i]) {
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(currentValue.trim());
          currentValue = '';
        } else {
          currentValue += char;
        }
      }
      values.push(currentValue.trim());
      
      if (values.length === headers.length) {
        const obj = {};
        headers.forEach((header, index) => {
          obj[header] = values[index];
        });
        result.push(obj);
      }
    }
    
    return result;
  }
  
  // Classify call type based on event information
  function classifyCall(eventInfo) {
    if (!eventInfo) return 'prank';
    
    const info = eventInfo.toLowerCase();
    
    // Check for panic indicators
    const panicKeywords = ['emergency', 'help', 'urgent', 'accident', 'assault', 'robbery', 'theft', 'attack', 'violence'];
    if (panicKeywords.some(keyword => info.includes(keyword))) {
      return 'panic';
    }
    
    // Check for silence (no information)
    if (!info.trim() || info === 'na' || info === 'null' || info === 'none') {
      return 'silence';
    }
    
    // Default to prank
    return 'prank';
  }
  
  // Calculate urgency score (0-100)
  function calculateUrgency(callType, eventInfo) {
    let score = 50; // Base score
    
    // Adjust based on call type
    if (callType === 'panic') score += 40;
    else if (callType === 'silence') score += 20;
    
    // Adjust based on keywords
    if (eventInfo) {
      const info = eventInfo.toLowerCase();
      if (info.includes('emergency') || info.includes('accident') || info.includes('assault')) {
        score += 20;
      } else if (info.includes('fight') || info.includes('theft') || info.includes('robbery')) {
        score += 15;
      }
    }
    
    // Ensure score is between 0-100
    return Math.min(100, Math.max(0, Math.round(score)));
  }

  // Fetch and process alerts from CSV
  async function fetchAlerts() {
    try {
      const response = await fetch(CSV_FILE);
      const csvText = await response.text();
      const csvData = parseCSV(csvText);
      
      // Process CSV data into alert format
      currentAlerts = csvData.map((row, index) => {
        const callType = classifyCall(row.EVENT_INFORMATION);
        const urgency = calculateUrgency(callType, row.EVENT_INFORMATION);
        const location = row.POLICE_STATION || row.Police_Station_Name || row.Police_Station || 'Unknown Location';
        const timestamp = row.CREATE_TIME || new Date().toISOString();
        
        // Generate a summary from the event information
        let summary = row.EVENT_INFORMATION || 'No details available';
        if (summary.length > 80) {
          summary = summary.substring(0, 80) + '...';
        }
        
        // Create transcript from available data
        let transcript = '';
        if (row.EVENT_INFORMATION) {
          transcript = `Caller reported: ${row.EVENT_INFORMATION}`;
          if (row.ACTION_TAKEN_AT_DCC) {
            transcript += `\n\nAction taken: ${row.ACTION_TAKEN_AT_DCC}`;
          }
        }
        
        // Create notes from available data
        let notes = [];
        if (row.CALLER_NAME && row.CALLER_NAME !== '100') {
          notes.push(`Caller: ${row.CALLER_NAME}`);
        }
        if (row.EVENT_MAIN_TYPE) {
          notes.push(`Incident Type: ${row.EVENT_MAIN_TYPE}`);
        }
        if (row.RESPONSE_TIME) {
          notes.push(`Response Time: ${row.RESPONSE_TIME}`);
        }
        
        return {
          id: `C-${10000 + index}`,
          type: callType,
          summary: summary,
          urgency: urgency,
          transcript: transcript,
          location: location,
          timestamp: timestamp,
          notes: notes.join('\n'),
          response_outcome: row.CLOSURE_COMMENTS || 'Pending review',
          caller_phone: row.DIALLED_NO || 'Unknown',
          classification: callType.charAt(0).toUpperCase() + callType.slice(1) + ' call',
          rawData: row // Store raw data for reference
        };
      });
      
      // Sort by urgency (highest first)
      return currentAlerts.sort((a, b) => b.urgency - a.urgency);
      
    } catch (error) {
      console.error('Failed to fetch or process CSV data:', error);
      return getFallbackData();
    }
  }
  
  // Fallback data if CSV loading fails
  function getFallbackData() {
    return [
      { 
        id: 'C-0001', 
        type: 'panic', 
        summary: 'Error loading data. Using sample data.', 
        urgency: 100, 
        transcript: 'There was an error loading the alert data. Please check the console for details and ensure the CSV file is accessible.', 
        location: 'System',
        notes: 'Failed to load CSV data. Using fallback data instead.',
        response_outcome: 'System Error',
        caller_phone: 'N/A',
        classification: 'System Alert'
      }
    ];
  }

  function badge(type){
    return type === 'panic' ? 'badge panic' : type === 'silence' ? 'badge silence' : 'badge prank';
  }

  function renderQueue(list){
    const ul = $('queueList');
    if (!ul) return;
    
    ul.innerHTML = '';
    list.forEach((item, index) => {
      const li = document.createElement('li');
      li.className = 'queue-item';
      li.dataset.alertId = item.id;
      
      const left = document.createElement('div');
      left.className = 'queue-item-content';
      left.innerHTML = `<strong>${item.id}</strong> — ${item.summary}`;
      
      const right = document.createElement('div');
      right.className = 'queue-item-meta';
      right.innerHTML = `<span class="${badge(item.type)}">${item.type}</span> <span class="urgency">${item.urgency}</span>`;
      
      li.appendChild(left);
      li.appendChild(right);
      
      // Make item clickable
      li.addEventListener('click', () => {
        // Remove previous selection
        document.querySelectorAll('.queue-item').forEach(el => el.classList.remove('selected'));
        // Add selection to current item
        li.classList.add('selected');
        // Render details
        renderDetail(item);
        selectedAlert = item;
      });
      
      // Auto-select first item if none selected
      if (index === 0 && !selectedAlert) {
        li.classList.add('selected');
        selectedAlert = item;
        setTimeout(() => renderDetail(item), 100);
      }
      
      ul.appendChild(li);
    });
  }

  function renderDetail(item){
    const wrap = $('detailWrap');
    if (!wrap) return;
    
    wrap.innerHTML = '';

    // Title with call ID, type, and urgency
    const h = document.createElement('div');
    h.className = 'title';
    h.textContent = `${item.id} • ${item.type.toUpperCase()} • Urgency ${item.urgency}`;

    // Caller transcript
    const transcript = document.createElement('div');
    transcript.className = 'note';
    const transcriptText = item.transcript || mockTranscript(item.type);
    transcript.innerHTML = `<strong>Caller transcript (auto):</strong><br>${transcriptText}`;

    // Sentiment analysis
    const sentiment = document.createElement('div');
    const sClass = item.type === 'panic' ? 'panic' : item.type === 'silence' ? 'distress' : 'calm';
    const sText = item.sentiment || (item.type === 'panic' ? 'panic' : item.type === 'silence' ? 'distress' : 'calm');
    sentiment.className = `sentiment ${sClass}`;
    sentiment.textContent = `Sentiment: ${sText}`;

    // Location and timestamp info
    const locationInfo = document.createElement('div');
    locationInfo.className = 'note';
    const timestamp = item.timestamp ? new Date(item.timestamp).toLocaleString() : 'Unknown';
    locationInfo.innerHTML = `<strong>Location:</strong> ${item.location || 'Unknown'}<br><strong>Time:</strong> ${timestamp}`;

    // Officer notes
    const notes = document.createElement('div');
    notes.className = 'note';
    const notesText = item.notes || '- Initial assessment recorded<br>- GPS ping requested<br>- Unit notified for welfare check';
    notes.innerHTML = `<strong>Officer notes:</strong><br>${notesText}`;

    // Response outcome
    const outcome = document.createElement('div');
    outcome.className = 'note';
    const outcomeText = item.response_outcome || 'Pending escalation review.';
    outcome.innerHTML = `<strong>Response outcome:</strong><br>${outcomeText}`;

    // Additional call details if available
    if (item.caller_phone || item.duration) {
      const callDetails = document.createElement('div');
      callDetails.className = 'note';
      let detailsHtml = '<strong>Call Details:</strong><br>';
      if (item.caller_phone) detailsHtml += `- Phone: ${item.caller_phone}<br>`;
      if (item.duration) detailsHtml += `- Duration: ${item.duration}s<br>`;
      if (item.classification) detailsHtml += `- AI Classification: ${item.classification}<br>`;
      callDetails.innerHTML = detailsHtml;
      wrap.appendChild(callDetails);
    }

    wrap.appendChild(h);
    wrap.appendChild(transcript);
    wrap.appendChild(sentiment);
    wrap.appendChild(locationInfo);
    wrap.appendChild(notes);
    wrap.appendChild(outcome);
  }

  function mockTranscript(type){
    if (type === 'panic') return 'Caller sounds distressed, mentions location and fear. Background shouting audible.';
    if (type === 'silence') return 'Open line with ambient noise, no response to call-back prompts. Possible coercion or accidental dial.';
    return 'Call flagged as non-serious: inconsistent story and laughter in the background. Marked as prank-filtered.';
  }

  // Simple charts for anomalies (bar charts)
  function barChart(canvas, values, colorTop, colorBottom){
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0,0,W,H);
    const pad = 28; const w = (W - pad*2) / values.length; const max = Math.max(...values, 1);
    ctx.strokeStyle = '#9ca3af'; ctx.beginPath(); ctx.moveTo(pad, pad/2); ctx.lineTo(pad, H-pad); ctx.lineTo(W-pad/2, H-pad); ctx.stroke();
    values.forEach((v,i)=>{
      const x = pad + i*w + w*0.15; const h = v/max*(H-pad*2); const y = (H-pad)-h;
      const g = ctx.createLinearGradient(0,y,0,y+h); g.addColorStop(0,colorTop); g.addColorStop(1,colorBottom);
      ctx.fillStyle = g; ctx.fillRect(x, y, w*0.7, h);
    });
  }
  
  // Initialize pie chart for call type distribution
  function initPieChart(stats) {
    const ctx = document.getElementById('callTypeChart')?.getContext('2d');
    if (!ctx) return;
    
    // Destroy previous chart instance if it exists
    if (callTypeChart) {
      callTypeChart.destroy();
    }
    
    const data = {
      labels: ['Panic', 'Suspicious Silence', 'Prank'],
      datasets: [{
        data: [
          stats.callCounts.panic || 0,
          stats.callCounts.silence || 0,
          stats.callCounts.prank || 0
        ],
        backgroundColor: [
          'rgba(239, 68, 68, 0.7)',  // Red for panic
          'rgba(245, 158, 11, 0.7)', // Yellow for silence
          'rgba(156, 163, 175, 0.7)' // Gray for prank
        ],
        borderColor: [
          'rgba(239, 68, 68, 1)',
          'rgba(245, 158, 11, 1)',
          'rgba(156, 163, 175, 1)'
        ],
        borderWidth: 1
      }]
    };
    
    callTypeChart = new Chart(ctx, {
      type: 'pie',
      data: data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              padding: 15,
              usePointStyle: true,
              pointStyle: 'circle',
              font: {
                family: 'Inter, sans-serif',
                size: 12
              }
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const label = context.label || '';
                const value = context.raw || 0;
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const percentage = Math.round((value / total) * 100) || 0;
                return `${label}: ${value} (${percentage}%)`;
              }
            }
          }
        }
      }
    });
  }

  // Initialize daily pattern chart
  function initDailyPatternChart(stats) {
    console.log('Initializing daily pattern chart with stats:', stats);
    
    const canvas = document.getElementById('dailyPatternChart');
    if (!canvas) {
      console.error('Could not find dailyPatternChart canvas element');
      return;
    }
    
    // Ensure canvas has proper dimensions
    const container = canvas.parentElement;
    if (container) {
      container.style.position = 'relative';
      container.style.height = '300px';  // Set a fixed height for the chart container
    }
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('Could not get 2D context for canvas');
      return;
    }
    
    // Destroy previous chart instance if it exists
    if (window.dailyPatternChart) {
      console.log('Destroying previous chart instance');
      window.dailyPatternChart.destroy();
    }
    
    // Check if we have valid data
    if (!stats || !stats.dailyCounts || !Array.isArray(stats.dailyCounts)) {
      console.error('Invalid or missing dailyCounts in stats:', stats);
      return;
    }
    
    // Prepare data for chart
    const labels = stats.dailyCounts.map(item => item.day || 'Unknown');
    const data = stats.dailyCounts.map(item => item.count || 0);
    
    // If all counts are zero, show a single slice with a message
    const totalCalls = data.reduce((sum, count) => sum + count, 0);
    if (totalCalls === 0) {
      labels.length = 0;
      data.length = 0;
      labels.push('No calls');
      data.push(1); // Single slice
    }
    
    console.log('Chart data - Labels:', labels);
    console.log('Chart data - Values:', data);
    
    // Generate colors for the chart
    const backgroundColors = [
      'rgba(16, 185, 129, 0.7)',  // Green
      'rgba(59, 130, 246, 0.7)',  // Blue
      'rgba(245, 158, 11, 0.7)',  // Yellow
      'rgba(139, 92, 246, 0.7)',  // Purple
      'rgba(20, 184, 166, 0.7)',  // Teal
      'rgba(249, 115, 22, 0.7)',  // Orange
      'rgba(236, 72, 153, 0.7)'   // Pink
    ].slice(0, Math.max(labels.length, 1));  // Ensure we have enough colors
    
    try {
      window.dailyPatternChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: labels,
          datasets: [{
            data: data,
            backgroundColor: backgroundColors,
            borderColor: backgroundColors.map(color => color.replace('0.7', '1')),
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          aspectRatio: 1.5,
          cutout: '70%',
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                padding: 15,
                usePointStyle: true,
                pointStyle: 'circle',
                font: {
                  family: 'Inter, sans-serif',
                  size: 12
                }
              }
            },
            tooltip: {
              callbacks: {
                label: function(context) {
                  const label = context.label || '';
                  const value = context.raw || 0;
                  const total = context.dataset.data.reduce((a, b) => a + b, 0);
                  const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
                  return `${label}: ${value} calls (${percentage}%)`;
                }
              }
            },
            // Add title
            title: {
              display: true,
              text: 'Calls by Day of Week',
              font: {
                size: 14,
                weight: 'bold'
              },
              padding: {
                top: 10,
                bottom: 10
              }
            }
          },
          // Hide labels when they're too small
          elements: {
            arc: {
              borderWidth: 0
            }
          }
        }
      });
      
      console.log('Daily pattern chart initialized successfully');
    } catch (error) {
      console.error('Error initializing daily pattern chart:', error);
    }
  }
  
  // Render top locations
  function renderTopLocations(locations) {
    const container = document.getElementById('locationsList');
    if (!container) return;
    
    if (!locations || locations.length === 0) {
      container.innerHTML = '<div class="no-data">No location data available</div>';
      return;
    }
    
    container.innerHTML = locations.map((loc, index) => `
      <div class="location-item">
        <div class="location-header">
          <span class="location-rank">${index + 1}</span>
          <div class="location-info">
            <div class="location-name">${loc.name}</div>
            <div class="location-count">${loc.count} calls</div>
          </div>
        </div>
        <div class="location-stats">
          <div class="stat-bar" style="width: 100%; background: #3b82f6"></div>
        </div>
      </div>
    `).join('');
  }

  // Generate statistics for the dashboard
  async function fetchStats() {
    try {
      const alerts = await fetchAlerts();
      
      // Count calls by type
      const callCounts = {
        panic: alerts.filter(a => a.type === 'panic').length,
        silence: alerts.filter(a => a.type === 'silence').length,
        prank: alerts.filter(a => a.type === 'prank').length,
        total: alerts.length
      };
      
      // Get calls by location with type details
      const locationCounts = {};
      alerts.forEach(alert => {
        const loc = alert.location || 'Unknown';
        if (!locationCounts[loc]) {
          locationCounts[loc] = { total: 0 };
        }
        locationCounts[loc].total++;
      });
      
      // Get calls by hour (for daily pattern)
      const hourlyCounts = Array(24).fill(0);
      alerts.forEach(alert => {
        try {
          const date = new Date(alert.timestamp || new Date());
          const hour = date.getHours();
          hourlyCounts[hour]++;
        } catch (e) {
          console.error('Error processing timestamp:', alert.timestamp, e);
        }
      });
      
      // Get calls by day (for weekly pattern)
      const dailyCounts = Array(7).fill(0);
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      alerts.forEach(alert => {
        try {
          const date = new Date(alert.timestamp || new Date());
          const day = date.getDay();
          dailyCounts[day]++;
        } catch (e) {
          console.error('Error processing timestamp:', alert.timestamp, e);
        }
      });
      
      // Process top locations
      const topLocations = Object.entries(locationCounts)
        .sort((a, b) => b[1].total - a[1].total)
        .slice(0, 5)
        .map(([name, counts]) => ({
          name,
          count: counts.total
        }));
      
      return {
        success: true,
        callCounts,
        hourlyCounts,
        dailyCounts: dailyCounts.map((count, index) => ({
          day: dayNames[index],
          count
        })),
        topLocations,
        totalCalls: alerts.length,
        lastUpdated: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('Error generating statistics:', error);
      return {
        success: false,
        error: error.message,
        callCounts: { panic: 0, silence: 0, prank: 0, total: 0 },
        hourlyCounts: Array(24).fill(0),
        dailyCounts: Array(7).fill(0).map((_, i) => ({
          day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][i],
          count: 0
        })),
        topLocations: [],
        totalCalls: 0
      };
    }
  }

  // Filter alerts based on category
  function filterAlerts(category) {
    if (category === 'all') {
      return currentAlerts;
    }
    return currentAlerts.filter(alert => alert.type === category);
  }

  // Main update function
  async function update(){
    try {
      // Show loading state
      const queueList = $('queueList');
      if (queueList) {
        queueList.innerHTML = '<li style="text-align:center;padding:20px;color:#6b7280;">🤖 Loading AI-sorted alerts...</li>';
      }

      // Fetch real alerts from API
      const alerts = await fetchAlerts();
      
      // Apply current filter
      const category = $('alertCategory')?.value || 'all';
      const filteredAlerts = filterAlerts(category);
      
      // Render the queue and auto-select first item
      renderQueue(filteredAlerts);

      // Fetch and render statistics
      const stats = await fetchStats();
      if (stats) {
        // Initialize or update charts
        initPieChart(stats);
        initDailyPatternChart(stats);
        
        // Update top locations
        renderTopLocations(stats.topLocations);
        
        // Update bar charts if they exist
        if ($('prankChart')) {
          barChart($('prankChart'), stats.hourlyCounts || Array(24).fill(0), '#10b981', '#14532d');
        }
        
        // Update call count display
        const callCountDisplay = document.getElementById('callCountDisplay');
        if (callCountDisplay) {
          callCountDisplay.innerHTML = `
            <div class="stat-item">
              <div class="stat-value">${stats.callCounts.total || 0}</div>
              <div class="stat-label">Total Calls</div>
            </div>
            <div class="stat-item">
              <div class="stat-value" style="color: #ef4444">${stats.callCounts.panic || 0}</div>
              <div class="stat-label">Panic</div>
            </div>
            <div class="stat-item">
              <div class="stat-value" style="color: #f59e0b">${stats.callCounts.silence || 0}</div>
              <div class="stat-label">Suspicious Silence</div>
            </div>
            <div class="stat-item">
              <div class="stat-value" style="color: #9ca3af">${stats.callCounts.prank || 0}</div>
              <div class="stat-label">Prank Filtered</div>
            </div>
          `;
        }
      } else {
        // Fallback stats
        const prankVals = Array.from({length:7},()=> Math.floor(Math.random() * 19) + 2);
        const spikeVals = Array.from({length:7},()=> Math.floor(Math.random() * 41) + 10);
        if ($('prankChart')) barChart($('prankChart'), prankVals, '#10b981', '#14532d');
        if ($('spikeChart')) barChart($('spikeChart'), spikeVals, '#3b82f6', '#1d4ed8');
      }

      console.log(`✅ Loaded ${alerts.length} AI-sorted alerts`);
      
    } catch (error) {
      console.error('Update failed:', error);
      
      // Show error state
      const queueList = $('queueList');
      if (queueList) {
        queueList.innerHTML = '<li style="text-align:center;padding:20px;color:#dc2626;">❌ Failed to load alerts. Using fallback data.</li>';
      }
      
      // Use fallback data
      const fallbackAlerts = getFallbackData();
      renderQueue(fallbackAlerts);
    }
  }

  function init(){
    console.log('🚨 Initializing AI-powered Alerts & Anomaly Detection...');
    
    // Event listeners
    $('refreshAlerts')?.addEventListener('click', update);
    
    // Category filter
    $('alertCategory')?.addEventListener('change', (e) => {
      const category = e.target.value;
      const filteredAlerts = filterAlerts(category);
      renderQueue(filteredAlerts);
      console.log(`🔍 Filtered alerts by category: ${category}`);
    });
    
    // Add Chart.js if not already loaded
    if (typeof Chart === 'undefined') {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
      script.onload = update;
      document.head.appendChild(script);
    } else {
      update();
    }
  }

  // Initialize the app when the DOM is fully loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // DOMContentLoaded already fired, initialize immediately
    init();
  }
})();
