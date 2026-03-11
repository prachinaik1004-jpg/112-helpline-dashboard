// Wait for the DOM to be fully loaded before initializing the Safety Assist feature
function initSafetyAssist() {
  console.log('Initializing Safety Assist...');
  // Create and append the modal HTML
  const modalHTML = `
    <div class="safety-modal" id="safetyModal">
      <div class="safety-modal-content">
        <div class="safety-header">
          <h2><i class="fas fa-shield-alt"></i> Safety Assist</h2>
          <button class="close-btn" id="closeModal">&times;</button>
        </div>
        
        <div class="safety-options">
          <div class="safety-option" id="uploadEvidence">
            <i class="fas fa-camera"></i>
            <div class="option-text">
              <h3>Upload Evidence</h3>
              <p>Upload photos, videos, or audio recordings</p>
            </div>
            <i class="fas fa-chevron-right"></i>
          </div>
          
          <div class="safety-option" id="startChat">
            <i class="fas fa-comments"></i>
            <div class="option-text">
              <h3>Start Safe Chat</h3>
              <p>Chat anonymously with trained support</p>
            </div>
            <i class="fas fa-chevron-right"></i>
          </div>
          
          <div class="anonymous-toggle">
            <div class="toggle-container">
              <i class="fas fa-user-secret"></i>
              <span>Report Anonymously</span>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" id="anonymousToggle">
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>
        
        <div id="feedbackArea"></div>
      </div>
    </div>
    
    <!-- Hidden file input -->
    <input type="file" id="fileInput" class="file-input" multiple accept="image/*,video/*,audio/*">
  `;
  
  // Append modal to body if not already added
  if (!document.getElementById('safetyModal')) {
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    console.log('Safety Assist modal added to DOM');
  } else {
    console.log('Safety Assist modal already exists');
  }
  
  // Get DOM elements with null checks
  const safetyAssistBtn = document.getElementById('safetyAssistBtn');
  const safetyModal = document.getElementById('safetyModal');
  
  if (!safetyAssistBtn || !safetyModal) {
    console.error('Required elements not found. Safety Assist will not work.');
    return;
  }
  
  const closeModal = document.getElementById('closeModal');
  const uploadEvidence = document.getElementById('uploadEvidence');
  const startChat = document.getElementById('startChat');
  const fileInput = document.getElementById('fileInput');
  const anonymousToggle = document.getElementById('anonymousToggle');
  const feedbackArea = document.getElementById('feedbackArea');
  
  console.log('All required elements found:', { 
    safetyAssistBtn: !!safetyAssistBtn,
    safetyModal: !!safetyModal,
    closeModal: !!closeModal,
    uploadEvidence: !!uploadEvidence,
    startChat: !!startChat,
    fileInput: !!fileInput,
    anonymousToggle: !!anonymousToggle,
    feedbackArea: !!feedbackArea
  });
  
  // Track long press
  let longPressTimer;
  const LONG_PRESS_DURATION = 2000; // 2 seconds
  
  // Show modal
  function showModal() {
    safetyModal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
  
  // Hide modal
  function hideModal() {
    safetyModal.classList.remove('active');
    document.body.style.overflow = '';
    // Clear feedback when closing
    feedbackArea.innerHTML = '';
  }
  
  // Show feedback message with enhanced styling and animations
  function showFeedback(message, isError = false, duration = 5000) {
    // Create unique ID for this notification
    const notificationId = 'notif-' + Date.now();
    const icon = isError ? 'exclamation-triangle' : 'check-circle';
    const typeClass = isError ? 'error' : 'success';
    
    // Create notification element
    const notification = document.createElement('div');
    notification.id = notificationId;
    notification.className = `feedback-notification ${typeClass} show`;
    notification.innerHTML = `
      <div class="notification-content">
        <i class="fas fa-${icon} notification-icon"></i>
        <div class="notification-message">${message}</div>
      </div>
      <div class="notification-progress"></div>
    `;
    
    // Add to feedback area
    feedbackArea.insertAdjacentElement('afterbegin', notification);
    
    // Force reflow to enable animation
    void notification.offsetWidth;
    
    // Start progress bar animation
    const progressBar = notification.querySelector('.notification-progress');
    if (progressBar) {
      progressBar.style.animation = `progress ${duration}ms linear`;
    }
    
    // Auto-hide after specified duration
    setTimeout(() => {
      notification.classList.remove('show');
      notification.classList.add('hide');
      
      // Remove from DOM after animation completes
      setTimeout(() => {
        if (document.getElementById(notificationId)) {
          notification.remove();
        }
      }, 300);
    }, duration);
    
    // Add click to dismiss
    notification.addEventListener('click', () => {
      notification.classList.remove('show');
      notification.classList.add('hide');
      setTimeout(() => notification.remove(), 300);
    });
  }
  
  // Handle file upload
  function handleFileUpload(files) {
    if (files.length === 0) return;
    
    const isAnonymous = anonymousToggle.checked;
    const formData = new FormData();
    
    // Add files to form data
    Array.from(files).forEach(file => {
      formData.append('evidence', file);
    });
    
    // Add metadata
    formData.append('anonymous', isAnonymous);
    formData.append('timestamp', new Date().toISOString());
    formData.append('location', JSON.stringify({
      // In a real app, you would get this from geolocation API
      lat: 0,
      lng: 0,
      accuracy: 0
    }));
    
    // Show uploading feedback
    showFeedback('Uploading evidence...');
    
    // In a real app, you would send this to your server
    // For now, we'll simulate an API call
    setTimeout(() => {
      // Simulate successful upload
      console.log('Files uploaded:', Array.from(files).map(f => f.name));
      console.log('Anonymous:', isAnonymous);
      
      // Show success feedback with case number
      const caseNumber = 'CASE-' + Math.floor(1000 + Math.random() * 9000);
      showFeedback(
        `Evidence uploaded and secured. Case <strong>${caseNumber}</strong> has been created.`,
        false, // Not an error
        7000   // Show for 7 seconds
      );
      
      // AI scanning simulation with progress updates
      setTimeout(() => {
        showFeedback('🔍 AI is analyzing your evidence for potential threats...', false, 4000);
        
        setTimeout(() => {
          showFeedback(
            '✅ AI analysis complete. Case has been <strong>flagged as high priority</strong> and forwarded to our response team.',
            false,
            8000
          );
          
          // Additional status update if needed
          setTimeout(() => {
            showFeedback(
              '👮‍♂️ <strong>Support officer assigned</strong>. You can now chat securely or wait for a call.',
              false,
              8000
            );
          }, 2000);
          
        }, 2000);
      }, 1000);
      
    }, 2000);
  }
  
  // Event Listeners with error handling
  try {
    if (safetyAssistBtn) {
      safetyAssistBtn.addEventListener('click', showModal);
      console.log('Added click event listener to safetyAssistBtn');
    }
    
    if (closeModal) {
      closeModal.addEventListener('click', hideModal);
    }
  
    // Close modal when clicking outside content
    if (safetyModal) {
      safetyModal.addEventListener('click', (e) => {
        if (e.target === safetyModal) {
          hideModal();
        }
      });
    }
  
    // Upload evidence
    if (uploadEvidence && fileInput) {
      uploadEvidence.addEventListener('click', () => {
        console.log('Upload evidence clicked');
        fileInput.click();
      });
    }
  
    // Handle file selection
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        console.log('File selected:', fileInput.files);
        if (fileInput.files.length > 0) {
          handleFileUpload(fileInput.files);
          // Reset file input
          fileInput.value = '';
        }
      });
    }
  
    // Start safe chat
    if (startChat && anonymousToggle && feedbackArea) {
      startChat.addEventListener('click', () => {
        console.log('Start chat clicked');
        const isAnonymous = anonymousToggle.checked;
        showFeedback(isAnonymous ? 
          'Connecting to support officer anonymously...' : 
          'Connecting to support officer...');
        
        // In a real app, this would open a chat interface
        setTimeout(() => {
          showFeedback('Support officer connected. You can now chat securely.');
          // Here you would initialize the chat interface
        }, 1500);
      });
    }
  
    // Long press for SOS
    if (safetyAssistBtn) {
      // Mouse events for desktop
      safetyAssistBtn.addEventListener('mousedown', () => {
        console.log('Mouse down on safety button');
        longPressTimer = setTimeout(() => {
          console.log('Long press detected - triggering SOS');
          triggerSOS();
        }, LONG_PRESS_DURATION);
      });
      
      // Touch events for mobile
      safetyAssistBtn.addEventListener('touchstart', (e) => {
        console.log('Touch start on safety button');
        e.preventDefault(); // Prevent any default touch behavior
        longPressTimer = setTimeout(() => {
          console.log('Long touch detected - triggering SOS');
          triggerSOS();
        }, LONG_PRESS_DURATION);
      });
      
      // Clear the long press timer if the user releases before the duration
      ['mouseup', 'mouseleave', 'touchend', 'touchcancel'].forEach(event => {
        safetyAssistBtn.addEventListener(event, (e) => {
          if (event.startsWith('touch')) {
            e.preventDefault();
          }
          console.log(`${event} - clearing long press timer`);
          clearTimeout(longPressTimer);
        });
      });
    }
  
  // SOS function
  function triggerSOS() {
    // In a real app, this would send an immediate alert to authorities
    const isAnonymous = anonymousToggle.checked;
    
    console.log('SOS TRIGGERED!', { 
      anonymous: isAnonymous,
      location: { /* current location */ },
      timestamp: new Date().toISOString()
    });
    
    // Show feedback
    showFeedback('SOS alert sent to authorities! Help is on the way!');
    
    // In a real app, you might want to:
    // 1. Send location data to emergency services
    // 2. Notify trusted contacts
    // 3. Start recording audio/video
    // 4. Show emergency instructions
  }
  
    // Close with Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && safetyModal && safetyModal.classList.contains('active')) {
        hideModal();
      }
    });
    
    console.log('Safety Assist initialization complete');
  } catch (error) {
    console.error('Error initializing Safety Assist:', error);
  }
}

// Initialize when the DOM is fully loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSafetyAssist);
} else {
  // DOMContentLoaded has already fired
  initSafetyAssist();
}
