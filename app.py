from flask import Flask, jsonify, request, render_template
from flask_cors import CORS
import pandas as pd
import random
import re
import csv
import os
from datetime import datetime, timedelta

app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app)  # Enable CORS for frontend requests

# === CSV data loading ===
CSV_PATH = os.path.join(os.path.dirname(__file__), 'cleaned_ALL_DATA_IN_DETAIL.csv')


def _parse_datetime(s: str):
    """Parse timestamps like '2025-03-16 12:32:28' -> datetime or None."""
    if not s or s.strip() in {'', '--:--:--'}:
        return None
    try:
        return datetime.strptime(s.strip(), '%Y-%m-%d %H:%M:%S')
    except Exception:
        return None


def _parse_duration_seconds(s: str) -> int:
    """Parse various duration formats to seconds. Examples:
    - '00h:12m:50s'
    - '0 days 00:12:51.187000'
    - '--:--:--' -> 0
    """
    if not s or s.strip() in {'', '--:--:--'}:
        return 0
    s = s.strip()
    # 00h:12m:50s
    m = re.match(r'(?:(\d{1,2})h:)??(?:(\d{1,2})m:)??(?:(\d{1,2})s)?', s)
    if m and any(m.groups()):
        h = int(m.group(1) or 0)
        mi = int(m.group(2) or 0)
        se = int(m.group(3) or 0)
        return h * 3600 + mi * 60 + se
    # 0 days 00:12:51.187000
    m = re.match(r'\d+\s+days\s+(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?', s)
    if m:
        h = int(m.group(1))
        mi = int(m.group(2))
        se = int(m.group(3))
        return h * 3600 + mi * 60 + se
    return 0


def load_calls_from_csv(csv_path: str):
    """Load calls from CSV and map to the structure used by the API."""
    calls = []
    if not os.path.exists(csv_path):
        return calls
    with open(csv_path, 'r', encoding='utf-8', newline='') as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                # Extract and map fields
                call_id = str(row.get('EVENT_ID') or row.get('SL_NO') or '').strip()
                transcript = (row.get('EVENT_INFORMATION') or '').strip()
                location = (row.get('Police_Station_Name') or row.get('POLICE_STATION') or '').strip()
                ts = _parse_datetime(row.get('CREATE_TIME') or '') or datetime.now()
                phone = str(row.get('DIALLED_NO') or '').strip()
                # Prefer MDT_RESPONSE_TIME, fallback to RESPONSE_TIME
                mdt_resp = (row.get('MDT_RESPONSE_TIME') or '').strip()
                resp_time = (row.get('RESPONSE_TIME') or '').strip()
                reach_time = (row.get('REACH_TIME') or '').strip()
                police_station_name = (row.get('Police_Station_Name') or row.get('POLICE_STATION') or '').strip()

                duration_s = _parse_duration_seconds(mdt_resp)
                if duration_s == 0:
                    duration_s = _parse_duration_seconds(resp_time)

                calls.append({
                    'id': call_id or f"ROW-{len(calls)+1}",
                    'transcript': transcript,
                    'location': location or 'Unknown',
                    'timestamp': ts,
                    'caller_phone': phone or 'N/A',
                    'duration': duration_s,
                    'notes': (row.get('CLOSURE_COMMENTS') or '').strip() or None,
                    # Preserve raw CSV fields commonly needed by UI
                    'EVENT_MAIN_TYPE': (row.get('EVENT_MAIN_TYPE') or '').strip(),
                    'EVENT_INFORMATION': transcript,
                    'Police_Station_Name': police_station_name,
                    'REACH_TIME': reach_time,
                    'MDT_RESPONSE_TIME': mdt_resp,
                    'RESPONSE_TIME': resp_time
                })
            except Exception:
                # Skip malformed rows safely
                continue
    return calls


# Load data once at startup
CALLS = load_calls_from_csv(CSV_PATH)

def classify_call_urgency(call):
    """
    AI-powered keyword-based urgency classification
    Returns 'High' or 'Normal' based on transcript analysis
    """
    transcript = call.get('transcript', '').lower()
    
    # High urgency keywords
    high_urgency_keywords = [
        'help', 'emergency', 'scared', 'following', 'hurt', 'fighting', 
        'attack', 'assault', 'danger', 'threat', 'violence', 'weapon',
        'kidnap', 'robbery', 'fire', 'accident', 'blood', 'injured',
        'please', 'quickly', 'immediately', 'urgent', 'dying', 'dead'
    ]
    
    # Prank/non-serious keywords
    prank_keywords = [
        'joke', 'kidding', 'prank', 'dare', 'friend', 'testing', 'test',
        'haha', 'funny', 'laugh', 'just kidding', 'not serious'
    ]
    
    # Check for silent calls (high urgency due to potential coercion)
    if not transcript.strip() and call.get('duration', 0) > 5:
        return 'High'  # Silent calls are treated as high urgency
    
    # Check for prank indicators first
    prank_score = sum(1 for keyword in prank_keywords if keyword in transcript)
    if prank_score >= 2:
        return 'Normal'
    
    # Check for high urgency keywords
    urgency_score = sum(1 for keyword in high_urgency_keywords if keyword in transcript)
    
    # Additional context analysis
    if 'taxi' in transcript and ('wrong' in transcript or 'scared' in transcript):
        urgency_score += 2  # Taxi-related safety issues
    
    if call.get('notes') and 'coercion' in call.get('notes', '').lower():
        urgency_score += 3  # Suspected coercion
    
    if call.get('duration', 0) < 10 and not transcript.strip():
        urgency_score += 2  # Very short silent calls
    
    # Classification threshold
    return 'High' if urgency_score >= 2 else 'Normal'

