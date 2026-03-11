const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 5050;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

// Middleware
app.use(cors());
app.use(express.json());

// Mock data for context
const MOCK_EMERGENCY_DATA = {
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
};

// Try to build live context from dataset.csv
function safeRequire(moduleName) {
    try { return require(moduleName); } catch { return null; }
}

function parseCSVText(text) {
    const Papa = safeRequire('papaparse');
    if (Papa && Papa.parse) {
        const res = Papa.parse(text, { header: true, skipEmptyLines: true, dynamicTyping: false });
        return res.data || [];
    }
    // Fallback very basic parser (may not handle all quoted commas)
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (!lines.length) return [];
    const headers = lines[0].split(',');
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',');
        const row = {};
        headers.forEach((h, idx) => row[h] = cols[idx]);
        rows.push(row);
    }
    return rows;
}

function getDatasetPath() {
    // Try several common locations
    const names = ['112_calls_only.csv', 'dataset.csv'];
    const roots = [
        process.cwd(),
        path.join(__dirname, '..'),
        path.join(process.cwd(), 'static', 'data'),
        path.join(process.cwd(), 'data')
    ];
    const candidates = [];
    for (const root of roots) {
        for (const name of names) {
            candidates.push(path.join(root, name));
        }
    }
    for (const p of candidates) {
        if (fs.existsSync(p)) {
            console.log(`[chatbot] Using dataset file: ${p}`);
            return p;
        }
    }
    console.warn('[chatbot] dataset.csv not found in expected locations');
    // Default to first path for downstream messages
    return candidates[0];
}

function buildStatsFromRows(rows) {
    const lower = s => (s || '').toString().toLowerCase();
    const headers = rows.length ? Object.keys(rows[0]) : [];
    const findCol = (cands) => headers.find(h => cands.includes(lower(h)));

    const eventTypeCol = findCol(['event_main_type','event type','event_type','event']);
    const infoCol = findCol(['event_information','description','details']);
    const stationCodeCol = findCol(['police_station_name','police station name','police_station','police station','ps','p.s.','police station (name)','police_station (name)','police_station','station']);
    const stationNameCol = findCol(['name of police station','name of polcie station','police station (name)','police_station (name)','police_station_name']);
    const callerNameCol = findCol(['caller_name','name','caller']);
    const dialledNoCol = findCol(['dialledno','dialedno','dialled_no','dialled no','contact_no','phone','mobile']);
    const actionTakenCol = findCol(['action taken','action_taken','action','action taken at dcc','action_taken_at_dcc','action @ dcc','action at dcc']);
    const closureCommentsCol = findCol(['closure comments','closure_comments','closure remark','closure_remarks','remarks','remark','comments']);

    // Debug mapping (one-line)
    console.log('[chatbot] Detected columns:', {
        eventTypeCol, infoCol,
        stationCodeCol, stationNameCol,
        callerNameCol, dialledNoCol, actionTakenCol, closureCommentsCol
    });

    // Aggregate across the entire dataset by default
    let total = 0;
    let women = 0;
    const byStation = {};
    const byEventType = {};

    rows.forEach(r => {
        total++;

        const et = lower(r[eventTypeCol]);
        const info = lower(r[infoCol]);
        if ((et && (et.includes('women') || et.includes('harassment') || et.includes('eve teasing'))) ||
            (info && (info.includes('lady') || info.includes('women') || info.includes('girl') || info.includes('female')))) {
            women++;
        }

        if (eventTypeCol) {
            const key = (r[eventTypeCol] || 'Unknown').toString().trim() || 'Unknown';
            byEventType[key] = (byEventType[key] || 0) + 1;
        }

        const stationRaw = (r[stationNameCol] || r[stationCodeCol] || '').toString();
        const station = stationRaw.replace(/\(.*?\)/g,'').trim() || 'Unknown';
        byStation[station] = (byStation[station] || 0) + 1;
    });

    // Top hotspots
    const hotspots = Object.entries(byStation)
        .sort((a,b)=>b[1]-a[1])
        .slice(0,5)
        .map(([name])=>name);

    // Top event types
    const topEventTypes = Object.entries(byEventType)
        .sort((a,b)=>b[1]-a[1])
        .slice(0,5)
        .map(([name,count])=>({ type: name, count }));

    // Sample records with key fields (max 5)
    const sample = rows.slice(0, 5).map(r => ({
        caller: callerNameCol ? r[callerNameCol] : undefined,
        dialed: dialledNoCol ? r[dialledNoCol] : undefined,
        event_type: eventTypeCol ? r[eventTypeCol] : undefined,
        info: infoCol ? r[infoCol] : undefined,
        action: actionTakenCol ? r[actionTakenCol] : undefined,
        station: stationNameCol ? r[stationNameCol] : (stationCodeCol ? r[stationCodeCol] : undefined),
        closure: closureCommentsCol ? r[closureCommentsCol] : undefined
    }));

    // Placeholders for advanced stats (can enhance later)
    const highUrgency = 0; // not present in dataset; requires inference rules
    const avgResp = 'N/A'; // compute if we map to response columns consistently

    return {
        recent_calls: [],
        statistics: {
            total_calls_today: total,
            women_safety_calls: women,
            high_urgency_calls: highUrgency,
            average_response_time: avgResp,
            hotspots: hotspots
        },
        trends: {
            calls_increase: 'N/A',
            peak_hours: 'N/A',
            most_common_type: 'N/A',
            response_time_trend: 'N/A'
        },
        extras: {
            top_event_types: topEventTypes,
            sample_records: sample
        }
    };
}

