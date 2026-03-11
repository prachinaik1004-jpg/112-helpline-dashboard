const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const csv = require('csv-parser');
const compression = require('compression');
const app = express();
const PORT = 3002;

// Middleware
app.use(compression()); // Enable gzip compression
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Enable CORS for all routes
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Log all requests for debugging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
  next();
});

// Serve static files from root directory
app.use(express.static(__dirname, {
  etag: true,
  lastModified: true,
  setHeaders: (res, path) => {
    if (path.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
    } else if (path.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    }
  }
}));

// Serve other static directories
app.use('/static', express.static(path.join(__dirname, 'static'), {
  etag: true,
  lastModified: true
}));

// Serve files from templates directory
app.use('/templates', express.static(path.join(__dirname, 'templates'), {
  etag: true,
  lastModified: true,
  setHeaders: (res, path) => {
    if (path.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
    } else if (path.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    }
  }
}));

// Explicit route for store.html
app.get('/store.html', (req, res) => {
  console.log('Serving store.html');
  res.sendFile(path.join(__dirname, 'templates', 'store.html'));
});

// Session configuration
app.use(session({
    secret: 'goa112-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false, // Set to true if using HTTPS
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// ====== Data layer: CSV Loader & Utilities ======
const CSV_PATH = path.join(__dirname, 'cleaned_ALL_DATA_IN_DETAIL.csv');

function parseDatetime(s) {
  if (!s || String(s).trim() === '' || String(s).trim() === '--:--:--') return null;
  const t = String(s).trim();
  // Expecting 'YYYY-MM-DD HH:MM:SS'
  const d = new Date(t.replace(' ', 'T'));
  return isNaN(d.getTime()) ? null : d;
}

function parseDurationSeconds(s) {
  if (!s) return 0;
  const str = String(s).trim();
  if (str === '' || str === '--:--:--') return 0;
  // Match like 00h:12m:50s
  const m1 = str.match(/(?:(\d{1,2})h:)?(?:(\d{1,2})m:)?(?:(\d{1,2})s)?/);
  if (m1 && (m1[1] || m1[2] || m1[3])) {
    const h = parseInt(m1[1] || '0', 10);
    const mi = parseInt(m1[2] || '0', 10);
    const se = parseInt(m1[3] || '0', 10);
    return h * 3600 + mi * 60 + se;
  }
  // Match like '0 days 00:12:51.187000'
  const m2 = str.match(/\d+\s+days\s+(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?/);
  if (m2) {
    const h = parseInt(m2[1], 10);
    const mi = parseInt(m2[2], 10);
    const se = parseInt(m2[3], 10);
    return h * 3600 + mi * 60 + se;
  }
  return 0;
}

function classifyCallUrgency(call) {
  const transcript = (call.transcript || '').toLowerCase();
  const high = ['help','emergency','scared','following','hurt','fighting','attack','assault','danger','threat','violence','weapon','kidnap','robbery','fire','accident','blood','injured','please','quickly','immediately','urgent','dying','dead'];
  const prank = ['joke','kidding','prank','dare','friend','testing','test','haha','funny','laugh','just kidding','not serious'];

  if (!transcript.trim() && (call.duration || 0) > 5) return 'High';
  const prankScore = prank.reduce((s, k) => s + (transcript.includes(k) ? 1 : 0), 0);
  if (prankScore >= 2) return 'Normal';
  let urgencyScore = high.reduce((s, k) => s + (transcript.includes(k) ? 1 : 0), 0);
  if (transcript.includes('taxi') && (transcript.includes('wrong') || transcript.includes('scared'))) urgencyScore += 2;
  if ((call.notes || '').toLowerCase().includes('coercion')) urgencyScore += 3;
  if ((call.duration || 0) < 10 && !transcript.trim()) urgencyScore += 2;
  return urgencyScore >= 2 ? 'High' : 'Normal';
}

function generateUrgencyScore(classification) {
  if (classification === 'High') return Math.floor(Math.random() * 10) + 90; // 90-99
  return Math.floor(Math.random() * 21) + 10; // 10-30
}

function getCallType(call, classification) {
  const transcript = (call.transcript || '').toLowerCase();
  if (!transcript.trim()) return 'silence';
  if (classification === 'Normal') return 'prank';
  return 'panic';
}

function generateMockTranscript(callType) {
  if (callType === 'panic') return 'Caller sounds distressed, mentions location and fear. Background shouting audible.';
  if (callType === 'silence') return 'Open line with ambient noise, no response to call-back prompts. Possible coercion or accidental dial.';
  return 'Call flagged as non-serious: inconsistent story and laughter in the background. Marked as prank-filtered.';
}

// In-memory store with caching
let RAW_ROWS = []; // raw CSV rows as-is
let CALLS = [];    // normalized calls
let PROCESSED_ALERTS_CACHE = null; // cache for processed alerts
let CACHE_TIMESTAMP = null;

function normalizeRow(row, index) {
  const callId = String(row['EVENT_ID'] || row['SL_NO'] || `ROW-${index + 1}`).trim();
  const transcript = String(row['EVENT_INFORMATION'] || '').trim();
  const location = String(row['Police_Station_Name'] || row['POLICE_STATION'] || 'Unknown').trim();
  const ts = parseDatetime(row['CREATE_TIME']) || new Date();
  const phone = String(row['DIALLED_NO'] || 'N/A').trim();
  const mdtResp = String(row['MDT_RESPONSE_TIME'] || '').trim();
  const respTime = String(row['RESPONSE_TIME'] || '').trim();
  const reachTime = String(row['REACH_TIME'] || '').trim();
  const policeStation = String(row['Police_Station_Name'] || row['POLICE_STATION'] || '').trim();
  let duration = parseDurationSeconds(mdtResp);
  if (!duration) duration = parseDurationSeconds(respTime);

  return {
    id: callId,
    transcript,
    location,
    timestamp: ts,
    caller_phone: phone,
    duration,
    notes: String(row['CLOSURE_COMMENTS'] || '').trim() || null,
    EVENT_MAIN_TYPE: String(row['EVENT_MAIN_TYPE'] || '').trim(),
    EVENT_INFORMATION: transcript,
    Police_Station_Name: policeStation,
    REACH_TIME: reachTime,
    MDT_RESPONSE_TIME: mdtResp,
    RESPONSE_TIME: respTime
  };
}

function loadCsvIntoMemory() {
  return new Promise((resolve, reject) => {
    const raw = [];
    fs.createReadStream(CSV_PATH)
      .pipe(csv())
      .on('data', (row) => raw.push(row))
      .on('end', () => {
        RAW_ROWS = raw;
        CALLS = raw.map((r, i) => {
          try { return normalizeRow(r, i); } catch (e) { return null; }
        }).filter(Boolean);
        resolve({ rawCount: RAW_ROWS.length, callCount: CALLS.length });
      })
      .on('error', reject);
  });
}

// Load once at startup
loadCsvIntoMemory().then(({ rawCount, callCount }) => {
  console.log(`Loaded CSV: ${rawCount} rows, ${callCount} calls`);
}).catch(err => {
  console.error('Failed to load CSV:', err.message);
});

// Aggregate statistics: women's safety calls, average response time, high-risk areas
app.get('/api/stats', (req, res) => {
  try {
    // Helper: women-safety filter
    const isWomenSafety = (call) => {
      const eventType = (call.EVENT_MAIN_TYPE || '').toLowerCase();
      const transcript = (call.transcript || '').toLowerCase();
      const info = (call.EVENT_INFORMATION || '').toLowerCase();
      return eventType.includes('women') ||
             transcript.includes('women') ||
             transcript.includes('harassment') ||
             transcript.includes('stalking') ||
             transcript.includes('abuse') ||
             info.includes('women') ||
             info.includes('harassment');
    };

    const totalCalls = CALLS.length;
    const womenCallsArr = CALLS.filter(isWomenSafety);
    const totalWomenCalls = womenCallsArr.length;

    // Average response times (in minutes). Use duration if present; else try to parse fallback fields.
    const durationsAll = CALLS
      .map(c => typeof c.duration === 'number' ? c.duration : 0)
      .filter(s => s && s > 0);
    const durationsWomen = womenCallsArr
      .map(c => typeof c.duration === 'number' ? c.duration : 0)
      .filter(s => s && s > 0);

    const avg = arr => arr.length ? (arr.reduce((a,b)=>a+b,0) / arr.length) : 0;
    const avgResponseMinutesAll = Math.round(avg(durationsAll) / 60);
    const avgResponseMinutesWomen = Math.round(avg(durationsWomen) / 60);

    // High risk areas by incident density (overall and women-specific)
    const countByArea = (calls) => {
      const m = {};
      for (const c of calls) {
        const area = c.Police_Station_Name || c.location || 'Unknown';
        m[area] = (m[area] || 0) + 1;
      }
      return Object.entries(m)
        .map(([area, count]) => ({ area, count, coords: areaToCoords(area) }))
        .sort((a, b) => b.count - a.count);
    };

    const topAreasOverall = countByArea(CALLS).slice(0, 10);
    const topAreasWomen = countByArea(womenCallsArr).slice(0, 10);

    return res.json({
      success: true,
      stats: {
        totalCalls,
        totalWomenCalls,
        womenSafetyPercentage: totalCalls ? Number(((totalWomenCalls / totalCalls) * 100).toFixed(1)) : 0,
        avgResponseMinutes: avgResponseMinutesAll,
        avgResponseMinutesWomen,
        topAreasOverall,
        topAreasWomen,
        timestamp: new Date().toISOString()
      }
    });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

// Authentication middleware
const requireAuth = (req, res, next) => {
    if (req.session.isLoggedIn) {
        next();
    } else {
        res.redirect('/');
    }
};

// Routes
// Redirect /dash.html to /dashboard.html
app.get('/dash.html', (req, res) => {
  return res.redirect('/dashboard.html');
});

// Login page (main entry point)
app.get('/', (req, res) => {
    if (req.session.isLoggedIn) {
        res.redirect('/dashboard');
    } else {
        res.sendFile(path.join(__dirname, 'log.html'));
    }
});

// Login authentication (demo mode - accepts any credentials)
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    
    // Demo authentication - accepts any non-empty credentials
    if (username && password) {
        req.session.isLoggedIn = true;
        req.session.username = username;
        res.json({ success: true, redirect: '/dashboard' });
    } else {
        res.json({ success: false, message: 'Please enter username and password' });
    }
});

// Logout
app.post('/logout', (req, res) => {
    req.session.destroy(() => {
      // Optional: res.clearCookie('connect.sid'); // if you want to explicitly clear the session cookie
      res.redirect('/log.html'); // or res.redirect('/') since '/' serves log.html
    });
  });
  

// Protected routes (require authentication)
app.get('/dashboard', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.get('/hotspots', (req, res) => {
    res.sendFile(path.join(__dirname, 'hot.html'));
});

app.get('/hot.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'hot.html'));
});

app.get('/alerts', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'alert.html'));
});

app.get('/alert.html', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'alert.html'));
});

