const express = require('express');
const path = require('path');
const app = express();
const PORT = 3000;

// Serve static files (CSS, JS, images)
app.use(express.static(__dirname));
app.use('/static', express.static(path.join(__dirname, 'static')));

// Routes for all pages
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.get('/dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.get('/hotspots', (req, res) => {
    res.sendFile(path.join(__dirname, 'hot.html'));
});

app.get('/hot.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'hot.html'));
});

app.get('/alerts', (req, res) => {
    res.sendFile(path.join(__dirname, 'alert.html'));
});

app.get('/alert.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'alert.html'));
});

app.get('/reports', (req, res) => {
    res.sendFile(path.join(__dirname, 'report.html'));
});

app.get('/report.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'report.html'));
});

app.get('/ride-safety', (req, res) => {
    res.sendFile(path.join(__dirname, 'ride.html'));
});

app.get('/ride.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'ride.html'));
});

app.get('/settings', (req, res) => {
    res.sendFile(path.join(__dirname, 'set.html'));
});

app.get('/set.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'set.html'));
});

app.get('/logs', (req, res) => {
    res.sendFile(path.join(__dirname, 'log.html'));
});

app.get('/log.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'log.html'));
});

app.get('/temperature', (req, res) => {
    res.sendFile(path.join(__dirname, 'temp.html'));
});

app.get('/temp.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'temp.html'));
});

app.get('/analytics', (req, res) => {
    res.sendFile(path.join(__dirname, 'temp.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 SAFENAVI Project running at http://localhost:${PORT}`);
    console.log(`📊 All pages are now properly linked and accessible!`);
});

module.exports = app;
