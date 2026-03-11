# 112 Goa Emergency Response System

## AI-Powered Alerts & Anomaly Detection

This system provides real-time AI-powered classification and prioritization of emergency calls for the 112 Goa Emergency Response Center.

### Features

🤖 **AI-Powered Classification**
- Keyword-based urgency analysis
- Automatic panic/silence/prank detection
- Numerical urgency scoring (10-99)
- Real-time call prioritization

🚨 **Emergency Call Management**
- Live call queue sorted by AI urgency
- Detailed call transcripts and analysis
- Location tracking and timestamps
- Officer notes and response outcomes

📊 **Anomaly Dashboard**
- Prank call filtering statistics
- Area-based incident spikes
- Real-time analytics and trends

### Quick Start

1. **Install Python Dependencies**
   ```bash
   pip install -r requirements.txt
   ```

2. **Start the Backend API Server**
   ```bash
   python app.py
   ```
   Server will run on `http://localhost:5000`

3. **Open the Frontend**
   Open `alert.html` in your web browser

### API Endpoints

- `GET /api/alerts` - Fetch AI-sorted emergency calls
- `GET /api/alerts/<call_id>` - Get detailed call information  
- `GET /api/stats` - Dashboard statistics

### AI Classification Logic

The system analyzes call transcripts using keyword-based AI:

**High Urgency Keywords:**
- help, emergency, scared, following, hurt, fighting
- attack, assault, danger, threat, violence, weapon
- kidnap, robbery, fire, accident, blood, injured

**Prank Detection:**
- joke, kidding, prank, dare, friend, testing
- haha, funny, laugh, just kidding

**Silent Call Handling:**
- Treats silent calls as high urgency (potential coercion)
- Analyzes call duration and patterns

### Usage

1. The system automatically loads and displays AI-sorted emergency calls
2. Click on any call in the queue to view detailed information
3. Use category filters to focus on specific call types
4. Monitor real-time statistics in the anomaly dashboard

### Technology Stack

- **Backend:** Python Flask with AI classification
- **Frontend:** Vanilla JavaScript with real-time API integration
- **Styling:** Modern CSS with responsive design
- **Data:** Real-time emergency call simulation

---

**🚨 112 Goa Emergency Response System - Protecting Citizens with AI Technology**

---

# 112 Analytics & Chatbot — Setup Guide

A complete guide to set up, run, and use the 112 Analytics dashboard and AI chatbot on your machine.

## Overview

- Backend API: `chatbotfiles/chatbot-server.js` (Node.js + Express)
- Frontend UI: static HTML pages (e.g., `dash.html`, `hot_updated.html`, `ride.html`, `temp.html`, `set.html`, `add.html`, `log.html`)
- Chatbot Widget: `static/js/chatbot-widget.js` + `chatbotfiles/chatbot.js`
- Dataset: CSV files such as `dataset.csv`, `112_calls_only.csv`, or `cleaned_ALL_DATA_IN_DETAIL.csv`

The chatbot answers natural-language questions about your 112 calls dataset. It can either use simple rule-based logic or call Google Gemini for richer analysis.

## Features

- Auto-detects dataset file (`112_calls_only.csv` or `dataset.csv`) from common locations.
- Robust CSV parsing with PapaParse (handles quoted, multi-line fields).
- Date filtering by single date or range (supports multiple date formats).
- Greeting handling for “hi/hey/hello” with helpful examples.
- Health and context endpoints for quick debugging.
- Floating chatbot widget you can add to any page.

## Requirements

- Node.js v18+ (v20+ recommended)
- npm (bundled with Node)
- A Google Gemini API Key (optional, for AI responses)

## Directory structure (key files)

```
project/
├─ chatbotfiles/
│  ├─ chatbot-server.js     # Express API server
│  └─ chatbot.js            # Frontend Chatbot core (loaded by widget)
├─ static/
│  ├─ js/
│  │  └─ chatbot-widget.js  # Injects floating chat UI
│  └─ css/
│     └─ chatbot-widget.css # Widget styles
├─ dash.html                # Dashboard (includes widget)
├─ hot_updated.html         # Hotspots page (widget removed)
├─ set.html                 # Settings
├─ add.html                 # Add new entry page
├─ log.html                 # Login page (landing)
├─ index.html               # Redirects to log.html
├─ dataset.csv              # Example dataset (place here)
└─ README.md                # You are here
```

## Install dependencies

If you do not have a `package.json`, install directly:

```bash
# From the project root
npm install express cors papaparse @google/generative-ai
```

Optional dev tools:

```bash
npm install --save-dev nodemon
```

## Configure the Gemini API key (optional)

1) Create an API key at Google AI Studio:
   - Sign in: https://aistudio.google.com/
   - Go to Keys and create a new API key.

2) Set the environment variable before starting the server:

- Windows (Command Prompt):
```bat
set GEMINI_API_KEY=YOUR_KEY_HERE
```

- PowerShell:
```powershell
$env:GEMINI_API_KEY="YOUR_KEY_HERE"
```

- macOS/Linux (bash/zsh):
```bash
export GEMINI_API_KEY=YOUR_KEY_HERE
```

If `GEMINI_API_KEY` is not set, the server runs in “Simple Mode” (no external AI calls). It will still answer some questions using rule-based summaries.

## Place your dataset

Put one of these files in the project root:
- `112_calls_only.csv`
- `dataset.csv`

The server auto-discovers them from:
- Project root (`./`)
- `./static/data/`
- `./data/`

PapaParse is used (if installed) to correctly parse quoted/multi-line CSV fields. If you see odd parsing, ensure PapaParse is installed:

