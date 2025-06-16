/**
 * Automail Content Script
 * Injects and manages the Automail sidebar within Gmail interface
 * Handles communication between sidebar and background script
 */

// Debug logging
console.log('🚀 Automail Content Script: Loading...');

// Error handling wrapper
try {

// Sidebar state management with security tracking
let sidebarState = {
    isVisible: true,
    isAuthenticated: false,
    isProcessing: false,
    currentTab: 'recent',
    emailData: [],
    userSettings: {},
    sessionId: null,
    lastActivity: null
};

// Security: Session invalidation on navigation
let isPageUnloading = false;

// Enhanced security: Detect when user leaves page/closes tab and force logout
window.addEventListener('beforeunload', async (event) => {
    console.log('🔐 Page unloading detected - enforcing security logout');
    isPageUnloading = true;
    
    try {
        // Immediately mark session as invalidated for maximum security
        await chrome.storage.local.set({
            isAuthenticated: false,        // Immediately set to false
            sessionInvalidated: true,
            lastActivity: Date.now(),
            navigationLogout: true,
            requiresFreshAuth: true,       // Force fresh OAuth next time
            logoutReason: 'navigation_unload'
        });
        
        // Send message to background to completely clear all auth data
        chrome.runtime.sendMessage({ 
            action: 'logout',  // Use full logout instead of just invalidateSession
            reason: 'navigation_unload'
        });
        
        console.log('✅ Security logout enforced on navigation');
    } catch (error) {
        console.log('Error during navigation security cleanup:', error);
    }
});

// Enhanced navigation detection for Gmail SPA and domain changes
let lastUrl = location.href;
const urlObserver = new MutationObserver(() => {
    const currentUrl = location.href;
    if (currentUrl !== lastUrl) {
        console.log('🔐 Navigation change detected - enforcing security checks');
        console.log('Previous URL:', lastUrl);
        console.log('Current URL:', currentUrl);
        lastUrl = currentUrl;
        
        // If navigating away from Gmail domain or to login page, force logout
        if (!currentUrl.includes('mail.google.com') || 
            currentUrl.includes('accounts.google.com') ||
            currentUrl.includes('signin') ||
            currentUrl.includes('login')) {
            
            console.log('🔐 Domain/auth change detected - forcing security logout');
            
            // Immediately clear authentication
            chrome.storage.local.set({
                isAuthenticated: false,
                sessionInvalidated: true,
                navigationLogout: true,
                requiresFreshAuth: true,
                logoutReason: 'domain_navigation'
            });
            
            // Force complete logout
            chrome.runtime.sendMessage({ 
                action: 'logout',
                reason: 'domain_navigation'
            });
        }
    }
});

urlObserver.observe(document, { subtree: true, childList: true });

// DOM Elements cache
let sidebarElements = {};

/**
 * Initialize the Automail sidebar when Gmail loads
 */
function initializeAutomail() {
    console.log('🚀 Automail: Starting initialization...');
    
    try {
        // Check if sidebar already exists
        if (document.getElementById('automail-sidebar')) {
            console.log('⚠️ Automail: Sidebar already exists, skipping initialization');
            return;
        }
        
        console.log('📍 Current URL:', window.location.href);
        console.log('📍 Document ready state:', document.readyState);
        
        // Wait for Gmail to fully load
        waitForGmailLoad().then(() => {
            console.log('✅ Gmail loaded, creating sidebar...');
            
            // Create the sidebar
            const sidebar = createSidebar();
            
            // Cache elements
            cacheSidebarElements();
            
            // Set up event listeners
            setupEventListeners();
            
            // Load stored data and update UI
            loadStoredData();
            
            // Basic message listener for extension icon clicks
            chrome.runtime.onMessage.addListener(handleMessage);
            console.log('✅ Message listener registered');
            
            console.log('🎉 Automail initialization completed successfully!');
            
        }).catch(error => {
            console.error('❌ Failed to wait for Gmail load:', error);
        });
        
    } catch (error) {
        console.error('❌ Automail initialization error:', error);
        console.error('Error stack:', error.stack);
    }
}

/**
 * Wait for Gmail interface to be fully loaded
 */
function waitForGmailLoad() {
    return new Promise((resolve) => {
        const checkGmailLoaded = () => {
            // Check for Gmail's main container
            const gmailContainer = document.querySelector('[role="main"]') || 
                                 document.querySelector('.nH') || 
                                 document.querySelector('body');
            
            if (gmailContainer && document.readyState === 'complete') {
                resolve();
            } else {
                setTimeout(checkGmailLoaded, 500);
            }
        };
        checkGmailLoaded();
    });
}

/**
 * Create and inject the Automail sidebar into Gmail
 */
function createSidebar() {
    console.log('🔧 Creating sidebar...');
    
    try {
        // Create sidebar container
        const sidebar = document.createElement('div');
        sidebar.id = 'automail-sidebar';
        sidebar.className = 'automail-sidebar';
        console.log('✅ Sidebar element created');
        
        // Create full sidebar content
        sidebar.innerHTML = `
            <div class="automail-app">
                <!-- Header -->
                <header class="automail-header">
                    <h1 class="automail-title">Automail</h1>
                    <div class="automail-header-controls">
                        <button id="automail-collapse" class="automail-btn automail-btn-icon" title="Collapse Sidebar">
                            ◀
                        </button>
                        <button id="automail-close" class="automail-btn automail-btn-icon" title="Close Sidebar">
                            ✕
                        </button>
                    </div>
                </header>

                <!-- Authentication Section -->
                <div id="automail-auth-section" class="automail-auth-section">
                    <div id="automail-login-container" class="automail-login-container">
                        <p class="automail-auth-message">Connect your Gmail account to get started</p>
                        <button id="automail-login-btn" class="automail-btn automail-btn-primary">
                            <span class="automail-google-icon">🔐</span>
                            Login with Google
                        </button>
                    </div>
                    
                    <div id="automail-logout-container" class="automail-logout-container" style="display: none;">
                        <p class="automail-auth-status">✅ Connected to Gmail</p>
                        <div class="automail-quick-actions">
                            <button id="automail-start-processing" class="automail-btn automail-btn-success">
                                <span class="automail-play-icon">▶️</span>
                                Start Processing
                            </button>
                            <button id="automail-stop-processing" class="automail-btn automail-btn-danger" style="display: none;">
                                <span class="automail-stop-icon">⏹️</span>
                                Stop Processing
                            </button>
                            <button id="automail-logout-btn" class="automail-btn automail-btn-secondary">
                                <span class="automail-logout-icon">🚪</span>
                                Logout
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Main Content -->
                <div id="automail-main-content" class="automail-main-content" style="display: none;">
                    <!-- Tab Navigation -->
                    <nav class="automail-tab-nav">
                        <button class="automail-tab-btn active" data-tab="recent">Recent</button>
                        <button class="automail-tab-btn" data-tab="smart-reply">Reply</button>
                        <button class="automail-tab-btn" data-tab="ai-suggestions">AI</button>
                        <button class="automail-tab-btn" data-tab="important">Important</button>
                        <button class="automail-tab-btn" data-tab="review">Review</button>
                    </nav>

                    <!-- Tab Content -->
                    <div class="automail-tab-content">
                        <!-- Recent Activity Tab -->
                        <div id="automail-recent-tab" class="automail-tab-panel active">
                            <div class="automail-panel-header">
                                <h3>Recent Activity</h3>
                                <span id="automail-processed-count" class="automail-processed-count">0 emails</span>
                            </div>
                            <div id="automail-recent-emails" class="automail-email-list">
                                <div class="automail-empty-state">
                                    <p>No emails processed yet</p>
                                    <p class="automail-empty-subtitle">Click "Start Processing" to begin</p>
                                </div>
                            </div>
                        </div>

                        <!-- Smart Reply Tab -->
                        <div id="automail-smart-reply-tab" class="automail-tab-panel">
                            <div class="automail-panel-header">
                                <h3>Smart Reply</h3>
                            </div>
                            <div class="automail-settings-section">
                                <div class="automail-setting-item">
                                    <label class="automail-toggle-label">
                                        <input type="checkbox" id="automail-auto-reply-toggle">
                                        <span class="automail-toggle-slider"></span>
                                        Auto Reply
                                    </label>
                                </div>
                                <div class="automail-setting-item">
                                    <label for="automail-response-style">Response Style:</label>
                                    <select id="automail-response-style" class="automail-dropdown">
                                        <option value="professional">Professional</option>
                                        <option value="friendly">Friendly</option>
                                        <option value="brief">Brief</option>
                                        <option value="detailed">Detailed</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <!-- AI Suggestions Tab -->
                        <div id="automail-ai-suggestions-tab" class="automail-tab-panel">
                            <div class="automail-panel-header">
                                <h3>AI Suggestions</h3>
                            </div>
                            <div class="automail-settings-section">
                                <div class="automail-setting-item">
                                    <label class="automail-toggle-label">
                                        <input type="checkbox" id="automail-learning-toggle" checked>
                                        <span class="automail-toggle-slider"></span>
                                        Learn from actions
                                    </label>
                                </div>
                            </div>
                            <div id="automail-suggestions" class="automail-suggestions-list">
                                <div class="automail-empty-state">
                                    <p>No suggestions yet</p>
                                </div>
                            </div>
                        </div>

                        <!-- Important Tab -->
                        <div id="automail-important-tab" class="automail-tab-panel">
                            <div class="automail-panel-header">
                                <h3>Important Emails</h3>
                            </div>
                            <div id="automail-important-emails" class="automail-email-list">
                                <div class="automail-empty-state">
                                    <p>No important emails</p>
                                </div>
                            </div>
                        </div>

                        <!-- Review Tab -->
                        <div id="automail-review-tab" class="automail-tab-panel">
                            <div class="automail-panel-header">
                                <h3>Review Required</h3>
                                <span id="automail-review-count" class="automail-processed-count">0 emails</span>
                            </div>
                            <div id="automail-review-emails" class="automail-email-list">
                                <div class="automail-empty-state">
                                    <p>No emails need review</p>
                                    <p class="automail-empty-subtitle">Emails requiring manual review will appear here</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Status Bar -->
                <footer class="automail-status-bar">
                    <span id="automail-status-text">Ready</span>
                </footer>
            </div>

            <!-- Loading Overlay -->
            <div id="automail-loading-overlay" class="automail-loading-overlay" style="display: none;">
                <div class="automail-loading-spinner"></div>
                <p class="automail-loading-text">Processing...</p>
            </div>
        `;
        console.log('✅ Sidebar HTML set');
        
        // Create expand button (shown when sidebar is collapsed)
        const expandButton = document.createElement('button');
        expandButton.id = 'automail-expand';
        expandButton.className = 'automail-expand-btn hidden';
        expandButton.innerHTML = '▶';
        expandButton.title = 'Expand Automail Sidebar';
        
        // Insert sidebar and expand button into Gmail interface
        document.body.appendChild(sidebar);
        document.body.appendChild(expandButton);
        console.log('✅ Sidebar appended to body');
        
        console.log('🎉 Sidebar creation completed successfully!');
        return sidebar;
        
    } catch (error) {
        console.error('❌ Error creating sidebar:', error);
        throw error;
    }
}

/**
 * Cache sidebar DOM elements for efficient access
 */
function cacheSidebarElements() {
    console.log('🔧 Caching sidebar elements...');
    
    try {
        sidebarElements = {
            sidebar: document.getElementById('automail-sidebar'),
            collapseBtn: document.getElementById('automail-collapse'),
            closeBtn: document.getElementById('automail-close'),
            expandBtn: document.getElementById('automail-expand'),
            loginBtn: document.getElementById('automail-login-btn'),
            logoutBtn: document.getElementById('automail-logout-btn'),
            loginContainer: document.getElementById('automail-login-container'),
            logoutContainer: document.getElementById('automail-logout-container'),
            mainContent: document.getElementById('automail-main-content'),
            startProcessingBtn: document.getElementById('automail-start-processing'),
            stopProcessingBtn: document.getElementById('automail-stop-processing'),
            statusText: document.getElementById('automail-status-text'),
            processedCount: document.getElementById('automail-processed-count'),
            tabBtns: document.querySelectorAll('.automail-tab-btn'),
            tabPanels: document.querySelectorAll('.automail-tab-panel'),
            loadingOverlay: document.getElementById('automail-loading-overlay')
        };
        
        console.log('✅ Sidebar elements cached:', {
            sidebarExists: !!sidebarElements.sidebar,
            loginBtnExists: !!sidebarElements.loginBtn,
            tabBtnsCount: sidebarElements.tabBtns.length
        });
    } catch (error) {
        console.error('❌ Error caching sidebar elements:', error);
    }
}

/**
 * Set up event listeners for sidebar interactions
 */
function setupEventListeners() {
    console.log('🔧 Setting up event listeners...');
    
    try {
        // Sidebar controls
        sidebarElements.collapseBtn?.addEventListener('click', () => toggleSidebar(false));
        sidebarElements.closeBtn?.addEventListener('click', closeSidebar);
        sidebarElements.expandBtn?.addEventListener('click', () => toggleSidebar(true));
        
        // Authentication
        sidebarElements.loginBtn?.addEventListener('click', handleLogin);
        sidebarElements.logoutBtn?.addEventListener('click', handleLogout);
        
        // Processing controls
        sidebarElements.startProcessingBtn?.addEventListener('click', handleStartProcessing);
        sidebarElements.stopProcessingBtn?.addEventListener('click', handleStopProcessing);
        
        // Tab navigation
        sidebarElements.tabBtns?.forEach(btn => {
            btn.addEventListener('click', (e) => {
                switchTab(e.target.dataset.tab);
            });
        });
        
        // Listen for messages from background (e.g., for status updates)
        chrome.runtime.onMessage.addListener(handleMessage);
        
        console.log('✅ Event listeners set up successfully');
    } catch (error) {
        console.error('❌ Error setting up event listeners:', error);
    }
}

/**
 * Handle messages from the background script or extension popup
 * @param {object} request The message request object
 * @param {object} sender The sender object
 * @param {function} sendResponse The callback function
 */
function handleMessage(request, sender, sendResponse) {
    if (request.action === 'toggleSidebar') {
        toggleSidebar();
        sendResponse({ success: true });
    } else if (request.action === 'updateStatus') {
        updateStatus(request.message, request.type);
        sendResponse({ success: true });
    }
}

/**
 * Toggle sidebar visibility
 */
function toggleSidebar(forceState = null) {
    console.log('🔄 toggleSidebar called');
    console.log('📍 sidebarElements.sidebar exists:', !!sidebarElements.sidebar);
    console.log('📍 current sidebarState.isVisible:', sidebarState.isVisible);
    
    if (!sidebarElements.sidebar) {
        console.error('❌ Sidebar element not found! Attempting to recreate...');
        try {
            createSidebar();
            cacheSidebarElements();
            setupEventListeners();
        } catch (error) {
            console.error('❌ Failed to recreate sidebar:', error);
            return;
        }
    }
    
    const shouldShow = forceState !== null ? forceState : !sidebarState.isVisible;
    console.log('📍 shouldShow:', shouldShow);
    
    if (shouldShow) {
        // Show sidebar, hide expand button
        sidebarElements.sidebar.classList.remove('hidden');
        sidebarElements.expandBtn?.classList.add('hidden');
        sidebarState.isVisible = true;
        console.log('✅ Sidebar shown');
    } else {
        // Hide sidebar, show expand button (collapse mode)
        sidebarElements.sidebar.classList.add('hidden');
        sidebarElements.expandBtn?.classList.remove('hidden');
        sidebarState.isVisible = false;
        console.log('✅ Sidebar collapsed');
    }
}

/**
 * Close sidebar completely (no expand button)
 */
function closeSidebar() {
    console.log('🔄 closeSidebar called');
    
    if (!sidebarElements.sidebar) {
        console.error('❌ Sidebar elements not found!');
        return;
    }
    
    // Hide both sidebar and expand button
    sidebarElements.sidebar.classList.add('hidden');
    sidebarElements.expandBtn?.classList.add('hidden');
    sidebarState.isVisible = false;
    
    console.log('✅ Sidebar closed completely');
}

/**
 * Load stored data from Chrome storage with enhanced security validation
 * Always requires fresh authentication for maximum security
 */
async function loadStoredData() {
    try {
        const data = await chrome.storage.local.get([
            'isAuthenticated',
            'authToken', 
            'isProcessing', 
            'emailData', 
            'userSettings',
            'sessionInvalidated',
            'navigationLogout',
            'lastLogoutTime',
            'loginTime',
            'requiresFreshAuth',
            'forceOAuthPopup'
        ]);
        
        console.log('🔒 Loading stored data - FORCING fresh OAuth popup...');
        
        // SECURITY: NEVER trust any stored authentication state
        // ALWAYS require fresh OAuth popup for maximum security
        console.log('🔐 FORCING logout state - OAuth popup will be required');
        sidebarState.isAuthenticated = false;
        
        // ALWAYS clear ANY stored authentication data
        console.log('🧹 Clearing ALL stored authentication data');
        await chrome.storage.local.set({
            isAuthenticated: false,
            authToken: null,
            requiresFreshAuth: true,
            sessionInvalidated: true,
            forceOAuthPopup: true,
            logoutReason: 'maximum_security_clearance'
        });
        
        // Load non-security related data
        sidebarState.isProcessing = data.isProcessing || false;
        sidebarState.emailData = data.emailData || [];
        sidebarState.userSettings = data.userSettings || {};
        
        // Update UI to reflect FORCED logout state
        updateSidebarUI();
        updateStatus('🔐 Please login with Google to access Gmail automation', 'info');
        
        console.log('✅ Data loaded - OAuth popup WILL be forced on login');
        
    } catch (error) {
        console.error('Automail: Error loading stored data:', error);
        updateStatus('Error loading data - please login with Google', 'error');
        
        // On error, ensure user is logged out
        sidebarState.isAuthenticated = false;
        updateSidebarUI();
    }
}

/**
 * Enhanced session validation with strict security requirements
 * Always requires fresh OAuth for maximum security
 */
function validateSession(data) {
    console.log('🔒 Running enhanced session validation...');
    
    // SECURITY: Always require fresh authentication - no session persistence
    if (data.requiresFreshAuth !== false) {
        console.log('🔐 Fresh authentication required by security policy');
        return false;
    }
    
    // If not authenticated, session is invalid
    if (!data.isAuthenticated) {
        console.log('🔐 User not authenticated');
        return false;
    }
    
    // If session was explicitly invalidated, session is invalid
    if (data.sessionInvalidated) {
        console.log('🔐 Session was explicitly invalidated');
        return false;
    }
    
    // If navigation logout occurred, session is invalid
    if (data.navigationLogout) {
        console.log('🔐 Session invalidated by navigation logout');
        return false;
    }
    
    // If logout happened after login, session is invalid
    if (data.lastLogoutTime && data.loginTime && data.lastLogoutTime > data.loginTime) {
        console.log('🔐 Session invalidated by logout timestamp');
        return false;
    }
    
    // Additional security: Check if token exists
    if (!data.authToken || typeof data.authToken !== 'string') {
        console.log('🔐 No valid auth token found');
        return false;
    }
    
    // Additional security: Check session age (optional - force re-auth after time)
    const MAX_SESSION_TIME = 30 * 60 * 1000; // 30 minutes
    if (data.loginTime && (Date.now() - data.loginTime) > MAX_SESSION_TIME) {
        console.log('🔐 Session expired due to time limit');
        return false;
    }
    
    console.log('✅ Session validation passed (rare case)');
    return true;
}

/**
 * Update sidebar UI based on current state
 */
function updateSidebarUI() {
    if (!sidebarElements.sidebar) return;
    
    // Update authentication UI
    if (sidebarState.isAuthenticated) {
        sidebarElements.loginContainer.style.display = 'none';
        sidebarElements.logoutContainer.style.display = 'block';
        sidebarElements.mainContent.style.display = 'block';
    } else {
        sidebarElements.loginContainer.style.display = 'block';
        sidebarElements.logoutContainer.style.display = 'none';
        sidebarElements.mainContent.style.display = 'none';
        // Clear any test/cached email displays when not authenticated
        clearAllEmailDisplays();
    }
    
    // Update processing controls
    if (sidebarState.isProcessing) {
        sidebarElements.startProcessingBtn.style.display = 'none';
        sidebarElements.stopProcessingBtn.style.display = 'inline-block';
        sidebarElements.stopProcessingBtn.textContent = '⏹️ Stop Processing';
    } else {
        sidebarElements.startProcessingBtn.style.display = 'inline-block';
        sidebarElements.stopProcessingBtn.style.display = 'none';
    }
    
    // Update email count
    if (sidebarElements.processedCount) {
        sidebarElements.processedCount.textContent = `${sidebarState.emailData.length} emails`;
    }
}

/**
 * Handle authentication functions with enhanced security
 */
async function handleLogin() {
    try {
        showLoading('🚀 Opening MANDATORY Google OAuth popup...');
        updateStatus('🚀 Preparing MANDATORY Google authentication...', 'info');
        
        console.log('🚀 Automail: FORCING mandatory Google OAuth popup...');
        
        // Clear any potential UI state that might suggest authentication
        sidebarState.isAuthenticated = false;
        updateSidebarUI();
        
        // Update status to inform user about mandatory popup
        updateStatus('⚡ MANDATORY Google OAuth popup will appear - this is required regardless of your login status', 'info');
        
        // First, run OAuth debug to get detailed information
        console.log('🔧 Running OAuth debug check...');
        const debugResponse = await chrome.runtime.sendMessage({ action: 'debugOAuth' });
        console.log('Debug info:', debugResponse);
        
        // Wait a moment to let user see the status message
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        updateStatus('🔑 Launching MANDATORY OAuth popup - this will show even if you\'re logged in...', 'info');
        
        const response = await chrome.runtime.sendMessage({ action: 'login' });
        
        if (response.success) {
            sidebarState.isAuthenticated = true;
            updateStatus('✅ Successfully authenticated with Google OAuth!', 'success');
            updateSidebarUI();
            console.log('✅ Google OAuth popup completed successfully');
        } else {
            console.error('❌ Google OAuth login failed with response:', response);
            throw new Error(response.error || 'Google OAuth authentication failed');
        }
    } catch (error) {
        console.error('Automail: Google OAuth login error:', error);
        console.error('Full error object:', error);
        
        let errorMessage = 'Google OAuth authentication failed';
        if (error.message.includes('User did not approve')) {
            errorMessage = '❌ OAuth cancelled - please try login again';
        } else if (error.message.includes('popup')) {
            errorMessage = '❌ OAuth popup blocked - please enable popups and try again';
        } else {
            errorMessage = `❌ OAuth error: ${error.message}`;
        }
        
        updateStatus(errorMessage, 'error');
        
        // Ensure we stay logged out on error
        sidebarState.isAuthenticated = false;
        updateSidebarUI();
    } finally {
        hideLoading();
    }
}

async function handleLogout() {
    try {
        showLoading('Disconnecting...');
        
        const response = await chrome.runtime.sendMessage({ action: 'logout' });
        
        if (response.success) {
            sidebarState.isAuthenticated = false;
            sidebarState.isProcessing = false;
            sidebarState.emailData = [];
            updateStatus('Disconnected', 'info');
            updateSidebarUI();
        } else {
            throw new Error(response.error || 'Logout failed');
        }
    } catch (error) {
        console.error('Automail: Logout error:', error);
        updateStatus(`Logout failed: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
}

async function handleStartProcessing() {
    try {
        showLoading('Starting email processing...');
        updateStatus('Connecting to Gmail and starting initial email sync...', 'info');
        
        const response = await chrome.runtime.sendMessage({ action: 'startProcessing' });
        
        if (response.success) {
            sidebarState.isProcessing = true;
            updateStatus('✅ Email processing started! Syncing existing emails...', 'success');
            updateSidebarUI();
            
            // Start periodic UI updates to show email processing progress
            startEmailProgressUpdates();
        } else {
            throw new Error(response.error || 'Failed to start processing');
        }
    } catch (error) {
        console.error('Automail: Start processing error:', error);
        updateStatus(`Failed to start: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
}

/**
 * Start periodic updates to show email processing progress
 */
function startEmailProgressUpdates() {
    // Clear any existing interval
    if (window.automailProgressInterval) {
        clearInterval(window.automailProgressInterval);
    }
    
    // Update UI every 2 seconds while processing
    window.automailProgressInterval = setInterval(async () => {
        try {
            const data = await chrome.storage.local.get([
                'isProcessing', 
                'emailData', 
                'emailCount', 
                'processingMode',
                'hasMoreEmails',
                'totalEmailsInAccount'
            ]);

            if (!data.isProcessing) {
                sidebarState.isProcessing = false;
                updateSidebarUI();
                updateStatus('Processing stopped.', 'info');
                clearInterval(window.automailProgressInterval);
                return;
            }
            
            sidebarState.isProcessing = true;
            if (data.emailData) {
                sidebarState.emailData = data.emailData;
            }
            
            // Update UI with new status
            updateSidebarUI();
            updateEmailDisplay();
            
            // Show new dynamic progress status
            const count = data.emailCount || 0;
            if (data.processingMode === 'monitoring') {
                updateStatus(`✅ All ${count} emails processed. Monitoring for new emails...`, 'success');
            } else if (data.hasMoreEmails) {
                const total = data.totalEmailsInAccount || 'many';
                updateStatus(`⚙️ Processing batch... ${count} of ~${total} emails synced.`, 'info');
            } else {
                updateStatus(`⚙️ Processing active: ${count} emails processed.`, 'info');
            }

        } catch (error) {
            console.error('Error updating email progress:', error);
        }
    }, 2500);
}

/**
 * Update email display across all tabs
 */
function updateEmailDisplay() {
    // Only show emails if user is authenticated
    if (!sidebarState.isAuthenticated) {
        clearAllEmailDisplays();
        return;
    }
    
    if (!sidebarState.emailData.length) {
        return;
    }
    
    // Update Recent Activity tab
    updateTabEmailDisplay('recent', sidebarState.emailData);
    
    // Update Important tab with emails labeled "Automail-Important" or AI classified as "Important"
    const importantEmails = sidebarState.emailData.filter(email => 
        email.aiLabel === 'Important' || 
        (email.gmailLabels && email.gmailLabels.includes('Automail-Important'))
    );
    updateTabEmailDisplay('important', importantEmails);
    
    // Update AI tab with classified emails
    const aiClassifiedEmails = sidebarState.emailData.filter(email => email.aiLabel);
    updateTabEmailDisplay('ai-suggestions', aiClassifiedEmails);
    
    // Update Review tab with emails labeled "Automail-Review" or AI classified as "Review"
    const reviewEmails = sidebarState.emailData.filter(email => 
        email.aiLabel === 'Review' || 
        (email.gmailLabels && email.gmailLabels.includes('Automail-Review')) ||
        (email.labeledAt && email.aiLabel === 'Review')
    );
    updateTabEmailDisplay('review', reviewEmails);
    
    // Update review count
    const reviewCountElement = document.getElementById('automail-review-count');
    if (reviewCountElement) {
        reviewCountElement.textContent = `${reviewEmails.length} email${reviewEmails.length !== 1 ? 's' : ''}`;
    }
    
    // Update Reply tab (placeholder for future features)
    updateTabEmailDisplay('reply', []);
}

/**
 * Clear all email displays when not authenticated
 */
function clearAllEmailDisplays() {
    const tabs = ['recent', 'important', 'ai-suggestions', 'reply', 'review'];
    
    tabs.forEach(tabName => {
        const tabElement = document.getElementById(`automail-${tabName}-tab`);
        if (!tabElement) return;
        
        const emailList = tabElement.querySelector('.automail-email-list') || 
                         tabElement.querySelector('.automail-suggestions-list');
        
        if (emailList) {
            // Clear any test content and show proper empty state
            emailList.innerHTML = `
                <div class="automail-empty-state">
                    <p>Please login to access Gmail automation</p>
                    <p class="automail-empty-subtitle">Connect your account to get started</p>
                </div>
            `;
        }
    });
    
    // Clear processed count
    if (sidebarElements.processedCount) {
        sidebarElements.processedCount.textContent = '0 emails';
    }
    
    // Clear review count
    const reviewCountElement = document.getElementById('automail-review-count');
    if (reviewCountElement) {
        reviewCountElement.textContent = '0 emails';
    }
}

/**
 * Update email display in a specific tab
 */
function updateTabEmailDisplay(tabName, emails) {
    const tabElement = document.getElementById(`automail-${tabName}-tab`);
    if (!tabElement) {
        return;
    }
    
    // For AI suggestions tab, use suggestions container, otherwise use email list
    let emailList;
    if (tabName === 'ai-suggestions') {
        emailList = tabElement.querySelector('.automail-suggestions-list');
        if (!emailList) {
            emailList = document.createElement('div');
            emailList.className = 'automail-suggestions-list';
            tabElement.appendChild(emailList);
        }
    } else {
        emailList = tabElement.querySelector('.automail-email-list');
        if (!emailList) {
            emailList = document.createElement('div');
            emailList.className = 'automail-email-list';
            tabElement.appendChild(emailList);
        }
    }
    
    if (emails.length === 0) {
        emailList.innerHTML = `
            <div class="automail-empty-state">
                <p>No ${tabName === 'ai-suggestions' ? 'AI suggestions' : tabName + ' emails'} found</p>
                <p class="automail-empty-subtitle">${getEmptyStateMessage(tabName)}</p>
            </div>
        `;
        return;
    }
    
    // Show latest emails (sorted by processing time)
    const sortedEmails = emails
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, tabName === 'recent' ? 50 : 30);
    
    emailList.innerHTML = sortedEmails.map(email => `
        <div class="automail-email-item">
            <div class="automail-email-header">
                <span class="automail-email-sender">${escapeHtml(email.sender || 'Unknown')}</span>
                <span class="automail-email-time">${formatRelativeTime(email.timestamp)}</span>
            </div>
            <div class="automail-email-subject">${escapeHtml(email.subject || 'No Subject')}</div>
            <div class="automail-email-snippet">${escapeHtml((email.content || email.snippet || '').substring(0, 100))}${(email.content || email.snippet || '').length > 100 ? '...' : ''}</div>
            <div class="automail-email-status">
                <span class="automail-email-badge ${email.read ? 'read' : 'unread'}">${email.read ? 'Read' : 'Unread'}</span>
                ${email.important ? '<span class="automail-email-badge important">Important</span>' : ''}
                ${email.starred ? '<span class="automail-email-badge starred">★</span>' : ''}
                ${email.category ? `<span class="automail-email-badge category-${email.category.toLowerCase()}">${email.category}</span>` : ''}
                ${email.aiLabel ? `<span class="automail-email-badge ai-label ai-${email.aiLabel.toLowerCase()}" title="AI Classification (${Math.round((email.aiConfidence || 0) * 100)}% confidence)">${email.aiLabel}</span>` : ''}
            </div>
        </div>
    `).join('');
}

/**
 * Get empty state message for different tabs
 */
function getEmptyStateMessage(tabName) {
    const messages = {
        'recent': 'Emails will appear here as they are processed',
        'important': 'Important emails will appear here when found',
        'ai': 'AI-classified emails will appear here',
        'ai-suggestions': 'AI-classified emails will appear here',
        'reply': 'AI-suggested replies will appear here (coming soon)',
        'review': 'Emails requiring manual review will appear here'
    };
    return messages[tabName] || 'No emails found';
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Format timestamp to relative time
 */
function formatRelativeTime(timestamp) {
    if (!timestamp) return '';
    
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    
    return new Date(timestamp).toLocaleDateString();
}

async function handleStopProcessing() {
    try {
        const response = await chrome.runtime.sendMessage({ action: 'stopProcessing' });
        
        if (response.success) {
            sidebarState.isProcessing = false;
            updateStatus('Processing stopped', 'info');
            updateSidebarUI();
            
            // Clear progress update interval
            if (window.automailProgressInterval) {
                clearInterval(window.automailProgressInterval);
                window.automailProgressInterval = null;
            }
            
            // Clear status timeout
            if (window.automailStatusTimeout) {
                clearTimeout(window.automailStatusTimeout);
                window.automailStatusTimeout = null;
            }
        } else {
            throw new Error(response.error || 'Failed to stop processing');
        }
    } catch (error) {
        console.error('Automail: Stop processing error:', error);
        updateStatus(`Failed to stop: ${error.message}`, 'error');
    }
}

/**
 * Switch between tabs in sidebar
 */
function switchTab(tabName) {
    if (!sidebarElements.tabBtns) return;
    
    // Update active tab button
    sidebarElements.tabBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    
    // Update active tab panel
    sidebarElements.tabPanels.forEach(panel => {
        panel.classList.toggle('active', panel.id === `automail-${tabName}-tab`);
    });
    
    sidebarState.currentTab = tabName;
}

/**
 * UI helper functions
 */
function updateStatus(message, type = 'info') {
    if (sidebarElements.statusText) {
        sidebarElements.statusText.textContent = message;
        sidebarElements.statusText.className = `automail-status-${type}`;
        
        // Clear any existing status timeout
        if (window.automailStatusTimeout) {
            clearTimeout(window.automailStatusTimeout);
        }
        
        // Only reset to "Ready" for non-persistent status messages
        // Don't reset for 'success' type messages during processing
        if (type !== 'error' && type !== 'success') {
            window.automailStatusTimeout = setTimeout(() => {
                if (sidebarElements.statusText && !sidebarState.isProcessing) {
                    sidebarElements.statusText.textContent = 'Ready';
                    sidebarElements.statusText.className = '';
                }
            }, 3000);
        }
    }
}

function showLoading(message = 'Processing...') {
    if (sidebarElements.loadingOverlay) {
        sidebarElements.loadingOverlay.style.display = 'flex';
        const loadingText = sidebarElements.loadingOverlay.querySelector('.automail-loading-text');
        if (loadingText) loadingText.textContent = message;
    }
}

function hideLoading() {
    if (sidebarElements.loadingOverlay) {
        sidebarElements.loadingOverlay.style.display = 'none';
    }
}

/**
 * Test function to verify scrollbar behavior - generates dummy emails
 * Use in console: testScrollbar() 
 */
function testScrollbar() {
    console.log('🧪 Testing scrollbar with dummy emails...');
    
    // Generate 50 dummy emails to test scrolling
    const dummyEmails = Array.from({length: 50}, (_, i) => ({
        sender: `Test Sender ${i + 1}`,
        subject: `Test Email Subject ${i + 1} - This is a longer subject to test layout`,
        content: `This is the content of test email ${i + 1}. It contains some sample text to demonstrate the email preview functionality and ensure the scrollbar appears when there are many emails.`,
        timestamp: Date.now() - (i * 60000), // 1 minute apart
        read: Math.random() > 0.5,
        important: Math.random() > 0.8,
        starred: Math.random() > 0.9,
        category: ['Primary', 'Social', 'Promotions', 'Updates'][Math.floor(Math.random() * 4)],
        aiLabel: ['Work', 'Personal', 'Spam', 'Important'][Math.floor(Math.random() * 4)],
        aiConfidence: Math.random()
    }));
    
    console.log('📊 Generated emails:', dummyEmails.length);
    
    // Switch to recent tab first
    switchTab('recent');
    
    // Update the recent tab with dummy emails
    updateTabEmailDisplay('recent', dummyEmails);
    
    // Update processed count
    if (sidebarElements.processedCount) {
        sidebarElements.processedCount.textContent = `${dummyEmails.length} emails`;
    }
    
    // Debug: Check tab panel dimensions
    const tabPanel = document.querySelector('.automail-tab-panel.active');
    const emailList = document.querySelector('#automail-recent-emails');
    
    if (tabPanel && emailList) {
        const panelHeight = tabPanel.offsetHeight;
        const contentHeight = emailList.scrollHeight;
        console.log('📐 Panel height:', panelHeight, 'px');
        console.log('📏 Content height:', contentHeight, 'px');
        console.log('🎯 Should scroll:', contentHeight > panelHeight);
        console.log('💻 Panel overflow-y:', getComputedStyle(tabPanel).overflowY);
        
        // Only force styles if scrollbar should appear
        if (contentHeight > panelHeight) {
            console.log('✅ Content overflows - scrollbar should appear automatically');
        } else {
            console.log('⚠️ Content fits - no scrollbar needed');
        }
        
        console.log('✅ Scrollbar test completed - check Recent tab!');
    } else {
        console.warn('⚠️ Could not find tab panel or email list elements');
    }
    
    return dummyEmails;
}

/**
 * Enhanced test function that works regardless of login state
 */
function testScrollbarAdvanced() {
    console.log('🧪 Advanced scrollbar test (works with/without login)...');
    
    // Find the recent tab panel directly
    const recentTab = document.getElementById('automail-recent-tab');
    const emailList = document.getElementById('automail-recent-emails');
    
    if (!recentTab || !emailList) {
        console.log('❌ Required elements not found');
        return;
    }
    
    // Clear existing content safely
    while (emailList.firstChild) {
        emailList.removeChild(emailList.firstChild);
    }
    
    // Create 25 test emails (reasonable amount)
    for (let i = 0; i < 25; i++) {
        const emailItem = document.createElement('div');
        emailItem.className = 'automail-email-item';
        emailItem.style.cssText = 'margin-bottom: 12px; padding: 12px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #667eea; min-height: 60px;';
        
        const header = document.createElement('div');
        header.style.cssText = 'display: flex; justify-content: space-between; margin-bottom: 6px; font-weight: 600;';
        header.textContent = `Test Email ${i + 1}`;
        
        const content = document.createElement('div');
        content.style.cssText = 'font-size: 12px; color: #666; line-height: 1.4;';
        content.textContent = `This is test email content ${i + 1}. Adding enough text to make it realistic and demonstrate proper scrolling behavior in the Automail sidebar.`;
        
        emailItem.appendChild(header);
        emailItem.appendChild(content);
        emailList.appendChild(emailItem);
    }
    
    // Ensure recent tab is active
    document.querySelectorAll('.automail-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === 'recent');
    });
    
    document.querySelectorAll('.automail-tab-panel').forEach(panel => {
        panel.classList.toggle('active', panel.id === 'automail-recent-tab');
    });
    
    // Check results
    setTimeout(() => {
        const panelHeight = recentTab.offsetHeight;
        const contentHeight = emailList.scrollHeight;
        
        console.log('📊 Advanced Test Results:');
        console.log('📐 Panel height:', panelHeight, 'px');
        console.log('📏 Content height:', contentHeight, 'px');
        console.log('🎯 Should scroll:', contentHeight > panelHeight);
        console.log('💻 Panel overflow:', getComputedStyle(recentTab).overflowY);
        console.log('📧 Items created:', emailList.children.length);
        
        if (contentHeight > panelHeight && panelHeight > 100) {
            console.log('🎉 SUCCESS! Scrollbar should be visible and properly sized!');
        } else if (panelHeight <= 100) {
            console.log('⚠️ Panel height too small -', panelHeight, 'px');
        } else {
            console.log('ℹ️ Content fits in panel - no scrollbar needed');
        }
    }, 500);
    
    console.log('✅ Advanced test completed!');
}

// Make both functions available globally
window.testScrollbar = testScrollbar;
window.testScrollbarAdvanced = testScrollbarAdvanced;

// Add function to clear test content and reset authentication state
window.clearTestContent = function() {
    console.log('🧹 Clearing test content and resetting UI...');
    
    // Clear all email displays
    clearAllEmailDisplays();
    
    // Force UI update based on current authentication state
    updateSidebarUI();
    
    console.log('✅ Test content cleared and UI reset!');
};

// Add a reload function for testing
window.reloadAutomail = function() {
    console.log('🔄 Reloading Automail...');
    
    // Remove existing sidebar
    const existingSidebar = document.getElementById('automail-sidebar');
    if (existingSidebar) {
        existingSidebar.remove();
    }
    
    const existingExpandBtn = document.getElementById('automail-expand');
    if (existingExpandBtn) {
        existingExpandBtn.remove();
    }
    
    // Reinitialize
    setTimeout(() => {
        initializeAutomail();
        console.log('✅ Automail reloaded! Try testScrollbar() now.');
    }, 100);
};

// Initialize when content script loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeAutomail);
} else {
    initializeAutomail();
}

} catch (error) {
    console.error('Automail: Error in main wrapper:', error);
} 