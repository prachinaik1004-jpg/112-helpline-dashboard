import os
import json
import google.generativeai as genai
from datetime import datetime, timedelta
from flask import Flask, request, jsonify
from flask_cors import CORS
import random
from config import GEMINI_API_KEY

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Configure Gemini AI
def configure_gemini():
    """Configure Gemini AI with API key"""
    api_key = GEMINI_API_KEY
    if not api_key:
        raise ValueError("GEMINI_API_KEY is required")
    
    genai.configure(api_key=api_key)
    return genai.GenerativeModel('gemini-1.5-flash')

# Initialize Gemini model
try:
    model = configure_gemini()
    print("✅ Gemini AI configured successfully")
except Exception as e:
    print(f"❌ Error configuring Gemini AI: {e}")
    model = None

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

def create_chatbot_prompt(user_query, context):
    """Create a comprehensive prompt for the chatbot"""
    
    system_prompt = f"""
You are an AI assistant for the 112 Goa Emergency Response System. You help emergency operators and supervisors analyze data, understand patterns, and make informed decisions.

CONTEXT:
- You have access to real-time emergency call data
- Current system status: {context['system_status']}
- Active operators: {context['active_operators']}
- Current time: {context['current_time']}

RECENT EMERGENCY DATA:
{json.dumps(context['data'], indent=2)}

CAPABILITIES:
1. Analyze emergency call patterns and trends
2. Identify high-risk areas and hotspots
3. Provide insights on response times and efficiency
4. Suggest resource allocation strategies
5. Help with incident classification and prioritization
6. Generate reports and summaries
7. Answer questions about emergency response procedures

GUIDELINES:
- Always prioritize safety and emergency response
- Provide data-driven insights
- Be concise but comprehensive
- Use specific examples from the data when relevant
- Suggest actionable recommendations
- Maintain professional emergency response tone

USER QUERY: {user_query}

Please provide a helpful response based on the available data and context.
"""

    return system_prompt

@app.route('/api/chatbot/chat', methods=['POST'])
def chat_with_bot():
    """Main chatbot endpoint"""
    try:
        if not model:
            return jsonify({
                'success': False,
                'error': 'Gemini AI not configured. Please check API key.'
            }), 500
        
        data = request.get_json()
        user_query = data.get('message', '').strip()
        
        if not user_query:
            return jsonify({
                'success': False,
                'error': 'Message is required'
            }), 400
        
        # Get current context
        context = get_emergency_context()
        
        # Create prompt
        prompt = create_chatbot_prompt(user_query, context)
        
        # Generate response
        response = model.generate_content(prompt)
        
        return jsonify({
            'success': True,
            'response': response.text,
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

@app.route('/api/chatbot/analyze', methods=['POST'])
def analyze_data():
    """Analyze specific data patterns"""
    try:
        if not model:
            return jsonify({
                'success': False,
                'error': 'Gemini AI not configured'
            }), 500
        
        data = request.get_json()
        analysis_type = data.get('type', 'general')
        context = get_emergency_context()
        
        analysis_prompts = {
            'hotspots': f"""
            Analyze the emergency call data to identify crime hotspots and high-risk areas.
            Focus on location patterns, frequency, and severity.
            Data: {json.dumps(context['data'], indent=2)}
            """,
            'trends': f"""
            Analyze trends in emergency calls including timing, types, and response patterns.
            Data: {json.dumps(context['data'], indent=2)}
            """,
            'efficiency': f"""
            Analyze the efficiency of emergency response including response times and resource allocation.
            Data: {json.dumps(context['data'], indent=2)}
            """,
            'predictions': f"""
            Based on current data, predict potential future emergency patterns and suggest preventive measures.
            Data: {json.dumps(context['data'], indent=2)}
            """
        }
        
        prompt = analysis_prompts.get(analysis_type, analysis_prompts['general'])
        response = model.generate_content(prompt)
        
        return jsonify({
            'success': True,
            'analysis': response.text,
            'type': analysis_type,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Error in analysis: {str(e)}'
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
        'gemini_configured': model is not None,
        'timestamp': datetime.now().isoformat()
    })

if __name__ == '__main__':
    print("🤖 Starting Gemini Chatbot API Server...")
    print("🌐 Server running on http://localhost:5001")
    print("📡 API endpoints:")
    print("   - POST /api/chatbot/chat (Main chat endpoint)")
    print("   - POST /api/chatbot/analyze (Data analysis)")
    print("   - GET /api/chatbot/context (System context)")
    print("   - GET /api/chatbot/health (Health check)")
    
    app.run(debug=True, host='0.0.0.0', port=5001)
