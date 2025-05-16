/**
 * Twitter Detoxifier - Blocked Page Script
 * Handles the blocked page UI and override functionality
 */

// Initialize blocked page
document.addEventListener('DOMContentLoaded', async () => {
  // Load settings
  const settings = await getSettings();
  
  // Load statistics
  const statistics = await getStatistics();
  
  // Update block message
  document.getElementById('block-message').textContent = settings.blocking.blockMessage;
  
  // Update statistics
  updateStatistics(statistics);
  
  // Calculate and display next available time
  calculateNextAvailable(settings);
  
  // Set up override button
  setupOverrideButton(settings);
  
  // Set up options button
  document.getElementById('options-button').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
});

// Get settings from storage
async function getSettings() {
  return new Promise(resolve => {
    chrome.runtime.sendMessage({action: "getSettings"}, response => {
      resolve(response);
    });
  });
}

// Get statistics from storage
async function getStatistics() {
  return new Promise(resolve => {
    chrome.runtime.sendMessage({action: "getStatistics"}, response => {
      resolve(response);
    });
  });
}

// Update statistics display
function updateStatistics(statistics) {
  // Get today's date
  const today = new Date().toISOString().split('T')[0];
  const todayStats = statistics.dailyUsage[today] || { visits: 0, timeSpent: 0, filtered: 0 };
  
  // Update visit count
  document.getElementById('visit-count').textContent = todayStats.visits;
  
  // Calculate time saved
  const filteredItems = 
    statistics.filteredContent.posts + 
    statistics.filteredContent.accounts + 
    statistics.filteredContent.images + 
    statistics.filteredContent.videos;
  
  const minutesSaved = Math.floor(filteredItems * 0.5); // 30 seconds per item
  document.getElementById('time-saved').textContent = minutesSaved;
}

// Calculate and display next available time
function calculateNextAvailable(settings) {
  const now = new Date();
  const currentDay = now.getDay();
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  
  let nextEndTime = null;
  let nextEndDay = currentDay;
  
  // First check if we're currently in a blocking period
  for (const schedule of settings.blocking.schedule) {
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
            nextEndDay = (currentDay + 1) % 7;
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
  
  // If we found a next end time, display it
  if (nextEndTime) {
    const [hours, minutes] = nextEndTime.split(':').map(Number);
    const endTime = new Date();
    endTime.setHours(hours, minutes, 0, 0);
    
    // If next end day is different from current day, adjust the date
    if (nextEndDay !== currentDay) {
      endTime.setDate(endTime.getDate() + 1);
    }
    
    // Calculate time remaining
    const timeRemaining = endTime - now;
    
    // Format time remaining
    const hoursRemaining = Math.floor(timeRemaining / (1000 * 60 * 60));
    const minutesRemaining = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
    
    let timeDisplay = '';
    if (hoursRemaining > 0) {
      timeDisplay += `${hoursRemaining}h `;
    }
    timeDisplay += `${minutesRemaining}m`;
    
    document.getElementById('next-available').textContent = timeDisplay;
    
    // Start countdown
    startCountdown(endTime);
  } else {
    // No active blocking period found, this shouldn't happen
    document.getElementById('next-available').textContent = 'Unknown';
  }
}

// Start countdown timer
function startCountdown(endTime) {
  const countdownInterval = setInterval(() => {
    const now = new Date();
    const timeRemaining = endTime - now;
    
    if (timeRemaining <= 0) {
      // Timer expired, Twitter should be available now
      clearInterval(countdownInterval);
      window.location.href = 'https://twitter.com';
      return;
    }
    
    // Format time remaining
    const hoursRemaining = Math.floor(timeRemaining / (1000 * 60 * 60));
    const minutesRemaining = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
    const secondsRemaining = Math.floor((timeRemaining % (1000 * 60)) / 1000);
    
    let timeDisplay = '';
    if (hoursRemaining > 0) {
      timeDisplay += `${hoursRemaining}h `;
    }
    timeDisplay += `${minutesRemaining}m ${secondsRemaining}s`;
    
    document.getElementById('next-available').textContent = timeDisplay;
  }, 1000);
}

// Set up override button
function setupOverrideButton(settings) {
  const overrideButton = document.getElementById('override-button');
  
  if (!settings.blocking.allowOverride) {
    // Hide override button if not allowed
    overrideButton.style.display = 'none';
    return;
  }
  
  overrideButton.addEventListener('click', () => {
    chrome.runtime.sendMessage({action: "requestOverride"}, response => {
      if (response.success) {
        // Show override countdown
        document.getElementById('override-countdown').style.display = 'block';
        document.getElementById('cooldown-timer').textContent = response.cooldown;
        
        // Disable override button
        overrideButton.disabled = true;
        
        // Redirect to Twitter after a short delay
        setTimeout(() => {
          window.location.href = 'https://twitter.com';
        }, 1500);
      }
    });
  });
}
