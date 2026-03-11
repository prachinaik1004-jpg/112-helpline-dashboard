// Patrol Management Module
class PatrolManager {
    constructor() {
        this.patrolData = {
            status: 'idle', // 'idle', 'active', 'paused', 'completed'
            startTime: null,
            endTime: null,
            waypoints: [],
            notes: [],
            incidents: []
        };
        this.csvData = [];
        this.filteredData = [];
        
        // Initialize event listeners
        this.initEventListeners();
    }
    initEventListeners() {
        // Start/Stop Patrol button
        document.getElementById('startPatrolBtn')?.addEventListener('click', () => {
            if (this.patrolData.status === 'active') {
                this.stopPatrol();
            } else {
                this.startPatrol();
            }
        });

        // Export Plan button
        document.getElementById('exportPlanBtn')?.addEventListener('click', () => {
            this.exportPatrolPlan('json');
        });
        
        // Filter controls
        document.getElementById('filterType')?.addEventListener('change', (e) => this.applyFilters());
        document.getElementById('filterDate')?.addEventListener('change', (e) => this.applyFilters());
        document.getElementById('filterConfidence')?.addEventListener('input', (e) => {
            document.getElementById('confidenceValue').textContent = e.target.value;
            this.applyFilters();
        });
    }
    
    startPatrol() {
        this.patrolData = {
            status: 'active',
            startTime: new Date(),
            endTime: null,
            waypoints: [],
            notes: []
        };
        
        // Update UI
        const patrolBtn = document.getElementById('startPatrolBtn');
        if (patrolBtn) {
            patrolBtn.innerHTML = '<i class="fas fa-stop"></i> Stop Patrol';
            patrolBtn.classList.remove('gradient');
            patrolBtn.classList.add('danger');
        }
        
        // Show notification
        this.showNotification('Patrol started successfully', 'success');
        
        // Log the start of patrol
        this.logPatrolEvent('Patrol started');
    }
    
    stopPatrol() {
        this.patrolData.status = 'completed';
        this.patrolData.endTime = new Date();
        
        // Update UI
        const patrolBtn = document.getElementById('startPatrolBtn');
        if (patrolBtn) {
            patrolBtn.innerHTML = '<i class="fas fa-play"></i> Start Patrol';
            patrolBtn.classList.remove('danger');
            patrolBtn.classList.add('gradient');
        }
        
        // Show notification
        this.showNotification('Patrol completed successfully', 'success');
        
        // Log the end of patrol
        this.logPatrolEvent('Patrol completed');
        
        // Auto-export the patrol report
        this.exportPatrolPlan();
    }
    
    addWaypoint(latitude, longitude, notes = '') {
        const waypoint = {
            id: Date.now(),
            timestamp: new Date(),
            coordinates: { latitude, longitude },
            notes
        };
        
        this.patrolData.waypoints.push(waypoint);
        this.logPatrolEvent(`Waypoint added at ${latitude}, ${longitude}`);
        
        return waypoint;
    }
    
    addNote(content) {
        const note = {
            id: Date.now(),
            timestamp: new Date(),
            content
        };
        
        this.patrolData.notes.push(note);
        return note;
    }
    
    exportPatrolPlan(format = 'pdf') {
        if (this.patrolData.waypoints.length === 0 && this.patrolData.status !== 'completed') {
            this.showNotification('No patrol data to export', 'warning');
            return;
        }
        
        try {
            // Generate a filename with timestamp
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `patrol-report-${timestamp}.${format}`;
            
            // Create a summary of the patrol
            const patrolDuration = this.patrolData.endTime 
                ? this.formatDuration(this.patrolData.endTime - this.patrolData.startTime)
                : 'In Progress';
            
            const report = {
                title: 'Patrol Report',
                metadata: {
                    startTime: this.patrolData.startTime?.toLocaleString() || 'N/A',
                    endTime: this.patrolData.endTime?.toLocaleString() || 'In Progress',
                    duration: patrolDuration,
                    waypointCount: this.patrolData.waypoints.length,
                    notesCount: this.patrolData.notes.length
                },
                waypoints: this.patrolData.waypoints,
                notes: this.patrolData.notes,
                summary: this.generatePatrolSummary()
            };
            
            // Different export formats
            if (format === 'json') {
                this.downloadFile(
                    JSON.stringify(report, null, 2),
                    filename,
                    'application/json'
                );
            } else if (format === 'csv') {
                this.exportAsCSV(report, filename);
            } else {
                // Default to PDF
                this.exportAsPDF(report, filename);
            }
            
            this.showNotification(`Patrol report exported as ${format.toUpperCase()}`, 'success');
            this.logPatrolEvent(`Exported patrol report (${format})`);
            
        } catch (error) {
            console.error('Error exporting patrol plan:', error);
            this.showNotification('Failed to export patrol plan', 'error');
        }
    }
    
