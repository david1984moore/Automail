/**
 * COMPLETE OAUTH CACHE CLEARING SCRIPT
 * 
 * Run this in Chrome DevTools Console on the extension background page
 * to completely clear all OAuth-related caches
 */

async function completeOAuthReset() {
  console.log('🧹 Starting COMPLETE OAuth cache reset...');
  
  try {
    // Step 1: Clear all cached auth tokens
    console.log('1. 🗑️ Clearing all cached auth tokens...');
    await new Promise((resolve) => {
      chrome.identity.clearAllCachedAuthTokens(() => {
        console.log('✅ All cached tokens cleared');
        resolve();
      });
    });
    
    // Step 2: Clear extension storage
    console.log('2. 🗑️ Clearing extension storage...');
    await chrome.storage.local.clear();
    await chrome.storage.sync.clear();
    console.log('✅ Extension storage cleared');
    
    // Step 3: Try to get and remove any remaining tokens
    console.log('3. 🔍 Checking for any remaining tokens...');
    try {
      const token = await chrome.identity.getAuthToken({ interactive: false });
      if (token) {
        console.log('🗑️ Found token, removing:', token.substring(0, 20) + '...');
        await chrome.identity.removeCachedAuthToken({ token: token });
        console.log('✅ Token removed');
      } else {
        console.log('✅ No tokens found');
      }
    } catch (e) {
      console.log('✅ No tokens to remove');
    }
    
    // Step 4: Reset extension state
    console.log('4. 🔄 Resetting extension state...');
    await chrome.storage.local.set({
      isAuthenticated: false,
      isProcessing: false,
      authToken: null,
      userProfile: null,
      lastLoginError: null,
      resetTimestamp: Date.now()
    });
    
    console.log('✅ COMPLETE OAuth reset finished!');
    console.log('🔄 Now try logging in again...');
    
    return true;
    
  } catch (error) {
    console.error('❌ OAuth reset failed:', error);
    return false;
  }
}

// Auto-run
console.log('🚀 OAuth Cache Clearing Script Loaded');
console.log('🔄 Starting automatic reset...');
completeOAuthReset(); 