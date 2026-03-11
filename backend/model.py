import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import LabelEncoder
import joblib
import os

class RiskPredictor:
    def __init__(self):
        self.model = RandomForestClassifier(n_estimators=100, random_state=42)
        self.location_encoder = LabelEncoder()
        self.season_encoder = LabelEncoder()
        self.risk_encoder = LabelEncoder()
        self.is_trained = False
        
    def train(self, X, y, locations, seasons, risk_levels):
        """
        Train the risk prediction model
        X: Features (time, weather, etc.)
        y: Target variable (risk level)
        """
        # Encode categorical variables
        self.location_encoder.fit(locations)
        self.season_encoder.fit(seasons)
        self.risk_encoder.fit(risk_levels)
        
        # Train the model
        self.model.fit(X, y)
        self.is_trained = True
        
    def predict_risk(self, time_of_day, location, season, weather_condition):
        """
        Predict risk level based on input parameters
        Returns: dict with prediction and confidence
        """
        if not self.is_trained:
            self._load_model()
            
        # Encode categorical features
        try:
            loc_encoded = self.location_encoder.transform([location])[0]
            season_encoded = self.season_encoder.transform([season])[0]
        except ValueError:
            # If we get an unseen category, use the most frequent one
            loc_encoded = 0
            season_encoded = 0
            
        # Prepare feature vector
        features = np.array([[time_of_day, loc_encoded, season_encoded, weather_condition]])
        
        # Make prediction
        prediction = self.model.predict(features)[0]
        probabilities = self.model.predict_proba(features)[0]
        confidence = np.max(probabilities) * 100  # Convert to percentage
        
        # Decode the prediction
        risk_level = self.risk_encoder.inverse_transform([prediction])[0]
        
        return {
            'risk_level': risk_level,
            'confidence': round(float(confidence), 2),
            'features': {
                'time_of_day': time_of_day,
                'location': location,
                'season': season,
                'weather_condition': weather_condition
            }
        }
    
    def _load_model(self):
        """Load a pre-trained model if available"""
        model_path = os.path.join(os.path.dirname(__file__), 'model.joblib')
        if os.path.exists(model_path):
            loaded = joblib.load(model_path)
            self.model = loaded['model']
            self.location_encoder = loaded['location_encoder']
            self.season_encoder = loaded['season_encoder']
            self.risk_encoder = loaded['risk_encoder']
            self.is_trained = True
        else:
            # Train a simple model with dummy data if no saved model exists
            self._create_dummy_model()
    
    def _create_dummy_model(self):
        """Create a simple model with dummy data for demonstration"""
        # Dummy data
        np.random.seed(42)
        n_samples = 1000
        
        # Generate dummy features
        time_of_day = np.random.uniform(0, 24, n_samples)  # 24-hour format
        locations = ['Downtown', 'Suburb', 'Rural']
        seasons = ['Winter', 'Spring', 'Summer', 'Fall']
        weather_conditions = np.random.uniform(0, 1, n_samples)  # 0-1 scale
        
        # Generate dummy target (risk levels)
        def calculate_risk(time, loc_idx, season_idx, weather):
            # Higher risk at night
            time_risk = 0.5 if 6 <= time <= 18 else 0.8
            # Higher risk in certain locations
            loc_risk = [0.3, 0.6, 0.9][loc_idx % 3]
            # Higher risk in winter
            season_risk = [0.4, 0.3, 0.2, 0.5][season_idx % 4]
            # Higher risk in bad weather
            weather_risk = 0.3 + weather * 0.7
            
            # Combine factors
            risk_score = (time_risk * 0.3 + loc_risk * 0.3 + 
                         season_risk * 0.2 + weather_risk * 0.2)
            
            # Convert to risk levels
            if risk_score > 0.7:
                return 'High'
            elif risk_score > 0.4:
                return 'Moderate'
            else:
                return 'Low'
        
        # Generate dummy dataset
        X = []
        y = []
        locs = []
        sesns = []
        
        for _ in range(n_samples):
            loc_idx = np.random.randint(0, 3)
            season_idx = np.random.randint(0, 4)
            time = np.random.uniform(0, 24)
            weather = np.random.uniform(0, 1)
            
            X.append([time, loc_idx, season_idx, weather])
            y.append(calculate_risk(time, loc_idx, season_idx, weather))
            locs.append(locations[loc_idx])
            sesns.append(seasons[season_idx])
        
        # Train the model
        self.location_encoder.fit(locations)
        self.season_encoder.fit(seasons)
        self.risk_encoder.fit(['Low', 'Moderate', 'High'])
        
        # Convert locations and seasons to encoded values
        X_encoded = X.copy()
        X_encoded[:, 1] = self.location_encoder.transform([loc for loc in locs])
        X_encoded[:, 2] = self.season_encoder.transform([s for s in sesns])
        
        # Train the model
        self.model.fit(X_encoded, self.risk_encoder.transform(y))
        self.is_trained = True
        
        # Save the model for future use
        self._save_model()
    
    def _save_model(self):
        """Save the trained model and encoders"""
        model_path = os.path.join(os.path.dirname(__file__), 'model.joblib')
        joblib.dump({
            'model': self.model,
            'location_encoder': self.location_encoder,
            'season_encoder': self.season_encoder,
            'risk_encoder': self.risk_encoder
        }, model_path)

# Create a global instance of the predictor
predictor = RiskPredictor()

# If this module is run directly, train a dummy model
if __name__ == "__main__":
    predictor._load_model()  # This will create a dummy model if none exists