    exportAsCSV(report, filename) {
        // Convert waypoints to CSV
        let csvContent = 'Timestamp,Latitude,Longitude,Notes\n';
        
        report.waypoints.forEach(waypoint => {
            const row = [
                new Date(waypoint.timestamp).toLocaleString(),
                waypoint.coordinates.latitude,
                waypoint.coordinates.longitude,
                `"${waypoint.notes.replace(/"/g, '""')}"`
            ];
            csvContent += row.join(',') + '\n';
        });
        
        // Add notes if any
        if (report.notes.length > 0) {
            csvContent += '\nNotes\n';
            report.notes.forEach(note => {
                csvContent += `"${new Date(note.timestamp).toLocaleString()}","${note.content.replace(/"/g, '""')}"\n`;
            });
        }
        
        // Add summary
        csvContent += '\nSummary\n';
        csvContent += `Start Time,${report.metadata.startTime}\n`;
        csvContent += `End Time,${report.metadata.endTime}\n`;
        csvContent += `Duration,${report.metadata.duration}\n`;
        csvContent += `Waypoints,${report.metadata.waypointCount}\n`;
        csvContent += `Notes,${report.metadata.notesCount}\n`;
        
        this.downloadFile(csvContent, filename, 'text/csv;charset=utf-8;');
    }
    
