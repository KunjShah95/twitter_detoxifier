/**
 * Twitter Detoxifier - Media Filter Module
 * Handles image and video filtering based on keywords and content analysis
 */

class MediaFilter {
  constructor(settings) {
    this.settings = settings;
    this.filteredImages = 0;
    this.filteredVideos = 0;
    this.processedMedia = new Set(); // Track processed media to avoid duplicates
  }

  // Update settings
  updateSettings(newSettings) {
    this.settings = newSettings;
  }

  // Process all media elements in the feed
  processMediaInFeed() {
    if (!this.settings || !this.settings.mediaFilter.enabled) {
      return;
    }

    // Process images
    this.processImages();
    
    // Process videos
    this.processVideos();
    
    return {
      images: this.filteredImages,
      videos: this.filteredVideos
    };
  }

  // Process all images in the feed
  processImages() {
    // Find all images that might be content (profile pictures excluded)
    const images = document.querySelectorAll('img[src*="pbs.twimg.com/media"]');
    
    images.forEach(img => {
      // Skip if already processed
      if (this.processedMedia.has(img.src)) {
        return;
      }
      
      // Mark as processed
      this.processedMedia.add(img.src);
      
      // Check if image should be filtered
      if (this.shouldFilterMedia(img)) {
        this.applyMediaFilter(img, 'image');
        this.filteredImages++;
      }
    });
  }

  // Process all videos in the feed
  processVideos() {
    // Find all video elements
    const videos = document.querySelectorAll('video');
    
    videos.forEach(video => {
      // Generate a unique ID for the video
      const videoId = video.src || video.currentSrc || `video_${Date.now()}_${Math.random()}`;
      
      // Skip if already processed
      if (this.processedMedia.has(videoId)) {
        return;
      }
      
      // Mark as processed
      this.processedMedia.add(videoId);
      
      // Check if video should be filtered
      if (this.shouldFilterMedia(video)) {
        this.applyMediaFilter(video, 'video');
        this.filteredVideos++;
      }
    });
  }

  // Determine if media should be filtered based on surrounding context and keywords
  shouldFilterMedia(mediaElement) {
    if (!this.settings.mediaFilter.filterKeywords || 
        this.settings.mediaFilter.filterKeywords.length === 0) {
      return false;
    }
    
    // Get the tweet containing this media
    const tweet = this.findParentTweet(mediaElement);
    if (!tweet) {
      return false;
    }
    
    // Get text content from the tweet
    const tweetText = this.extractTweetText(tweet);
    
    // Get alt text from image if available
    let altText = '';
    if (mediaElement.tagName === 'IMG' && mediaElement.alt) {
      altText = mediaElement.alt.toLowerCase();
    }
    
    // Get video caption if available
    let videoCaption = '';
    if (mediaElement.tagName === 'VIDEO') {
      const captionElement = tweet.querySelector('[data-testid="videoCaption"]');
      if (captionElement) {
        videoCaption = captionElement.textContent.toLowerCase();
      }
    }
    
    // Combine all text sources
    const combinedText = `${tweetText} ${altText} ${videoCaption}`.toLowerCase();
    
    // Check for sensitive content markers from Twitter itself
    if (tweet.querySelector('[data-testid="sensitiveContentWarning"]')) {
      return true;
    }
    
    // Check for media filter keywords
    for (const keyword of this.settings.mediaFilter.filterKeywords) {
      if (combinedText.includes(keyword.toLowerCase())) {
        return true;
      }
    }
    
    // Additional heuristics for potentially sensitive content
    const sensitivePatterns = [
      'sensitive content',
      'graphic',
      'nsfw',
      'not safe for work',
      'trigger warning',
      'tw:',
      'cw:',
      'content warning'
    ];
    
    for (const pattern of sensitivePatterns) {
      if (combinedText.includes(pattern)) {
        return true;
      }
    }
    
    return false;
  }

  // Find the parent tweet element containing the media
  findParentTweet(element) {
    let current = element;
    while (current && current.tagName !== 'ARTICLE') {
      current = current.parentElement;
    }
    
    if (current && current.hasAttribute('data-testid') && 
        current.getAttribute('data-testid') === 'tweet') {
      return current;
    }
    
    return null;
  }

  // Extract text content from a tweet
  extractTweetText(tweetElement) {
    const textElement = tweetElement.querySelector('[data-testid="tweetText"]');
    return textElement ? textElement.textContent.toLowerCase() : '';
  }

  // Apply filtering to media element
  applyMediaFilter(mediaElement, mediaType) {
    // Skip if already filtered
    if (mediaElement.dataset.filtered === 'true') {
      return;
    }
    
    // Mark as filtered
    mediaElement.dataset.filtered = 'true';
    
    // Create container for the media element if it doesn't exist
    let container = mediaElement.closest('.detoxifier-media-container');
    
    if (!container) {
      container = document.createElement('div');
      container.className = 'detoxifier-media-container';
      
      // Replace media with container
      mediaElement.parentNode.insertBefore(container, mediaElement);
      container.appendChild(mediaElement);
    }
    
    // Apply blur effect if enabled
    if (this.settings.mediaFilter.blurImages) {
      mediaElement.style.filter = 'blur(20px)';
    }
    
    // Create overlay with button if it doesn't exist
    if (!container.querySelector('.detoxifier-media-overlay')) {
      const overlay = document.createElement('div');
      overlay.className = 'detoxifier-media-overlay';
      overlay.innerHTML = `
        <div class="detoxifier-media-message">
          <p>Filtered ${mediaType}</p>
          ${this.settings.mediaFilter.allowReview ? 
            '<button class="detoxifier-reveal-button">Reveal</button>' : ''}
        </div>
      `;
      
      container.appendChild(overlay);
      
      // Add event listener to reveal button if review is allowed
      if (this.settings.mediaFilter.allowReview) {
        const revealButton = overlay.querySelector('.detoxifier-reveal-button');
        revealButton.addEventListener('click', (e) => {
          e.stopPropagation();
          mediaElement.style.filter = 'none';
          overlay.style.display = 'none';
        });
      }
    }
  }

  // Get statistics about filtered media
  getFilterStats() {
    return {
      images: this.filteredImages,
      videos: this.filteredVideos
    };
  }

  // Reset statistics counters
  resetStats() {
    this.filteredImages = 0;
    this.filteredVideos = 0;
  }
}

// Export the module if running in CommonJS environment
if (typeof module !== 'undefined') {
  module.exports = MediaFilter;
}
// Expose MediaFilter globally for content scripts
if (typeof window !== 'undefined') {
  window.MediaFilter = MediaFilter;
}
