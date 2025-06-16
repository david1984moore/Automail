/**
 * COMPLETE AUTOMAIL EXTENSION FIX
 * Advanced debugging and repair for extension context issues
 * 
 * CRITICAL STEPS BEFORE RUNNING:
 * 1. Go to chrome://extensions/
 * 2. Enable "Developer mode" (toggle in top right)
 * 3. Find Automail extension and note the Extension ID
 * 4. Click "Remove" to completely uninstall
 * 5. Close ALL browser tabs except this one
 * 6. Restart Chrome completely
 * 7. Go to chrome://extensions/
 * 8. Click "Load unpacked" and select extension folder
 * 9. Open Gmail in NEW tab
 * 10. Run this script
 */

console.log('🔧 AUTOMAIL COMPLETE FIX STARTING...');
console.log('🚨 This is the advanced fix for extension context issues');

// Advanced extension detection
function detectExtensionState() {
    console.log('🔍 ADVANCED EXTENSION STATE DETECTION');
    console.log('=====================================');
    
    // Check basic Chrome API availability
    const chromeAvailable = typeof chrome !== 'undefined';
    console.log('Chrome object available:', chromeAvailable);
    
    if (!chromeAvailable) {
        console.log('❌ CRITICAL: Chrome object not available');
        console.log('💡 This means you are NOT in an extension context');
        console.log('📋 SOLUTION: Extension needs complete reinstall');
        return false;
    }
    
    // Check runtime API
    const runtimeAvailable = typeof chrome.runtime !== 'undefined';
    console.log('Chrome.runtime available:', runtimeAvailable);
    
    if (!runtimeAvailable) {
        console.log('❌ CRITICAL: chrome.runtime not available');
        console.log('💡 Extension is not properly loaded');
        return false;
    }
    
    // Check extension ID
    try {
        const extensionId = chrome.runtime.id;
        console.log('Extension ID:', extensionId);
        
        if (!extensionId) {
            console.log('❌ CRITICAL: Extension ID is undefined');
            console.log('💡 Extension context is invalid');
            return false;
        }
        
        console.log('✅ Extension ID detected:', extensionId);
    } catch (error) {
        console.log('❌ Error getting extension ID:', error.message);
        return false;
    }
    
    // Check sendMessage API
    const sendMessageAvailable = typeof chrome.runtime.sendMessage === 'function';
    console.log('chrome.runtime.sendMessage available:', sendMessageAvailable);
    
    if (!sendMessageAvailable) {
        console.log('❌ CRITICAL: sendMessage API not available');
        return false;
    }
    
    // Check storage API
    const storageAvailable = typeof chrome.storage !== 'undefined';
    console.log('chrome.storage available:', storageAvailable);
    
    // Check identity API (for OAuth)
    const identityAvailable = typeof chrome.identity !== 'undefined';
    console.log('chrome.identity available:', identityAvailable);
    
    console.log('=====================================');
    return runtimeAvailable && sendMessageAvailable;
}

// Test extension communication with timeout
async function testExtensionCommunication() {
    console.log('🔍 TESTING EXTENSION COMMUNICATION');
    console.log('==================================');
    
    if (typeof chrome?.runtime?.sendMessage !== 'function') {
        console.log('❌ sendMessage not available - cannot test communication');
        return false;
    }
    
    try {
        console.log('📤 Sending ping message to background script...');
        
        const response = await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Communication timeout after 5 seconds'));
            }, 5000);
            
            chrome.runtime.sendMessage(
                { 
                    action: 'ping', 
                    timestamp: Date.now(),
                    source: 'content_script_test'
                },
                (response) => {
                    clearTimeout(timeout);
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                    } else {
                        resolve(response);
                    }
                }
            );
        });
        
        console.log('✅ Communication successful!');
        console.log('📥 Response:', response);
        return true;
        
    } catch (error) {
        console.log('❌ Communication failed:', error.message);
        
        if (error.message.includes('Could not establish connection')) {
            console.log('💡 Background script is not responding');
            console.log('🔧 Try reloading the extension');
        } else if (error.message.includes('timeout')) {
            console.log('💡 Background script is slow or hung');
            console.log('🔧 Extension may need restart');
        }
        
        return false;
    }
}

// Check if content script is properly injected
function checkContentScriptInjection() {
    console.log('🔍 CHECKING CONTENT SCRIPT INJECTION');
    console.log('====================================');
    
    // Check for Automail sidebar
    const sidebar = document.getElementById('automail-sidebar');
    console.log('Automail sidebar found:', !!sidebar);
    
    if (sidebar) {
        console.log('✅ Sidebar element exists');
        console.log('Sidebar classes:', sidebar.className);
        console.log('Sidebar visible:', sidebar.offsetWidth > 0 && sidebar.offsetHeight > 0);
    } else {
        console.log('❌ Sidebar element not found');
    }
    
    // Check for injected scripts
    const scripts = Array.from(document.querySelectorAll('script')).filter(script => 
        script.src && (script.src.includes('content.js') || script.src.includes('chrome-extension'))
    );
    console.log('Extension scripts found:', scripts.length);
    scripts.forEach((script, index) => {
        console.log(`Script ${index + 1}:`, script.src);
    });
    
    // Check for injected CSS
    const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style')).filter(element => 
        (element.href && element.href.includes('chrome-extension')) ||
        (element.textContent && element.textContent.includes('automail'))
    );
    console.log('Extension styles found:', styles.length);
    
    return {
        sidebarExists: !!sidebar,
        scriptsFound: scripts.length,
        stylesFound: styles.length
    };
}

