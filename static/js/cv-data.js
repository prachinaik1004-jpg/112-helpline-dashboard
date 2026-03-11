// CV Data Processing for Heatmap Visualization
class CVDataProcessor {
    constructor() {
        this.cvData = [];
        this.heatPoints = [];
        this.zones = {};
    }

    // Load and parse CV data from a CSV file
    async loadCVData(url) {
        try {
            const response = await fetch(url);
            const csvText = await response.text();
            this.cvData = this.parseCSV(csvText);
            this.processCVData();
            return this.cvData;
        } catch (error) {
            console.error('Error loading CV data:', error);
            return [];
        }
    }

    // Parse CSV data into JSON format
    parseCSV(csvText) {
        try {
            // Normalize line endings and split into lines
            const lines = csvText.replace(/\r\n?/g, '\n').split('\n').filter(line => line.trim() !== '');
            
            if (lines.length < 2) {
                console.warn('CSV file is empty or has no data rows');
                return [];
            }
            
            // Parse headers and find required columns
            const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
            
            // Find column indices
            const latIndex = headers.findIndex(h => ['lat', 'latitude'].includes(h));
            const lngIndex = headers.findIndex(h => ['lng', 'long', 'longitude'].includes(h));
            const typeIndex = headers.findIndex(h => ['type', 'category', 'event_type'].includes(h));
            const confidenceIndex = headers.findIndex(h => ['confidence', 'score', 'probability'].includes(h));
            const descIndex = headers.findIndex(h => ['description', 'desc', 'details'].includes(h));
            
            if (latIndex === -1 || lngIndex === -1) {
                console.warn('CSV is missing required latitude/longitude columns');
                return [];
            }
            
            // Process data rows
            return lines.slice(1).map((line, index) => {
                // Split line into values, handling quoted values with commas
                const values = [];
                let inQuotes = false;
                let currentValue = '';
                
                for (let i = 0; i < line.length; i++) {
                    const char = line[i];
                    
                    if (char === '"') {
                        inQuotes = !inQuotes;
                    } else if (char === ',' && !inQuotes) {
                        values.push(currentValue.trim());
                        currentValue = '';
                    } else {
                        currentValue += char;
                    }
                }
                values.push(currentValue.trim()); // Add the last value
                
                // Clean up quotes and trim whitespace
                const cleanValues = values.map(v => v.replace(/^"|"$/g, '').trim());
                
                // Create data object with required fields
                const row = {
                    lat: parseFloat(cleanValues[latIndex]),
                    lng: parseFloat(cleanValues[lngIndex]),
                    type: typeIndex >= 0 ? cleanValues[typeIndex] : 'unknown',
                    confidence: confidenceIndex >= 0 ? parseFloat(cleanValues[confidenceIndex]) : 1.0,
                    description: descIndex >= 0 ? cleanValues[descIndex] : ''
                };
                
                // Add all other columns as additional properties
                headers.forEach((header, i) => {
                    if (!['lat', 'lng', 'longitude', 'latitude', 'type', 'confidence', 'description'].includes(header)) {
                        row[header] = cleanValues[i];
                    }
                });
                
                // Validate coordinates
                if (isNaN(row.lat) || isNaN(row.lng) || row.lat < -90 || row.lat > 90 || row.lng < -180 || row.lng > 180) {
                    console.warn('Invalid coordinates in row:', cleanValues);
                    return null;
                }
                
                return row;
            }).filter(row => row !== null);
        } catch (error) {
            console.error('Error parsing CSV:', error);
            return [];
        }
    }

    // Process CV data into heatmap points
    processCVData() {
        if (!Array.isArray(this.cvData) || this.cvData.length === 0) {
            console.warn('No CV data available to process');
            this.heatPoints = [];
            this.zones = {};
            return;
        }
        
        // Process data points
        this.heatPoints = this.cvData.map(point => {
            // Skip invalid points
            if (!point || typeof point !== 'object') {
                console.warn('Invalid data point:', point);
                return null;
            }
            
            // Create heat point with required properties
            const heatPoint = {
                lat: point.lat,
                lng: point.lng,
                intensity: typeof point.confidence === 'number' ? point.confidence : 1.0,
                type: point.type,
                description: point.description,
                // Include all original properties
                ...point
            };
            
            return heatPoint;
        }).filter(Boolean); // Remove any null/undefined points
        
        // Group points by type for zone analysis
        const zones = {};
        this.heatPoints.forEach(point => {
            const type = point.type || 'unknown';
            if (!zones[type]) {
                zones[type] = {
                    points: [],
                    count: 0,
                    totalConfidence: 0
                };
            }
            zones[type].points.push([point.lat, point.lng]);
            zones[type].count++;
            zones[type].totalConfidence += point.intensity;
            
            // Calculate bounds for each zone
            if (!zones[type].bounds) {
                zones[type].bounds = L.latLngBounds([point.lat, point.lng], [point.lat, point.lng]);
            } else {
                zones[type].bounds.extend([point.lat, point.lng]);
            }
        });
        
        // Calculate average confidence for each zone
        Object.keys(zones).forEach(type => {
            zones[type].avgConfidence = zones[type].totalConfidence / zones[type].count;
        });
        
        this.zones = zones;
        
        return this.heatPoints;
    }
    
