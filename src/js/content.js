/**
 * Twitter Detoxifier - Content Script
 * Handles feed detoxification, content filtering, and in-page modifications
 */

// Store for filtered content counts
let filteredStats = {
  posts: 0,
  accounts: 0,
  images: 0,
  videos: 0
};

// Settings cache
let settings = null;

// Media filter instance
let mediaFilter = null;

// Initialize content script
(async function() {
  console.log("Twitter Detoxifier content script loaded");
  
  // Load settings
  settings = await getSettings();
  
  // Initialize media filter
  if (typeof MediaFilter !== 'undefined') {
    mediaFilter = new MediaFilter(settings);
    console.log("Media filter module initialized");
  } else {
    console.error("MediaFilter class not found! Media filtering will not work.");
  }
  
  // Set up mutation observer to detect new content
  setupFeedObserver();
  
  // Process initial feed content
  processFeed();
  
  // Set up message listener for settings updates
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "settingsUpdated") {
      getSettings().then(newSettings => {
        settings = newSettings;
        
        // Update media filter settings
        if (mediaFilter) {
          mediaFilter.updateSettings(newSettings);
        }
        
        // Reprocess feed with new settings
        processFeed();
      });
      sendResponse({success: true});
    }
    return true;
  });
  
  // Send statistics updates periodically
  setInterval(updateFilterStatistics, 30000); // Every 30 seconds
})();

// Get extension settings from storage
async function getSettings() {
  return new Promise(resolve => {
    chrome.runtime.sendMessage({action: "getSettings"}, response => {
      console.log("Settings received:", response);
      resolve(response);
    });
  });
}

// Set up mutation observer to watch for new content in the feed
function setupFeedObserver() {
  // Create a mutation observer to detect when new tweets are added
  const observer = new MutationObserver(mutations => {
    let shouldProcess = false;
    
    for (const mutation of mutations) {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        shouldProcess = true;
        break;
      }
    }
    
    if (shouldProcess) {
      processFeed();
    }
  });
  
  // Start observing the timeline
  // Twitter's DOM structure may change, so we use a more general selector
  const observeInterval = setInterval(() => {
    const timeline = document.querySelector('[data-testid="primaryColumn"]');
    if (timeline) {
      console.log("Found Twitter timeline, setting up observer");
      observer.observe(timeline, { childList: true, subtree: true });
      clearInterval(observeInterval);
    } else {
      console.log("Searching for Twitter timeline...");
    }
  }, 1000);
}

// Process the Twitter feed to apply detoxification
function processFeed() {
  if (!settings) {
    console.log("Settings not loaded yet, skipping feed processing");
    return;
  }
  
  console.log("Processing Twitter feed with settings:", settings);
  
  // Process content filtering if enabled
  if (settings.detoxification && settings.detoxification.enabled) {
    console.log("Content filtering enabled with toxicity level:", settings.detoxification.toxicityLevel);
    processContentFiltering();
  } else {
    console.log("Content filtering disabled");
  }
  
  // Process media filtering if enabled and media filter is available
  if (settings.mediaFilter && settings.mediaFilter.enabled && mediaFilter) {
    console.log("Media filtering enabled");
    const mediaStats = mediaFilter.processMediaInFeed();
    if (mediaStats) {
      filteredStats.images += mediaStats.images;
      filteredStats.videos += mediaStats.videos;
      console.log(`Media filtered: ${mediaStats.images} images, ${mediaStats.videos} videos`);
    }
  } else {
    console.log("Media filtering disabled or unavailable");
  }
}

// Process content filtering
function processContentFiltering() {
  // Get all tweets currently in the feed
  const tweets = document.querySelectorAll('article[data-testid="tweet"]');
  console.log(`Found ${tweets.length} tweets to process`);
  
  tweets.forEach(tweet => {
    // Skip if already processed
    if (tweet.dataset.detoxified === 'true') {
      return;
    }
    
    // Mark as processed
    tweet.dataset.detoxified = 'true';
    
    // Check if tweet is from a filtered account
    if (isFilteredAccount(tweet)) {
      console.log("Filtering tweet from blocked account");
      filterTweet(tweet, 'account');
      return;
    }
    
    // Check tweet content for toxic keywords
    if (containsToxicContent(tweet)) {
      console.log("Filtering tweet with toxic content");
      filterTweet(tweet, 'content');
      return;
    }
  });
}

