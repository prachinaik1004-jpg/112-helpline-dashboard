// Zone data - in a real app, this would come from an API
const ZONE_DATA = {
    crime: [
        { id: 1, name: 'Panaji City Center', count: 45, trend: 'up', trendValue: 12, coordinates: [15.4909, 73.8278] },
        { id: 2, name: 'Vasco da Gama', count: 38, trend: 'down', trendValue: 5, coordinates: [15.3860, 73.8160] },
        { id: 3, name: 'Mapusa', count: 32, trend: 'up', trendValue: 8, coordinates: [15.5915, 73.8090] },
        { id: 4, name: 'Margao', count: 29, trend: 'stable', trendValue: 2, coordinates: [15.2993, 73.9570] },
        { id: 5, name: 'Baga Beach Area', count: 27, trend: 'up', trendValue: 15, coordinates: [15.5633, 73.7550] }
    ],
    accident: [
        { id: 1, name: 'NH-66 Panaji-Margao', count: 28, severity: 'High', coordinates: [15.3994, 73.8787] },
        { id: 2, name: 'NH-48 Mapusa Bypass', count: 22, severity: 'High', coordinates: [15.5915, 73.8090] },
        { id: 3, name: 'Verna Industrial Estate', count: 18, severity: 'Medium', coordinates: [15.3483, 73.8867] },
        { id: 4, name: 'Chinchinim Junction', count: 15, severity: 'Medium', coordinates: [15.2136, 73.9755] },
        { id: 5, name: 'Anjuna Beach Road', count: 12, severity: 'Low', coordinates: [15.5782, 73.7448] }
    ],
    tourism: [
        { id: 1, name: 'Calangute Beach', density: 'Very High', rating: 4.8, coordinates: [15.5439, 73.7553] },
        { id: 2, name: 'Baga Beach', density: 'High', rating: 4.7, coordinates: [15.5633, 73.7550] },
        { id: 3, name: 'Old Goa Churches', density: 'Medium', rating: 4.6, coordinates: [15.5007, 73.9115] },
        { id: 4, name: 'Dudhsagar Waterfalls', density: 'Medium', rating: 4.9, coordinates: [15.3144, 74.3144] },
        { id: 5, name: 'Fort Aguada', density: 'High', rating: 4.5, coordinates: [15.4920, 73.7738] }
    ]
};

// Initialize zone functionality
function initZoneHandler() {
    // Add event listeners to zone toggle buttons
    document.querySelectorAll('.zone-toggle-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const zoneType = this.getAttribute('data-zone');
            toggleZone(zoneType);
        });
    });
    
    // Initialize with crime zones shown by default
    showZone('crime');
}

// Toggle between different zone types
function toggleZone(zoneType) {
    // Update active button
    document.querySelectorAll('.zone-toggle-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-zone') === zoneType);
    });
    
    // Show selected zone
    showZone(zoneType);
}

// Show specific zone details
function showZone(zoneType) {
    // Hide all zone details
    document.querySelectorAll('.zone-details').forEach(el => {
        el.style.display = 'none';
    });
    
    // Show selected zone
    const zoneElement = document.getElementById(`${zoneType}ZoneDetails`);
    if (zoneElement) {
        zoneElement.style.display = 'block';
    }
    
    // Update zone data
    updateZoneData(zoneType);
    
    // Update map with zone data
    updateMapWithZoneData(zoneType);
}

