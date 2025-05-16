/**
 * Twitter Detoxifier - Popup Script
 * Handles popup UI interactions and displays current status
 */

// Current settings and statistics
let currentSettings = null;
let currentStats = null;
let isBlocked = false;
let blockEndTime = null;

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  // Load current settings
  await loadSettings();
  
  // Load current statistics
  await loadStatistics();
  
  // Check if Twitter is currently blocked
  await checkBlockingStatus();
  
  // Set up event listeners
  setupEventListeners();
  
  // Update UI
  updateUI();
});

// Load settings from storage
async function loadSettings() {
  return new Promise(resolve => {
    chrome.runtime.sendMessage({action: "getSettings"}, response => {
      currentSettings = response;
      resolve(currentSettings);
    });
  });
}

// Load statistics from storage
async function loadStatistics() {
  return new Promise(resolve => {
    chrome.runtime.sendMessage({action: "getStatistics"}, response => {
      currentStats = response;
      resolve(currentStats);
    });
  });
}

// Check if Twitter is currently blocked
async function checkBlockingStatus() {
  return new Promise(resolve => {
    chrome.runtime.sendMessage({action: "checkBlocking"}, response => {
      isBlocked = response.blocked;
      
      // If blocked, calculate when it will be unblocked
      if (isBlocked) {
        // Find the next schedule end time
        const now = new Date();
        const currentDay = now.getDay();
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        
        let nextEndTime = null;
        
        for (const schedule of currentSettings.blocking.schedule) {
          if (schedule.days.includes(currentDay)) {
            // Handle schedules that cross midnight
            if (schedule.startTime <= schedule.endTime) {
              // Normal schedule (e.g., 9:00 to 17:00)
              if (currentTime >= schedule.startTime && currentTime < schedule.endTime) {
                nextEndTime = schedule.endTime;
                break;
              }
            } else {
              // Schedule crosses midnight (e.g., 23:00 to 06:00)
              if (currentTime >= schedule.startTime || currentTime < schedule.endTime) {
                if (currentTime >= schedule.startTime) {
                  // We're after start time, end time is tomorrow
                  nextEndTime = schedule.endTime;
                  break;
                } else {
                  // We're before end time, end time is today
                  nextEndTime = schedule.endTime;
                  break;
                }
              }
            }
          }
        }
        
        if (nextEndTime) {
          const [hours, minutes] = nextEndTime.split(':').map(Number);
          blockEndTime = new Date();
          blockEndTime.setHours(hours, minutes, 0, 0);
          
          // If we're past the end time, it must be for tomorrow
          if (blockEndTime < now) {
            blockEndTime.setDate(blockEndTime.getDate() + 1);
          }
          
          // Start timer
          startBlockTimer();
        }
      }
      
      resolve(isBlocked);
    });
  });
}

// Start timer to show time until unblocked
function startBlockTimer() {
  if (!blockEndTime) return;
  
  const timerContainer = document.getElementById('timer-container');
  const timerElement = document.getElementById('block-timer');
  timerContainer.style.display = 'block';
  
  // Update timer every second
  const timerInterval = setInterval(() => {
    const now = new Date();
    const timeRemaining = blockEndTime - now;
    
    if (timeRemaining <= 0) {
      // Timer expired, refresh status
      clearInterval(timerInterval);
      checkBlockingStatus();
      return;
    }
    
    // Format time remaining
    const hours = Math.floor(timeRemaining / (1000 * 60 * 60));
    const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeRemaining % (1000 * 60)) / 1000);
    
    timerElement.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }, 1000);
}

// Update UI with current settings and statistics
function updateUI() {
  // Update toggles
  document.getElementById('blocking-toggle').checked = currentSettings.blocking.enabled;
  document.getElementById('detox-toggle').checked = currentSettings.detoxification.enabled;
  document.getElementById('media-toggle').checked = currentSettings.mediaFilter.enabled;
  
  // Update status message
  const statusMessage = document.getElementById('status-message');
  if (isBlocked) {
    statusMessage.textContent = 'Twitter is currently blocked';
    statusMessage.className = 'status blocked';
    document.getElementById('override-button').style.display = 'block';
  } else {
    statusMessage.textContent = 'Twitter is currently accessible';
    statusMessage.className = 'status active';
    document.getElementById('override-button').style.display = currentSettings.blocking.enabled ? 'block' : 'none';
  }
  
  // Update statistics
  const today = new Date().toISOString().split('T')[0];
  const todayStats = currentStats.dailyUsage[today] || { visits: 0, timeSpent: 0, filtered: 0 };
  
  document.getElementById('today-usage').textContent = formatMinutes(todayStats.timeSpent);
  
  const filteredContent = currentStats.filteredContent.posts + currentStats.filteredContent.accounts;
  document.getElementById('filtered-count').textContent = filteredContent;
  
  const filteredMedia = currentStats.filteredContent.images + currentStats.filteredContent.videos;
  document.getElementById('media-filtered').textContent = filteredMedia;
}

// Format minutes as hours and minutes
function formatMinutes(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  } else {
    return `${mins}m`;
  }
}

// Set up event listeners
function setupEventListeners() {
  // Blocking toggle
  document.getElementById('blocking-toggle').addEventListener('change', (e) => {
    currentSettings.blocking.enabled = e.target.checked;
    saveSettings();
    
    // Update override button visibility
    document.getElementById('override-button').style.display = e.target.checked ? 'block' : 'none';
  });
  
  // Detoxification toggle
  document.getElementById('detox-toggle').addEventListener('change', (e) => {
    currentSettings.detoxification.enabled = e.target.checked;
    saveSettings();
  });
  
  // Media filtering toggle
  document.getElementById('media-toggle').addEventListener('change', (e) => {
    currentSettings.mediaFilter.enabled = e.target.checked;
    saveSettings();
  });
  
  // Override button
  document.getElementById('override-button').addEventListener('click', () => {
    requestOverride();
  });
  
  // Options button
  document.getElementById('options-button').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
}

// Save settings
function saveSettings() {
  chrome.runtime.sendMessage({
    action: "updateSettings",
    settings: currentSettings
  });
}

// Request override for blocking
async function requestOverride() {
  chrome.runtime.sendMessage({action: "requestOverride"}, response => {
    if (response.success) {
      // Update UI to show override is active
      const statusMessage = document.getElementById('status-message');
      statusMessage.textContent = `Override active for ${response.cooldown} minutes`;
      statusMessage.className = 'status active';
      
      // Hide timer
      document.getElementById('timer-container').style.display = 'none';
      
      // Disable override button temporarily
      const overrideButton = document.getElementById('override-button');
      overrideButton.disabled = true;
      overrideButton.textContent = 'Override Active';
      
      // Re-enable after cooldown
      setTimeout(() => {
        overrideButton.disabled = false;
        overrideButton.textContent = 'Override Block';
        checkBlockingStatus();
      }, response.cooldown * 60 * 1000);
    }
  });
}