// Manual extension context injection (last resort)
function attemptManualInjection() {
    console.log('🔧 ATTEMPTING MANUAL EXTENSION INJECTION');
    console.log('========================================');
    
    // This is a last resort method to try to establish extension context
    // Note: This may not work due to Chrome security restrictions
    
    try {
        // Try to detect extension ID from existing elements
        const extensionElements = Array.from(document.querySelectorAll('*')).filter(el => 
            el.src && el.src.includes('chrome-extension')
        );
        
        if (extensionElements.length > 0) {
            const extensionUrl = extensionElements[0].src;
            const extensionId = extensionUrl.match(/chrome-extension:\/\/([a-z]+)/)?.[1];
            
            if (extensionId) {
                console.log('🔍 Detected extension ID from DOM:', extensionId);
                
                // Try to manually load content script
                const script = document.createElement('script');
                script.src = `chrome-extension://${extensionId}/content.js`;
                script.onload = () => console.log('✅ Manual content script injection successful');
                script.onerror = (error) => console.log('❌ Manual injection failed:', error);
                
                document.head.appendChild(script);
                
                return extensionId;
            }
        }
        
        console.log('❌ Could not detect extension ID for manual injection');
        return null;
        
    } catch (error) {
        console.log('❌ Manual injection error:', error.message);
        return null;
    }
}

// Complete diagnostic and fix
async function runCompleteFix() {
    console.log('🚀 RUNNING COMPLETE AUTOMAIL FIX');
    console.log('================================');
    console.log('🌐 Current URL:', window.location.href);
    console.log('📄 Document state:', document.readyState);
    console.log('⏰ Timestamp:', new Date().toISOString());
    console.log('');
    
    // Step 1: Detect extension state
    const extensionWorking = detectExtensionState();
    console.log('');
    
    // Step 2: Check content script injection
    const injectionStatus = checkContentScriptInjection();
    console.log('');
    
    // Step 3: Test communication (if extension context available)
    let communicationWorking = false;
    if (extensionWorking) {
        communicationWorking = await testExtensionCommunication();
        console.log('');
    }
    
    // Step 4: Final diagnosis and recommendations
    console.log('📊 FINAL DIAGNOSIS');
    console.log('==================');
    console.log('Extension context available:', extensionWorking);
    console.log('Content script injected:', injectionStatus.scriptsFound > 0);
    console.log('Sidebar exists:', injectionStatus.sidebarExists);
    console.log('Communication working:', communicationWorking);
    console.log('');
    
    if (!extensionWorking) {
        console.log('🚨 CRITICAL ISSUE: Extension context not available');
        console.log('');
        console.log('📋 COMPLETE FIX PROCEDURE:');
        console.log('1. 🔄 Restart Chrome completely (close all windows)');
        console.log('2. 🌐 Open Chrome and go to chrome://extensions/');
        console.log('3. 🔧 Enable "Developer mode" (toggle in top right)');
        console.log('4. 🗑️ Find Automail and click "Remove"');
        console.log('5. 📁 Click "Load unpacked" and select your extension folder');
        console.log('6. ✅ Verify extension shows as "Enabled"');
        console.log('7. 🆕 Open Gmail in completely new tab');
        console.log('8. 🔍 Check if sidebar appears automatically');
        console.log('');
        console.log('💡 If still not working, there may be a manifest.json error');
        
        // Attempt manual injection as last resort
        const detectedId = attemptManualInjection();
        if (detectedId) {
            console.log('🔧 Attempted manual injection with ID:', detectedId);
        }
        
    } else if (!communicationWorking) {
        console.log('🚨 ISSUE: Extension loaded but communication broken');
        console.log('💡 Background script may not be responding');
        console.log('🔧 Try clicking the extension reload button in chrome://extensions/');
        
    } else {
        console.log('✅ ALL SYSTEMS WORKING!');
        console.log('🎉 Automail extension is fully functional');
    }
    
    console.log('');
    console.log('================================');
}

// Auto-run the complete fix
runCompleteFix();

// Make functions available for manual testing
window.automailCompleteFix = {
    detectExtension: detectExtensionState,
    testCommunication: testExtensionCommunication,
    checkInjection: checkContentScriptInjection,
    manualInject: attemptManualInjection,
    runComplete: runCompleteFix
};

console.log('🔧 Advanced debug functions available at window.automailCompleteFix'); 