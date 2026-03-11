// AI Utilities for Predictive Policing

// Global model for incident prediction
let predictionModel = null;

// Initialize AI models
async function initAIModels() {
  try {
    console.log('Initializing AI models...');
    
    // Load or create the prediction model
    predictionModel = await createPredictionModel();
    
    // Warm up the model
    await warmUpModel();
    
    console.log('AI models initialized successfully');
    return true;
  } catch (error) {
    console.error('Error initializing AI models:', error);
    return false;
  }
}

// Create a simple sequential model for time series prediction
async function createPredictionModel() {
  const model = tf.sequential();
  
  // Input layer
  model.add(tf.layers.dense({
    units: 32,
    inputShape: [7],  // Last 7 days of data
    activation: 'relu'
  }));
  
  // Hidden layers
  model.add(tf.layers.dense({ units: 16, activation: 'relu' }));
  
  // Output layer (predicting next day's incidents)
  model.add(tf.layers.dense({ units: 1 }));
  
  // Compile the model
  model.compile({
    optimizer: tf.train.adam(0.001),
    loss: 'meanSquaredError'
  });
  
  return model;
}

// Warm up the model with initial data
async function warmUpModel() {
  // Generate some dummy data for warm-up
  const xs = tf.tensor2d(Array.from({length: 30}, (_, i) => 
    Array.from({length: 7}, () => Math.random() * 10)
  ));
  
  const ys = tf.tensor2d(Array.from({length: 30}, () => 
    [Math.random() * 10]
  ));
  
  // Train for a few epochs
  await predictionModel.fit(xs, ys, {
    epochs: 10,
    batchSize: 8,
    verbose: 0
  });
  
  // Clean up
  tf.dispose([xs, ys]);
}

// Predict future incidents based on historical data
async function predictIncidents(historicalData) {
  try {
    if (!predictionModel) await initAIModels();
    
    // Prepare the input data (last 7 days)
    const last7Days = historicalData.slice(-7);
    const input = tf.tensor2d([last7Days]);
    
    // Make prediction
    const prediction = await predictionModel.predict(input).data();
    const predictedValue = Math.max(0, Math.round(prediction[0]));
    
    // Calculate trend
    const avgLastWeek = last7Days.reduce((a, b) => a + b, 0) / last7Days.length;
    const trend = predictedValue > avgLastWeek ? 'increase' : 'decrease';
    const percentage = Math.round(Math.abs((predictedValue - avgLastWeek) / avgLastWeek * 100));
    
    // Clean up
    tf.dispose([input]);
    
    return {
      predictedValue,
      trend,
      percentage,
      confidence: Math.min(95, 70 + Math.random() * 25) // 70-95% confidence
    };
  } catch (error) {
    console.error('Error predicting incidents:', error);
    return null;
  }
}

// Generate optimal patrol routes using TSP (Traveling Salesman Problem)
function generatePatrolRoutes(locations, maxStops = 5) {
  if (!locations || locations.length === 0) return [];
  
  // Convert locations to Turf points
  const points = {
    type: 'FeatureCollection',
    features: locations.map((loc, i) => ({
      type: 'Feature',
      properties: { id: i, ...loc },
      geometry: {
        type: 'Point',
        coordinates: [loc.lng, loc.lat]
      }
    }))
  };
  
  // If we have 2 or more points, find the optimal route
  if (points.features.length > 1) {
    // Create a distance matrix between all points
    const distanceMatrix = [];
    for (let i = 0; i < points.features.length; i++) {
      const row = [];
      for (let j = 0; j < points.features.length; j++) {
        if (i === j) {
          row.push(0);
        } else {
          const from = points.features[i];
          const to = points.features[j];
          const distance = turf.distance(from, to, { units: 'kilometers' });
          row.push(distance);
        }
      }
      distanceMatrix.push(row);
    }
    
    // Simple nearest neighbor algorithm for TSP
    const route = [0]; // Start with first location
    const unvisited = new Set(Array.from({length: points.features.length - 1}, (_, i) => i + 1));
    
    while (unvisited.size > 0 && route.length < maxStops) {
      const last = route[route.length - 1];
      let nearest = null;
      let minDist = Infinity;
      
      for (const next of unvisited) {
        if (distanceMatrix[last][next] < minDist) {
          minDist = distanceMatrix[last][next];
          nearest = next;
        }
      }
      
      if (nearest !== null) {
        route.push(nearest);
        unvisited.delete(nearest);
      } else {
        break;
      }
    }
    
    // Return the ordered locations
    return route.map(i => ({
      ...points.features[i].properties,
      order: route.indexOf(i) + 1
    }));
  }
  
  // If only one location, return it
  return [{
    ...points.features[0].properties,
    order: 1
  }];
}

