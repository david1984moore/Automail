/**
 * EMERGENCY GMAIL API DEBUG SCRIPT
 * 
 * This script tests the Gmail API directly to see why emails aren't being found
 * Run this in the console to debug the Gmail connection
 */

window.debugGmailAPI = async function() {
    console.log('🔍 EMERGENCY GMAIL API DEBUG');
    console.log('============================');
    
    try {
        // Get auth token
        const authData = await chrome.storage.local.get(['authToken', 'isAuthenticated']);
        
        if (!authData.isAuthenticated || !authData.authToken) {
            console.error('❌ Not authenticated! Please login first.');
            return;
        }
        
        const authToken = authData.authToken;
        console.log('✅ Auth token found');
        
        // Test 1: Basic inbox query (what we're currently using)
        console.log('\n🧪 TEST 1: Basic inbox query');
        try {
            const response1 = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages?q=in:inbox&maxResults=10', {
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response1.ok) {
                const data1 = await response1.json();
                console.log(`📧 Basic inbox query: Found ${data1.messages?.length || 0} messages`);
                if (data1.messages && data1.messages.length > 0) {
                    console.log(`   First message ID: ${data1.messages[0].id}`);
                }
            } else {
                console.error(`❌ Basic inbox query failed: ${response1.status} ${response1.statusText}`);
            }
        } catch (error) {
            console.error('❌ Basic inbox query error:', error);
        }
        
        // Test 2: Primary category query
        console.log('\n🧪 TEST 2: Primary category query');
        try {
            const response2 = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages?q=in:inbox category:primary&maxResults=10', {
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response2.ok) {
                const data2 = await response2.json();
                console.log(`📧 Primary category query: Found ${data2.messages?.length || 0} messages`);
            } else {
                console.error(`❌ Primary category query failed: ${response2.status} ${response2.statusText}`);
            }
        } catch (error) {
            console.error('❌ Primary category query error:', error);
        }
        
        // Test 3: Check inbox labels
        console.log('\n🧪 TEST 3: Check Gmail labels');
        try {
            const response3 = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response3.ok) {
                const data3 = await response3.json();
                const automailLabels = data3.labels?.filter(label => label.name.toLowerCase().includes('automail')) || [];
                console.log(`📋 Found ${automailLabels.length} Automail labels:`);
                automailLabels.forEach(label => {
                    console.log(`   - ${label.name} (${label.id})`);
                });
            } else {
                console.error(`❌ Labels query failed: ${response3.status} ${response3.statusText}`);
            }
        } catch (error) {
            console.error('❌ Labels query error:', error);
        }
        
        // Test 4: Check user profile
        console.log('\n🧪 TEST 4: Check user profile');
        try {
            const response4 = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response4.ok) {
                const data4 = await response4.json();
                console.log(`👤 User email: ${data4.emailAddress}`);
                console.log(`📊 Total messages: ${data4.messagesTotal}`);
                console.log(`📬 Total threads: ${data4.threadsTotal}`);
            } else {
                console.error(`❌ Profile query failed: ${response4.status} ${response4.statusText}`);
            }
        } catch (error) {
            console.error('❌ Profile query error:', error);
        }
        
        // Test 5: Validate token by calling background script
        console.log('\n🧪 TEST 5: Background script token validation');
        try {
            const response5 = await chrome.runtime.sendMessage({ action: 'validateToken' });
            console.log(`🔐 Token validation: ${response5.valid ? 'VALID' : 'INVALID'}`);
            if (!response5.valid) {
                console.error('❌ Token is invalid! This explains why Gmail API returns no emails.');
                console.log('💡 Solution: Logout and login again to refresh the token');
            }
        } catch (error) {
            console.error('❌ Token validation error:', error);
        }
        
        // Test 6: Force refresh token
        console.log('\n🧪 TEST 6: Force token refresh test');
        try {
            const response6 = await chrome.runtime.sendMessage({ action: 'debugOAuth' });
            console.log(`🔄 OAuth debug result:`, response6);
        } catch (error) {
            console.error('❌ OAuth debug error:', error);
        }
        
        console.log('\n✅ Gmail API debug complete!');
        console.log('If all tests show 0 messages, the issue might be:');
        console.log('1. ❌ Token expired or invalid (most likely)');
        console.log('2. ❌ OAuth scope insufficient (needs gmail.modify)');
        console.log('3. ❌ All emails are in non-primary categories');
        console.log('4. ❌ Network/API rate limiting');
        console.log('\n💡 RECOMMENDED ACTION: Logout and Login again to refresh token!');
        
    } catch (error) {
        console.error('❌ Debug script error:', error);
    }
};

// Auto-run the debug
console.log('🔍 Gmail API Debug Script loaded!');
console.log('💡 Run: debugGmailAPI()'); 