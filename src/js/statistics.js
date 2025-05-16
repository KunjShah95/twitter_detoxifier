/**
 * Twitter Detoxifier - Statistics Dashboard
 * Tracks and visualizes usage metrics and filtering statistics
 */

class StatisticsTracker {
  constructor() {
    this.stats = null;
    this.initialized = false;
  }

  // Initialize statistics tracker
  async initialize() {
    // Load existing statistics or create new ones
    this.stats = await this.loadStatistics();
    this.initialized = true;
    
    // Start tracking session
    this.startSession();
    
    return this.stats;
  }

  // Load statistics from storage
  async loadStatistics() {
    return new Promise(resolve => {
      chrome.runtime.sendMessage({action: "getStatistics"}, response => {
        resolve(response);
      });
    });
  }

  // Start a new tracking session
  startSession() {
    if (!this.initialized) return;
    
    // Record session start time
    this.sessionStartTime = new Date();
    
    // Update visit count
    this.updateVisitCount();
    
    // Set up periodic updates
    this.trackingInterval = setInterval(() => {
      this.updateTimeSpent();
    }, 60000); // Update every minute
  }

  // End the current tracking session
  endSession() {
    if (!this.initialized) return;
    
    // Clear tracking interval
    if (this.trackingInterval) {
      clearInterval(this.trackingInterval);
      this.trackingInterval = null;
    }
    
    // Final update of time spent
    this.updateTimeSpent();
  }

  // Update visit count
  async updateVisitCount() {
    if (!this.initialized) return;
    
    // Send message to update visit count
    chrome.runtime.sendMessage({
      action: "updateStatistic",
      statistic: "visits",
      increment: 1
    });
  }

  // Update time spent on Twitter
  async updateTimeSpent() {
    if (!this.initialized || !this.sessionStartTime) return;
    
    // Calculate minutes spent since last update
    const now = new Date();
    const minutesSpent = Math.floor((now - this.sessionStartTime) / 60000);
    
    if (minutesSpent > 0) {
      // Send message to update time spent
      chrome.runtime.sendMessage({
        action: "updateStatistic",
        statistic: "timeSpent",
        increment: minutesSpent
      });
      
      // Reset session start time for next interval
      this.sessionStartTime = now;
    }
  }

  // Update filtered content statistics
  async updateFilteredStats(filterStats) {
    if (!this.initialized) return;
    
    // Send message to update filtered content stats
    chrome.runtime.sendMessage({
      action: "updateFilteredStats",
      stats: filterStats
    });
  }

  // Get current statistics
  async getStatistics() {
    return await this.loadStatistics();
  }

  // Create statistics dashboard in the sidebar
  async createDashboard() {
    if (!this.initialized) await this.initialize();
    
    // Get latest statistics
    const stats = await this.getStatistics();
    
    // Create dashboard element if it doesn't exist
    let dashboard = document.getElementById('detoxifier-stats-dashboard');
    if (!dashboard) {
      dashboard = document.createElement('div');
      dashboard.id = 'detoxifier-stats-dashboard';
      dashboard.className = 'detoxifier-stats-sidebar';
      document.body.appendChild(dashboard);
    }
    
    // Update dashboard content
    dashboard.innerHTML = `
      <div class="detoxifier-stats-header">
        <h3>Twitter Detoxifier Stats</h3>
        <button class="detoxifier-stats-close">×</button>
      </div>
      
      <div class="detoxifier-stats-item">
        <span class="detoxifier-stats-label">Time spent today:</span>
        <span class="detoxifier-stats-value">${this.formatMinutes(this.getTodayTimeSpent(stats))}</span>
      </div>
      
      <div class="detoxifier-stats-item">
        <span class="detoxifier-stats-label">Visits today:</span>
        <span class="detoxifier-stats-value">${this.getTodayVisits(stats)}</span>
      </div>
      
      <div class="detoxifier-stats-item">
        <span class="detoxifier-stats-label">Content filtered:</span>
        <span class="detoxifier-stats-value">${stats.filteredContent.posts}</span>
      </div>
      
      <div class="detoxifier-stats-item">
        <span class="detoxifier-stats-label">Accounts filtered:</span>
        <span class="detoxifier-stats-value">${stats.filteredContent.accounts}</span>
      </div>
      
      <div class="detoxifier-stats-item">
        <span class="detoxifier-stats-label">Images filtered:</span>
        <span class="detoxifier-stats-value">${stats.filteredContent.images}</span>
      </div>
      
      <div class="detoxifier-stats-item">
        <span class="detoxifier-stats-label">Videos filtered:</span>
        <span class="detoxifier-stats-value">${stats.filteredContent.videos}</span>
      </div>
      
      <div class="detoxifier-stats-item">
        <span class="detoxifier-stats-label">Total time saved:</span>
        <span class="detoxifier-stats-value">${this.formatMinutes(this.getTimeSaved(stats))}</span>
      </div>
    `;
    
    // Add event listener to close button
    const closeButton = dashboard.querySelector('.detoxifier-stats-close');
    closeButton.addEventListener('click', () => {
      dashboard.style.display = 'none';
    });
    
    return dashboard;
  }

  // Format minutes as hours and minutes
  formatMinutes(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    } else {
      return `${mins}m`;
    }
  }

  // Get time spent today
  getTodayTimeSpent(stats) {
    const today = new Date().toISOString().split('T')[0];
    return stats.dailyUsage[today]?.timeSpent || 0;
  }

  // Get visits today
  getTodayVisits(stats) {
    const today = new Date().toISOString().split('T')[0];
    return stats.dailyUsage[today]?.visits || 0;
  }

  // Calculate estimated time saved by blocking and filtering
  getTimeSaved(stats) {
    // Estimate time saved based on blocked sessions and filtered content
    // Assume each filtered item saves about 30 seconds of attention
    const filteredItems = 
      stats.filteredContent.posts + 
      stats.filteredContent.accounts + 
      stats.filteredContent.images + 
      stats.filteredContent.videos;
    
    const minutesSavedByFiltering = Math.floor(filteredItems * 0.5); // 30 seconds per item
    
    // Add time saved by blocking (this would be tracked separately in the background)
    // For now, just return the filtering time saved
    return minutesSavedByFiltering;
  }

  // Toggle dashboard visibility
  toggleDashboard() {
    const dashboard = document.getElementById('detoxifier-stats-dashboard');
    if (dashboard) {
      dashboard.style.display = dashboard.style.display === 'none' ? 'block' : 'none';
    } else {
      this.createDashboard();
    }
  }
}

// Export the module
if (typeof module !== 'undefined') {
  module.exports = StatisticsTracker;
}
