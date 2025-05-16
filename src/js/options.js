/**
 * Twitter Detoxifier - Options Page Script
 * Handles settings management and UI interactions for the options page
 */

// Default settings
const DEFAULT_SETTINGS = {
  blocking: {
    enabled: true,
    schedule: [
      // Default schedule blocks Twitter during work hours
      { days: [1, 2, 3, 4, 5], startTime: "09:00", endTime: "17:00" },
      // And late night
      { days: [0, 1, 2, 3, 4, 5, 6], startTime: "23:00", endTime: "06:00" }
    ],
    blockMessage: "Twitter is currently blocked. Focus on what matters!",
    allowOverride: true,
    overrideCooldown: 30 // minutes
  },
  detoxification: {
    enabled: true,
    toxicityLevel: "moderate", // mild, moderate, strict
    filterAccounts: [],
    filterKeywords: ["toxic", "hate", "offensive"]
  },
  mediaFilter: {
    enabled: true,
    filterKeywords: ["sensitive", "graphic", "nsfw"],
    blurImages: true,
    allowReview: true
  },
  statistics: {
    trackUsage: true,
    trackFiltered: true,
    showInSidebar: false
  }
};

// Current settings
let currentSettings = {};
let currentStats = {};

// Initialize options page
document.addEventListener('DOMContentLoaded', async () => {
  // Load current settings
  await loadSettings();
  
  // Load current statistics
  await loadStatistics();
  
  // Set up event listeners
  setupEventListeners();
});

// Load settings from storage
async function loadSettings() {
  return new Promise(resolve => {
    chrome.runtime.sendMessage({action: "getSettings"}, response => {
      currentSettings = response || DEFAULT_SETTINGS;
      populateSettingsUI();
      resolve(currentSettings);
    });
  });
}

// Load statistics from storage
async function loadStatistics() {
  return new Promise(resolve => {
    chrome.runtime.sendMessage({action: "getStatistics"}, response => {
      currentStats = response || {
        timeSpent: 0,
        visits: 0,
        filteredContent: {
          posts: 0,
          accounts: 0,
          images: 0,
          videos: 0
        },
        lastReset: new Date().toISOString(),
        dailyUsage: {}
      };
      updateStatisticsUI();
      resolve(currentStats);
    });
  });
}

// Populate UI with current settings
function populateSettingsUI() {
  // Blocking settings
  document.getElementById('blocking-enabled').checked = currentSettings.blocking.enabled;
  document.getElementById('block-message').value = currentSettings.blocking.blockMessage;
  document.getElementById('allow-override').checked = currentSettings.blocking.allowOverride;
  document.getElementById('override-cooldown').value = currentSettings.blocking.overrideCooldown;
  
  // Schedule
  const scheduleList = document.getElementById('schedule-list');
  scheduleList.innerHTML = '';
  
  currentSettings.blocking.schedule.forEach((schedule, index) => {
    const scheduleItem = createScheduleItem(schedule, index);
    scheduleList.appendChild(scheduleItem);
  });
  
  // Detoxification settings
  document.getElementById('detox-enabled').checked = currentSettings.detoxification.enabled;
  document.getElementById('toxicity-level').value = currentSettings.detoxification.toxicityLevel;
  
  // Keywords
  const keywordList = document.getElementById('keyword-list');
  keywordList.innerHTML = '';
  
  currentSettings.detoxification.filterKeywords.forEach(keyword => {
    const keywordTag = createKeywordTag(keyword, 'keyword');
    keywordList.appendChild(keywordTag);
  });
  
  // Accounts
  const accountList = document.getElementById('account-list');
  accountList.innerHTML = '';
  
  currentSettings.detoxification.filterAccounts.forEach(account => {
    const accountTag = createKeywordTag(account, 'account');
    accountList.appendChild(accountTag);
  });
  
  // Media filter settings
  document.getElementById('media-enabled').checked = currentSettings.mediaFilter.enabled;
  document.getElementById('blur-images').checked = currentSettings.mediaFilter.blurImages;
  document.getElementById('allow-review').checked = currentSettings.mediaFilter.allowReview;
  
  // Media keywords
  const mediaKeywordList = document.getElementById('media-keyword-list');
  mediaKeywordList.innerHTML = '';
  
  currentSettings.mediaFilter.filterKeywords.forEach(keyword => {
    const keywordTag = createKeywordTag(keyword, 'media-keyword');
    mediaKeywordList.appendChild(keywordTag);
  });
  
  // Statistics settings
  document.getElementById('track-usage').checked = currentSettings.statistics.trackUsage;
  document.getElementById('track-filtered').checked = currentSettings.statistics.trackFiltered;
  document.getElementById('show-sidebar').checked = currentSettings.statistics.showInSidebar;
}