```bash
npm install papaparse
```

## Start the backend server

From the project root:

```bash
node chatbotfiles\chatbot-server.js   # Windows
# or
node chatbotfiles/chatbot-server.js    # macOS/Linux
```

Expected output:

```
🤖 Chatbot API Server running on http://localhost:5050
📡 API endpoints:
   - POST /api/chatbot/chat (Main chat endpoint)
   - GET /api/chatbot/context (System context)
   - GET /api/chatbot/health (Health check)
[chatbot] Using dataset file: C:\...\dataset.csv
```

Health check:

- http://localhost:5050/api/chatbot/health

You should see JSON with `gemini_configured` and `data_source`.

## Run the frontend

You can open HTML files directly in a browser. For full functionality (e.g., relative fetches or modern browser restrictions), we recommend serving files over HTTP:

- Python (any OS):
```bash
python -m http.server 8000
```
Open: http://localhost:8000/dash.html

- Node http-server (if installed):
```bash
npx http-server -p 8000
```

## API usage (curl)

- Health
```bash
curl http://localhost:5050/api/chatbot/health
```

- Context
```bash
curl http://localhost:5050/api/chatbot/context
```

- Chat (ask a question)
```bash
curl -X POST http://localhost:5050/api/chatbot/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "For 2025-03-16, total calls and top 3 event types. Show 3 sample records."
  }'
```

Expected JSON response contains `response` and `context_used`.

## Embedding the chatbot widget in a page

Add the widget script at the end of the `<body>` (pages like `dash.html` already include it):

```html
<script src="static/js/chatbot-widget.js"></script>
```

The widget will:
- Inject a floating button (💬) and a panel
- Lazy-load the core `chatbotfiles/chatbot.js`
- Show the welcome message you configured in `static/js/chatbot-widget.js`

Ensure the backend is running at `http://localhost:5050`. If you changed the port or host, update `chatbotfiles/chatbot.js` where `this.apiBaseUrl` is set.

## Authentication (demo)

- Landing page: `index.html` redirects to `log.html`.
- Demo credentials (enforced in `log.js`):
  - Username: `admin`
  - Password: `112goa`

On success, you are redirected to `dash.html`.

## Date filtering and logs

When you ask date-scoped questions (e.g., `2025-03-16` or ranges), the server logs:

- Detected columns mapping (once per request)
- Date filter summary with matched rows, e.g.:

```
[chatbot] Date filter applied: 2025-03-16. Matched rows: N
```

Accepted date formats in queries:
- `YYYY-MM-DD`
- `DD-MM-YYYY`, `DD/MM/YYYY`
- `MM/DD/YYYY`

## Greeting behavior

- Greetings like `hi`, `hey`, `hello`, including elongated forms like `heyyy` are handled by the server before calling Gemini.
- The chatbot replies with a short capability prompt and two example questions.

## Troubleshooting

- **EADDRINUSE: address already in use :5050**
  - Another process is using port 5050. Either kill it or change the port.
  - Find PID on Windows:
    ```bat
    netstat -ano | findstr :5050
    taskkill /PID <PID> /F
    ```
  - Or change the port in `chatbotfiles/chatbot-server.js` and update any frontend references.

- **GET http://localhost:5050/ shows "Cannot GET /"**
  - Expected. The server exposes API endpoints only. Use `/api/chatbot/health`.

- **No call data available / 0 matched rows**
  - Ensure the dataset file is present (`112_calls_only.csv` or `dataset.csv`) in the project root.
  - Confirm column names like `CREATE_TIME` exist. The server tries `create_time`, `time`, `timestamp`, `created_at` (case-insensitive). If your header is different, update aliases.
  - Install PapaParse for proper parsing of quoted/multi-line CSV fields:
    ```bash
    npm install papaparse
    ```

- **Widget doesn’t appear**
  - Ensure your page includes: `<script src="static/js/chatbot-widget.js"></script>`
  - Ensure `static/css/chatbot-widget.css` loads (it’s auto-injected by the widget script).

- **Greeting still returns a long summary**
  - Restart the server to load the latest logic.
  - Hard refresh the page (Ctrl/Cmd+Shift+R).

## Customization tips

- **Welcome message**: edit in `static/js/chatbot-widget.js` within `injectWidget()` where the initial bot message is defined.
- **Greeting reply text**: edit in `chatbotfiles/chatbot-server.js` (both `isGreeting()` handling in the route and the `generateSimpleResponse()` case).
- **Dataset name/locations**: tweak `getDatasetPath()` in `chatbotfiles/chatbot-server.js`.
- **Mask phone numbers**: add masking in the code where `extras.sample_records` are prepared.

## Security notes

- Do not hardcode the Gemini API key in files. Use environment variables (`GEMINI_API_KEY`).
- This repo uses demo login credentials for convenience. Replace with a proper auth mechanism for production.

## FAQ

- **Do I need a Gemini API key to use the chatbot?**
  - No. Without a key, the server runs in Simple Mode and returns rule-based answers. With a key, Gemini produces richer responses from the computed summaries.

- **Where do I put my CSV?**
  - Project root (recommended). The server will log which path is used.

- **Which pages include the chatbot?**
  - `dash.html` and others using `static/js/chatbot-widget.js`. `hot_updated.html` explicitly does not include it.

- **How do I change the port?**
  - Edit `const PORT = 5050;` in `chatbotfiles/chatbot-server.js` and update any frontend hardcoded URLs.

---

If you run into issues, open the browser Console and the server terminal logs. Share the "Detected columns" and "Date filter applied" lines if you need help debugging dataset mappings.
