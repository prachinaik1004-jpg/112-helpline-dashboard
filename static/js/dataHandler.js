// Data Handler for 112 Analytics Dashboard

export class DataHandler {
  constructor() {
    this.incidents = [];
    this.heatPoints = [];
  }

  // Load and parse CSV data
  async loadCSVData(csvPath) {
    try {
      const response = await fetch(csvPath);
      if (!response.ok) {
        throw new Error(`Failed to load CSV: ${response.status} ${response.statusText}`);
      }
      const csvText = await response.text();
      
      // Use PapaParse to parse CSV
      return new Promise((resolve, reject) => {
        Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          transform: this.cleanCSVData,
          complete: (results) => {
            console.log(`Parsed ${results.data.length} rows from CSV`);
            // Station -> coords fallback map (Goa)
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

            this.incidents = results.data.map((row, index) => {
              let lat = parseFloat(row.LATITUDE || row.latitude || row.lat);
              let lng = parseFloat(row.LONGITUDE || row.longitude || row.lng);

              if (isNaN(lat) || isNaN(lng)) {
                const station = toUpper(row.POLICE_STATION || row.Police_Station_Name || row.Police_Station || '');
                const key = Object.keys(stationCoords).find(k => station.includes(k));
                if (key) {
                  lat = stationCoords[key][0];
                  lng = stationCoords[key][1];
                } else {
                  // fallback to Goa center jitter
                  lat = 15.2993 + (Math.random() * 0.2 - 0.1);
                  lng = 74.1240 + (Math.random() * 0.2 - 0.1);
                }
              }

              return {
                ...row,
                id: row.EVENT_ID || `EV-${Date.now()}-${index}`,
                lat,
                lng,
                type: this.classifyIncidentType(row.EVENT_MAIN_TYPE),
                timestamp: row.CREATE_TIME ? new Date(row.CREATE_TIME).getTime() : Date.now()
              };
            });
            
            console.log(`Processed ${this.incidents.length} incidents`);
            this.prepareHeatPoints();
            resolve(this.incidents);
          },
          error: (error) => {
            console.error('Error parsing CSV:', error);
            reject(error);
          }
        });
      });
    } catch (error) {
      console.error('Error loading CSV data:', error);
      throw error;
    }
  }

  // Classify incident type based on event main type
  classifyIncidentType(eventType) {
    if (!eventType) return 'other';
    
    const type = eventType.toLowerCase();
    if (type.includes('women') || type.includes('harassment') || type.includes('eve teasing')) {
      return 'womens_safety';
    } else if (type.includes('accident') || type.includes('collision')) {
      return 'accident';
    } else if (type.includes('theft') || type.includes('robbery') || type.includes('burglary')) {
      return 'theft';
    } else if (type.includes('fight') || type.includes('assault') || type.includes('violence')) {
      return 'assault';
    } else if (type.includes('medical') || type.includes('ambulance')) {
      return 'medical';
    } else if (type.includes('fire')) {
      return 'fire';
    } else {
      return 'other';
    }
  }

  // Clean and transform CSV data
  cleanCSVData(value, field) {
    if (value === undefined || value === null) return '';
    
    // Convert to string and clean up
    let strValue = String(value).trim();
    
    // Handle specific field cleaning
    if (field === 'RESPONSE_TIME' && strValue) {
      // Convert response time to seconds
      const parts = strValue.split(':');
      if (parts.length === 3) {
        const [h, m, s] = parts.map(Number);
        return h * 3600 + m * 60 + s;
      }
    }
    
    // Clean up text fields
    if (typeof strValue === 'string') {
      // Remove extra whitespace and newlines
      strValue = strValue.replace(/\s+/g, ' ').trim();
      
      // Handle empty or placeholder values
      if (strValue === '-' || strValue === '--' || strValue === 'N/A') {
        return '';
      }
    }
    
    return strValue || '';
  }

  // Prepare heat points for the map
  prepareHeatPoints() {
    console.log('Preparing heat points...');
    
    // Group incidents by location to calculate intensity
    const locationMap = new Map();
    
    this.incidents.forEach(incident => {
      // Skip if no coordinates
      if (!incident.lat || !incident.lng) return;
      
      // Create a location key
      const locKey = `${incident.lat.toFixed(4)},${incident.lng.toFixed(4)}`;
      
      // Update location count
      if (!locationMap.has(locKey)) {
        locationMap.set(locKey, {
          lat: incident.lat,
          lng: incident.lng,
          count: 0,
          type: incident.type || 'other',
          recentIncidents: []
        });
      }
      
      const loc = locationMap.get(locKey);
      loc.count += 1;
      
      // Keep track of recent incidents for details
      if (loc.recentIncidents.length < 5) { // Limit to 5 most recent
        loc.recentIncidents.push(incident);
      }
    });
    
    // Convert to heat points with intensity based on incident count
    this.heatPoints = Array.from(locationMap.values()).map(loc => ({
      lat: loc.lat,
      lng: loc.lng,
      intensity: Math.min(1, Math.log(loc.count + 1) / 3), // Logarithmic scaling
      type: loc.type,
      count: loc.count,
      details: this.getLocationDetails(loc)
    }));
    
    console.log(`Created ${this.heatPoints.length} heat points`);
  }

  // Get formatted location details for popup
  getLocationDetails(location) {
    // Create a summary of recent incidents
    const recentList = location.recentIncidents
      .map(incident => {
        const time = incident.CREATE_TIME 
          ? new Date(incident.CREATE_TIME).toLocaleString() 
          : 'Unknown time';
        const type = incident.type || 'Incident';
        return `<li>${time} - ${type}</li>`;
      })
      .join('\n');
    
    return `
      <div class="location-details">
        <h4>${location.count} ${location.type || 'Incidents'}</h4>
        <p><strong>Location:</strong> ${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}</p>
        <div><strong>Recent Incidents:</strong>
          <ul style="margin: 5px 0; padding-left: 20px;">
            ${recentList}
          </ul>
        </div>
      </div>
    `;
  }
  
  // Get formatted incident details for popup
  getIncidentDetails(incident) {
    return `
      <div class="incident-details">
        <h4>${incident.EVENT_MAIN_TYPE || 'Incident'}</h4>
        <p><strong>Time:</strong> ${incident.CREATE_TIME || 'N/A'}</p>
        <p><strong>Location:</strong> ${incident.POLICE_STATION || 'N/A'}</p>
        <p><strong>Type:</strong> ${incident.type || 'General'}</p>
        <p><strong>Description:</strong> ${incident.EVENT_INFORMATION || 'No details available'}</p>
        <p><strong>Status:</strong> ${incident.CLOSURE_COMMENTS || 'Open'}</p>
      </div>
    `;
  }

  // Get incidents by type
  getIncidentsByType(type) {
    if (!type || type === 'all') return this.incidents;
    return this.incidents.filter(incident => 
      incident.EVENT_MAIN_TYPE && incident.EVENT_MAIN_TYPE.toLowerCase().includes(type.toLowerCase())
    );
  }

  // Get heat points by type
  getHeatPointsByType(type) {
    if (!type || type === 'all') return this.heatPoints;
    return this.heatPoints.filter(point => 
      point.type && point.type.toLowerCase().includes(type.toLowerCase())
    );
  }

  // Get statistics for the dashboard
  getStatistics() {
    const totalCalls = this.incidents.length;
    const womenSafetyCalls = this.getIncidentsByType('women').length;
    
    // Calculate average response time (example calculation)
    const responseTimes = this.incidents
      .filter(inc => inc.RESPONSE_TIME)
      .map(inc => this.parseTimeString(inc.RESPONSE_TIME));
    
    const avgResponse = responseTimes.length > 0 
      ? this.formatTimeString(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
      : '--';

    return {
      totalCalls,
      womenSafetyCalls,
      avgResponse
    };
  }

  // Helper to parse time string (e.g., "00:12:51.187000") to seconds
  parseTimeString(timeStr) {
    if (!timeStr) return 0;
    const parts = timeStr.split(':');
    if (parts.length !== 3) return 0;
    
    const hours = parseFloat(parts[0]);
    const minutes = parseFloat(parts[1]);
    const seconds = parseFloat(parts[2]);
    
    return hours * 3600 + minutes * 60 + seconds;
  }

  // Helper to format seconds to time string (e.g., "12m 34s")
  formatTimeString(seconds) {
    if (isNaN(seconds)) return '--';
    
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    let result = '';
    if (hrs > 0) result += `${hrs}h `;
    if (mins > 0 || hrs > 0) result += `${mins}m `;
    result += `${secs}s`;
    
    return result.trim();
  }
}