// Check if tweet is from a filtered account
function isFilteredAccount(tweet) {
  if (!settings.detoxification.filterAccounts || settings.detoxification.filterAccounts.length === 0) {
    return false;
  }
  
  // Get username from tweet
  const usernameElement = tweet.querySelector('[data-testid="User-Name"] a:nth-child(2)');
  if (!usernameElement) return false;
  
  const username = usernameElement.textContent.trim().toLowerCase().replace('@', '');
  console.log("Checking account:", username);
  
  // Check if username is in filtered accounts list
  const isFiltered = settings.detoxification.filterAccounts.some(account => 
    account.toLowerCase() === username
  );
  
  if (isFiltered) {
    console.log(`Account ${username} is filtered`);
  }
  
  return isFiltered;
}

// Check if tweet contains toxic content based on keywords and toxicity level
function containsToxicContent(tweet) {
  if (!settings.detoxification.filterKeywords || settings.detoxification.filterKeywords.length === 0) {
    return false;
  }
  
  // Get tweet text content
  const tweetTextElement = tweet.querySelector('[data-testid="tweetText"]');
  if (!tweetTextElement) return false;
  
  const tweetText = tweetTextElement.textContent.toLowerCase();
  console.log("Checking tweet text:", tweetText.substring(0, 50) + (tweetText.length > 50 ? "..." : ""));
  
  // Check for toxic keywords
  const toxicityThreshold = getToxicityThreshold();
  let toxicityScore = 0;
  let matchedKeywords = [];
  
  for (const keyword of settings.detoxification.filterKeywords) {
    if (tweetText.includes(keyword.toLowerCase())) {
      toxicityScore += 1;
      matchedKeywords.push(keyword);
      
      // For strict filtering, one match is enough
      if (settings.detoxification.toxicityLevel === 'strict') {
        console.log(`Tweet contains toxic keyword: ${keyword} (strict filtering)`);
        return true;
      }
    }
  }
  
  const isFiltered = toxicityScore >= toxicityThreshold;
  if (isFiltered) {
    console.log(`Tweet contains toxic keywords: ${matchedKeywords.join(', ')} (score: ${toxicityScore}, threshold: ${toxicityThreshold})`);
  }
  
  return isFiltered;
}

// Get toxicity threshold based on settings
function getToxicityThreshold() {
  switch (settings.detoxification.toxicityLevel) {
    case 'mild':
      return 2; // Need at least 2 toxic keywords to filter
    case 'moderate':
      return 1; // Need at least 1 toxic keyword to filter
    case 'strict':
      return 1; // Strict is handled in containsToxicContent directly
    default:
      return 1;
  }
}

// Apply filtering to a tweet
function filterTweet(tweetElement, filterReason) {
  // Create filter overlay
  const overlay = document.createElement('div');
  overlay.className = 'detoxifier-filter-overlay';
  overlay.innerHTML = `
    <div class="detoxifier-filter-message">
      <p>Content filtered: ${filterReason === 'account' ? 'Tweet from filtered account' : 'Potentially toxic content'}</p>
      <button class="detoxifier-show-button">Show anyway</button>
    </div>
  `;
  
  // Style the tweet and overlay
  tweetElement.style.position = 'relative';
  tweetElement.style.opacity = '0.1';
  
  // Add overlay to tweet
  tweetElement.appendChild(overlay);
  
  // Add event listener to show button
  const showButton = overlay.querySelector('.detoxifier-show-button');
  showButton.addEventListener('click', (e) => {
    e.stopPropagation();
    tweetElement.style.opacity = '1';
    overlay.style.display = 'none';
  });
  
  // Update statistics
  if (filterReason === 'account') {
    filteredStats.accounts++;
  } else {
    filteredStats.posts++;
  }
  
  console.log(`Tweet filtered (reason: ${filterReason}). Stats: ${JSON.stringify(filteredStats)}`);
}

// Send updated filter statistics to background script
function updateFilterStatistics() {
  chrome.runtime.sendMessage({
    action: "updateFilterStats",
    stats: filteredStats
  });
}
