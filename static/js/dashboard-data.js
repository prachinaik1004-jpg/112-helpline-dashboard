// Dashboard Data Integration
let incidentData = [];

// Goa's bounding box coordinates for random point generation
const GOA_BOUNDS = {
    north: 15.8,
    south: 14.9,
    west: 73.6,
    east: 74.5
};

// Function to generate random coordinates within Goa
function getRandomGoaCoordinates() {
    const lat = GOA_BOUNDS.south + Math.random() * (GOA_BOUNDS.north - GOA_BOUNDS.south);
    const lng = GOA_BOUNDS.west + Math.random() * (GOA_BOUNDS.east - GOA_BOUNDS.west);
    return [lat, lng];
}

// Function to load and parse CSV data
async function loadCSVData() {
    try {
        const response = await fetch('dataset.csv');
        const csvText = await response.text();
        
        // Parse CSV using PapaParse
        const results = Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: true
        });
        
        incidentData = results.data;
        console.log('Loaded', incidentData.length, 'incidents');
        
        // Update dashboard with loaded data
        updateDashboard();
    } catch (error) {
        console.error('Error loading CSV data:', error);
        // Fallback to sample data if CSV fails to load
        loadSampleData();
    }
}

// Function to update dashboard with data
function updateDashboard() {
    if (!incidentData || incidentData.length === 0) {
        console.warn('No data available to update dashboard');
        return;
    }

    // Update KPI cards
    updateKPICards();
    
    // Update map with incidents
    updateMapWithIncidents();
    
    // Update other dashboard components
    updateHotspotsList();
    updateResponseTimeMetrics();
}

// Update KPI cards with data
function updateKPICards() {
    // Total calls
    const totalCalls = incidentData.length;
    document.getElementById('totalCalls').textContent = totalCalls.toLocaleString();
    
    // Women's safety calls (example: looking for keywords in event information)
    const womensSafetyKeywords = ['women', 'lady', 'girl', 'harassment', 'eve-teasing', 'molestation'];
    const womensCalls = incidentData.filter(incident => 
        womensSafetyKeywords.some(keyword => 
            incident.EVENT_INFORMATION && 
            typeof incident.EVENT_INFORMATION === 'string' && 
            incident.EVENT_INFORMATION.toLowerCase().includes(keyword)
        )
    ).length;
    document.getElementById('womenCalls').textContent = womensCalls;
    
    // Update trend indicator
    const trendElement = document.getElementById('totalTrend');
    // Simple random trend for demo (replace with actual trend calculation)
    const trend = Math.random() > 0.5 ? 'up' : 'down';
    const percentage = Math.floor(Math.random() * 15) + 1;
    trendElement.textContent = (trend === 'up' ? '▲' : '▼') + ` ${percentage}%`;
    trendElement.className = 'trend ' + trend;
}

// Categorize incident based on event type
function getIncidentCategory(incident) {
    const eventInfo = (incident.EVENT_INFORMATION || '').toLowerCase();
    const eventType = (incident.EVENT_MAIN_TYPE || '').toLowerCase();
    
    // Women's safety related
    if (['women', 'lady', 'girl', 'harassment', 'eve-teasing', 'molestation', 'stalking', 'abuse']
        .some(term => eventInfo.includes(term) || eventType.includes(term))) {
        return 'women';
    }
    
    // Accident related
    if (['accident', 'crash', 'collision', 'hit and run', 'injury']
        .some(term => eventInfo.includes(term) || eventType.includes(term))) {
        return 'accident';
    }
    
    // Medical emergency
    if (['medical', 'heart', 'stroke', 'unconscious', 'ambulance', 'hospital']
        .some(term => eventInfo.includes(term) || eventType.includes(term))) {
        return 'medical';
    }
    
    // Crime related
    if (['theft', 'robbery', 'burglary', 'assault', 'fight', 'murder', 'fraud', 'scam']
        .some(term => eventInfo.includes(term) || eventType.includes(term))) {
        return 'crime';
    }
    
    // Default category
    return 'default';
}