// Update zone data in the UI
function updateZoneData(zoneType) {
    const zoneData = ZONE_DATA[zoneType] || [];
    const container = document.getElementById(`${zoneType}ZoneList`);
    
    if (!container) return;
    
    // Update stats
    if (zoneType === 'crime') {
        document.getElementById('crimeHotspots').textContent = zoneData.length;
        const total = zoneData.reduce((sum, zone) => sum + zone.count, 0);
        const trend = zoneData.reduce((sum, zone) => 
            sum + (zone.trend === 'up' ? zone.trendValue : zone.trend === 'down' ? -zone.trendValue : 0), 0);
        document.getElementById('crimeTrend').textContent = `${trend > 0 ? '+' : ''}${trend}%`;
        document.getElementById('crimeTrend').className = `trend ${trend > 0 ? 'up' : trend < 0 ? 'down' : 'stable'}`;
    } 
    else if (zoneType === 'accident') {
        document.getElementById('accidentHotspots').textContent = zoneData.length;
        const total = zoneData.reduce((sum, zone) => sum + zone.count, 0);
        const trend = Math.floor(Math.random() * 20) - 5; // Random trend for demo
        document.getElementById('accidentTrend').textContent = `${trend > 0 ? '+' : ''}${trend}%`;
        document.getElementById('accidentTrend').className = `trend ${trend > 0 ? 'up' : trend < 0 ? 'down' : 'stable'}`;
    }
    else if (zoneType === 'tourism') {
        document.getElementById('tourismHotspots').textContent = zoneData.length;
        const avgRating = (zoneData.reduce((sum, zone) => sum + zone.rating, 0) / zoneData.length).toFixed(1);
        document.getElementById('tourismDensity').textContent = `${avgRating} ★`;
    }
    
    // Update zone list
    container.innerHTML = zoneData.map(zone => {
        if (zoneType === 'crime') {
            return `
                <div class="zone-item" data-id="${zone.id}" data-coords="${zone.coordinates}">
                    <div class="zone-icon crime">
                        <i class="fas fa-shield-alt"></i>
                    </div>
                    <div class="zone-info">
                        <div class="zone-name">${zone.name}</div>
                        <div class="zone-meta">
                            <span>${zone.count} incidents</span>
                            <span class="trend ${zone.trend}">${zone.trendValue}% ${zone.trend === 'up' ? '↑' : zone.trend === 'down' ? '↓' : '→'}</span>
                        </div>
                    </div>
                </div>
            `;
        } else if (zoneType === 'accident') {
            return `
                <div class="zone-item" data-id="${zone.id}" data-coords="${zone.coordinates}">
                    <div class="zone-icon accident">
                        <i class="fas fa-car-crash"></i>
                    </div>
                    <div class="zone-info">
                        <div class="zone-name">${zone.name}</div>
                        <div class="zone-meta">
                            <span>${zone.count} accidents</span>
                            <span class="severity ${zone.severity.toLowerCase()}">${zone.severity} risk</span>
                        </div>
                    </div>
                </div>
            `;
        } else if (zoneType === 'tourism') {
            return `
                <div class="zone-item" data-id="${zone.id}" data-coords="${zone.coordinates}">
                    <div class="zone-icon tourism">
                        <i class="fas fa-umbrella-beach"></i>
                    </div>
                    <div class="zone-info">
                        <div class="zone-name">${zone.name}</div>
                        <div class="zone-meta">
                            <span>${zone.rating} ★</span>
                            <span>${zone.density} density</span>
                        </div>
                    </div>
                </div>
            `;
        }
    }).join('');
    
    // Add click handlers to zone items
    container.querySelectorAll('.zone-item').forEach(item => {
        item.addEventListener('click', function() {
            const coords = this.getAttribute('data-coords').split(',').map(Number);
            if (coords.length === 2) {
                // Center map on the selected zone
                map.setView(coords, 14);
            }
        });
    });
}

// Update map with zone data
function updateMapWithZoneData(zoneType) {
    // Clear existing zone layers
    if (window.zoneLayer) {
        map.removeLayer(window.zoneLayer);
    }
    
    const zoneData = ZONE_DATA[zoneType] || [];
    const zoneLayer = L.layerGroup().addTo(map);
    window.zoneLayer = zoneLayer;
    
    zoneData.forEach(zone => {
        if (!zone.coordinates) return;
        
        let marker;
        
        if (zoneType === 'crime') {
            // Create a circle marker for crime zones
            marker = L.circleMarker(zone.coordinates, {
                radius: 10 + (zone.count / 5),
                fillColor: '#805ad5',
                color: '#fff',
                weight: 2,
                opacity: 1,
                fillOpacity: 0.7
            });
        } else if (zoneType === 'accident') {
            // Create a triangle marker for accident zones
            marker = L.marker(zone.coordinates, {
                icon: L.divIcon({
                    className: 'accident-zone-marker',
                    html: '<i class="fas fa-car-crash"></i>',
                    iconSize: [30, 30],
                    iconAnchor: [15, 30],
                    popupAnchor: [0, -30]
                })
            });
        } else if (zoneType === 'tourism') {
            // Create a custom marker for tourism zones
            marker = L.marker(zone.coordinates, {
                icon: L.divIcon({
                    className: 'tourism-zone-marker',
                    html: '<i class="fas fa-umbrella-beach"></i>',
                    iconSize: [30, 30],
                    iconAnchor: [15, 30],
                    popupAnchor: [0, -30]
                })
            });
        }
        
        if (marker) {
            // Add popup with zone info
            const popupContent = `
                <div class="zone-popup">
                    <h4>${zone.name}</h4>
                    ${zone.count ? `<div><strong>Incidents:</strong> ${zone.count}</div>` : ''}
                    ${zone.rating ? `<div><strong>Rating:</strong> ${zone.rating} ★</div>` : ''}
                    ${zone.density ? `<div><strong>Density:</strong> ${zone.density}</div>` : ''}
                    ${zone.severity ? `<div><strong>Risk:</strong> <span class="severity ${zone.severity.toLowerCase()}">${zone.severity}</span></div>` : ''}
                </div>
            `;
            
            marker.bindPopup(popupContent);
            marker.addTo(zoneLayer);
        }
    });
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initZoneHandler);
