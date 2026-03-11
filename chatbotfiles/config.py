# Configuration file for the chatbot
import os

# Gemini API Configuration
GEMINI_API_KEY = "AIzaSyBLSNfG15FdrhGjCxG-hNCreusSMVTvGYU"

# Server Configuration
NODE_PORT = 3000
FLASK_PORT = 5000

# Chatbot Configuration
CHATBOT_MODEL = "gemini-1.5-flash"
MAX_CONVERSATION_HISTORY = 10

# Set environment variable for the chatbot
os.environ['GEMINI_API_KEY'] = GEMINI_API_KEY
