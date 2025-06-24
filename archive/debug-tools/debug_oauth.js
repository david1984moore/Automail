// Debug OAuth Script
console.log('🔧 Starting OAuth Debug Test...');

async function testOAuth() {
  try {
    console.log('🔐 Testing Chrome Identity API...');
    
    // Get auth token
    const token = await chrome.identity.getAuthToken({ interactive: true });
    console.log('✅ Token received:', typeof token, token);
    
    // Extract token string
    let tokenString = token;
    if (typeof token === 'object' && token !== null) {
      tokenString = token.token || token.access_token || token.accessToken;
    }
    
    console.log('🔑 Token string:', tokenString?.substring(0, 20) + '...');
    
    // Test Gmail API directly
    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
      headers: {
        'Authorization': `Bearer ${tokenString}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('📧 Gmail API Response Status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Gmail API Success:', data);
    } else {
      const error = await response.text();
      console.error('❌ Gmail API Error:', error);
    }
    
  } catch (error) {
    console.error('❌ OAuth Test Failed:', error);
  }
}

// Run test
testOAuth(); 