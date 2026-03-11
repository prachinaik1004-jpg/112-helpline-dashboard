// Floating Chatbot Widget
(function(){
  'use strict';

  function injectWidget() {
    if (document.getElementById('chatbot-launcher') || document.getElementById('chatbot-panel')) return;

    const launcher = document.createElement('button');
    launcher.id = 'chatbot-launcher';
    launcher.setAttribute('aria-label', 'Open chatbot');
    launcher.innerHTML = '<span class="cb-icon">💬</span><span class="cb-tooltip">Ask a question</span>';

    const panel = document.createElement('div');
    panel.id = 'chatbot-panel';
    panel.innerHTML = `
      <div id="chatbot-header">
        <div class="title">
          <span>AI Assistant</span>
          <span class="badge">112 Analytics</span>
        </div>
        <div class="actions">
          <button id="showContextBtn" title="Show context">ℹ️</button>
          <button id="minimizeBtn" title="Close">✕</button>
        </div>
      </div>
      <div id="messages">
        <div class="message bot">
          <div class="message-avatar">🤖</div>
          <div class="message-content">
            <div>
              Hello! I'm an AI assistant ready to help you explore the 112 emergency calls dataset. Ask me questions, and I'll do my best to analyze the data and give you a clear answer.<br><br>
              Please keep in mind that my responses are generated from the provided data. While I aim for accuracy, the insights are based on my interpretation of the dataset.
            </div>
            <div class="message-time">${new Date().toLocaleTimeString()}</div>
          </div>
        </div>
      </div>
      <div id="chatbot-input">
        <div class="row">
          <textarea id="messageInput" placeholder="Ask a question..." onkeydown="handleKeyPress(event)" autofocus></textarea>
          <button id="sendBtn" onclick="sendMessage()">Send</button>
        </div>
        <div id="quickActions">
          <button onclick="sendQuickMessage('Hotspots today')">Hotspots</button>
          <button onclick="sendQuickMessage('Daily summary report')">Summary</button>
          <button onclick="sendQuickMessage('Response time analysis')">Response</button>
        </div>
      </div>

      <div id="contextModal" role="dialog" aria-modal="true">
        <div class="modal-card">
          <div class="modal-header">
            <div><strong>System Context</strong></div>
            <button onclick="closeModal()">✕</button>
          </div>
          <div id="contextContent"></div>
        </div>
      </div>
    `;

    document.body.appendChild(launcher);
    document.body.appendChild(panel);

    // Toggle open/close
    function openPanel(){
      panel.classList.add('open');
      // focus input shortly after open to ensure element is visible
      const ta = panel.querySelector('#messageInput');
      if (ta) setTimeout(() => ta.focus(), 50);
    }
    function closePanel(){ panel.classList.remove('open'); }

    launcher.addEventListener('click', function(){
      if (panel.classList.contains('open')) { closePanel(); } else { openPanel(); }
    });
    panel.querySelector('#minimizeBtn').addEventListener('click', closePanel);
    panel.querySelector('#showContextBtn').addEventListener('click', function(){
      if (typeof showContext === 'function') showContext();
    });
  }

  function ensureChatbotScript(cb){
    const maybeInit = () => {
      try {
        if (window.Chatbot && !window.chatbot) {
          window.chatbot = new window.Chatbot();
        }
      } catch(e) { /* noop */ }
      cb && cb();
    };
    if (window.Chatbot || window.chatbot) {
      maybeInit();
      return;
    }
    let core = document.querySelector('script[data-chatbot-core]');
    if (!core) {
      core = document.createElement('script');
      core.src = 'chatbotfiles/chatbot.js';
      core.async = true;
      core.setAttribute('data-chatbot-core','true');
      core.onload = maybeInit;
      document.body.appendChild(core);
    } else {
      // If script tag exists but Chatbot not ready yet, wait a tick
      core.addEventListener('load', maybeInit, { once: true });
      // Fallback after small delay
      setTimeout(maybeInit, 300);
    }
  }

  function ensureStyles(){
    if (!document.querySelector('link[data-chatbot-widget]')){
      const l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = 'static/css/chatbot-widget.css';
      l.setAttribute('data-chatbot-widget','true');
      document.head.appendChild(l);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function(){
      ensureStyles();
      injectWidget();
      ensureChatbotScript();
    });
  } else {
    ensureStyles();
    injectWidget();
    ensureChatbotScript();
  }
})();
