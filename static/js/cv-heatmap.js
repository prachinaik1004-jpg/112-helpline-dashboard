// CV Heatmap Visualization
class CVHeatmap extends EventTarget {
    constructor(containerId) {
        super();
        this.container = document.getElementById(containerId);
        this.map = null;
        this.heatLayer = null;
        this.zoneLayers = [];
        this.zoneGroups = {
            high: [],
            medium: [],
            low: []
        };
        this.visibleZones = {
            high: true,
            medium: true,
            low: true
        };
        
        // Marking functionality properties
        this.drawingMode = false;
        this.currentMarkers = [];
        this.drawnItems = new L.FeatureGroup();
        this.cvProcessor = new CVDataProcessor();
        this.currentData = [];
        this.currentZones = [];
        this.stats = {
            totalHotspots: 0,
            highRiskZones: 0,
            mediumRiskZones: 0,
            lowRiskZones: 0,
            lastUpdated: new Date().toISOString()
        };
        
        // Default options
        this.options = {
            radius: 25,
            blur: 15,
            maxZoom: 17,
            minOpacity: 0.5,
            gradient: {
                0.4: 'blue',
                0.6: 'cyan',
                0.7: 'lime',
                0.8: 'yellow',
                1.0: 'red'
            }
        };
        
        this.init();
    }
    
    // Initialize the map and UI
    async init() {
        try {
            this.initMap();
            await this.loadData();
            this.setupControls();
            this.updateHeatmap();
            this.dispatchEvent(new Event('ready'));
        } catch (error) {
            console.error('Error initializing heatmap:', error);
            this.dispatchEvent(new CustomEvent('error', { detail: error }));
            throw error; // Re-throw to be caught by the constructor
        }
    }
    
