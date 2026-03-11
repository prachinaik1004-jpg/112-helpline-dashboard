(function(){
  'use strict';

  // DOM Elements
  const $ = (id) => document.getElementById(id);
  const fromDate = $('fromDt');
  const toDate = $('toDt');
  const categoryFilter = $('category');
  const timeFilter = $('timeFilter');
  const applyBtn = $('applyBtn');
  const tooltip = $('tooltip');
  const topLocations = $('topLocations');
  
  // Chart instances
  let hourlyChart, dailyChart, monthlyChart, categoryChart;
  let map, markers = [];
  
  // Sample data (replace with real API calls)
  const sampleData = {
    // Hourly data for the last 24 hours
    hourly: Array.from({length: 24}, (_, i) => ({
      hour: i,
      count: Math.floor(Math.random() * 50) + 10,
      categories: {
        'women': Math.floor(Math.random() * 10) + 1,
        'crime': Math.floor(Math.random() * 15) + 1,
        'accident': Math.floor(Math.random() * 20) + 1,
        'medical': Math.floor(Math.random() * 12) + 1,
        'fire': Math.floor(Math.random() * 5) + 1,
        'other': Math.floor(Math.random() * 8) + 1
      }
    })),
    
    // Daily data for the last 30 days
    daily: Array.from({length: 30}, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (29 - i));
      return {
        date: date.toISOString().split('T')[0],
        count: Math.floor(Math.random() * 100) + 30,
        category: ['women', 'crime', 'accident', 'medical', 'fire', 'other'][Math.floor(Math.random() * 6)]
      };
    }),
    
    // Monthly data for the last 12 months
    monthly: Array.from({length: 12}, (_, i) => {
      const date = new Date();
      date.setMonth(date.getMonth() - (11 - i));
      return {
        month: date.toLocaleString('default', { month: 'short' }),
        count: Math.floor(Math.random() * 500) + 200,
        year: date.getFullYear()
      };
    }),
    
    // Location data
    locations: [
      { name: 'Panaji', lat: 15.4909, lng: 73.8278, count: 142, category: 'crime' },
      { name: 'Margao', lat: 15.2993, lng: 73.9581, count: 98, category: 'accident' },
      { name: 'Vasco da Gama', lat: 15.3860, lng: 73.8160, count: 87, category: 'medical' },
      { name: 'Mapusa', lat: 15.5915, lng: 73.8090, count: 76, category: 'crime' },
      { name: 'Ponda', lat: 15.4038, lng: 74.0153, count: 65, category: 'accident' },
      { name: 'Valpoi', lat: 15.5334, lng: 74.1335, count: 42, category: 'women' },
      { name: 'Bicholim', lat: 15.6000, lng: 73.9500, count: 38, category: 'fire' },
      { name: 'Curchorem', lat: 15.2667, lng: 74.1000, count: 35, category: 'other' },
      { name: 'Sanquelim', lat: 15.5667, lng: 74.0000, count: 28, category: 'medical' },
      { name: 'Quepem', lat: 15.2167, lng: 74.0667, count: 22, category: 'crime' }
    ],
    
    // Category distribution
    categories: {
      'women': 15,
      'crime': 30,
      'accident': 25,
      'medical': 12,
      'fire': 8,
      'other': 10
    }
  };
  
  // Initialize the application
  function init() {
    // Initialize DOM elements
    const $ = (id) => document.getElementById(id);
    const fromDate = $('fromDt');
    const toDate = $('toDt');
    const applyBtn = $('applyBtn');
    
    // Set default date range (last 30 days)
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    
    fromDate.valueAsDate = start;
    toDate.valueAsDate = end;
    
    // Initialize charts
    initHourlyChart();
    initDailyChart();
    initMonthlyChart();
    initCategoryChart();
    
    // Initialize map
    initMap();
    
    // Ensure top locations element exists
    const topLocationsEl = document.getElementById('topLocations');
    if (!topLocationsEl) {
      console.error('Top locations element not found in the DOM');
    } else {
      console.log('Top locations element found:', topLocationsEl);
      // Add debug class for visibility
      topLocationsEl.classList.add('debug-locations');
    }
    
    // Update visualizations with initial data
    updateVisualizations();
    
    // Add event listeners
    applyBtn.addEventListener('click', updateVisualizations);
    
    // Initialize export buttons
    initExportButtons();
    
    // Initialize patrol plan export
    const exportPlanBtn = $('exportPlanBtn');
    if (exportPlanBtn) {
      exportPlanBtn.addEventListener('click', exportPatrolPlan);
    }
  }
  
  // Initialize hourly chart
  function initHourlyChart() {
    const ctx = $('hourlyChart').getContext('2d');
    hourlyChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: Array.from({length: 24}, (_, i) => `${i}:00`),
        datasets: [{
          label: 'Incidents',
          data: [],
          backgroundColor: 'rgba(16, 185, 129, 0.7)',
          borderColor: 'rgba(16, 185, 129, 1)',
          borderWidth: 1,
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            grid: {
              color: 'rgba(0, 0, 0, 0.05)'
            },
            ticks: {
              precision: 0
            }
          },
          x: {
            grid: {
              display: false
            }
          }
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            mode: 'index',
            intersect: false
          }
        },
        onClick: (e, elements) => {
          if (elements.length > 0) {
            const index = elements[0].index;
            console.log(`Hour ${index}:00 clicked`);
          }
        }
      }
    });
  }
  
  // Initialize daily chart
  function initDailyChart() {
    const ctx = $('dailyChart').getContext('2d');
    dailyChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [{
          label: 'Incidents',
          data: [],
          borderColor: 'rgba(16, 185, 129, 1)',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          borderWidth: 2,
          tension: 0.3,
          fill: true,
          pointBackgroundColor: 'rgba(16, 185, 129, 1)',
          pointBorderColor: '#fff',
          pointHoverRadius: 5,
          pointHoverBorderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            grid: {
              color: 'rgba(0, 0, 0, 0.05)'
            },
            ticks: {
              precision: 0
            }
          },
          x: {
            grid: {
              display: false
            }
          }
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            mode: 'index',
            intersect: false
          }
        }
      }
    });
  }
  
  // Initialize monthly chart
  function initMonthlyChart() {
    const ctx = $('monthlyChart').getContext('2d');
    monthlyChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: [],
        datasets: [{
          label: 'Incidents',
          data: [],
          backgroundColor: 'rgba(20, 83, 45, 0.7)',
          borderColor: 'rgba(20, 83, 45, 1)',
          borderWidth: 1,
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            grid: {
              color: 'rgba(0, 0, 0, 0.05)'
            },
            ticks: {
              precision: 0
            }
          },
          x: {
            grid: {
              display: false
            }
          }
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            mode: 'index',
            intersect: false
          }
        }
      }
    });
  }
  
  // Initialize category chart
  function initCategoryChart() {
    const ctx = $('categoryChart').getContext('2d');
    categoryChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: [],
        datasets: [{
          data: [],
          backgroundColor: [
            'rgba(236, 72, 153, 0.7)',  // Pink
            'rgba(239, 68, 68, 0.7)',   // Red
            'rgba(249, 115, 22, 0.7)',  // Orange
            'rgba(59, 130, 246, 0.7)',  // Blue
            'rgba(220, 38, 38, 0.7)',   // Dark Red
            'rgba(107, 114, 128, 0.7)'  // Gray
          ],
          borderColor: [
            'rgba(236, 72, 153, 1)',
            'rgba(239, 68, 68, 1)',
            'rgba(249, 115, 22, 1)',
            'rgba(59, 130, 246, 1)',
            'rgba(220, 38, 38, 1)',
            'rgba(107, 114, 128, 1)'
          ],
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        plugins: {
          legend: {
            position: 'right',
            labels: {
              boxWidth: 12,
              padding: 15,
              usePointStyle: true,
              pointStyle: 'circle',
              font: {
                size: 12
              }
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const label = context.label || '';
                const value = context.raw || 0;
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const percentage = Math.round((value / total) * 100) || 0;
                return `${label}: ${value} (${percentage}%)`;
              }
            }
          }
        }
      }
    });
  }
  
  // Initialize map
  function initMap() {
    // Center on Goa
    map = L.map('map').setView([15.2993, 74.1240], 9);
    
    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 18
    }).addTo(map);
    
    // Add scale control
    L.control.scale().addTo(map);
    
    // Add reset view button
    $('mapReset').addEventListener('click', () => {
      map.setView([15.2993, 74.1240], 9);
    });
  }
  
  // Update map with location data
  function updateMap(data) {
    // Clear existing markers
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];
    
    // Add new markers
    data.locations.forEach(location => {
      const marker = L.circleMarker(
        [location.lat, location.lng],
        {
          radius: Math.min(10 + Math.sqrt(location.count), 25),
          fillColor: getCategoryColor(location.category),
          color: '#fff',
          weight: 1,
          opacity: 1,
          fillOpacity: 0.8
        }
      );
      
      marker.bindPopup(`
        <div style="min-width: 160px;">
          <strong>${location.name}</strong><br>
          Incidents: ${location.count}<br>
          Category: ${formatCategory(location.category)}
        </div>
      `);
      
      marker.addTo(map);
      markers.push(marker);
    });
    
    // Fit bounds to show all markers
    if (markers.length > 0) {
      const group = new L.featureGroup(markers);
      map.fitBounds(group.getBounds().pad(0.1));
    }
  }
  
  // Update top locations list
  function updateTopLocations(locations) {
    console.log('=== DEBUG: updateTopLocations called ===');
    console.log('Locations data type:', typeof locations);
    console.log('Locations is array:', Array.isArray(locations));
    console.log('Locations count:', locations ? locations.length : 0);
    console.log('First 3 locations:', locations ? locations.slice(0, 3) : 'N/A');
    console.log('==============================');
    
    try {
      // Ensure topLocations element exists
      const topLocationsEl = document.getElementById('topLocations');
      if (!topLocationsEl) {
        console.error('Top locations container not found in the DOM');
        return;
      }
      
      // Update the global reference
      window.topLocations = topLocationsEl;
      
      // Validate and prepare locations data
      if (!Array.isArray(locations)) {
        console.error('Invalid locations data (not an array):', locations);
        topLocationsEl.innerHTML = '<div class="error">Invalid location data format</div>';
        return;
      }
      
      if (locations.length === 0) {
        console.warn('No location data provided');
        topLocationsEl.innerHTML = '<div class="no-data">No location data available</div>';
        return;
      }
      
      console.log('Processing locations data:', locations);
      
      // Sort locations by count (descending) and take top 5
      const sortedLocations = [...locations]
        .filter(loc => {
          const isValid = loc && typeof loc === 'object' && 'name' in loc && 'count' in loc;
          if (!isValid) {
            console.warn('Invalid location item:', loc);
          }
          return isValid;
        })
        .sort((a, b) => {
          const countA = parseInt(a.count) || 0;
          const countB = parseInt(b.count) || 0;
          return countB - countA;
        })
        .slice(0, 5);
      
      console.log('Sorted and filtered locations:', sortedLocations);
      
      // Clear existing content
      topLocationsEl.innerHTML = '';
      
      if (sortedLocations.length === 0) {
        console.warn('No valid locations after filtering');
        topLocationsEl.innerHTML = '<div class="no-data">No valid location data available</div>';
        return;
      }
      
      // Add top locations
      const list = document.createElement('ul');
      list.className = 'locations-list';
      
      sortedLocations.forEach((location, index) => {
        if (!location || !location.name) {
          console.warn('Skipping invalid location item:', location);
          return;
        }
        
        try {
          const li = document.createElement('li');
          li.className = 'location-item';
          
          const count = parseInt(location.count) || 0;
          const locationName = String(location.name).trim() || 'Unknown Location';
          
          li.innerHTML = `
            <span class="location-rank">${index + 1}</span>
            <span class="location-name">${locationName}</span>
            <span class="location-count">${count} incident${count !== 1 ? 's' : ''}</span>
          `;
          
          list.appendChild(li);
        } catch (error) {
          console.error('Error creating location item:', error, location);
        }
      });
      
      if (list.children.length > 0) {
        topLocationsEl.appendChild(list);
        console.log('Successfully updated top locations');
      } else {
        topLocationsEl.innerHTML = '<div class="no-data">No location data to display</div>';
      }
      
    } catch (error) {
      console.error('Error in updateTopLocations:', error);
      const topLocationsEl = document.getElementById('topLocations');
      if (topLocationsEl) {
        topLocationsEl.innerHTML = `
          <div class="error">
            Error loading location data
            <div class="error-details" style="font-size: 0.8em; margin-top: 5px;">
              ${error.message || 'Unknown error occurred'}
            </div>
          </div>`;
      }
    }
  }
  
  // Generate patrol recommendations based on data analysis
  function generatePatrolRecommendations(data) {
    const patrolList = document.getElementById('patrolList');
    if (!patrolList) return;
    
    // Clear existing recommendations
    patrolList.innerHTML = '';
    
    // 1. Get top locations by incident count
    const topLocations = [...data.locations]
      .sort((a, b) => b.count - a.count)
      .slice(0, 3); // Top 3 locations
    
    // 2. Get most active time slots
    const hourlyCounts = data.hourly.map((hour, index) => ({
      hour: index,
      count: hour.count
    })).sort((a, b) => b.count - a.count);
    
    const peakHours = hourlyCounts.slice(0, 2).map(h => {
      const period = h.hour >= 12 ? 'PM' : 'AM';
      const displayHour = h.hour % 12 || 12;
      return `${displayHour}${period}`;
    });
    
    // 3. Get most common incident types
    const categories = Object.entries(data.categories)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2);
    
    // Generate patrol recommendations
    const recommendations = [];
    
    // Add priority patrols for top locations
    topLocations.forEach((location, index) => {
      const timeSlot = peakHours[index % peakHours.length];
      recommendations.push({
        location: location.name,
        time: `${timeSlot} - ${(parseInt(timeSlot) + 2) % 12 || 12}${parseInt(timeSlot) + 2 >= 12 ? 'PM' : 'AM'}`,
        priority: index + 1,
        notes: `High incident area (${location.count} incidents). Focus on ${categories[0][0]} and ${categories[1][0]} prevention.`
      });
    });
    
    // Add time-based patrols
    if (peakHours.length > 0) {
      recommendations.push({
        location: 'High Activity Zones',
        time: `${peakHours[0]} - ${(parseInt(peakHours[0]) + 2) % 12 || 12}${parseInt(peakHours[0]) + 2 >= 12 ? 'PM' : 'AM'}`,
        priority: recommendations.length + 1,
        notes: `Peak incident hours. Increase patrols in high-risk areas.`
      });
    }
    
    // Add category-based patrols
    if (categories.length > 0) {
      recommendations.push({
        location: `${formatCategory(categories[0][0])} Hotspots`,
        time: 'Evening - Night',
        priority: recommendations.length + 1,
        notes: `Focus on ${formatCategory(categories[0][0].toLowerCase())} prevention and response.`
      });
    }
    
    // Display recommendations
    recommendations.forEach(rec => {
      const li = document.createElement('li');
      li.className = 'patrol-item';
      li.innerHTML = `
        <div class="patrol-header">
          <span class="patrol-priority">#${rec.priority}</span>
          <span class="patrol-location">${rec.location}</span>
          <span class="patrol-time">${rec.time}</span>
        </div>
        <div class="patrol-notes">${rec.notes}</div>
      `;
      patrolList.appendChild(li);
    });
    
    // Update AI prediction if element exists
    const aiRise = document.getElementById('aiRise');
    if (aiRise) {
      const increasePercent = Math.min(30, Math.max(5, Math.floor(topLocations.reduce((sum, loc) => sum + loc.count, 0) / 10)));
      aiRise.textContent = `${increasePercent}%`;
    }
  }
  
  // Update AI intelligence and display predictions with detailed insights
  async function updateAIIntelligence(data, locationFilter = 'all') {
    let prediction = null;
    let hotspots = [];
    let patrolRoute = [];
    
    try {
      setLoadingState(true, 'Analyzing data...');
      
      // Only try to predict if we have enough historical data
      if (data.daily && data.daily.length >= 7) {
        try {
          // Get historical data for predictions (last 30 days)
          const historicalData = data.daily.map(day => day.count);
          prediction = await predictIncidents(historicalData, locationFilter);
          console.log('AI Prediction:', prediction);
        } catch (predictionError) {
          console.warn('Prediction failed, using fallback:', predictionError);
          prediction = updateBasicPrediction(data);
        }
      } else {
        console.warn('Insufficient data for AI prediction');
        prediction = updateBasicPrediction(data);
      }
      
      // Update AI insights with prediction or fallback
      const aiRise = document.getElementById('aiRise');
      const insightText = document.querySelector('.insights .desc');
      const aiConfidence = document.getElementById('aiConfidence');
      const aiFactors = document.getElementById('aiFactors');
      const aiRiskLevel = document.getElementById('aiRiskLevel');
      const aiLocation = document.getElementById('aiLocation');
      const aiSeason = document.getElementById('aiSeason');
      const aiRecommendations = document.getElementById('aiRecommendations');
      
      if (aiRise && prediction) {
        // Update the main prediction display
        aiRise.textContent = `${prediction.percentage}%`;
        aiRise.style.color = prediction.trend === 'increase' ? '#e74c3c' : '#2ecc71';
        
        // Update risk level
        if (aiRiskLevel) {
          aiRiskLevel.textContent = prediction.riskLevel || 'Moderate';
          aiRiskLevel.className = `risk-${(prediction.riskLevel || 'Moderate').toLowerCase()}`;
        }
        
        // Update location and season info
        if (aiLocation) aiLocation.textContent = prediction.location || 'All Regions';
        if (aiSeason) aiSeason.textContent = prediction.season || 'All Seasons';
        
        // Update confidence indicator if element exists
        if (aiConfidence) {
          aiConfidence.textContent = `${prediction.confidence || 75}%`;
          const confidenceLevel = prediction.confidence > 80 ? 'high' : prediction.confidence > 60 ? 'medium' : 'low';
          aiConfidence.className = `confidence-indicator ${confidenceLevel}`;
        }
        
        // Update recommendations
        if (aiRecommendations && prediction.recommendations) {
          aiRecommendations.innerHTML = prediction.recommendations
            .map(rec => `<li>${rec}</li>`)
            .join('');
        }
        
        // Update detailed insight text
        if (insightText) {
          const timeWindow = prediction.factors?.timeOfDay === 'peak' ? 'evening/night (6 PM - 3 AM)' : 'daytime';
          const trend = prediction.trend === 'increase' ? 'rise' : 'decrease';
          const dayType = prediction.factors?.dayOfWeek || 'day';
          const dataQuality = prediction.factors?.dataQuality || 'moderate';
          
          let insightHTML = `
            <p>Based on analysis of the last <strong>${prediction.factors?.dataPoints || 14} days</strong>, `;
            
          insightHTML += `we're seeing a <strong>${trend} of ${prediction.percentage}%</strong> in incident reports during ${timeWindow} hours. `;
          
          if (prediction.factors) {
            insightHTML += `This prediction considers that it's currently a <strong>${dayType}</strong> `;
            insightHTML += `and the data quality is <strong>${dataQuality}</strong>. `;
          }
          
          // Add specific recommendations based on factors
          if (prediction.trend === 'increase') {
            insightHTML += `<span class="recommendation">Recommend increasing patrols in high-risk areas during these times.</span>`;
          } else {
            insightHTML += `<span class="recommendation">Current patrol levels appear adequate based on recent trends.</span>`;
          }
          
          insightText.innerHTML = insightHTML;
        }
        
        // Update factors display if element exists
        if (aiFactors) {
          const factors = prediction.factors || {};
          let factorsHTML = '<div class="factors-container">';
          
          if (factors.dayOfWeek) {
            factorsHTML += `
              <div class="factor">
                <i class="fas fa-calendar-day"></i>
                <span>${factors.dayOfWeek.charAt(0).toUpperCase() + factors.dayOfWeek.slice(1)}</span>
              </div>`;
          }
          
          if (factors.timeOfDay) {
            factorsHTML += `
              <div class="factor">
                <i class="fas fa-clock"></i>
                <span>${factors.timeOfDay === 'peak' ? 'Peak Hours' : 'Off-Peak'}</span>
              </div>`;
          }
          
          if (factors.dataQuality) {
            factorsHTML += `
              <div class="factor">
                <i class="fas fa-database"></i>
                <span>${factors.dataQuality} Confidence</span>
              </div>`;
          }
          
          factorsHTML += '</div>';
          aiFactors.innerHTML = factorsHTML;
        }
      }
      
      // Generate and display patrol recommendations if we have location data
      if (data.locations && data.locations.length > 0) {
        try {
          console.log('Analyzing hotspots...');
          hotspots = analyzeHotspots(data.locations);
          console.log('Hotspots analyzed:', hotspots.length);
          
          if (hotspots && hotspots.length > 0) {
            console.log('Generating patrol routes...');
            patrolRoute = generatePatrolRoutes(hotspots, 5);
            console.log('Patrol route generated with', patrolRoute.length, 'stops');;
            updatePatrolRecommendations(patrolRoute);
          }
        } catch (routeError) {
          console.error('Error generating patrol routes:', routeError);
          showError('Error generating patrol recommendations. Please try again.');
        }
      } else {
        console.warn('No location data available for patrol recommendations');
        showError('No location data available for generating patrol routes.');
      }
      
      // Log completion
      console.log('AI Intelligence update complete', {
        prediction: !!prediction,
        hotspots: hotspots.length,
        patrolStops: patrolRoute.length
      });
      
      return { success: true, prediction, patrolRoute };
      
    } catch (error) {
      console.error('Error in updateAIIntelligence:', error);
      showError('Error updating AI insights. Some features may be limited.');
      
      // Fallback to basic prediction if something goes wrong
      if (data) {
        updateBasicPrediction(data);
      }
      return { success: false, error: error.message };
    } finally {
      setLoadingState(false);
    }
  }

  // Update patrol recommendations in the UI
  function updatePatrolRecommendations(patrolRoute) {
    try {
      const patrolList = document.getElementById('patrolList');
      if (!patrolList) {
        console.warn('Patrol list element not found');
        return;
      }
    
      // Clear existing items
      patrolList.innerHTML = '';
      
      if (!patrolRoute || !Array.isArray(patrolRoute) || patrolRoute.length === 0) {
        patrolList.innerHTML = `
          <li class="no-patrols">
            <i class="fas fa-info-circle"></i>
            <span>No patrol recommendations available at this time.</span>
          </li>`;
        return;
      }
      
      // Add each patrol location to the list
      patrolRoute.forEach((location, index) => {
        try {
          // Skip invalid locations
          if (!location || typeof location !== 'object') return;
          
          const li = document.createElement('li');
          li.className = 'patrol-item';
          
          // Safely format coordinates
          const coords = (location.lat && location.lng) 
            ? `${Number(location.lat).toFixed(4)}, ${Number(location.lng).toFixed(4)}` 
            : 'Coordinates not available';
          
          li.innerHTML = `
            <div class="order">${index + 1}</div>
            <div class="patrol-details">
              <div class="patrol-location">
                <span>${location.name || 'Unknown Location'}</span>
                ${location.count ? `<span class="badge">${location.count} incidents</span>` : ''}
              </div>
              <div class="patrol-meta">
                <span><i class="fas fa-map-marker-alt"></i> ${coords}</span>
                ${location.category ? `<span><i class="fas fa-tag"></i> ${formatCategory(location.category)}</span>` : ''}
              </div>
              ${location.notes ? `<div class="patrol-notes"><i class="fas fa-info-circle"></i> ${location.notes}</div>` : ''}
            </div>
          `;
          
          // Add click handler to center map on this location if coordinates are available
          if (location.lat && location.lng && map) {
            li.style.cursor = 'pointer';
            li.addEventListener('click', () => {
              try {
                map.setView([Number(location.lat), Number(location.lng)], 13);
              } catch (mapError) {
                console.error('Error centering map:', mapError);
              }
            });
          }
          
          patrolList.appendChild(li);
        } catch (itemError) {
          console.error('Error creating patrol item:', itemError);
        }
      });
      
      // Add confidence meter if we have at least one valid location
      if (patrolRoute.length > 0) {
        try {
          const confidence = Math.min(95, 80 + Math.random() * 15); // 80-95% confidence
          const confidenceMeter = document.createElement('div');
          confidenceMeter.className = 'confidence-meter';
          confidenceMeter.innerHTML = `
            <div class="confidence-label">
              <span>AI Confidence</span>
              <span>${Math.round(confidence)}%</span>
            </div>
            <div class="confidence-bar">
              <div class="confidence-level" style="width: ${confidence}%"></div>
            </div>
          `;
          patrolList.appendChild(confidenceMeter);
        } catch (meterError) {
          console.error('Error creating confidence meter:', meterError);
        }
      }
    } catch (error) {
      console.error('Error in updatePatrolRecommendations:', error);
      // Ensure we don't leave the UI in a broken state
      const patrolList = document.getElementById('patrolList');
      if (patrolList) {
        patrolList.innerHTML = `
          <li class="error">
            <i class="fas fa-exclamation-triangle"></i>
            <span>Error loading patrol recommendations. Please try again later.</span>
          </li>`;
      }
  }
}

  // Get filtered data based on current filters
  function getFilteredData(data) {
  const category = document.getElementById('category')?.value || 'all';
  const timeFilter = document.getElementById('timeFilter')?.value || 'all';
  
  // Filter locations by category
  const filteredLocations = filterLocations(data.locations, category);
  
  // Filter hourly data by time of day
  const filteredHourly = filterHourlyData(data.hourly, timeFilter, category);
  
  // Filter daily data
  const filteredDaily = filterDailyData(data.daily, timeFilter, category);
  
  // Filter monthly data
  const filteredMonthly = filterMonthlyData(data.monthly, timeFilter, category);
  
  return {
    ...data,
    locations: filteredLocations,
    hourly: filteredHourly,
    daily: filteredDaily,
    monthly: filteredMonthly
  };
}

  // Show loading state helper function
  function setLoadingState(loading) {
  const loadingIndicator = document.getElementById('loadingIndicator');
  const content = document.getElementById('dashboardContent');
  
  if (loadingIndicator) {
    loadingIndicator.style.display = loading ? 'flex' : 'none';
  }
  
  if (content) {
    content.style.opacity = loading ? '0.7' : '1';
    content.style.pointerEvents = loading ? 'none' : 'auto';
  }
}

  // Show error message helper function
  function showError(message, duration = 5000) {
  const errorElement = document.getElementById('errorMessage') || createErrorElement();
  if (!errorElement) return;
  
  errorElement.textContent = message;
  errorElement.style.display = 'block';
  errorElement.style.opacity = '1';
  
  if (duration > 0) {
    setTimeout(() => {
      errorElement.style.opacity = '0';
      setTimeout(() => {
        errorElement.style.display = 'none';
      }, 300);
    }, duration);
  }
}

  // Create error element if it doesn't exist
  function createErrorElement() {
  const existing = document.getElementById('errorMessage');
  if (existing) return existing;
  
  const errorElement = document.createElement('div');
  errorElement.id = 'errorMessage';
  errorElement.className = 'error-message';
  errorElement.style.display = 'none';
  errorElement.style.position = 'fixed';
  errorElement.style.top = '20px';
  errorElement.style.left = '50%';
  errorElement.style.transform = 'translateX(-50%)';
  errorElement.style.backgroundColor = '#f8d7da';
  errorElement.style.color = '#721c24';
  errorElement.style.padding = '10px 20px';
  errorElement.style.borderRadius = '4px';
  errorElement.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
  errorElement.style.zIndex = '1000';
  errorElement.style.transition = 'opacity 0.3s ease';
  
  document.body.appendChild(errorElement);
  return errorElement;
}

  // Main visualization update function
  async function updateVisualizations() {
  // Show loading state
  setLoadingState(true);
  
  try {
    // Get filter values with fallbacks
    const category = categoryFilter ? categoryFilter.value : 'all';
    const timePeriod = timeFilter ? timeFilter.value : 'all';
    
    console.log('Updating visualizations with filters:', { category, timePeriod });
    
    // Filter data based on selections
    const filteredData = {
      hourly: filterHourlyData(sampleData.hourly, timePeriod, category),
      daily: filterDailyData(sampleData.daily, timePeriod, category),
      monthly: filterMonthlyData(sampleData.monthly, timePeriod, category),
      locations: filterLocations(sampleData.locations, category),
      categories: sampleData.categories || {}
    };
    
    // Update charts
    try {
      if (hourlyChart) {
        updateChartData(
          hourlyChart, 
          filteredData.hourly.map(d => d?.count || 0),
          Array.from({length: 24}, (_, i) => `${i}:00`)
        );
      }
      
      if (dailyChart && filteredData.daily.length > 0) {
        updateChartData(
          dailyChart, 
          filteredData.daily.map(d => d?.count || 0),
          filteredData.daily.map(d => new Date(d.date).getDate())
        );
      }
      
      if (monthlyChart && filteredData.monthly.length > 0) {
        updateChartData(
          monthlyChart, 
          filteredData.monthly.map(d => d?.count || 0),
          filteredData.monthly.map(d => d.month || '')
        );
      }
      
      // Update category chart
      if (categoryChart) {
        try {
          const categoryData = getCategoryDistribution(filteredData);
          updateCategoryChart(categoryData);
        } catch (categoryError) {
          console.error('Error updating category chart:', categoryError);
        }
      }
    } catch (chartError) {
      console.error('Error updating charts:', chartError);
      showError('Error updating charts. Some visualizations may not be up to date.');
    }
    
    // Update map and locations
    try {
      if (map) {
        updateMap(filteredData.locations || []);
      }
      
      // Update top locations with a small delay to ensure DOM is ready
      setTimeout(() => {
        try {
          updateTopLocations(filteredData.locations || []);
        } catch (topLocError) {
          console.error('Error updating top locations:', topLocError);
        }
      }, 100);
      
    } catch (mapError) {
      console.error('Error updating map and locations:', mapError);
      showError('Error updating map data. Please try again.');
    }
    
    // Update AI insights
    try {
      if (typeof updateAIIntelligence === 'function') {
        await updateAIIntelligence(filteredData);
      } else {
        console.warn('AI features not available, using fallback prediction');
        updateBasicPrediction(filteredData);
      }
    } catch (aiError) {
      console.error('Error updating AI intelligence:', aiError);
      updateBasicPrediction(filteredData);
      showError('AI features temporarily unavailable. Using basic prediction.');
    }
    
    // Generate patrol recommendations
    try {
      if (typeof generatePatrolRecommendations === 'function') {
        generatePatrolRecommendations(filteredData);
      }
    } catch (patrolError) {
      console.error('Error generating patrol recommendations:', patrolError);
      showError('Error generating patrol recommendations.');
    }
    
  } catch (error) {
    console.error('Critical error in updateVisualizations:', error);
    showError('An error occurred while updating the dashboard. Please try again.');
  } finally {
    // Always ensure loading state is turned off
    setLoadingState(false);
  }
}
  
    // Helper function to update chart data
    function updateChartData(chart, data, labels = null) {
    if (!chart || !data || !Array.isArray(data)) {
      console.warn('Invalid chart or data provided to updateChartData');
      return;
    }
    
    try {
      if (chart.data && chart.data.datasets && chart.data.datasets.length > 0) {
        chart.data.datasets[0].data = data;
        if (labels && Array.isArray(labels)) {
          chart.data.labels = labels;
        }
        chart.update();
      }
    } catch (error) {
      console.error('Error updating chart:', error);
    }
  }
  
    // Update category chart data
    function updateCategoryChart(data) {
    if (!categoryChart) return;
    
    const labels = Object.keys(data);
    const counts = Object.values(data);
    
    categoryChart.data.labels = labels.map(formatCategory);
    categoryChart.data.datasets[0].data = counts;
    categoryChart.update();
  }
  
    // Filter hourly data based on time period and category
    function filterHourlyData(data, timePeriod, category) {
    let filtered = [...data];
    
    // Filter by time of day
    if (timePeriod !== 'all') {
      const timeRanges = {
        'morning': [6, 12],
        'afternoon': [12, 17],
        'evening': [17, 22],
        'night': [22, 6]
      };
      
      const [start, end] = timeRanges[timePeriod] || [0, 24];
      
      if (start < end) {
        filtered = filtered.filter(d => d.hour >= start && d.hour < end);
      } else {
        // Handle overnight ranges (e.g., 22-6)
        filtered = filtered.filter(d => d.hour >= start || d.hour < end);
      }
    }
    
    // Filter by category if specified
    if (category !== 'all') {
      filtered = filtered.map(d => ({
        ...d,
        count: d.categories[category] || 0
      }));
    }
    
    return filtered;
  }
  
    // Filter daily data
    function filterDailyData(data, timePeriod, category) {
    // In a real app, this would filter based on the actual date range
    // and category from the data
    return [...data];
  }
  
    // Filter monthly data
    function filterMonthlyData(data, timePeriod, category) {
    // In a real app, this would filter based on the actual date range
    // and category from the data
    return [...data];
  }
  
    // Filter locations by category
    function filterLocations(locations, category) {
    try {
      if (!Array.isArray(locations)) {
        console.warn('Invalid locations data in filterLocations');
        return [];
      }
      
      if (category === 'all' || !category) {
        return locations.filter(loc => loc && typeof loc === 'object');
      }
      
      return locations.filter(loc => 
        loc && 
        typeof loc === 'object' && 
        'category' in loc && 
        loc.category === category
      );
    } catch (error) {
      console.error('Error filtering locations:', error);
      return [];
    }
  }
  
    // Get category distribution from filtered data
    function getCategoryDistribution(data) {
    // In a real app, this would calculate distribution from the actual data
    return { ...sampleData.categories };
  }
  
    // Helper to get color for category
    function getCategoryColor(category) {
    const colors = {
      'women': '#ec4899',  // Pink
      'crime': '#ef4444',  // Red
      'accident': '#f97316', // Orange
      'medical': '#3b82f6', // Blue
      'fire': '#dc2626',   // Dark Red
      'other': '#6b7280'   // Gray
    };
    return colors[category] || '#6b7280';
  }
  
    // Helper to format category names
    function formatCategory(category) {
    const names = {
      'women': "Women's Safety",
      'crime': 'Crime',
      'accident': 'Road Accidents',
      'medical': 'Medical',
      'fire': 'Fire',
      'other': 'Other'
    };
    return names[category] || category;
  }
  
    // Advanced prediction model for incidents using time series analysis with location and seasonal factors
    async function predictIncidents(historicalData, locationFilter = 'all') {
    try {
      if (!historicalData || !Array.isArray(historicalData) || historicalData.length < 14) {
        console.warn('Insufficient historical data for prediction. At least 14 data points required.');
        return null;
      }

      // Determine if we're in peak season (November to March)
      const now = new Date();
      const month = now.getMonth();
      const isPeakSeason = month >= 10 || month <= 2; // Nov to March
      
      // Define Goa regions and their characteristics
      const goaRegions = {
        'north': {
          name: 'North Goa',
          baseRisk: 1.3,  // Higher base risk due to more tourist activity
          peakSeasonFactor: 1.4,
          offPeakFactor: 0.8,
          hotspots: ['Panjim', 'Calangute', 'Baga', 'Anjuna', 'Mapusa']
        },
        'south': {
          name: 'South Goa',
          baseRisk: 1.0,
          peakSeasonFactor: 1.2,
          offPeakFactor: 0.7,
          hotspots: ['Margao', 'Colva', 'Palolem', 'Vasco da Gama']
        }
      };
      
      // Get region data based on filter or use weighted average if 'all'
      const region = locationFilter in goaRegions ? goaRegions[locationFilter] : null;
      
      // Calculate basic statistics
      const recentData = historicalData.slice(-14); // Last 14 days
      const avg = recentData.reduce((a, b) => a + b, 0) / recentData.length;
      
      // Calculate trend using linear regression (slope of the best fit line)
      const xValues = recentData.map((_, i) => i);
      const yValues = recentData;
      
      const xMean = xValues.reduce((a, b) => a + b, 0) / xValues.length;
      const yMean = yValues.reduce((a, b) => a + b, 0) / yValues.length;
      
      let numerator = 0;
      let denominator = 0;
      
      for (let i = 0; i < xValues.length; i++) {
        const xDiff = xValues[i] - xMean;
        numerator += xDiff * (yValues[i] - yMean);
        denominator += xDiff * xDiff;
      }
      
      const slope = denominator !== 0 ? numerator / denominator : 0;
      const trend = slope > 0 ? 'increase' : 'decrease';
      
      // Calculate percentage change
      const lastValue = recentData[recentData.length - 1];
      const firstValue = recentData[0];
      let percentageChange = firstValue !== 0 
        ? Math.min(50, Math.abs(Math.round(((lastValue - firstValue) / firstValue) * 100)))
        : 0;
      
      // Apply seasonal adjustment
      const seasonalFactor = isPeakSeason ? 
        (region ? region.peakSeasonFactor : 1.3) : 
        (region ? region.offPeakFactor : 0.9);
      
      // Apply location-based adjustment if region is specified
      const locationFactor = region ? region.baseRisk : 1.0;
      
      // Adjust percentage change based on location and season
      percentageChange = Math.round(percentageChange * seasonalFactor * locationFactor);
      
      // Calculate confidence based on data variance
      const squaredDiffs = recentData.map(value => Math.pow(value - avg, 2));
      const variance = squaredDiffs.reduce((a, b) => a + b, 0) / recentData.length;
      const stdDev = Math.sqrt(variance);
      const cv = avg !== 0 ? (stdDev / avg) * 100 : 0; // Coefficient of variation
      
      // Adjust confidence based on data quality and season
      let baseConfidence = 70;
      if (isPeakSeason) baseConfidence += 5; // More predictable during peak season
      
      const cvFactor = Math.max(0, 100 - Math.min(cv, 100)) / 100;
      let confidence = Math.min(95, baseConfidence + (25 * cvFactor));
      
      // Adjust confidence based on data points count
      confidence = Math.min(confidence, 70 + (recentData.length / 14) * 25);
      
      // Consider day of week patterns
      const dayOfWeek = now.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const dayFactor = isWeekend ? 1.25 : 1.0; // 25% higher on weekends
      
      // Consider time of day
      const hour = now.getHours();
      const isPeakTime = (hour >= 18 && hour <= 23) || (hour >= 0 && hour <= 3); // Evening/night
      const timeFactor = isPeakTime ? 1.2 : 1.0; // 20% higher during peak times
      
      // Final adjustment with all factors
      const adjustedPercentage = Math.round(percentageChange * dayFactor * timeFactor);
      
      // Generate location-specific insights
      let locationInsight = '';
      if (region) {
        locationInsight = `in ${region.name}`;
        if (isPeakSeason) {
          locationInsight += ` during peak tourist season`;
        }
      } else if (isPeakSeason) {
        locationInsight = `during peak tourist season`;
      }
      
      // Generate risk assessment
      let riskLevel = 'Moderate';
      const riskScore = Math.min(100, Math.round(adjustedPercentage * 1.5));
      if (riskScore > 70) riskLevel = 'High';
      else if (riskScore < 30) riskLevel = 'Low';
      
      return {
        trend,
        percentage: Math.min(50, adjustedPercentage), // Cap at 50%
        confidence: Math.round(confidence),
        riskLevel,
        riskScore,
        location: region ? region.name : 'All Regions',
        season: isPeakSeason ? 'Peak Season' : 'Off Season',
        factors: {
          dayOfWeek: isWeekend ? 'weekend' : 'weekday',
          timeOfDay: isPeakTime ? 'peak' : 'off-peak',
          seasonalFactor: isPeakSeason ? 'high' : 'low',
          dataQuality: cv < 25 ? 'high' : cv < 50 ? 'medium' : 'low',
          dataPoints: recentData.length,
          locationFactor: region ? region.name : 'all',
          seasonalMultiplier: seasonalFactor.toFixed(2)
        },
        recommendations: generateRecommendations(riskLevel, region, isPeakSeason, isWeekend, isPeakTime)
      };
    } catch (error) {
      console.error('Error in predictIncidents:', error);
      return null;
    }
  }
  
    // Generate recommendations based on risk level, location, and time factors
  function generateRecommendations(riskLevel, region, isPeakSeason, isWeekend, isPeakTime) {
    const recommendations = [];
    const now = new Date();
    const hour = now.getHours();
    const isDaytime = hour >= 6 && hour < 18;
    
    // Base recommendations based on risk level
    if (riskLevel === 'High') {
      recommendations.push('🚨 Consider increasing patrols in high-risk areas');
      recommendations.push('📢 Issue public safety advisories');
      recommendations.push('👮 Deploy additional officers in key locations');
    } else if (riskLevel === 'Moderate') {
      recommendations.push('👀 Maintain regular patrols');
      recommendations.push('📱 Monitor social media for potential issues');
    } else {
      recommendations.push('✅ Maintain standard patrol routes');
      recommendations.push('📊 Continue monitoring for any changes in patterns');
    }
    
    // Location-specific recommendations
    if (region) {
      if (region.name === 'North Goa') {
        recommendations.push(`📍 Focus on tourist hotspots: ${region.hotspots.slice(0, 3).join(', ')}`);
        if (isPeakSeason) {
          recommendations.push('🎯 Increase beach patrols during evening hours');
        }
      } else if (region.name === 'South Goa') {
        recommendations.push(`📍 Monitor key areas: ${region.hotspots.slice(0, 3).join(', ')}`);
        if (isPeakSeason) {
          recommendations.push('🏖️ Increase presence at popular beaches');
        }
      }
    }
    
    // Time-based recommendations
    if (isWeekend) {
      recommendations.push('📅 Weekend: Expect higher foot traffic in tourist areas');
    }
    
    if (isPeakTime) {
      recommendations.push('🌙 Night patrol: Increase vigilance in nightlife districts');
    } else if (isDaytime) {
      recommendations.push('☀️ Daytime: Focus on traffic management and tourist assistance');
    }
    
    // Seasonal recommendations
    if (isPeakSeason) {
      recommendations.push('🎄 Peak season: Expect higher tourist numbers and related incidents');
    } else {
      recommendations.push('🌴 Off-season: Focus on local community safety and infrastructure');
    }
    
    return recommendations;
  }
  
  // Analyze hotspots from location data
  function analyzeHotspots(locations) {
    if (!locations || !Array.isArray(locations) || locations.length === 0) {
      return [];
    }
    
    // Sort by count in descending order
    return [...locations]
      .sort((a, b) => b.count - a.count)
      .map((loc, index) => ({
        ...loc,
        priority: index + 1,
        riskScore: Math.min(100, Math.round((loc.count / locations[0].count) * 100))
      }));
  }
  
    // Generate optimized patrol routes
    function generatePatrolRoutes(hotspots, maxStops = 5) {
    if (!hotspots || !Array.isArray(hotspots) || hotspots.length === 0) {
      return [];
    }
    
    // Take top N hotspots based on priority
    return hotspots.slice(0, maxStops).map((hotspot, index) => ({
      ...hotspot,
      estimatedTime: `${(index + 1) * 15} min`,
      notes: `High ${hotspot.category} activity`
    }));
  }
  
    // Fallback prediction when AI is not available
    function updateBasicPrediction(filteredData) {
    try {
      const aiRise = document.getElementById('aiRise');
      if (!aiRise) return;
      
      const recentData = filteredData.daily.slice(-7);
      if (recentData.length < 2) return;
      
      const total = recentData.reduce((sum, day) => sum + day.count, 0);
      const avg = total / recentData.length;
      const lastDay = recentData[recentData.length - 1].count;
      const trend = lastDay > avg ? 'increase' : 'decrease';
      const percentage = Math.min(30, Math.abs(Math.round((lastDay - avg) / avg * 100)));
      
      aiRise.textContent = `${percentage}%`;
      aiRise.style.color = trend === 'increase' ? '#e74c3c' : '#2ecc71';
      
      const insightText = document.querySelector('.insights .desc');
      if (insightText) {
        insightText.innerHTML = `Based on recent trends, we expect a ${trend} of <strong>${percentage}%</strong> in the next period.`;
      }
    } catch (error) {
      console.error('Error in updateBasicPrediction:', error);
    }
  }
  
    // Initialize export buttons
    function initExportButtons() {
    // Helper function to safely add event listeners
    const safeAddListener = (id, event, callback) => {
      const element = document.getElementById(id);
      if (element) {
        element.addEventListener(event, callback);
      }
    };

    // Hourly chart exports
    safeAddListener('hourlyCsv', 'click', () => exportChartData('hourly'));
    safeAddListener('hourlyPng', 'click', () => exportChartImage('hourlyChart', 'hourly'));
    
    // Daily chart exports
    safeAddListener('dailyCsv', 'click', () => exportChartData('daily'));
    safeAddListener('dailyPng', 'click', () => exportChartImage('dailyChart', 'daily'));
    
    // Monthly chart exports
    safeAddListener('monthlyCsv', 'click', () => exportChartData('monthly'));
    safeAddListener('monthlyPng', 'click', () => exportChartImage('monthlyChart', 'monthly'));
    
    // Category chart export
    safeAddListener('categoryCsv', 'click', () => exportCategoryData());
  }
  
    // Export chart data as CSV
    function exportChartData(type) {
    let csvContent = '';
    
    switch (type) {
      case 'hourly':
        csvContent = 'Hour,Incidents\n';
        sampleData.hourly.forEach(hour => {
          csvContent += `${hour.hour}:00,${hour.count}\n`;
        });
        break;
        
      case 'daily':
        csvContent = 'Date,Incidents\n';
        sampleData.daily.forEach(day => {
          csvContent += `${day.date},${day.count}\n`;
        });
        break;
        
      case 'monthly':
        csvContent = 'Month,Year,Incidents\n';
        sampleData.monthly.forEach(month => {
          csvContent += `${month.month},${month.year},${month.count}\n`;
        });
        break;
    }
    
    downloadCSV(csvContent, `incidents_${type}_export_${new Date().toISOString().split('T')[0]}.csv`);
  }
  
    // Export category data as CSV
    function exportCategoryData() {
    let csvContent = 'Category,Count,Percentage\n';
    const total = Object.values(sampleData.categories).reduce((a, b) => a + b, 0);
    
    Object.entries(sampleData.categories).forEach(([category, count]) => {
      const percentage = ((count / total) * 100).toFixed(1);
      csvContent += `${formatCategory(category)},${count},${percentage}%\n`;
    });
    
    downloadCSV(csvContent, `incidents_categories_export_${new Date().toISOString().split('T')[0]}.csv`);
  }
  
  // Export chart as PNG
  function exportChartImage(chartId, filenamePrefix) {
    const canvas = $(chartId);
    if (!canvas) return;
    
    const link = document.createElement('a');
    link.download = `${filenamePrefix}_chart_${new Date().toISOString().split('T')[0]}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }
  
  // Helper to download CSV
  function downloadCSV(content, filename) {
    try {
      const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return true;
    } catch (error) {
      console.error('Error exporting CSV:', error);
      alert('Error exporting data. Please try again.');
      return false;
    }
  }
  
  // Export patrol plan
  function exportPatrolPlan() {
    const patrolItems = document.querySelectorAll('#patrolList li');
    if (!patrolItems.length) {
      alert('No patrol recommendations available to export.');
      return;
    }
    
    let csvContent = 'Priority,Location,Time,Notes\n';
    
    patrolItems.forEach((item, index) => {
      const location = item.querySelector('.location')?.textContent || 'Unknown';
      const time = item.querySelector('.time')?.textContent || '';
      const notes = item.querySelector('.notes')?.textContent || '';
      csvContent += `${index + 1},${location},${time},"${notes}"\n`;
    });
    
    const filename = `patrol_plan_${new Date().toISOString().split('T')[0]}.csv`;
    downloadCSV(csvContent, filename);
  }
  
  // Test function to manually trigger top locations update
  function testTopLocations() {
    console.log('=== TEST: Manually updating top locations ===');
    const testLocations = [
      { name: 'Panaji', count: 142 },
      { name: 'Margao', count: 98 },
      { name: 'Vasco da Gama', count: 87 },
      { name: 'Mapusa', count: 76 },
      { name: 'Ponda', count: 65 }
    ];
    
    console.log('Test locations data:', testLocations);
    updateTopLocations(testLocations);
  }

  // Initialize AI features and models
  async function initializeAIFeatures() {
    try {
      setLoadingState(true, 'Initializing AI features...');
      
      // Check if TensorFlow.js is available
      if (typeof tf === 'undefined') {
        console.warn('TensorFlow.js not found. Using simplified prediction model.');
        return false;
      }
      
      // Load models or initialize AI components
      await Promise.all([
        // Add any model loading here if needed
      ]);
      
      console.log('AI features initialized');
      return true;
    } catch (error) {
      console.error('Error initializing AI features:', error);
      showError('Some AI features may be limited. Using basic prediction model.');
      return false;
    } finally {
      setLoadingState(false);
    }
  }
  
  // Set up event listeners for AI components
  function setupAIEventListeners() {
    // Refresh patrol recommendations
    const refreshPatrolBtn = document.getElementById('refreshPatrolBtn');
    if (refreshPatrolBtn) {
      refreshPatrolBtn.addEventListener('click', async () => {
        try {
          setLoadingState(true, 'Updating patrol recommendations...');
          const filteredData = getFilteredData(sampleData);
          await updateAIIntelligence(filteredData);
        } catch (error) {
          console.error('Error refreshing patrol:', error);
          showError('Failed to update patrol recommendations');
        } finally {
          setLoadingState(false);
        }
      });
    }
    
    // Start patrol button
    const startPatrolBtn = document.getElementById('startPatrolBtn');
    if (startPatrolBtn) {
      startPatrolBtn.addEventListener('click', () => {
        // In a real app, this would start navigation or tracking
        showMessage('Patrol started! Follow the recommended route.', 'success');
      });
    }
    
    // Export plan button
    const exportPlanBtn = document.getElementById('exportPlanBtn');
    if (exportPlanBtn) {
      exportPlanBtn.addEventListener('click', exportPatrolPlan);
    }
  }
  
  // Show a temporary message to the user
  function showMessage(message, type = 'info', duration = 3000) {
    const messageEl = document.createElement('div');
    messageEl.className = `message ${type}`;
    messageEl.textContent = message;
    
    document.body.appendChild(messageEl);
    
    // Auto-remove after duration
    setTimeout(() => {
      messageEl.classList.add('fade-out');
      setTimeout(() => messageEl.remove(), 300);
    }, duration);
  }
  
  // Initialize the application when the DOM is fully loaded
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      // Initialize the application
      init();
      
      // Initialize AI features
      await initializeAIFeatures();
      
      // Add event listeners for AI components
      setupAIEventListeners();
      
      // Initial data load
      await updateVisualizations();
    } catch (error) {
      console.error('Error initializing application:', error);
      showError('Failed to initialize application. Please refresh the page.');
    }
    
    // Initialize AI models in the background
    if (typeof initAIModels === 'function') {
      try {
        await initAIModels();
        console.log('AI models initialized successfully');
        // Initial AI update with current data
        const filteredData = getFilteredData(sampleData);
        await updateAIIntelligence(filteredData);
      } catch (error) {
        console.error('Error initializing AI models:', error);
      }
    }
    
    // Set up periodic updates for AI insights (every 5 minutes)
    setInterval(async () => {
      if (typeof updateAIIntelligence === 'function') {
        const filteredData = getFilteredData(sampleData);
        await updateAIIntelligence(filteredData);
      }
    }, 300000);
    
    // Add test button for debugging
    const testButton = document.createElement('button');
    testButton.textContent = 'Test AI Features';
    testButton.style.position = 'fixed';
    testButton.style.bottom = '20px';
    testButton.style.right = '20px';
    testButton.style.zIndex = '1000';
    testButton.style.padding = '10px 15px';
    testButton.style.background = '#3b82f6';
    testButton.style.color = 'white';
    testButton.style.border = 'none';
    testButton.style.borderRadius = '4px';
    testButton.style.cursor = 'pointer';
    testButton.addEventListener('click', async () => {
      console.log('Testing AI features...');
      const testData = getSampleData();
      await updateAIIntelligence(testData);
    });
    document.body.appendChild(testButton);
    
    console.log('AI features initialized and test button added');
  });
  
  // Sample data generator for testing
  function getSampleData() {
    return {
      ...sampleData,
      // Add any test-specific modifications here
    };
  }
  
  // Expose functions to global scope for debugging
  window.app = {
    updateVisualizations,
    updateAIIntelligence,
    getSampleData
  };
})();
