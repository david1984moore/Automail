/**
 * CHROME EXTENSION CONTEXT DEBUG SCRIPT
 * Run this in Gmail console to debug extension context issues
 * 
 * This script will help identify why chrome.runtime is undefined
 * even though the sidebar is being injected
 */

console.log('🔧 CHROME EXTENSION CONTEXT DEBUG STARTING...');
console.log('================================================');

// Step 1: Check basic environment
function checkEnvironment() {
    console.log('🌐 ENVIRONMENT CHECK:');
    console.log('Current URL:', window.location.href);
    console.log('User Agent:', navigator.userAgent);
    console.log('Document ready state:', document.readyState);
    console.log('Page loaded:', document.readyState === 'complete');
    console.log('');
}

// Step 2: Detailed Chrome API analysis
function analyzeChrome() {
    console.log('🔍 CHROME API ANALYSIS:');
    console.log('typeof chrome:', typeof chrome);
    console.log('chrome object exists:', typeof chrome !== 'undefined');
    
    if (typeof chrome !== 'undefined') {
        console.log('chrome keys:', Object.keys(chrome));
        
        // Check each Chrome API
        const apis = ['runtime', 'storage', 'identity', 'tabs', 'scripting'];
        apis.forEach(api => {
            console.log(`chrome.${api}:`, typeof chrome[api]);
            if (chrome[api]) {
                console.log(`  chrome.${api} keys:`, Object.keys(chrome[api]));
            }
        });
    } else {
        console.log('❌ Chrome object is completely undefined');
        console.log('💡 This means we are NOT in an extension context');
    }
    console.log('');
}

// Step 3: Check for extension elements in DOM
function checkExtensionElements() {
    console.log('🔍 EXTENSION ELEMENTS IN DOM:');
    
    // Look for any chrome-extension:// URLs
    const allElements = document.querySelectorAll('*');
    const extensionElements = [];
    
    allElements.forEach(el => {
        // Check src attributes
        if (el.src && el.src.includes('chrome-extension://')) {
            extensionElements.push({
                tag: el.tagName,
                src: el.src,
                id: el.id,
                className: el.className
            });
        }
        
        // Check href attributes
        if (el.href && el.href.includes('chrome-extension://')) {
            extensionElements.push({
                tag: el.tagName,
                href: el.href,
                id: el.id,
                className: el.className
            });
        }
    });
    
    console.log('Extension elements found:', extensionElements.length);
    extensionElements.forEach((el, index) => {
        console.log(`Element ${index + 1}:`, el);
    });
    
    // Check for Automail-specific elements
    const automailElements = document.querySelectorAll('[id*="automail"], [class*="automail"]');
    console.log('Automail elements found:', automailElements.length);
    automailElements.forEach((el, index) => {
        console.log(`Automail element ${index + 1}:`, {
            tag: el.tagName,
            id: el.id,
            className: el.className,
            visible: el.offsetWidth > 0 && el.offsetHeight > 0
        });
    });
    console.log('');
}

// Step 4: Check script injection
function checkScriptInjection() {
    console.log('🔍 SCRIPT INJECTION ANALYSIS:');
    
    const scripts = document.querySelectorAll('script');
    console.log('Total scripts on page:', scripts.length);
    
    const extensionScripts = [];
    scripts.forEach(script => {
        if (script.src && script.src.includes('chrome-extension://')) {
            extensionScripts.push({
                src: script.src,
                loaded: script.readyState || 'unknown',
                error: script.onerror ? 'has error handler' : 'no error handler'
            });
        }
    });
    
    console.log('Extension scripts found:', extensionScripts.length);
    extensionScripts.forEach((script, index) => {
        console.log(`Extension script ${index + 1}:`, script);
    });
    
    // Check for content script indicators
    const contentScriptIndicators = [
        'automail',
        'content.js',
        'sidebar'
    ];
    
    let contentScriptFound = false;
    scripts.forEach(script => {
        const scriptText = script.textContent || script.innerText || '';
        contentScriptIndicators.forEach(indicator => {
            if (scriptText.toLowerCase().includes(indicator.toLowerCase())) {
                console.log(`Content script indicator "${indicator}" found in script`);
                contentScriptFound = true;
            }
        });
    });
    
    console.log('Content script indicators found:', contentScriptFound);
    console.log('');
}

