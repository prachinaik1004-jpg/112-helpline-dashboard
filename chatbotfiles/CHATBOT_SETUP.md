# Gemini Chatbot Integration Setup Guide

## Overview
This guide will help you integrate a Gemini AI chatbot into your 112 Goa Emergency Response System. The chatbot can analyze emergency data, provide insights, and help with decision-making.

## Prerequisites
- Node.js (v14 or higher)
- Python 3.7 or higher
- Google Cloud account with Gemini API access

## Step 1: Get Gemini API Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the generated API key

## Step 2: Environment Setup

1. Copy the example environment file:
   ```bash
   cp env.example .env
   ```

2. Edit `.env` file and add your Gemini API key:
   ```
   GEMINI_API_KEY=your_actual_api_key_here
   ```

## Step 3: Install Dependencies

### Node.js Dependencies
```bash
npm install
```

### Python Dependencies
```bash
pip install -r requirements.txt
```

## Step 4: Start the Services

### Terminal 1: Start the Main Application
```bash
npm start
```
This starts the main Node.js server on port 3000.

### Terminal 2: Start the Flask API
```bash
python app.py
```
This starts the Flask API server on port 5000.

### Terminal 3: Start the Chatbot API
```bash
python chatbot.py
```
This starts the chatbot API server on port 5001.

## Step 5: Access the Application

1. Open your browser and go to `http://localhost:3000`
2. Login with credentials: `admin` / `112goa`
3. Navigate to "AI Assistant" from the dashboard or main menu

## Features

### Chatbot Capabilities
- **Data Analysis**: Analyze emergency call patterns and trends
- **Hotspot Identification**: Identify high-risk areas and crime hotspots
- **Response Time Analysis**: Analyze and suggest improvements for response times
- **Predictive Insights**: Provide predictions based on historical data
- **Report Generation**: Generate summary reports and insights
- **Context Awareness**: Understands current system status and data

### Sample Queries
- "Show me today's emergency hotspots"
- "Analyze response time trends"
- "What are the current high-priority alerts?"
- "Generate a summary report"
- "Which areas need more police presence?"
- "What patterns do you see in women's safety calls?"

## API Endpoints

### Chatbot API (Port 5001)
- `POST /api/chatbot/chat` - Main chat endpoint
- `POST /api/chatbot/analyze` - Data analysis endpoint
- `GET /api/chatbot/context` - Get system context
- `GET /api/chatbot/health` - Health check

### Main API (Port 5000)
- `GET /api/alerts` - Get emergency alerts
- `GET /api/stats` - Get statistics

## Configuration

### Environment Variables
- `GEMINI_API_KEY`: Your Gemini API key
- `NODE_PORT`: Node.js server port (default: 3000)
- `FLASK_PORT`: Flask API port (default: 5000)
- `CHATBOT_MODEL`: Gemini model to use (default: gemini-1.5-flash)

### Customizing the Chatbot
1. Edit `chatbot.py` to modify the system prompt and capabilities
2. Update `MOCK_EMERGENCY_DATA` with your actual data source
3. Modify the context in `get_emergency_context()` function

## Troubleshooting

### Common Issues

1. **"Gemini AI not configured" error**
   - Check if your API key is correctly set in `.env`
   - Verify the API key is valid and has proper permissions

2. **Connection errors**
   - Ensure all three servers are running
   - Check if ports 3000, 5000, and 5001 are available
   - Verify firewall settings

3. **CORS errors**
   - The chatbot API has CORS enabled
   - If you encounter issues, check browser console for specific errors

### Testing the Integration

1. **Test API connectivity**:
   ```bash
   curl http://localhost:5001/api/chatbot/health
   ```

2. **Test chat functionality**:
   ```bash
   curl -X POST http://localhost:5001/api/chatbot/chat \
     -H "Content-Type: application/json" \
     -d '{"message": "Hello, can you analyze today'\''s data?"}'
   ```

## Security Considerations

1. **API Key Security**: Never commit your API key to version control
2. **Environment Variables**: Use `.env` file and add it to `.gitignore`
3. **Network Security**: Consider using HTTPS in production
4. **Rate Limiting**: Implement rate limiting for production use

## Production Deployment

1. **Environment Variables**: Set production environment variables
2. **HTTPS**: Use HTTPS for all API endpoints
3. **Authentication**: Implement proper authentication for the chatbot API
4. **Monitoring**: Add logging and monitoring
5. **Scaling**: Consider using a reverse proxy like Nginx

## Support

For issues or questions:
1. Check the console logs for error messages
2. Verify all dependencies are installed correctly
3. Ensure all services are running on the correct ports
4. Check the browser's developer console for client-side errors

## Next Steps

1. **Data Integration**: Connect to your actual emergency data source
2. **Custom Training**: Fine-tune the chatbot for your specific use case
3. **Advanced Features**: Add voice input, image analysis, or real-time data streaming
4. **Mobile App**: Create a mobile version of the chatbot interface
