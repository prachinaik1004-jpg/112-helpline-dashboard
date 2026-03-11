from flask import Flask, request, jsonify, make_response
from flask_cors import CORS, cross_origin
from flask_socketio import SocketIO, emit, join_room, leave_room
from model import predictor
import datetime
import random
import os
import logging
import json
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

app = Flask(__name__)

# Configure CORS
cors = CORS(app, resources={
    r"/api/*": {
        "origins": ["*"],
        "methods": ["GET", "OPTIONS"],
        "allow_headers": ["Content-Type"]
    }
})

# Initialize SocketIO
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

# Add CORS headers to all responses
@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    return response

# WebSocket event handlers
@socketio.on('connect')
def handle_connect():
    logger.info(f"Client connected: {request.sid}")
    emit('connection_status', {'status': 'connected', 'client_id': request.sid})

@socketio.on('disconnect')
def handle_disconnect():
    logger.info(f"Client disconnected: {request.sid}")

@socketio.on('join_ride_monitoring')
def handle_join_ride_monitoring(data):
    ride_id = data.get('ride_id', 'general')
    join_room(ride_id)
    logger.info(f"Client {request.sid} joined ride monitoring for ride: {ride_id}")
    emit('joined_room', {'room': ride_id, 'client_id': request.sid})

@socketio.on('leave_ride_monitoring')
def handle_leave_ride_monitoring(data):
    ride_id = data.get('ride_id', 'general')
    leave_room(ride_id)
    logger.info(f"Client {request.sid} left ride monitoring for ride: {ride_id}")
    emit('left_room', {'room': ride_id, 'client_id': request.sid})

@socketio.on('send_signal')
def handle_signal(data):
    logger.info(f"Received signal from client {request.sid}: {data}")

    # Process the signal and potentially send to other clients monitoring the same ride
    ride_id = data.get('ride_id', 'general')
    signal_type = data.get('signal_type', 'general')
    signal_data = data.get('data', {})

    # Emit the signal to all clients monitoring this ride
    socketio.emit('signal_received', {
        'signal_type': signal_type,
        'ride_id': ride_id,
        'data': signal_data,
        'timestamp': datetime.datetime.now().isoformat(),
        'source_client': request.sid
    }, room=ride_id)

    # Also emit to sender for confirmation
    emit('signal_sent', {
        'signal_type': signal_type,
        'ride_id': ride_id,
        'data': signal_data,
        'timestamp': datetime.datetime.now().isoformat()
    })

@socketio.on('update_ride_status')
def handle_ride_status_update(data):
    logger.info(f"Ride status update from client {request.sid}: {data}")

    ride_id = data.get('ride_id')
    status = data.get('status')
    location = data.get('location', {})
    timestamp = datetime.datetime.now().isoformat()

    # Emit real-time ride status update to all monitoring clients
    socketio.emit('ride_status_updated', {
        'ride_id': ride_id,
        'status': status,
        'location': location,
        'timestamp': timestamp,
        'source_client': request.sid
    }, room=ride_id)

@socketio.on('sos_alert')
def handle_sos_alert(data):
    logger.warning(f"SOS ALERT from client {request.sid}: {data}")

    ride_id = data.get('ride_id')
    location = data.get('location', {})
    message = data.get('message', 'SOS Alert triggered')

    # Emit SOS alert to all clients and potentially trigger emergency protocols
    socketio.emit('sos_alert_received', {
        'ride_id': ride_id,
        'location': location,
        'message': message,
        'timestamp': datetime.datetime.now().isoformat(),
        'priority': 'high',
        'source_client': request.sid
    })

# Initialize the predictor
predictor._load_model()

