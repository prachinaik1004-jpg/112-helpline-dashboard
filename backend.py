from flask import Flask, jsonify, request, render_template
from flask_cors import CORS
import pandas as pd
import sqlite3
import numpy as np
import random
import re
import csv
import os
import json
from datetime import datetime, timedelta
from dateutil import parser
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app)  # Enable CORS for frontend requests

# === Configuration ===
CSV_PATH = os.path.join(os.path.dirname(__file__), 'cleaned_ALL_DATA_IN_DETAIL.csv')
DB_PATH = os.path.join(os.path.dirname(__file__), 'emergency_data.db')

class EmergencyDataManager:
    """Enhanced data manager with SQLite database integration"""
    
    def __init__(self, csv_path, db_path):
        self.csv_path = csv_path
        self.db_path = db_path
        self.init_database()
        self.load_data_to_db()
    
    def init_database(self):
        """Initialize SQLite database with proper schema"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Create main calls table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS emergency_calls (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sl_no INTEGER,
                create_time TEXT,
                signal_type TEXT,
                event_id TEXT,
                dialled_no TEXT,
                caller_name TEXT,
                event_main_type TEXT,
                event_information TEXT,
                action_taken_at_dcc TEXT,
                police_station TEXT,
                call_sign TEXT,
                mdt_assigned_time TEXT,
                delivered_time TEXT,
                reach_time TEXT,
                mdt_response_time TEXT,
                closure_comments TEXT,
                response_time TEXT,
                assignment_delay TEXT,
                delivery_time TEXT,
                police_station_name TEXT,
                urgency_score INTEGER DEFAULT 0,
                classification TEXT DEFAULT 'Normal',
                call_type TEXT DEFAULT 'unknown',
                processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Create analytics table for performance metrics
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS analytics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT,
                total_calls INTEGER,
                high_urgency_calls INTEGER,
                response_time_avg REAL,
                police_station TEXT,
                event_type TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Create indexes for better performance
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_event_id ON emergency_calls(event_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_police_station ON emergency_calls(police_station_name)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_create_time ON emergency_calls(create_time)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_urgency ON emergency_calls(urgency_score)')
        
        conn.commit()
        conn.close()
        logger.info("Database initialized successfully")
    
    def parse_datetime(self, s: str):
        """Enhanced datetime parsing with multiple formats"""
        if not s or s.strip() in {'', '--:--:--'}:
            return None
        try:
            # Try multiple datetime formats
            s = s.strip()
            for fmt in ['%Y-%m-%d %H:%M:%S', '%Y-%m-%d %H:%M:%S.%f', '%d/%m/%Y %H:%M:%S']:
                try:
                    return datetime.strptime(s, fmt)
                except ValueError:
                    continue
            # Fallback to dateutil parser
            return parser.parse(s)
        except Exception as e:
            logger.warning(f"Failed to parse datetime '{s}': {e}")
            return None
    
    def parse_duration_seconds(self, s: str) -> int:
        """Enhanced duration parsing with more formats"""
        if not s or s.strip() in {'', '--:--:--'}:
            return 0
        s = s.strip()
        
        # 00h:12m:50s format
        m = re.match(r'(?:(\d{1,2})h:)??(?:(\d{1,2})m:)??(?:(\d{1,2})s)?', s)
        if m and any(m.groups()):
            h = int(m.group(1) or 0)
            mi = int(m.group(2) or 0)
            se = int(m.group(3) or 0)
            return h * 3600 + mi * 60 + se
        
        # 0 days 00:12:51.187000 format
        m = re.match(r'\d+\s+days\s+(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?', s)
        if m:
            h = int(m.group(1))
            mi = int(m.group(2))
            se = int(m.group(3))
            return h * 3600 + mi * 60 + se
        
        # Try to parse as timedelta string
        try:
            if 'days' in s:
                parts = s.split()
                days = int(parts[0])
                time_part = parts[2]  # HH:MM:SS
                h, m, s = map(int, time_part.split(':'))
                return days * 86400 + h * 3600 + m * 60 + s
        except:
            pass
        
        return 0
    
    def classify_call_urgency(self, call_data):
        """Enhanced AI-powered urgency classification"""
        transcript = (call_data.get('event_information') or '').lower()
        event_type = (call_data.get('event_main_type') or '').lower()
        
        # High urgency keywords
        high_urgency_keywords = [
            'help', 'emergency', 'scared', 'following', 'hurt', 'fighting', 
            'attack', 'assault', 'danger', 'threat', 'violence', 'weapon',
            'kidnap', 'robbery', 'fire', 'accident', 'blood', 'injured',
            'please', 'quickly', 'immediately', 'urgent', 'dying', 'dead',
            'rape', 'molest', 'abuse', 'threaten', 'kill', 'murder'
        ]
        
        # Event type urgency mapping
        event_urgency_map = {
            'fighting and assault': 3,
            'accident': 3,
            'nuisance or mischief': 1,
            'others': 1
        }
        
        # Prank/non-serious keywords
        prank_keywords = [
            'joke', 'kidding', 'prank', 'dare', 'friend', 'testing', 'test',
            'haha', 'funny', 'laugh', 'just kidding', 'not serious'
        ]
        
        urgency_score = 0
        
        # Check for prank indicators first
        prank_score = sum(1 for keyword in prank_keywords if keyword in transcript)
        if prank_score >= 2:
            return 'Normal', 10
        
        # Event type scoring
        urgency_score += event_urgency_map.get(event_type, 0)
        
        # Keyword scoring
        urgency_score += sum(1 for keyword in high_urgency_keywords if keyword in transcript)
        
        # Additional context analysis
        if 'taxi' in transcript and ('wrong' in transcript or 'scared' in transcript):
            urgency_score += 2
        
        if call_data.get('closure_comments') and 'coercion' in str(call_data.get('closure_comments', '')).lower():
            urgency_score += 3
        
        # Response time analysis
        response_time = self.parse_duration_seconds(call_data.get('mdt_response_time', '') or call_data.get('response_time', ''))
        if response_time > 1800:  # More than 30 minutes
            urgency_score += 1
        
        # Classification
        if urgency_score >= 3:
            return 'High', min(95, 60 + urgency_score * 5)
        else:
            return 'Normal', max(10, 20 + urgency_score * 5)
    
    def get_call_type(self, call_data, classification):
        """Determine call type based on content and classification"""
        transcript = (call_data.get('event_information') or '').lower()
        event_type = (call_data.get('event_main_type') or '').lower()
        
        if not transcript.strip():
            return 'silence'
        
        if classification == 'Normal':
            return 'prank'
        
        if event_type in ['fighting and assault', 'accident']:
            return 'emergency'
        
        return 'panic'
    
    def load_data_to_db(self):
        """Load CSV data into SQLite database with processing"""
        if not os.path.exists(self.csv_path):
            logger.error(f"CSV file not found: {self.csv_path}")
            return
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Clear existing data
        cursor.execute('DELETE FROM emergency_calls')
        
        processed_count = 0
        with open(self.csv_path, 'r', encoding='utf-8', newline='') as f:
            reader = csv.DictReader(f)
            for row in reader:
                try:
                    # Parse and process the row
                    create_time = self.parse_datetime(row.get('CREATE_TIME', ''))
                    if not create_time:
                        create_time = datetime.now()
                    
                    # Classify urgency
                    classification, urgency_score = self.classify_call_urgency(row)
                    call_type = self.get_call_type(row, classification)
                    
                    # Insert into database
                    cursor.execute('''
                        INSERT INTO emergency_calls (
                            sl_no, create_time, signal_type, event_id, dialled_no, caller_name,
                            event_main_type, event_information, action_taken_at_dcc, police_station,
                            call_sign, mdt_assigned_time, delivered_time, reach_time, mdt_response_time,
                            closure_comments, response_time, assignment_delay, delivery_time,
                            police_station_name, urgency_score, classification, call_type
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        int(row.get('SL_NO', 0)) if row.get('SL_NO') else 0,
                        create_time.isoformat(),
                        row.get('SIGNAL_TYPE', ''),
                        row.get('EVENT_ID', ''),
                        row.get('DIALLED_NO', ''),
                        row.get('CALLER_NAME', ''),
                        row.get('EVENT_MAIN_TYPE', ''),
                        row.get('EVENT_INFORMATION', ''),
                        row.get('ACTION_TAKEN_AT_DCC', ''),
                        row.get('POLICE_STATION', ''),
                        row.get('CALL_SIGN', ''),
                        row.get('MDT_ASSIGNED_TIME', ''),
                        row.get('DELIVERED_TIME', ''),
                        row.get('REACH_TIME', ''),
                        row.get('MDT_RESPONSE_TIME', ''),
                        row.get('CLOSURE_COMMENTS', ''),
                        row.get('RESPONSE_TIME', ''),
                        row.get('ASSIGNMENT_DELAY', ''),
                        row.get('DELIVERY_TIME', ''),
                        row.get('Police_Station_Name', ''),
                        urgency_score,
                        classification,
                        call_type
                    ))
                    processed_count += 1
                    
                except Exception as e:
                    logger.warning(f"Failed to process row {processed_count}: {e}")
                    continue
        
        conn.commit()
        conn.close()
        logger.info(f"Loaded {processed_count} records into database")
    
    def get_calls(self, limit=100, offset=0, urgency_filter=None, station_filter=None):
        """Get calls with filtering and pagination"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        query = "SELECT * FROM emergency_calls WHERE 1=1"
        params = []
        
        if urgency_filter:
            query += " AND classification = ?"
            params.append(urgency_filter)
        
        if station_filter:
            query += " AND police_station_name LIKE ?"
            params.append(f"%{station_filter}%")
        
        query += " ORDER BY urgency_score DESC, create_time DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])
        
        cursor.execute(query, params)
        calls = [dict(row) for row in cursor.fetchall()]
        
        conn.close()
        return calls
    
    def get_analytics(self):
        """Get comprehensive analytics data"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Total calls
        cursor.execute("SELECT COUNT(*) FROM emergency_calls")
        total_calls = cursor.fetchone()[0]
        
        # High urgency calls
        cursor.execute("SELECT COUNT(*) FROM emergency_calls WHERE classification = 'High'")
        high_urgency_calls = cursor.fetchone()[0]
        
        # Calls by police station
        cursor.execute("""
            SELECT police_station_name, COUNT(*) as count 
            FROM emergency_calls 
            WHERE police_station_name != '' 
            GROUP BY police_station_name 
            ORDER BY count DESC 
            LIMIT 10
        """)
        station_stats = [{"station": row[0], "count": row[1]} for row in cursor.fetchall()]
        
        # Calls by event type
        cursor.execute("""
            SELECT event_main_type, COUNT(*) as count 
            FROM emergency_calls 
            WHERE event_main_type != '' 
            GROUP BY event_main_type 
            ORDER BY count DESC
        """)
        event_type_stats = [{"type": row[0], "count": row[1]} for row in cursor.fetchall()]
        
        # Daily call trends (last 7 days)
        cursor.execute("""
            SELECT DATE(create_time) as date, COUNT(*) as count 
            FROM emergency_calls 
            WHERE create_time >= date('now', '-7 days')
            GROUP BY DATE(create_time) 
            ORDER BY date DESC
        """)
        daily_trends = [{"date": row[0], "count": row[1]} for row in cursor.fetchall()]
        
        # Average response time
        cursor.execute("""
            SELECT AVG(
                CASE 
                    WHEN mdt_response_time != '' AND mdt_response_time != '--:--:--' 
                    THEN CAST(substr(mdt_response_time, 1, 2) AS INTEGER) * 3600 + 
                         CAST(substr(mdt_response_time, 4, 2) AS INTEGER) * 60 + 
                         CAST(substr(mdt_response_time, 7, 2) AS INTEGER)
                    ELSE NULL 
                END
            ) as avg_response_seconds
            FROM emergency_calls 
            WHERE mdt_response_time != '' AND mdt_response_time != '--:--:--'
        """)
        avg_response = cursor.fetchone()[0] or 0
        
        conn.close()
        
        return {
            "total_calls": total_calls,
            "high_urgency_calls": high_urgency_calls,
            "station_stats": station_stats,
            "event_type_stats": event_type_stats,
            "daily_trends": daily_trends,
            "avg_response_time_seconds": avg_response,
            "urgency_percentage": (high_urgency_calls / total_calls * 100) if total_calls > 0 else 0
        }

# Initialize data manager
data_manager = EmergencyDataManager(CSV_PATH, DB_PATH)

# === API Routes ===

@app.route('/api/alerts')
def get_alerts():
    """Get emergency alerts with filtering and pagination"""
    try:
        limit = int(request.args.get('limit', 100))
        offset = int(request.args.get('offset', 0))
        urgency_filter = request.args.get('urgency')
        station_filter = request.args.get('station')
        
        calls = data_manager.get_calls(limit, offset, urgency_filter, station_filter)
        
        # Format calls for frontend
        formatted_calls = []
        for call in calls:
            formatted_call = {
                'id': call['event_id'] or call['id'],
                'type': call['call_type'],
                'EVENT_MAIN_TYPE': call['event_main_type'],
                'summary': (call['event_information'][:80] + '...') if len(call['event_information']) > 80 else call['event_information'],
                'urgency': call['urgency_score'],
                'classification': call['classification'],
                'transcript': call['event_information'],
                'location': call['police_station_name'] or 'Unknown',
                'timestamp': call['create_time'],
                'caller_phone': call['dialled_no'] or 'N/A',
                'duration': data_manager.parse_duration_seconds(call['mdt_response_time'] or call['response_time'] or ''),
                'notes': call['closure_comments'] or 'Initial assessment recorded',
                'caller_name': call['caller_name'],
                'call_sign': call['call_sign'],
                'response_time': call['mdt_response_time'] or call['response_time']
            }
            formatted_calls.append(formatted_call)
        
        return jsonify({
            'success': True,
            'alerts': formatted_calls,
            'total_count': len(formatted_calls),
            'high_urgency_count': len([c for c in formatted_calls if c['classification'] == 'High']),
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Error in get_alerts: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/alerts/<call_id>')
def get_alert_detail(call_id):
    """Get detailed information for a specific call"""
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute("SELECT * FROM emergency_calls WHERE event_id = ? OR id = ?", (call_id, call_id))
        call = cursor.fetchone()
        
        if not call:
            return jsonify({
                'success': False,
                'error': 'Call not found'
            }), 404
        
        call_dict = dict(call)
        
        detailed_call = {
            'id': call_dict['event_id'] or call_dict['id'],
            'type': call_dict['call_type'],
            'EVENT_MAIN_TYPE': call_dict['event_main_type'],
            'urgency': call_dict['urgency_score'],
            'classification': call_dict['classification'],
            'transcript': call_dict['event_information'],
            'location': call_dict['police_station_name'] or 'Unknown',
            'timestamp': call_dict['create_time'],
            'caller_phone': call_dict['dialled_no'] or 'N/A',
            'duration': data_manager.parse_duration_seconds(call_dict['mdt_response_time'] or call_dict['response_time'] or ''),
            'notes': call_dict['closure_comments'] or 'Initial assessment recorded',
            'caller_name': call_dict['caller_name'],
            'call_sign': call_dict['call_sign'],
            'response_time': call_dict['mdt_response_time'] or call_dict['response_time'],
            'action_taken': call_dict['action_taken_at_dcc'],
            'assignment_delay': call_dict['assignment_delay'],
            'delivery_time': call_dict['delivery_time'],
            'sentiment': 'panic' if call_dict['call_type'] == 'panic' else 'distress' if call_dict['call_type'] == 'silence' else 'calm'
        }
        
        conn.close()
        
        return jsonify({
            'success': True,
            'call': detailed_call
        })
        
    except Exception as e:
        logger.error(f"Error in get_alert_detail: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/stats')
def get_stats():
    """Get comprehensive statistics and analytics"""
    try:
        analytics = data_manager.get_analytics()
        
        return jsonify({
            'success': True,
            'total_calls': analytics['total_calls'],
            'high_urgency_calls': analytics['high_urgency_calls'],
            'urgency_percentage': round(analytics['urgency_percentage'], 2),
            'station_stats': analytics['station_stats'],
            'event_type_stats': analytics['event_type_stats'],
            'daily_trends': analytics['daily_trends'],
            'avg_response_time_seconds': analytics['avg_response_time_seconds'],
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Error in get_stats: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/analytics/trends')
def get_trends():
    """Get detailed trend analysis"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Hourly distribution
        cursor.execute("""
            SELECT strftime('%H', create_time) as hour, COUNT(*) as count
            FROM emergency_calls
            GROUP BY strftime('%H', create_time)
            ORDER BY hour
        """)
        hourly_dist = [{"hour": int(row[0]), "count": row[1]} for row in cursor.fetchall()]
        
        # Weekly distribution
        cursor.execute("""
            SELECT strftime('%w', create_time) as day_of_week, COUNT(*) as count
            FROM emergency_calls
            GROUP BY strftime('%w', create_time)
            ORDER BY day_of_week
        """)
        weekly_dist = [{"day": int(row[0]), "count": row[1]} for row in cursor.fetchall()]
        
        conn.close()
        
        return jsonify({
            'success': True,
            'hourly_distribution': hourly_dist,
            'weekly_distribution': weekly_dist,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Error in get_trends: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/search')
def search_calls():
    """Search calls by various criteria"""
    try:
        query = request.args.get('q', '')
        station = request.args.get('station', '')
        event_type = request.args.get('event_type', '')
        date_from = request.args.get('date_from', '')
        date_to = request.args.get('date_to', '')
        limit = int(request.args.get('limit', 50))
        
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        sql = "SELECT * FROM emergency_calls WHERE 1=1"
        params = []
        
        if query:
            sql += " AND (event_information LIKE ? OR caller_name LIKE ? OR event_id LIKE ?)"
            params.extend([f"%{query}%", f"%{query}%", f"%{query}%"])
        
        if station:
            sql += " AND police_station_name LIKE ?"
            params.append(f"%{station}%")
        
        if event_type:
            sql += " AND event_main_type LIKE ?"
            params.append(f"%{event_type}%")
        
        if date_from:
            sql += " AND create_time >= ?"
            params.append(date_from)
        
        if date_to:
            sql += " AND create_time <= ?"
            params.append(date_to)
        
        sql += " ORDER BY create_time DESC LIMIT ?"
        params.append(limit)
        
        cursor.execute(sql, params)
        calls = [dict(row) for row in cursor.fetchall()]
        
        conn.close()
        
        # Format results
        formatted_calls = []
        for call in calls:
            formatted_call = {
                'id': call['event_id'] or call['id'],
                'type': call['call_type'],
                'summary': (call['event_information'][:100] + '...') if len(call['event_information']) > 100 else call['event_information'],
                'urgency': call['urgency_score'],
                'classification': call['classification'],
                'location': call['police_station_name'] or 'Unknown',
                'timestamp': call['create_time'],
                'caller_name': call['caller_name'],
                'event_type': call['event_main_type']
            }
            formatted_calls.append(formatted_call)
        
        return jsonify({
            'success': True,
            'results': formatted_calls,
            'total_found': len(formatted_calls),
            'query': query,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Error in search_calls: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/data')
def get_raw_data():
    """Get raw CSV data as JSON"""
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute("SELECT * FROM emergency_calls ORDER BY create_time DESC LIMIT 1000")
        calls = [dict(row) for row in cursor.fetchall()]
        
        conn.close()
        
        return jsonify(calls)
        
    except Exception as e:
        logger.error(f"Error in get_raw_data: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/health')
def health_check():
    """Health check endpoint"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM emergency_calls")
        total_calls = cursor.fetchone()[0]
        conn.close()
        
        return jsonify({
            'status': 'healthy',
            'database': 'connected',
            'total_calls': total_calls,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        return jsonify({
            'status': 'unhealthy',
            'error': str(e),
            'timestamp': datetime.now().isoformat()
        }), 500

@app.route('/')
def index():
    """Main dashboard route"""
    try:
        return render_template('dashboard.html')
    except Exception:
        return jsonify({
            'message': '112 Goa Emergency Response System - API Server Running',
            'endpoints': [
                '/api/alerts - Get emergency alerts',
                '/api/stats - Get statistics',
                '/api/analytics/trends - Get trend analysis',
                '/api/search - Search calls',
                '/data - Get raw data',
                '/api/health - Health check'
            ]
        })

if __name__ == '__main__':
    print("🚨 Starting Enhanced 112 Goa Emergency Response API Server...")
    print("🤖 AI-powered alert classification enabled")
    print("🗄️ SQLite database integration active")
    print("📊 Advanced analytics and reporting available")
    print("🌐 Server running on http://localhost:5000")
    print("📡 API endpoints:")
    print("   - GET /api/alerts (Emergency calls with filtering)")
    print("   - GET /api/alerts/<id> (Detailed call information)")
    print("   - GET /api/stats (Comprehensive statistics)")
    print("   - GET /api/analytics/trends (Trend analysis)")
    print("   - GET /api/search (Search functionality)")
    print("   - GET /data (Raw data access)")
    print("   - GET /api/health (Health check)")
    
    app.run(debug=True, host='0.0.0.0', port=5000)