// Build stats for a provided date predicate
function buildStatsForPeriod(rows, dateCol, isInRange) {
    const lower = s => (s || '').toString().toLowerCase();
    const headers = rows.length ? Object.keys(rows[0]) : [];
    const findCol = (cands) => headers.find(h => cands.includes(lower(h)));

    const eventTypeCol = findCol(['event_main_type','event type','event_type','event']);
    const infoCol = findCol(['event_information','description','details']);
    const stationCol = findCol(['police_station_name','police station name','police_station','police station','ps','p.s.','police station (name)','police_station (name)','police_station']);
    const callerNameCol = findCol(['caller_name','name','caller']);
    const dialledNoCol = findCol(['dialledno','dialedno','dialled_no','dialled no','contact_no','phone','mobile']);
    const actionTakenCol = findCol(['action taken','action_taken','action']);
    const closureCommentsCol = findCol(['closure comments','closure_comments','closure remark','closure_remarks','remarks','remark','comments']);

    let total = 0;
    let women = 0;
    const byStation = {};
    const byEventType = {};
    const filtered = [];

    rows.forEach(r => {
        const ct = (r[dateCol] || '').toString();
        if (!isInRange(ct)) return;
        filtered.push(r);
        total++;
        const et = lower(r[eventTypeCol]);
        const info = lower(r[infoCol]);
        if ((et && (et.includes('women') || et.includes('harassment') || et.includes('eve teasing'))) ||
            (info && (info.includes('lady') || info.includes('women') || info.includes('girl') || info.includes('female')))) {
            women++;
        }
        const stationRaw = (r[stationCol] || '').toString();
        const station = stationRaw.replace(/\(.*?\)/g,'').trim() || 'Unknown';
        byStation[station] = (byStation[station] || 0) + 1;
        if (eventTypeCol) {
            const key = (r[eventTypeCol] || 'Unknown').toString().trim() || 'Unknown';
            byEventType[key] = (byEventType[key] || 0) + 1;
        }
    });

    const hotspots = Object.entries(byStation)
        .sort((a,b)=>b[1]-a[1])
        .slice(0,5)
        .map(([name])=>name);

    return {
        recent_calls: [],
        statistics: {
            total_calls_today: total,
            women_safety_calls: women,
            high_urgency_calls: 0,
            average_response_time: 'N/A',
            hotspots
        },
        trends: {
            calls_increase: 'N/A',
            peak_hours: 'N/A',
            most_common_type: 'N/A',
            response_time_trend: 'N/A'
        }
    };
}

// Extract date or range (YYYY-MM-DD) from user query
function extractDateRange(query) {
    const text = (query || '').toString();
    const re = /(\d{4}-\d{2}-\d{2})/g;
    const matches = [...text.matchAll(re)].map(m => m[1]);
    if (matches.length === 1) {
        const d = matches[0];
        return { kind: 'single', start: d, end: d, display: d };
    }
    if (matches.length >= 2) {
        const start = matches[0];
        const end = matches[1];
        return { kind: 'range', start, end, display: `${start} to ${end}` };
    }
    return null;
}

