/**
 * WORKING OAUTH BACKGROUND SCRIPT
 * 
 * Uses manual OAuth flow instead of Chrome's broken identity API
 */

console.log('🚀 Loading WORKING OAuth background script...');

// OAuth Configuration
const OAUTH_CONFIG = {
  clientId: '506990861082-8dss8jehi5ijek4sfg2p1srj439hk6vh.apps.googleusercontent.com',
  redirectUri: chrome.identity.getRedirectURL(),
  scope: 'https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.readonly',
  responseType: 'token'
};

let isProcessing = false;

// Extension lifecycle
chrome.runtime.onInstalled.addListener(() => {
  console.log('✅ Working OAuth extension installed');
  chrome.storage.local.set({
    isAuthenticated: false,
    isProcessing: false
  });
});

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('📨 Received message:', request.action);
  
  switch (request.action) {
    case 'login':
      handleManualLogin(sendResponse);
      return true;
    case 'logout':
      handleLogout(sendResponse);
      return true;
    case 'getStatus':
      sendResponse({ 
        success: true, 
        isProcessing: isProcessing,
        message: 'Status retrieved'
      });
      return true;
    case 'testConnection':
      sendResponse({ 
        success: true, 
        message: 'Background script is working'
      });
      return true;
    default:
      console.warn('❓ Unknown action:', request.action);
      sendResponse({ success: false, error: 'Unknown action' });
  }
});

/**
 * Manual OAuth login that bypasses Chrome's broken identity API
 */
async function handleManualLogin(sendResponse) {
  try {
    console.log('🔐 Starting MANUAL OAuth login...');
    
    // Clear any existing auth first
    await chrome.storage.local.remove(['authToken', 'isAuthenticated']);
    
    // Method 1: Try Chrome identity first (in case it works now)
    try {
      console.log('🔄 Trying Chrome identity API first...');
      const chromeToken = await chrome.identity.getAuthToken({ 
        interactive: true 
      });
      
      if (chromeToken && typeof chromeToken === 'string' && chromeToken.length > 10) {
        console.log('✅ Chrome identity API worked! Token received');
        
        // Test the token immediately
        const testResult = await testGmailToken(chromeToken);
        if (testResult.success) {
          await chrome.storage.local.set({
            authToken: chromeToken,
            isAuthenticated: true,
            userProfile: testResult.profile,
            loginTime: Date.now(),
            method: 'chrome-identity'
          });
          
          console.log('✅ Chrome identity login successful');
          sendResponse({ 
            success: true, 
            profile: testResult.profile,
            method: 'chrome-identity'
          });
          return;
        }
      }
    } catch (chromeError) {
      console.log('❌ Chrome identity failed:', chromeError.message);
    }
    
    // Method 2: Manual OAuth flow
    console.log('🔄 Falling back to manual OAuth flow...');
    
    const authUrl = `https://accounts.google.com/oauth/authorize?` +
      `client_id=${OAUTH_CONFIG.clientId}&` +
      `redirect_uri=${encodeURIComponent(OAUTH_CONFIG.redirectUri)}&` +
      `scope=${encodeURIComponent(OAUTH_CONFIG.scope)}&` +
      `response_type=${OAUTH_CONFIG.responseType}&` +
      `access_type=online`;
    
    console.log('🌐 Opening manual OAuth URL...');
    
    // Open OAuth URL and listen for redirect
    const authResult = await new Promise((resolve, reject) => {
      chrome.tabs.create({ url: authUrl }, (tab) => {
        const tabId = tab.id;
        
        // Listen for tab updates
        const listener = (updatedTabId, changeInfo, updatedTab) => {
          if (updatedTabId === tabId && changeInfo.url) {
            const url = changeInfo.url;
            
            // Check if this is our redirect URL with token
            if (url.includes(OAUTH_CONFIG.redirectUri) && url.includes('access_token=')) {
              // Extract token from URL
              const match = url.match(/access_token=([^&]+)/);
              if (match) {
                const token = match[1];
                chrome.tabs.onUpdated.removeListener(listener);
                chrome.tabs.remove(tabId);
                resolve(token);
              }
            }
            
            // Check for errors
            if (url.includes('error=')) {
              const errorMatch = url.match(/error=([^&]+)/);
              const error = errorMatch ? errorMatch[1] : 'unknown_error';
              chrome.tabs.onUpdated.removeListener(listener);
              chrome.tabs.remove(tabId);
              reject(new Error(`OAuth error: ${error}`));
            }
          }
        };
        
        chrome.tabs.onUpdated.addListener(listener);
        
        // Timeout after 5 minutes
        setTimeout(() => {
          chrome.tabs.onUpdated.removeListener(listener);
          chrome.tabs.remove(tabId);
          reject(new Error('OAuth timeout - user took too long'));
        }, 300000);
      });
    });
    
    console.log('✅ Manual OAuth token received');
    
    // Test the manual token
    const testResult = await testGmailToken(authResult);
    if (!testResult.success) {
      throw new Error(`Token validation failed: ${testResult.error}`);
    }
    
    // Store successful auth
    await chrome.storage.local.set({
      authToken: authResult,
      isAuthenticated: true,
      userProfile: testResult.profile,
      loginTime: Date.now(),
      method: 'manual-oauth'
    });
    
    console.log('✅ Manual OAuth login successful');
    sendResponse({ 
      success: true, 
      profile: testResult.profile,
      method: 'manual-oauth'
    });
    
  } catch (error) {
    console.error('❌ Manual OAuth login failed:', error);
    
    await chrome.storage.local.set({
      isAuthenticated: false,
      lastLoginError: error.message,
      lastLoginErrorTime: Date.now()
    });
    
    sendResponse({ 
      success: false, 
      error: error.message 
    });
  }
}

/**
 * Test Gmail token
 */
async function testGmailToken(token) {
  try {
    console.log('🧪 Testing Gmail token...');
    
    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gmail API error ${response.status}: ${errorText}`);
    }
    
    const profile = await response.json();
    console.log('✅ Gmail token test successful for:', profile.emailAddress);
    
    return { success: true, profile };
    
  } catch (error) {
    console.error('❌ Gmail token test failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle logout
 */
async function handleLogout(sendResponse) {
  try {
    console.log('🔐 Logging out...');
    
    isProcessing = false;
    
    // Clear auth data
    await chrome.storage.local.remove([
      'authToken', 
      'isAuthenticated', 
      'userProfile'
    ]);
    
    await chrome.storage.local.set({
      isAuthenticated: false,
      isProcessing: false
    });
    
    console.log('✅ Logout successful');
    sendResponse({ success: true });
    
  } catch (error) {
    console.error('❌ Logout failed:', error);
    sendResponse({ success: false, error: error.message });
  }
}

console.log('✅ Working OAuth background script loaded'); 