/**
 * Comprehensive Extension Reload and Debug Fix
 * Run this in Chrome console to completely fix content script injection issues
 * 
 * INSTRUCTIONS:
 * 1. Open Chrome Extensions page (chrome://extensions/)
 * 2. Find Automail extension
 * 3. Click "Remove" to completely uninstall
 * 4. Close ALL Gmail tabs
 * 5. Click "Load unpacked" and select your extension folder
 * 6. Open Gmail in NEW tab
 * 7. Run this script in Gmail console
 */

console.log('🔧 AUTOMAIL EXTENSION RELOAD FIX STARTING...');
console.log('⚡ This will help diagnose and fix content script injection issues');

// Step 1: Clear all extension-related storage
async function clearExtensionStorage() {
    console.log('🧹 Step 1: Clearing extension storage...');
    try {
        await chrome.storage.local.clear();
        await chrome.storage.sync.clear();
        console.log('✅ Extension storage cleared');
        return true;
    } catch (error) {
        console.log('❌ Cannot clear storage (extension context not available):', error.message);
        return false;
    }
}

// Step 2: Check extension context availability
function checkExtensionContext() {
    console.log('🔍 Step 2: Checking extension context...');
    
    const checks = {
        chrome: typeof chrome !== 'undefined',
        runtime: typeof chrome?.runtime !== 'undefined',
        sendMessage: typeof chrome?.runtime?.sendMessage !== 'undefined',
        storage: typeof chrome?.storage !== 'undefined',
        identity: typeof chrome?.identity !== 'undefined'
    };
    
    console.log('Extension Context Check:', checks);
    
    if (checks.chrome && checks.runtime) {
        console.log('✅ Extension context available');
        console.log('Extension ID:', chrome.runtime.id);
        return true;
    } else {
        console.log('❌ Extension context NOT available');
        return false;
    }
}

// Step 3: Check for content script injection
function checkContentScriptInjection() {
    console.log('🔍 Step 3: Checking content script injection...');
    
    // Check if sidebar exists
    const sidebar = document.getElementById('automail-sidebar');
    console.log('Automail sidebar exists:', !!sidebar);
    
    // Check for content script elements
    const scripts = Array.from(document.querySelectorAll('script')).filter(script => 
        script.src && script.src.includes('content.js')
    );
    console.log('Content scripts found:', scripts.length);
    
    // Check for CSS injection
    const styles = Array.from(document.querySelectorAll('link, style')).filter(element => 
        (element.href && element.href.includes('sidebar.css')) ||
        element.textContent?.includes('automail')
    );
    console.log('Automail styles found:', styles.length);
    
    return {
        sidebarExists: !!sidebar,
        scriptsInjected: scripts.length > 0,
        stylesInjected: styles.length > 0
    };
}

// Step 4: Test extension communication
async function testExtensionCommunication() {
    console.log('🔍 Step 4: Testing extension communication...');
    
    if (typeof chrome?.runtime?.sendMessage === 'undefined') {
        console.log('❌ chrome.runtime.sendMessage not available');
        return false;
    }
    
    try {
        const response = await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(
                { action: 'ping', timestamp: Date.now() },
                (response) => {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                    } else {
                        resolve(response);
                    }
                }
            );
        });
        
        console.log('✅ Extension communication working:', response);
        return true;
    } catch (error) {
        console.log('❌ Extension communication failed:', error.message);
        return false;
    }
}

// Step 5: Force content script reload
function forceContentScriptReload() {
    console.log('🔄 Step 5: Forcing content script reload...');
    
    // Remove existing sidebar if it exists
    const existingSidebar = document.getElementById('automail-sidebar');
    if (existingSidebar) {
        existingSidebar.remove();
        console.log('🗑️ Removed existing sidebar');
    }
    
    // Clear any existing event listeners
    window.removeEventListener('beforeunload', () => {});
    
    // Try to manually inject content script
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('content.js');
    script.onload = () => {
        console.log('✅ Content script manually injected');
    };
    script.onerror = (error) => {
        console.log('❌ Failed to manually inject content script:', error);
    };
    
    document.head.appendChild(script);
    
    // Try to manually inject CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = chrome.runtime.getURL('sidebar.css');
    link.onload = () => {
        console.log('✅ CSS manually injected');
    };
    link.onerror = (error) => {
        console.log('❌ Failed to manually inject CSS:', error);
    };
    
    document.head.appendChild(link);
}

// Main diagnostic function
async function runComprehensiveDiagnostic() {
    console.log('🚀 RUNNING COMPREHENSIVE DIAGNOSTIC...');
    console.log('================================================');
    
    // Check basic environment
    console.log('🌐 Current URL:', window.location.href);
    console.log('📄 Document ready state:', document.readyState);
    console.log('⏰ Current time:', new Date().toISOString());
    
    // Step 1: Clear storage
    const storageCleared = await clearExtensionStorage();
    
    // Step 2: Check extension context
    const contextAvailable = checkExtensionContext();
    
    // Step 3: Check content script injection
    const injectionStatus = checkContentScriptInjection();
    
    // Step 4: Test communication
    const communicationWorking = await testExtensionCommunication();
    
    // Summary
    console.log('================================================');
    console.log('📊 DIAGNOSTIC SUMMARY:');
    console.log('Storage cleared:', storageCleared);
    console.log('Extension context available:', contextAvailable);
    console.log('Content script injected:', injectionStatus.scriptsInjected);
    console.log('Sidebar exists:', injectionStatus.sidebarExists);
    console.log('Styles injected:', injectionStatus.stylesInjected);
    console.log('Communication working:', communicationWorking);
    
    // Determine the issue
    if (!contextAvailable) {
        console.log('🚨 ISSUE: Extension context not available');
        console.log('💡 SOLUTION: Extension needs to be reloaded/reinstalled');
        console.log('📋 STEPS:');
        console.log('   1. Go to chrome://extensions/');
        console.log('   2. Find Automail extension');
        console.log('   3. Click "Remove" to uninstall completely');
        console.log('   4. Close ALL Gmail tabs');
        console.log('   5. Click "Load unpacked" and select extension folder');
        console.log('   6. Open Gmail in NEW tab');
        console.log('   7. Check if sidebar appears');
    } else if (!injectionStatus.scriptsInjected || !injectionStatus.sidebarExists) {
        console.log('🚨 ISSUE: Content script not injected properly');
        console.log('💡 SOLUTION: Attempting manual injection...');
        forceContentScriptReload();
    } else if (!communicationWorking) {
        console.log('🚨 ISSUE: Extension communication broken');
        console.log('💡 SOLUTION: Background script may need restart');
    } else {
        console.log('✅ All systems appear to be working!');
    }
    
    console.log('================================================');
}

// Auto-run diagnostic
runComprehensiveDiagnostic();

// Expose functions for manual use
window.automailDebug = {
    clearStorage: clearExtensionStorage,
    checkContext: checkExtensionContext,
    checkInjection: checkContentScriptInjection,
    testCommunication: testExtensionCommunication,
    forceReload: forceContentScriptReload,
    runDiagnostic: runComprehensiveDiagnostic
};

console.log('🔧 Debug functions available at window.automailDebug');
console.log('💡 You can run individual checks like: automailDebug.checkContext()'); 