function makeDatePredicate(startStr, endStr) {
    // Normalize any date string in the cell to ISO 'YYYY-MM-DD' then compare lexicographically
    const start = startStr;
    const end = endStr;

    function normalizeToISODate(val) {
        const s = (val || '').toString().trim();
        if (!s) return '';
        // Try to detect 'YYYY-MM-DD' at beginning
        const m1 = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (m1) return `${m1[1]}-${m1[2]}-${m1[3]}`;
        // Try 'DD-MM-YYYY'
        const m2 = s.match(/^(\d{2})-(\d{2})-(\d{4})/);
        if (m2) return `${m2[3]}-${m2[2]}-${m2[1]}`;
        // Try 'DD/MM/YYYY'
        const m3 = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
        if (m3) return `${m3[3]}-${m3[2]}-${m3[1]}`;
        // Try 'MM/DD/YYYY'
        const m4 = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
        if (m4) return `${m4[3]}-${m4[1]}-${m4[2]}`;
        return '';
    }

    if (start === end) {
        return (cell) => normalizeToISODate(cell) === start;
    }
    // Inclusive range
    return (cell) => {
        const v = normalizeToISODate(cell);
        if (!v) return false;
        return v >= start && v <= end;
    };
}

function loadDatasetContext() {
    try {
        const csvPath = getDatasetPath();
        if (!fs.existsSync(csvPath)) {
            console.warn('[chatbot] dataset.csv not found; falling back to mock context');
            return null;
        }
        const text = fs.readFileSync(csvPath, 'utf8');
        const rows = parseCSVText(text);
        const data = buildStatsFromRows(rows);
        return {
            current_time: new Date().toISOString(),
            data,
            system_status: 'operational',
            active_operators: 3,
            source: path.basename(csvPath)
        };
    } catch (e) {
        console.error('[chatbot] Error loading dataset.csv:', e.message);
        return null;
    }
}

function getEmergencyContext() {
    const live = loadDatasetContext();
    if (live) return live;
    return {
        current_time: new Date().toISOString(),
        data: MOCK_EMERGENCY_DATA,
        system_status: 'operational',
        active_operators: 3,
        source: 'mock'
    };
}

// AI integration using Google Gemini
async function generateAIResponse(userQuery, context) {
    try {
        if (!GEMINI_API_KEY) return null; // no key -> let caller fallback

        // Use dynamic import to avoid requiring ESM at module top-level
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        // Build a concise system prompt with available context
        const stats = context?.data?.statistics || {};
        const trends = context?.data?.trends || {};
        const recent = context?.data?.recent_calls || [];
        const extras = context?.data?.extras || {};

        const systemPrompt = [
            'You are an analytics assistant for the 112 Emergency Response System in Goa.',
            'Use the provided context to answer the supervisor\'s question with clear, concise analysis and actionable insights.',
            'If you cite numbers, prefer those from context. If unknown, be transparent.',
            '',
            'Context Summary:',
            `- Total Calls (scope): ${stats.total_calls_today ?? 'Unknown'}`,
            `- Women\'s Safety Calls: ${stats.women_safety_calls ?? 'Unknown'}`,
            `- High Urgency Calls: ${stats.high_urgency_calls ?? 'Unknown'}`,
            `- Avg Response Time: ${stats.average_response_time ?? 'Unknown'}`,
            `- Hotspots: ${(stats.hotspots || []).join(', ') || 'Unknown'}`,
            `- Trends: Calls Increase: ${trends.calls_increase ?? 'Unknown'}, Peak Hours: ${trends.peak_hours ?? 'Unknown'}, Most Common Type: ${trends.most_common_type ?? 'Unknown'}, Response Time Trend: ${trends.response_time_trend ?? 'Unknown'}`,
            `- Recent Critical Examples: ${recent.slice(0,3).map(r => `${r.id} ${r.type} @ ${r.location} (urgency ${r.urgency})`).join(' | ') || 'None'}`,
            '',
            `Event-Type Summary: ${(extras.top_event_types||[]).map(x=>`${x.type} (${x.count})`).join(', ') || 'N/A'}`,
            'Sample Records (key fields):',
            ...(extras.sample_records||[]).map(s => `- Caller: ${s.caller||'-'}, Dialed: ${s.dialed||'-'}, Type: ${s.event_type||'-'}, Station: ${s.station||'-'}\n  Info: ${s.info||'-'}\n  Action: ${s.action||'-'}\n  Closure: ${s.closure||'-'}`),
            '',
            'Format your response with short bullet points and brief explanations. Avoid markdown headers. Use bold for key figures if needed.'
        ].join('\n');

        const prompt = [
            systemPrompt,
            '',
            'Supervisor\'s question:',
            userQuery,
        ].join('\n');

        const result = await model.generateContent(prompt);
        const text = result?.response?.text?.() || '';
        if (!text) return null;
        return text.trim();
    } catch (err) {
        console.error('Gemini error:', err?.message || err);
        return null; // let caller fallback to simple mode
    }
}

