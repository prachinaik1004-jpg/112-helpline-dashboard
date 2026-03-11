// Chatbot JavaScript
class Chatbot {
    constructor() {
        this.apiBaseUrl = 'http://localhost:5050/api/chatbot';
        this.messages = [];
        this.isTyping = false;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadWelcomeMessage();
    }

    setupEventListeners() {
        const messageInput = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendBtn');

        messageInput.addEventListener('input', () => {
            sendBtn.disabled = !messageInput.value.trim();
        });

        // Auto-resize input
        messageInput.addEventListener('input', () => {
            messageInput.style.height = 'auto';
            messageInput.style.height = messageInput.scrollHeight + 'px';
        });
    }

    loadWelcomeMessage() {
        // Welcome message is already in HTML
        console.log('Chatbot initialized');
    }

    async sendMessage(message = null) {
        const messageInput = document.getElementById('messageInput');
        const userMessage = message || messageInput.value.trim();
        
        if (!userMessage) return;

        // Clear input
        if (!message) {
            messageInput.value = '';
            messageInput.style.height = 'auto';
        }

        // Add user message to chat
        this.addMessage(userMessage, 'user');

        // Show typing indicator
        this.showTypingIndicator();

        try {
            const response = await fetch(`${this.apiBaseUrl}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: userMessage
                })
            });

            const data = await response.json();

            // Hide typing indicator
            this.hideTypingIndicator();

            if (data.success) {
                this.addMessage(data.response, 'bot', data.context_used);
            } else {
                this.addMessage(`Error: ${data.error}`, 'bot');
            }

        } catch (error) {
            this.hideTypingIndicator();
            this.addMessage(`Connection error: ${error.message}`, 'bot');
        }
    }

    addMessage(content, sender, context = null) {
        const messagesContainer = document.getElementById('messages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}`;

        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.textContent = sender === 'user' ? '👤' : '🤖';

        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        
        // Format the message content
        const formattedContent = this.formatMessage(content);
        messageContent.innerHTML = formattedContent;

        const messageTime = document.createElement('div');
        messageTime.className = 'message-time';
        messageTime.textContent = new Date().toLocaleTimeString();

        messageContent.appendChild(messageTime);

        // Add context info if available
        if (context && sender === 'bot') {
            const contextInfo = document.createElement('div');
            contextInfo.className = 'context-info';
            contextInfo.innerHTML = `
                <small style="color: #64748b; font-size: 11px;">
                    📊 Based on ${context.total_calls} calls, ${context.active_operators} operators online
                </small>
            `;
            messageContent.appendChild(contextInfo);
        }

        messageDiv.appendChild(avatar);
        messageDiv.appendChild(messageContent);
        messagesContainer.appendChild(messageDiv);

        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        // Store message
        this.messages.push({
            content,
            sender,
            timestamp: new Date(),
            context
        });
    }

    formatMessage(content) {
        // Convert markdown-like formatting to HTML
        return content
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\n/g, '<br>')
            .replace(/`(.*?)`/g, '<code style="background: #f1f5f9; padding: 2px 4px; border-radius: 4px; font-family: monospace;">$1</code>');
    }

    showTypingIndicator() {
        const messagesContainer = document.getElementById('messages');
        const typingDiv = document.createElement('div');
        typingDiv.className = 'message bot';
        typingDiv.id = 'typing-indicator';

        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.textContent = '🤖';

        const typingContent = document.createElement('div');
        typingContent.className = 'message-content typing-indicator';
        typingContent.innerHTML = `
            AI is thinking
            <div class="typing-dots">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        `;

        typingDiv.appendChild(avatar);
        typingDiv.appendChild(typingContent);
        messagesContainer.appendChild(typingDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    hideTypingIndicator() {
        const typingIndicator = document.getElementById('typing-indicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }

    clearChat() {
        const messagesContainer = document.getElementById('messages');
        messagesContainer.innerHTML = '';
        this.messages = [];
    }

    async exportChat() {
        const chatData = {
            timestamp: new Date().toISOString(),
            messages: this.messages
        };

        const blob = new Blob([JSON.stringify(chatData, null, 2)], {
            type: 'application/json'
        });

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chatbot-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    async showContext() {
        const modal = document.getElementById('contextModal');
        const contextContent = document.getElementById('contextContent');
        
        modal.classList.add('show');
        contextContent.innerHTML = '<div class="loading">Loading context...</div>';

        try {
            const response = await fetch(`${this.apiBaseUrl}/context`);
            const data = await response.json();

            if (data.success) {
                this.renderContext(data.context, contextContent);
            } else {
                contextContent.innerHTML = `<div class="error">Error loading context: ${data.error}</div>`;
            }
        } catch (error) {
            contextContent.innerHTML = `<div class="error">Connection error: ${error.message}</div>`;
        }
    }

    renderContext(context, container) {
        container.innerHTML = `
            <div class="context-item">
                <h4>System Status</h4>
                <p>Status: ${context.system_status}</p>
                <p>Active Operators: ${context.active_operators}</p>
                <p>Current Time: ${new Date(context.current_time).toLocaleString()}</p>
            </div>
            
            <div class="context-item">
                <h4>Today's Statistics</h4>
                <p>Total Calls: ${context.data.statistics.total_calls_today}</p>
                <p>Women's Safety Calls: ${context.data.statistics.women_safety_calls}</p>
                <p>High Urgency Calls: ${context.data.statistics.high_urgency_calls}</p>
                <p>Average Response Time: ${context.data.statistics.average_response_time}</p>
            </div>
            
            <div class="context-item">
                <h4>Hotspots</h4>
                <p>${context.data.statistics.hotspots.join(', ')}</p>
            </div>
            
            <div class="context-item">
                <h4>Recent Trends</h4>
                <p>Calls Increase: ${context.data.trends.calls_increase}</p>
                <p>Peak Hours: ${context.data.trends.peak_hours}</p>
                <p>Most Common Type: ${context.data.trends.most_common_type}</p>
                <p>Response Time Trend: ${context.data.trends.response_time_trend}</p>
            </div>
            
            <div class="context-item">
                <h4>Recent Calls</h4>
                ${context.data.recent_calls.map(call => `
                    <p><strong>${call.id}</strong> - ${call.type} - ${call.location} - Urgency: ${call.urgency}</p>
                `).join('')}
            </div>
        `;
    }
}

// Global functions for HTML onclick handlers
let chatbot;

function handleKeyPress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

function sendMessage(message = null) {
    if (!chatbot) {
        chatbot = new Chatbot();
    }
    chatbot.sendMessage(message);
}

function sendQuickMessage(message) {
    sendMessage(message);
}

function clearChat() {
    if (chatbot) {
        chatbot.clearChat();
    }
}

function exportChat() {
    if (chatbot) {
        chatbot.exportChat();
    }
}

function showContext() {
    if (chatbot) {
        chatbot.showContext();
    }
}

function closeModal() {
    const modal = document.getElementById('contextModal');
    modal.classList.remove('show');
}

function toggleChatbot() {
    // This would minimize/restore the chatbot
    console.log('Toggle chatbot');
}

// Initialize chatbot when page loads (guard against double init)
document.addEventListener('DOMContentLoaded', () => {
    if (!window.chatbot) {
        window.chatbot = new Chatbot();
        chatbot = window.chatbot;
    }
});
