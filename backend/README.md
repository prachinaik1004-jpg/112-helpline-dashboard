# AI-Powered Risk Prediction Backend

This is the backend service for the AI-Powered Risk Prediction system. It provides a REST API for predicting risk levels based on various factors like time, location, and weather conditions.

## Features

- Machine learning model for risk prediction
- RESTful API endpoints
- Caching for better performance
- Error handling and logging
- Sample data generation for demonstration

## Prerequisites

- Python 3.8 or higher
- pip (Python package manager)

## Setup Instructions

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd <repository-name>/backend
   ```

2. **Create and activate a virtual environment**
   ```bash
   # On macOS/Linux
   python -m venv venv
   source venv/bin/activate

   # On Windows
   python -m venv venv
   .\venv\Scripts\activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Set up environment variables**
   Copy the example environment file and update it as needed:
   ```bash
   cp .env.example .env
   ```

## Running the Application

1. **Start the Flask development server**
   ```bash
   python app.py
   ```

   The server will start on `http://localhost:5000` by default.

2. **Verify the API is running**
   Open your browser or use a tool like curl to access:
   ```
   http://localhost:5000/api/health
   ```
   You should see a JSON response with the status of the application.

## API Endpoints

### Health Check
- `GET /api/health`
  - Checks if the API is running and if the ML model is loaded

### Predict Risk
- `GET /api/predict`
  - Parameters:
    - `location` (string, optional): Location for prediction (default: 'Downtown')
  - Returns: JSON with prediction details including risk level, confidence, and recommendations

## How It Works

1. The application loads a pre-trained machine learning model on startup.
2. If no model is found, it trains a new one with sample data.
3. The model uses features like time of day, location, season, and weather conditions to predict risk levels.
4. Predictions are cached to improve performance.
5. The frontend can request predictions and display them to the user.

## Development

### Training the Model
To retrain the model with new data:

1. Update the `_create_dummy_model` method in `model.py` with your training data
2. Run the model training:
   ```bash
   python -c "from model import predictor; predictor._create_dummy_model()"
   ```

### Adding New Features
1. Update the feature extraction in the `predict_risk` method
2. Retrain the model with the new features
3. Update the API endpoint to accept the new parameters

## Deployment

For production deployment, consider using:
- Gunicorn or uWSGI as the WSGI server
- Nginx as a reverse proxy
- Environment variables for configuration
- A proper logging system

## License

[Your License Here]