// Update map with incident data
function updateMapWithIncidents() {
    // Check if map is already initialized
    if (typeof map === 'undefined') {
        console.error('Map not initialized');
        return;
    }
    
    // Clear existing markers
    if (window.markers) {
        map.removeLayer(window.markers);
    }
    
    // Create a new feature group to store markers
    window.markers = L.featureGroup().addTo(map);
    
    // Show loading state
    const loadingControl = L.control({position: 'topleft'});
    loadingControl.onAdd = function(map) {
        this._div = L.DomUtil.create('div', 'loading-control');
        this._div.innerHTML = '<div class="loading-spinner"></div> Loading incidents...';
        return this._div;
    };
    loadingControl.addTo(map);
    
    // Count incidents by category for the legend
    const categoryCounts = {
        'women': 0,
        'accident': 0,
        'crime': 0,
        'medical': 0,
        'default': 0
    };
    
    // Function to get a random subset of incidents (max 50 or 10% of total, whichever is smaller)
    function getRandomSubset(data, maxItems = 50) {
        const maxToShow = Math.min(maxItems, Math.floor(data.length * 0.1));
        if (data.length <= maxToShow) return data;
        
        // Create a copy of the array to avoid modifying the original
        const shuffled = [...data].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, maxToShow);
    }
    
    // Get a random subset of incidents to display
    const incidentsToShow = getRandomSubset(incidentData);
    console.log(`Showing ${incidentsToShow.length} of ${incidentData.length} total incidents`);
    
    // Process and add markers for each incident with a slight delay for better performance
    const batchSize = 20; // Reduced batch size for better performance
    let processed = 0;
    
    const processBatch = () => {
        const batch = incidentsToShow.slice(processed, processed + batchSize);
        
        // Fallback mapping from police station to approximate coords (Goa)
        const stationCoords = {
            'PANJIM': [15.4989, 73.8278],
            'PANAJI': [15.4989, 73.8278],
            'MAPUSA': [15.5915, 73.8090],
            'MARGAO': [15.2950, 73.9570],
            'VASCO': [15.3980, 73.8150],
            'PONDA': [15.4030, 74.0152],
            'BICHOLIM': [15.6000, 73.9559],
            'VALPOI': [15.5320, 74.1360],
            'PERNEM': [15.7230, 73.7953],
            'DHARBANDORA': [15.4085, 74.0839],
            'CANACONA': [15.0170, 74.0500],
            'QUEPEM': [15.2230, 74.0700],
            'CUNCOLIM': [15.1773, 73.9939],
            'COLVA': [15.2799, 73.9224],
            'ANJUNA': [15.5873, 73.7449],
            'CALANGUTE': [15.5439, 73.7553],
            'OLD GOA': [15.5036, 73.9103],
            'COLLEM': [15.3333, 74.2167],
            'PORVORIM': [15.5600, 73.8080]
        };

        const toUpper = (s) => (s || '').toString().toUpperCase();

        batch.forEach(incident => {
            // Prefer explicit coordinates if present
            let lat = parseFloat(incident.LATITUDE || incident.latitude || incident.lat);
            let lng = parseFloat(incident.LONGITUDE || incident.longitude || incident.lng);

            if (isNaN(lat) || isNaN(lng)) {
                const station = toUpper(incident.POLICE_STATION || incident.Police_Station_Name || incident.Police_Station);
                const key = Object.keys(stationCoords).find(k => station.includes(k));
                if (key) {
                    lat = stationCoords[key][0];
                    lng = stationCoords[key][1];
                } else {
                    // Fallback to random within Goa bounds
                    const rnd = getRandomGoaCoordinates();
                    lat = rnd[0];
                    lng = rnd[1];
                }
            }
            
            // Determine incident category
            const category = getIncidentCategory(incident);
            categoryCounts[category] = (categoryCounts[category] || 0) + 1;
            
            // Format date
            const eventDate = incident.CREATE_TIME ? 
                new Date(incident.CREATE_TIME).toLocaleString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                }) : 'Unknown time';
            
            // Create marker element
            const markerElement = document.createElement('div');
            markerElement.className = `marker-container ${category} ${incident.important ? 'important' : ''}`;
            markerElement.innerHTML = `
                <div class="marker-pulse"></div>
                <div class="marker-pin">
                    <i class="fas fa-exclamation"></i>
                </div>
            `;
            
            // Create custom icon
            const incidentIcon = L.divIcon({
                className: `incident-marker ${category}`,
                html: markerElement.innerHTML,
                iconSize: [36, 36],
                iconAnchor: [18, 36],
                popupAnchor: [0, -36]
            });
            
            // Create marker with custom icon
            const marker = L.marker([lat, lng], {icon: incidentIcon})
                .bindPopup(`
                    <div class="incident-popup-container">
                        <div class="popup-header">
                            <h4>${incident.EVENT_MAIN_TYPE || 'Incident'}</h4>
                            <span class="priority-badge ${category}">${category.toUpperCase()}</span>
                        </div>
                        <div class="incident-popup">
                            <p>${incident.EVENT_INFORMATION ? incident.EVENT_INFORMATION.substring(0, 200) + '...' : 'No details available'}</p>
                            <div class="incident-details">
                                <div class="detail-item">
                                    <i class="far fa-calendar"></i>
                                    <span>${eventDate}</span>
                                </div>
                                <div class="detail-item">
                                    <i class="fas fa-map-marker-alt"></i>
                                    <span>${incident.POLICE_STATION || incident.Police_Station_Name || 'Location not specified'}</span>
                                </div>
                                ${incident.RESPONSE_TIME ? `
                                <div class="detail-item">
                                    <i class="fas fa-clock"></i>
                                    <span>Response: ${incident.RESPONSE_TIME}</span>
                                </div>` : ''}
                            </div>
                            <div class="popup-actions">
                                <button class="btn btn-sm btn-primary">View Details</button>
                                <button class="btn btn-sm btn-secondary">Assign Unit</button>
                            </div>
                        </div>
                    </div>
                `)
                .addTo(window.markers);
                
            // Add hover effect
            marker.on('mouseover', function() {
                this.openPopup();
            });
        });
        
        processed += batch.length;
            
        // Update progress
        if (loadingControl._div) {
            loadingControl._div.innerHTML = `Loading incidents... ${Math.min(processed, incidentsToShow.length)}/${incidentsToShow.length}`;
        }      
        
        // Process next batch or finish
        if (processed < incidentsToShow.length) {
            setTimeout(processBatch, 30); // Small delay to keep UI responsive
        } else {
            // All markers added, fit bounds
            if (window.markers.getLayers().length > 0) {
                // Fit bounds with padding
                const bounds = window.markers.getBounds();
                if (bounds.isValid()) {
                    map.fitBounds(bounds.pad(0.15)); // Slightly more padding for better view
                } else {
                    // Fallback to Goa bounds if no valid bounds
                    map.fitBounds([
                        [GOA_BOUNDS.south, GOA_BOUNDS.west],
                        [GOA_BOUNDS.north, GOA_BOUNDS.east]
                    ]);
                }
                
                // Set a maximum zoom level to prevent over-zooming on few points
                if (window.markers.getLayers().length < 10) {
                    map.setMaxZoom(12);
                } else {
                    map.setMaxZoom(18);
                }
            }
            
            // Remove loading control
            if (loadingControl._div) {
                loadingControl.remove();
            }
            
            // Update category filters
            updateCategoryFilters(categoryCounts);
            
            console.log('All incidents loaded:', window.markers.getLayers().length, 'markers added');
            console.log('Incidents by category:', categoryCounts);
        }
    };
    
    // Start with a small delay to allow UI to update
    setTimeout(processBatch, 100);
}

