// Dashboard initialization and data handling
import { DataHandler } from './dataHandler.js';

(function () {
  'use strict';
  
  // DOM Elements
  const totalEl = () => document.getElementById('totalCalls');
  const trendEl = () => document.getElementById('totalTrend');
  const womenEl = () => document.getElementById('womenCalls');
  const avgRespEl = () => document.getElementById('avgResp');
  const hotspotList = () => document.getElementById('hotspotList');
  const mapEl = () => document.getElementById('map');
  const tooltip = () => document.getElementById('tooltip');
  const feedList = () => document.getElementById('feedList');
  const toggles = () => Array.from(document.querySelectorAll('.toggle-group .toggle'));
  const loadingIndicator = document.getElementById('loading');
  
  // Initialize Data Handler
  const dataHandler = new DataHandler();
  
  // Map instance
  let map = null;
  let markers = [];
  
  // State
  const state = { 
    incidents: [],
    layer: 'incidents',
    mapInitialized: false,
    heatmapLayer: null,
    currentMarkers: []
  };

  // Initialize the map
  function initMap() {
    if (!mapEl() || state.mapInitialized) return;
    
    // Center on Goa, India
    map = L.map('map').setView([15.2993, 74.1240], 10);
    
    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    
    state.mapInitialized = true;
  }

  // Hardcoded coordinates for police stations in Goa
  const policeStations = {
    'PANJIM': { lat: 15.4989, lng: 73.8278 },
    'MAPUSA': { lat: 15.5915, lng: 73.8090 },
    'MARGÃO': { lat: 15.2993, lng: 73.9581 },
    'VASCO': { lat: 15.3860, lng: 73.8150 },
    'PONDA': { lat: 15.4030, lng: 74.0152 },
    'BICHOLIM': { lat: 15.6000, lng: 73.9559 },
    'VALPOI': { lat: 15.5304, lng: 74.1379 },
    'PERNEM': { lat: 15.7230, lng: 73.7953 },
    'DHARBANDORA': { lat: 15.4085, lng: 74.0839 },
    'CANACONA': { lat: 14.9955, lng: 74.0353 },
    'QUEPEM': { lat: 15.2125, lng: 74.0779 },
    'CUNCOLIM': { lat: 15.1773, lng: 73.9939 },
    'COLVA': { lat: 15.2799, lng: 73.9224 },
    'ANJUNA': { lat: 15.5835, lng: 73.7393 },
    'CALANGUTE': { lat: 15.5439, lng: 73.7553 }
  };

  // Get coordinates for a police station (fallback to center of Goa)
  function getCoordinatesForStation(stationName) {
    const upperStation = stationName.toUpperCase();
    for (const [key, coords] of Object.entries(policeStations)) {
      if (upperStation.includes(key)) {
        return coords;
      }
    }
    // Default to center of Goa if station not found
    return { lat: 15.2993 + (Math.random() * 0.2 - 0.1), lng: 74.1240 + (Math.random() * 0.2 - 0.1) };
  }

  // Cache for storing processed incidents
  let cachedIncidents = null;
  let lastFetchTime = 0;
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache

  // Load incidents from CSV using DataHandler
  async function fetchIncidents() {
    try {
      showLoading(true);
      
      // Load data using DataHandler
      const csvPath = 'dataset.csv';
      console.log('Loading CSV from:', csvPath);
      await dataHandler.loadCSVData(csvPath);
      
      // Get all incidents and update state
      state.incidents = dataHandler.incidents;
      
      // Update the UI
      updateUI();
      
      console.log(`Loaded ${state.incidents.length} incidents from CSV`);
      
    } catch (error) {
      console.error('Error loading incidents:', error);
      alert('Failed to load incident data. Please try again later.');
    } finally {
      showLoading(false);
    }
  }

  // Update all UI components
  function updateUI() {
    renderKPIs();
    updateMap();
    renderFeed();
  }

  // Toggle loading indicator
  function showLoading(show) {
    if (loadingIndicator) {
      loadingIndicator.style.display = show ? 'block' : 'none';
    }
  }

  // Update KPI cards with data from DataHandler
  function renderKPIs() {
    if (!totalEl() || !womenEl() || !avgRespEl()) return;
    
    // Get statistics from DataHandler
    const stats = dataHandler.getStatistics();
    
    // Update KPI elements
    totalEl().textContent = stats.totalCalls.toLocaleString();
    womenEl().textContent = stats.womenSafetyCalls.toLocaleString();
    avgRespEl().textContent = stats.avgResponse;
    
    // Update hotspots
    updateHotspots();
  }
  
  // Update hotspots list
  function updateHotspots() {
    if (!hotspotList()) return;
    
    const byArea = {};
    state.incidents.forEach(i => {
      byArea[i.area] = (byArea[i.area] || 0) + 1;
    });
    
    const top = Object.entries(byArea)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    
    hotspotList().innerHTML = '';
    top.forEach(([area, count]) => {
      const li = document.createElement('li');
      li.textContent = `${area} — ${count} cases`;
      hotspotList().appendChild(li);
    });
  }
  
  // Clear all markers from the map
  function clearMarkers() {
    if (!state.currentMarkers || !state.currentMarkers.length) return;
    
    state.currentMarkers.forEach(marker => {
      if (marker && map.hasLayer(marker)) {
        map.removeLayer(marker);
      }
    });
    state.currentMarkers = [];
  }

  // Create custom icons for different incident types
  function getIconForIncident(type) {
    let color = '#3498db'; // Default blue
    
    if (type.includes('women') || type.includes('harassment') || type.includes('assault')) {
      color = '#e74c3c'; // Red for women's safety
    } else if (type.includes('accident') || type.includes('emergency')) {
      color = '#f39c12'; // Orange for accidents
    } else if (type.includes('theft') || type.includes('robbery')) {
      color = '#9b59b6'; // Purple for thefts
    }
    
    return L.divIcon({
      className: 'custom-div-icon',
      html: `<div style='background-color:${color};' class='marker-pin'></div>`,
      iconSize: [30, 42],
      iconAnchor: [15, 42],
      popupAnchor: [0, -30]
    });
  }

  // Update the map with current incidents
  function updateMap() {
    if (!map) {
      initMap();
      if (!map) return; // Still no map, can't proceed
    }
    
    updateMapLayer();
  }
  
  // Make this function available globally to be called from popup
  window.viewIncidentsAtLocation = function(lat, lng) {
    // Find marker at this location
    const marker = markers.find(m => 
      m.getLatLng().lat === lat && 
      m.getLatLng().lng === lng
    );
    
    if (marker && marker.incidents) {
      // Create a modal or update a panel with the list of incidents
      alert(`Showing ${marker.incidents.length} incidents at this location`);
      // In a real app, you would update a sidebar or modal with the list of incidents
    }
  };
  
  // Render the activity feed with optimized updates
  function renderFeed() {
    const feed = feedList();
    if (!feed) return;
    
    try {
      // Get recent incidents (last 5) with error handling for invalid dates
      const recentIncidents = [...state.incidents]
        .filter(incident => incident && incident.time)
        .sort((a, b) => {
          try {
            return (new Date(b.time) || 0) - (new Date(a.time) || 0);
          } catch (e) {
            return 0;
          }
        })
        .slice(0, 5);
      
      // Only update if content has changed
      const newContent = recentIncidents.length === 0
        ? '<div class="no-data">No recent incidents to display</div>'
        : recentIncidents.map(incident => `
          <div class="feed-item" data-incident-id="${incident.id || ''}">
            <div class="feed-icon ${incident.type || 'default'}">
              <i class="icon-${incident.type || 'incident'}"></i>
            </div>
            <div class="feed-content">
              <div class="feed-header">
                <span class="feed-type">${incident.typeLabel || 'Incident'}</span>
                <span class="feed-time">${incident.time || 'Unknown time'}</span>
              </div>
              <div class="feed-area">${incident.area || 'Unknown area'}</div>
              <div class="feed-desc">${incident.description || 'No additional details'}</div>
            </div>
          </div>
        `).join('');
      
      // Only update if content has changed
      if (feed.innerHTML !== newContent) {
        feed.innerHTML = newContent;
      }
      
    } catch (error) {
      console.error('Error rendering feed:', error);
      feed.innerHTML = '<div class="error-message">Error loading activity feed</div>';
    }
  }

  // Initialize heatmap layer
  function initHeatmap() {
    if (state.heatmapLayer) {
      map.removeLayer(state.heatmapLayer);
    }
    
    const heatPoints = state.incidents
      .filter(incident => incident.lat && incident.lng)
      .map(incident => [incident.lat, incident.lng, 0.6]); // Intensity 0.6 for all points
    
    state.heatmapLayer = L.heatLayer(heatPoints, {
      radius: 25,
      blur: 15,
      maxZoom: 17,
      gradient: {0.4: 'blue', 0.6: 'lime', 0.8: 'yellow', 1: 'red'}
    });
    
    if (state.layer === 'heatmap') {
      state.heatmapLayer.addTo(map);
    }
  }
  
  // Update map based on selected layer
  function updateMapLayer() {
    if (!map) return;
    
    // Clear existing markers and heatmap
    clearMarkers();
    if (state.heatmapLayer) {
      map.removeLayer(state.heatmapLayer);
      state.heatmapLayer = null;
    }
    
    // Get heat points based on selected layer
    let heatPoints = [];
    let markersToShow = [];
    
    switch(state.layer) {
      case 'crime':
        heatPoints = dataHandler.getHeatPointsByType('theft')
          .concat(dataHandler.getHeatPointsByType('assault'));
        break;
      case 'accident':
        heatPoints = dataHandler.getHeatPointsByType('accident');
        break;
      case 'tourism':
        // For tourism, show points of interest with markers instead of heatmap
        markersToShow = dataHandler.getIncidentsByType('tourism')
          .slice(0, 50); // Limit to 50 markers for performance
        break;
      case 'incidents':
      default:
        heatPoints = dataHandler.getHeatPointsByType('all');
        // For general incidents, show a sample of markers
        markersToShow = dataHandler.incidents
          .filter(incident => incident.lat && incident.lng)
          .slice(0, 30); // Limit to 30 markers for performance
    }
    
    // Update heatmap if we have heat points
    if (heatPoints.length > 0) {
      const heatData = heatPoints.map(point => [point.lat, point.lng, point.intensity]);
      state.heatmapLayer = L.heatLayer(heatData, { 
        radius: 25, 
        blur: 15, 
        maxZoom: 17,
        gradient: {
          0.1: 'blue',    // Cool colors for low intensity
          0.3: 'cyan',
          0.5: 'lime',   // Medium intensity
          0.7: 'yellow',
          1.0: 'red'     // High intensity
        }
      });
      state.heatmapLayer.addTo(map);
    }
    
    // Create markers for the selected points
    createMarkers(markersToShow);
    
    // Fit map to show all markers if we have any
    if (state.currentMarkers.length > 0) {
      const group = new L.featureGroup(state.currentMarkers);
      map.fitBounds(group.getBounds().pad(0.1));
    } else if (heatPoints.length > 0) {
      // If no markers but we have heat points, fit to heat points
      const bounds = heatPoints.reduce((bounds, point) => {
        return bounds.extend([point.lat, point.lng]);
      }, L.latLngBounds([heatPoints[0].lat, heatPoints[0].lng], [heatPoints[0].lat, heatPoints[0].lng]));
      
      map.fitBounds(bounds.pad(0.1));
    }
  }
  
  // Create markers for incidents or heat points
  function createMarkers(items) {
    if (!items || !items.length) return;
    
    // Clear any existing markers
    clearMarkers();
    
    // Create a marker for each item
    items.forEach(item => {
      // Skip if no coordinates
      if (!item.lat || !item.lng) return;
      
      // Determine if this is a heat point or incident
      const isHeatPoint = item.intensity !== undefined;
      const popupContent = isHeatPoint 
        ? (item.details || 'No details available')
        : dataHandler.getIncidentDetails(item);
        </div>
      `;
      
      const marker = L.marker([group.lat, group.lng], { icon })
        .addTo(map)
        .bindPopup(popupContent);
      
      // Store reference to the incidents for this marker
      marker.incidents = group.incidents;
      
      // Add a click handler to zoom in on the marker
      marker.on('click', function() {
        map.setView([group.lat, group.lng], 13);
      });
      
      markers.push(marker);
    });
  }

  // Initialize the application
  async function init() {
    try {
      // Initialize map
      initMap();
      
      // Initialize heatmap
      initHeatmap();
      
      // Set up refresh button if it exists
      const refreshBtn = document.getElementById('refreshData');
      if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
          refreshBtn.disabled = true;
          fetchIncidents().finally(() => {
            refreshBtn.disabled = false;
          });
        });
      }
      
      // Set up layer toggles with debouncing
      let toggleDebounce;
      toggles().forEach(toggle => {
        toggle.addEventListener('click', () => {
          // Update UI immediately for better responsiveness
          toggles().forEach(t => t.classList.remove('active'));
          toggle.classList.add('active');
          state.layer = toggle.dataset.layer;
          
          // Debounce the map update to avoid excessive redraws
          clearTimeout(toggleDebounce);
          toggleDebounce = setTimeout(() => {
            updateMapLayer();
          }, 100);
        });
      });
      
      // Initial data load with error handling
      fetchIncidents().catch(error => {
        console.error('Initial data load failed:', error);
        // Show error state in UI
        const loadingEl = document.getElementById('mapLoading');
        if (loadingEl) {
          loadingEl.innerHTML = '<div class="error-message">Failed to load data. <button class="retry-btn">Retry</button></div>';
          loadingEl.querySelector('.retry-btn').addEventListener('click', fetchIncidents);
        }
      }).finally(() => {
        showLoading(false);
      });
      
      // Set up periodic refresh (every 10 minutes)
      setInterval(() => {
        if (!document.hidden) { // Only refresh if tab is active
          fetchIncidents().catch(console.error);
        }
      }, 10 * 60 * 1000);
      
      // Handle tab visibility changes
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
          fetchIncidents().catch(console.error);
        }
      });
      
      // Initialize tooltips with performance optimization
      if (typeof tippy !== 'undefined') {
        setTimeout(() => {
          tippy('[data-tippy-content]', {
            animation: 'scale',
            theme: 'light',
            arrow: true,
            delay: [100, 0],
            performance: true
          });
        }, 1000); // Delay tooltip initialization
      }
      
    } catch (error) {
      console.error('Initialization error:', error);
      showLoading(false);
      // Show error to user
      alert('Failed to initialize dashboard. Please check console for details.');
    }
  }
  
  // Start the application when the DOM is loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
