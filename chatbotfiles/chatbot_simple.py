import os
import json
from datetime import datetime, timedelta
from flask import Flask, request, jsonify
from flask_cors import CORS
import random

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Mock data for context (replace with your actual data source)
MOCK_EMERGENCY_DATA = {
    "recent_calls": [
        {
            "id": "C-9821",
            "type": "panic",
            "location": "Panaji Market Area",
            "timestamp": "2024-01-15T10:30:00Z",
            "urgency": 95,
            "transcript": "Help me please! Someone is following me near Panaji market. I am scared and hiding behind a shop.",
            "status": "attended"
        },
        {
            "id": "C-9822", 
            "type": "panic",
            "location": "Margao Residential Area",
            "timestamp": "2024-01-15T10:18:00Z",
            "urgency": 88,
            "transcript": "There are multiple people shouting and fighting outside my house in Margao. I think someone is getting hurt.",
            "status": "pending"
        },
        {
            "id": "C-9823",
            "type": "silence",
            "location": "Calangute Beach Road", 
            "timestamp": "2024-01-15T10:22:00Z",
            "urgency": 92,
            "transcript": "Silent call - possible coercion",
            "status": "attended"
        }
    ],
    "statistics": {
        "total_calls_today": 47,
        "women_safety_calls": 12,
        "high_urgency_calls": 8,
        "average_response_time": "4.2 minutes",
        "hotspots": ["Panaji Market", "Margao Residential", "Calangute Beach"]
    },
    "trends": {
        "calls_increase": "15%",
        "peak_hours": "10:00-12:00, 18:00-20:00",
        "most_common_type": "Women's Safety",
        "response_time_trend": "Improving"
    }
}

def get_emergency_context():
    """Get current emergency response context"""
    return {
        "current_time": datetime.now().isoformat(),
        "data": MOCK_EMERGENCY_DATA,
        "system_status": "operational",
        "active_operators": 3
    }

def generate_simple_response(user_query, context):
    """Generate a simple response based on keywords and context"""
    query_lower = user_query.lower()
    
    # Hotspots analysis
    if any(word in query_lower for word in ['hotspot', 'hot spot', 'high risk', 'dangerous', 'area']):
        hotspots = context['data']['statistics']['hotspots']
        return f"**Current High-Risk Areas:**\n\n{', '.join(hotspots)}\n\n**Analysis:** These areas show increased emergency activity today. Panaji Market has the highest concentration of incidents, followed by Margao Residential area. Consider deploying additional patrol units to these locations."
    
    # Response time analysis
    elif any(word in query_lower for word in ['response', 'time', 'efficiency', 'speed']):
        avg_time = context['data']['statistics']['average_response_time']
        trend = context['data']['trends']['response_time_trend']
        return f"**Response Time Analysis:**\n\n- Current Average: {avg_time}\n- Trend: {trend}\n- Benchmark: 5 minutes\n\n**Recommendations:** Response times are within acceptable limits. Continue current protocols and consider optimizing dispatch routes for faster response."
    
    # High priority alerts
    elif any(word in query_lower for word in ['priority', 'urgent', 'high', 'critical', 'alert']):
        high_urgency = context['data']['statistics']['high_urgency_calls']
        recent_calls = context['data']['recent_calls']
        urgent_calls = [call for call in recent_calls if call['urgency'] > 85]
        
        response = f"**High Priority Alerts:**\n\n- Total High Urgency Calls: {high_urgency}\n\n**Recent Critical Incidents:**\n"
        for call in urgent_calls[:3]:
            response += f"- {call['id']}: {call['type'].title()} in {call['location']} (Urgency: {call['urgency']})\n"
        
        return response + "\n**Action Required:** All high-priority calls are being actively monitored. Dispatch units are responding to critical incidents."
    
    # Summary report
    elif any(word in query_lower for word in ['summary', 'report', 'overview', 'today']):
        stats = context['data']['statistics']
        trends = context['data']['trends']
        
        return f"**Daily Emergency Summary Report**\n\n**Statistics:**\n- Total Calls: {stats['total_calls_today']}\n- Women's Safety Calls: {stats['women_safety_calls']}\n- High Urgency Calls: {stats['high_urgency_calls']}\n- Average Response Time: {stats['average_response_time']}\n\n**Trends:**\n- Calls Increase: {trends['calls_increase']}\n- Peak Hours: {trends['peak_hours']}\n- Most Common Type: {trends['most_common_type']}\n\n**Status:** System operating normally with all calls being processed efficiently."
    
    # Women's safety
    elif any(word in query_lower for word in ['women', 'female', 'safety', 'harassment']):
        women_calls = context['data']['statistics']['women_safety_calls']
        return f"**Women's Safety Analysis:**\n\n- Today's Calls: {women_calls}\n- Percentage of Total: {(women_calls/context['data']['statistics']['total_calls_today']*100):.1f}%\n\n**Patterns:** Most incidents occur in market areas and residential zones during evening hours. Consider increasing patrol presence in these areas during peak times."
    
    # General help
    else:
        return f"**AI Assistant Response:**\n\nI can help you analyze emergency data. Here's what I can assist with:\n\n- **Hotspots Analysis**: Ask about high-risk areas\n- **Response Times**: Inquire about efficiency metrics\n- **Priority Alerts**: Check current high-priority incidents\n- **Summary Reports**: Get daily overviews\n- **Women's Safety**: Analyze women's safety patterns\n\n**Current System Status:**\n- Total Calls Today: {context['data']['statistics']['total_calls_today']}\n- Active Operators: {context['active_operators']}\n- System Status: {context['system_status']}\n\nWhat would you like to know more about?"

@app.route('/api/chatbot/chat', methods=['POST'])
def chat_with_bot():
    """Main chatbot endpoint"""
    try:
        data = request.get_json()
        user_query = data.get('message', '').strip()
        
        if not user_query:
            return jsonify({
                'success': False,
                'error': 'Message is required'
            }), 400
        
        # Get current context
        context = get_emergency_context()
        
        # Generate response
        response = generate_simple_response(user_query, context)
        
        return jsonify({
            'success': True,
            'response': response,
            'timestamp': datetime.now().isoformat(),
            'context_used': {
                'total_calls': context['data']['statistics']['total_calls_today'],
                'active_operators': context['active_operators'],
                'system_status': context['system_status']
            }
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Error processing request: {str(e)}'
        }), 500

@app.route('/api/chatbot/context', methods=['GET'])
def get_context():
    """Get current system context"""
    try:
        context = get_emergency_context()
        return jsonify({
            'success': True,
            'context': context
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Error getting context: {str(e)}'
        }), 500

@app.route('/api/chatbot/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'success': True,
        'status': 'healthy',
        'gemini_configured': False,
        'simple_mode': True,
        'timestamp': datetime.now().isoformat()
    })

if __name__ == '__main__':
    print("🤖 Starting Simple Chatbot API Server...")
    print("🌐 Server running on http://localhost:5001")
    print("📡 API endpoints:")
    print("   - POST /api/chatbot/chat (Main chat endpoint)")
    print("   - GET /api/chatbot/context (System context)")
    print("   - GET /api/chatbot/health (Health check)")
    print("⚠️  Running in Simple Mode (without Gemini AI)")
    print("💡 To enable Gemini AI, install: py -m pip install google-generativeai")
    
    app.run(debug=True, host='0.0.0.0', port=5001)
