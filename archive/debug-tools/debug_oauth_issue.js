/**
 * OAuth Debug and Cache Clearing Script
 * 
 * This script helps diagnose and fix the "bad client id: (0)" error
 * Run this in Chrome DevTools console on the extension background page
 */

async function debugAndFixOAuth() {
  console.log('🔧 Starting OAuth Debug and Fix Process...');
  
  try {
    // Step 1: Clear all cached tokens
    console.log('🧹 Clearing cached OAuth tokens...');
    
    try {
      // Get any cached tokens
      const cachedToken = await chrome.identity.getAuthToken({ interactive: false });
      if (cachedToken) {
        console.log('🗑️ Found cached token, removing...');
        await chrome.identity.removeCachedAuthToken({ token: cachedToken });
        console.log('✅ Cached token removed');
      } else {
        console.log('ℹ️ No cached tokens found');
      }
    } catch (e) {
      console.log('ℹ️ No cached tokens to remove');
    }
    
    // Step 2: Clear extension storage
    console.log('🧹 Clearing extension storage...');
    await chrome.storage.local.clear();
    console.log('✅ Extension storage cleared');
    
    // Step 3: Check manifest OAuth config
    console.log('🔍 Checking manifest OAuth configuration...');
    const manifest = chrome.runtime.getManifest();
    console.log('📄 OAuth2 config:', manifest.oauth2);
    
    if (!manifest.oauth2 || !manifest.oauth2.client_id) {
      console.error('❌ OAuth2 configuration missing in manifest!');
      return false;
    }
    
    console.log('✅ OAuth2 configuration found');
    
    // Step 4: Test OAuth request with detailed logging
    console.log('🔐 Testing OAuth request...');
    
    try {
      const token = await chrome.identity.getAuthToken({ 
        interactive: false // Start with non-interactive to see if we get cached result
      });
      
      if (token) {
        console.log('✅ Non-interactive token obtained:', typeof token);
        return await testTokenWithGmail(token);
      } else {
        console.log('ℹ️ No non-interactive token, trying interactive...');
        const interactiveToken = await chrome.identity.getAuthToken({ 
          interactive: true 
        });
        console.log('✅ Interactive token obtained:', typeof interactiveToken);
        return await testTokenWithGmail(interactiveToken);
      }
      
    } catch (error) {
      console.error('❌ OAuth request failed:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      
      // If we get the "bad client id" error, suggest solutions
      if (error.message.includes('bad client id')) {
        console.log('🔧 Detected "bad client id" error. Suggested fixes:');
        console.log('1. Completely remove and reload the extension');
        console.log('2. Clear browser cache and cookies');
        console.log('3. Restart Chrome browser');
        console.log('4. Check Google Cloud Console OAuth configuration');
      }
      
      return false;
    }
    
  } catch (error) {
    console.error('❌ Debug process failed:', error);
    return false;
  }
}

async function testTokenWithGmail(token) {
  try {
    console.log('🧪 Testing token with Gmail API...');
    
    let tokenString = token;
    if (typeof token === 'object' && token !== null) {
      tokenString = token.token || token.access_token || token.accessToken;
    }
    
    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
      headers: { 
        'Authorization': `Bearer ${tokenString}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('📡 Gmail API response status:', response.status);
    
    if (response.ok) {
      const profile = await response.json();
      console.log('✅ Gmail API test successful!');
      console.log('👤 User email:', profile.emailAddress);
      return true;
    } else {
      const errorText = await response.text();
      console.error('❌ Gmail API test failed:', response.status, errorText);
      return false;
    }
    
  } catch (error) {
    console.error('❌ Gmail API test error:', error);
    return false;
  }
}

// Auto-run the debug process
console.log('🚀 OAuth Debug Script Loaded');
console.log('Run debugAndFixOAuth() to start diagnosis');

// Export for manual use
window.debugAndFixOAuth = debugAndFixOAuth; 