// Update category filters in the UI
function updateCategoryFilters(categoryCounts) {
    const filtersContainer = document.getElementById('mapFilters');
    if (!filtersContainer) return;
    
    // Create filter buttons for each category
    let filtersHtml = '<div class="map-filters">';
    
    const categories = [
        { id: 'all', name: 'All Incidents', icon: 'layer-group', count: Object.values(categoryCounts).reduce((a, b) => a + b, 0) },
        { id: 'women', name: 'Women Safety', icon: 'female', count: categoryCounts.women || 0 },
        { id: 'accident', name: 'Accidents', icon: 'car-crash', count: categoryCounts.accident || 0 },
        { id: 'crime', name: 'Crime', icon: 'shield-alt', count: categoryCounts.crime || 0 },
        { id: 'medical', name: 'Medical', icon: 'ambulance', count: categoryCounts.medical || 0 }
    ];
    
    filtersHtml += categories.map(cat => `
        <button class="filter-btn ${cat.id === 'all' ? 'active' : ''}" data-category="${cat.id}">
            <i class="fas fa-${cat.icon}"></i>
            <span class="filter-name">${cat.name}</span>
            <span class="filter-count">${cat.count}</span>
        </button>
    `).join('');
    
    filtersHtml += '</div>';
    filtersContainer.innerHTML = filtersHtml;
    
    // Add event listeners to filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const category = this.getAttribute('data-category');
            
            // Update active state
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            // Filter markers
            if (window.markers) {
                window.markers.eachLayer(marker => {
                    const markerCategory = marker.options.icon.options.className.includes('women') ? 'women' :
                                        marker.options.icon.options.className.includes('accident') ? 'accident' :
                                        marker.options.icon.options.className.includes('crime') ? 'crime' :
                                        marker.options.icon.options.className.includes('medical') ? 'medical' : 'default';
                    
                    if (category === 'all' || markerCategory === category) {
                        if (map.hasLayer(marker)) return;
                        map.addLayer(marker);
                    } else {
                        if (!map.hasLayer(marker)) return;
                        map.removeLayer(marker);
                    }
                });
            }
        });
    });
}

