/**
 * MINIMAL WORKING AUTOMAIL BACKGROUND SCRIPT
 * 
 * This is a stripped-down version that focuses on core functionality
 * and avoids complex OAuth issues that are causing problems.
 */

console.log('🚀 Minimal Automail background script loading...');

// Simple processing state
let isProcessing = false;
let processingInterval = null;

// Extension lifecycle
chrome.runtime.onInstalled.addListener(() => {
  console.log('✅ Automail extension installed');
  chrome.storage.local.set({
    isAuthenticated: false,
    isProcessing: false,
    version: '1.0'
  });
});

chrome.runtime.onStartup.addListener(() => {
  console.log('✅ Automail extension started');
});

/**
 * Handle toolbar icon clicks
 */
chrome.action.onClicked.addListener(async (tab) => {
  console.log('🔄 Extension icon clicked, attempting to toggle sidebar');
  
  // Check if we're on Gmail
  if (!tab.url || !tab.url.includes('mail.google.com')) {
    console.log('❌ Not on Gmail page, cannot toggle sidebar');
    return;
  }
  
  try {
    // Send message to content script to toggle sidebar
    await chrome.tabs.sendMessage(tab.id, { action: 'toggleSidebar' });
    console.log('✅ Toggle sidebar message sent to content script');
  } catch (error) {
    console.error('❌ Error sending toggle message to content script:', error);
    
    // If content script not found, try to inject it
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
      console.log('✅ Content script injected, trying to toggle sidebar again');
      
      // Wait a moment for content script to initialize, then try again
      setTimeout(async () => {
        try {
          await chrome.tabs.sendMessage(tab.id, { action: 'toggleSidebar' });
          console.log('✅ Toggle sidebar message sent after injection');
        } catch (retryError) {
          console.error('❌ Error sending toggle message after injection:', retryError);
        }
      }, 500);
      
    } catch (injectionError) {
      console.error('❌ Error injecting content script:', injectionError);
    }
  }
});

/**
 * Handle messages from content script
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('📨 Received message:', request.action);
  
  switch (request.action) {
    case 'login':
      handleSimpleLogin(sendResponse);
      return true;
    case 'logout':
      handleSimpleLogout(sendResponse);
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
 * Simple login that bypasses complex OAuth for testing
 */
async function handleSimpleLogin(sendResponse) {
  try {
    console.log('🔐 Starting simple login...');
    
    // For testing purposes, use a simplified OAuth approach
    const authToken = await chrome.identity.getAuthToken({ 
      interactive: true
    });
    
    if (!authToken) {
      throw new Error('No auth token received');
    }
    
    console.log('✅ Auth token received');
    
    // Simple validation - just check if token exists
    await chrome.storage.local.set({
      authToken: authToken,
      isAuthenticated: true,
      loginTime: Date.now()
    });
    
    console.log('✅ Login successful');
    sendResponse({ 
      success: true, 
      message: 'Login successful'
    });
    
  } catch (error) {
    console.error('❌ Login failed:', error);
    
    await chrome.storage.local.set({
      isAuthenticated: false,
      lastError: error.message
    });
    
    sendResponse({ 
      success: false, 
      error: error.message 
    });
  }
}

/**
 * Simple logout
 */
async function handleSimpleLogout(sendResponse) {
  try {
    console.log('🔐 Logging out...');
    
    // Stop any processing
    if (processingInterval) {
      clearInterval(processingInterval);
      processingInterval = null;
    }
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

console.log('✅ Minimal Automail background script loaded successfully'); 