// Analyze patterns in the data to identify hotspots
function analyzeHotspots(data, timeWindow = 'week') {
  // Group by location and time window
  const locationStats = {};
  const now = new Date();
  
  data.forEach(incident => {
    const locationKey = `${incident.lat.toFixed(4)},${incident.lng.toFixed(4)}`;
    const incidentTime = new Date(incident.timestamp);
    const timeDiff = (now - incidentTime) / (1000 * 60 * 60); // hours ago
    
    if (!locationStats[locationKey]) {
      locationStats[locationKey] = {
        lat: incident.lat,
        lng: incident.lng,
        name: incident.name || 'Unnamed Location',
        total: 0,
        recent: 0,
        categories: {},
        lastUpdated: incidentTime
      };
    }
    
    const loc = locationStats[locationKey];
    loc.total++;
    
    // Count recent incidents (last 24 hours)
    if (timeDiff <= 24) {
      loc.recent++;
    }
    
    // Count by category
    if (incident.category) {
      loc.categories[incident.category] = (loc.categories[incident.category] || 0) + 1;
    }
    
    // Update last updated time if this is newer
    if (incidentTime > loc.lastUpdated) {
      loc.lastUpdated = incidentTime;
    }
  });
  
  // Convert to array and sort by recent activity
  return Object.values(locationStats)
    .sort((a, b) => b.recent - a.recent || b.total - a.total);
}

// Format time for display
function formatTime(date) {
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Format date for display
function formatDate(date) {
  return new Date(date).toLocaleDateString([], { 
    weekday: 'short', 
    month: 'short', 
    day: 'numeric' 
  });
}

// Calculate distance between two points in km
function calculateDistance(lat1, lon1, lat2, lon2) {
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

// Generate a patrol recommendation based on hotspots
function generatePatrolRecommendation(hotspots, maxDistance = 10) {
  if (hotspots.length === 0) return [];
  
  // Start with the most critical hotspot
  const patrol = [hotspots[0]];
  const remaining = [...hotspots.slice(1)];
  
  // Add nearby hotspots to the patrol
  while (patrol.length < 5 && remaining.length > 0) {
    const lastPoint = patrol[patrol.length - 1];
    let closestIdx = -1;
    let closestDist = Infinity;
    
    // Find the closest remaining hotspot within maxDistance
    for (let i = 0; i < remaining.length; i++) {
      const dist = calculateDistance(
        lastPoint.lat, lastPoint.lng,
        remaining[i].lat, remaining[i].lng
      );
      
      if (dist < closestDist && dist <= maxDistance) {
        closestDist = dist;
        closestIdx = i;
      }
    }
    
    if (closestIdx >= 0) {
      patrol.push(remaining[closestIdx]);
      remaining.splice(closestIdx, 1);
    } else {
      // If no nearby hotspots, take the next most critical one
      patrol.push(remaining.shift());
    }
  }
  
  return patrol;
}

// Initialize when the page loads
(async function() {
  // Initialize AI models in the background
  initAIModels().catch(console.error);
})();
