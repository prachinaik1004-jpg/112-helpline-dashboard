# 112 Goa Emergency Response System - Backend

## 🚨 Overview
A comprehensive backend system for the 112 Goa Emergency Response System featuring AI-powered call classification, SQLite database integration, and advanced analytics.

## ✨ Features
- 🤖 **AI-Powered Classification**: Automatic urgency classification of emergency calls
- 🗄️ **SQLite Database**: Efficient data storage and retrieval with indexing
- 📊 **Advanced Analytics**: Comprehensive reporting and trend analysis
- 🔍 **Search Functionality**: Multi-criteria search across all data
- 📈 **Real-time Statistics**: Live dashboard metrics
- 🚨 **Emergency Alerts**: Prioritized alert system
- 🔄 **Data Processing**: Automatic CSV data loading and processing
- 🏥 **Health Monitoring**: System health checks and monitoring

## 🚀 Quick Start

### Prerequisites
- Python 3.7 or higher
- pip (Python package manager)

### Installation & Setup

1. **Install Dependencies**
   ```bash
   pip install -r requirements.txt
   ```

2. **Start the Backend**
   ```bash
   python start_backend.py
   ```
   
   Or run directly:
   ```bash
   python backend.py
   ```

3. **Test the Backend**
   ```bash
   python test_backend.py
   ```

The server will start on `http://localhost:5000`

## 📁 File Structure

```
├── backend.py              # Main backend application
├── start_backend.py        # Startup script with checks
├── test_backend.py         # Test script for API endpoints
├── requirements.txt        # Python dependencies
├── API_DOCUMENTATION.md    # Complete API documentation
├── BACKEND_README.md       # This file
├── emergency_data.db       # SQLite database (created automatically)
└── cleaned_ALL_DATA_IN_DETAIL.csv  # Source data file
```

## 🔧 Configuration

### Environment Variables
- `FLASK_ENV`: Set to `production` for production deployment
- `DATABASE_URL`: Override default database path
- `CSV_PATH`: Override default CSV file path

### Database Configuration
The system automatically creates a SQLite database (`emergency_data.db`) with the following tables:
- `emergency_calls`: Main data table with all call information
- `analytics`: Performance metrics and analytics data

## 📊 API Endpoints

### Core Endpoints
- `GET /api/alerts` - Get emergency alerts with filtering
- `GET /api/alerts/<id>` - Get detailed call information
- `GET /api/stats` - Get comprehensive statistics
- `GET /api/analytics/trends` - Get trend analysis
- `GET /api/search` - Search calls by criteria
- `GET /data` - Get raw data (JSON)
- `GET /api/health` - Health check

### Query Parameters
- `limit`: Number of results to return
- `offset`: Number of results to skip
- `urgency`: Filter by urgency level (High/Normal)
- `station`: Filter by police station
- `q`: Search query
- `date_from`/`date_to`: Date range filters

## 🤖 AI Classification System

### Urgency Classification
The system automatically classifies calls into two urgency levels:

**High Urgency (Score: 60-95):**
- Contains emergency keywords (help, emergency, fighting, assault, etc.)
- Event types: FIGHTING AND ASSAULT, ACCIDENT
- Short response times or critical situations
- Suspected coercion or silent calls

**Normal Urgency (Score: 10-30):**
- Routine calls or non-emergency situations
- Event types: NUISANCE OR MISCHIEF, OTHERS
- Prank calls or false alarms

### Call Types
- **emergency**: High-priority emergency situations
- **panic**: Distressed callers requiring immediate attention
- **silence**: Silent calls or potential coercion situations
- **prank**: Non-serious or false alarm calls

## 📈 Analytics Features

### Statistics Available
- Total call count
- High urgency call count and percentage
- Calls by police station
- Calls by event type
- Daily call trends
- Average response times
- Hourly and weekly distributions

### Search Capabilities
- Full-text search across transcripts
- Filter by police station
- Filter by event type
- Date range filtering
- Caller name search

## 🗄️ Database Schema

### emergency_calls Table
```sql
CREATE TABLE emergency_calls (
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
);
```

## 🔍 Usage Examples

### Get High Urgency Alerts
```bash
curl "http://localhost:5000/api/alerts?urgency=High&limit=10"
```

### Search for Fighting Incidents
```bash
curl "http://localhost:5000/api/search?q=fighting&event_type=FIGHTING AND ASSAULT"
```

### Get Statistics
```bash
curl "http://localhost:5000/api/stats"
```

### Health Check
```bash
curl "http://localhost:5000/api/health"
```

## 🚨 Error Handling

All endpoints return consistent error responses:
```json
{
  "success": false,
  "error": "Error message description"
}
```

Common HTTP status codes:
- `200`: Success
- `400`: Bad Request
- `404`: Not Found
- `500`: Internal Server Error

## 🔧 Development

### Running in Development Mode
```bash
python backend.py
```

### Running Tests
```bash
python test_backend.py
```

### Database Management
The database is automatically created and populated on first run. To reset:
1. Delete `emergency_data.db`
2. Restart the backend

## 📊 Performance

### Optimization Features
- Database indexes on frequently queried columns
- Pagination for large datasets
- Efficient SQL queries
- Connection pooling (in production)

### Recommended Production Setup
- Use a production WSGI server (gunicorn, uWSGI)
- Implement Redis caching for frequently accessed data
- Use PostgreSQL for larger datasets
- Set up monitoring and logging

## 🔒 Security

### Security Features
- CORS enabled for frontend integration
- Input validation on all parameters
- SQL injection protection via parameterized queries
- Error messages don't expose sensitive information

### Production Security Recommendations
- Use HTTPS in production
- Implement authentication/authorization
- Rate limiting for API endpoints
- Input sanitization
- Regular security updates

## 📝 Logging

The system includes comprehensive logging:
- Application startup/shutdown
- Database operations
- API requests and responses
- Error tracking
- Performance metrics

## 🆘 Troubleshooting

### Common Issues

1. **CSV file not found**
   - Ensure `cleaned_ALL_DATA_IN_DETAIL.csv` is in the project directory
   - Check file permissions

2. **Database errors**
   - Delete `emergency_data.db` and restart
   - Check disk space

3. **Port already in use**
   - Change port in `backend.py` (line 335)
   - Kill existing processes on port 5000

4. **Import errors**
   - Run `pip install -r requirements.txt`
   - Check Python version (3.7+)

### Debug Mode
Set `debug=True` in `backend.py` for detailed error messages and auto-reload.

## 📞 Support

For technical support or questions:
1. Check the API documentation
2. Run the test script to verify functionality
3. Check the logs for error messages
4. Ensure all dependencies are installed

## 🔄 Updates

To update the system:
1. Stop the backend
2. Update the code
3. Restart the backend
4. Run tests to verify functionality

## 📋 TODO

Future enhancements:
- [ ] Real-time WebSocket updates
- [ ] Advanced machine learning models
- [ ] Geographic data integration
- [ ] Mobile app API
- [ ] Advanced reporting dashboard
- [ ] Data export functionality
- [ ] Backup and recovery system
