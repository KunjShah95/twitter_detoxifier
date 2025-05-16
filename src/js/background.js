/**
 * Twitter Detoxifier - Background Script
 * Handles time-based blocking, scheduling, and core extension functionality
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
    overrideCooldown: 30, // minutes
    lastOverride: null
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

// Initialize extension
chrome.runtime.onInstalled.addListener(async () => {
  console.log("Twitter Detoxifier installed");
  
  // Initialize settings if not already set
  const settings = await chrome.storage.local.get("settings");
  if (!settings.settings) {
    await chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
    console.log("Default settings initialized");
  }
  
  // Initialize statistics storage
  const stats = await chrome.storage.local.get("statistics");
  if (!stats.statistics) {
    await chrome.storage.local.set({
      statistics: {
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
      }
    });
    console.log("Statistics storage initialized");
  }
  
  // Set up alarms for periodic checks
  chrome.alarms.create("checkBlocking", { periodInMinutes: 1 });
  chrome.alarms.create("updateStatistics", { periodInMinutes: 5 });
});

// Check if Twitter should be blocked based on current time and schedule
async function shouldBlockTwitter() {
  const { settings } = await chrome.storage.local.get("settings");
  
  if (!settings.blocking.enabled) {
    return false;
  }
  
  // Check for active override
  if (settings.blocking.allowOverride && settings.blocking.lastOverride) {
    const overrideTime = new Date(settings.blocking.lastOverride);
    const cooldownMinutes = settings.blocking.overrideCooldown;
    const now = new Date();
    
    // If override is still active, don't block
    if ((now - overrideTime) / (1000 * 60) < cooldownMinutes) {
      return false;
    }
  }
  
  const now = new Date();
  const currentDay = now.getDay(); // 0 = Sunday, 6 = Saturday
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  
  // Check each schedule entry
  for (const schedule of settings.blocking.schedule) {
    // Check if current day is in the schedule
    if (schedule.days.includes(currentDay)) {
      // Handle schedules that cross midnight
      if (schedule.startTime <= schedule.endTime) {
        // Normal schedule (e.g., 9:00 to 17:00)
        if (currentTime >= schedule.startTime && currentTime < schedule.endTime) {
          return true;
        }
      } else {
        // Schedule crosses midnight (e.g., 23:00 to 06:00)
        if (currentTime >= schedule.startTime || currentTime < schedule.endTime) {
          return true;
        }
      }
    }
  }
  
  return false;
}

// Handle navigation to Twitter
chrome.webNavigation.onCommitted.addListener(async (details) => {
  // Only process main frame navigation to Twitter domains
  if (details.frameId !== 0) return;
  if (!details.url.match(/https:\/\/(twitter\.com|x\.com)/)) return;
  
  // Check if we should block Twitter
  if (await shouldBlockTwitter()) {
    // Redirect to blocking page
    chrome.tabs.update(details.tabId, {
      url: chrome.runtime.getURL("html/blocked.html")
    });
    
    // Update statistics
    updateBlockingStatistics();
  } else {
    // Twitter is allowed, update visit statistics
    updateVisitStatistics();
  }
});

// Handle alarm events
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "checkBlocking") {
    // Check all open Twitter tabs and block if needed
    const shouldBlock = await shouldBlockTwitter();
    if (shouldBlock) {
      const tabs = await chrome.tabs.query({ url: ["*://twitter.com/*", "*://x.com/*"] });
      for (const tab of tabs) {
        chrome.tabs.update(tab.id, {
          url: chrome.runtime.getURL("html/blocked.html")
        });
      }
    }
  } else if (alarm.name === "updateStatistics") {
    // Update time spent statistics for open Twitter tabs
    updateTimeSpentStatistics();
  }
});

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "checkBlocking") {
    shouldBlockTwitter().then(shouldBlock => {
      sendResponse({ blocked: shouldBlock });
    });
    return true; // Indicates async response
  } else if (message.action === "requestOverride") {
    handleOverrideRequest().then(result => {
      sendResponse(result);
    });
    return true; // Indicates async response
  } else if (message.action === "getSettings") {
    chrome.storage.local.get("settings").then(data => {
      sendResponse(data.settings);
    });
    return true; // Indicates async response
  } else if (message.action === "updateSettings") {
    chrome.storage.local.set({ settings: message.settings }).then(() => {
      sendResponse({ success: true });
    });
    return true; // Indicates async response
  } else if (message.action === "getStatistics") {
    chrome.storage.local.get("statistics").then(data => {
      sendResponse(data.statistics);
    });
    return true; // Indicates async response
  }
});

// Handle override requests
async function handleOverrideRequest() {
  const { settings } = await chrome.storage.local.get("settings");
  
  if (!settings.blocking.allowOverride) {
    return { success: false, message: "Overrides are not allowed in your settings." };
  }
  
  // Set override timestamp
  settings.blocking.lastOverride = new Date().toISOString();
  await chrome.storage.local.set({ settings });
  
  return { 
    success: true, 
    message: `Override granted for ${settings.blocking.overrideCooldown} minutes.`,
    cooldown: settings.blocking.overrideCooldown
  };
}

// Statistics tracking functions
async function updateVisitStatistics() {
  const { statistics } = await chrome.storage.local.get("statistics");
  
  statistics.visits += 1;
  
  // Update daily usage
  const today = new Date().toISOString().split('T')[0];
  if (!statistics.dailyUsage[today]) {
    statistics.dailyUsage[today] = { visits: 0, timeSpent: 0, filtered: 0 };
  }
  statistics.dailyUsage[today].visits += 1;
  
  await chrome.storage.local.set({ statistics });
}

async function updateTimeSpentStatistics() {
  const tabs = await chrome.tabs.query({ url: ["*://twitter.com/*", "*://x.com/*"] });
  
  if (tabs.length > 0) {
    const { statistics } = await chrome.storage.local.get("statistics");
    
    // Add 5 minutes (our check interval) for each open Twitter tab
    const minutesToAdd = 5 * tabs.length;
    statistics.timeSpent += minutesToAdd;
    
    // Update daily usage
    const today = new Date().toISOString().split('T')[0];
    if (!statistics.dailyUsage[today]) {
      statistics.dailyUsage[today] = { visits: 0, timeSpent: 0, filtered: 0 };
    }
    statistics.dailyUsage[today].timeSpent += minutesToAdd;
    
    await chrome.storage.local.set({ statistics });
  }
}

async function updateBlockingStatistics() {
  // Could be used to track blocking events if needed
  console.log("Twitter blocked at " + new Date().toISOString());
}
