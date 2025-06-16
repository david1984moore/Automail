/**
 * AUTOMAIL OAUTH DEBUGGING CONSOLE SCRIPT
 * Run this in Chrome DevTools Console while on Gmail with Automail extension loaded
 * 
 * Usage: Copy and paste this entire script into the console and run
 */

(async function AutomailOAuthDebugger() {
    console.log('\n🔧 AUTOMAIL OAUTH DEBUGGER');
    console.log('============================');
    console.log('Starting comprehensive OAuth debugging...\n');

    // Helper functions
    function logStep(step, message) {
        console.log(`\n${step} ${message}`);
        console.log('─'.repeat(50));
    }

    function logSuccess(message) {
        console.log(`✅ ${message}`);
    }

    function logError(message) {
        console.log(`❌ ${message}`);
    }

    function logWarning(message) {
        console.log(`⚠️ ${message}`);
    }

    function logInfo(message) {
        console.log(`ℹ️ ${message}`);
    }

    // Step 1: Check Extension Installation
    logStep('🔍 STEP 1:', 'Checking Extension Installation');
    
    try {
        if (typeof chrome === 'undefined') {
            logError('Chrome extension APIs not available');
            return;
        }

        if (!chrome.runtime || !chrome.runtime.id) {
            logError('Extension not properly loaded');
            return;
        }

        logSuccess(`Extension ID: ${chrome.runtime.id}`);
        
        // Check manifest
        const manifest = chrome.runtime.getManifest();
        logSuccess(`Extension Name: ${manifest.name}`);
        logSuccess(`Extension Version: ${manifest.version}`);
        logSuccess(`Manifest Version: ${manifest.manifest_version}`);
        
    } catch (error) {
        logError(`Extension check failed: ${error.message}`);
        return;
    }

    // Step 2: Check OAuth Configuration
    logStep('🔐 STEP 2:', 'Checking OAuth Configuration');
    
    try {
        const manifest = chrome.runtime.getManifest();
        
        if (!manifest.oauth2) {
            logError('No OAuth2 configuration found in manifest');
            return;
        }

        logSuccess(`OAuth2 Client ID: ${manifest.oauth2.client_id}`);
        logInfo(`OAuth2 Scopes: ${manifest.oauth2.scopes.join(', ')}`);
        
        // Check required scopes
        const requiredScopes = [
            'https://www.googleapis.com/auth/gmail.modify',
            'https://www.googleapis.com/auth/gmail.readonly',
            'https://www.googleapis.com/auth/contacts'
        ];
        
        const missingScopes = requiredScopes.filter(scope => 
            !manifest.oauth2.scopes.includes(scope)
        );
        
        if (missingScopes.length > 0) {
            logError(`Missing required scopes: ${missingScopes.join(', ')}`);
        } else {
            logSuccess('All required OAuth2 scopes present');
        }
        
    } catch (error) {
        logError(`OAuth configuration check failed: ${error.message}`);
        return;
    }

    // Step 3: Check Chrome Identity API
    logStep('🆔 STEP 3:', 'Testing Chrome Identity API');
    
    try {
        if (!chrome.identity) {
            logError('Chrome Identity API not available');
            return;
        }

        logSuccess('Chrome Identity API available');
        
        // Check for cached tokens
        logInfo('Checking for cached tokens...');
        try {
            const cachedToken = await chrome.identity.getAuthToken({ interactive: false });
            if (cachedToken) {
                logSuccess('Found cached token');
                logInfo(`Token preview: ${cachedToken.substring(0, 20)}...`);
            } else {
                logInfo('No cached token found');
            }
        } catch (error) {
            logInfo(`No cached token: ${error.message}`);
        }
        
    } catch (error) {
        logError(`Chrome Identity API check failed: ${error.message}`);
        return;
    }

    // Step 4: Test Network Connectivity
    logStep('🌐 STEP 4:', 'Testing Network Connectivity');
    
    const endpoints = [
        'https://www.googleapis.com',
        'https://gmail.googleapis.com',
        'https://accounts.google.com',
        'https://oauth2.googleapis.com'
    ];

    for (const endpoint of endpoints) {
        try {
            const response = await fetch(endpoint, { 
                method: 'HEAD',
                mode: 'no-cors'  // Avoid CORS issues for connectivity test
            });
            logSuccess(`${endpoint}: Reachable`);
        } catch (error) {
            logError(`${endpoint}: ${error.message}`);
        }
    }

    // Step 5: Check Current Storage State
    logStep('💾 STEP 5:', 'Checking Extension Storage');
    
    try {
        const storageData = await chrome.storage.local.get();
        logInfo('Current storage contents:');
        
        Object.entries(storageData).forEach(([key, value]) => {
            if (key === 'authToken' && value) {
                console.log(`  ${key}: ${typeof value === 'string' ? value.substring(0, 20) + '...' : '[Object]'}`);
            } else {
                console.log(`  ${key}:`, value);
            }
        });
        
    } catch (error) {
        logError(`Storage check failed: ${error.message}`);
    }

    // Step 6: Clear and Test Fresh OAuth
    logStep('🧹 STEP 6:', 'Testing Fresh OAuth Flow');
    
    try {
        // Clear all cached tokens first
        logInfo('Clearing all cached authentication data...');
        
        try {
            await chrome.identity.clearAllCachedAuthTokens();
            logSuccess('Cleared Chrome identity cache');
        } catch (error) {
            logWarning(`Failed to clear identity cache: ${error.message}`);
        }
        
        // Clear extension storage
        await chrome.storage.local.set({
            isAuthenticated: false,
            authToken: null,
            userProfile: null,
            sessionInvalidated: true,
            requiresFreshAuth: true
        });
        logSuccess('Cleared extension storage');
        
        // Attempt interactive OAuth
        logInfo('Attempting interactive OAuth flow...');
        
        const token = await chrome.identity.getAuthToken({ interactive: true });
        
        if (!token) {
            logError('OAuth flow did not return a token');
            return;
        }
        
        logSuccess('OAuth token obtained successfully');
        logInfo(`Token type: ${typeof token}`);
        logInfo(`Token preview: ${token.toString().substring(0, 30)}...`);
        
        // Step 7: Test Gmail API with token
        logStep('📧 STEP 7:', 'Testing Gmail API Access');
        
        const gmailResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (gmailResponse.ok) {
            const profile = await gmailResponse.json();
            logSuccess('Gmail API access successful!');
            logInfo(`Gmail Profile: ${profile.emailAddress}`);
            logInfo(`Messages Total: ${profile.messagesTotal}`);
            
            // Store successful authentication
            await chrome.storage.local.set({
                isAuthenticated: true,
                authToken: token,
                userProfile: profile,
                sessionInvalidated: false,
                requiresFreshAuth: false,
                lastLoginTime: Date.now()
            });
            
            logSuccess('Authentication data stored successfully');
            
            // Step 8: Test Extension Communication
            logStep('📡 STEP 8:', 'Testing Extension Communication');
            
            try {
                const response = await chrome.runtime.sendMessage({
                    action: 'debugOAuth',
                    test: true
                });
                
                if (response) {
                    logSuccess('Extension background communication working');
                } else {
                    logWarning('Extension background script may not be responding');
                }
            } catch (error) {
                logWarning(`Extension communication test: ${error.message}`);
            }
            
            console.log('\n🎉 OAUTH DEBUGGING COMPLETE - SUCCESS!');
            console.log('Your Automail extension should now be working properly.');
            console.log('Try clicking "Login with Google" in the Automail sidebar.');
            
        } else {
            const errorText = await gmailResponse.text();
            logError(`Gmail API access failed: ${gmailResponse.status}`);
            logError(`Error details: ${errorText}`);
            
            console.log('\n❌ OAUTH DEBUGGING COMPLETE - GMAIL API FAILED');
            console.log('The OAuth token was obtained but Gmail API access failed.');
            console.log('This suggests a permissions or API configuration issue.');
        }
        
    } catch (error) {
        logError(`OAuth flow failed: ${error.message}`);
        
        console.log('\n❌ OAUTH DEBUGGING COMPLETE - OAUTH FAILED');
        console.log('The OAuth flow itself failed. This suggests:');
        console.log('1. OAuth client configuration issues');
        console.log('2. Missing API permissions');
        console.log('3. Google Cloud Console setup problems');
        
        // Provide specific troubleshooting guidance
        console.log('\n🔧 TROUBLESHOOTING SUGGESTIONS:');
        console.log('1. Check Google Cloud Console project setup');
        console.log('2. Verify OAuth2 client ID configuration');
        console.log('3. Ensure Gmail API is enabled');
        console.log('4. Check OAuth consent screen configuration');
        console.log('5. Verify extension ID matches OAuth settings');
    }

    console.log('\n📋 DEBUGGING SESSION COMPLETE');
    console.log('============================');

})().catch(error => {
    console.error('❌ Debug script failed:', error);
    console.log('\n🆘 If you see this error, please:');
    console.log('1. Make sure you are on Gmail (mail.google.com)');
    console.log('2. Ensure Automail extension is loaded');
    console.log('3. Check browser console for other errors');
}); 