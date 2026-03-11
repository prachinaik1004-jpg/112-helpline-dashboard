const express = require('express');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3001;

app.use(cors());

// Serve static files from the current directory
app.use(express.static(__dirname));

// Helper function to extract location coordinates based on police station name
function getLocationForStation(stationName) {
    // Map of known police stations to their approximate coordinates
    const stationCoords = {
        'BICHOLIM': { lat: 15.6000, lng: 73.9500 },
        'MAPUSA': { lat: 15.5937, lng: 73.8070 },
        'PANJIM': { lat: 15.4909, lng: 73.8278 },
        'MARGAO': { lat: 15.2993, lng: 74.1240 },
        'VASCO': { lat: 15.3960, lng: 73.8157 },
        'PONDA': { lat: 15.4013, lng: 74.0071 },
        'CALANGUTE': { lat: 15.5394, lng: 73.7554 },
        'CUNCOLIM': { lat: 15.2000, lng: 74.0000 },
        'CURCHOREM': { lat: 15.2500, lng: 74.1000 },
        'CANACONA': { lat: 15.0000, lng: 74.0000 }
    };

    // Try to find a matching station
    const stationKey = Object.keys(stationCoords).find(key => 
        stationName && stationName.toUpperCase().includes(key)
    );

    // Return coordinates if found, otherwise return a random location in Goa
    if (stationKey) {
        // Add some randomness to the coordinates to spread out markers
        return {
            lat: stationCoords[stationKey].lat + (Math.random() - 0.5) * 0.02,
            lng: stationCoords[stationKey].lng + (Math.random() - 0.5) * 0.02
        };
    }

    // Default to a random location in Goa if no match found
    return {
        lat: 15.2993 + (Math.random() - 0.5) * 1.0,  // Center around Margao
        lng: 74.1240 + (Math.random() - 0.5) * 1.0
    };
}

// API endpoint to get all incidents
app.get('/api/incidents', (req, res) => {
    const results = [];
    
    fs.createReadStream(path.join(__dirname, 'dataset.csv'))
        .pipe(csv({
            mapHeaders: ({ header }) => header.trim(), // Trim whitespace from headers
            mapValues: ({ value }) => value.trim()     // Trim whitespace from values
        }))
        .on('data', (data) => {
            // Filter out empty rows and add to results
            if (data.EVENT_ID) {
                const location = data.Police_Station_Name || 'Unknown';
                const coords = getLocationForStation(location);
                
                results.push({
                    id: data.EVENT_ID,
                    type: data.EVENT_MAIN_TYPE || 'Unknown',
                    description: data.EVENT_INFORMATION || 'No description',
                    location: location,
                    time: data.CREATE_TIME || new Date().toISOString(),
                    status: data.CLOSURE_COMMENTS ? 'resolved' : 'pending',
                    responseTime: data.RESPONSE_TIME || 'N/A',
                    coordinates: coords,
                    caller: data.CALLER_NAME || 'Anonymous',
                    callTime: data.CREATE_TIME,
                    priority: data.EVENT_MAIN_TYPE?.toLowerCase().includes('emergency') ? 'high' : 'medium'
                });
            }
        })
        .on('end', () => {
            res.json(results);
        })
        .on('error', (error) => {
            console.error('Error reading CSV file:', error);
            res.status(500).json({ error: 'Error reading incident data' });
        });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