// Update statistics UI
function updateStatisticsUI() {
  // Get today's date
  const today = new Date().toISOString().split('T')[0];
  const todayStats = currentStats.dailyUsage[today] || { visits: 0, timeSpent: 0, filtered: 0 };
  
  // Update statistics display
  document.getElementById('time-spent').textContent = formatMinutes(todayStats.timeSpent);
  document.getElementById('visits').textContent = todayStats.visits;
  
  const filteredContent = currentStats.filteredContent.posts + currentStats.filteredContent.accounts;
  document.getElementById('filtered-content').textContent = filteredContent;
  
  const filteredMedia = currentStats.filteredContent.images + currentStats.filteredContent.videos;
  document.getElementById('filtered-media').textContent = filteredMedia;
  
  // Calculate time saved (rough estimate)
  const timeSaved = Math.floor((filteredContent + filteredMedia) * 0.5); // 30 seconds per item
  document.getElementById('time-saved').textContent = formatMinutes(timeSaved);
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

// Create a schedule item element
function createScheduleItem(schedule, index) {
  const item = document.createElement('div');
  item.className = 'schedule-item';
  item.dataset.index = index;
  
  const daysContainer = document.createElement('div');
  daysContainer.className = 'schedule-days';
  
  const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  
  for (let i = 0; i < 7; i++) {
    const dayLabel = document.createElement('label');
    dayLabel.className = 'day-checkbox';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = schedule.days.includes(i);
    checkbox.dataset.day = i;
    
    dayLabel.appendChild(checkbox);
    dayLabel.appendChild(document.createTextNode(dayNames[i]));
    daysContainer.appendChild(dayLabel);
  }
  
  const timesContainer = document.createElement('div');
  timesContainer.className = 'schedule-times';
  
  const startTimeInput = document.createElement('input');
  startTimeInput.type = 'time';
  startTimeInput.value = schedule.startTime;
  startTimeInput.className = 'start-time';
  
  const toText = document.createElement('span');
  toText.textContent = 'to';
  
  const endTimeInput = document.createElement('input');
  endTimeInput.type = 'time';
  endTimeInput.value = schedule.endTime;
  endTimeInput.className = 'end-time';
  
  timesContainer.appendChild(startTimeInput);
  timesContainer.appendChild(toText);
  timesContainer.appendChild(endTimeInput);
  
  const removeButton = document.createElement('button');
  removeButton.className = 'schedule-remove';
  removeButton.textContent = '×';
  removeButton.title = 'Remove schedule';
  
  item.appendChild(daysContainer);
  item.appendChild(timesContainer);
  item.appendChild(removeButton);
  
  return item;
}

// Create a keyword tag element
function createKeywordTag(text, type) {
  const tag = document.createElement('div');
  tag.className = 'keyword-tag';
  tag.dataset.type = type;
  tag.dataset.value = text;
  
  const textNode = document.createElement('span');
  textNode.textContent = text;
  
  const removeButton = document.createElement('button');
  removeButton.className = 'keyword-remove';
  removeButton.textContent = '×';
  removeButton.title = 'Remove';
  
  tag.appendChild(textNode);
  tag.appendChild(removeButton);
  
  return tag;
}

// Set up event listeners
function setupEventListeners() {
  // Add schedule button
  document.getElementById('add-schedule').addEventListener('click', () => {
    const newSchedule = {
      days: [1, 2, 3, 4, 5], // Monday to Friday
      startTime: "09:00",
      endTime: "17:00"
    };
    
    const scheduleItem = createScheduleItem(newSchedule, currentSettings.blocking.schedule.length);
    document.getElementById('schedule-list').appendChild(scheduleItem);
  });
  
  // Add keyword button
  document.getElementById('add-keyword').addEventListener('click', () => {
    const input = document.getElementById('new-keyword');
    const keyword = input.value.trim();
    
    if (keyword) {
      const keywordTag = createKeywordTag(keyword, 'keyword');
      document.getElementById('keyword-list').appendChild(keywordTag);
      input.value = '';
    }
  });
  
  // Add account button
  document.getElementById('add-account').addEventListener('click', () => {
    const input = document.getElementById('new-account');
    const account = input.value.trim().replace('@', '');
    
    if (account) {
      const accountTag = createKeywordTag(account, 'account');
      document.getElementById('account-list').appendChild(accountTag);
      input.value = '';
    }
  });
  
  // Add media keyword button
  document.getElementById('add-media-keyword').addEventListener('click', () => {
    const input = document.getElementById('new-media-keyword');
    const keyword = input.value.trim();
    
    if (keyword) {
      const keywordTag = createKeywordTag(keyword, 'media-keyword');
      document.getElementById('media-keyword-list').appendChild(keywordTag);
      input.value = '';
    }
  });
  
  // Remove schedule button
  document.getElementById('schedule-list').addEventListener('click', (e) => {
    if (e.target.className === 'schedule-remove') {
      e.target.closest('.schedule-item').remove();
    }
  });
  
  // Remove keyword/account button
  document.addEventListener('click', (e) => {
    if (e.target.className === 'keyword-remove') {
      e.target.closest('.keyword-tag').remove();
    }
  });
  
  // Save settings button
  document.getElementById('save-settings').addEventListener('click', saveSettings);
  
  // Restore defaults button
  document.getElementById('restore-defaults').addEventListener('click', () => {
    if (confirm('Are you sure you want to restore default settings? This will overwrite your current configuration.')) {
      currentSettings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
      populateSettingsUI();
    }
  });
  
  // Reset statistics button
  document.getElementById('reset-stats').addEventListener('click', () => {
    if (confirm('Are you sure you want to reset all statistics? This cannot be undone.')) {
      chrome.runtime.sendMessage({action: "resetStatistics"}, () => {
        loadStatistics();
      });
    }
  });
}

// Save settings
function saveSettings() {
  // Collect settings from UI
  
  // Blocking settings
  currentSettings.blocking.enabled = document.getElementById('blocking-enabled').checked;
  currentSettings.blocking.blockMessage = document.getElementById('block-message').value;
  currentSettings.blocking.allowOverride = document.getElementById('allow-override').checked;
  currentSettings.blocking.overrideCooldown = parseInt(document.getElementById('override-cooldown').value) || 30;
  
  // Schedule
  currentSettings.blocking.schedule = [];
  const scheduleItems = document.querySelectorAll('.schedule-item');
  
  scheduleItems.forEach(item => {
    const days = [];
    const dayCheckboxes = item.querySelectorAll('.day-checkbox input');
    
    dayCheckboxes.forEach(checkbox => {
      if (checkbox.checked) {
        days.push(parseInt(checkbox.dataset.day));
      }
    });
    
    const startTime = item.querySelector('.start-time').value;
    const endTime = item.querySelector('.end-time').value;
    
    if (days.length > 0 && startTime && endTime) {
      currentSettings.blocking.schedule.push({
        days,
        startTime,
        endTime
      });
    }
  });
  
  // Detoxification settings
  currentSettings.detoxification.enabled = document.getElementById('detox-enabled').checked;
  currentSettings.detoxification.toxicityLevel = document.getElementById('toxicity-level').value;
  
  // Keywords
  currentSettings.detoxification.filterKeywords = [];
  const keywordTags = document.querySelectorAll('.keyword-tag[data-type="keyword"]');
  
  keywordTags.forEach(tag => {
    currentSettings.detoxification.filterKeywords.push(tag.dataset.value);
  });
  
  // Accounts
  currentSettings.detoxification.filterAccounts = [];
  const accountTags = document.querySelectorAll('.keyword-tag[data-type="account"]');
  
  accountTags.forEach(tag => {
    currentSettings.detoxification.filterAccounts.push(tag.dataset.value);
  });
  
  // Media filter settings
  currentSettings.mediaFilter.enabled = document.getElementById('media-enabled').checked;
  currentSettings.mediaFilter.blurImages = document.getElementById('blur-images').checked;
  currentSettings.mediaFilter.allowReview = document.getElementById('allow-review').checked;
  
  // Media keywords
  currentSettings.mediaFilter.filterKeywords = [];
  const mediaKeywordTags = document.querySelectorAll('.keyword-tag[data-type="media-keyword"]');
  
  mediaKeywordTags.forEach(tag => {
    currentSettings.mediaFilter.filterKeywords.push(tag.dataset.value);
  });
  
  // Statistics settings
  currentSettings.statistics.trackUsage = document.getElementById('track-usage').checked;
  currentSettings.statistics.trackFiltered = document.getElementById('track-filtered').checked;
  currentSettings.statistics.showInSidebar = document.getElementById('show-sidebar').checked;
  
  // Save settings to storage
  chrome.runtime.sendMessage({
    action: "updateSettings",
    settings: currentSettings
  }, response => {
    if (response.success) {
      // Show success message
      const successMessage = document.getElementById('success-message');
      successMessage.style.display = 'block';
      
      // Hide after 3 seconds
      setTimeout(() => {
        successMessage.style.display = 'none';
      }, 3000);
    }
  });
}
