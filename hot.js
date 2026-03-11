(function(){
  'use strict';

  const $ = (id) => document.getElementById(id);
  const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

  // Enhanced Goa locations with detailed coordinates and zone definitions
  const GOA_AREAS = [
    { 
      name: 'Panaji', 
      lat: 15.4909, 
      lng: 73.8278,
      type: 'city',
      radius: 2000, // 2km radius for circle zones
      polygon: [ // Custom boundary for polygon zones
        [15.5050, 73.8150],
        [15.5050, 73.8400],
        [15.4750, 73.8400],
        [15.4750, 73.8150]
      ]
    },
    { 
      name: 'Margao', 
      lat: 15.2993, 
      lng: 74.1240,
      type: 'city',
      radius: 2500,
      polygon: [
        [15.3150, 74.1100],
        [15.3150, 74.1380],
        [15.2830, 74.1380],
        [15.2830, 74.1100]
      ]
    },
    { 
      name: 'Vasco da Gama', 
      lat: 15.3960, 
      lng: 73.8157,
      type: 'port',
      radius: 1800,
      polygon: [
        [15.4100, 73.8000],
        [15.4100, 73.8300],
        [15.3820, 73.8300],
        [15.3820, 73.8000]
      ]
    },
    { 
      name: 'Mapusa', 
      lat: 15.5937, 
      lng: 73.8070,
      type: 'town',
      radius: 1500,
      polygon: [
        [15.6050, 73.7950],
        [15.6050, 73.8190],
        [15.5820, 73.8190],
        [15.5820, 73.7950]
      ]
    },
    { 
      name: 'Calangute', 
      lat: 15.5394, 
      lng: 73.7554,
      type: 'beach',
      radius: 1200,
      polygon: [
        [15.5500, 73.7450],
        [15.5500, 73.7650],
        [15.5280, 73.7650],
        [15.5280, 73.7450]
      ]
    },
    { 
      name: 'Anjuna', 
      lat: 15.5732, 
      lng: 73.7407,
      type: 'beach',
      radius: 1000,
      polygon: [
        [15.5850, 73.7300],
        [15.5850, 73.7500],
        [15.5610, 73.7500],
        [15.5610, 73.7300]
      ]
    },
    { 
      name: 'Baga', 
      lat: 15.5559, 
      lng: 73.7516,
      type: 'beach',
      radius: 800,
      polygon: [
        [15.5650, 73.7400],
        [15.5650, 73.7630],
        [15.5460, 73.7630],
        [15.5460, 73.7400]
      ]
    },
    { 
      name: 'Ponda', 
      lat: 15.4013, 
      lng: 74.0071,
      type: 'town',
      radius: 2000,
      polygon: [
        [15.4150, 73.9950],
        [15.4150, 74.0190],
        [15.3870, 74.0190],
        [15.3870, 73.9950]
      ]
    },
    { 
      name: 'Colva', 
      lat: 15.2798, 
      lng: 73.9114,
      type: 'beach',
      radius: 1500,
      polygon: [
        [15.2900, 73.9000],
        [15.2900, 73.9230],
        [15.2690, 73.9230],
        [15.2690, 73.9000]
      ]
    },
    { 
      name: 'Candolim', 
      lat: 15.5167, 
      lng: 73.7619,
      type: 'beach',
      radius: 1000,
      polygon: [
        [15.5250, 73.7500],
        [15.5250, 73.7740],
        [15.5080, 73.7740],
        [15.5080, 73.7500]
      ]
    }
  ];

  let goaHeatmap = null;
  let heatLayer = null;
  let redZoneCircles = []; // Track circle red zones
  let redZonePolygons = []; // Track polygon red zones
  let areaMarkers = []; // Track area markers

  // Initialize Leaflet Map with Heatmap
  function initializeHeatmap() {
    const container = $('heatmapContainer');
    if (!container) return;
    
    // Create map centered on Goa
    goaHeatmap = L.map('heatmapContainer').setView([15.4909, 73.8278], 10);
    
    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(goaHeatmap);
    
    // Add enhanced area markers with zone information
    addAreaMarkers();
  }

  // Add area markers with enhanced information
  function addAreaMarkers() {
    // Clear existing markers
    areaMarkers.forEach(marker => goaHeatmap.removeLayer(marker));
    areaMarkers = [];

    GOA_AREAS.forEach(area => {
      // Create custom icon based on area type
      const iconHtml = getAreaIcon(area.type);
      const customIcon = L.divIcon({
        html: iconHtml,
        className: 'custom-area-icon',
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      });

      const marker = L.marker([area.lat, area.lng], { icon: customIcon })
        .addTo(goaHeatmap)
        .bindPopup(`
          <div class="area-popup">
            <h4>${area.name}</h4>
            <p><strong>Type:</strong> ${area.type}</p>
            <p><strong>Zone Radius:</strong> ${area.radius}m</p>
            <button onclick="showCircleZone('${area.name}')">Show Circle Zone</button>
            <button onclick="showPolygonZone('${area.name}')">Show Polygon Zone</button>
          </div>
        `);
      
      areaMarkers.push(marker);
    });
  }

  // Get icon HTML based on area type
  function getAreaIcon(type) {
    const iconMap = {
      'city': '🏙️',
      'town': '🏘️',
      'beach': '🏖️',
      'port': '⚓'
    };
    return `<div style="font-size: 20px; text-align: center;">${iconMap[type] || '📍'}</div>`;
  }

  // Fetch real heatmap data from CSV-based API
  async function fetchHeatmapData(category, days) {
    try {
      const response = await fetch(`/api/heatmap?category=${category}&days=${days}`);
      const data = await response.json();
      
      if (data.success) {
        return {
          heatPoints: data.heatmapPoints,
          hotspots: data.topHotspots,
          alerts: data.recentAlerts,
          totalIncidents: data.totalIncidents
        };
      } else {
        throw new Error(data.error || 'Failed to fetch heatmap data');
      }
    } catch (error) {
      console.error('Error fetching heatmap data:', error);
      // Fallback to mock data if API fails
      return generateMockHeatmapData(category, days);
    }
  }

  // Fallback mock data generation
  function generateMockHeatmapData(category, days) {
    const heatPoints = [];
    const intensity = days === 7 ? 0.8 : days === 14 ? 0.6 : 0.4;
    
    GOA_AREAS.forEach(area => {
      let incidentCount = 0;
      
      switch(category) {
        case 'women':
          incidentCount = rand(8, 15);
          break;
        case 'accident':
          incidentCount = rand(5, 12);
          break;
        case 'crime':
          incidentCount = rand(3, 10);
          break;
      }
      
      for (let i = 0; i < incidentCount; i++) {
        const lat = area.lat + (Math.random() - 0.5) * 0.03;
        const lng = area.lng + (Math.random() - 0.5) * 0.03;
        const weight = Math.random() * intensity + 0.2;
        
        heatPoints.push([lat, lng, weight]);
      }
    });
    
    return {
      heatPoints,
      hotspots: [],
      alerts: [],
      totalIncidents: heatPoints.length
    };
  }

  // Update heatmap based on filters
  async function updateHeatmap() {
    if (!goaHeatmap) return;
    
    const category = $('hsCategory').value;
    const range = parseInt($('hsRange').value, 10);
    
    // Show loading state
    const container = $('heatmapContainer');
    if (container) {
      container.style.opacity = '0.6';
    }
    
    try {
      // Remove existing heat layer
      if (heatLayer) {
        goaHeatmap.removeLayer(heatLayer);
      }
      
      // Fetch real heatmap data
      const heatmapData = await fetchHeatmapData(category, range);
      
      // Create heat layer with real data
      if (heatmapData.heatPoints.length > 0) {
        heatLayer = L.heatLayer(heatmapData.heatPoints, {
          radius: 25,
          blur: 15,
          maxZoom: 17,
          gradient: {
            0.0: '#fee2e2',
            0.2: '#fecaca', 
            0.4: '#f87171',
            0.6: '#ef4444',
            0.8: '#dc2626',
            1.0: '#991b1b'
          }
        }).addTo(goaHeatmap);
      }
      
      // Update alerts with real data
      if (heatmapData.alerts.length > 0) {
        renderRealAlerts($('alertList'), heatmapData.alerts);
      } else {
        renderAlerts($('alertList')); // Fallback to mock alerts
      }
      
      // Update incident count display
      updateIncidentCount(heatmapData.totalIncidents, category, range);
      
      // Create data-driven red zones based on hotspot data
      createDataDrivenRedZones(heatmapData);
      
      // If no specific category is selected, show all category zones
      if (category === 'women' || category === 'accident' || category === 'crime') {
        // Show category-specific zones when a category is selected
        setTimeout(() => createCategoryBasedZones(), 1000);
      }
      
    } catch (error) {
      console.error('Error updating heatmap:', error);
    } finally {
      // Remove loading state
      if (container) {
        container.style.opacity = '1';
      }
    }
  }

  // Fetch real WSI data from CSV with dynamic range
  async function fetchWSIData(days = 30) {
    try {
      const response = await fetch(`/api/wsi?days=${days}`);
      const data = await response.json();
      
      if (data.success) {
        return data.wsiData;
      } else {
        throw new Error(data.error || 'Failed to fetch WSI data');
      }
    } catch (error) {
      console.error('Error fetching WSI data:', error);
      return null;
    }
  }

  // WSI grid rendering with real CSV data
  function renderWSIGrid(container, wsiData) {
    container.innerHTML = '';
    
    if (!wsiData || !wsiData.wsiGrid) {
      // Fallback to mock data
      for (let i = 0; i < 28; i++) {
        const cell = document.createElement('div');
        cell.className = 'wsi-cell' + (Math.random() > 0.75 ? ' bad' : '');
        container.appendChild(cell);
      }
      return;
    }
    
    wsiData.wsiGrid.forEach(dayData => {
      const cell = document.createElement('div');
      cell.className = `wsi-cell ${dayData.status}`;
      cell.title = `Day ${dayData.day}: WSI Score ${dayData.score}`;
      container.appendChild(cell);
    });
  }

  // Enhanced trendline with real WSI data
  function renderTrendLine(canvas, values, wsiData = null) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    
    if (!values || values.length === 0) return;
    
    const pad = 6;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const scaleY = (v) => H - pad - (v - min) / Math.max(1, (max - min)) * (H - pad * 2);
    const stepX = (W - pad * 2) / (values.length - 1);

    // Draw grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const y = (H / 4) * i;
      ctx.beginPath();
      ctx.moveTo(pad, y);
      ctx.lineTo(W - pad, y);
      ctx.stroke();
    }

    // Draw trend line
    ctx.beginPath();
    values.forEach((v, i) => {
      const x = pad + i * stepX;
      const y = scaleY(v);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#14532d';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Draw data points
    ctx.fillStyle = '#059669';
    values.forEach((v, i) => {
      const x = pad + i * stepX;
      const y = scaleY(v);
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, 2 * Math.PI);
      ctx.fill();
    });

    // Fill area under curve
    ctx.beginPath();
    values.forEach((v, i) => {
      const x = pad + i * stepX;
      const y = scaleY(v);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    const grad = ctx.createLinearGradient(0, pad, 0, H - pad);
    grad.addColorStop(0, 'rgba(16,185,129,0.35)');
    grad.addColorStop(1, 'rgba(16,185,129,0.05)');
    ctx.lineTo(W - pad, H - pad);
    ctx.lineTo(pad, H - pad);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Add title and labels if WSI data is available
    if (wsiData) {
      ctx.fillStyle = '#1f2937';
      ctx.font = '12px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`WSI: ${wsiData.overallWsi}`, 10, 20);
      ctx.fillText(`Trend: ${values[values.length - 1] > values[0] ? '↗' : '↘'}`, 10, 35);
    }
  }

  // Export comprehensive WSI report to PNG
  async function exportTrendToPNG() {
    const canvas = $('trendCanvas');
    if (!canvas) return;

    try {
      // Get current range selection
      const range = parseInt($('hsRange').value, 10) || 30;
      
      // Fetch current WSI data
      const wsiData = await fetchWSIData(range);
      if (!wsiData) {
        alert('Unable to fetch WSI data for export');
        return;
      }

      // Create a larger canvas for comprehensive report
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');
      tempCanvas.width = 800;
      tempCanvas.height = 1000;

      // Fill with white background
      tempCtx.fillStyle = '#ffffff';
      tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

      let yPos = 40;

      // Title
      tempCtx.fillStyle = '#1f2937';
      tempCtx.font = 'bold 24px Inter, sans-serif';
      tempCtx.textAlign = 'center';
      tempCtx.fillText('Women\'s Safety Index Report', tempCanvas.width / 2, yPos);
      yPos += 30;

      // Subtitle with range
      tempCtx.font = '16px Inter, sans-serif';
      tempCtx.fillText(`Analysis Period: ${range} Days`, tempCanvas.width / 2, yPos);
      yPos += 40;

      // Overall WSI Score
      tempCtx.font = 'bold 20px Inter, sans-serif';
      tempCtx.fillStyle = wsiData.overallWsi > 70 ? '#059669' : wsiData.overallWsi > 50 ? '#f59e0b' : '#dc2626';
      tempCtx.fillText(`Overall WSI: ${wsiData.overallWsi}/100`, tempCanvas.width / 2, yPos);
      yPos += 50;

      // Draw the trend graph (scaled up)
      const graphWidth = 600;
      const graphHeight = 200;
      const graphX = (tempCanvas.width - graphWidth) / 2;
      const graphY = yPos;

      // Graph background
      tempCtx.fillStyle = '#f8f9fa';
      tempCtx.fillRect(graphX, graphY, graphWidth, graphHeight);
      tempCtx.strokeStyle = '#e5e7eb';
      tempCtx.lineWidth = 1;
      tempCtx.strokeRect(graphX, graphY, graphWidth, graphHeight);

      // Draw trend line
      const values = wsiData.wsiTrend;
      const pad = 20;
      const min = Math.min(...values);
      const max = Math.max(...values);
      const scaleY = (v) => graphY + graphHeight - pad - (v - min) / Math.max(1, (max - min)) * (graphHeight - pad * 2);
      const stepX = (graphWidth - pad * 2) / (values.length - 1);

      // Grid lines
      tempCtx.strokeStyle = 'rgba(0,0,0,0.1)';
      for (let i = 1; i < 4; i++) {
        const y = graphY + (graphHeight / 4) * i;
        tempCtx.beginPath();
        tempCtx.moveTo(graphX + pad, y);
        tempCtx.lineTo(graphX + graphWidth - pad, y);
        tempCtx.stroke();
      }

      // Trend line
      tempCtx.beginPath();
      values.forEach((v, i) => {
        const x = graphX + pad + i * stepX;
        const y = scaleY(v);
        if (i === 0) tempCtx.moveTo(x, y); else tempCtx.lineTo(x, y);
      });
      tempCtx.strokeStyle = '#059669';
      tempCtx.lineWidth = 3;
      tempCtx.stroke();

      // Data points
      tempCtx.fillStyle = '#059669';
      values.forEach((v, i) => {
        const x = graphX + pad + i * stepX;
        const y = scaleY(v);
        tempCtx.beginPath();
        tempCtx.arc(x, y, 5, 0, 2 * Math.PI);
        tempCtx.fill();
        
        // Value labels
        tempCtx.fillStyle = '#1f2937';
        tempCtx.font = '12px Inter, sans-serif';
        tempCtx.textAlign = 'center';
        tempCtx.fillText(v.toString(), x, y - 10);
      });

      yPos += graphHeight + 60;

      // Statistics Section
      tempCtx.fillStyle = '#1f2937';
      tempCtx.font = 'bold 18px Inter, sans-serif';
      tempCtx.textAlign = 'left';
      tempCtx.fillText('Key Statistics:', 50, yPos);
      yPos += 30;

      tempCtx.font = '14px Inter, sans-serif';
      const stats = [
        `Total Women's Safety Calls: ${wsiData.statistics.totalWomenSafetyCalls}`,
        `Total Emergency Calls: ${wsiData.statistics.totalCalls}`,
        `Women's Safety Percentage: ${wsiData.statistics.womenSafetyPercentage}%`,
        `Analysis Period: ${wsiData.statistics.daysAnalyzed} days`
      ];

      stats.forEach(stat => {
        tempCtx.fillText(stat, 70, yPos);
        yPos += 25;
      });

      yPos += 20;

      // Top Risk Areas
      tempCtx.font = 'bold 18px Inter, sans-serif';
      tempCtx.fillText('Top Risk Areas:', 50, yPos);
      yPos += 30;

      tempCtx.font = '14px Inter, sans-serif';
      wsiData.topRiskAreas.slice(0, 5).forEach((area, index) => {
        const riskColor = area.wsiScore > 70 ? '#059669' : area.wsiScore > 50 ? '#f59e0b' : '#dc2626';
        tempCtx.fillStyle = '#1f2937';
        tempCtx.fillText(`${index + 1}. ${area.area}`, 70, yPos);
        tempCtx.fillStyle = riskColor;
        tempCtx.fillText(`WSI: ${area.wsiScore} (${area.incidents} incidents)`, 300, yPos);
        yPos += 25;
      });

      yPos += 30;

      // CSV Data Summary
      tempCtx.fillStyle = '#1f2937';
      tempCtx.font = 'bold 18px Inter, sans-serif';
      tempCtx.fillText('Daily WSI Trend Data:', 50, yPos);
      yPos += 30;

      tempCtx.font = '12px Inter, sans-serif';
      tempCtx.fillText('Day:  ' + values.map((_, i) => `D${i+1}`).join('   '), 70, yPos);
      yPos += 20;
      tempCtx.fillText('WSI:  ' + values.map(v => v.toString().padStart(2, ' ')).join('   '), 70, yPos);

      yPos += 50;

      // Footer
      tempCtx.fillStyle = '#6b7280';
      tempCtx.font = '12px Inter, sans-serif';
      tempCtx.textAlign = 'center';
      tempCtx.fillText(`Generated: ${new Date().toLocaleString()}`, tempCanvas.width / 2, yPos);
      tempCtx.fillText('SAFENAVI 112 - Goa Police Emergency Response System', tempCanvas.width / 2, yPos + 20);

      // Create download link
      const link = document.createElement('a');
      link.download = `WSI_Report_${range}days_${new Date().toISOString().split('T')[0]}.png`;
      link.href = tempCanvas.toDataURL('image/png');
      link.click();

      console.log('WSI Report exported successfully');
    } catch (error) {
      console.error('Error exporting WSI report:', error);
      alert('Error exporting WSI report. Please try again.');
    }
  }

  function simulateTrend(n=7) { return Array.from({length:n},()=> rand(40,100)); }

  function renderAlerts(listEl) {
    listEl.innerHTML = '';
    const now = Date.now();
    const items = [
      { text: 'Panic alert near Calangute Beach', t: now - 5*60*1000 },
      { text: 'Street harassment report, Panaji market', t: now - 18*60*1000 },
      { text: 'Unsafe ride complaint (cab) in Mapusa', t: now - 42*60*1000 },
    ];
    items.forEach(it => {
      const li = document.createElement('li');
      const left = document.createElement('div');
      left.textContent = it.text;
      const right = document.createElement('div');
      right.className = 'time';
      right.textContent = new Date(it.t).toLocaleTimeString();
      li.appendChild(left); li.appendChild(right);
      listEl.appendChild(li);
    });
  }

  function renderRealAlerts(listEl, alerts) {
    listEl.innerHTML = '';
    alerts.forEach(alert => {
      const li = document.createElement('li');
      const left = document.createElement('div');
      // Truncate long text for better display
      const displayText = alert.text.length > 60 ? alert.text.substring(0, 60) + '...' : alert.text;
      left.textContent = displayText;
      const right = document.createElement('div');
      right.className = 'time';
      const alertTime = new Date(alert.timestamp);
      right.textContent = alertTime.toLocaleTimeString();
      li.appendChild(left); 
      li.appendChild(right);
      listEl.appendChild(li);
    });
  }

  function updateIncidentCount(count, category, days) {
    const hintEl = $('rangeLbl');
    if (hintEl) {
      hintEl.textContent = `${days} (${count} incidents)`;
    }
  }

  // Clear all red zones
  function clearRedZones() {
    redZoneCircles.forEach(circle => goaHeatmap.removeLayer(circle));
    redZonePolygons.forEach(polygon => goaHeatmap.removeLayer(polygon));
    redZoneCircles = [];
    redZonePolygons = [];
  }

  // Show circle red zone for an area
  function showCircleZone(areaName) {
    const area = GOA_AREAS.find(a => a.name === areaName);
    if (!area) return;

    clearRedZones();

    // Create circle red zone
    const circle = L.circle([area.lat, area.lng], {
      color: '#dc2626',
      fillColor: '#ef4444',
      fillOpacity: 0.3,
      radius: area.radius,
      weight: 3
    }).addTo(goaHeatmap);

    // Add popup to circle
    circle.bindPopup(`
      <div class="red-zone-popup">
        <h4>🚨 Red Zone: ${area.name}</h4>
        <p><strong>Type:</strong> Circle Zone</p>
        <p><strong>Radius:</strong> ${area.radius}m</p>
        <p><strong>Area Type:</strong> ${area.type}</p>
        <p><em>High incident density area</em></p>
      </div>
    `);

    redZoneCircles.push(circle);

    // Fit map to show the zone
    goaHeatmap.fitBounds(circle.getBounds(), { padding: [20, 20] });
  }

  // Show polygon red zone for an area
  function showPolygonZone(areaName) {
    const area = GOA_AREAS.find(a => a.name === areaName);
    if (!area || !area.polygon) return;

    clearRedZones();

    // Create polygon red zone
    const polygon = L.polygon(area.polygon, {
      color: '#dc2626',
      fillColor: '#ef4444',
      fillOpacity: 0.3,
      weight: 3
    }).addTo(goaHeatmap);

    // Add popup to polygon
    polygon.bindPopup(`
      <div class="red-zone-popup">
        <h4>🚨 Red Zone: ${area.name}</h4>
        <p><strong>Type:</strong> Polygon Zone</p>
        <p><strong>Vertices:</strong> ${area.polygon.length}</p>
        <p><strong>Area Type:</strong> ${area.type}</p>
        <p><em>Custom boundary high-risk area</em></p>
      </div>
    `);

    redZonePolygons.push(polygon);

    // Fit map to show the zone
    goaHeatmap.fitBounds(polygon.getBounds(), { padding: [20, 20] });
  }

  // Create category-specific circle zones based on CSV data
  async function createCategoryBasedZones() {
    clearRedZones();

    // Fetch data for all three categories
    const categories = ['women', 'accident', 'crime'];
    const categoryColors = {
      'women': { color: '#dc2626', fillColor: '#ef4444', icon: '👩' }, // Red for women's safety
      'accident': { color: '#f59e0b', fillColor: '#fbbf24', icon: '🚗' }, // Orange for accidents  
      'crime': { color: '#7c2d12', fillColor: '#dc2626', icon: '🚨' }  // Dark red for crime
    };

    for (const category of categories) {
      try {
        const response = await fetch(`/api/heatmap?category=${category}&days=30`);
        const data = await response.json();
        
        if (data.success && data.topHotspots.length > 0) {
          // Create circles for top hotspots in each category
          data.topHotspots.slice(0, 5).forEach((hotspot, index) => {
            if (!hotspot.coordinates) return;

            const colors = categoryColors[category];
            const radius = Math.max(500, Math.min(hotspot.count * 30, 2500)); // Scale radius: 500m-2.5km
            
            const circle = L.circle([hotspot.coordinates.lat, hotspot.coordinates.lng], {
              color: colors.color,
              fillColor: colors.fillColor,
              fillOpacity: 0.3,
              radius: radius,
              weight: 3,
              dashArray: category === 'accident' ? '10, 5' : null // Dashed for accidents
            }).addTo(goaHeatmap);

            circle.bindPopup(`
              <div class="red-zone-popup">
                <h4>${colors.icon} ${category.toUpperCase()} Zone</h4>
                <p><strong>Location:</strong> ${hotspot.location}</p>
                <p><strong>Incidents:</strong> ${hotspot.count}</p>
                <p><strong>Category:</strong> ${category}</p>
                <p><strong>Radius:</strong> ${Math.round(radius)}m</p>
                <p><strong>Risk Level:</strong> ${hotspot.count > 100 ? 'Very High' : hotspot.count > 50 ? 'High' : 'Moderate'}</p>
              </div>
            `);

            redZoneCircles.push(circle);
          });
        }
      } catch (error) {
        console.error(`Error fetching ${category} data:`, error);
      }
    }
  }

  // Create red zones based on heatmap data intensity (fallback method)
  function createDataDrivenRedZones(heatmapData) {
    if (!heatmapData.topHotspots || heatmapData.topHotspots.length === 0) return;

    // Only clear if we haven't created category-based zones
    if (redZoneCircles.length === 0) {
      clearRedZones();

      // Create zones for top 3 hotspots
      const topHotspots = heatmapData.topHotspots.slice(0, 3);
      
      topHotspots.forEach((hotspot, index) => {
        if (!hotspot.coordinates) return;

        const intensity = hotspot.count;
        const radius = Math.min(intensity * 20, 3000); // Scale radius based on incident count
        const circle = L.circle([hotspot.coordinates.lat, hotspot.coordinates.lng], {
          color: '#dc2626',
          fillColor: '#ef4444',
          fillOpacity: 0.4,
          radius: radius,
          weight: 4
        }).addTo(goaHeatmap);

        circle.bindPopup(`
          <div class="red-zone-popup">
            <h4>🚨 Data-Driven Red Zone</h4>
            <p><strong>Location:</strong> ${hotspot.location}</p>
            <p><strong>Incidents:</strong> ${hotspot.count}</p>
            <p><strong>Rank:</strong> #${index + 1} Hotspot</p>
            <p><strong>Zone Type:</strong> Auto-Generated Circle</p>
          </div>
        `);

        redZoneCircles.push(circle);
      });
    }
  }

  // Show all circle zones
  function showAllCircleZones() {
    clearRedZones();
    GOA_AREAS.forEach(area => {
      const circle = L.circle([area.lat, area.lng], {
        color: '#dc2626',
        fillColor: '#ef4444',
        fillOpacity: 0.2,
        radius: area.radius,
        weight: 2
      }).addTo(goaHeatmap);

      circle.bindPopup(`
        <div class="red-zone-popup">
          <h4>🚨 ${area.name} Circle Zone</h4>
          <p><strong>Radius:</strong> ${area.radius}m</p>
          <p><strong>Type:</strong> ${area.type}</p>
        </div>
      `);

      redZoneCircles.push(circle);
    });
  }

  // Show all polygon zones
  function showAllPolygonZones() {
    clearRedZones();
    GOA_AREAS.forEach(area => {
      if (!area.polygon) return;
      
      const polygon = L.polygon(area.polygon, {
        color: '#dc2626',
        fillColor: '#ef4444',
        fillOpacity: 0.2,
        weight: 2
      }).addTo(goaHeatmap);

      polygon.bindPopup(`
        <div class="red-zone-popup">
          <h4>🚨 ${area.name} Polygon Zone</h4>
          <p><strong>Vertices:</strong> ${area.polygon.length}</p>
          <p><strong>Type:</strong> ${area.type}</p>
        </div>
      `);

      redZonePolygons.push(polygon);
    });
  }

  // Make functions globally available for popup buttons
  window.showCircleZone = showCircleZone;
  window.showPolygonZone = showPolygonZone;
  window.clearRedZones = clearRedZones;
  window.showAllCircleZones = showAllCircleZones;
  window.showAllPolygonZones = showAllPolygonZones;
  window.createCategoryBasedZones = createCategoryBasedZones;

  async function updateAll() {
    const range = parseInt($('hsRange').value, 10) || 30;

    try {
      // Update the real Goa heatmap (this will also update alerts and incident count)
      await updateHeatmap();

      // Fetch and render real WSI data with dynamic range
      const wsiData = await fetchWSIData(range);
      
      if (wsiData) {
        // Render WSI grid with real data
        renderWSIGrid($('wsiGrid'), wsiData);
        
        // Render trend line with real WSI trend data
        renderTrendLine($('trendCanvas'), wsiData.wsiTrend, wsiData);
        
        // Update WSI statistics display
        updateWSIStats(wsiData, range);
      } else {
        // Fallback to mock data
        renderWSIGrid($('wsiGrid'));
        renderTrendLine($('trendCanvas'), simulateTrend(7));
      }
    } catch (error) {
      console.error('Error updating dashboard:', error);
      // Fallback to mock data on error
      renderWSIGrid($('wsiGrid'));
      renderTrendLine($('trendCanvas'), simulateTrend(7));
    }
  }

  // Update WSI statistics display
  function updateWSIStats(wsiData, range) {
    // Update the WSI header with current range and score
    const wsiHeader = document.querySelector('.wsi header');
    if (wsiHeader) {
      wsiHeader.textContent = `Women's Safety Index (${range}d) - WSI: ${wsiData.overallWsi}/100`;
    }
    
    // Update the trend header with current range
    const trendHeader = document.querySelector('.trend-header span');
    if (trendHeader) {
      trendHeader.textContent = `WSI Trend (${range}d)`;
    }
    
    // Log detailed statistics
    console.log(`WSI Data for ${range} days:`, {
      overallWSI: wsiData.overallWsi,
      totalWomenSafetyCalls: wsiData.statistics.totalWomenSafetyCalls,
      womenSafetyPercentage: wsiData.statistics.womenSafetyPercentage,
      topRiskAreas: wsiData.topRiskAreas,
      trendData: wsiData.wsiTrend
    });
  }

  function init() {
    // Initialize the Leaflet heatmap
    initializeHeatmap();
    
    // Set up event listeners
    $('applyHot')?.addEventListener('click', updateAll);
    $('hsCategory')?.addEventListener('change', updateHeatmap);
    $('hsRange')?.addEventListener('change', updateHeatmap);
    
    // Red zone control listeners
    $('showCategoryZones')?.addEventListener('click', createCategoryBasedZones);
    $('clearZones')?.addEventListener('click', clearRedZones);
    $('showAllCircles')?.addEventListener('click', showAllCircleZones);
    $('showAllPolygons')?.addEventListener('click', showAllPolygonZones);
    
    // PNG export listener
    const exportBtn = document.getElementById('trendPng');
    if (exportBtn) {
      exportBtn.addEventListener('click', exportTrendToPNG);
    } else {
      console.warn('Export PNG button not found');
    }
    
    // Initial render
    updateAll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }
})();
