// AI Prediction Module
class AIPrediction {
    constructor() {
        // Use environment variable or default to localhost
        this.apiUrl = (window.API_BASE_URL || 'http://localhost:5000').replace(/\/+$/, '') + '/api';
        this.cache = {
            lastPrediction: null,
            lastUpdated: null,
            cacheDuration: 5 * 60 * 1000 // 5 minutes in milliseconds
        };
        
        console.log('API Base URL:', this.apiUrl);
        
        // DOM Elements
        this.elements = {
            confidence: document.getElementById('aiConfidence'),
            rise: document.getElementById('aiRise'),
            trend: document.querySelector('.trend i'),
            trendText: document.querySelector('.trend span'),
            riskLevel: document.getElementById('aiRiskLevel'),
            location: document.getElementById('aiLocation'),
            season: document.getElementById('aiSeason'),
            recommendations: document.getElementById('aiRecommendations')
        };
        
        // Initialize
        this.init();
    }
    
    async init() {
        try {
            // First check if the API is reachable
            const healthCheck = await this.checkApiHealth();
            console.log('API Health Check:', healthCheck);
            
            if (healthCheck.status === 'healthy') {
                // Load initial prediction
                await this.updatePrediction();
                
                // Update prediction every 5 minutes
                setInterval(() => this.updatePrediction(), 5 * 60 * 1000);
            } else {
                this.showErrorState('AI service is not available. Please try again later.');
            }
        } catch (error) {
            console.error('Failed to initialize AI predictions:', error);
            this.showErrorState('Failed to connect to AI service. Please check your connection.');
        }
    }
    
    async checkApiHealth() {
        try {
            const response = await fetch(`${this.apiUrl}/health`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Health check failed:', error);
            return { status: 'error', error: error.message };
        }
    }
    
    async updatePrediction(location = 'Downtown') {
        try {
            console.log('Starting prediction update...');
            // Show loading state
            this.setLoadingState(true);
            
            // Check if we have a recent cached prediction
            const now = new Date();
            if (this.cache.lastPrediction && 
                this.cache.lastUpdated && 
                (now - this.cache.lastUpdated) < this.cache.cacheDuration) {
                console.log('Using cached prediction');
                this.updateUI(this.cache.lastPrediction);
                return;
            }
            
            console.log('Fetching new prediction from:', `${this.apiUrl}/predict?location=${encodeURIComponent(location)}`);
            
            // Add a timeout to the fetch request
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
            
            try {
                const response = await fetch(`${this.apiUrl}/predict?location=${encodeURIComponent(location)}`, {
                    signal: controller.signal
                });
                clearTimeout(timeoutId);
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const data = await response.json();
                console.log('Received prediction data:', data);
                
                if (data && data.success) {
                    // Cache the prediction
                    this.cache.lastPrediction = data.prediction;
                    this.cache.lastUpdated = now;
                    
                    // Update the UI
                    this.updateUI(data.prediction);
                } else {
                    throw new Error(data?.error || 'Failed to get prediction');
                }
            } catch (fetchError) {
                clearTimeout(timeoutId);
                console.error('Fetch error:', fetchError);
                throw fetchError;
            }
        } catch (error) {
            console.error('Error updating prediction:', error);
            this.showErrorState();
        } finally {
            this.setLoadingState(false);
        }
    }
    
    updateUI(prediction) {
        // Update confidence
        this.elements.confidence.textContent = `${prediction.confidence}%`;
        this.elements.confidence.className = 'confidence-indicator ' + this.getConfidenceClass(prediction.confidence);
        
        // Update rise/fall
        const isRising = prediction.rise >= 0;
        this.elements.rise.textContent = `${Math.abs(prediction.rise)}%`;
        this.elements.trend.className = `fas fa-arrow-${isRising ? 'up' : 'down'}`;
        this.elements.trendText.textContent = `${isRising ? 'up' : 'down'} from yesterday`;
        this.elements.trend.parentElement.className = `trend ${isRising ? '' : 'down'}`;
        
        // Update risk level
        this.elements.riskLevel.textContent = prediction.risk_level;
        this.elements.riskLevel.className = `risk-${prediction.risk_level.toLowerCase()}`;
        
        // Update location and season
        this.elements.location.textContent = prediction.location;
        this.elements.season.textContent = prediction.season;
        
        // Update recommendations
        this.elements.recommendations.innerHTML = prediction.recommendations
            .map(rec => `<li>${rec}</li>`)
            .join('');
    }
    
    setLoadingState(isLoading) {
        const elements = document.querySelectorAll('.ai *');
        elements.forEach(el => {
            if (isLoading) {
                el.style.opacity = '0.7';
                el.style.transition = 'opacity 0.3s';
            } else {
                el.style.opacity = '1';
            }
        });
        
        const loader = document.getElementById('aiLoader');
        if (!loader && isLoading) {
            const loader = document.createElement('div');
            loader.id = 'aiLoader';
            loader.innerHTML = '<div class="loader"></div>';
            loader.style.cssText = `
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                z-index: 10;
            `;
            document.querySelector('.ai').style.position = 'relative';
            document.querySelector('.ai').appendChild(loader);
        } else if (loader && !isLoading) {
            loader.remove();
        }
    }
    
    showErrorState(message = 'Failed to load prediction. Please try again later.') {
        // Remove any existing error messages
        const existingErrors = document.querySelectorAll('.error-message');
        existingErrors.forEach(el => el.remove());
        
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px;">
                <span>⚠️</span>
                <span>${message}</span>
                <button id="retryButton" style="margin-left: auto; background: none; border: 1px solid currentColor; border-radius: 4px; padding: 2px 8px; cursor: pointer;">
                    Retry
                </button>
            </div>
        `;
        
        // Add retry functionality
        errorDiv.querySelector('#retryButton')?.addEventListener('click', () => {
            errorDiv.remove();
            this.updatePrediction();
        });
        
        errorDiv.style.cssText = `
            color: #ef4444;
            padding: 1rem;
            background: #fee2e2;
            border-radius: 0.5rem;
            margin-top: 1rem;
            text-align: center;
        `;
        
        const aiContainer = document.querySelector('.ai');
        if (aiContainer) {
            aiContainer.appendChild(errorDiv);
        } else {
            console.error('Could not find .ai container to show error message');
        }
    }
    
    getConfidenceClass(confidence) {
        if (confidence >= 75) return 'high';
        if (confidence >= 50) return 'medium';
        return 'low';
    }
}

// Initialize when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Only initialize if we're on a page with AI prediction elements
    if (document.querySelector('.ai')) {
        window.aiPrediction = new AIPrediction();
    }
});