// Step 5: Check for extension errors
function checkExtensionErrors() {
    console.log('🔍 EXTENSION ERROR ANALYSIS:');
    
    // Check console for extension-related errors
    const originalError = console.error;
    const originalWarn = console.warn;
    
    let extensionErrors = [];
    let extensionWarnings = [];
    
    // Override console methods to capture extension errors
    console.error = function(...args) {
        const message = args.join(' ');
        if (message.includes('extension') || message.includes('chrome-extension') || message.includes('automail')) {
            extensionErrors.push(message);
        }
        originalError.apply(console, args);
    };
    
    console.warn = function(...args) {
        const message = args.join(' ');
        if (message.includes('extension') || message.includes('chrome-extension') || message.includes('automail')) {
            extensionWarnings.push(message);
        }
        originalWarn.apply(console, args);
    };
    
    // Restore original console methods after a short delay
    setTimeout(() => {
        console.error = originalError;
        console.warn = originalWarn;
        
        console.log('Extension errors captured:', extensionErrors.length);
        extensionErrors.forEach((error, index) => {
            console.log(`Error ${index + 1}:`, error);
        });
        
        console.log('Extension warnings captured:', extensionWarnings.length);
        extensionWarnings.forEach((warning, index) => {
            console.log(`Warning ${index + 1}:`, warning);
        });
    }, 1000);
    
    console.log('');
}

// Step 6: Test manual extension context creation
function testManualExtensionContext() {
    console.log('🔧 MANUAL EXTENSION CONTEXT TEST:');
    
    // Try to detect extension ID from DOM elements
    const extensionElements = document.querySelectorAll('[src*="chrome-extension://"], [href*="chrome-extension://"]');
    let detectedExtensionId = null;
    
    if (extensionElements.length > 0) {
        const firstElement = extensionElements[0];
        const url = firstElement.src || firstElement.href;
        const match = url.match(/chrome-extension:\/\/([a-z]+)/);
        if (match) {
            detectedExtensionId = match[1];
            console.log('Detected extension ID:', detectedExtensionId);
        }
    }
    
    if (detectedExtensionId) {
        // Try to access extension resources
        const testUrl = `chrome-extension://${detectedExtensionId}/manifest.json`;
        console.log('Testing extension resource access:', testUrl);
        
        fetch(testUrl)
            .then(response => {
                if (response.ok) {
                    console.log('✅ Extension resources accessible');
                    return response.json();
                } else {
                    console.log('❌ Extension resources not accessible:', response.status);
                }
            })
            .then(manifest => {
                if (manifest) {
                    console.log('✅ Manifest accessible:', manifest.name);
                }
            })
            .catch(error => {
                console.log('❌ Error accessing extension resources:', error.message);
            });
    } else {
        console.log('❌ Could not detect extension ID from DOM');
    }
    
    console.log('');
}

// Step 7: Provide specific recommendations
function provideRecommendations() {
    console.log('💡 SPECIFIC RECOMMENDATIONS:');
    console.log('============================');
    
    const hasChrome = typeof chrome !== 'undefined';
    const hasRuntime = typeof chrome?.runtime !== 'undefined';
    const hasSidebar = document.getElementById('automail-sidebar') !== null;
    
    if (!hasChrome) {
        console.log('🚨 CRITICAL: Chrome object not available');
        console.log('📋 SOLUTION:');
        console.log('   1. Extension is not loaded or has critical errors');
        console.log('   2. Go to chrome://extensions/');
        console.log('   3. Look for red error messages on Automail extension');
        console.log('   4. Click "Errors" button if present to see details');
        console.log('   5. If errors found, fix them and reload extension');
        console.log('   6. If no errors, try complete reinstall');
        
    } else if (!hasRuntime) {
        console.log('🚨 ISSUE: Chrome object exists but runtime API missing');
        console.log('📋 SOLUTION:');
        console.log('   1. Extension context is partially loaded');
        console.log('   2. Background script may have errors');
        console.log('   3. Check chrome://extensions/ for background script errors');
        console.log('   4. Try reloading the extension');
        
    } else if (hasSidebar && hasRuntime) {
        console.log('✅ Extension appears to be working correctly');
        console.log('💡 If you still have issues, try:');
        console.log('   1. Refresh the Gmail page');
        console.log('   2. Check for JavaScript errors in console');
        
    } else {
        console.log('🤔 Unusual state detected');
        console.log('💡 Try complete extension reinstall');
    }
    
    console.log('');
    console.log('🔧 IMMEDIATE NEXT STEPS:');
    console.log('1. Open chrome://extensions/ in new tab');
    console.log('2. Find Automail extension');
    console.log('3. Look for any red error messages or warnings');
    console.log('4. Click "Errors" button if present');
    console.log('5. Report any errors found');
}

// Run all diagnostic steps
function runCompleteDebug() {
    console.log('🚀 RUNNING COMPLETE CHROME EXTENSION DEBUG');
    console.log('==========================================');
    
    checkEnvironment();
    analyzeChrome();
    checkExtensionElements();
    checkScriptInjection();
    checkExtensionErrors();
    testManualExtensionContext();
    provideRecommendations();
    
    console.log('==========================================');
    console.log('🏁 DEBUG COMPLETE');
}

// Auto-run the debug
runCompleteDebug();

// Make functions available for manual use
window.chromeExtensionDebug = {
    checkEnvironment,
    analyzeChrome,
    checkExtensionElements,
    checkScriptInjection,
    checkExtensionErrors,
    testManualExtensionContext,
    provideRecommendations,
    runCompleteDebug
};

console.log('🔧 Debug functions available at window.chromeExtensionDebug'); 