    // Initialize Leaflet map
    initMap() {
        // Create map centered on Goa
        this.map = L.map(this.container, {
            center: [15.4909, 73.8278],
            zoom: 11,
            zoomControl: true,
            attributionControl: true,
            drawControl: true
        });
        
        // Add base map layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: ' OpenStreetMap contributors'
        }).addTo(this.map);
        
        // Add scale control
        L.control.scale({imperial: false}).addTo(this.map);
    }
    
    // Load CV data
    async loadData() {
        try {
            // Try different possible data file locations - prioritize sample-data/cv-data.csv first
            const possibleDataPaths = [
                './sample-data/cv-data.csv',
                'sample-data/cv-data.csv',
                '/sample-data/cv-data.csv',
                '/data/cv-data.csv',
                './data/cv-data.csv',
                '../data/cv-data.csv',
                'cv-data.csv'
            ];
            
            let lastError = null;
            
            for (const dataUrl of possibleDataPaths) {
                try {
                    console.log(`Attempting to load data from: ${dataUrl}`);
                    const response = await fetch(dataUrl, { method: 'HEAD' });
                    if (!response.ok) {
                        console.log(`File not found at ${dataUrl}, trying next location...`);
                        continue;
                    }
                    
                    await this.cvProcessor.loadCVData(dataUrl);
                    this.currentData = this.cvProcessor.getHeatmapData();
                    this.currentZones = this.cvProcessor.getZoneBoundaries();
                    
                    if (this.currentData && this.currentData.length > 0) {
                        console.log(`Successfully loaded ${this.currentData.length} data points from ${dataUrl}`);
                        return; // Success!
                    } else {
                        throw new Error('No valid data points found in the loaded file');
                    }
                } catch (e) {
                    console.warn(`Failed to load data from ${dataUrl}:`, e);
                    lastError = e;
                }
            }
            
            // If we get here, all data loading attempts failed
            const errorMsg = lastError ? 
                `Failed to load CV data: ${lastError.message}` : 
                'Failed to load CV data from any known location';
            console.error(errorMsg);
            
            // Try to use sample data as fallback
            console.log('Attempting to use sample data as fallback...');
            this.useSampleData();
            
            if (!this.currentData || this.currentData.length === 0) {
                throw new Error('Failed to load data and no sample data available');
            } else {
                console.log(`Successfully loaded ${this.currentData.length} sample data points`);
            }
        } catch (error) {
            console.error('Fatal error in loadData:', error);
            this.dispatchEvent(new CustomEvent('error', { 
                detail: new Error(`Failed to load heatmap data: ${error.message}`) 
            }));
            throw error;
        }
    }
    
    // Use sample data if loading fails
    useSampleData() {
        console.log('Using sample data');
        
        // Generate sample data for demonstration
        const goaCenter = [15.4909, 73.8278];
        const sampleData = [];
        
        // Generate random points around Goa
        for (let i = 0; i < 100; i++) {
            const lat = goaCenter[0] + (Math.random() * 0.5 - 0.25);
            const lng = goaCenter[1] + (Math.random() * 0.5 - 0.25);
            const intensity = Math.random();
            
            if (Math.random() > 0.7) {
                // Create some hotspots
                sampleData.push([lat, lng, intensity * 10 + 5]);
            } else {
                sampleData.push([lat, lng, intensity * 5]);
            }
        }
        
        this.currentData = sampleData;
    }
    
    // Update the heatmap with current data
    updateHeatmap() {
        try {
            // Remove existing heat layer if it exists
            if (this.heatLayer) {
                this.map.removeLayer(this.heatLayer);
                this.heatLayer = null;
            }
            
            // Get heatmap data in the correct format
            const heatData = this.currentData.map(point => {
                // Handle both array and object formats
                if (Array.isArray(point)) {
                    return [point[0], point[1], point[2] || 1];
                } else if (point && typeof point === 'object') {
                    return [
                        point.lat || point.latitude || 0,
                        point.lng || point.longitude || 0,
                        point.intensity || point.value || 1
                    ];
                }
                return null;
            }).filter(Boolean);
            
            // Create new heat layer with current data
            if (heatData.length > 0) {
                console.log(`Adding ${heatData.length} heat points to map`);
                this.heatLayer = L.heatLayer(heatData, this.options).addTo(this.map);
                
                // Fit map to heatmap bounds if we have data
                const bounds = this.calculateDataBounds(heatData);
                if (bounds && bounds.isValid()) {
                    this.map.fitBounds(bounds, { padding: [50, 50] });
                }
            } else {
                console.warn('No valid heatmap data to display');
            }
        } catch (error) {
            console.error('Error updating heatmap:', error);
            this.dispatchEvent(new CustomEvent('error', { detail: error }));
        }
    }
    
    // Calculate bounds for the given data points
    calculateDataBounds(points) {
        if (!points || points.length === 0) return null;
        
        try {
            // Extract valid coordinates
            const coords = points
                .map(p => ({
                    lat: Array.isArray(p) ? p[0] : (p.lat || p.latitude),
                    lng: Array.isArray(p) ? p[1] : (p.lng || p.longitude)
                }))
                .filter(p => p.lat !== undefined && p.lng !== undefined && 
                           !isNaN(p.lat) && !isNaN(p.lng));
            
            if (coords.length === 0) return null;
            
            // Calculate bounds
            const lats = coords.map(p => p.lat);
            const lngs = coords.map(p => p.lng);
            
            const south = Math.min(...lats);
            const north = Math.max(...lats);
            const west = Math.min(...lngs);
            const east = Math.max(...lngs);
            
            // Ensure valid bounds
            if (south >= north || west >= east) {
                // If points are too close, create a small bounding box around the center
                const center = {
                    lat: (south + north) / 2,
                    lng: (west + east) / 2
                };
                const padding = 0.01; // ~1km at equator
                
                return L.latLngBounds(
                    [center.lat - padding, center.lng - padding],
                    [center.lat + padding, center.lng + padding]
                );
            }
            
            // Add some padding to the bounds
            const padding = 0.01; // ~1km at equator
            return L.latLngBounds(
                [south - padding, west - padding],
                [north + padding, east + padding]
            );
        } catch (error) {
            console.error('Error calculating bounds:', error);
            return null;
        }
    }
    
    // Update zone visualizations with circular zones
    updateZones() {
        // Clear existing zone layers
        this.clearZones();
        
        // Reset stats
        this.stats = {
            totalHotspots: 0,
            highRiskZones: 0,
            mediumRiskZones: 0,
            lowRiskZones: 0,
            lastUpdated: new Date().toISOString()
        };
        
        // Process each zone
        this.currentZones.forEach(zone => {
            if (!zone.bounds || !zone.count || zone.count === 0) return;
            
            const level = zone.level.toLowerCase();
            const centerLat = (zone.bounds.south + zone.bounds.north) / 2;
            const centerLng = (zone.bounds.west + zone.bounds.east) / 2;
            
            // Calculate radius based on zone area (in meters)
            const latDistance = this.calculateDistance(
                zone.bounds.south, centerLng,
                zone.bounds.north, centerLng
            ) * 1000; // Convert km to meters
            
            const lngDistance = this.calculateDistance(
                centerLat, zone.bounds.west,
                centerLat, zone.bounds.east
            ) * 1000; // Convert km to meters
            
            // Use the larger dimension for the radius
            const radius = Math.max(latDistance, lngDistance) / 2;
            
            // Adjust styling based on risk level
            const styles = this.getZoneStyle(level);
            
            // Create circle for the zone (only for medium and low risk)
            if (level !== 'high') {
                const zoneCircle = L.circle([centerLat, centerLng], {
                    radius: radius,
                    color: styles.color,
                    fillColor: styles.color,
                    weight: styles.weight,
                    opacity: 1,
                    fillOpacity: styles.fillOpacity,
                    dashArray: styles.dashArray,
                    className: `zone-circle zone-${level}-risk`
                });
                
                // Add to the appropriate group based on risk level
                if (this.visibleZones[level]) {
                    zoneCircle.addTo(this.map);
                }
                this.zoneGroups[level].push(zoneCircle);
                
                // Add zone label for medium/low risk
                const label = L.divIcon({
                    className: `zone-label zone-${level}-label`,
                    html: `<div>${level.toUpperCase()} RISK</div>`,
                    iconSize: [100, 30],
                    iconAnchor: [50, 15]
                });
                
                const marker = L.marker([centerLat, centerLng], {
                    icon: label,
                    interactive: false
                });
                
                if (this.visibleZones[level]) {
                    marker.addTo(this.map);
                }
                this.zoneGroups[level].push(marker);
                
                // Add popup with zone info
                const area = this.calculateArea(zone.bounds);
                const density = (zone.count / area).toFixed(2);
                zoneCircle.bindPopup(this.createZonePopup(level, styles.color, zone.count, area, density));
            }
            
            // Update stats
            this.stats.totalHotspots += zone.count;
            if (level === 'high') this.stats.highRiskZones++;
            else if (level === 'medium') this.stats.mediumRiskZones++;
            else if (level === 'low') this.stats.lowRiskZones++;
        });
        
        // Create high-risk zone markers (with special styling)
        this.createHighRiskMarkers();
        
        // Update stats display
        this.updateStatsDisplay();
        
        // Add CSS for the zone labels and circles
        this.addZoneStyles();
    }
    
    // Calculate distance between two coordinates in kilometers
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Earth's radius in km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }
    
    // Get zone style based on risk level
    getZoneStyle(level) {
        const styles = {
            high: {
                color: '#ff0000',  // Red
                weight: 4,
                fillOpacity: 0.15,
                dashArray: null
            },
            medium: {
                color: '#ff9900',  // Orange
                weight: 3,
                fillOpacity: 0.1,
                dashArray: '8, 4'
            },
            low: {
                color: '#ffff00',  // Yellow
                weight: 2,
                fillOpacity: 0.08,
                dashArray: '4, 4'
            }
        };
        
        return styles[level] || styles.low;
    }
    
    // Create popup content for zone
    createZonePopup(level, color, count, area, density) {
        const riskLabels = {
            high: 'High Risk Zone',
            medium: 'Medium Risk Zone',
            low: 'Low Risk Zone'
        };
        
        return `
            <div class="zone-popup">
                <h4 style="color: ${color}; margin: 5px 0 10px 0; text-transform: uppercase;">
                    ${riskLabels[level] || level} Risk Zone
                </h4>
                <div style="margin-bottom: 8px;">
                    <strong>Risk Level:</strong> 
                    <span style="color: ${color}; font-weight: bold;">${level.toUpperCase()}</span>
                </div>
                <div style="margin-bottom: 6px;">
                    <strong>Points Detected:</strong> ${count.toLocaleString()}
                </div>
                <div style="margin-bottom: 6px;">
                    <strong>Area:</strong> ${area.toFixed(2)} km²
                </div>
                <div style="margin-bottom: 6px;">
                    <strong>Density:</strong> ${density} points/km²
                </div>
                <div style="margin-top: 10px; font-size: 0.9em; color: #666;">
                    Click outside to close
                </div>
            </div>
        `;
    }
    
    // Add pulsing effect to high risk zones
    addPulsingEffect(circle, color) {
        // Create a pulsing circle effect
        const pulsingCircle = L.circle(
            circle.getLatLng(),
            {
                radius: circle.getRadius(),
                color: color,
                fillColor: color,
                weight: 1,
                opacity: 0.7,
                fillOpacity: 0.1,
                className: 'pulsing-circle'
            }
        ).addTo(this.map);
        
        // Animate the pulsing effect
        let currentRadius = circle.getRadius();
        let growing = false;
        
        const pulse = () => {
            if (growing) {
                currentRadius += 20;
                if (currentRadius > circle.getRadius() * 1.3) growing = false;
            } else {
                currentRadius -= 20;
                if (currentRadius < circle.getRadius() * 0.9) growing = true;
            }
            
            pulsingCircle.setRadius(currentRadius);
            
            // Continue animation if the circle is still on the map
            if (this.map.hasLayer(pulsingCircle)) {
                requestAnimationFrame(pulse);
            }
        };
        
        // Start the animation
        pulse();
        
        // Add to zone layers for cleanup
        this.zoneLayers.push(pulsingCircle);
    }
    
    // Create high-risk zone markers
    createHighRiskMarkers() {
        // Clear existing markers
        if (this.highRiskMarkers) {
            this.highRiskMarkers.clearLayers();
        } else {
            this.highRiskMarkers = L.layerGroup();
        }

        // Add markers for high-risk zones
        this.currentZones.forEach(zone => {
            if (zone.level.toLowerCase() === 'high' && zone.bounds) {
                const centerLat = (zone.bounds.south + zone.bounds.north) / 2;
                const centerLng = (zone.bounds.west + zone.bounds.east) / 2;
                
                // Create a custom icon for high-risk zones
                const highRiskIcon = L.divIcon({
                    className: 'high-risk-marker',
                    html: '⚠️', // Using warning emoji as marker
                    iconSize: [30, 30],
                    iconAnchor: [15, 30],
                    popupAnchor: [0, -30]
                });

                // Create marker and add to layer group
                const marker = L.marker([centerLat, centerLng], {
                    icon: highRiskIcon,
                    zIndexOffset: 1000 // Ensure markers appear above other layers
                });

                // Add popup with zone information
                const area = this.calculateArea(zone.bounds);
                const density = (zone.count / area).toFixed(2);
                marker.bindPopup(this.createZonePopup('high', '#ff0000', zone.count, area, density));
                
                this.highRiskMarkers.addLayer(marker);
            }
        });

        // Add the layer group to the map if high-risk zones are visible
        if (this.visibleZones.high) {
            this.highRiskMarkers.addTo(this.map);
        }
        
        // Add drawn items to the map
        this.map.addLayer(this.drawnItems);
    }
    
    // Create low-risk zone markers
    createLowRiskMarkers() {
        // Clear existing markers
        if (this.lowRiskMarkers) {
            this.lowRiskMarkers.clearLayers();
        } else {
            this.lowRiskMarkers = L.layerGroup();
        }

        // Add markers for low-risk zones
        this.currentZones.forEach(zone => {
            if (zone.level.toLowerCase() === 'low' && zone.bounds) {
                const centerLat = (zone.bounds.south + zone.bounds.north) / 2;
                const centerLng = (zone.bounds.west + zone.bounds.east) / 2;
                
                // Create a custom icon for low-risk zones
                const lowRiskIcon = L.divIcon({
                    className: 'low-risk-marker',
                    html: 'ℹ️', // Using info emoji as marker
                    iconSize: [30, 30],
                    iconAnchor: [15, 30],
                    popupAnchor: [0, -30]
                });

                // Create marker and add to layer group
                const marker = L.marker([centerLat, centerLng], {
                    icon: lowRiskIcon,
                    zIndexOffset: 500 // Ensure markers appear above other layers
                });

                // Add popup with zone information
                const area = this.calculateArea(zone.bounds);
                const density = (zone.count / area).toFixed(2);
                marker.bindPopup(this.createZonePopup('low', '#ffff00', zone.count, area, density));
                
                this.lowRiskMarkers.addLayer(marker);
            }
        });

        // Add the layer group to the map if low-risk zones are visible
        if (this.visibleZones.low) {
            this.lowRiskMarkers.addTo(this.map);
        }
    }
    
    // Add CSS for the zone labels and circles
    addZoneStyles() {
        if (document.getElementById('zone-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'zone-styles';
        style.textContent = `
            /* Zone labels */
            .zone-label {
                text-align: center;
                font-weight: bold;
                text-shadow: -1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 1px 1px 0 #fff;
                pointer-events: none;
                font-size: 11px;
                text-transform: uppercase;
                letter-spacing: 1px;
                white-space: nowrap;
                font-family: 'Inter', sans-serif;
            }
            
            /* Zone label colors */
            .zone-high-label div {
                color: #ff0000;
                font-weight: 800;
            }
            .zone-medium-label div {
                color: #ff9900;
                font-weight: 700;
            }
            .zone-low-label div {
                color: #666600;
                font-weight: 600;
            }
            
            /* Zone circle styles */
            .zone-circle {
                transition: all 0.3s ease;
            }
            
            .zone-high-risk {
                box-shadow: 0 0 10px rgba(255, 0, 0, 0.5);
            }
            
            .zone-medium-risk {
                box-shadow: 0 0 8px rgba(255, 153, 0, 0.4);
            }
            
            .zone-low-risk {
                box-shadow: 0 0 6px rgba(255, 255, 0, 0.3);
            }
            
            /* Pulsing animation for high risk zones */
            @keyframes pulse {
                0% { transform: scale(1); opacity: 0.7; }
                50% { transform: scale(1.05); opacity: 0.9; }
                100% { transform: scale(1); opacity: 0.7; }
            }
            
            .pulsing-circle {
                animation: pulse 2s infinite;
                pointer-events: none;
            }
            
            /* Popup styles */
            .zone-popup {
                font-family: 'Inter', sans-serif;
                min-width: 220px;
            }
            
            .zone-popup h4 {
                margin: 0 0 10px 0;
                padding-bottom: 5px;
                border-bottom: 1px solid #eee;
            }
        `;
        document.head.appendChild(style);
    }
    
    // Add CSS styles for zone labels
    addZoneLabelStyles() {
        if (document.getElementById('zone-label-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'zone-label-styles';
        style.textContent = `
            .zone-label {
                text-align: center;
                font-weight: bold;
                text-shadow: -1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 1px 1px 0 #fff;
                pointer-events: none;
                font-size: 11px;
                text-transform: uppercase;
                letter-spacing: 1px;
                white-space: nowrap;
            }
            .zone-high-label div {
                color: #ff0000;
            }
            .zone-medium-label div {
                color: #ff9900;
            }
            .zone-low-label div {
                color: #666600;
            }
            .zone-high-risk {
                border: 2px solid #ff0000 !important;
            }
            .zone-medium-risk {
                border: 2px solid #ff9900 !important;
            }
            .zone-low-risk {
                border: 2px solid #ffff00 !important;
            }
        `;
        document.head.appendChild(style);
    }
    
    // Calculate area of a bounding box in square kilometers
    calculateArea(bounds) {
        const R = 6371; // Earth's radius in km
        const lat1 = bounds.south * Math.PI / 180;
        const lat2 = bounds.north * Math.PI / 180;
        const dLat = (bounds.north - bounds.south) * Math.PI / 180;
        const dLng = (bounds.east - bounds.west) * Math.PI / 180;
        
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                 Math.cos(lat1) * Math.cos(lat2) * 
                 Math.sin(dLng/2) * Math.sin(dLng/2);
                 
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const area = R * R * c;
        
        return area;
    }
    
    // Clear all zone visualizations
    clearZones() {
        // Clear all zone layers
        Object.values(this.zoneGroups).forEach(group => {
            group.forEach(layer => {
                if (this.map.hasLayer(layer)) {
                    this.map.removeLayer(layer);
                }
            });
            group.length = 0; // Clear the array
        });
        
        // Clear any remaining layers
        this.zoneLayers.forEach(layer => {
            if (this.map.hasLayer(layer)) {
                this.map.removeLayer(layer);
            }
        });
        this.zoneLayers = [];
        
        // Reset stats
        this.stats = {
            totalHotspots: 0,
            highRiskZones: 0,
            mediumRiskZones: 0,
            lowRiskZones: 0,
            lastUpdated: new Date().toISOString()
        };
    }
    
    // Toggle zone visibility
    toggleZones(level) {
        // Update high-risk markers visibility
        if (level === 'high' && this.highRiskMarkers) {
            if (this.visibleZones.high) {
                this.highRiskMarkers.addTo(this.map);
            } else {
                this.highRiskMarkers.removeFrom(this.map);
            }
        }
        if (level === 'low' && this.lowRiskMarkers) {
            if (this.visibleZones.low) {
                this.lowRiskMarkers.addTo(this.map);
            } else {
                this.lowRiskMarkers.removeFrom(this.map);
            }
        }
        if (level) {
            // Toggle the specified zone level
            this.visibleZones[level] = !this.visibleZones[level];
            
            // Update all zones of this level
            this.zoneGroups[level].forEach(layer => {
                if (this.visibleZones[level]) {
                    if (!this.map.hasLayer(layer)) {
                        layer.addTo(this.map);
                    }
                } else {
                    if (this.map.hasLayer(layer)) {
                        this.map.removeLayer(layer);
                    }
                }
            });
        } else {
            // Toggle all zones if no specific level is provided
            Object.keys(this.visibleZones).forEach(zoneLevel => {
                this.visibleZones[zoneLevel] = !this.visibleZones[zoneLevel];
                this.toggleZones(zoneLevel);
            });
        }
        
        // Update stats display
        this.updateStatsDisplay();
    }
    
    // Update the stats display
    updateStatsDisplay() {
        // Update the stats in the UI
        if (document.getElementById('totalHotspots')) {
            document.getElementById('totalHotspots').textContent = this.stats.totalHotspots.toLocaleString();
        }
        if (document.getElementById('highRiskZones')) {
            document.getElementById('highRiskZones').textContent = this.stats.highRiskZones.toLocaleString();
        }
        if (document.getElementById('mediumRiskZones')) {
            document.getElementById('mediumRiskZones').textContent = this.stats.mediumRiskZones.toLocaleString();
        }
        if (document.getElementById('lowRiskZones')) {
            document.getElementById('lowRiskZones').textContent = this.stats.lowRiskZones.toLocaleString();
        }
        if (document.getElementById('lastUpdated')) {
            document.getElementById('lastUpdated').textContent = new Date().toLocaleTimeString();
        }
    }
    
    // Export zone data to CSV
    exportZoneData() {
        if (!this.currentZones || this.currentZones.length === 0) {
            alert('No zone data available to export');
            return;
        }
        
        // Prepare CSV content
        let csvContent = 'Level,Count,Latitude,Longitude,Area (km²),Density\n';
        
        this.currentZones.forEach(zone => {
            if (!zone.bounds) return;
            
            const centerLat = (zone.bounds.south + zone.bounds.north) / 2;
            const centerLng = (zone.bounds.west + zone.bounds.east) / 2;
            const area = this.calculateArea(zone.bounds);
            const density = zone.count ? (zone.count / area).toFixed(2) : 0;
            
            csvContent += `"${zone.level}",${zone.count || 0},${centerLat},${centerLng},${area.toFixed(2)},${density}\n`;
        });
        
        // Create download link
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `risk_zones_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    
    // Toggle drawing mode
    toggleDrawingMode() {
        this.drawingMode = !this.drawingMode;
        
        if (this.drawingMode) {
            // Change cursor to crosshair when in drawing mode
            this.map.getContainer().style.cursor = 'crosshair';
            
            // Add click handler for placing markers
            this.map.off('click');
            this.map.on('click', (e) => this.placeMarker(e.latlng));
            
            // Add right-click handler to finish drawing
            this.map.off('contextmenu');
            this.map.on('contextmenu', () => this.finishDrawing());
            
            alert('Click on the map to place markers. Right-click to finish.');
        } else {
            this.finishDrawing();
        }
    }
    
    // Place a marker at the clicked location
    placeMarker(latlng) {
        const marker = L.marker(latlng, {
            draggable: true,
            icon: L.divIcon({
                className: 'custom-marker',
                html: '📍', // Using map pin emoji as marker
                iconSize: [30, 30],
                iconAnchor: [15, 30]
            })
        }).addTo(this.map);
        
        // Add popup with marker info
        marker.bindPopup(`<div>Custom Marker</div>
                        <div>Lat: ${latlng.lat.toFixed(6)}</div>
                        <div>Lng: ${latlng.lng.toFixed(6)}</div>
                        <button class="btn btn-sm btn-danger remove-marker">Remove</button>`)
              .on('popupopen', (e) => {
                  // Add event listener for remove button
                  const popup = e.popup.getElement();
                  const removeBtn = popup.querySelector('.remove-marker');
                  if (removeBtn) {
                      removeBtn.onclick = () => {
                          this.map.removeLayer(marker);
                          this.currentMarkers = this.currentMarkers.filter(m => m !== marker);
                      };
                  }
              });
        
        this.currentMarkers.push(marker);
        this.drawnItems.addLayer(marker);
    }
    
    // Finish drawing and create a zone if there are markers
    finishDrawing() {
        this.drawingMode = false;
        this.map.getContainer().style.cursor = '';
        
        if (this.currentMarkers.length > 0) {
            // Create a polygon from the markers
            const points = this.currentMarkers.map(marker => [
                marker.getLatLng().lat,
                marker.getLatLng().lng
            ]);
            
            // Close the polygon if it has at least 3 points
            if (points.length >= 3) {
                points.push(points[0]); // Close the polygon
                
                const polygon = L.polygon(points, {
                    color: '#3388ff',
                    weight: 2,
                    fillColor: '#3388ff',
                    fillOpacity: 0.2
                }).addTo(this.map);
                
                // Add popup with zone info
                polygon.bindPopup(`<div>Custom Zone</div>
                                <div>Points: ${points.length - 1}</div>
                                <button class="btn btn-sm btn-danger remove-zone">Remove Zone</button>`)
                      .on('popupopen', (e) => {
                          const popup = e.popup.getElement();
                          const removeBtn = popup.querySelector('.remove-zone');
                          if (removeBtn) {
                              removeBtn.onclick = () => {
                                  this.map.removeLayer(polygon);
                                  this.drawnItems.removeLayer(polygon);
                              };
                          }
                      });
                
                this.drawnItems.addLayer(polygon);
            }
            
            // Clear current markers
            this.currentMarkers.forEach(marker => this.map.removeLayer(marker));
            this.currentMarkers = [];
        }
    }
    
    // Set up UI controls
    setupControls() {
        // Add control panel
        const controlPanel = L.control({position: 'topright'});
        
        controlPanel.onAdd = () => {
            const div = L.DomUtil.create('div', 'cv-heatmap-controls');
            div.innerHTML = `
                <div class="control-panel">
                    <h4>CV Heatmap Controls</h4>
                    <div class="form-group">
                        <label>Radius: <span id="radiusValue">${this.options.radius}</span></label>
                        <input type="range" id="radiusSlider" min="5" max="50" value="${this.options.radius}">
                    </div>
                    <div class="form-group">
                        <label>Blur: <span id="blurValue">${this.options.blur}</span></label>
                        <input type="range" id="blurSlider" min="5" max="30" value="${this.options.blur}">
                    </div>
                    <div class="form-group">
                        <label>Opacity: <span id="opacityValue">${this.options.minOpacity}</span></label>
                        <input type="range" id="opacitySlider" min="0.1" max="1" step="0.1" value="${this.options.minOpacity}">
                    </div>
                    <div class="form-group zone-toggle-group">
                        <button class="zone-toggle-btn active" data-level="high">High Risk</button>
                        <button class="zone-toggle-btn active" data-level="medium">Medium Risk</button>
                        <button class="zone-toggle-btn active" data-level="low">Low Risk</button>
                    </div>
                    <div class="form-group">
                        <button id="drawZone" class="btn">Draw Zone</button>
                        <button id="exportData" class="btn">Export Data</button>
                        <button id="refreshData" class="btn">Refresh Data</button>
                    </div>
                </div>
            `;
            
            // Add event listeners
            const radiusSlider = div.querySelector('#radiusSlider');
            const blurSlider = div.querySelector('#blurSlider');
            const opacitySlider = div.querySelector('#opacitySlider');
            const exportBtn = div.querySelector('#exportData');
            const refreshBtn = div.querySelector('#refreshData');
            const drawZoneBtn = div.querySelector('#drawZone');
            const toggleBtns = div.querySelectorAll('.zone-toggle-btn');
            
            // Add draw zone button click handler
            drawZoneBtn.addEventListener('click', () => this.toggleDrawingMode());
            
            radiusSlider.addEventListener('input', (e) => {
                this.options.radius = parseInt(e.target.value);
                div.querySelector('#radiusValue').textContent = this.options.radius;
                this.updateHeatmap();
            });
            
            blurSlider.addEventListener('input', (e) => {
                this.options.blur = parseInt(e.target.value);
                div.querySelector('#blurValue').textContent = this.options.blur;
                this.updateHeatmap();
            });
            
            opacitySlider.addEventListener('input', (e) => {
                this.options.minOpacity = parseFloat(e.target.value);
                div.querySelector('#opacityValue').textContent = this.options.minOpacity.toFixed(1);
                this.updateHeatmap();
            });
            
            exportBtn.addEventListener('click', () => this.exportZoneData());
            
            refreshBtn.addEventListener('click', async () => {
                await this.loadData();
                this.updateHeatmap();
            });
            
            toggleBtns.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const level = e.target.dataset.level;
                    e.target.classList.toggle('active');
                    this.toggleZones(level);
                });
            });
            
            toggleZonesBtn.addEventListener('click', () => {
                this.zoneLayers.forEach(layer => {
                    if (this.map.hasLayer(layer)) {
                        this.map.removeLayer(layer);
                    } else {
                        layer.addTo(this.map);
                    }
                });
            });
            
            refreshBtn.addEventListener('click', async () => {
                await this.loadData();
                this.updateHeatmap();
            });
            
            return div;
        };
        
        controlPanel.addTo(this.map);
        
        // Add legend
        this.addLegend();
    }
    
    // Add legend to the map
    addLegend() {
        const legend = L.control({position: 'bottomright'});
        
        legend.onAdd = () => {
            const div = L.DomUtil.create('div', 'cv-heatmap-legend');
            div.innerHTML = `
                <h4>Heatmap Legend</h4>
                <div class="legend-gradient"></div>
                <div class="legend-labels">
                    <span>Low</span>
                    <span>High</span>
                </div>
                <div class="legend-zones">
                    <div class="zone-legend">
                        <span class="zone-color" style="background: #ffff00"></span>
                        <span>Low Risk</span>
                    </div>
                    <div class="zone-legend">
                        <span class="zone-color" style="background: #ff9900"></span>
                        <span>Medium Risk</span>
                    </div>
                    <div class="zone-legend">
                        <span class="zone-color" style="background: #ff0000"></span>
                        <span>High Risk</span>
                    </div>
                </div>
            `;
            
            // Add CSS for the legend
            const style = document.createElement('style');
            style.textContent = `
                .cv-heatmap-legend {
                    background: white;
                    padding: 10px;
                    border-radius: 5px;
                    box-shadow: 0 0 15px rgba(0,0,0,0.2);
                    line-height: 1.4;
                }
                .cv-heatmap-legend h4 {
                    margin: 0 0 10px 0;
                    font-size: 14px;
                }
                .legend-gradient {
                    height: 10px;
                    background: linear-gradient(to right, blue, cyan, lime, yellow, red);
                    margin: 5px 0;
                    border-radius: 3px;
                }
                .legend-labels {
                    display: flex;
                    justify-content: space-between;
                    font-size: 12px;
                    color: #555;
                }
                .legend-zones {
                    margin-top: 10px;
                    border-top: 1px solid #eee;
                    padding-top: 10px;
                }
                .zone-legend {
                    display: flex;
                    align-items: center;
                    margin: 5px 0;
                    font-size: 12px;
                }
                .zone-color {
                    display: inline-block;
                    width: 15px;
                    height: 15px;
                    margin-right: 8px;
                    border: 1px solid #999;
                    border-radius: 3px;
                }
            `;
            div.appendChild(style);
            
            return div;
        };
        
        legend.addTo(this.map);
    }
}

// Initialize the heatmap when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.cvHeatmap = new CVHeatmap('heatmapContainer');
});