    // Calculate intensity based on record data
    calculateIntensity(record) {
        if (!record) return 1.0;
        
        let intensity = 1.0; // Base intensity
        
        // Adjust intensity based on confidence
        if (record.confidence) {
            const confidence = parseFloat(record.confidence);
            if (!isNaN(confidence)) {
                intensity *= confidence;
            }
        }
        
        // Adjust based on type
        if (record.type) {
            const typeWeights = {
                'pedestrian': 1.2,
                'vehicle': 1.5,
                'suspicious': 1.5,
                'crowd': 1.3,
                'default': 1.0
            };
            intensity *= typeWeights[record.type.toLowerCase()] || typeWeights.default;
        }
        
        return Math.min(10, Math.max(0.1, intensity));
    }
    
    // Process CV data into zones
    processZones() {
        const zones = {
            low: { points: [], bounds: null, color: 'blue', count: 0 },
            medium: { points: [], bounds: null, color: 'yellow', count: 0 },
            high: { points: [], bounds: null, color: 'red', count: 0 }
        };
        
        this.heatPoints.forEach(point => {
            const intensity = this.calculateIntensity(point);
            if (intensity < 2) {
                zones.low.points.push(point);
            } else if (intensity < 5) {
                zones.medium.points.push(point);
            } else {
                zones.high.points.push(point);
            }
        });
        
        // Calculate bounds for each zone
        Object.entries(zones).forEach(([level, zone]) => {
            if (zone.points.length > 0) {
                zone.bounds = this.calculateBounds(zone.points);
                
                // Expand bounds slightly for better visibility
                if (zone.bounds) {
                    const expandBy = level === 'high' ? 0.005 : 
                                    level === 'medium' ? 0.003 : 0.002;
                    
                    zone.bounds.north += expandBy;
                    zone.bounds.south -= expandBy;
                    zone.bounds.east += expandBy;
                    zone.bounds.west -= expandBy;
                }
            }
        });
        
        // Ensure high-risk zones are on top by processing them last
        this.zones = {
            low: zones.low,
            medium: zones.medium,
            high: zones.high
        };
        
        return this.zones;
    }
    
    // Helper method to calculate center of points
    calculateCenter(points) {
        if (!points || points.length === 0) return null;
        
        const sum = points.reduce((acc, point) => {
            return {
                lat: acc.lat + (point.lat || point[0]),
                lng: acc.lng + (point.lng || point[1])
            };
        }, { lat: 0, lng: 0 });
        
        return {
            lat: sum.lat / points.length,
            lng: sum.lng / points.length
        };
    }
    
    // Helper method to calculate radius based on points spread
    calculateRadius(points) {
        if (!points || points.length < 2) return 100; // Default 100m radius for single point
        
        const center = this.calculateCenter(points);
        const maxDistance = points.reduce((max, point) => {
            const lat = point.lat || point[0];
            const lng = point.lng || point[1];
            const distance = this.calculateDistance(center.lat, center.lng, lat, lng);
            return Math.max(max, distance);
        }, 0);
        
        // Add 20% padding and ensure minimum 100m radius
        return Math.max(100, maxDistance * 1.2);
    }
    
    // Calculate bounds for a set of points
    calculateBounds(points) {
        if (!points || points.length === 0) return null;
        
        const lats = points.map(p => p.lat || p[0]);
        const lngs = points.map(p => p.lng || p[1]);
        
        if (lats.length === 0 || lngs.length === 0) return null;
        
        return {
            north: Math.max(...lats) + 0.01,
            south: Math.min(...lats) - 0.01,
            east: Math.max(...lngs) + 0.01,
            west: Math.min(...lngs) - 0.01
        };
    }
    
    // Get heatmap data in format expected by Leaflet.heat
    getHeatmapData() {
        if (!this.heatPoints || !Array.isArray(this.heatPoints)) {
            console.warn('No heat points available');
            return [];
        }
        
        return this.heatPoints.map(point => {
            // Handle both object and array formats
            const lat = point.lat !== undefined ? point.lat : (Array.isArray(point) ? point[0] : null);
            const lng = point.lng !== undefined ? point.lng : (Array.isArray(point) ? point[1] : null);
            const intensity = point.intensity || 1;
            
            if (lat === null || lng === null) {
                console.warn('Invalid point format:', point);
                return null;
            }
            
            return [lat, lng, intensity];
        }).filter(Boolean); // Remove any null entries
    }
    
    // Get zone boundaries for visualization
    getZoneBoundaries() {
        if (!this.zones) {
            console.warn('No zones data available');
            return [];
        }
        
        return Object.entries(this.zones).map(([level, data]) => ({
            level,
            bounds: data.bounds,
            color: data.color,
            count: data.points.length
        }));
    }
}

// Export as a module
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CVDataProcessor;
}