function isGreeting(text) {
    const t = (text || '').toString().trim().toLowerCase();
    // Accept elongated forms and simple variants, nothing else
    // Examples: hi, hiii, hey, heyy, heyyy, hello, yo, hola, namaste
    return /^(hi+|hey+|hello|yo|hola|namaste|namaskar|good\s*(morning|afternoon|evening))\s*[!.~]*$/i.test(t);
}

function generateSimpleResponse(userQuery, context) {
    const queryLower = userQuery.toLowerCase();

    // Small-talk: greetings
    if (isGreeting(userQuery)) {
        return `Hello! I’m an AI assistant ready to help you explore the 112 emergency calls dataset. What would you like to know?\n\nHere are two example questions to try:\n- Which event type had the most calls on 2025-03-16?\n- Top 5 hotspots for 2025-03-16.`;
    }

    // Small-talk: appreciation
    if (/(thank\s*you|thanks|ty)\b/i.test(userQuery)) {
        return `You’re welcome! If you’d like, ask me to summarize any date (YYYY-MM-DD) from your dataset.`;
    }

    // Small-talk: goodbye
    if (/(bye|goodbye|see\s*ya|see\s*you)\b/i.test(userQuery)) {
        return `Goodbye! I’m here whenever you need analytics support.`;
    }

    // Hotspots analysis
    if (queryLower.includes('hotspot') || queryLower.includes('hot spot') || 
        queryLower.includes('high risk') || queryLower.includes('dangerous') || 
        queryLower.includes('area')) {
        const hotspots = context.data.statistics.hotspots;
        return `**Current High-Risk Areas:**\n\n${hotspots.join(', ')}\n\n**Analysis:** These areas show increased emergency activity today. Panaji Market has the highest concentration of incidents, followed by Margao Residential area. Consider deploying additional patrol units to these locations.`;
    }
    
    // Response time analysis
    else if (queryLower.includes('response') || queryLower.includes('time') || 
             queryLower.includes('efficiency') || queryLower.includes('speed')) {
        const avgTime = context.data.statistics.average_response_time;
        const trend = context.data.trends.response_time_trend;
        return `**Response Time Analysis:**\n\n- Current Average: ${avgTime}\n- Trend: ${trend}\n- Benchmark: 5 minutes\n\n**Recommendations:** Response times are within acceptable limits. Continue current protocols and consider optimizing dispatch routes for faster response.`;
    }
    
    // High priority alerts
    else if (queryLower.includes('priority') || queryLower.includes('urgent') || 
             queryLower.includes('high') || queryLower.includes('critical') || 
             queryLower.includes('alert')) {
        const highUrgency = context.data.statistics.high_urgency_calls;
        const recentCalls = context.data.recent_calls;
        const urgentCalls = recentCalls.filter(call => call.urgency > 85);
        
        let response = `**High Priority Alerts:**\n\n- Total High Urgency Calls: ${highUrgency}\n\n**Recent Critical Incidents:**\n`;
        urgentCalls.slice(0, 3).forEach(call => {
            response += `- ${call.id}: ${call.type.charAt(0).toUpperCase() + call.type.slice(1)} in ${call.location} (Urgency: ${call.urgency})\n`;
        });
        
        return response + `\n**Action Required:** All high-priority calls are being actively monitored. Dispatch units are responding to critical incidents.`;
    }
    
    // Summary report
    else if (queryLower.includes('summary') || queryLower.includes('report') || 
             queryLower.includes('overview') || queryLower.includes('today')) {
        const stats = context.data.statistics;
        const trends = context.data.trends;
        
        return `**Daily Emergency Summary Report**\n\n**Statistics:**\n- Total Calls: ${stats.total_calls_today}\n- Women's Safety Calls: ${stats.women_safety_calls}\n- High Urgency Calls: ${stats.high_urgency_calls}\n- Average Response Time: ${stats.average_response_time}\n\n**Trends:**\n- Calls Increase: ${trends.calls_increase}\n- Peak Hours: ${trends.peak_hours}\n- Most Common Type: ${trends.most_common_type}\n\n**Status:** System operating normally with all calls being processed efficiently.`;
    }
    
    // Women's safety
    else if (queryLower.includes('women') || queryLower.includes('female') || 
             queryLower.includes('safety') || queryLower.includes('harassment')) {
        const womenCalls = context.data.statistics.women_safety_calls;
        const percentage = (womenCalls / context.data.statistics.total_calls_today * 100).toFixed(1);
        return `**Women's Safety Analysis:**\n\n- Today's Calls: ${womenCalls}\n- Percentage of Total: ${percentage}%\n\n**Patterns:** Most incidents occur in market areas and residential zones during evening hours. Consider increasing patrol presence in these areas during peak times.`;
    }
    
    // General help
    else {
        return `**AI Assistant Response:**\n\nI can help you analyze emergency data. Here's what I can assist with:\n\n- **Hotspots Analysis**: Ask about high-risk areas\n- **Response Times**: Inquire about efficiency metrics\n- **Priority Alerts**: Check current high-priority incidents\n- **Summary Reports**: Get daily overviews\n- **Women's Safety**: Analyze women's safety patterns\n\n**Current System Status:**\n- Total Calls Today: ${context.data.statistics.total_calls_today}\n- Active Operators: ${context.active_operators}\n- System Status: ${context.system_status}\n\nWhat would you like to know more about?`;
    }
}

