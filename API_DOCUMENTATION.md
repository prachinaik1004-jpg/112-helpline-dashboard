# 112 Goa Emergency Response System - API Documentation

## Overview
This is a comprehensive backend system for the 112 Goa Emergency Response System, featuring AI-powered call classification, SQLite database integration, and advanced analytics.

## Features
- 🤖 **AI-Powered Classification**: Automatic urgency classification of emergency calls
- 🗄️ **SQLite Database**: Efficient data storage and retrieval
- 📊 **Advanced Analytics**: Comprehensive reporting and trend analysis
- 🔍 **Search Functionality**: Multi-criteria search across all data
- 📈 **Real-time Statistics**: Live dashboard metrics
- 🚨 **Emergency Alerts**: Prioritized alert system

## Setup Instructions

### Prerequisites
- Python 3.7+
- pip (Python package manager)

### Installation
1. Install required dependencies:
```bash
pip install -r requirements.txt
```

2. Run the enhanced backend:
```bash
python backend.py
```

The server will start on `http://localhost:5000`

## API Endpoints

### 1. Emergency Alerts
**GET** `/api/alerts`

Get emergency alerts with filtering and pagination.

**Query Parameters:**
- `limit` (int, optional): Number of alerts to return (default: 100)
- `offset` (int, optional): Number of alerts to skip (default: 0)
- `urgency` (string, optional): Filter by urgency level ("High" or "Normal")
- `station` (string, optional): Filter by police station name

**Example Request:**
```
GET /api/alerts?limit=50&urgency=High&station=PANJIM
```

**Response:**
```json
{
  "success": true,
  "alerts": [
    {
      "id": "284749",
      "type": "emergency",
      "EVENT_MAIN_TYPE": "FIGHTING AND ASSAULT",
      "summary": "AS PER LADY CALLER SWETA GAONKAR INFORMED THAT FIGHTING IS GOING ON...",
      "urgency": 95,
      "classification": "High",
      "transcript": "AS PER LADY CALLER SWETA GAONKAR INFORMED THAT FIGHTING IS GOING ON AT NEAR KELBAI TEMPLE MAYEM",
      "location": "BICHOLIM",
      "timestamp": "2025-03-16T12:32:28",
      "caller_phone": "100",
      "duration": 770,
      "notes": "OK.",
      "caller_name": "JEREMY",
      "call_sign": "N_Robot-23",
      "response_time": "00h:12m:50s"
    }
  ],
  "total_count": 50,
  "high_urgency_count": 15,
  "timestamp": "2025-01-27T10:30:00"
}
```

### 2. Alert Details
**GET** `/api/alerts/<call_id>`

Get detailed information for a specific call.

**Path Parameters:**
- `call_id` (string): The event ID or call ID

**Example Request:**
```
GET /api/alerts/284749
```

**Response:**
```json
{
  "success": true,
  "call": {
    "id": "284749",
    "type": "emergency",
    "EVENT_MAIN_TYPE": "FIGHTING AND ASSAULT",
    "urgency": 95,
    "classification": "High",
    "transcript": "AS PER LADY CALLER SWETA GAONKAR INFORMED THAT FIGHTING IS GOING ON AT NEAR KELBAI TEMPLE MAYEM",
    "location": "BICHOLIM",
    "timestamp": "2025-03-16T12:32:28",
    "caller_phone": "100",
    "duration": 770,
    "notes": "OK.",
    "caller_name": "JEREMY",
    "call_sign": "N_Robot-23",
    "response_time": "00h:12m:50s",
    "action_taken": "PSI AKASH",
    "assignment_delay": "0 days 00:07:39",
    "delivery_time": "0 days 00:00:00.479000",
    "sentiment": "panic"
  }
}
```

### 3. Statistics
**GET** `/api/stats`

Get comprehensive statistics and analytics.

**Response:**
```json
{
  "success": true,
  "total_calls": 67766,
  "high_urgency_calls": 15234,
  "urgency_percentage": 22.47,
  "station_stats": [
    {
      "station": "PANJIM PS",
      "count": 1234
    },
    {
      "station": "MAPUSA PS",
      "count": 987
    }
  ],
  "event_type_stats": [
    {
      "type": "FIGHTING AND ASSAULT",
      "count": 5432
    },
    {
      "type": "ACCIDENT",
      "count": 3210
    }
  ],
  "daily_trends": [
    {
      "date": "2025-01-27",
      "count": 45
    },
    {
      "date": "2025-01-26",
      "count": 52
    }
  ],
  "avg_response_time_seconds": 420,
  "timestamp": "2025-01-27T10:30:00"
}
```

