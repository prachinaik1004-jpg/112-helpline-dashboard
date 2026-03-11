(function(){
  'use strict';

  const $ = (id) => document.getElementById(id);
  const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

  // Real Goa locations for ride monitoring
  const GOA_LOCATIONS = [
    { name: 'Panaji Bus Stand', lat: 15.4909, lng: 73.8278 },
    { name: 'Margao Railway Station', lat: 15.2993, lng: 74.1240 },
    { name: 'Vasco da Gama Airport', lat: 15.3960, lng: 73.8157 },
    { name: 'Mapusa Market', lat: 15.5937, lng: 73.8070 },
    { name: 'Calangute Beach', lat: 15.5394, lng: 73.7554 },
    { name: 'Anjuna Beach', lat: 15.5732, lng: 73.7407 },
    { name: 'Baga Beach', lat: 15.5559, lng: 73.7516 },
    { name: 'Colva Beach', lat: 15.2798, lng: 73.9114 },
    { name: 'Ponda Market', lat: 15.4013, lng: 74.0071 },
    { name: 'Candolim Beach', lat: 15.5167, lng: 73.7619 }
  ];

  let routeMap = null;
  let selectedRide = null;
  let expectedRoute = null;
  let actualRoute = null;
  let currentLocationMarker = null;

  // WebSocket connection
  let socket = null;
  let isConnected = false;

  // Mock active rides data
  const activeRides = [
    {
      id: 'RSM-001',
      passenger: 'Priya Sharma',
      phone: '+91-9876543210',
      from: 'Panaji Bus Stand',
      to: 'Calangute Beach',
      fromCoords: [15.4909, 73.8278],
      toCoords: [15.5394, 73.7554],
      currentCoords: [15.5150, 73.7916],
      status: 'on-route',
      startTime: new Date(Date.now() - 25 * 60 * 1000),
      lastUpdate: new Date(Date.now() - 2 * 60 * 1000)
    },
    {
      id: 'RSM-002',
      passenger: 'Anjali Desai',
      phone: '+91-9876543211',
      from: 'Margao Railway Station',
      to: 'Colva Beach',
      fromCoords: [15.2993, 74.1240],
      toCoords: [15.2798, 73.9114],
      currentCoords: [15.2895, 74.0177],
      status: 'deviated',
      startTime: new Date(Date.now() - 45 * 60 * 1000),
      lastUpdate: new Date(Date.now() - 5 * 60 * 1000)
    },
    {
      id: 'RSM-003',
      passenger: 'Kavya Nair',
      phone: '+91-9876543212',
      from: 'Mapusa Market',
      to: 'Anjuna Beach',
      fromCoords: [15.5937, 73.8070],
      toCoords: [15.5732, 73.7407],
      currentCoords: [15.5834, 73.7738],
      status: 'sos-alert',
      startTime: new Date(Date.now() - 35 * 60 * 1000),
      lastUpdate: new Date(Date.now() - 1 * 60 * 1000)
    },
    {
      id: 'RSM-004',
      passenger: 'Meera Patel',
      phone: '+91-9876543213',
      from: 'Vasco da Gama Airport',
      to: 'Baga Beach',
      fromCoords: [15.3960, 73.8157],
      toCoords: [15.5559, 73.7516],
      currentCoords: [15.4759, 73.7836],
      status: 'on-route',
      startTime: new Date(Date.now() - 15 * 60 * 1000),
      lastUpdate: new Date(Date.now() - 1 * 60 * 1000)
    }
  ];

  // Mock verification logs
  let verificationLogs = [
    {
      id: 'LOG-001',
      rideId: 'RSM-002',
      timestamp: new Date(Date.now() - 10 * 60 * 1000),
      type: 'automated_call',
      status: 'failed',
      message: 'Automated check-in call initiated',
      details: 'No response after 3 rings'
    },
    {
      id: 'LOG-002',
      rideId: 'RSM-002',
      timestamp: new Date(Date.now() - 8 * 60 * 1000),
      type: 'sms_verification',
      status: 'pending',
      message: 'SMS verification sent',
      details: 'Reply SAFE if you are okay - Code: 4729'
    },
    {
      id: 'LOG-003',
      rideId: 'RSM-003',
      timestamp: new Date(Date.now() - 5 * 60 * 1000),
      type: 'sos_trigger',
      status: 'failed',
      message: 'SOS alert triggered by passenger',
      details: 'Emergency button pressed - Location shared'
    },
    {
      id: 'LOG-004',
      rideId: 'RSM-001',
      timestamp: new Date(Date.now() - 3 * 60 * 1000),
      type: 'automated_call',
      status: 'success',
      message: 'Automated check-in call completed',
      details: 'Passenger responded with correct security code: 8291'
    }
  ];

  // Initialize route map
  function initializeRouteMap() {
    const mapContainer = $('routeMap');
    if (!mapContainer) return;

    routeMap = L.map('routeMap').setView([15.4909, 73.8278], 11);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: ' OpenStreetMap contributors'
    }).addTo(routeMap);
  }

  // Render active rides table
  function renderActiveRides(rides = activeRides) {
    const tbody = $('ridesTable')?.querySelector('tbody');
    if (!tbody) return;

    tbody.innerHTML = '';
    rides.forEach(ride => {
      const tr = document.createElement('tr');
      tr.dataset.rideId = ride.id;
      tr.innerHTML = `
        <td><strong>${ride.passenger}</strong></td>
        <td>${ride.phone}</td>
        <td>${ride.from} → ${ride.to}</td>
        <td>${ride.currentCoords[0].toFixed(4)}, ${ride.currentCoords[1].toFixed(4)}</td>
        <td><span class="status ${ride.status}">${ride.status.replace('-', ' ')}</span></td>
      `;
      
      tr.addEventListener('click', () => selectRide(ride));
      tbody.appendChild(tr);
    });
  }

  // Select a ride and update route viewer
  function selectRide(ride) {
    selectedRide = ride;
    
    // Update UI
    document.querySelectorAll('#ridesTable tbody tr').forEach(tr => tr.classList.remove('selected'));
    document.querySelector(`[data-ride-id="${ride.id}"]`)?.classList.add('selected');
    
    // Update route info
    const routeInfo = $('routeInfo');
    if (routeInfo) {
      routeInfo.innerHTML = `
        <span class="passenger-name">${ride.passenger}</span>
        <span class="status ${ride.status}">${ride.status.replace('-', ' ')}</span>
      `;
    }
    
    // Update map
    updateRouteMap(ride);
    
    // Filter logs for this ride
    renderVerificationLogs(ride.id);
  }

  // Update route map with expected vs actual route
  function updateRouteMap(ride) {
    if (!routeMap) return;

    // Clear existing routes
    if (expectedRoute) routeMap.removeLayer(expectedRoute);
    if (actualRoute) routeMap.removeLayer(actualRoute);
    if (currentLocationMarker) routeMap.removeLayer(currentLocationMarker);

    // Set map view to show the route
    const bounds = L.latLngBounds([ride.fromCoords, ride.toCoords, ride.currentCoords]);
    routeMap.fitBounds(bounds, { padding: [20, 20] });

    // Expected route (green line - direct path)
    expectedRoute = L.polyline([ride.fromCoords, ride.toCoords], {
      color: '#22c55e',
      weight: 4,
      opacity: 0.8
    }).addTo(routeMap);

    // Actual route (blue line with potential deviation)
    const actualPath = generateActualRoute(ride);
    actualRoute = L.polyline(actualPath, {
      color: '#3b82f6',
      weight: 3,
      opacity: 0.9
    }).addTo(routeMap);

    // Add deviation highlighting if status is deviated or sos-alert
    if (ride.status === 'deviated' || ride.status === 'sos-alert') {
      const deviationPath = actualPath.slice(-3); // Last few points showing deviation
      L.polyline(deviationPath, {
        color: '#ef4444',
        weight: 5,
        opacity: 0.8
      }).addTo(routeMap);
    }

    // Current location marker (purple)
    currentLocationMarker = L.marker(ride.currentCoords, {
      icon: L.divIcon({
        html: '<div style="background:#8b5cf6;width:16px;height:16px;border-radius:50%;border:3px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);"></div>',
        className: 'current-location-marker',
        iconSize: [22, 22],
        iconAnchor: [11, 11]
      })
    }).addTo(routeMap);

    // Add start and end markers
    L.marker(ride.fromCoords, {
      icon: L.divIcon({
        html: '<div style="background:#22c55e;color:white;padding:4px 8px;border-radius:4px;font-weight:bold;font-size:12px;">START</div>',
        className: 'route-marker',
        iconAnchor: [25, 15]
      })
    }).addTo(routeMap);

    L.marker(ride.toCoords, {
      icon: L.divIcon({
        html: '<div style="background:#ef4444;color:white;padding:4px 8px;border-radius:4px;font-weight:bold;font-size:12px;">END</div>',
        className: 'route-marker',
        iconAnchor: [20, 15]
      })
    }).addTo(routeMap);
  }

  // Generate realistic actual route with potential deviations
  function generateActualRoute(ride) {
    const path = [ride.fromCoords];
    
    // Add some intermediate points
    const steps = 5;
    for (let i = 1; i < steps; i++) {
      const progress = i / steps;
      let lat = ride.fromCoords[0] + (ride.toCoords[0] - ride.fromCoords[0]) * progress;
      let lng = ride.fromCoords[1] + (ride.toCoords[1] - ride.fromCoords[1]) * progress;
      
      // Add deviation for certain statuses
      if (ride.status === 'deviated' || ride.status === 'sos-alert') {
        if (i >= 2) { // Deviation starts partway through
          lat += (Math.random() - 0.5) * 0.01;
          lng += (Math.random() - 0.5) * 0.01;
        }
      }
      
      path.push([lat, lng]);
    }
    
    path.push(ride.currentCoords);
    return path;
  }

  // Render verification logs
  function renderVerificationLogs(rideId = null) {
    const logsList = $('verificationLogs');
    if (!logsList) return;

    const filteredLogs = rideId ? 
      verificationLogs.filter(log => log.rideId === rideId) : 
      verificationLogs;

    logsList.innerHTML = '';
    filteredLogs.sort((a, b) => b.timestamp - a.timestamp).forEach(log => {
      const li = document.createElement('li');
      li.innerHTML = `
        <div class="log-entry">
          <div class="log-message">${log.message}</div>
          <div class="log-details">${log.details}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;">
          <span class="log-status ${log.status}">${log.status.toUpperCase()}</span>
          <span class="log-timestamp">${log.timestamp.toLocaleTimeString()}</span>
        </div>
      `;
      logsList.appendChild(li);
    });
  }

  // WebSocket connection and event handling functions
  function initializeWebSocket() {
    // Connect to WebSocket server (assuming backend runs on same host as frontend)
    socket = io('http://localhost:5000');

    socket.on('connect', function() {
      console.log('Connected to WebSocket server');
      isConnected = true;

      // Join ride monitoring room
      socket.emit('join_ride_monitoring', { ride_id: 'general' });

      // Update connection status in UI
      updateConnectionStatus('Connected', 'success');
    });

    socket.on('disconnect', function() {
      console.log('Disconnected from WebSocket server');
      isConnected = false;
      updateConnectionStatus('Disconnected', 'error');
    });

    socket.on('connection_status', function(data) {
      console.log('Connection status:', data);
      updateConnectionStatus(data.status === 'connected' ? 'Connected' : 'Disconnected',
                           data.status === 'connected' ? 'success' : 'error');
    });

    socket.on('signal_received', function(data) {
      console.log('Signal received:', data);
      handleIncomingSignal(data);
    });

    socket.on('ride_status_updated', function(data) {
      console.log('Ride status updated:', data);
      handleRideStatusUpdate(data);
    });

    socket.on('sos_alert_received', function(data) {
      console.log('SOS Alert received:', data);
      handleSOSAlert(data);
    });

    socket.on('joined_room', function(data) {
      console.log('Joined room:', data.room);
    });
  }

  function updateConnectionStatus(status, statusClass) {
    // Update connection status indicator in UI if it exists
    let statusElement = document.getElementById('connectionStatus');
    if (!statusElement) {
      statusElement = document.createElement('div');
      statusElement.id = 'connectionStatus';
      statusElement.className = 'connection-status';
      statusElement.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        padding: 8px 12px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: bold;
        z-index: 1000;
        background: ${statusClass === 'success' ? '#22c55e' : '#ef4444'};
        color: white;
      `;
      document.body.appendChild(statusElement);
    }

    statusElement.textContent = `WebSocket: ${status}`;
    statusElement.style.background = statusClass === 'success' ? '#22c55e' : '#ef4444';
  }

  function sendSignal(signalType, rideId, data) {
    if (!isConnected || !socket) {
      console.warn('WebSocket not connected, cannot send signal');
      return false;
    }

    const signalData = {
      signal_type: signalType,
      ride_id: rideId,
      data: data,
      timestamp: new Date().toISOString()
    };

    socket.emit('send_signal', signalData);
    console.log('Signal sent:', signalData);
    return true;
  }

  function sendRideStatusUpdate(rideId, status, location) {
    if (!isConnected || !socket) {
      console.warn('WebSocket not connected, cannot send ride status update');
      return false;
    }

    const updateData = {
      ride_id: rideId,
      status: status,
      location: location,
      timestamp: new Date().toISOString()
    };

    socket.emit('update_ride_status', updateData);
    console.log('Ride status update sent:', updateData);
    return true;
  }

  function sendSOSAlert(rideId, location, message = 'SOS Alert triggered') {
    if (!isConnected || !socket) {
      console.warn('WebSocket not connected, cannot send SOS alert');
      return false;
    }

    const sosData = {
      ride_id: rideId,
      location: location,
      message: message,
      timestamp: new Date().toISOString()
    };

    socket.emit('sos_alert', sosData);
    console.log('SOS Alert sent:', sosData);
    return true;
  }

  function handleIncomingSignal(data) {
    const { signal_type, ride_id, data: signalData, timestamp } = data;

    // Add to verification logs
    const logMessage = `Signal received: ${signal_type}`;
    const logDetails = `From ride ${ride_id} at ${new Date(timestamp).toLocaleTimeString()}`;

    addVerificationLog(ride_id, signal_type, 'success', logMessage, JSON.stringify(signalData));

    // Update UI based on signal type
    switch (signal_type) {
      case 'location_update':
        updateRideLocation(ride_id, signalData);
        break;
      case 'status_change':
        updateRideStatus(ride_id, signalData.status);
        break;
      case 'emergency_signal':
        handleEmergencySignal(ride_id, signalData);
        break;
      default:
        console.log('Unhandled signal type:', signal_type);
    }
  }

  function handleRideStatusUpdate(data) {
    const { ride_id, status, location, timestamp } = data;

    // Update ride in activeRides array
    const ride = activeRides.find(r => r.id === ride_id);
    if (ride) {
      ride.status = status;
      if (location && location.lat && location.lng) {
        ride.currentCoords = [location.lat, location.lng];
      }
      ride.lastUpdate = new Date(timestamp);

      // Re-render if this ride is selected
      if (selectedRide && selectedRide.id === ride_id) {
        selectRide(ride);
      }

      // Re-render table to show updated status
      renderActiveRides();
    }

    // Add to verification logs
    addVerificationLog(ride_id, 'status_update', 'success',
                      `Ride status updated to: ${status}`,
                      `Location: ${JSON.stringify(location)}`);
  }

  function handleSOSAlert(data) {
    const { ride_id, location, message, timestamp } = data;

    // Update ride status to sos-alert
    const ride = activeRides.find(r => r.id === ride_id);
    if (ride) {
      ride.status = 'sos-alert';
      if (location && location.lat && location.lng) {
        ride.currentCoords = [location.lat, location.lng];
      }
      ride.lastUpdate = new Date(timestamp);

      // Re-render if this ride is selected
      if (selectedRide && selectedRide.id === ride_id) {
        selectRide(ride);
      }

      // Re-render table
      renderActiveRides();
    }

    // Add urgent log entry
    addVerificationLog(ride_id, 'sos_trigger', 'failed', message,
                      `Emergency location: ${JSON.stringify(location)}`);

    // Show visual alert (you can customize this)
    showSOSAlert(ride_id, message, location);
  }

  function showSOSAlert(rideId, message, location) {
    // Create and show SOS alert modal or notification
    const alertDiv = document.createElement('div');
    alertDiv.className = 'sos-alert-modal';
    alertDiv.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: #ef4444;
      color: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 2000;
      text-align: center;
      max-width: 400px;
    `;

    alertDiv.innerHTML = `
      <h3 style="margin: 0 0 10px 0;">🚨 SOS ALERT</h3>
      <p style="margin: 0 0 15px 0;"><strong>Ride ${rideId}</strong></p>
      <p style="margin: 0 0 15px 0;">${message}</p>
      <p style="margin: 0 0 15px 0; font-size: 14px;">
        Location: ${location.lat?.toFixed(4) || 'Unknown'}, ${location.lng?.toFixed(4) || 'Unknown'}
      </p>
      <button onclick="this.parentElement.remove()" style="
        background: white;
        color: #ef4444;
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
        font-weight: bold;
      ">DISMISS</button>
    `;

    document.body.appendChild(alertDiv);

    // Auto-remove after 10 seconds
    setTimeout(() => {
      if (alertDiv.parentElement) {
        alertDiv.remove();
      }
    }, 10000);
  }

  function updateRideLocation(rideId, locationData) {
    const ride = activeRides.find(r => r.id === rideId);
    if (ride && locationData.lat && locationData.lng) {
      ride.currentCoords = [locationData.lat, locationData.lng];
      ride.lastUpdate = new Date();

      // Update map if this ride is selected
      if (selectedRide && selectedRide.id === rideId) {
        updateRouteMap(ride);
      }
    }
  }

  function updateRideStatus(rideId, newStatus) {
    const ride = activeRides.find(r => r.id === rideId);
    if (ride) {
      ride.status = newStatus;
      ride.lastUpdate = new Date();
    }
  }

  function handleEmergencySignal(rideId, signalData) {
    // Handle emergency signals from other monitoring systems
    addVerificationLog(rideId, 'emergency_signal', 'failed',
                      'Emergency signal received from external system',
                      JSON.stringify(signalData));
  }

  // Add new verification log
  function addVerificationLog(rideId, type, status, message, details) {
    const newLog = {
      id: `LOG-${Date.now()}`,
      rideId: rideId,
      timestamp: new Date(),
      type: type,
      status: status,
      message: message,
      details: details
    };

    verificationLogs.unshift(newLog);

    // Re-render if this ride is selected
    if (selectedRide && selectedRide.id === rideId) {
      renderVerificationLogs(rideId);
    }
  }

  // Simulate real-time updates
  function simulateRealTimeUpdates() {
    setInterval(() => {
      activeRides.forEach(ride => {
        // Simulate location updates
        const movement = 0.001; // Small GPS movement
        ride.currentCoords[0] += (Math.random() - 0.5) * movement;
        ride.currentCoords[1] += (Math.random() - 0.5) * movement;
        ride.lastUpdate = new Date();
        
        // Send location update via WebSocket if connected
        if (isConnected) {
          sendSignal('location_update', ride.id, {
            lat: ride.currentCoords[0],
            lng: ride.currentCoords[1],
            accuracy: 'high'
          });

          // Occasionally send status updates via WebSocket
          if (Math.random() < 0.3) { // 30% chance
            sendRideStatusUpdate(ride.id, ride.status, {
              lat: ride.currentCoords[0],
              lng: ride.currentCoords[1]
            });
          }
        }
        
        // Occasionally trigger verification events
        if (Math.random() < 0.1) { // 10% chance per update
          const events = [
            { type: 'automated_call', status: 'success', message: 'Automated check-in completed', details: 'Passenger responded with security code' },
            { type: 'sms_verification', status: 'pending', message: 'SMS verification sent', details: `Reply SAFE if okay - Code: ${rand(1000, 9999)}` },
            { type: 'gps_update', status: 'success', message: 'GPS location updated', details: 'Location tracking active' }
          ];
          
          const event = events[rand(0, events.length - 1)];
          addVerificationLog(ride.id, event.type, event.status, event.message, event.details);

          // Send verification event via WebSocket if connected
          if (isConnected) {
            sendSignal('verification_event', ride.id, {
              event_type: event.type,
              status: event.status,
              message: event.message,
              details: event.details
            });
          }
        }

        // Occasionally trigger SOS alerts for testing
        if (Math.random() < 0.05) { // 5% chance per update
          ride.status = 'sos-alert';
          const sosMessage = 'Emergency button pressed - Location shared';

          addVerificationLog(ride.id, 'sos_trigger', 'failed', sosMessage,
                           'Emergency button pressed - Location shared');

          // Send SOS alert via WebSocket if connected
          if (isConnected) {
            sendSOSAlert(ride.id, {
              lat: ride.currentCoords[0],
              lng: ride.currentCoords[1]
            }, sosMessage);
          }
        }
      });
      
      // Update current ride display
      if (selectedRide) {
        const currentRide = activeRides.find(r => r.id === selectedRide.id);
        if (currentRide) {
          updateRouteMap(currentRide);
        }
      }
      
      // Re-render table to show updated GPS coordinates
      renderActiveRides();
    }, 5000); // Update every 5 seconds
  }

  // Filter rides based on status
  function filterRides() {
    const filter = $('rideFilter').value;
    const filteredRides = filter === 'all' ? 
      activeRides : 
      activeRides.filter(ride => ride.status === filter);
    
    renderActiveRides(filteredRides);
  }

  // Initialize the application
  function init() {
    initializeRouteMap();
    initializeWebSocket(); // Initialize WebSocket connection
    renderActiveRides();
    renderVerificationLogs();
    
    // Event listeners
    $('refreshBtn')?.addEventListener('click', () => {
      renderActiveRides();
      renderVerificationLogs();
    });
    
    $('rideFilter')?.addEventListener('change', filterRides);
    
    $('clearLogsBtn')?.addEventListener('click', () => {
      verificationLogs = [];
      renderVerificationLogs();
    });
    
    $('exportLogsBtn')?.addEventListener('click', () => {
      const data = JSON.stringify(verificationLogs, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'verification-logs.json';
      a.click();
    });
    
    // Start real-time simulation
    simulateRealTimeUpdates();
    
    // Auto-select first ride
    if (activeRides.length > 0) {
      setTimeout(() => selectRide(activeRides[0]), 1000);
    }
  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); } else { init(); }
})();