// Routes
app.post('/api/chatbot/chat', async (req, res) => {
    try {
        const userQuery = req.body.message?.trim();
        if (!userQuery) {
            return res.status(400).json({ success: false, error: 'Message is required' });
        }

        // If the user mentions a specific date or a range, compute stats for that period from dataset.csv
        let context;
        const csvPath = getDatasetPath();
        const dateHint = extractDateRange(userQuery);
        if (dateHint && fs.existsSync(csvPath)) {
            const text = fs.readFileSync(csvPath, 'utf8');
            const rows = parseCSVText(text);
            const headers = rows.length ? Object.keys(rows[0]) : [];
            const findCol = (cands) => headers.find(h => cands.includes(h.toLowerCase()));
            const createTimeCol = findCol(['create_time','time','timestamp','created_at']);
            if (createTimeCol) {
                const pred = makeDatePredicate(dateHint.start, dateHint.end);
                const data = buildStatsForPeriod(rows, createTimeCol, pred);
                console.log(`[chatbot] Date filter applied: ${dateHint.display}. Matched rows: ${data.statistics.total_calls_today}`);
                context = {
                    current_time: new Date().toISOString(),
                    data,
                    system_status: 'operational',
                    active_operators: 3,
                    source: path.basename(csvPath),
                    date_filter: dateHint
                };
            }
        }
        if (!context) {
            context = getEmergencyContext();
        }

        // Intercept greetings to avoid generic Gemini summaries
        if (isGreeting(userQuery)) {
            const response = `Hello! I’m an AI assistant ready to help you explore the 112 emergency calls dataset. What would you like to know?\n\nHere are two example questions to try:\n- Which event type had the most calls on 2025-03-16?\n- Top 5 hotspots for 2025-03-16.`;
            return res.json({
                success: true,
                response,
                timestamp: new Date().toISOString(),
                context_used: {
                    total_calls: context.data.statistics.total_calls_today,
                    active_operators: context.active_operators,
                    system_status: context.system_status,
                    date_filter: context.date_filter || null,
                    data_source: context.source || null
                }
            });
        }

        // Try AI first if configured; fallback to rules
        let response = await generateAIResponse(userQuery, context);
        if (!response) {
            response = generateSimpleResponse(userQuery, context);
        }

        res.json({
            success: true,
            response,
            timestamp: new Date().toISOString(),
            context_used: {
                total_calls: context.data.statistics.total_calls_today,
                active_operators: context.active_operators,
                system_status: context.system_status,
                date_filter: context.date_filter || null,
                data_source: context.source || null
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: `Error processing request: ${error.message}` });
    }
});

app.get('/api/chatbot/context', (req, res) => {
    try {
        const context = getEmergencyContext();
        res.json({
            success: true,
            context: context
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: `Error getting context: ${error.message}`
        });
    }
});

app.get('/api/chatbot/health', (req, res) => {
    const live = loadDatasetContext();
    res.json({
        success: true,
        status: 'healthy',
        gemini_configured: Boolean(GEMINI_API_KEY),
        simple_mode: !Boolean(GEMINI_API_KEY),
        data_source: live ? live.source : 'mock',
        timestamp: new Date().toISOString()
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🤖 Chatbot API Server running on http://localhost:${PORT}`);
    console.log(`📡 API endpoints:`);
    console.log(`   - POST /api/chatbot/chat (Main chat endpoint)`);
    console.log(`   - GET /api/chatbot/context (System context)`);
    console.log(`   - GET /api/chatbot/health (Health check)`);
    console.log(`⚠️  Running in Simple Mode (Node.js version)`);
});
