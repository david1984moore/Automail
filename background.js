/**
 * Background Service Worker for Automail Extension
 * Manages Gmail API authentication, email processing, AI integration, and background tasks
 * Handles OAuth flow, email fetching, labeling, and automated actions
 */

// AI API Configuration
const AI_API_CONFIG = {
  // Update this to your cloud server URL after deployment
  baseUrl: 'https://your-app-name.onrender.com',  // Replace with your actual URL
  // For local development, use: 'http://localhost:5000'
  apiKey: 'automail-dev-key-2024',   // API key for authentication
  timeout: 10000,                    // 10 second timeout
  retryAttempts: 3,                  // Retry failed requests
  batchSize: 10,                     // Maximum emails per batch request
  fallbackEnabled: true              // Enable rule-based fallback
};

const AUTO_PROCESSING_INTERVAL_MS = 60 * 1000; // Process every 1 minute
const MAX_STORED_EMAILS_COUNT = 500; // Limit to 500 most recent emails in local storage

// Email processing state and data
let currentProcessingBatch = 0;

// Extension lifecycle events
chrome.runtime.onInstalled.addListener(() => {
  console.log('Automail extension installed');
  initializeExtension();
});

chrome.runtime.onStartup.addListener(() => {
  console.log('Automail extension started');
  initializeExtension();
});

/**
 * Initialize extension settings and start background processes
 * Modified for maximum security - no automatic token validation
 */
async function initializeExtension() {
  try {
    console.log('🚀 Initializing Automail with FORCED fresh OAuth...');
    
    // SECURITY: Always clear ALL authentication data on startup
    // This ensures users MUST authenticate fresh every session with OAuth popup
    console.log('🧹 Clearing ALL authentication data and forcing OAuth popup...');
    await clearAllAuthenticationData();
    
    // Additional: Clear all cached auth tokens for maximum security
    try {
      await chrome.identity.clearAllCachedAuthTokens();
      console.log('✅ Cleared all Chrome identity cache');
    } catch (error) {
      console.log('Note: Chrome identity cache clear not available');
    }
    
    // Set default settings and ensure user is COMPLETELY logged out
    await chrome.storage.local.set({
      isAuthenticated: false,        // Always start logged out
      isProcessing: false,
      lastProcessedTime: Date.now(),
      emailData: [],
      userSettings: {
        autoReply: false,
        learningEnabled: true,
        notificationsEnabled: true
      },
      // Enhanced security flags
      sessionInvalidated: true,      // Mark session as invalid
      requiresFreshAuth: true,       // FORCE fresh OAuth popup
      navigationLogout: false,       // Reset navigation flag
      forceOAuthPopup: true,         // NEW: Force popup every time
      lastInitTime: Date.now()       // Track when extension was initialized
    });
    
    console.log('✅ Extension initialized - OAuth popup WILL be forced on next login');
  } catch (error) {
    console.error('❌ Error initializing extension:', error);
  }
}

/**
 * Handle messages from content scripts and extension interactions
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'login':
      handleLogin(sendResponse);
      return true; // Keep channel open for async response
    case 'logout':
      handleLogout(sendResponse);
      return true;
    case 'invalidateSession':
      handleSessionInvalidation(request.reason, sendResponse);
      return true;
    case 'startProcessing':
      startEmailProcessing(sendResponse);
      return true;
    case 'stopProcessing':
      stopEmailProcessing(sendResponse);
      return true;
    case 'fetchEmails':
      fetchEmails(sendResponse);
      return true;
    case 'classifyEmail':
      classifyEmail(request.content, request.subject, sendResponse);
      return true;
    case 'batchClassifyEmails':
      batchClassifyEmails(request.emails, sendResponse);
      return true;
    case 'testAIConnection':
      testAIConnection(sendResponse);
      return true;
    case 'debugOAuth':
      debugOAuthConfiguration(sendResponse);
      return true;
    case 'clearTokens':
      clearAllTokens(sendResponse);
      return true;
    case 'labelEmails':
      labelEmails(sendResponse);
      return true;
    default:
      sendResponse({ success: false, error: 'Unknown action' });
  }
});

/**
 * Safely extract token string from various token formats
 */
function extractTokenString(token) {
  if (!token) {
    return null;
  }
  
  // If already a string, return as-is
  if (typeof token === 'string') {
    return token;
  }
  
  // If it's an object, try to extract the token
  if (typeof token === 'object') {
    // Try common token properties
    if (token.token && typeof token.token === 'string') {
      return token.token;
    }
    if (token.access_token && typeof token.access_token === 'string') {
      return token.access_token;
    }
    if (token.accessToken && typeof token.accessToken === 'string') {
      return token.accessToken;
    }
    
    // If object has no recognizable token property, this is probably an error
    console.warn('Token object has unexpected structure:', Object.keys(token));
    return null;
  }
  
  console.warn('Token has unexpected type:', typeof token);
  return null;
}

/**
 * Safely remove cached auth token with improved error handling
 */
async function safelyRemoveCachedToken(token) {
  try {
    const tokenString = extractTokenString(token);
    
    if (!tokenString) {
      console.log('No valid token string to remove from cache');
      return false;
    }
    
    await chrome.identity.removeCachedAuthToken({ token: tokenString });
    console.log('✅ Successfully removed token from cache');
    return true;
    
  } catch (error) {
    console.log('Failed to remove cached token:', error.message);
    return false;
  }
}

/**
 * Clear all authentication data completely
 */
async function clearAllAuthenticationData() {
  try {
    console.log('🧹 Clearing all authentication data...');
    
    // Get any existing tokens
    const { authToken } = await chrome.storage.local.get(['authToken']);
    
    // Remove from Chrome cache using safe method
    if (authToken) {
      await safelyRemoveCachedToken(authToken);
    }
    
    // Try to clear any other cached tokens
    try {
      const anyToken = await chrome.identity.getAuthToken({ interactive: false });
      if (anyToken) {
        await safelyRemoveCachedToken(anyToken);
      }
    } catch (error) {
      console.log('No additional cached tokens found');
    }
    
    // Clear storage
    await chrome.storage.local.remove([
      'authToken', 
      'isAuthenticated', 
      'loginTime', 
      'userProfile',
      'sessionId',
      'lastActivity'
    ]);
    
    console.log('✅ All authentication data cleared');
  } catch (error) {
    console.error('Error clearing authentication data:', error);
  }
}

/**
 * Enhanced login with session validation and security checks
 * Forces fresh OAuth flow every time for maximum security
 */