### 4. Trend Analysis
**GET** `/api/analytics/trends`

Get detailed trend analysis including hourly and weekly distributions.

**Response:**
```json
{
  "success": true,
  "hourly_distribution": [
    {
      "hour": 0,
      "count": 123
    },
    {
      "hour": 1,
      "count": 98
    }
  ],
  "weekly_distribution": [
    {
      "day": 0,
      "count": 1234
    },
    {
      "day": 1,
      "count": 1456
    }
  ],
  "timestamp": "2025-01-27T10:30:00"
}
```

### 5. Search
**GET** `/api/search`

Search calls by various criteria.

**Query Parameters:**
- `q` (string, optional): Search query for transcript, caller name, or event ID
- `station` (string, optional): Filter by police station
- `event_type` (string, optional): Filter by event type
- `date_from` (string, optional): Start date (YYYY-MM-DD)
- `date_to` (string, optional): End date (YYYY-MM-DD)
- `limit` (int, optional): Maximum results (default: 50)

**Example Request:**
```
GET /api/search?q=fighting&station=PANJIM&event_type=FIGHTING AND ASSAULT&limit=20
```

**Response:**
```json
{
  "success": true,
  "results": [
    {
      "id": "284749",
      "type": "emergency",
      "summary": "AS PER LADY CALLER SWETA GAONKAR INFORMED THAT FIGHTING IS GOING ON...",
      "urgency": 95,
      "classification": "High",
      "location": "BICHOLIM",
      "timestamp": "2025-03-16T12:32:28",
      "caller_name": "JEREMY",
      "event_type": "FIGHTING AND ASSAULT"
    }
  ],
  "total_found": 20,
  "query": "fighting",
  "timestamp": "2025-01-27T10:30:00"
}
```

### 6. Raw Data
**GET** `/data`

Get raw CSV data as JSON (limited to 1000 most recent records).

**Response:**
```json
[
  {
    "id": 1,
    "sl_no": 1,
    "create_time": "2025-03-16T12:32:28",
    "signal_type": "VOICE CALL",
    "event_id": "284749",
    "dialled_no": "100",
    "caller_name": "JEREMY",
    "event_main_type": "FIGHTING AND ASSAULT",
    "event_information": "AS PER LADY CALLER SWETA GAONKAR INFORMED THAT FIGHTING IS GOING ON AT NEAR KELBAI TEMPLE MAYEM",
    "police_station_name": "BICHOLIM",
    "urgency_score": 95,
    "classification": "High",
    "call_type": "emergency"
  }
]
```

### 7. Health Check
**GET** `/api/health`

Check system health and database connectivity.

**Response:**
```json
{
  "status": "healthy",
  "database": "connected",
  "total_calls": 67766,
  "timestamp": "2025-01-27T10:30:00"
}
```

## Data Classification

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

## Database Schema

### emergency_calls Table
- `id`: Primary key
- `sl_no`: Serial number from CSV
- `create_time`: Call creation timestamp
- `signal_type`: Type of signal (VOICE CALL, etc.)
- `event_id`: Unique event identifier
- `dialled_no`: Dialed number
- `caller_name`: Name of caller
- `event_main_type`: Main event category
- `event_information`: Call transcript/details
- `police_station_name`: Assigned police station
- `urgency_score`: AI-calculated urgency score (0-100)
- `classification`: High/Normal urgency classification
- `call_type`: Type of call (emergency/panic/silence/prank)

## Error Handling

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

## Performance Notes

- Database queries are optimized with indexes
- Pagination is implemented for large datasets
- Caching is recommended for production deployment
- SQLite database provides good performance for this dataset size

## Security Considerations

- CORS is enabled for frontend integration
- Input validation is performed on all parameters
- SQL injection protection through parameterized queries
- Error messages don't expose sensitive information

## Monitoring

Use the `/api/health` endpoint for system monitoring and the `/api/stats` endpoint for performance metrics.

## Support

For technical support or questions about the API, please refer to the system logs or contact the development team.
