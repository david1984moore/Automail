// Simple OAuth Diagnostic - Run this in Chrome Console on Gmail
console.log('🔧 OAUTH DIAGNOSTIC STARTED');

// Check extension manifest
const manifest = chrome.runtime.getManifest();
console.log('📋 Extension Name:', manifest.name);
console.log('📋 Extension ID:', chrome.runtime.id);
console.log('📋 OAuth2 Config:', manifest.oauth2);

if (manifest.oauth2) {
  console.log('✅ OAuth2 section found');
  console.log('🔑 Client ID:', manifest.oauth2.client_id);
  console.log('🔐 Scopes:', manifest.oauth2.scopes);
} else {
  console.error('❌ No OAuth2 configuration found in manifest');
}

// Test Chrome Identity API
console.log('\n🔍 Testing Chrome Identity API...');

chrome.identity.getAuthToken({ interactive: false }, (token) => {
  if (chrome.runtime.lastError) {
    console.error('❌ Non-interactive token error:', chrome.runtime.lastError.message);
  } else if (token) {
    console.log('✅ Non-interactive token available');
  } else {
    console.log('ℹ️ No cached token (normal)');
  }
});

// Test interactive OAuth
console.log('\n🔐 Testing Interactive OAuth (will show popup)...');
chrome.identity.getAuthToken({ interactive: true }, (token) => {
  if (chrome.runtime.lastError) {
    console.error('❌ Interactive OAuth error:', chrome.runtime.lastError.message);
    
    // Parse the error
    const error = chrome.runtime.lastError.message;
    if (error.includes('bad client id')) {
      console.log('\n🚨 BAD CLIENT ID DIAGNOSIS:');
      console.log('1. Check Google Cloud Console OAuth client type is "Chrome Extension"');
      console.log('2. Verify Extension ID in Google Cloud Console matches:', chrome.runtime.id);
      console.log('3. Ensure OAuth client is enabled and not deleted');
    }
  } else {
    console.log('✅ Interactive OAuth successful! Token:', token ? 'received' : 'null');
  }
});

console.log('🔧 OAUTH DIAGNOSTIC COMPLETED'); 