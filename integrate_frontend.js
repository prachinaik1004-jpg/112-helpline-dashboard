/**
 * 112 Goa Emergency Response System - Frontend Integration
 * This script integrates the frontend with the enhanced backend API
 */

// Configuration
const API_BASE_URL = 'http://localhost:5000';
const POLLING_INTERVAL = 30000; // 30 seconds

class EmergencyResponseAPI {
    constructor(baseUrl = API_BASE_URL) {
        this.baseUrl = baseUrl;
        this.isConnected = false;
    }

    // Health check
    async checkHealth() {
        try {
            const response = await fetch(`${this.baseUrl}/api/health`);
            const data = await response.json();
            this.isConnected = response.ok && data.status === 'healthy';
            return data;
        } catch (error) {
            console.error('Health check failed:', error);
            this.isConnected = false;
            return null;
        }
    }

    // Get emergency alerts
    async getAlerts(options = {}) {
        const params = new URLSearchParams();
        if (options.limit) params.append('limit', options.limit);
        if (options.offset) params.append('offset', options.offset);
        if (options.urgency) params.append('urgency', options.urgency);
        if (options.station) params.append('station', options.station);

        try {
            const response = await fetch(`${this.baseUrl}/api/alerts?${params}`);
            return await response.json();
        } catch (error) {
            console.error('Failed to fetch alerts:', error);
            return { success: false, error: error.message };
        }
    }

    // Get alert details
    async getAlertDetail(alertId) {
        try {
            const response = await fetch(`${this.baseUrl}/api/alerts/${alertId}`);
            return await response.json();
        } catch (error) {
            console.error('Failed to fetch alert details:', error);
            return { success: false, error: error.message };
        }
    }

    // Get statistics
    async getStats() {
        try {
            const response = await fetch(`${this.baseUrl}/api/stats`);
            return await response.json();
        } catch (error) {
            console.error('Failed to fetch stats:', error);
            return { success: false, error: error.message };
        }
    }

    // Get trends
    async getTrends() {
        try {
            const response = await fetch(`${this.baseUrl}/api/analytics/trends`);
            return await response.json();
        } catch (error) {
            console.error('Failed to fetch trends:', error);
            return { success: false, error: error.message };
        }
    }

    // Search calls
    async searchCalls(query, options = {}) {
        const params = new URLSearchParams();
        params.append('q', query);
        if (options.station) params.append('station', options.station);
        if (options.event_type) params.append('event_type', options.event_type);
        if (options.date_from) params.append('date_from', options.date_from);
        if (options.date_to) params.append('date_to', options.date_to);
        if (options.limit) params.append('limit', options.limit);

        try {
            const response = await fetch(`${this.baseUrl}/api/search?${params}`);
            return await response.json();
        } catch (error) {
            console.error('Search failed:', error);
            return { success: false, error: error.message };
        }
    }

    // Get raw data
    async getRawData() {
        try {
            const response = await fetch(`${this.baseUrl}/data`);
            return await response.json();
        } catch (error) {
            console.error('Failed to fetch raw data:', error);
            return { success: false, error: error.message };
        }
    }
}

// Global API instance
const emergencyAPI = new EmergencyResponseAPI();

// Integration functions for existing frontend
window.EmergencyResponseAPI = EmergencyResponseAPI;
window.emergencyAPI = emergencyAPI;

// Auto-connect and start polling
async function initializeAPI() {
    console.log('🚨 Initializing Emergency Response API...');
    
    // Check health
    const health = await emergencyAPI.checkHealth();
    if (health && health.status === 'healthy') {
        console.log('✅ Backend connected successfully');
        console.log(`📊 Total calls in database: ${health.total_calls}`);
        
        // Start polling for updates
        startPolling();
    } else {
        console.error('❌ Backend connection failed');
        console.log('Please ensure the backend is running on http://localhost:5000');
    }
}

// Polling for real-time updates
function startPolling() {
    setInterval(async () => {
        if (emergencyAPI.isConnected) {
            // Update dashboard data
            await updateDashboard();
        }
    }, POLLING_INTERVAL);
}

// Update dashboard with latest data
async function updateDashboard() {
    try {
        // Update alerts
        const alerts = await emergencyAPI.getAlerts({ limit: 20 });
        if (alerts.success) {
            updateAlertsDisplay(alerts.alerts);
        }

        // Update statistics
        const stats = await emergencyAPI.getStats();
        if (stats.success) {
            updateStatsDisplay(stats);
        }
    } catch (error) {
        console.error('Failed to update dashboard:', error);
    }
}

// Update alerts display (customize based on your frontend)
function updateAlertsDisplay(alerts) {
    // This function should be customized based on your frontend structure
    console.log(`📡 Updated ${alerts.length} alerts`);
    
    // Example: Update a table or list
    const alertsContainer = document.getElementById('alerts-container');
    if (alertsContainer) {
        alertsContainer.innerHTML = alerts.map(alert => `
            <div class="alert-item ${alert.classification.toLowerCase()}">
                <h4>${alert.id} - ${alert.EVENT_MAIN_TYPE}</h4>
                <p>${alert.summary}</p>
                <span class="urgency-score">Urgency: ${alert.urgency}</span>
                <span class="location">${alert.location}</span>
            </div>
        `).join('');
    }
}

// Update statistics display (customize based on your frontend)
function updateStatsDisplay(stats) {
    console.log(`📊 Updated statistics: ${stats.total_calls} total calls`);
    
    // Example: Update dashboard widgets
    const totalCallsElement = document.getElementById('total-calls');
    if (totalCallsElement) {
        totalCallsElement.textContent = stats.total_calls;
    }

    const highUrgencyElement = document.getElementById('high-urgency-calls');
    if (highUrgencyElement) {
        highUrgencyElement.textContent = stats.high_urgency_calls;
    }
}

// Utility functions for common operations
window.emergencyUtils = {
    // Format urgency score with color
    formatUrgencyScore: (score) => {
        if (score >= 80) return `<span class="high-urgency">${score}</span>`;
        if (score >= 50) return `<span class="medium-urgency">${score}</span>`;
        return `<span class="low-urgency">${score}</span>`;
    },

    // Format timestamp
    formatTimestamp: (timestamp) => {
        return new Date(timestamp).toLocaleString();
    },

    // Get urgency class
    getUrgencyClass: (score) => {
        if (score >= 80) return 'high-urgency';
        if (score >= 50) return 'medium-urgency';
        return 'low-urgency';
    },

    // Search calls with UI integration
    searchCalls: async (query, options = {}) => {
        const results = await emergencyAPI.searchCalls(query, options);
        if (results.success) {
            console.log(`Found ${results.total_found} results for "${query}"`);
            return results.results;
        } else {
            console.error('Search failed:', results.error);
            return [];
        }
    }
};

// Initialize when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeAPI);
} else {
    initializeAPI();
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { EmergencyResponseAPI, emergencyAPI };
}
