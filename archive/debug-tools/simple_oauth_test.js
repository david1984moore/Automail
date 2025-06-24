// SIMPLE OAUTH TEST - Run in Gmail Console
console.log('🔧 SIMPLE OAUTH TEST');

// Check current Extension ID
console.log('📋 Current Extension ID:', chrome.runtime.id);
console.log('🔗 You need to verify this ID is in your Google Cloud Console');

// Check manifest OAuth config
const manifest = chrome.runtime.getManifest();
console.log('📋 Manifest OAuth config:', manifest.oauth2);

// Test OAuth directly
console.log('🔐 Testing OAuth...');

// Clear any cached tokens first
chrome.identity.clearAllCachedAuthTokens(() => {
  console.log('✅ All cached tokens cleared');
  
  // Now try OAuth
  chrome.identity.getAuthToken({ interactive: true }, (token) => {
    if (chrome.runtime.lastError) {
      console.error('❌ OAuth Error:', chrome.runtime.lastError.message);
      
      // Check if it's the Extension ID mismatch
      const extensionId = chrome.runtime.id;
      console.log('🚨 EXTENSION ID CHECK:');
      console.log('Current Extension ID:', extensionId);
      console.log('Go to Google Cloud Console and verify this EXACT ID is in your OAuth client');
      console.log('OAuth Client Link: https://console.cloud.google.com/apis/credentials');
      
    } else {
      console.log('✅ OAuth SUCCESS! Token received:', token ? 'YES' : 'NO');
    }
  });
});

console.log('🔧 TEST COMPLETE - Check results above'); 