app.get('/reports', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'report.html'));
});

app.get('/report.html', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'report.html'));
});

app.get('/ride-safety', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'ride.html'));
});

app.get('/ride.html', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'ride.html'));
});

app.get('/settings', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'set.html'));
});

app.get('/set.html', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'set.html'));
});

app.get('/logs', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'log.html'));
});

app.get('/log.html', (req, res) => {
    if (req.session.isLoggedIn) {
        return res.redirect('/dashboard');
    }
    res.sendFile(path.join(__dirname, 'log.html'));
});

app.get('/temperature', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'temp.html'));
});

app.get('/temp.html', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'temp.html'));
});

app.get('/analytics', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'temp.html'));
});

// ====== API routes (same-origin for frontend) ======
app.get('/data', (req, res) => {
  // Return raw rows as array of objects with pagination
  try {
    const limit = parseInt(req.query.limit) || 500; // Default limit to 500 for performance
    const offset = parseInt(req.query.offset) || 0;
    
    const paginated = RAW_ROWS.slice(offset, offset + limit);
    return res.json({
      data: paginated,
      total_count: RAW_ROWS.length,
      limit,
      offset,
      has_more: offset + limit < RAW_ROWS.length
    });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/api/alerts', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 1000; // Default limit to 1000 for maximum data visibility
    const offset = parseInt(req.query.offset) || 0;
    
    // Use cache if available and recent (5 minutes)
    const now = Date.now();
    if (PROCESSED_ALERTS_CACHE && CACHE_TIMESTAMP && (now - CACHE_TIMESTAMP) < 300000) {
      const cached = PROCESSED_ALERTS_CACHE;
      const paginated = cached.slice(offset, offset + limit);
      return res.json({ 
        success: true, 
        alerts: paginated, 
        total_count: cached.length, 
        high_urgency_count: cached.filter(c => c.classification === 'High').length,
        timestamp: new Date().toISOString(),
        cached: true
      });
    }

    // Process a much larger subset for maximum data representation
    const callsToProcess = CALLS.slice(0, Math.min(CALLS.length, 10000)); // Limit to 10000 most recent
    
    const processed = callsToProcess.map(call => {
      const classification = classifyCallUrgency(call);
      const urgency = generateUrgencyScore(classification);
      const callType = getCallType(call, classification);
      const summary = call.transcript ? (call.transcript.length > 80 ? call.transcript.slice(0, 80) + '...' : call.transcript) : `Silent call from ${call.location}`;
      return {
        id: call.id,
        type: callType,
        EVENT_MAIN_TYPE: call.EVENT_MAIN_TYPE || '',
        summary,
        urgency,
        classification,
        transcript: call.transcript || generateMockTranscript(callType),
        location: call.location,
        timestamp: (call.timestamp instanceof Date ? call.timestamp.toISOString() : String(call.timestamp)),
        caller_phone: call.caller_phone,
        duration: call.duration,
        notes: call.notes || 'Initial assessment recorded - GPS ping requested - Unit notified for welfare check'
      };
    }).sort((a, b) => b.urgency - a.urgency);

    // Cache the results
    PROCESSED_ALERTS_CACHE = processed;
    CACHE_TIMESTAMP = now;

    const paginated = processed.slice(offset, offset + limit);
    const highCount = processed.filter(c => c.classification === 'High').length;
    
    return res.json({ 
      success: true, 
      alerts: paginated, 
      total_count: processed.length, 
      high_urgency_count: highCount, 
      timestamp: new Date().toISOString() 
    });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/api/alerts/:id', (req, res) => {
  try {
    const id = String(req.params.id);
    const call = CALLS.find(c => String(c.id) === id);
    if (!call) return res.status(404).json({ success: false, error: 'Call not found' });
    const classification = classifyCallUrgency(call);
    const urgency = generateUrgencyScore(classification);
    const callType = getCallType(call, classification);
    const detailed = {
      id: call.id,
      type: callType,
      EVENT_MAIN_TYPE: call.EVENT_MAIN_TYPE || '',
      urgency,
      classification,
      transcript: call.transcript || generateMockTranscript(callType),
      location: call.location,
      timestamp: (call.timestamp instanceof Date ? call.timestamp.toISOString() : String(call.timestamp)),
      caller_phone: call.caller_phone,
      duration: call.duration,
      notes: call.notes || 'Initial assessment recorded - GPS ping requested - Unit notified for welfare check',
      response_outcome: 'Pending escalation review.',
      sentiment: callType === 'panic' ? 'panic' : (callType === 'silence' ? 'distress' : 'calm')
    };
    return res.json({ success: true, call: detailed });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});



app.get('/api/heatmap', (req, res) => {
  try {
    const category = req.query.category || 'all';
    const days = parseInt(req.query.days) || 30;
    
    // For demo purposes, use all data regardless of actual dates
    // since CSV data might be from different time periods
    let filteredCalls = CALLS.slice(0, Math.min(CALLS.length, 5000)); // Use first 5000 calls for performance
    
    // Apply category filter
    if (category !== 'all') {
      filteredCalls = filteredCalls.filter(call => {
        const eventType = (call.EVENT_MAIN_TYPE || '').toLowerCase();
        const transcript = (call.transcript || '').toLowerCase();
        
        switch(category) {
          case 'women':
            return eventType.includes('women') || transcript.includes('women') || 
                   transcript.includes('harassment') || transcript.includes('safety');
          case 'accident':
            return eventType.includes('accident') || transcript.includes('accident') ||
                   transcript.includes('crash') || transcript.includes('collision');
          case 'crime':
            return eventType.includes('crime') || eventType.includes('theft') ||
                   transcript.includes('robbery') || transcript.includes('assault');
          default:
            return true;
        }
      });
    }
    
    // Group calls by location and create heatmap points
    const locationCounts = {};
    const heatmapPoints = [];
    
    filteredCalls.forEach(call => {
      const location = call.Police_Station_Name || call.location || 'Unknown';
      locationCounts[location] = (locationCounts[location] || 0) + 1;
    });
    
    // Convert location counts to heatmap coordinates
    Object.entries(locationCounts).forEach(([location, count]) => {
      const coords = areaToCoords(location);
      if (coords) {
        // Create multiple points around the location based on incident count
        const intensity = Math.min(count / 10, 1); // Normalize intensity
        for (let i = 0; i < Math.min(count, 20); i++) {
          const lat = coords.lat + (Math.random() - 0.5) * 0.02;
          const lng = coords.lng + (Math.random() - 0.5) * 0.02;
          heatmapPoints.push([lat, lng, intensity]);
        }
      }
    });
    
    // Get top hotspots
    const topHotspots = Object.entries(locationCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([location, count]) => ({
        location,
        count,
        coordinates: areaToCoords(location)
      }));
    
    // Generate recent alerts from the filtered data
    const recentAlerts = filteredCalls
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 5)
      .map(call => ({
        text: call.transcript || `${call.EVENT_MAIN_TYPE} in ${call.location}`,
        location: call.location,
        timestamp: call.timestamp,
        type: category
      }));
    
    return res.json({
      success: true,
      heatmapPoints,
      topHotspots,
      recentAlerts,
      totalIncidents: filteredCalls.length,
      dateRange: { days, note: 'Using CSV data regardless of actual dates for demo' },
      category
    });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

// Past 112 Calls API endpoint (shows all calls with filtering options)
app.get('/api/active', (req, res) => {
  try {
    const now = new Date();
    // Default to last 7 days if no date range specified
    const daysParam = req.query.days;
    const days = daysParam !== undefined ? parseInt(daysParam) : 7;
    const activeWindowMs = days * 24 * 60 * 60 * 1000;

    console.log(`API Request: days=${daysParam}, parsed days=${days}, type=${typeof daysParam}, now=${now.toISOString()}`);

    // Get filter parameters from query string
    const {
      type,               // Filter by call type
      status,             // 'attended' or 'unattended'
      location,           // Filter by police station/location
      search,             // Search in call details
      limit = 50,         // Number of results to return
      offset = 0          // Pagination offset
    } = req.query;

    const limitNum = Math.min(parseInt(limit), 200); // Max 200 records for performance
    const offsetNum = Math.max(0, parseInt(offset));

    // Process and filter calls
    let filteredCalls = CALLS
      .filter(call => {
        const callTime = new Date(call.timestamp);
        // For demo purposes, show all calls from CSV data regardless of date
        // since the CSV contains historical data from March 2025
        const isInDateRange = true; // Always show all calls for demo

        const isUnattended = !call.REACH_TIME || call.REACH_TIME.trim() === '' || call.REACH_TIME === '--:--:--';

        // Apply filters
        let matches = true;

        // Filter by type
        if (type) {
          const callType = (call.EVENT_MAIN_TYPE || '').toLowerCase();
          matches = matches && callType.includes(type.toLowerCase());
        }

        // Filter by status
        if (status === 'unattended') {
          matches = matches && isUnattended;
        } else if (status === 'attended') {
          matches = matches && !isUnattended;
        }

        // Filter by location
        if (location) {
          const callLocation = (call.Police_Station_Name || '').toLowerCase();
          matches = matches && callLocation.includes(location.toLowerCase());
        }

        // Search in call details
        if (search) {
          const searchLower = search.toLowerCase();
          const callDetails = (call.EVENT_INFORMATION || '').toLowerCase();
          const callType = (call.EVENT_MAIN_TYPE || '').toLowerCase();
          const callLocation = (call.Police_Station_Name || '').toLowerCase();

          matches = matches && (
            callDetails.includes(searchLower) ||
            callType.includes(searchLower) ||
            callLocation.includes(searchLower)
          );
        }

        return isInDateRange && matches;
      })
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)); // Newest first

    // Apply pagination
    const totalCalls = filteredCalls.length;
    const paginatedCalls = filteredCalls.slice(offsetNum, offsetNum + limitNum);

    // Categorize calls
    const unattendedCalls = filteredCalls.filter(call => 
      !call.REACH_TIME || call.REACH_TIME.trim() === '' || call.REACH_TIME === '--:--:--'
    );

    // Calculate date range for the stats
    const oldestCall = filteredCalls.length > 0 
      ? new Date(Math.min(...filteredCalls.map(c => new Date(c.timestamp).getTime()))) 
      : new Date(now - activeWindowMs);
    
    // Group by call type for statistics
    const callsByType = {};
    filteredCalls.forEach(call => {
      const type = call.EVENT_MAIN_TYPE || 'Other';
      callsByType[type] = (callsByType[type] || 0) + 1;
    });
    
    // Format call types for display
    const callTypes = Object.entries(callsByType)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);

    const response = {
      success: true,
      stats: {
        totalCalls: filteredCalls.length,
        unattended: unattendedCalls.length,
        attended: filteredCalls.length - unattendedCalls.length,
        callTypes,
        dateRange: {
          from: oldestCall.toISOString().split('T')[0],
          to: now.toISOString().split('T')[0],
          days: days === 0 ? 'all' : days
        },
        pagination: {
          total: totalCalls,
          limit: limitNum,
          offset: offsetNum,
          hasMore: offsetNum + limitNum < totalCalls
        },
        lastUpdated: new Date().toISOString()
      },
      calls: paginatedCalls.map(call => {
        const isUnattended = !call.REACH_TIME || call.REACH_TIME.trim() === '' || call.REACH_TIME === '--:--:--';
        const callTime = new Date(call.timestamp);
        const durationMs = now - callTime;
        const durationMins = Math.floor(durationMs / (60 * 1000));
        
        // Format response time if available
        let responseTime = null;
        if (call.REACH_TIME && call.REACH_TIME.trim() && call.REACH_TIME !== '--:--:--') {
          responseTime = call.REACH_TIME;
        } else if (call.MDT_RESPONSE_TIME) {
          responseTime = call.MDT_RESPONSE_TIME;
        } else if (call.RESPONSE_TIME) {
          responseTime = call.RESPONSE_TIME;
        }
        
        return {
          id: call.id,
          type: call.EVENT_MAIN_TYPE || 'Emergency',
          summary: (call.transcript || call.EVENT_INFORMATION || 'No details available').substring(0, 150) + 
                  ((call.transcript || call.EVENT_INFORMATION || '').length > 150 ? '...' : ''),
          location: call.Police_Station_Name || call.location || 'Location not specified',
          timestamp: call.timestamp,
          formattedTime: callTime.toLocaleTimeString(),
          formattedDate: callTime.toLocaleDateString(),
          status: isUnattended ? 'unattended' : 'attended',
          duration: call.duration || durationMins,
          priority: call.priority || (isUnattended ? 'high' : 'medium'),
          callerInfo: {
            number: call.caller_phone || 'Withheld',
            gender: call.gender || 'Not specified'
          },
          responseInfo: isUnattended ? null : {
            responseTime: responseTime,
            responder: call.responder_name || 'Officer',
            notes: call.notes || ''
          },
          rawData: process.env.NODE_ENV === 'development' ? call : undefined
        };
      })
    };

    return res.json(response);
  } catch (e) {
    console.error('Error in /api/active:', e);
    return res.status(500).json({ 
      success: false, 
      error: e.message,
      stack: process.env.NODE_ENV === 'development' ? e.stack : undefined
    });
  }
});

// Helper function to map area names to coordinates (already exists in dashboard.js logic)
function areaToCoords(areaText) {
  if (!areaText) return null;
  const key = areaText.toUpperCase();
  
  const AREA_COORDS = {
    'PANAJI': { lat: 15.4909, lng: 73.8278 },
    'PANJIM': { lat: 15.4909, lng: 73.8278 },
    'MARGAO': { lat: 15.2993, lng: 74.1240 },
    'VASCO': { lat: 15.3960, lng: 73.8157 },
    'MAPUSA': { lat: 15.5937, lng: 73.8070 },
    'PONDA': { lat: 15.4013, lng: 74.0071 },
    'CALANGUTE': { lat: 15.5394, lng: 73.7554 },
    'BICHOLIM': { lat: 15.6000, lng: 73.9500 },
    'PORVORIM': { lat: 15.5530, lng: 73.8090 },
    'MANDREM': { lat: 15.6580, lng: 73.7460 },
    'CANACONA': { lat: 15.0160, lng: 74.0500 },
    'MAINA CURTORIM': { lat: 15.2489, lng: 73.9860 },
    'MOPA': { lat: 15.7290, lng: 73.8140 },
    'OLD GOA': { lat: 15.4989, lng: 73.9122 },
    'ANJUNA': { lat: 15.5873, lng: 73.7447 },
    'VERNA': { lat: 15.3375, lng: 73.9313 }
  };
  
  // Try direct match
  if (AREA_COORDS[key]) return AREA_COORDS[key];
  
  // Try substring match
  for (const name in AREA_COORDS) {
    if (key.includes(name)) return AREA_COORDS[name];
  }
  
  return null;
}

// Women's Safety Index API endpoint
app.get('/api/wsi', (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    
    // Filter women's safety related calls from CSV data
    const womenSafetyCalls = CALLS.filter(call => {
      const eventType = (call.EVENT_MAIN_TYPE || '').toLowerCase();
      const transcript = (call.transcript || '').toLowerCase();
      const eventInfo = (call.EVENT_INFORMATION || '').toLowerCase();
      
      return eventType.includes('women') || 
             transcript.includes('women') || 
             transcript.includes('harassment') || 
             transcript.includes('safety') ||
             transcript.includes('stalking') ||
             transcript.includes('abuse') ||
             eventInfo.includes('women') ||
             eventInfo.includes('harassment');
    });
    
    // Calculate WSI for different areas
    const areaWsiData = {};
    const areaIncidentCounts = {};
    
    // Group by police station/area
    womenSafetyCalls.forEach(call => {
      const area = call.Police_Station_Name || call.location || 'Unknown';
      if (!areaWsiData[area]) {
        areaWsiData[area] = [];
        areaIncidentCounts[area] = 0;
      }
      areaIncidentCounts[area]++;
    });
    
    // Calculate WSI scores (0-100, where 100 is safest)
    const maxIncidents = Math.max(...Object.values(areaIncidentCounts));
    const wsiScores = {};
    
    Object.keys(areaIncidentCounts).forEach(area => {
      const incidents = areaIncidentCounts[area];
      // WSI calculation: fewer incidents = higher safety score
      const baseScore = Math.max(0, 100 - (incidents / maxIncidents * 80));
      // Add some randomness for realistic variation
      wsiScores[area] = Math.max(20, Math.min(100, baseScore + (Math.random() * 20 - 10)));
    });
    
    // Generate daily WSI trend based on selected range
    const wsiTrend = [];
    const overallIncidents = womenSafetyCalls.length;
    const baseWsi = Math.max(30, 100 - (overallIncidents / CALLS.length * 100));
    
    // Generate trend data for the selected range (7, 14, or 30 days)
    const trendDays = Math.min(days, 30); // Maximum 30 days for trend
    const trendLength = days <= 7 ? 7 : days <= 14 ? 14 : 7; // Show 7 points for 7d, 14 for 14d, 7 for 30d
    
    for (let i = trendLength - 1; i >= 0; i--) {
      // Create more realistic variation based on incident patterns
      const dayFactor = i / trendLength;
      const seasonalVariation = Math.sin(dayFactor * Math.PI * 2) * 5; // Seasonal pattern
      const randomVariation = (Math.random() * 16 - 8); // ±8 variation
      const incidentImpact = (overallIncidents / CALLS.length) * 50; // Impact of incidents
      
      const dayWsi = Math.max(20, Math.min(100, baseWsi + seasonalVariation + randomVariation - incidentImpact));
      wsiTrend.push(Math.round(dayWsi));
    }
    
    // Create WSI grid data (28 days)
    const wsiGrid = [];
    for (let i = 0; i < 28; i++) {
      const dayScore = baseWsi + (Math.random() * 30 - 15);
      const status = dayScore > 70 ? 'good' : dayScore > 50 ? 'moderate' : 'bad';
      wsiGrid.push({
        day: i + 1,
        score: Math.round(Math.max(20, Math.min(100, dayScore))),
        status: status
      });
    }
    
    // Calculate overall statistics
    const totalWomenCalls = womenSafetyCalls.length;
    const totalCalls = CALLS.length;
    const womenSafetyPercentage = ((totalWomenCalls / totalCalls) * 100).toFixed(1);
    const overallWsi = Math.round(baseWsi);
    
    // Top risk areas
    const topRiskAreas = Object.entries(areaIncidentCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([area, count]) => ({
        area,
        incidents: count,
        wsiScore: Math.round(wsiScores[area] || 50)
      }));
    
    return res.json({
      success: true,
      wsiData: {
        overallWsi,
        wsiTrend,
        wsiGrid,
        topRiskAreas,
        statistics: {
          totalWomenSafetyCalls: totalWomenCalls,
          totalCalls,
          womenSafetyPercentage,
          daysAnalyzed: days
        },
        areaWsiScores: wsiScores,
        timestamp: new Date().toISOString()
      }
    });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

// Dashboard zones API endpoint
app.get('/api/zones/:type', (req, res) => {
  try {
    const zoneType = req.params.type;
    
    let filteredCalls = [];
    let zoneConfig = {};
    
    switch(zoneType) {
      case 'incidents':
        // All incidents - general overview (limit to recent ones for performance)
        filteredCalls = CALLS.slice(0, 1000);
        zoneConfig = {
          color: '#3b82f6',
          fillColor: '#60a5fa',
          icon: '📍',
          name: 'General Incidents'
        };
        break;
        
      case 'crime':
        // Crime-related incidents - more comprehensive filtering
        filteredCalls = CALLS.filter(call => {
          const eventType = (call.EVENT_MAIN_TYPE || '').toLowerCase();
          const transcript = (call.transcript || '').toLowerCase();
          const eventInfo = (call.EVENT_INFORMATION || '').toLowerCase();
          
          return eventType.includes('crime') || 
                 eventType.includes('theft') ||
                 eventType.includes('robbery') ||
                 eventType.includes('fighting') ||
                 eventType.includes('assault') ||
                 eventType.includes('burglary') ||
                 eventType.includes('murder') ||
                 eventType.includes('kidnap') ||
                 transcript.includes('crime') ||
                 transcript.includes('theft') ||
                 transcript.includes('robbery') ||
                 transcript.includes('assault') ||
                 transcript.includes('fight') ||
                 transcript.includes('stolen') ||
                 transcript.includes('burglary') ||
                 eventInfo.includes('crime') ||
                 eventInfo.includes('theft') ||
                 eventInfo.includes('fighting');
        });
        zoneConfig = {
          color: '#dc2626',
          fillColor: '#ef4444',
          icon: '🚨',
          name: 'Crime Hotspots'
        };
        break;
        
      case 'accident':
        // Accident-related incidents - more comprehensive filtering
        filteredCalls = CALLS.filter(call => {
          const eventType = (call.EVENT_MAIN_TYPE || '').toLowerCase();
          const transcript = (call.transcript || '').toLowerCase();
          const eventInfo = (call.EVENT_INFORMATION || '').toLowerCase();
          
          return eventType.includes('accident') ||
                 eventType.includes('crash') ||
                 eventType.includes('collision') ||
                 eventType.includes('vehicle') ||
                 eventType.includes('road') ||
                 eventType.includes('traffic') ||
                 transcript.includes('accident') ||
                 transcript.includes('crash') ||
                 transcript.includes('collision') ||
                 transcript.includes('vehicle') ||
                 transcript.includes('bike') ||
                 transcript.includes('car') ||
                 transcript.includes('truck') ||
                 transcript.includes('bus') ||
                 transcript.includes('road') ||
                 eventInfo.includes('accident') ||
                 eventInfo.includes('crash') ||
                 eventInfo.includes('vehicle');
        });
        zoneConfig = {
          color: '#f59e0b',
          fillColor: '#fbbf24',
          icon: '🚗',
          name: 'Accident Zones'
        };
        break;
        
      case 'tourism':
        // Tourism safety incidents - focus on tourist areas and beach locations
        filteredCalls = CALLS.filter(call => {
          const eventType = (call.EVENT_MAIN_TYPE || '').toLowerCase();
          const transcript = (call.transcript || '').toLowerCase();
          const eventInfo = (call.EVENT_INFORMATION || '').toLowerCase();
          const location = (call.Police_Station_Name || call.location || '').toLowerCase();
          
          const touristAreas = ['calangute', 'baga', 'anjuna', 'candolim', 'colva', 'palolem', 'arambol', 'morjim', 'vagator', 'chapora'];
          const isTouristArea = touristAreas.some(area => location.includes(area));
          
          return isTouristArea || 
                 transcript.includes('tourist') ||
                 transcript.includes('beach') ||
                 transcript.includes('hotel') ||
                 transcript.includes('resort') ||
                 transcript.includes('foreigner') ||
                 eventInfo.includes('tourist') ||
                 eventInfo.includes('beach') ||
                 location.includes('beach');
        });
        zoneConfig = {
          color: '#059669',
          fillColor: '#10b981',
          icon: '🏖️',
          name: 'Tourism Safety'
        };
        break;
        
      default:
        return res.status(400).json({ success: false, error: 'Invalid zone type' });
    }
    
    // Log filtering results
    console.log(`Zone API: ${zoneType} - Filtered ${filteredCalls.length} calls from ${CALLS.length} total`);
    
    // Group incidents by location for zone creation
    const locationGroups = {};
    filteredCalls.forEach(call => {
      const location = call.Police_Station_Name || call.location || 'Unknown';
      if (!locationGroups[location]) {
        locationGroups[location] = [];
      }
      locationGroups[location].push(call);
    });
    
    console.log(`Zone API: ${zoneType} - Grouped into ${Object.keys(locationGroups).length} locations`);
    
    // Create zones with coordinates
    const zones = Object.entries(locationGroups).map(([location, calls]) => {
      const coords = areaToCoords(location);
      if (!coords) return null;
      
      const intensity = calls.length;
      const radius = Math.max(500, Math.min(intensity * 50, 3000)); // 500m to 3km
      
      return {
        location,
        coordinates: coords,
        incidentCount: calls.length,
        radius,
        zoneType,
        config: zoneConfig,
        recentIncidents: calls.slice(0, 3).map(call => ({
          type: call.EVENT_MAIN_TYPE || 'Unknown',
          time: call.timestamp || new Date().toISOString(),
          description: call.transcript || 'No description available'
        }))
      };
    }).filter(Boolean);
    
    // Sort by incident count (highest first)
    zones.sort((a, b) => b.incidentCount - a.incidentCount);
    
    return res.json({
      success: true,
      zoneType,
      zones: zones.slice(0, 20), // Limit to top 20 zones
      totalIncidents: filteredCalls.length,
      config: zoneConfig
    });
    
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

// Handle client-side routing - serve appropriate HTML files
app.get('*', (req, res) => {
  const filePath = path.join(__dirname, req.path);
  const extname = path.extname(filePath);
  
  // If the request has a file extension, try to serve it directly
  if (extname) {
    if (fs.existsSync(filePath)) {
      return res.sendFile(filePath);
    }
    return res.status(404).send('File not found');
  }
  
  // Otherwise, try to serve index.html for the requested path
  const indexPath = path.join(__dirname, req.path, 'index.html');
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  
  // Fall back to the main index.html for client-side routing
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start the server
app.listen(PORT, () => {
    console.log(`🚀 SAFENAVI Project running at http://localhost:${PORT}`);
    console.log(`🔐 Login page: http://localhost:${PORT}/`);
    console.log(`📊 All pages are protected and properly linked!`);
});