// Update hotspots list
function updateHotspotsList() {
    const hotspotList = document.getElementById('hotspotList');
    if (!hotspotList) return;
    
    // Group incidents by police station
    const stationCounts = {};
    incidentData.forEach(incident => {
        const station = incident.POLICE_STATION || 'Unknown';
        stationCounts[station] = (stationCounts[station] || 0) + 1;
    });
    
    // Sort stations by incident count (descending)
    const sortedStations = Object.entries(stationCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5); // Top 5 hotspots
    
    // Update the list
    hotspotList.innerHTML = sortedStations.map(([station, count]) => 
        `<li>${station} <span class="count">${count}</span></li>`
    ).join('');
}

// Update response time metrics
function updateResponseTimeMetrics() {
    // Calculate average response time
    const validResponseTimes = incidentData
        .filter(incident => incident.RESPONSE_TIME)
        .map(incident => {
            // Parse response time string like "00:12:51.187000"
            const timeParts = incident.RESPONSE_TIME.split(/[:.]+/);
            return (parseInt(timeParts[0]) * 60) + // hours to minutes
                   parseInt(timeParts[1]) +        // minutes
                   (timeParts[2] / 60);           // seconds to minutes
        });
    
    if (validResponseTimes.length > 0) {
        const avgResponseTime = validResponseTimes.reduce((a, b) => a + b, 0) / validResponseTimes.length;
        document.getElementById('avgResp').textContent = `${avgResponseTime.toFixed(1)}m`;
    }
}

// Fallback to sample data if CSV fails to load
function loadSampleData() {
    console.log('Loading sample data...');
    // This would be replaced with actual sample data or an API call
    // For now, we'll just show a message
    document.getElementById('totalCalls').textContent = 'N/A';
    document.getElementById('womenCalls').textContent = 'N/A';
    document.getElementById('avgResp').textContent = '--';
    
    alert('Failed to load incident data. Please check your connection.');
}

// Set up refresh button
const refreshBtn = document.getElementById('refreshData');
if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
        // Show loading state
        const mapContainer = document.getElementById('map');
        const loadingOverlay = document.createElement('div');
        loadingOverlay.className = 'loading-overlay';
        loadingOverlay.innerHTML = '<div class="spinner"></div><div>Refreshing data...</div>';
        mapContainer.appendChild(loadingOverlay);
        
        // Reload data
        loadCSVData().finally(() => {
            // Remove loading overlay after a short delay to ensure UI updates
            setTimeout(() => {
                if (mapContainer.contains(loadingOverlay)) {
                    mapContainer.removeChild(loadingOverlay);
                }
            }, 500);
        });
    });
}

// Initialize map controls
document.addEventListener('DOMContentLoaded', () => {
    // Add scale control
    L.control.scale({imperial: false}).addTo(map);
    
    // Add layer control
    const baseMaps = {
        'OpenStreetMap': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }),
        'Satellite': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Tiles © Esri'
        })
    };
    
    L.control.layers(baseMaps, null, {position: 'topright'}).addTo(map);
    
    // Load CSV data after a short delay to ensure map is fully initialized
    setTimeout(loadCSVData, 500);
});