def generate_urgency_score(classification):
    """
    Convert classification to numerical score
    High urgency: 90-99
    Normal urgency: 10-30
    """
    if classification == 'High':
        return random.randint(90, 99)
    else:
        return random.randint(10, 30)

def get_call_type(call, classification):
    """
    Determine call type based on content and classification
    """
    transcript = call.get('transcript', '').lower()
    
    if not transcript.strip():
        return 'silence'
    
    if classification == 'Normal':
        return 'prank'
    
    return 'panic'

def generate_mock_transcript(call_type):
    """
    Generate appropriate transcript based on call type
    """
    if call_type == 'panic':
        return 'Caller sounds distressed, mentions location and fear. Background shouting audible.'
    elif call_type == 'silence':
        return 'Open line with ambient noise, no response to call-back prompts. Possible coercion or accidental dial.'
    else:
        return 'Call flagged as non-serious: inconsistent story and laughter in the background. Marked as prank-filtered.'

@app.route('/api/alerts')
def get_alerts():
    """
    AI-powered alerts endpoint
    Classifies calls by urgency and returns sorted list
    """
    try:
        processed_calls = []
        
        for call in CALLS:
            # AI classification
            classification = classify_call_urgency(call)
            urgency_score = generate_urgency_score(classification)
            call_type = get_call_type(call, classification)
            
            # Create processed call object
            processed_call = {
                'id': call['id'],
                'type': call_type,
                'EVENT_MAIN_TYPE': call.get('EVENT_MAIN_TYPE', ''),
                'summary': call['transcript'][:80] + '...' if len(call['transcript']) > 80 else call['transcript'] or f"Silent call from {call['location']}",
                'urgency': urgency_score,
                'classification': classification,
                'transcript': call['transcript'] or generate_mock_transcript(call_type),
                'location': call['location'],
                'timestamp': call['timestamp'].isoformat(),
                'caller_phone': call['caller_phone'],
                'duration': call['duration'],
                'notes': call.get('notes', 'Initial assessment recorded - GPS ping requested - Unit notified for welfare check')
            }
            
            processed_calls.append(processed_call)
        
        # Sort by urgency score (descending)
        processed_calls.sort(key=lambda x: x['urgency'], reverse=True)
        
        return jsonify({
            'success': True,
            'alerts': processed_calls,
            'total_count': len(processed_calls),
            'high_urgency_count': len([c for c in processed_calls if c['classification'] == 'High']),
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/alerts/<call_id>')
def get_alert_detail(call_id):
    """
    Get detailed information for a specific call
    """
    try:
        # Find the call
        call = next((c for c in CALLS if str(c['id']) == str(call_id)), None)
        
        if not call:
            return jsonify({
                'success': False,
                'error': 'Call not found'
            }), 404
        
        # Process the call
        classification = classify_call_urgency(call)
        urgency_score = generate_urgency_score(classification)
        call_type = get_call_type(call, classification)
        
        detailed_call = {
            'id': call['id'],
            'type': call_type,
            'EVENT_MAIN_TYPE': call.get('EVENT_MAIN_TYPE', ''),
            'urgency': urgency_score,
            'classification': classification,
            'transcript': call['transcript'] or generate_mock_transcript(call_type),
            'location': call['location'],
            'timestamp': call['timestamp'].isoformat(),
            'caller_phone': call['caller_phone'],
            'duration': call['duration'],
            'notes': call.get('notes', 'Initial assessment recorded - GPS ping requested - Unit notified for welfare check'),
            'response_outcome': 'Pending escalation review.',
            'sentiment': 'panic' if call_type == 'panic' else 'distress' if call_type == 'silence' else 'calm'
        }
        
        return jsonify({
            'success': True,
            'call': detailed_call
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/stats')
def get_stats():
    """
    Get statistics for the anomaly dashboard
    """
    try:
        # Generate mock statistics
        prank_calls_daily = [random.randint(2, 20) for _ in range(7)]
        area_spikes = [random.randint(10, 50) for _ in range(7)]
        
        return jsonify({
            'success': True,
            'prank_calls_daily': prank_calls_daily,
            'area_spikes': area_spikes,
            'total_calls_today': sum(prank_calls_daily[-1:]) + random.randint(50, 100),
            'ai_accuracy': random.randint(92, 98)
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/data')
def data():
    """Return raw CSV rows as JSON array (records)."""
    try:
        df = pd.read_csv(CSV_PATH)
        # Use records orientation to return a list of dicts
        records = df.to_dict(orient='records')
        return jsonify(records)
    except Exception as e:
        return jsonify({ 'success': False, 'error': str(e) }), 500

@app.route('/')
def index():
    # Render dashboard template if available; otherwise show status string
    try:
        return render_template('dashboard.html')
    except Exception:
        return "112 Goa Emergency Response System - API Server Running"

if __name__ == '__main__':
    print("🚨 Starting 112 Goa Emergency Response API Server...")
    print("🤖 AI-powered alert classification enabled")
    print("🌐 Server running on http://localhost:5000")
    print("📡 API endpoints:")
    print("   - GET /api/alerts (AI-sorted emergency calls)")
    print("   - GET /api/alerts/<call_id> (Detailed call information)")
    print("   - GET /api/stats (Dashboard statistics)")
    
    app.run(debug=True, host='0.0.0.0', port=5000)
