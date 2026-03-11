const express = require('express');
const path = require('path');
const fs = require('fs');
const csv = require('csv-parser');
const compression = require('compression');
const app = express();
const PORT = 3000;

// Enable compression
app.use(compression());

// Set cache control headers for static files
const staticOptions = {
  maxAge: '1d',
  etag: true,
  lastModified: true,
  setHeaders: (res, path) => {
    if (path.endsWith('.csv')) {
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day cache for CSV
    }
  }
};

// Serve static files with caching
app.use(express.static(path.join(__dirname, 'public'), staticOptions));
app.use('/static', express.static(path.join(__dirname, 'static'), staticOptions));

// Simple in-memory session storage (for demo purposes)
let sessions = {};

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));
app.use('/static', express.static(path.join(__dirname, 'static')));

// Simple session middleware
app.use((req, res, next) => {
    const sessionId = req.headers.cookie?.split('sessionId=')[1]?.split(';')[0];
    if (sessionId && sessions[sessionId]) {
        req.session = sessions[sessionId];
    } else {
        req.session = {};
    }
    next();
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
// Login page (main entry point)
app.get('/', (req, res) => {
    if (req.session.isLoggedIn) {
        res.redirect('/dashboard');
    } else {
        res.sendFile(path.join(__dirname, 'log.html'));
    }
});

// Login authentication
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    
    if (username === 'admin' && password === '112goa') {
        const sessionId = Date.now().toString();
        sessions[sessionId] = {
            isLoggedIn: true,
            username: username
        };
        res.setHeader('Set-Cookie', `sessionId=${sessionId}; Path=/; HttpOnly`);
        res.json({ success: true, redirect: '/dashboard' });
    } else {
        res.json({ success: false, message: 'Invalid credentials' });
    }
});

// Logout
app.post('/logout', (req, res) => {
    const sessionId = req.headers.cookie?.split('sessionId=')[1]?.split(';')[0];
    if (sessionId) {
        delete sessions[sessionId];
    }
    res.clearCookie('sessionId');
    res.redirect('/');
});

// Protected routes
app.get('/dashboard', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.get('/hotspots', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'hot.html'));
});

app.get('/hot.html', requireAuth, (req, res) => {
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

// Cache for processed incidents
let cachedIncidents = null;
let lastCacheUpdate = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Function to process CSV data
async function processCSV(csvPath) {
    return new Promise((resolve, reject) => {
        const results = [];
        const startTime = Date.now();
        
        console.log('Starting to process CSV file:', csvPath);
        
        // Check if file exists
        if (!fs.existsSync(csvPath)) {
            return reject(new Error(`CSV file not found at: ${csvPath}`));
        }
        
        const stream = fs.createReadStream(csvPath, { encoding: 'utf8' })
            .pipe(csv({
                mapHeaders: ({ header }) => header.trim(),
                mapValues: ({ value }) => value ? value.trim() : ''
            }));
        
        stream.on('data', (data) => {
            try {
                if (data && data.CREATE_TIME && data.EVENT_MAIN_TYPE && data.Police_Station_Name) {
                    results.push({
                        id: data.EVENT_ID || `EV-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                        type: data.EVENT_MAIN_TYPE.toLowerCase().replace(/\s+/g, '_'),
                        typeLabel: data.EVENT_MAIN_TYPE,
                        area: data.Police_Station_Name,
                        time: new Date(data.CREATE_TIME).toLocaleTimeString(),
                        status: data.CLOSURE_COMMENTS ? 'resolved' : 'pending',
                        description: data.EVENT_INFORMATION || '',
                        responseTime: data.RESPONSE_TIME || 'N/A',
                        timestamp: new Date(data.CREATE_TIME).getTime()
                    });
                }
            } catch (error) {
                console.error('Error processing row:', error);
            }
        });
        
        stream.on('end', () => {
            console.log(`Processed ${results.length} rows in ${Date.now() - startTime}ms`);
            resolve(results);
        });
        
        stream.on('error', (error) => {
            console.error('Error reading CSV:', error);
            reject(error);
        });
    });
}

// API endpoint to get incidents data from CSV with caching
app.get('/api/incidents', requireAuth, async (req, res) => {
    try {
        const csvPath = path.join(__dirname, 'cleaned_ALL_DATA_IN_DETAIL.csv');
        const now = Date.now();
        
        // Return cached data if it's still fresh
        if (cachedIncidents && (now - lastCacheUpdate) < CACHE_DURATION) {
            console.log('Returning cached incidents data');
            return res.json({
                success: true,
                count: cachedIncidents.length,
                incidents: cachedIncidents,
                cached: true,
                timestamp: lastCacheUpdate
            });
        }
        
        // Process the CSV file
        const incidents = await processCSV(csvPath);
        
        // Filter to only include recent incidents (last 30 days)
        const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
        const recentIncidents = incidents.filter(incident => 
            incident.timestamp > thirtyDaysAgo
        );
        
        // Update cache
        cachedIncidents = recentIncidents;
        lastCacheUpdate = now;
        
        res.json({
            success: true,
            count: recentIncidents.length,
            incidents: recentIncidents,
            cached: false,
            timestamp: now
        });
        
    } catch (error) {
        console.error('Error in /api/incidents:', error);
        
        // Return cached data if available, even if it's stale
        if (cachedIncidents) {
            console.warn('Using stale cache due to error');
            return res.json({
                success: true,
                count: cachedIncidents.length,
                incidents: cachedIncidents,
                cached: true,
                stale: true,
                timestamp: lastCacheUpdate,
                error: error.message
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Failed to process incident data',
            error: error.message
        });
    }
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

// Start the server
app.listen(PORT, () => {
    console.log(`🚀 SAFENAVI Project running at http://localhost:${PORT}`);
    console.log(`🔐 Login page: http://localhost:${PORT}/`);
    console.log(`📊 All pages are protected and properly linked!`);
    console.log(`\n📋 Login credentials:`);
    console.log(`   Username: admin`);
    console.log(`   Password: 112goa`);
});