    exportAsPDF(report, filename) {
        // Create a new window with the report content
        const printWindow = window.open('', '_blank');
        
        // Create PDF content
        let htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>${report.title}</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; margin: 20px; }
                h1 { color: #2c3e50; border-bottom: 2px solid #eee; padding-bottom: 10px; }
                .header { margin-bottom: 20px; }
                .section { margin-bottom: 20px; }
                table { width: 100%; border-collapse: collapse; margin: 10px 0; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #f2f2f2; }
                .notes { margin-top: 20px; }
                .footer { margin-top: 30px; font-size: 0.8em; color: #777; text-align: center; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>${report.title}</h1>
                <p><strong>Start Time:</strong> ${report.metadata.startTime}</p>
                <p><strong>End Time:</strong> ${report.metadata.endTime}</p>
                <p><strong>Duration:</strong> ${report.metadata.duration}</p>
            </div>
            
            <div class="section">
                <h2>Waypoints (${report.metadata.waypointCount})</h2>
                <table>
                    <tr>
                        <th>Timestamp</th>
                        <th>Latitude</th>
                        <th>Longitude</th>
                        <th>Notes</th>
                    </tr>`;
        
        // Add waypoints
        report.waypoints.forEach(waypoint => {
            htmlContent += `
                    <tr>
                        <td>${new Date(waypoint.timestamp).toLocaleString()}</td>
                        <td>${waypoint.coordinates.latitude}</td>
                        <td>${waypoint.coordinates.longitude}</td>
                        <td>${waypoint.notes || '-'}</td>
                    </tr>`;
        });
        
        htmlContent += `
                </table>
            </div>`;
        
        // Add notes if any
        if (report.notes.length > 0) {
            htmlContent += `
            <div class="section notes">
                <h2>Notes (${report.metadata.notesCount})</h2>
                <table>
                    <tr>
                        <th>Timestamp</th>
                        <th>Note</th>
                    </tr>`;
            
            report.notes.forEach(note => {
                htmlContent += `
                    <tr>
                        <td>${new Date(note.timestamp).toLocaleString()}</td>
                        <td>${note.content}</td>
                    </tr>`;
            });
            
            htmlContent += `
                </table>
            </div>`;
        }
        
        // Add summary
        htmlContent += `
            <div class="section">
                <h2>Summary</h2>
                <p>${report.summary}</p>
            </div>
            
            <div class="footer">
                <p>Generated on ${new Date().toLocaleString()}</p>
            </div>
            
            <script>
                // Auto-print and close after a short delay
                setTimeout(() => {
                    window.print();
                    // window.close(); // Uncomment to auto-close after printing
                }, 500);
            </script>
        </body>
        </html>`;
        
        // Write the content and trigger print
        printWindow.document.open();
        printWindow.document.write(htmlContent);
        printWindow.document.close();
    }
    
    downloadFile(content, filename, contentType) {
        const blob = new Blob([content], { type: contentType });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        
        // Clean up
        setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 0);
    }
    
    generatePatrolSummary() {
        const waypointCount = this.patrolData.waypoints.length;
        const notesCount = this.patrolData.notes.length;
        const duration = this.patrolData.endTime 
            ? this.formatDuration(this.patrolData.endTime - this.patrolData.startTime)
            : 'In Progress';
        
        return `This patrol covered ${waypointCount} waypoints with ${notesCount} notes taken. ` +
               `Total duration: ${duration}. ` +
               `${this.patrolData.status === 'completed' ? 'Patrol completed successfully.' : 'Patrol is still in progress.'}`;
    }
    
    formatDuration(ms) {
        if (!ms) return '0s';
        
        const seconds = Math.floor((ms / 1000) % 60);
        const minutes = Math.floor((ms / (1000 * 60)) % 60);
        const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
        
        const parts = [];
        if (hours > 0) parts.push(`${hours}h`);
        if (minutes > 0) parts.push(`${minutes}m`);
        if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);
        
        return parts.join(' ');
    }
    
    showNotification(message, type = 'info') {
        // You can replace this with a more sophisticated notification system
        console.log(`[${type.toUpperCase()}] ${message}`);
        
        // Simple browser notification
        if (Notification.permission === 'granted') {
            new Notification(`Patrol ${type === 'error' ? 'Error' : 'Update'}`, {
                body: message,
                icon: type === 'error' ? '⚠️' : 'ℹ️'
            });
        } else if (Notification.permission !== 'denied') {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    new Notification(`Patrol ${type === 'error' ? 'Error' : 'Update'}`, {
                        body: message,
                        icon: type === 'error' ? '⚠️' : 'ℹ️'
                    });
                }
            });
        }
    }
    
    logPatrolEvent(message) {
        console.log(`[PATROL] ${new Date().toISOString()} - ${message}`);
    }
    
    async loadCSVData() {
        try {
            const response = await fetch('./sample-data/cv-data.csv');
            const csvData = await response.text();
            this.csvData = this.parseCSV(csvData);
            this.filteredData = [...this.csvData];
            console.log('Loaded CSV data:', this.csvData);
            this.updatePatrolPlan();
        } catch (error) {
            console.error('Error loading CSV data:', error);
            // Fallback to sample data if CSV load fails
            this.csvData = this.getSampleData();
            this.filteredData = [...this.csvData];
            this.updatePatrolPlan();
        }
    }
    
    parseCSV(csvText) {
        const lines = csvText.split('\n');
        const headers = lines[0].split(',').map(h => h.trim());
        
        return lines.slice(1)
            .filter(line => line.trim() !== '')
            .map(line => {
                const values = line.split(',');
                const entry = {};
                headers.forEach((header, index) => {
                    entry[header] = values[index] ? values[index].trim() : '';
                    // Convert numeric values
                    if (['confidence'].includes(header) && entry[header]) {
                        entry[header] = parseFloat(entry[header]);
                    }
                });
                return entry;
            });
    }
    
    getSampleData() {
        return [
            {
                timestamp: new Date().toISOString(),
                latitude: 15.4909,
                longitude: 73.8278,
                type: 'pedestrian',
                confidence: 0.85,
                description: 'High pedestrian traffic'
            },
            {
                timestamp: new Date(Date.now() + 3600000).toISOString(),
                latitude: 15.4915,
                longitude: 73.8285,
                type: 'vehicle',
                confidence: 0.92,
                description: 'Speeding vehicle'
            }
        ];
    }
    
    updatePatrolPlan() {
        if (!this.filteredData) return;
        
        const planContainer = document.getElementById('patrolPlanContainer');
        if (!planContainer) return;
        
        // Group incidents by type for the summary
        const typeCounts = this.filteredData.reduce((acc, incident) => {
            acc[incident.type] = (acc[incident.type] || 0) + 1;
            return acc;
        }, {});
        
        // Create summary HTML
        let summaryHTML = `
            <div class="patrol-summary">
                <h3>Patrol Plan Summary</h3>
                <div class="summary-stats">
                    <div class="stat-card">
                        <span class="stat-value">${this.filteredData.length}</span>
                        <span class="stat-label">Total Incidents</span>
                    </div>
                    ${Object.entries(typeCounts).map(([type, count]) => `
                        <div class="stat-card">
                            <span class="stat-value">${count}</span>
                            <span class="stat-label">${type.charAt(0).toUpperCase() + type.slice(1)}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        
        // Create incidents list
        let incidentsHTML = `
            <div class="incidents-list">
                <h3>Incident Details</h3>
                <div class="incident-filters">
                    <div class="filter-group">
                        <label for="filterType">Incident Type:</label>
                        <select id="filterType">
                            <option value="all">All Types</option>
                            ${[...new Set(this.csvData.map(i => i.type))].map(type => 
                                `<option value="${type}">${type.charAt(0).toUpperCase() + type.slice(1)}</option>`
                            ).join('')}
                        </select>
                    </div>
                    <div class="filter-group">
                        <label for="filterDate">Date:</label>
                        <input type="date" id="filterDate">
                    </div>
                    <div class="filter-group">
                        <label for="filterConfidence">Min Confidence: <span id="confidenceValue">0.5</span></label>
                        <input type="range" id="filterConfidence" min="0" max="1" step="0.1" value="0.5">
                    </div>
                </div>
                <div class="incidents-container">
                    ${this.filteredData.map(incident => `
                        <div class="incident-card" data-type="${incident.type}" data-confidence="${incident.confidence}">
                            <div class="incident-header">
                                <span class="incident-type ${incident.type}">${incident.type}</span>
                                <span class="incident-time">${new Date(incident.timestamp).toLocaleTimeString()}</span>
                                <span class="confidence-badge" style="background: ${this.getConfidenceColor(incident.confidence)}">
                                    ${Math.round(incident.confidence * 100)}%
                                </span>
                            </div>
                            <div class="incident-description">${incident.description}</div>
                            <div class="incident-location">
                                <i class="fas fa-map-marker-alt"></i>
                                ${parseFloat(incident.latitude).toFixed(4)}, ${parseFloat(incident.longitude).toFixed(4)}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        
        planContainer.innerHTML = summaryHTML + incidentsHTML;
        
        // Re-attach event listeners
        this.initEventListeners();
    }
    
    getConfidenceColor(confidence) {
        // Returns a color from red to green based on confidence (0-1)
        const hue = confidence * 120; // 0 is red, 120 is green
        return `hsl(${hue}, 100%, 45%)`;
    }
    
    generatePatrolReport() {
        const report = {
            patrolId: 'PATROL-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
            startTime: this.patrolData.startTime,
            endTime: this.patrolData.endTime || new Date().toISOString(),
            incidents: this.filteredData,
            summary: {
                totalIncidents: this.filteredData.length,
                incidentTypes: this.filteredData.reduce((acc, incident) => {
                    acc[incident.type] = (acc[incident.type] || 0) + 1;
                    return acc;
                }, {})
            }
        };
        
        console.log('Generated patrol report:', report);
        return report;
    }
    
    convertToCSV(data) {
        if (!data || !data.length) return '';
        
        const headers = Object.keys(data[0]);
        const csvRows = [
            headers.join(','),
            ...data.map(row => 
                headers.map(fieldName => 
                    JSON.stringify(row[fieldName] || '', (key, value) => 
                        value === null ? '' : value
                    )
                ).join(',')
            )
        ];
        
        return csvRows.join('\n');
    }
}

// Initialize when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Initialize patrol manager
    window.patrolManager = new PatrolManager();
    
    // Load CSV data and initialize patrol plan
    window.patrolManager.loadCSVData();
    
    // Request notification permission
    if ('Notification' in window) {
        Notification.requestPermission();
    }
});