async function handleLogin(sendResponse) {
  try {
    console.log('🔐 Starting secure login process with FORCED OAuth popup...');
    
    // Step 1: COMPLETELY clear any existing sessions and cached tokens
    await clearAllAuthenticationData();
    
    // Step 2: Clear Chrome's OAuth cache completely (force fresh flow)
    console.log('🧹 Clearing Chrome OAuth cache completely...');
    try {
      // Force removal of ALL cached tokens (multiple attempts)
      const cachedToken1 = await chrome.identity.getAuthToken({ interactive: false });
      if (cachedToken1) {
        await chrome.identity.removeCachedAuthToken({ token: cachedToken1 });
        console.log('✅ Removed cached token (attempt 1)');
      }
      
      // Try again to ensure complete clearance
      const cachedToken2 = await chrome.identity.getAuthToken({ interactive: false });
      if (cachedToken2) {
        await chrome.identity.removeCachedAuthToken({ token: cachedToken2 });
        console.log('✅ Removed cached token (attempt 2)');
      }
      
      // Try one more time to be absolutely sure
      const cachedToken3 = await chrome.identity.getAuthToken({ interactive: false });
      if (cachedToken3) {
        await chrome.identity.removeCachedAuthToken({ token: cachedToken3 });
        console.log('✅ Removed cached token (attempt 3)');
      }
    } catch (error) {
      console.log('✅ No cached tokens found to clear (expected)');
    }
    
    // Step 3: Force OAuth popup
    console.log('🔑 FORCING OAuth popup...');
    
    // First, try to clear all cached auth tokens
    try {
      await chrome.identity.clearAllCachedAuthTokens();
      console.log('✅ Cleared all cached auth tokens');
    } catch (error) {
      console.log('Note: clearAllCachedAuthTokens not available or failed:', error.message);
    }
    
    // Step 4: Force explicit OAuth popup using aggressive cache clearing + getAuthToken
    console.log('🚀 FORCING explicit OAuth popup with aggressive cache clearing...');
    
    // Ultra-aggressive cache clearing approach
    try {
      // Method 1: Clear using getAuthToken + removeCachedAuthToken in a loop
      for (let i = 0; i < 5; i++) {
        try {
          const cachedToken = await chrome.identity.getAuthToken({ interactive: false });
          if (cachedToken) {
            await chrome.identity.removeCachedAuthToken({ token: cachedToken });
            console.log(`✅ Cleared cached token (attempt ${i + 1})`);
          } else {
            console.log(`✅ No cached token found (attempt ${i + 1})`);
            break;
          }
        } catch (error) {
          console.log(`✅ Cache clear attempt ${i + 1} completed`);
          break;
        }
      }
      
      // Method 2: Try clearAllCachedAuthTokens multiple times
      for (let i = 0; i < 3; i++) {
        try {
          await chrome.identity.clearAllCachedAuthTokens();
          console.log(`✅ clearAllCachedAuthTokens (attempt ${i + 1})`);
        } catch (error) {
          console.log(`Note: clearAllCachedAuthTokens attempt ${i + 1} failed:`, error.message);
        }
      }
      
    } catch (error) {
      console.log('Cache clearing completed with some expected errors');
    }
    
    // Step 5: Add delay to ensure cache clearing takes effect
    console.log('⏳ Waiting for cache clearing to take effect...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Step 6: Final attempt - force OAuth with getAuthToken
    console.log('🎯 Final OAuth attempt - should show popup if cache was cleared successfully...');
    const token = await chrome.identity.getAuthToken({ 
      interactive: true
    });
    
    console.log('🔍 OAuth response - Type:', typeof token);
    console.log('🔍 OAuth response - Present:', token ? 'Yes' : 'No');
    console.log('🔍 OAuth response - Length:', token ? token.length : 0);
    
    if (!token) {
      throw new Error(`❌ OAuth failed. If no popup appeared, try this:
      1. Go to chrome://settings/content/popups 
      2. Allow popups for mail.google.com
      3. Or manually log out of Google and try again`);
    }
    
    console.log('✅ OAuth completed successfully - token received');
    
    // Extract actual token string
    const tokenString = extractTokenString(token);
    if (!tokenString) {
      throw new Error('Unable to extract valid token string from OAuth response');
    }
    
    console.log('🔍 Validating fresh OAuth token...');
    
    // Step 4: Validate token format and freshness
    if (!isValidTokenFormat(tokenString)) {
      await safelyRemoveCachedToken(token);
      throw new Error('Invalid token format received from OAuth');
    }
    
    // Step 5: Test token with Gmail API to ensure it's active
    const isValid = await validateTokenWithGmail(tokenString);
    if (!isValid) {
      await safelyRemoveCachedToken(token);
      throw new Error('Fresh token validation failed with Gmail API');
    }
    
    // Step 6: Get user profile to verify identity
    const userProfile = await fetchUserProfile(tokenString);
    if (!userProfile || !userProfile.emailAddress) {
      await safelyRemoveCachedToken(token);
      throw new Error('Failed to retrieve user profile from fresh token');
    }
    
    // Step 7: Store authentication data with strict session info
    const loginTime = Date.now();
    await chrome.storage.local.set({
      authToken: tokenString,
      isAuthenticated: true,
      loginTime: loginTime,
      userProfile: userProfile,
      sessionId: generateSessionId(),
      lastActivity: loginTime,
      sessionInvalidated: false,
      requiresFreshAuth: false, // Mark that we just did fresh auth
      navigationLogout: false   // Reset navigation logout flag
    });
    
    console.log('✅ Fresh OAuth login completed for user:', userProfile.emailAddress);
    sendResponse({ 
      success: true, 
      user: userProfile,
      message: 'Authenticated with fresh OAuth token'
    });
    
  } catch (error) {
    console.error('❌ Fresh OAuth login failed:', error);
    
    // Clear any partial authentication data
    await clearAllAuthenticationData();
    
    sendResponse({ 
      success: false, 
      error: error.message,
      requiresReauth: true
    });
  }
}

/**
 * Handle secure logout - completely clear all authentication data
 * Enhanced for maximum security to prevent automatic re-authentication
 */
async function handleLogout(sendResponse) {
  try {
    console.log('🔐 Starting enhanced secure logout process...');
    
    // Step 1: Get current auth token before clearing
    const { authToken } = await chrome.storage.local.get(['authToken']);
    
    // Step 2: Clear from Chrome identity cache (multiple attempts for thoroughness)
    if (authToken) {
      try {
        // Ensure we pass a string to removeCachedAuthToken
        const tokenString = typeof authToken === 'string' ? authToken : 
                           (authToken.token || authToken.access_token || JSON.stringify(authToken));
        
        // Clear the current token
        await chrome.identity.removeCachedAuthToken({ token: tokenString });
        console.log('✅ Removed primary token from Chrome cache');
        
        // Also try to get and clear any other cached tokens
        try {
          const cachedToken = await chrome.identity.getAuthToken({ interactive: false });
          if (cachedToken) {
            const cachedTokenString = typeof cachedToken === 'string' ? cachedToken : 
                                     (cachedToken.token || cachedToken.access_token || JSON.stringify(cachedToken));
            
            await chrome.identity.removeCachedAuthToken({ token: cachedTokenString });
            console.log('✅ Removed additional cached token');
          }
        } catch (error) {
          console.log('No additional cached tokens found');
        }
      } catch (error) {
        console.log('Note: Token may not exist in cache:', error.message);
      }
    }
    
    // Step 3: Clear ALL authentication and session data from local storage
    await chrome.storage.local.clear();
    console.log('✅ Cleared all local storage data');
    
    // Step 4: Reset extension state with enhanced security flags
    await chrome.storage.local.set({
      isAuthenticated: false,        // Explicitly set to false
      isProcessing: false,
      lastProcessedTime: Date.now(),
      emailData: [],
      userSettings: {
        autoReply: false,
        learningEnabled: true,
        notificationsEnabled: true
      },
      // Enhanced security markers
      sessionInvalidated: true,      // Mark session as completely invalidated
      lastLogoutTime: Date.now(),    // Record logout time
      requiresFreshAuth: true,       // Force fresh OAuth on next login
      navigationLogout: false,       // Reset navigation flag
      logoutReason: 'manual'         // Track logout reason
    });
    
    // Step 5: Clear any background processing (handle internally without sendResponse)
    try {
      await chrome.storage.local.set({ isProcessing: false });
      // Clear the processing interval
      if (self.processingInterval) {
        clearInterval(self.processingInterval);
        self.processingInterval = null;
      }
      console.log('✅ Background processing stopped');
    } catch (processingError) {
      console.log('Note: Error stopping background processing:', processingError.message);
    }
    
    console.log('🔐 Enhanced secure logout completed successfully');
    sendResponse({ success: true, message: 'Logged out securely with enhanced cleanup' });
    
  } catch (error) {
    console.error('❌ Error during enhanced secure logout:', error);
    
    // Even if there's an error, try to clear what we can with enhanced security
    try {
      await chrome.storage.local.clear();
      await chrome.storage.local.set({ 
        isAuthenticated: false,
        sessionInvalidated: true,
        lastLogoutTime: Date.now(),
        requiresFreshAuth: true,
        navigationLogout: false,
        logoutReason: 'error_recovery'
      });
    } catch (clearError) {
      console.error('Failed to clear storage during error recovery:', clearError);
    }
    
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Generate a unique session ID for security tracking
 */
function generateSessionId() {
  return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

/**
 * Validate token with Gmail API (more thorough than basic format check)
 */
async function validateTokenWithGmail(token) {
  try {
    console.log('🧪 Validating token with Gmail API...');
    const response = await fetchWithRetry('https://www.googleapis.com/gmail/v1/users/me/profile', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    // If the fetch was successful (which fetchWithRetry ensures), the token is valid.
    console.log('✅ Token is valid with Gmail API.');
    return true;

  } catch (error) {
    console.error('❌ Token validation failed after retries:', error);
    return false;
  }
}

/**
 * Enhanced token validation with session checks
 */
async function validateToken(token) {
  try {
    // Check session validity first
    const { sessionInvalidated, lastLogoutTime, loginTime } = await chrome.storage.local.get([
      'sessionInvalidated', 'lastLogoutTime', 'loginTime'
    ]);
    
    // If session was invalidated, token is invalid
    if (sessionInvalidated) {
      console.log('❌ Session was invalidated, token invalid');
      return false;
    }
    
    // If logged out after login, token is invalid
    if (lastLogoutTime && loginTime && lastLogoutTime > loginTime) {
      console.log('❌ Token invalidated by logout');
      return false;
    }
    
    // Check token format
    if (!isValidTokenFormat(token)) {
      console.log('❌ Token format validation failed');
      return false;
    }
    
    // Validate with Gmail API
    return await validateTokenWithGmail(token);
    
  } catch (error) {
    console.error('Token validation error:', error);
    return false;
  }
}

/**
 * Start the email processing workflow
 */
async function startEmailProcessing(sendResponse) {
  try {
    await chrome.storage.local.set({ 
      isProcessing: true,
      lastNewEmailFound: Date.now() // Initialize to prevent immediate auto-stop
    });
    console.log('📧 Email processing started');
    
    // Clear any existing processing interval
    if (self.processingInterval) {
      clearInterval(self.processingInterval);
    }
    
    // Initial email fetch and processing
    await fetchEmails();
    
    // Set up periodic processing with intelligent intervals
    self.processingInterval = setInterval(async () => {
      try {
        const { isProcessing, processingMode, hasMoreEmails } = await chrome.storage.local.get(['isProcessing', 'processingMode', 'hasMoreEmails']);
        
        if (!isProcessing) {
          console.log('⏹️ Processing stopped, clearing interval');
          clearInterval(self.processingInterval);
          self.processingInterval = null;
          return;
        }

        if (processingMode === 'monitoring') {
          console.log('👁️ Monitoring mode - checking for new emails only...');
          await processNewEmails();
        } else if (hasMoreEmails) {
          console.log('🔄 Active mode - continuing to process remaining emails...');
          await fetchEmails(); // Continue processing existing emails
        } else {
          console.log('🔍 Checking for new emails...');
          await processNewEmails();
        }
      } catch (error) {
        console.error('❌ Error in periodic processing:', error);
      }
    }, 10000);
    
    console.log('✅ Periodic email processing started (every 10 seconds)');
    sendResponse({ success: true });
  } catch (error) {
    console.error('❌ Failed to start processing:', error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Stop the email processing workflow
 */
async function stopEmailProcessing(sendResponse) {
  try {
    await chrome.storage.local.set({ isProcessing: false });
    
    // Clear the processing interval
    if (self.processingInterval) {
      clearInterval(self.processingInterval);
      self.processingInterval = null;
    }
    
    console.log('⏹️ Email processing stopped');
    sendResponse({ success: true });
  } catch (error) {
    console.error('❌ Failed to stop processing:', error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Fetch emails from Gmail API
 * Retrieves existing emails and stores them for processing
 */
async function fetchEmails(sendResponse = null) {
  try {
    const { authToken, isAuthenticated } = await chrome.storage.local.get(['authToken', 'isAuthenticated']);
    
    if (!isAuthenticated || !authToken) {
      throw new Error('User not authenticated');
    }
    
    console.log('📧 Starting email fetch from Gmail API...');
    
    // Get existing emails from storage to avoid duplicates
    const { emailData: existingEmails = [] } = await chrome.storage.local.get(['emailData']);
    const existingEmailIds = new Set(existingEmails.map(email => email.id));
    
    let allEmails = [...existingEmails];
    let totalFetched = 0;
    let nextPageToken = null;
    
    do {
      // Fetch message list with pagination
      const messagesResponse = await fetchMessagesList(authToken, nextPageToken);
      
      if (!messagesResponse.messages || messagesResponse.messages.length === 0) {
        console.log('📭 No emails found or reached end of messages');
        break;
      }
      
      console.log(`📋 Fetched ${messagesResponse.messages.length} message IDs from page`);
      
      // Filter out already processed emails
      const newMessageIds = messagesResponse.messages
        .filter(msg => !existingEmailIds.has(msg.id))
        .map(msg => msg.id);
      
      if (newMessageIds.length === 0) {
        console.log('✅ No new emails to process on this page');
        nextPageToken = messagesResponse.nextPageToken;
        continue;
      }
      
      console.log(`🆕 Processing ${newMessageIds.length} new emails...`);
      
      // Fetch full email details for new messages (batch process)
      const newlyFetchedEmails = await fetchEmailDetails(authToken, newMessageIds);

      // Send new emails to AI server for classification
      if (newlyFetchedEmails.length > 0) {
        console.log(`🤖 Sending ${newlyFetchedEmails.length} emails for batch AI classification...`);
        const classificationResults = await batchClassifyEmails(newlyFetchedEmails);
        
        // Merge classification results back into email details and create lightweight objects for local storage
        newlyFetchedEmails.forEach((email, index) => {
          if (classificationResults[index]) {
            email.category = classificationResults[index].label;
            email.confidence = classificationResults[index].confidence;
            // Update boolean labels based on AI category
            email.isSpam = (email.category === 'Spam');
            email.isPromotional = (email.category === 'Promotions');
            email.isSocial = (email.category === 'Social');
            email.isUpdates = (email.category === 'Updates');
            email.isForums = (email.category === 'Forums');
            email.isPrimary = (email.category === 'Primary');
          }
          // Crucially, remove the heavy 'content' and 'payload' before storing locally
          delete email.content;
          delete email.payload; // Ensure original message payload is not stored
        });
      }

      // Add new emails (now lightweight and classified) to collection
      allEmails.push(...newlyFetchedEmails);
      totalFetched += newlyFetchedEmails.length;

      // Combine existing and newly fetched emails, keeping only unique and most recent
      const emailMap = new Map();
      for (const email of allEmails) {
        emailMap.set(email.id, email);
      }
      allEmails = Array.from(emailMap.values());

      // Sort by original email date (most recent first)
      allEmails.sort((a, b) => b.emailDate - a.emailDate);

      // Trim the array to the maximum allowed size
      if (allEmails.length > MAX_STORED_EMAILS_COUNT) {
        console.log(`🗑️ Trimming emails from ${allEmails.length} to ${MAX_STORED_EMAILS_COUNT} to manage storage quota.`);
        allEmails = allEmails.slice(0, MAX_STORED_EMAILS_COUNT);
      }

      // Store progress incrementally
      await chrome.storage.local.set({ emailData: allEmails });
      console.log(`💾 Stored ${allEmails.length} total emails so far`);

      nextPageToken = messagesResponse.nextPageToken;
      
      // Intelligent processing limit based on API quotas
      if (totalFetched >= 100) {
        console.log('📊 Processed 100 emails in this batch. Continuing with remaining emails in next cycle...');
        break;
      }
      
    } while (nextPageToken);
    
    // Determine processing status
    const hasMoreEmails = nextPageToken ? true : false;
    const processingMode = hasMoreEmails ? 'active' : 'monitoring';
    
    // Final storage update
    await chrome.storage.local.set({ 
      emailData: allEmails,
      lastEmailFetch: Date.now(),
      emailCount: allEmails.length,
      processingMode: processingMode,
      hasMoreEmails: hasMoreEmails,
      totalEmailsInAccount: hasMoreEmails ? '2000+' : allEmails.length
    });
    
    console.log(`📊 Processing Status: ${processingMode.toUpperCase()}`);
    if (processingMode === 'monitoring') {
      console.log('✅ ALL EMAILS PROCESSED - Switched to monitoring mode for new emails only');
    } else {
      console.log('🔄 More emails available - Will continue processing in next cycle');
    }
    
    // Generate category breakdown for logging
    const categoryBreakdown = allEmails.reduce((acc, email) => {
      acc[email.category] = (acc[email.category] || 0) + 1;
      return acc;
    }, {});
    
    console.log(`✅ Email fetch completed! Total emails: ${allEmails.length}, New emails: ${totalFetched}`);
    console.log('📊 Email breakdown by category:', categoryBreakdown);
    
    if (sendResponse) {
      sendResponse({ 
        success: true, 
        emails: allEmails,
        totalCount: allEmails.length,
        newCount: totalFetched,
        categoryBreakdown: categoryBreakdown
      });
    }
    
    return allEmails;
    
  } catch (error) {
    console.error('❌ Failed to fetch emails:', error);
    if (sendResponse) {
      sendResponse({ success: false, error: error.message });
    }
    throw error;
  }
}

/**
 * Fetch list of message IDs from Gmail API with pagination support
 */
async function fetchMessagesList(authToken, pageToken = null) {
  try {
    // Comprehensive query to fetch ALL emails from all folders including spam and promotions
    // Using 'in:anywhere' to include spam folder, and no restrictions to get all emails
    let url = 'https://gmail.googleapis.com/gmail/v1/users/me/messages?q=in:anywhere&maxResults=100';
    
    if (pageToken) {
      url += `&pageToken=${pageToken}`;
    }
    
    const response = await fetchWithRetry(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });

    return await response.json();

  } catch (error) {
    console.error('❌ Error fetching messages list:', error);
    // Add the status code to the error message if it exists
    const errorMessage = error.message.includes('Gmail API error:') ? error.message : 'Failed to fetch messages list';
    throw new Error(errorMessage);
  }
}

/**
 * Fetch detailed email content for multiple message IDs
 */
async function fetchEmailDetails(authToken, messageIds) {
  try {
    const emails = [];
    
    // Fetch Gmail labels first to convert label IDs to names
    console.log('📋 Fetching Gmail labels for email parsing...');
    const labelsResult = await fetchGmailLabels(authToken);
    const labelMap = labelsResult.success ? labelsResult.labelMap : {};
    console.log(`📋 Gmail labels fetched: ${labelsResult.success ? 'SUCCESS' : 'FAILED'}, labelMap has ${Object.keys(labelMap).length} labels`);
    
    // Process emails in smaller batches to avoid overwhelming the API
    const batchSize = 10;
    for (let i = 0; i < messageIds.length; i += batchSize) {
      const batch = messageIds.slice(i, i + batchSize);
      console.log(`📨 Fetching email details for batch ${Math.floor(i/batchSize) + 1} (${batch.length} emails)`);
      
      const batchPromises = batch.map(messageId => fetchSingleEmailDetail(authToken, messageId, labelMap));
      const batchResults = await Promise.allSettled(batchPromises);
      
      // Process results and handle any failures
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          emails.push(result.value);
        } else {
          console.warn(`⚠️ Failed to fetch email ${batch[index]}:`, result.reason);
        }
      });
      
      // Small delay between batches to respect API limits
      if (i + batchSize < messageIds.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    return emails;
  } catch (error) {
    console.error('❌ Error fetching email details:', error);
    throw error;
  }
}

/**
 * Fetch detailed content for a single email message
 */
async function fetchSingleEmailDetail(authToken, messageId, labelMap = {}) {
  try {
    const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.status === 403) {
      console.warn(`🔒 Permission denied (403) for email ${messageId}. Skipping.`);
      return null; // Skip this email, do not re-attempt.
    }
    
    if (!response.ok) {
      throw new Error(`Gmail API error for message ${messageId}: ${response.status}`);
    }
    
    const message = await response.json();
    
    // Parse email content with label mapping
    const emailData = parseEmailMessage(message, labelMap);
    console.log(`📄 Parsed email [${emailData.category}]: "${emailData.subject}" from ${emailData.sender}`);
    
    return emailData;
  } catch (error) {
    console.error(`❌ Error fetching email ${messageId}:`, error);
    return null;
  }
}

/**
 * Parse Gmail message object into structured email data
 */
function parseEmailMessage(message, labelMap = {}) {
  try {
    const headers = message.payload.headers || [];
    
    // Extract headers
    const getHeader = (name) => {
      const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
      return header ? header.value : '';
    };
    
    const subject = getHeader('Subject') || '(No Subject)';
    const sender = getHeader('From') || '(Unknown Sender)';
    const date = getHeader('Date') || '';
    const to = getHeader('To') || '';
    
    // Parse email content (body)
    const content = extractEmailContent(message.payload);
    
    // Parse sender email from "Name <email@domain.com>" format
    const senderEmailMatch = sender.match(/<([^>]+)>/);
    const senderEmail = senderEmailMatch ? senderEmailMatch[1] : sender;
    const senderName = sender.replace(/<[^>]+>/, '').trim();
    
    // Determine email category from labels
    const labels = message.labelIds || [];
    const isSpam = labels.includes('SPAM');
    const isPromotional = labels.includes('CATEGORY_PROMOTIONS');
    const isSocial = labels.includes('CATEGORY_SOCIAL');
    const isUpdates = labels.includes('CATEGORY_UPDATES');
    const isForums = labels.includes('CATEGORY_FORUMS');
    const isPrimary = labels.includes('CATEGORY_PRIMARY') || 
                     (!isPromotional && !isSocial && !isUpdates && !isForums && !isSpam);

    // Convert label IDs to label names using the labelMap
    const gmailLabels = [];
    if (labelMap && Object.keys(labelMap).length > 0) {
      // Create reverse map (ID to name)
      const idToNameMap = {};
      Object.entries(labelMap).forEach(([name, id]) => {
        idToNameMap[id] = name;
      });
      
      // Convert label IDs to names
      labels.forEach(labelId => {
        const labelName = idToNameMap[labelId];
        if (labelName && !labelName.startsWith('CATEGORY_') && labelName !== 'UNREAD' && labelName !== 'IMPORTANT' && labelName !== 'STARRED' && labelName !== 'SPAM') {
          gmailLabels.push(labelName);
        }
      });
      
      // Debug logging for label mapping
      if (gmailLabels.length > 0) {
        console.log(`📋 Email "${subject.substring(0, 50)}" has Gmail labels: [${gmailLabels.join(', ')}]`);
      }
    } else {
      console.log(`⚠️ No labelMap provided for email parsing (labelMap keys: ${Object.keys(labelMap).length})`);
    }

    return {
      id: message.id,
      threadId: message.threadId,
      subject: subject,
      sender: senderName || senderEmail,
      senderEmail: senderEmail,
      recipient: to,
      date: date,
      timestamp: Date.now(), // Processing time, not email arrival time
      emailDate: new Date(date).getTime() || Date.now(), // Original email date
      content: content,
      snippet: message.snippet || '',
      labelIds: labels,
      gmailLabels: gmailLabels, // Add the converted label names
      read: !labels.includes('UNREAD'),
      important: labels.includes('IMPORTANT'),
      starred: labels.includes('STARRED'),
      // Enhanced categorization
      isSpam: isSpam,
      isPromotional: isPromotional,
      isSocial: isSocial,
      isUpdates: isUpdates,
      isForums: isForums,
      isPrimary: isPrimary,
      category: isSpam ? 'Spam' : 
                isPromotional ? 'Promotions' :
                isSocial ? 'Social' :
                isUpdates ? 'Updates' :
                isForums ? 'Forums' :
                'Primary'
    };
  } catch (error) {
    console.error('❌ Error parsing email message:', error);
    return {
      id: message.id,
      subject: '(Parse Error)',
      sender: '(Unknown)',
      content: message.snippet || '',
      timestamp: Date.now(),
      error: error.message
    };
  }
}

/**
 * Extract email content from message payload (handles both plain text and HTML)
 */
function extractEmailContent(payload) {
  try {
    let content = '';
    
    // Handle multipart messages
    if (payload.parts && payload.parts.length > 0) {
      for (const part of payload.parts) {
        if (part.mimeType === 'text/plain' && part.body.data) {
          content += decodeBase64Url(part.body.data);
        } else if (part.mimeType === 'text/html' && part.body.data && !content) {
          // Use HTML as fallback if no plain text available
          const htmlContent = decodeBase64Url(part.body.data);
          content = stripHtmlTags(htmlContent);
        } else if (part.parts) {
          // Recursively handle nested parts
          content += extractEmailContent(part);
        }
      }
    } else if (payload.body && payload.body.data) {
      // Single part message
      const rawContent = decodeBase64Url(payload.body.data);
      if (payload.mimeType === 'text/html') {
        content = stripHtmlTags(rawContent);
      } else {
        content = rawContent;
      }
    }
    
    return content.trim() || '(No content available)';
  } catch (error) {
    console.error('❌ Error extracting email content:', error);
    return '(Content extraction failed)';
  }
}

/**
 * Decode base64url encoded string
 */
function decodeBase64Url(str) {
  try {
    // Replace URL-safe characters
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    
    // Add padding if necessary
    while (base64.length % 4) {
      base64 += '=';
    }
    
    return atob(base64);
  } catch (error) {
    console.error('❌ Error decoding base64:', error);
    return str;
  }
}

/**
 * Strip HTML tags from content (basic implementation)
 */
function stripHtmlTags(html) {
  try {
    return html
      .replace(/<[^>]*>/g, ' ')  // Remove HTML tags
      .replace(/&nbsp;/g, ' ')   // Replace &nbsp; with space
      .replace(/&amp;/g, '&')    // Replace &amp; with &
      .replace(/&lt;/g, '<')     // Replace &lt; with <
      .replace(/&gt;/g, '>')     // Replace &gt; with >
      .replace(/&quot;/g, '"')   // Replace &quot; with "
      .replace(/\s+/g, ' ')      // Replace multiple spaces with single space
      .trim();
  } catch (error) {
    console.error('❌ Error stripping HTML tags:', error);
    return html;
  }
}

/**
 * AI API Communication Functions
 * Handle communication with the Automail AI Server for email classification
 */

/**
 * Test connection to AI API server
 */
async function testAIConnection(sendResponse = null) {
  try {
    console.log('🤖 Testing AI API connection...');
    
    const response = await fetch(`${AI_API_CONFIG.baseUrl}/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      },
      signal: AbortSignal.timeout(AI_API_CONFIG.timeout)
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ AI API connection successful:', data);
      
      if (sendResponse) {
        sendResponse({ 
          success: true, 
          status: data.status,
          modelLoaded: data.model_loaded,
          message: 'AI API is accessible and healthy'
        });
      }
      return true;
    } else {
      throw new Error(`API returned ${response.status}: ${response.statusText}`);
    }
    
  } catch (error) {
    console.error('❌ AI API connection failed:', error);
    
    if (sendResponse) {
      sendResponse({ 
        success: false, 
        error: error.message,
        message: 'AI API is not accessible - will use fallback classification'
      });
    }
    return false;
  }
}

/**
 * Classify a single email using AI API
 */
async function classifyEmail(content, subject = '', sendResponse = null) {
  try {
    console.log('🤖 Classifying email with AI...');
    
    const payload = {
      content: content || '',
      subject: subject || ''
    };
    
    const response = await fetch(`${AI_API_CONFIG.baseUrl}/classify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': AI_API_CONFIG.apiKey
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(AI_API_CONFIG.timeout)
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log(`✅ Email classified as: ${result.label} (confidence: ${result.confidence})`);
      
      const successResult = { success: true, ...result };
      
      if (sendResponse) {
        sendResponse(successResult);
      }
      return successResult;
    } else {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `API returned ${response.status}`);
    }
    
  } catch (error) {
    console.error('❌ AI classification failed:', error);
    
    // Fallback to rule-based classification if enabled
    if (AI_API_CONFIG.fallbackEnabled) {
      console.log('🔄 Using fallback rule-based classification...');
      const fallbackResult = ruleBasedClassification(content, subject);
      const successResult = { success: true, ...fallbackResult, fallback: true };
      
      if (sendResponse) {
        sendResponse(successResult);
      }
      return successResult;
    }
    
    if (sendResponse) {
      sendResponse({ 
        success: false, 
        error: error.message,
        label: 'Review',
        confidence: 0.1,
        reasoning: 'Classification failed - manual review recommended'
      });
    }
    return null;
  }
}

/**
 * Classify multiple emails in batch using AI API
 */
async function batchClassifyEmails(emails, sendResponse = null) {
  try {
    console.log(`🤖 Batch classifying ${emails.length} emails...`);
    
    // Split into batches if needed
    const batches = [];
    for (let i = 0; i < emails.length; i += AI_API_CONFIG.batchSize) {
      batches.push(emails.slice(i, i + AI_API_CONFIG.batchSize));
    }
    
    const allResults = [];
    
    for (const batch of batches) {
      const payload = {
        emails: batch.map(email => ({
          content: email.content || '',
          subject: email.subject || ''
        }))
      };
      
      const response = await fetch(`${AI_API_CONFIG.baseUrl}/batch-classify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': AI_API_CONFIG.apiKey
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(AI_API_CONFIG.timeout * 2) // Longer timeout for batch
      });
      
      if (response.ok) {
        const result = await response.json();
        allResults.push(...result.results);
      } else {
        // Fallback for this batch
        if (AI_API_CONFIG.fallbackEnabled) {
          const fallbackResults = batch.map(email => 
            ruleBasedClassification(email.content, email.subject)
          );
          allResults.push(...fallbackResults);
        } else {
          throw new Error(`Batch API returned ${response.status}`);
        }
      }
    }
    
    console.log(`✅ Batch classification completed: ${allResults.length} emails`);
    
    const successResult = { 
      success: true, 
      results: allResults,
      totalEmails: emails.length
    };
    
    if (sendResponse) {
      sendResponse(successResult);
    }
    return successResult;
    
  } catch (error) {
    console.error('❌ Batch classification failed:', error);
    
    if (sendResponse) {
      sendResponse({ 
        success: false, 
        error: error.message,
        results: []
      });
    }
    return { success: false, error: error.message, results: [] };
  }
}

/**
 * Rule-based fallback classification when AI is unavailable
 */
function ruleBasedClassification(content, subject) {
  const fullText = `${subject} ${content}`.toLowerCase();
  
  // Define keyword patterns for each category
  const patterns = {
    'Spam': [
      'unsubscribe', 'click here', 'limited time', 'act now',
      'free money', 'guarantee', 'winner', 'congratulations',
      'viagra', 'casino', 'lottery', 'inheritance'
    ],
    'Important': [
      'urgent', 'important', 'asap', 'deadline', 'action required',
      'verification', 'security', 'password', 'account', 'confirm',
      'invoice', 'payment', 'bill', 'receipt'
    ],
    'Work': [
      'meeting', 'project', 'deadline', 'report', 'team',
      'client', 'business', 'office', 'conference', 'schedule',
      'proposal', 'contract', 'budget', 'quarterly'
    ],
    'Personal': [
      'family', 'friend', 'vacation', 'birthday', 'dinner',
      'weekend', 'party', 'holiday', 'personal', 'home'
    ]
  };
  
  // Score each category
  const scores = {};
  for (const [label, keywords] of Object.entries(patterns)) {
    scores[label] = keywords.filter(keyword => fullText.includes(keyword)).length;
  }
  
  // Find best match
  const bestLabel = Object.keys(scores).reduce((a, b) => scores[a] > scores[b] ? a : b);
  const maxScore = scores[bestLabel];
  
  if (maxScore > 0) {
    const confidence = Math.min(0.8, maxScore * 0.2); // Cap at 80%
    return {
      label: bestLabel,
      confidence: confidence,
      reasoning: 'Rule-based classification using keyword matching'
    };
  }
  
  // Default to Review if no patterns match
  return {
    label: 'Review',
    confidence: 0.5,
    reasoning: 'No clear classification patterns found - requires manual review'
  };
}

/**
 * Enhanced email processing with AI classification
 */
async function processEmailsWithAI() {
  try {
    const { emailData = [], isProcessing, isAuthenticated } = 
      await chrome.storage.local.get(['emailData', 'isProcessing', 'isAuthenticated']);
    
    if (!isProcessing || !isAuthenticated || emailData.length === 0) {
      console.log('⏹️ Cannot process emails with AI: not authenticated or no emails');
      return;
    }
    
    console.log(`🤖 Processing ${emailData.length} emails with AI classification...`);
    
    // Test AI connection first
    const aiAvailable = await testAIConnection();
    
    if (!aiAvailable && !AI_API_CONFIG.fallbackEnabled) {
      console.warn('⚠️ AI API unavailable and fallback disabled');
      return;
    }
    
    // Filter emails that don't have AI classification yet
    const emailsToClassify = emailData.filter(email => !email.aiLabel);
    
    if (emailsToClassify.length === 0) {
      console.log('✅ All emails already classified');
      return;
    }
    
    console.log(`📧 Classifying ${emailsToClassify.length} new emails...`);
    
    // Classify emails in batches
    const classificationResult = await batchClassifyEmails(emailsToClassify);
    const classifications = classificationResult.success ? classificationResult.results : [];
    
    if (classifications.length > 0) {
      // Update emails with AI classifications
      const updatedEmails = emailData.map((email, index) => {
        const classificationIndex = emailsToClassify.findIndex(e => e.id === email.id);
        if (classificationIndex !== -1 && classifications[classificationIndex]) {
          return {
            ...email,
            aiLabel: classifications[classificationIndex].label,
            aiConfidence: classifications[classificationIndex].confidence,
            aiReasoning: classifications[classificationIndex].reasoning,
            classifiedAt: Date.now()
          };
        }
        return email;
      });
      
      // Store updated emails
      await chrome.storage.local.set({ 
        emailData: updatedEmails,
        lastAIProcessing: Date.now()
      });
      
      console.log(`✅ AI classification completed for ${classifications.length} emails`);
      
      // Apply labels to Gmail after classification
      try {
        console.log('🏷️ Applying labels to classified emails...');
        const labelingResult = await labelEmails();
        if (labelingResult.success) {
          console.log(`✅ Successfully labeled ${labelingResult.labeled} emails`);
        } else {
          console.warn('⚠️ Labeling failed:', labelingResult.error);
        }
      } catch (error) {
        console.error('❌ Error during email labeling:', error);
      }
    }
    
  } catch (error) {
    console.error('❌ Error processing emails with AI:', error);
  }
}

/**
 * Process new emails (called periodically)
 * Checks for new unread emails and processes them
 */
async function processNewEmails() {
  try {
    const { 
      isProcessing, 
      authToken, 
      isAuthenticated, 
      lastNewEmailFound,
      emailData: existingEmails = []
    } = await chrome.storage.local.get([
      'isProcessing', 'authToken', 'isAuthenticated', 'lastNewEmailFound', 'emailData'
    ]);
    
    if (!isProcessing || !isAuthenticated || !authToken) {
      console.log('⏹️ Processing stopped or not authenticated');
      return;
    }
    
    console.log('🔍 Checking for new emails...');
    
    // Check for auto-stop condition (no new emails for 10 minutes)
    const now = Date.now();
    const lastFound = lastNewEmailFound || now;
    const timeSinceLastEmail = now - lastFound;
    const tenMinutes = 10 * 60 * 1000;
    
         if (timeSinceLastEmail > tenMinutes && existingEmails.length > 0) {
       console.log('⏰ Auto-stopping: No new emails for 10 minutes');
       await chrome.storage.local.set({ isProcessing: false });
       if (self.processingInterval) {
         clearInterval(self.processingInterval);
         self.processingInterval = null;
       }
       return;
     }
    
    // Fetch unread emails from all folders including spam and promotions
    const unreadResponse = await fetchWithRetry(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages?q=in:anywhere is:unread&maxResults=15',
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const unreadData = await unreadResponse.json();
    
    if (!unreadData.messages || unreadData.messages.length === 0) {
      console.log('📭 No new unread emails found');
      return;
    }
    
    console.log(`📬 Found ${unreadData.messages.length} unread email(s)`);
    
    // Get existing email IDs
    const existingEmailIds = new Set(existingEmails.map(email => email.id));
    
    // Filter out already processed emails
    const newMessageIds = unreadData.messages
      .filter(msg => !existingEmailIds.has(msg.id))
      .map(msg => msg.id);
    
    if (newMessageIds.length === 0) {
      console.log('✅ All unread emails already processed');
      return;
    }
    
    // Fetch details for new emails
    console.log(`🆕 Processing ${newMessageIds.length} new email(s)...`);
    const newEmailDetails = await fetchEmailDetails(authToken, newMessageIds);
    
    if (newEmailDetails.length > 0) {
      // Add to existing emails
      const updatedEmails = [...existingEmails, ...newEmailDetails];
      
      // Store updated email data with timestamp of last new email
      await chrome.storage.local.set({ 
        emailData: updatedEmails,
        emailCount: updatedEmails.length,
        lastNewEmailCheck: now,
        lastNewEmailFound: now
      });
      
      console.log(`✅ Added ${newEmailDetails.length} new email(s). Total: ${updatedEmails.length}`);
      
      // Classify new emails with AI
      try {
        console.log('🤖 Starting AI classification for new emails...');
        await processEmailsWithAI();
      } catch (error) {
        console.error('❌ Error during AI classification:', error);
      }
    }
    
  } catch (error) {
    console.error('❌ Error processing new emails:', error);
    
    // Don't stop processing for network errors, but log them
    if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
      console.warn('🌐 Network error during email check, will retry next cycle');
    }
  }
}

/**
 * Handle session invalidation for security (navigation, domain changes, etc.)
 */
async function handleSessionInvalidation(reason, sendResponse = null) {
  try {
    console.log(`🔐 Session invalidation requested - Reason: ${reason}`);
    
    // Mark session as invalidated immediately
    await chrome.storage.local.set({
      sessionInvalidated: true,
      invalidationReason: reason,
      invalidationTime: Date.now()
    });
    
    // For navigation-based invalidation, clear sensitive data but keep some settings
    if (reason === 'navigation' || reason === 'domain_change') {
      // Clear authentication but preserve user preferences
      await chrome.storage.local.remove([
        'authToken',
        'isAuthenticated', 
        'loginTime',
        'userProfile',
        'sessionId',
        'lastActivity',
        'emailData' // Clear potentially sensitive email data
      ]);
      
      // Stop any background processing
      await stopEmailProcessing();
      
      console.log(`✅ Session invalidated due to ${reason}`);
    }
    
    if (sendResponse) {
      sendResponse({ success: true, message: `Session invalidated: ${reason}` });
    }
    
  } catch (error) {
    console.error('❌ Error invalidating session:', error);
    if (sendResponse) {
      sendResponse({ success: false, error: error.message });
    }
  }
}

/**
 * Fetch user profile information from Gmail API
 */
async function fetchUserProfile(token) {
  try {
    console.log('📋 Fetching user profile...');
    
    const response = await fetchWithRetry('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const profile = await response.json();
    console.log('✅ User profile fetched for:', profile.emailAddress);
    
    return {
      emailAddress: profile.emailAddress,
      totalSizeEstimate: profile.totalSizeEstimate,
      fetchTime: Date.now()
    };
    
  } catch (error) {
    console.error('❌ Error fetching user profile:', error);
    throw error;
  }
}

/**
 * Debug OAuth configuration and permissions
 */
async function debugOAuthConfiguration(sendResponse) {
  try {
    console.log('🔧 OAuth Debug Information:');
    console.log('Extension ID:', chrome.runtime.id);
    console.log('Manifest OAuth config:', chrome.runtime.getManifest().oauth2);
    
    // Check if identity API is available
    if (!chrome.identity) {
      throw new Error('Chrome Identity API not available');
    }
    
    // Check stored authentication
    const storage = await chrome.storage.local.get(['authToken', 'isAuthenticated', 'userProfile']);
    console.log('Stored auth data:', {
      hasToken: !!storage.authToken,
      isAuthenticated: storage.isAuthenticated,
      hasProfile: !!storage.userProfile
    });
    
    sendResponse({ 
      success: true, 
      debug: {
        extensionId: chrome.runtime.id,
        hasIdentityAPI: !!chrome.identity,
        storedAuth: storage
      }
    });
  } catch (error) {
    console.error('❌ Error in OAuth debug:', error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * A robust fetch wrapper that handles transient errors with exponential backoff.
 * This is crucial for handling Gmail API 5xx errors.
 * @param {string} url The URL to fetch.
 * @param {object} options The fetch options.
 * @param {number} maxRetries Maximum number of retries.
 * @returns {Promise<Response>} The fetch response.
 */
async function fetchWithRetry(url, options, maxRetries = 5) {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      const response = await fetch(url, options);
      
      // If the response is successful (2xx), return it immediately.
      if (response.ok) {
        return response;
      }

      // These are transient server errors. We should retry.
      if (response.status === 500 || response.status === 503 || response.status === 504) {
        attempt++;
        const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000; // Exponential backoff with jitter
        console.warn(`⚠️ Gmail API error ${response.status}. Retrying in ${Math.round(delay / 1000)}s... (Attempt ${attempt}/${maxRetries})`);
        
        // Notify the UI about the retry attempt
        chrome.runtime.sendMessage({
            action: 'updateStatus',
            message: `Gmail servers are busy. Retrying automatically... (Attempt ${attempt})`,
            type: 'warning'
        }).catch(e => console.log("Could not send status update to UI"));

        await new Promise(resolve => setTimeout(resolve, delay));
        continue; // Go to the next iteration of the loop
      }

      // For other errors (like 401 Unauthorized, 403 Forbidden), retrying won't help.
      console.error(`❌ Unrecoverable Gmail API error: ${response.status} ${response.statusText}`);
      throw new Error(`Gmail API error: ${response.status}`);

    } catch (error) {
      // This catches network errors (e.g., net::ERR_FAILED)
      attempt++;
      if (attempt >= maxRetries) {
        console.error('❌ Network error after all retries:', error);
        throw error; // Re-throw the error after all retries have failed
      }
      const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
      console.warn(`🌐 Network error. Retrying in ${Math.round(delay / 1000)}s... (Attempt ${attempt}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw new Error(`Failed to fetch from Gmail API after ${maxRetries} attempts.`);
}

/**
 * Force clear all tokens and authentication data
 */
async function clearAllTokens(sendResponse) {
  try {
    console.log('🧹 Force clearing all authentication data...');
    
    // Get all stored tokens
    const storage = await chrome.storage.local.get(['authToken']);
    
    // Remove from Chrome identity cache
    if (storage.authToken) {
      try {
        await chrome.identity.removeCachedAuthToken({ token: storage.authToken });
        console.log('✅ Removed token from Chrome cache');
      } catch (error) {
        console.log('Note: Token may not exist in cache:', error.message);
      }
    }
    
    // Clear all auth-related data from local storage
    await chrome.storage.local.remove([
      'authToken', 
      'isAuthenticated', 
      'loginTime', 
      'userProfile',
      'emailData'
    ]);
    
    console.log('✅ All authentication data cleared');
    sendResponse({ success: true, message: 'All tokens cleared successfully' });
  } catch (error) {
    console.error('❌ Error clearing tokens:', error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Validate token format (basic check)
 */
function isValidTokenFormat(token) {
  // If token is not a string, it's definitely invalid for our use
  if (!token || typeof token !== 'string') {
    console.log('Token validation failed: not a string', typeof token);
    return false;
  }
  
  // Basic OAuth token format validation
  // OAuth tokens are typically long strings with alphanumeric characters and some symbols
  if (token.length < 20) {
    console.log('Token validation failed: too short', token.length);
    return false;
  }
  
  // Check if it looks like a proper access token (OAuth tokens can contain various characters)
  // Allow alphanumeric, dots, hyphens, underscores, slashes, and plus signs (common in OAuth tokens)
  const validTokenPattern = /^[a-zA-Z0-9._\-/+=]+$/;
  const isValid = validTokenPattern.test(token);
  
  if (!isValid) {
    console.log('Token validation failed: invalid characters. Token preview:', token.substring(0, 20) + '...');
  } else {
    console.log('✅ Token format validation passed');
  }
  
  return isValid;
}

/**
 * LABELING MODULE - Action 5 Implementation
 * Functions to fetch Gmail labels, create new labels, and apply AI-generated labels to emails
 */

/**
 * Fetch all existing Gmail labels for the authenticated user
 * @param {string} authToken - Valid Gmail API auth token
 * @returns {Promise<Object>} - Object containing labels array and success status
 */
async function fetchGmailLabels(authToken) {
  try {
    console.log('📋 Fetching Gmail labels...');
    
    const response = await fetchWithRetry(
      'https://gmail.googleapis.com/gmail/v1/users/me/labels',
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Gmail API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`✅ Fetched ${data.labels?.length || 0} Gmail labels`);
    
    return {
      success: true,
      labels: data.labels || [],
      labelMap: createLabelMap(data.labels || [])
    };
    
  } catch (error) {
    console.error('❌ Error fetching Gmail labels:', error);
    return {
      success: false,
      error: error.message,
      labels: [],
      labelMap: {}
    };
  }
}

/**
 * Create a map of label names to label IDs for quick lookup
 * @param {Array} labels - Array of Gmail label objects
 * @returns {Object} - Map of label names to IDs
 */
function createLabelMap(labels) {
  const labelMap = {};
  labels.forEach(label => {
    labelMap[label.name.toLowerCase()] = label.id;
  });
  return labelMap;
}

/**
 * Create a new Gmail label
 * @param {string} authToken - Valid Gmail API auth token
 * @param {string} labelName - Name of the label to create
 * @returns {Promise<Object>} - Created label object or error
 */
async function createGmailLabel(authToken, labelName) {
  try {
    console.log(`🏷️ Creating new Gmail label: ${labelName}`);
    
    const response = await fetchWithRetry(
      'https://gmail.googleapis.com/gmail/v1/users/me/labels',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: labelName,
          labelListVisibility: 'labelShow',
          messageListVisibility: 'show'
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Gmail API error: ${response.status} ${response.statusText}`);
    }

    const newLabel = await response.json();
    console.log(`✅ Created label: ${labelName} (ID: ${newLabel.id})`);
    
    return {
      success: true,
      label: newLabel
    };
    
  } catch (error) {
    console.error(`❌ Error creating label ${labelName}:`, error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Apply a label to a Gmail message
 * @param {string} authToken - Valid Gmail API auth token
 * @param {string} messageId - Gmail message ID
 * @param {string} labelId - Gmail label ID to apply
 * @returns {Promise<Object>} - Success status and result
 */
async function applyLabelToMessage(authToken, messageId, labelId) {
  try {
    console.log(`🏷️ Applying label ${labelId} to message ${messageId}`);
    
    const response = await fetchWithRetry(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          addLabelIds: [labelId]
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Gmail API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    console.log(`✅ Applied label to message ${messageId}`);
    
    return {
      success: true,
      result: result
    };
    
  } catch (error) {
    console.error(`❌ Error applying label to message ${messageId}:`, error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Main function to label emails using AI classification
 * Fetches emails from storage, classifies them, and applies appropriate labels
 * @param {Function} sendResponse - Optional callback for response
 */
async function labelEmails(sendResponse = null) {
  try {
    console.log('🚀 Starting email labeling process...');
    
    // Check authentication
    const { isAuthenticated, authToken } = await chrome.storage.local.get(['isAuthenticated', 'authToken']);
    
    if (!isAuthenticated || !authToken) {
      const error = 'User not authenticated';
      console.error('❌', error);
      if (sendResponse) sendResponse({ success: false, error });
      return;
    }

    // Get stored emails
    const { emailData } = await chrome.storage.local.get(['emailData']);
    const emails = emailData || [];
    
    if (emails.length === 0) {
      console.log('📭 No emails to label');
      if (sendResponse) sendResponse({ success: true, message: 'No emails to label', labeled: 0 });
      return;
    }

    console.log(`📧 Found ${emails.length} emails to process`);

    // Fetch existing Gmail labels
    const labelsResult = await fetchGmailLabels(authToken);
    if (!labelsResult.success) {
      throw new Error(`Failed to fetch Gmail labels: ${labelsResult.error}`);
    }

    let labelMap = labelsResult.labelMap;
    let labeledCount = 0;
    let errors = [];

    // Process emails in batches to avoid overwhelming the AI API
    const batchSize = AI_API_CONFIG.batchSize;
    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);
      console.log(`🔄 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(emails.length/batchSize)}`);

      // Classify emails in this batch
      const emailsForClassification = batch.map(email => ({
        content: email.content || '',
        subject: email.subject || ''
      }));

      const classificationResult = await batchClassifyEmails(emailsForClassification);
      
      if (!classificationResult || !classificationResult.success) {
        console.error('❌ Batch classification failed:', classificationResult?.error || 'Unknown error');
        errors.push(`Batch ${Math.floor(i/batchSize) + 1}: ${classificationResult?.error || 'Unknown error'}`);
        continue;
      }

      // Apply labels to each email in the batch
      for (let j = 0; j < batch.length; j++) {
        const email = batch[j];
        const classification = classificationResult.results[j];
        
        if (!classification || !classification.label) {
          console.warn(`⚠️ No classification for email ${email.id}`);
          continue;
        }

        const predictedLabel = classification.label;
        console.log(`🎯 Email ${email.id}: ${predictedLabel} (confidence: ${classification.confidence})`);

        // Handle special cases and map to Gmail-friendly label names
        let finalLabel = predictedLabel;
        
        // Map AI labels to Gmail-friendly names
        const labelMapping = {
          'Important': 'Automail-Important',
          'Review': 'Automail-Review',
          'Spam': 'SPAM',  // Use Gmail's built-in SPAM label
          'Work': 'Work',
          'Personal': 'Personal'
        };
        
        // "Review" label for uncertain classifications (low confidence)
        if (classification.confidence < 0.6) {
          finalLabel = 'Review';
        }
        
        // "Important" for high-priority emails
        if (predictedLabel === 'Important' || 
            (email.subject && email.subject.toLowerCase().includes('urgent')) ||
            (email.content && /\b(urgent|important|asap|deadline|action required)\b/i.test(email.content))) {
          finalLabel = 'Important';
        }
        
        // Map to Gmail-friendly label name
        finalLabel = labelMapping[finalLabel] || finalLabel;

        // Check if label exists, create if needed
        const labelKey = finalLabel.toLowerCase();
        let labelId = labelMap[labelKey];
        
        if (!labelId) {
          console.log(`🆕 Label "${finalLabel}" doesn't exist, creating...`);
          const createResult = await createGmailLabel(authToken, finalLabel);
          
          if (createResult.success) {
            labelId = createResult.label.id;
            labelMap[labelKey] = labelId;
            console.log(`✅ Created and cached label: ${finalLabel}`);
          } else {
            console.error(`❌ Failed to create label ${finalLabel}:`, createResult.error);
            errors.push(`Failed to create label ${finalLabel}: ${createResult.error}`);
            continue;
          }
        }

        // Apply the label to the email
        const applyResult = await applyLabelToMessage(authToken, email.id, labelId);
        
        if (applyResult && applyResult.success) {
          labeledCount++;
          console.log(`✅ Labeled email ${email.id} as "${finalLabel}"`);
          
          // Update email in storage with label info
          email.aiLabel = finalLabel;
          email.aiConfidence = classification.confidence;
          email.labeledAt = Date.now();
        } else {
          const errorMsg = applyResult?.error || 'Unknown error applying label';
          console.error(`❌ Failed to apply label to ${email.id}:`, errorMsg);
          errors.push(`Failed to label ${email.id}: ${errorMsg}`);
        }

        // Add small delay to respect API rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Update stored email data
    await chrome.storage.local.set({ emailData: emails });

    const result = {
      success: true,
      labeled: labeledCount,
      total: emails.length,
      errors: errors,
      message: `Successfully labeled ${labeledCount}/${emails.length} emails`
    };

    console.log(`🎉 Labeling complete: ${labeledCount}/${emails.length} emails labeled`);
    if (errors.length > 0) {
      console.warn(`⚠️ ${errors.length} errors occurred:`, errors);
    }

    if (sendResponse) sendResponse(result);
    return result;

  } catch (error) {
    console.error('❌ Error in labelEmails:', error);
    const result = { success: false, error: error.message };
    if (sendResponse) sendResponse(result);
    return result;
  }
}

/**
 * Label a single email with retry logic
 * @param {Object} email - Email object with id, content, subject
 * @param {string} authToken - Valid Gmail API auth token
 * @param {Object} labelMap - Map of label names to IDs
 * @returns {Promise<Object>} - Result of labeling operation
 */
async function labelSingleEmail(email, authToken, labelMap) {
  const maxRetries = AI_API_CONFIG.retryAttempts;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Classify the email
      const classificationResult = await classifyEmail(email.content, email.subject);
      
      if (!classificationResult.success) {
        throw new Error(`Classification failed: ${classificationResult.error}`);
      }

      const classification = classificationResult;
      const predictedLabel = classification.label;
      
      // Determine final label with special case handling
      let finalLabel = predictedLabel;
      if (classification.confidence < 0.6) {
        finalLabel = 'Review';
      }

      // Get or create label
      const labelKey = finalLabel.toLowerCase();
      let labelId = labelMap[labelKey];
      
      if (!labelId) {
        const createResult = await createGmailLabel(authToken, finalLabel);
        if (createResult.success) {
          labelId = createResult.label.id;
          labelMap[labelKey] = labelId;
        } else {
          throw new Error(`Failed to create label: ${createResult.error}`);
        }
      }

      // Apply label
      const applyResult = await applyLabelToMessage(authToken, email.id, labelId);
      
      if (applyResult.success) {
        return {
          success: true,
          label: finalLabel,
          confidence: classification.confidence,
          attempt: attempt
        };
      } else {
        throw new Error(`Failed to apply label: ${applyResult.error}`);
      }

    } catch (error) {
      console.warn(`⚠️ Attempt ${attempt}/${maxRetries} failed for email ${email.id}:`, error.message);
      
      if (attempt === maxRetries) {
        return {
          success: false,
          error: error.message,
          attempts: maxRetries
        };
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
}

// Handle extension icon clicks
chrome.action.onClicked.addListener(async (tab) => {
  console.log('Automail: Extension icon clicked');
  
  // Check if we're on Gmail
  if (tab.url && tab.url.includes('mail.google.com')) {
    try {
      // Send message to content script to toggle sidebar
      await chrome.tabs.sendMessage(tab.id, { action: 'toggleSidebar' });
    } catch (error) {
      console.log('Error toggling sidebar:', error);
      // If content script isn't injected, inject it
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
        await chrome.scripting.insertCSS({
          target: { tabId: tab.id },
          files: ['sidebar.css']
        });
        // Try toggling again after injection
        setTimeout(() => {
          chrome.tabs.sendMessage(tab.id, { action: 'toggleSidebar' });
        }, 500);
      } catch (injectionError) {
        console.error('Failed to inject content script:', injectionError);
      }
    }
  } else {
    // If not on Gmail, open Gmail in new tab
    chrome.tabs.create({ url: 'https://mail.google.com' });
  }
}); 