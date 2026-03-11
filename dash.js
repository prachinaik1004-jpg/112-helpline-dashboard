(function() {
  'use strict';

  // Elements
  const totalEl = () => document.getElementById('totalCalls');
  const trendEl = () => document.getElementById('totalTrend');
  const womenEl = () => document.getElementById('womenCalls');
  const avgRespEl = () => document.getElementById('avgResp');
  const hotspotList = () => document.getElementById('hotspotList');
  const mapEl = () => document.getElementById('map');
  const tooltip = () => document.getElementById('tooltip');
  const feedList = () => document.getElementById('feedList');
  const loadingIndicator = () => document.getElementById('loadingIndicator');

  const toggles = () => Array.from(document.querySelectorAll('.toggle-group .toggle'));

  // Real Goa locations with coordinates
  const AREAS = [
    { name: 'Panaji', lat: 15.4909, lng: 73.8278 },
    { name: 'Margao', lat: 15.2993, lng: 74.1240 },
    { name: 'Vasco da Gama', lat: 15.3960, lng: 73.8157 },
    { name: 'Mapusa', lat: 15.5937, lng: 73.8070 },
    { name: 'Ponda', lat: 15.4013, lng: 74.0071 },
    { name: 'Calangute', lat: 15.5394, lng: 73.7554 },
    { name: 'Bicholim', lat: 15.6000, lng: 73.9500 },
    { name: 'Cuncolim', lat: 15.2000, lng: 74.0000 },
    { name: 'Curchorem', lat: 15.2500, lng: 74.1000 },
    { name: 'Canacona', lat: 15.0000, lng: 74.0000 }
  ];
  
  const TYPES = [
    { key: 'accident', label: 'Accident', color: '#2563eb' },
    { key: 'women', label: 'Women\'s Safety', color: '#dc2626' },
    { key: 'crime', label: 'Crime', color: '#eab308' },
    { key: 'medical', label: 'Medical Emergency', color: '#10b981' },
    { key: 'fire', label: 'Fire', color: '#f97316' },
    { key: 'other', label: 'Other', color: '#8b5cf6' }
  ];
  
  // Leaflet map instance
  let goaMap = null;
  let incidentMarkers = [];

  // Function to fetch data from API
  async function fetchIncidents() {
    let loadingElement = loadingIndicator();
    try {
      if (loadingElement) {
        loadingElement.textContent = 'Fetching incident data...';
        loadingElement.classList.add('visible');
      }
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
      
      // Add cache-busting parameter to prevent caching
      const cacheBuster = new Date().getTime();
      const response = await fetch(`http://localhost:3001/api/incidents?_=${cacheBuster}`, {
        signal: controller.signal,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!Array.isArray(data) || data.length === 0) {
        console.warn('No incident data received from API');
        return generateFallbackIncidents();
      }
      
      // Process and transform the data
      const processedData = data.map(incident => {
        // Parse response time to minutes if it's in HH:MM:SS format
        let respMin = 'N/A';
        if (incident.responseTime && typeof incident.responseTime === 'string') {
          const timeParts = incident.responseTime.split(':');
          if (timeParts.length === 3) {
            const hours = parseInt(timeParts[0]) || 0;
            const minutes = parseInt(timeParts[1]) || 0;
            respMin = (hours * 60 + minutes).toString();
          }
        }
        
        // Determine priority based on type if not provided
        let priority = incident.priority || 'medium';
        const type = (incident.type || '').toLowerCase();
        
        if (!incident.priority) {
          if (type.includes('emergency') || type.includes('accident') || type.includes('assault')) {
            priority = 'high';
          } else if (type.includes('theft') || type.includes('robbery') || type.includes('harassment')) {
            priority = 'medium';
          } else {
            priority = 'low';
          }
        }
        
        // Format the incident data
        return {
          id: incident.id || `INC-${Date.now().toString().slice(-6)}`,
          type: incident.type || 'Incident',
          description: incident.description || 'No description available',
          area: incident.location || 'Unknown Location',
          time: incident.time || new Date().toISOString(),
          status: incident.status || 'pending',
          respMin: respMin,
          lat: incident.coordinates?.lat || null,
          lng: incident.coordinates?.lng || null,
          priority: priority,
          caller: incident.caller || 'Anonymous',
          coordinates: incident.coordinates || null,
          icon: getIncidentIcon(incident.type)
        };
      });
      
      console.log(`Successfully processed ${processedData.length} incidents`);
      return processedData;
      
    } catch (error) {
      console.error('Error fetching incidents:', error);
      
      if (loadingElement) {
        loadingElement.textContent = 'Error loading live data. Using sample data...';
        loadingElement.classList.add('error');
        
        // Reset the loading indicator after a delay
        setTimeout(() => {
          loadingElement.classList.remove('visible', 'error');
        }, 3000);
      }
      
      // Return fallback data
      return generateFallbackIncidents();
    } finally {
      if (loadingElement) {
        setTimeout(() => {
          loadingElement.classList.remove('visible');
        }, 1000);
      }
    }
  }
  
  // Generate fallback incident data when API is not available
  function generateFallbackIncidents() {
    console.warn('Generating fallback incident data');
    const incidents = [];
    const now = new Date();
    
    // Sample incident types with priorities
    const incidentTypes = [
      { type: 'Accident', priority: 'high', icon: 'car-crash' },
      { type: 'Assault', priority: 'high', icon: 'user-shield' },
      { type: 'Theft', priority: 'medium', icon: 'shopping-bag' },
      { type: 'Harassment', priority: 'high', icon: 'exclamation-triangle' },
      { type: 'Disturbance', priority: 'medium', icon: 'volume-up' },
      { type: 'Medical Emergency', priority: 'high', icon: 'ambulance' },
      { type: 'Fire', priority: 'high', icon: 'fire' },
      { type: 'Traffic Violation', priority: 'low', icon: 'traffic-light' },
      { type: 'Suspicious Activity', priority: 'medium', icon: 'user-secret' },
      { type: 'Public Nuisance', priority: 'low', icon: 'exclamation-circle' }
    ];
    
    // Sample locations in Goa with coordinates
    const locations = [
      { name: 'Panjim', lat: 15.4909, lng: 73.8278 },
      { name: 'Margao', lat: 15.2993, lng: 74.1240 },
      { name: 'Vasco da Gama', lat: 15.3800, lng: 73.8200 },
      { name: 'Mapusa', lat: 15.5937, lng: 73.8070 },
      { name: 'Ponda', lat: 15.4013, lng: 74.0071 },
      { name: 'Bicholim', lat: 15.6000, lng: 73.9500 },
      { name: 'Curchorem', lat: 15.2500, lng: 74.1000 },
      { name: 'Valpoi', lat: 15.5300, lng: 74.1300 },
      { name: 'Canacona', lat: 15.0100, lng: 74.0400 },
      { name: 'Sanguem', lat: 15.2300, lng: 74.1600 }
    ];
    
    // Generate sample incidents
    for (let i = 0; i < 25; i++) {
      const minutesAgo = Math.floor(Math.random() * 1440); // Within last 24 hours
      const incidentTime = new Date(now.getTime() - minutesAgo * 60000);
      const incidentType = incidentTypes[Math.floor(Math.random() * incidentTypes.length)];
      const location = locations[Math.floor(Math.random() * locations.length)];
      
      // Add some random offset to the coordinates (within ~5km)
      const lat = location.lat + (Math.random() * 0.05 - 0.025);
      const lng = location.lng + (Math.random() * 0.05 - 0.025);
      
      // Generate a realistic response time (5-120 minutes)
      const responseTime = `${Math.floor(Math.random() * 2)}h ${Math.floor(Math.random() * 60)}m`;
      
      incidents.push({
        id: `INC-${Date.now().toString().slice(-6)}-${i}`,
        type: incidentType.type,
        description: `Report of ${incidentType.type.toLowerCase()} in ${location.name}`,
        location: location.name,
        time: incidentTime.toISOString(),
        status: Math.random() > 0.3 ? 'pending' : 'resolved',
        responseTime: responseTime,
        coordinates: { lat, lng },
        priority: incidentType.priority,
        caller: `Caller-${Math.floor(1000 + Math.random() * 9000)}`,
        icon: incidentType.icon
      });
    }
    
    return incidents;
  }
  
  // Helper function to get appropriate icon for incident type
  function getIncidentIcon(incidentType) {
    if (!incidentType) return 'fa-exclamation-circle';
    
    const type = incidentType.toLowerCase();
    
    if (type.includes('accident') || type.includes('crash')) {
      return 'fa-car-crash';
    } else if (type.includes('assault') || type.includes('violence')) {
      return 'fa-user-shield';
    } else if (type.includes('theft') || type.includes('robbery') || type.includes('burglary')) {
      return 'fa-shopping-bag';
    } else if (type.includes('harassment') || type.includes('women') || type.includes('abuse')) {
      return 'fa-exclamation-triangle';
    } else if (type.includes('medical') || type.includes('ambulance') || type.includes('injury')) {
      return 'fa-ambulance';
    } else if (type.includes('fire')) {
      return 'fa-fire';
    } else if (type.includes('traffic') || type.includes('accident')) {
      return 'fa-traffic-light';
    } else if (type.includes('disturbance') || type.includes('noise')) {
      return 'fa-volume-up';
    } else if (type.includes('suspicious')) {
      return 'fa-user-secret';
    } else if (type.includes('nuisance') || type.includes('public')) {
      return 'fa-exclamation-circle';
    } else {
      return 'fa-exclamation';
    }
  }
  
  function getIncidentType(description) {
    const desc = (description || '').toLowerCase();
    if (desc.includes('women') || desc.includes('harassment') || desc.includes('abuse')) {
      return 'women';
    } else if (desc.includes('accident') || desc.includes('collision') || desc.includes('crash')) {
      return 'accident';
    } else if (desc.includes('theft') || desc.includes('robbery') || desc.includes('assault')) {
      return 'crime';
    } else if (desc.includes('fire') || desc.includes('blaze') || desc.includes('smoke')) {
      return 'fire';
    } else if (desc.includes('medical') || desc.includes('ambulance') || desc.includes('injury')) {
      return 'medical';
    }
    return 'other';
  }
  
  function calculateResponseTime(responseTime) {
    if (!responseTime || responseTime === 'N/A') return Math.floor(Math.random() * 20) + 5;
    
    // Try to parse response time in format '0 days 00:12:51.187000'
    const match = responseTime.match(/(\d+):(\d+):/);
    if (match) {
      const hours = parseInt(match[1]);
      const minutes = parseInt(match[2]);
      return hours * 60 + minutes;
    }
    
    return Math.floor(Math.random() * 20) + 5; // Default random between 5-25 minutes
  }
  
  function getPriority(type, status) {
    if (type === 'women') return 'high';
    if (status === 'pending') return 'medium';
    return Math.random() > 0.7 ? 'high' : (Math.random() > 0.5 ? 'medium' : 'low');
  }
  
  function formatTime(minutes) {
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m ago` : `${hours}h ago`;
  }

  const state = {
    incidents: [],
    layer: 'incidents'
  };

  // KPI rendering with animations
  function renderKPIs() {
    const total = state.incidents.length;
    const women = state.incidents.filter(i => i.type === 'women').length;
    const pending = state.incidents.filter(i => i.status === 'pending').length;
    const avgResp = Math.round(
      state.incidents.reduce((s, i) => s + i.respMin, 0) / total
    );

    // Animate numbers
    animateNumber(totalEl(), total);
    animateNumber(womenEl(), women);
    animateNumber(avgRespEl(), avgResp, 'm');
    
    // Dynamic trend indicator
    if (trendEl()) {
      const isUp = Math.random() > 0.4;
      const percent = rand(2, 15);
      trendEl().textContent = (isUp ? '▲ ' : '▼ ') + percent + '%';
      trendEl().className = `trend ${isUp ? 'up' : 'down'}` ;
    }

    // Hotspots: top 3 areas by incident count
    const byArea = {};
    state.incidents.forEach(i => { byArea[i.area] = (byArea[i.area] || 0) + 1; });
    const top = Object.entries(byArea).sort((a, b) => b[1] - a[1]).slice(0, 3);
    if (hotspotList()) {
      hotspotList().innerHTML = '';
      top.forEach(([area, count], index) => {
        const li = document.createElement('li');
        li.innerHTML = `${area} — <strong>${count} cases</strong>` ;
        li.style.animationDelay = `${index * 0.1}s` ;
        li.className = 'hotspot-item';
        hotspotList().appendChild(li);
      });
    }
  }
  
  function animateNumber(element, targetValue, suffix = '') {
    if (!element) return;
    
    const currentValue = parseInt(element.textContent) || 0;
    const difference = targetValue - currentValue;
    const duration = 800;
    const steps = 20;
    const stepValue = difference / steps;
    const stepDuration = duration / steps;
    
    let currentStep = 0;
    const timer = setInterval(() => {
      currentStep++;
      const newValue = Math.round(currentValue + (stepValue * currentStep));
      element.textContent = newValue + suffix;
      
      if (currentStep >= steps) {
        clearInterval(timer);
        element.textContent = targetValue + suffix;
      }
    }, stepDuration);
  }

  // Initialize Leaflet Map
  function initializeMap() {
    if (!mapEl()) return;
    
    // Initialize map with Goa as the center
    function initMap() {
      if (goaMap) return;
      
      // Set initial view to Goa with appropriate zoom level
      goaMap = L.map('map', {
        center: [15.2993, 74.1240], // Center of Goa
        zoom: 10,
        zoomControl: true,
        preferCanvas: true // Better performance with many markers
      });
      
      // Add OpenStreetMap base layer
      const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
        detectRetina: true
      }).addTo(goaMap);
      
      // Add a scale control
      L.control.scale({
        imperial: false,
        metric: true,
        position: 'bottomright'
      }).addTo(goaMap);
      
      // Add a fullscreen control
      L.control.fullscreen({
        position: 'topleft',
        title: 'Show me the fullscreen map!',
        titleCancel: 'Exit fullscreen mode',
        content: '<i class="fas fa-expand"></i>',
        forceSeparateButton: true
      }).addTo(goaMap);
      
      // Handle fullscreen change
      goaMap.on('enterFullscreen', function() {
        console.log('Entered fullscreen');
      });
      
      goaMap.on('exitFullscreen', function() {
        console.log('Exited fullscreen');
      });
      
      // Add a locate control
      L.control.locate({
        position: 'topleft',
        strings: {
            title: 'Show me where I am!'
        },
        locateOptions: {
            enableHighAccuracy: true,
            maxZoom: 16
        }
      }).addTo(goaMap);
      
      // Add a measure control
      L.control.measure({
        position: 'topleft',
        primaryLengthUnit: 'meters',
        secondaryLengthUnit: 'kilometers',
        primaryAreaUnit: 'sqmeters',
        activeColor: '#3b82f6',
        completedColor: '#3b82f6',
        popupOptions: {
          className: 'measure-popup',
          autoPanPadding: [10, 10]
        }
      }).addTo(goaMap);
      
      // Add a print control
      L.easyPrint({
        title: 'Print map',
        position: 'topleft',
        exportOnly: false,
        hideControlContainer: true
      }).addTo(goaMap);
      
      // Add a minimap
      const osm2 = new L.TileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png');
      const miniMap = new L.Control.MiniMap(osm2, {
        toggleDisplay: true,
        minimized: true,
        position: 'bottomright'
      }).addTo(goaMap);
      
      // Add a search control
      const searchControl = L.control.search({
        layer: L.layerGroup(),
        propertyName: 'title',
        marker: false,
        moveToLocation: function(latlng, title, map) {
          map.setView(latlng, 16);
        }
      });
      
      searchControl.on('search:locationfound', function(e) {
        e.layer.bindPopup(e.text).openPopup();
      });
      
      goaMap.addControl(searchControl);
      
      // Add a loading indicator control
      const loadingControl = L.control({
        position: 'topright'
      });
      
      loadingControl.onAdd = function() {
        const div = L.DomUtil.create('div', 'loading-control');
        div.innerHTML = '<div id="map-loading" style="display: none;"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';
        return div;
      };
      
      loadingControl.addTo(goaMap);
      
      // Show loading indicator when tiles are loading
      goaMap.on('loading', function() {
        const loadingEl = document.getElementById('map-loading');
        if (loadingEl) loadingEl.style.display = 'block';
      });
      
      // Hide loading indicator when tiles are loaded
      goaMap.on('load', function() {
        const loadingEl = document.getElementById('map-loading');
        if (loadingEl) loadingEl.style.display = 'none';
      });
      
      // Add a custom control for map type
      const baseLayers = {
        'OpenStreetMap': osmLayer,
        'Satellite': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
          attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
          maxZoom: 19
        }),
        'Terrain': L.tileLayer('https://stamen-tiles-{s}.a.ssl.fastly.net/terrain/{z}/{x}/{y}{r}.{ext}', {
          attribution: 'Map tiles by <a href="http://stamen.com">Stamen Design</a>, <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a> &mdash; Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          subdomains: 'abcd',
          minZoom: 0,
          maxZoom: 18,
          ext: 'png'
        })
      };
      
      // Add base layers to the map
      L.control.layers(baseLayers, null, { position: 'topright' }).addTo(goaMap);
      
      // Add a custom control for map actions
      const mapActions = L.control({ position: 'topright' });
      
      mapActions.onAdd = function() {
        const div = L.DomUtil.create('div', 'map-actions');
        div.innerHTML = `
          <div class="btn-group-vertical">
            <button class="btn btn-sm btn-light" id="zoom-to-goa" title="Zoom to Goa">
              <i class="fas fa-map-marker-alt"></i>
            </button>
            <button class="btn btn-sm btn-light" id="zoom-to-incidents" title="Zoom to incidents">
              <i class="fas fa-crosshairs"></i>
            </button>
            <button class="btn btn-sm btn-light" id="clear-layers" title="Clear layers">
              <i class="fas fa-layer-group"></i>
            </button>
          </div>
        `;
        
        // Add event listeners
        L.DomEvent.on(div.querySelector('#zoom-to-goa'), 'click', function() {
          goaMap.setView([15.2993, 74.1240], 10);
        });
        
        L.DomEvent.on(div.querySelector('#zoom-to-incidents'), 'click', function() {
          if (incidentMarkers.length > 0) {
            const group = new L.featureGroup(incidentMarkers);
            goaMap.fitBounds(group.getBounds().pad(0.1));
          }
        });
        
        L.DomEvent.on(div.querySelector('#clear-layers'), 'click', function() {
          // Clear any additional layers except the base map
          goaMap.eachLayer(function(layer) {
            if (layer !== osmLayer) {
              goaMap.removeLayer(layer);
            }
          });
        });
        
        return div;
      };
      
      mapActions.addTo(goaMap);
      
      console.log('Map initialized');
    }
    
    // Add city markers
    AREAS.forEach(area => {
      const marker = L.marker([area.lat, area.lng])
        .addTo(goaMap)
        .bindPopup(`<b>${area.name}</b><br>Major City` );
    });
  }

  // Clear incident markers from the map
  function clearIncidentMarkers() {
    if (!goaMap) return;
    
    // Remove all markers from the map
    incidentMarkers.forEach(marker => {
      goaMap.removeLayer(marker);
    });
    
    // Clear the markers array
    incidentMarkers = [];
  }

  // Render incidents on the map with proper styling and interactivity
  function renderIncidents() {
    if (!goaMap) {
      console.warn('Map not initialized');
      return;
    }
    
    // Clear existing markers
    clearIncidentMarkers();
    
    // Create a feature group to hold all incident markers
    const incidentLayer = L.layerGroup().addTo(goaMap);
    
    // Add markers for each incident
    state.incidents.forEach(incident => {
      try {
        // Skip if no coordinates
        if (!incident.coordinates || !incident.coordinates.lat || !incident.coordinates.lng) {
          console.warn('Missing coordinates for incident:', incident.id);
          return;
        }
        
        // Determine marker color based on priority
        let color = '#3b82f6'; // Default blue
        if (incident.priority === 'high') {
          color = '#dc2626'; // Red for high priority
        } else if (incident.priority === 'medium') {
          color = '#f59e0b'; // Amber for medium priority
        } else if (incident.priority === 'low') {
          color = '#10b981'; // Green for low priority
        }
        
        // Get the appropriate icon class
        const iconClass = incident.icon || getIncidentIcon(incident.type);
        const isResolved = incident.status === 'resolved';
        
        // Create custom icon with pulse effect for active incidents
        const icon = L.divIcon({
          className: `incident-marker ${isResolved ? 'resolved' : 'active'}`,
          html: `
            <div class="marker-container">
              ${!isResolved ? `<div class="marker-pulse" style="background-color: ${color}40"></div>` : ''}
              <div class="marker-pin" style="background-color: ${color}">
                <i class="fas ${iconClass}"></i>
              </div>
            </div>
          `,
          iconSize: [30, 30],
          iconAnchor: [15, 30],
          popupAnchor: [0, -30]
        });
        
        // Create marker
        const marker = L.marker(
          [incident.coordinates.lat, incident.coordinates.lng],
          { 
            icon: icon,
            title: incident.type || 'Incident',
            alt: `Incident: ${incident.type || 'Unknown'} - ${incident.status || 'Status unknown'}`
          }
        ).addTo(incidentLayer);
        
        // Format popup content
        const statusClass = isResolved ? 'resolved' : 'pending';
        const priority = incident.priority || 'medium';
        const responseTime = incident.responseTime || 'N/A';
        const incidentTime = incident.time ? new Date(incident.time) : new Date();
        
        const popupContent = `
          <div class="incident-popup">
            <div class="popup-header ${statusClass}">
              <h4>${incident.type || 'Incident'}</h4>
              <span class="priority-badge ${priority}">${priority}</span>
            </div>
            <div class="popup-body">
              <p><strong>ID:</strong> ${incident.id || 'N/A'}</p>
              <p><strong>Location:</strong> ${incident.location || 'Unknown'}</p>
              <p><strong>Status:</strong> <span class="status ${statusClass}">${incident.status || 'pending'}</span></p>
              <p><strong>Reported:</strong> ${formatTimeAgo(incident.time) || 'Unknown time'}</p>
              <p><strong>Response Time:</strong> ${responseTime}</p>
              ${incident.caller ? `<p><strong>Caller:</strong> ${incident.caller}</p>` : ''}
              ${incident.description ? `<div class="description"><strong>Details:</strong> ${truncate(incident.description, 100)}</div>` : ''}
              <div class="incident-actions">
                <button class="btn-action view-details" data-incident-id="${incident.id}">View Details</button>
                ${!isResolved ? `<button class="btn-action resolve" data-incident-id="${incident.id}">Mark Resolved</button>` : ''}
              </div>
            </div>
          </div>
        `;
        
        // Bind popup to marker
        marker.bindPopup(popupContent, {
          maxWidth: 300,
          minWidth: 250,
          className: 'incident-popup-container',
          autoPanPadding: [10, 10]
        });
        
        // Add hover effect
        marker.on('mouseover', function() {
          this.openPopup();
        });
        
        // Add click handler for the marker
        marker.on('click', function() {
          // You can add custom click behavior here
          console.log('Clicked on incident:', incident.id);
        });
        
        // Add to markers array
        incidentMarkers.push(marker);
        
      } catch (error) {
        console.error('Error rendering incident marker:', error, incident);
      }
    });
    
    // Add layer control if not already added
    if (!window.layerControl) {
      window.layerControl = L.control.layers(null, {
        'Incidents': incidentLayer
      }, {
        position: 'topright',
        collapsed: false
      }).addTo(goaMap);
    } else {
      // Update the existing layer control
      window.layerControl.addOverlay(incidentLayer, 'Incidents');
    }
    
    // Fit map to show all incidents if we have any
    if (incidentMarkers.length > 0) {
      try {
        const group = L.featureGroup(incidentMarkers);
        goaMap.fitBounds(group.getBounds().pad(0.1));
      } catch (error) {
        console.error('Error fitting map bounds:', error);
      }
    }
    
    console.log(`Rendered ${incidentMarkers.length} incident markers`);
  }

  // Helper function to format time ago
  function formatTimeAgo(timestamp) {
    if (!timestamp) return 'Unknown time';
    
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return 'Invalid date';
    
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.round(diffMs / 60000);
    const diffHours = Math.round(diffMins / 60);
    const diffDays = Math.round(diffHours / 24);
    
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  }
  
  // Helper function to truncate text
  function truncate(str, length) {
    if (!str) return '';
    return str.length > length ? str.substring(0, length) + '...' : str;
  }

  // Live feed
  function renderFeed() {
    if (!feedList()) return;
    feedList().innerHTML = '';
    const items = [...state.incidents]
      .sort((a, b) => a.status.localeCompare(b.status))
      .slice(0, 10);
    items.forEach(i => {
      const li = document.createElement('li');
      const left = document.createElement('div');
      left.innerHTML = `<strong>${i.id}</strong> • ${i.typeLabel} • ${i.area}<div class="item-meta">${i.time}</div>`;
      const right = document.createElement('div');
      const tag = document.createElement('span');
      tag.className = `status ${i.status}` ;
      tag.textContent = i.status === 'pending' ? 'Escalation Pending' : 'Attended';
      right.appendChild(tag);
      li.appendChild(left);
      li.appendChild(right);
      feedList().appendChild(li);
    });
  }

  // Toggle handlers
  function bindToggles() {
    toggles().forEach(btn => {
      btn.addEventListener('click', () => {
        toggles().forEach(b => { b.classList.remove('active'); b.setAttribute('aria-selected', 'false'); });
        btn.classList.add('active');
        btn.setAttribute('aria-selected', 'true');
        state.layer = btn.dataset.layer;
        updateMap();
      });
    });
  }

  function updateMap() {
    if (state.layer === 'incidents') {
      renderIncidents();
    } else {
      renderHeat(state.layer);
    }
  }

  // Initialize the application
  async function init() {
    try {
      // Show initial loading state
      const loadingEl = loadingIndicator();
      if (loadingEl) {
        loadingEl.textContent = 'Initializing dashboard...';
        loadingEl.classList.add('visible');
      }
      
      // Initialize map
      initializeMap();
      
      // Bind toggle handlers
      bindToggles();
      
      // Initial render with loading state
      renderKPIs();
      
      // Show a message that we're loading data
      if (loadingEl) {
        loadingEl.textContent = 'Loading incident data...';
      }
      
      // Initial data load
      const success = await loadIncidents();
      
      // Set up auto-refresh every 5 minutes if the initial load was successful
      if (success) {
        setInterval(loadIncidents, 300000);
      } else {
        // If initial load failed, try again in 30 seconds
        setTimeout(loadIncidents, 30000);
      }
      
    } catch (error) {
      console.error('Error initializing application:', error);
      
      // Show error to user
      const loadingEl = loadingIndicator();
      if (loadingEl) {
        loadingEl.textContent = 'Error initializing dashboard. Please refresh the page.';
        loadingEl.classList.add('error');
      }
      
      // Still try to show some data
      state.incidents = generateFallbackIncidents();
      updateMap();
      renderKPIs();
      renderFeed();
    }
  }
  
  // Load incidents from API
  async function loadIncidents() {
    try {
      // Show loading state
      const loadingEl = loadingIndicator();
      if (loadingEl) {
        loadingEl.textContent = 'Loading incident data...';
        loadingEl.classList.add('visible');
      }
      
      // Fetch incidents from API
      const incidents = await fetchIncidents();
      
      // Update state with new incidents
      state.incidents = incidents;
      
      // Update the UI
      updateMap();
      renderKPIs();
      renderFeed();
      
      // Log success
      console.log(`Successfully loaded ${incidents.length} incidents`);
      
      // Show success message briefly
      if (loadingEl) {
        loadingEl.textContent = 'Data updated successfully';
        setTimeout(() => {
          loadingEl.classList.remove('visible');
        }, 2000);
      }
      
      return true;
      
    } catch (error) {
      console.error('Error in loadIncidents:', error);
      
      // Show error to user
      const loadingEl = loadingIndicator();
      if (loadingEl) {
        loadingEl.textContent = 'Error loading data. Using cached data...';
        loadingEl.classList.add('error');
        setTimeout(() => {
          loadingEl.classList.remove('visible', 'error');
        }, 3000);
      }
      
      // If we have no incidents at all, generate fallback data
      if (!state.incidents || state.incidents.length === 0) {
        state.incidents = generateFallbackIncidents();
        updateMap();
        renderKPIs();
        renderFeed();
      }
      
      return false;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