@app.route('/api/predict', methods=['GET'])
@cross_origin()
def predict():
    try:
        logger.info("Received prediction request")
        
        # Get parameters from request
        location = request.args.get('location', 'Downtown')
        logger.info(f"Location parameter: {location}")
        
        # Get current time (0-23.999...)
        now = datetime.datetime.now()
        time_of_day = now.hour + now.minute / 60 + now.second / 3600
        
        # Determine season (simplified)
        month = now.month
        if 3 <= month <= 5:
            season = 'Spring'
        elif 6 <= month <= 8:
            season = 'Summer'
        elif 9 <= month <= 11:
            season = 'Fall'
        else:
            season = 'Winter'
        
        # Simulate weather condition (0-1 scale)
        weather_condition = random.uniform(0, 1)
        
        logger.info(f"Making prediction with params - Time: {time_of_day}, Location: {location}, Season: {season}")
        
        # Get prediction
        result = predictor.predict_risk(
            time_of_day=time_of_day,
            location=location,
            season=season,
            weather_condition=weather_condition
        )
        
        if not result or 'risk_level' not in result:
            raise ValueError("Invalid prediction result from model")
        
        # Calculate rise/fall from previous prediction (simplified)
        rise = round(random.uniform(-15, 15), 1)
        
        # Generate recommendations based on risk level
        recommendations = []
        risk_level = result['risk_level'].lower()
        
        if risk_level == 'high':
            recommendations = [
                "Increase patrols in the area",
                "Issue public safety advisory",
                "Coordinate with local law enforcement"
            ]
        elif risk_level == 'moderate':
            recommendations = [
                "Monitor the situation closely",
                "Review recent incident reports",
                "Consider additional lighting in the area"
            ]
        else:
            recommendations = [
                "Maintain regular patrols",
                "Continue monitoring the situation",
                "Review and update safety protocols"
            ]
        
        # Add some dynamic recommendations based on time and location
        if 20 <= time_of_day or time_of_day <= 5:  # Night time
            recommendations.append("Increase nighttime surveillance")
        
        if 'downtown' in location.lower():
            recommendations.append("Coordinate with local businesses for additional security")
        
        # Prepare response
        response = {
            'success': True,
            'prediction': {
                'risk_level': result['risk_level'],
                'confidence': result['confidence'],
                'rise': rise,
                'location': location,
                'season': season,
                'time_of_day': f"{int(time_of_day)}:{int((time_of_day % 1) * 60):02d}",
                'weather_condition': 'Good' if weather_condition < 0.5 else 'Poor',
                'recommendations': recommendations
            }
        }
        
        logger.info(f"Prediction successful: {response}")
        return jsonify(response)
        
    except Exception as e:
        error_msg = f"Error in prediction: {str(e)}"
        logger.error(error_msg, exc_info=True)
        return jsonify({
            'success': False,
            'error': error_msg,
            'traceback': str(e.__traceback__) if hasattr(e, '__traceback__') else None
        }), 500

@app.route('/api/health', methods=['GET'])
@cross_origin()
def health_check():
    try:
        # Check if model is loaded
        model_status = {
            'is_loaded': predictor.is_trained,
            'model_type': str(type(predictor.model).__name__) if hasattr(predictor, 'model') else 'None'
        }
        
        # Check if required directories exist
        import os
        import sys
        
        # Get Python and package versions
        import platform
        import sklearn
        import numpy as np
        import pandas as pd
        
        return jsonify({
            'status': 'healthy',
            'timestamp': datetime.datetime.now().isoformat(),
            'system': {
                'python_version': platform.python_version(),
                'platform': platform.system(),
                'machine': platform.machine()
            },
            'dependencies': {
                'numpy': np.__version__,
                'pandas': pd.__version__,
                'scikit-learn': sklearn.__version__
            },
            'model': model_status,
            'environment': {
                'working_directory': os.getcwd(),
                'python_path': sys.path
            }
        })
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'error': str(e),
            'timestamp': datetime.datetime.now().isoformat()
        }), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    logger.info(f"Starting server with WebSocket support on port {port}")
    socketio.run(app, host='0.0.0.0', port=port, debug=True)
