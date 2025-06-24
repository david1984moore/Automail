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
                            <button id="automail-review-results" class="automail-btn automail-btn-info" style="display: none;">
                                <span class="automail-review-icon">📊</span>
                                Review Results
                            </button>
                            <button id="automail-clean-spam-btn" class="automail-btn automail-btn-warning">
                                <span class="automail-spam-icon">🗑️</span>
                                Clean Spam
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
                    <!-- Tab Navigation - Two Rows -->
                    <nav class="automail-tab-nav">
                        <div class="automail-tab-row automail-tab-row-primary">
                            <button class="automail-tab-btn active" data-tab="recent">Recent</button>
                            <button class="automail-tab-btn" data-tab="review">Review</button>
                            <button class="automail-tab-btn" data-tab="ai-suggestions">AI</button>
                            <button class="automail-tab-btn" data-tab="stats">Stats</button>
                        </div>
                        <div class="automail-tab-row automail-tab-row-secondary">
                            <button class="automail-tab-btn" data-tab="important">Important</button>
                            <button class="automail-tab-btn" data-tab="spam">Spam</button>
                            <button class="automail-tab-btn" data-tab="promotions">Promotions</button>
                            <button class="automail-tab-btn" data-tab="smart-reply">Reply</button>
                        </div>
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
                                    <p>📭 No emails processed yet</p>
                                    <p class="automail-empty-subtitle">Click "Start Processing" to organize your inbox</p>
                                    <div class="automail-status-indicator">
                                        <span id="automail-connection-status" class="automail-status-item">🔴 Not connected</span>
                                        <span id="automail-processing-status" class="automail-status-item">⏸️ Not processing</span>
                                        <span id="automail-monitoring-status" class="automail-status-item">📭 Not monitoring</span>
                                    </div>
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
                                <div class="automail-ai-controls">
                                    <button id="automail-manual-label-btn" class="automail-btn automail-btn-small">
                                        🏷️ Manual Label
                                    </button>
                                    <button id="automail-undo-all-btn" class="automail-btn automail-btn-small automail-btn-secondary">
                                        ↶ Undo All
                                    </button>
                                </div>
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

                        <!-- Spam Tab -->
                        <div id="automail-spam-tab" class="automail-tab-panel">
                            <div class="automail-panel-header">
                                <h3>Spam Emails</h3>
                                <span id="automail-spam-count" class="automail-processed-count">0 emails</span>
                            </div>
                            <div id="automail-spam-emails" class="automail-email-list">
                                <div class="automail-empty-state">
                                    <p>No spam emails detected</p>
                                    <p class="automail-empty-subtitle">AI-detected spam emails will appear here for review</p>
                                </div>
                            </div>
                        </div>

                        <!-- Promotions Tab -->
                        <div id="automail-promotions-tab" class="automail-tab-panel">
                            <div class="automail-panel-header">
                                <h3>Promotional Emails</h3>
                                <span id="automail-promotions-count" class="automail-processed-count">0 emails</span>
                            </div>
                            <div id="automail-promotions-emails" class="automail-email-list">
                                <div class="automail-empty-state">
                                    <p>No promotional emails</p>
                                    <p class="automail-empty-subtitle">Promotional emails will appear here for review</p>
                                </div>
                            </div>
                        </div>

                        <!-- Review Tab -->
                        <div id="automail-review-tab" class="automail-tab-panel">
                            <div class="automail-panel-header">
                                <h3>Email Management</h3>
                                <div class="automail-review-controls">
                                    <select id="automail-category-filter" class="automail-dropdown">
                                        <option value="all">All Categories</option>
                                        <option value="Security">Security</option>
                                        <option value="Newsletter">Newsletter</option>
                                        <option value="Finance">Finance</option>
                                        <option value="Support">Support</option>
                                        <option value="General">General</option>
                                    </select>
                                    <button id="automail-refresh-emails" class="automail-btn automail-btn-small">🔄 Refresh</button>
                                </div>
                            </div>
                            <div id="automail-review-emails" class="automail-email-list">
                                <div class="automail-empty-state">
                                    <p>No emails to manage</p>
                                    <p class="automail-empty-subtitle">Process some emails first, then use this tab to review and edit classifications</p>
                                </div>
                            </div>
                        </div>

                        <!-- Statistics Tab -->
                        <div id="automail-stats-tab" class="automail-tab-panel">
                            <div class="automail-panel-header">
                                <h3>Processing Statistics</h3>
                            </div>
                            <div class="automail-settings-section">
                                <div class="automail-setting-item">
                                    <label for="automail-confidence-threshold">Confidence Threshold:</label>
                                    <input type="range" id="automail-confidence-threshold" min="0.1" max="1.0" step="0.1" value="0.7">
                                    <span id="automail-confidence-value">0.7</span>
                                </div>
                                <div class="automail-setting-item">
                                    <label class="automail-toggle-label">
                                        <input type="checkbox" id="automail-detailed-labels-toggle" checked>
                                        <span class="automail-toggle-slider"></span>
                                        Create detailed labels
                                    </label>
                                </div>
                                <div class="automail-setting-item">
                                    <label class="automail-toggle-label">
                                        <input type="checkbox" id="automail-move-spam-toggle" checked>
                                        <span class="automail-toggle-slider"></span>
                                        Move spam to trash
                                    </label>
                                </div>
                            </div>
                            <div id="automail-stats-display" class="automail-stats-display">
                                <div class="automail-stat-item">
                                    <span class="automail-stat-label">Total Processed:</span>
                                    <span id="automail-stat-total" class="automail-stat-value">0</span>
                                </div>
                                <div class="automail-stat-item">
                                    <span class="automail-stat-label">Moved from Inbox:</span>
                                    <span id="automail-stat-moved" class="automail-stat-value">0</span>
                                </div>
                                <div class="automail-stat-item">
                                    <span class="automail-stat-label">Average Confidence:</span>
                                    <span id="automail-stat-confidence" class="automail-stat-value">0%</span>
                                </div>
                                <div class="automail-stat-item">
                                    <span class="automail-stat-label">User Corrections:</span>
                                    <span id="automail-stat-corrections" class="automail-stat-value">0</span>
                                </div>
                            </div>
                            
                            <!-- Debug Controls -->
                            <div class="automail-debug-section" style="margin-top: 15px; border-top: 1px solid #e0e0e0; padding-top: 10px;">
                                <h4 style="margin-bottom: 10px; color: #666; font-size: 12px;">🔧 DEBUG CONTROLS</h4>
                                <div class="automail-debug-buttons" style="display: flex; flex-direction: column; gap: 8px;">
                                    <button id="automail-force-refresh" class="automail-debug-button" style="
                                        padding: 6px 10px; 
                                        background: #ff4444; 
                                        color: white; 
                                        border: none; 
                                        border-radius: 4px; 
                                        font-size: 11px;
                                        cursor: pointer;
                                    ">🔄 Force Refresh Emails</button>
                                    <button id="automail-debug-inbox" class="automail-debug-button" style="
                                        padding: 6px 10px; 
                                        background: #4444ff; 
                                        color: white; 
                                        border: none; 
                                        border-radius: 4px; 
                                        font-size: 11px;
                                        cursor: pointer;
                                    ">🔍 Debug Inbox State</button>
                                    <button id="automail-clear-data" class="automail-debug-button" style="
                                        padding: 6px 10px; 
                                        background: #ff8800; 
                                        color: white; 
                                        border: none; 
                                        border-radius: 4px; 
                                        font-size: 11px;
                                        cursor: pointer;
                                    ">🗑️ Clear Stored Data</button>
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
            cleanSpamBtn: document.getElementById('automail-clean-spam-btn'),
            loginContainer: document.getElementById('automail-login-container'),
            logoutContainer: document.getElementById('automail-logout-container'),
            mainContent: document.getElementById('automail-main-content'),
            startProcessingBtn: document.getElementById('automail-start-processing'),
            stopProcessingBtn: document.getElementById('automail-stop-processing'),
            reviewResultsBtn: document.getElementById('automail-review-results'),
            statusText: document.getElementById('automail-status-text'),
            processedCount: document.getElementById('automail-processed-count'),
            tabBtns: document.querySelectorAll('.automail-tab-btn'),
            tabPanels: document.querySelectorAll('.automail-tab-panel'),
            loadingOverlay: document.getElementById('automail-loading-overlay')
        };
        
        console.log('✅ Sidebar elements cached:', {
            sidebarExists: !!sidebarElements.sidebar,
            loginBtnExists: !!sidebarElements.loginBtn,
            cleanSpamBtnExists: !!sidebarElements.cleanSpamBtn,
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
        sidebarElements.reviewResultsBtn?.addEventListener('click', handleReviewResults);
        
        // Spam cleanup
        console.log('🔧 Setting up clean spam button event listener...');
        console.log('🔍 Clean spam button exists:', !!sidebarElements.cleanSpamBtn);
        sidebarElements.cleanSpamBtn?.addEventListener('click', (e) => {
            console.log('🗑️ Clean spam button clicked!');
            e.preventDefault();
            handleCleanSpam();
        });
        
        // Tab navigation
        sidebarElements.tabBtns?.forEach(btn => {
            btn.addEventListener('click', (e) => {
                switchTab(e.target.dataset.tab);
            });
        });

        // AI Tab Controls
        const manualLabelBtn = document.getElementById('automail-manual-label-btn');
        const undoAllBtn = document.getElementById('automail-undo-all-btn');
        
        manualLabelBtn?.addEventListener('click', handleManualLabelAll);
        undoAllBtn?.addEventListener('click', handleUndoAllLabels);
        
        // Review Tab Controls
        const categoryFilter = document.getElementById('automail-category-filter');
        const refreshEmailsBtn = document.getElementById('automail-refresh-emails');
        
        categoryFilter?.addEventListener('change', handleCategoryFilterChange);
        refreshEmailsBtn?.addEventListener('click', handleRefreshEmails);

        // Email action buttons and main buttons (delegated event handling)
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('automail-undo-btn')) {
                handleUndoEmailLabel(e.target.dataset.emailId);
            } else if (e.target.classList.contains('automail-manual-btn')) {
                handleManualEmailLabel(e.target.dataset.emailId);
            } else if (e.target.id === 'automail-clean-spam-btn') {
                console.log('🗑️ Clean spam button clicked via delegation!');
                e.preventDefault();
                handleCleanSpam();
            } else if (e.target.id === 'automail-force-refresh') {
                console.log('🔄 Force refresh button clicked!');
                e.preventDefault();
                handleForceRefresh();
            } else if (e.target.id === 'automail-debug-inbox') {
                console.log('🔍 Debug inbox button clicked!');
                e.preventDefault();
                handleDebugInbox();
            } else if (e.target.id === 'automail-clear-data') {
                console.log('🗑️ Clear data button clicked!');
                e.preventDefault();
                handleClearStoredData();
            }
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
    } else if (request.action === 'updateEmailDisplay') {
        // Background script notifies us to refresh email display
        console.log('📧 Received update request from background script');
        loadStoredData(); // Reload data and update display
        sendResponse({ success: true });
    } else if (request.action === 'showReviewResults') {
        // Display review results from background script
        console.log('📊 Received review results from background script');
        displayReviewResults(request.data);
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
 * Close sidebar (show expand button for easy reopening)
 */
function closeSidebar() {
    console.log('🔄 closeSidebar called');
    
    if (!sidebarElements.sidebar) {
        console.error('❌ Sidebar elements not found!');
        return;
    }
    
    // Hide sidebar but show expand button so user can reopen it
    sidebarElements.sidebar.classList.add('hidden');
    sidebarElements.expandBtn?.classList.remove('hidden');
    sidebarState.isVisible = false;
    
    console.log('✅ Sidebar closed (expand button available for reopening)');
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
        
        console.log('📊 Loading stored data...', {
            isAuthenticated: data.isAuthenticated,
            emailDataCount: data.emailData?.length || 0,
            isProcessing: data.isProcessing
        });
        
        // Load authentication state from storage
        sidebarState.isAuthenticated = data.isAuthenticated || false;
        
        // Load other data
        sidebarState.isProcessing = data.isProcessing || false;
        sidebarState.emailData = data.emailData || [];
        sidebarState.userSettings = data.userSettings || {};
        
        console.log(`📧 Loaded ${sidebarState.emailData.length} emails from storage`);
        
        // Update UI to reflect current state
        updateSidebarUI();
        
        // If we have emails, update the display
        if (sidebarState.emailData.length > 0) {
            console.log('📋 Updating email display with stored emails');
            updateEmailDisplay();
        } else {
            // Even if no processed emails, check for spam cleanup history
            updateSpamTabFromStorage();
        }
        
        // Show appropriate status message
        if (sidebarState.isAuthenticated) {
            updateStatus(`✅ Connected to Gmail - ${sidebarState.emailData.length} emails loaded`, 'success');
        } else {
            updateStatus('🔐 Please login with Google to access Gmail automation', 'info');
        }
        
        console.log('✅ Data loaded successfully');
        
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
        // Hide review button while processing
        if (sidebarElements.reviewResultsBtn) {
            sidebarElements.reviewResultsBtn.style.display = 'none';
        }
    } else {
        sidebarElements.startProcessingBtn.style.display = 'inline-block';
        sidebarElements.stopProcessingBtn.style.display = 'none';
        
        // Reset button state if it was disabled
        if (sidebarElements.startProcessingBtn.disabled) {
            sidebarElements.startProcessingBtn.disabled = false;
            if (sidebarElements.startProcessingBtn.textContent === '🔄 Check Again') {
                // Keep the "Check Again" text for a moment, then reset
                setTimeout(() => {
                    if (sidebarElements.startProcessingBtn && !sidebarState.isProcessing) {
                        sidebarElements.startProcessingBtn.textContent = '▶️ Start Processing';
                    }
                }, 5000);
            } else {
                sidebarElements.startProcessingBtn.textContent = '▶️ Start Processing';
            }
        }
        
        // Show review button if we have processed emails
        updateReviewButtonVisibility(false, sidebarState.emailData.length > 0);
    }
    
    // Update email count
    if (sidebarElements.processedCount) {
        sidebarElements.processedCount.textContent = `${sidebarState.emailData.length} emails`;
    }
    
    // Update status indicators
    updateStatusIndicators();
}

/**
 * Handle authentication functions with enhanced security
 */
async function handleLogin() {
    try {
        // Use status message instead of overlay for less intrusive loading
        updateStatus('🚀 Preparing Google authentication...', 'info');
        
        // Temporarily disable the login button to prevent double-clicks
        if (sidebarElements.loginBtn) {
            sidebarElements.loginBtn.disabled = true;
            sidebarElements.loginBtn.innerHTML = '<span class="automail-google-icon">⏳</span> Connecting...';
        }
        
        console.log('🔐 Attempting Google OAuth authentication...');
        
        // Clear any potential UI state that might suggest authentication
        sidebarState.isAuthenticated = false;
        updateSidebarUI();
        
        // Update status - popup may or may not appear depending on cached credentials
        updateStatus('🔐 Authenticating with Google... (popup may appear if needed)', 'info');
        
        const response = await chrome.runtime.sendMessage({ action: 'login' });
        
        if (response.success) {
            sidebarState.isAuthenticated = true;
            updateStatus('✅ Successfully authenticated with Google OAuth!', 'success');
            updateSidebarUI();
            console.log('✅ Google OAuth authentication completed successfully');
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
        // Re-enable login button
        if (sidebarElements.loginBtn) {
            sidebarElements.loginBtn.disabled = false;
            sidebarElements.loginBtn.innerHTML = '<span class="automail-google-icon">🔐</span> Login with Google';
        }
    }
}

async function handleLogout() {
    try {
        // Use status message instead of overlay for less intrusive loading
        updateStatus('🚪 Disconnecting...', 'info');
        
        // Temporarily disable logout button
        if (sidebarElements.logoutBtn) {
            sidebarElements.logoutBtn.disabled = true;
            sidebarElements.logoutBtn.innerHTML = '<span class="automail-logout-icon">⏳</span> Disconnecting...';
        }
        
        const response = await chrome.runtime.sendMessage({ action: 'logout' });
        
        if (response.success) {
            sidebarState.isAuthenticated = false;
            sidebarState.isProcessing = false;
            sidebarState.emailData = [];
            
            // CRITICAL: Clear progress monitoring interval on logout
            if (window.automailProgressInterval) {
                console.log('🛑 Clearing progress monitoring interval on logout');
                clearInterval(window.automailProgressInterval);
                window.automailProgressInterval = null;
            }
            
            updateStatus('✅ Disconnected successfully', 'success');
            updateSidebarUI();
        } else {
            throw new Error(response.error || 'Logout failed');
        }
    } catch (error) {
        console.error('Automail: Logout error:', error);
        updateStatus(`❌ Logout failed: ${error.message}`, 'error');
    } finally {
        // Re-enable logout button
        if (sidebarElements.logoutBtn) {
            sidebarElements.logoutBtn.disabled = false;
            sidebarElements.logoutBtn.innerHTML = '<span class="automail-logout-icon">🚪</span> Logout';
        }
    }
}

async function handleStartProcessing() {
    try {
        // Use status message instead of overlay for less intrusive loading
        updateStatus('🚀 Starting email processing...', 'info');
        
        // Temporarily disable the start button to prevent double-clicks
        if (sidebarElements.startProcessingBtn) {
            sidebarElements.startProcessingBtn.disabled = true;
            sidebarElements.startProcessingBtn.textContent = '⏳ Starting...';
        }
        
        const response = await chrome.runtime.sendMessage({ action: 'startProcessing' });
        
        if (response.success) {
            sidebarState.isProcessing = true;
            updateStatus('✅ Email processing started! Syncing existing emails...', 'success');
            updateSidebarUI();
            
            // Start periodic UI updates to show email processing progress
            startEmailProgressUpdates();
            
            // Set up a timeout to check for "no emails" case
            setTimeout(async () => {
                const result = await chrome.storage.local.get(['lastProcessingResult', 'isProcessing']);
                if (!result.isProcessing && result.lastProcessingResult) {
                    updateStatus(result.lastProcessingResult.message, 'success');
                    
                    // Re-enable button for user to try again later
                    if (sidebarElements.startProcessingBtn) {
                        sidebarElements.startProcessingBtn.disabled = false;
                        sidebarElements.startProcessingBtn.textContent = '🔄 Check Again';
                    }
                }
            }, 3000);
        } else {
            throw new Error(response.error || 'Failed to start processing');
        }
    } catch (error) {
        console.error('Automail: Start processing error:', error);
        updateStatus(`Failed to start: ${error.message}`, 'error');
        
        // Re-enable start button on error
        if (sidebarElements.startProcessingBtn) {
            sidebarElements.startProcessingBtn.disabled = false;
            sidebarElements.startProcessingBtn.textContent = '▶️ Start Processing';
        }
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
                'totalEmailsInAccount',
                'isAuthenticated' // CRITICAL: Check authentication status
            ]);

            // CRITICAL: Stop monitoring if user is not authenticated (logged out)
            if (!data.isAuthenticated) {
                console.log('🔐 User logged out - stopping progress monitoring');
                sidebarState.isProcessing = false;
                sidebarState.isAuthenticated = false;
                updateSidebarUI();
                updateStatus('🔐 Logged out - monitoring stopped', 'info');
                clearInterval(window.automailProgressInterval);
                return;
            }

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
    
    // Update Spam tab with cleaned spam emails from storage
    updateSpamTabFromStorage();
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
 * Update email display for a specific tab
 */
function updateTabEmailDisplay(tabName, emails) {
    // Find the correct container for this tab
    const tabElement = document.getElementById(`automail-${tabName}-tab`);
    if (!tabElement) {
        console.warn(`Tab element not found: automail-${tabName}-tab`);
        return;
    }

    const container = tabElement.querySelector('.automail-email-list') || 
                     tabElement.querySelector('.automail-suggestions-list') ||
                     tabElement.querySelector('.automail-tab-content');
                     
    if (!container) {
        console.warn(`Email container not found in tab: ${tabName}`);
        return;
    }

    console.log(`📋 Updating ${tabName} tab with ${emails?.length || 0} emails`);

    if (!emails || emails.length === 0) {
        container.innerHTML = `<div class="automail-empty-state">
            <p>${getEmptyStateMessage(tabName)}</p>
        </div>`;
        return;
    }

    // MODIFIED: Group emails by their AI labels and show with edit options
    if (tabName === 'recent' || tabName === 'all') {
        // Group emails by AI label for better organization
        const emailsByLabel = {};
        const unlabeledEmails = [];

        emails.forEach(email => {
            if (email.aiLabel) {
                if (!emailsByLabel[email.aiLabel]) {
                    emailsByLabel[email.aiLabel] = [];
                }
                emailsByLabel[email.aiLabel].push(email);
            } else {
                unlabeledEmails.push(email);
            }
        });

        let html = '';

        // Show labeled emails grouped by label
        const labelOrder = ['Important', 'Work', 'Personal', 'Review', 'Promotions'];
        labelOrder.forEach(label => {
            if (emailsByLabel[label] && emailsByLabel[label].length > 0) {
                html += `
                    <div class="automail-email-group">
                        <div class="automail-email-group-header">
                            <h4>📁 ${label} (${emailsByLabel[label].length})</h4>
                        </div>
                        <div class="automail-email-group-content">
                `;
                
                emailsByLabel[label].forEach(email => {
                    html += createEmailCard(email, true); // true = show edit button
                });
                
                html += `
                        </div>
                    </div>
                `;
            }
        });

        // Show any other labels not in the standard order
        Object.keys(emailsByLabel).forEach(label => {
            if (!labelOrder.includes(label)) {
                html += `
                    <div class="automail-email-group">
                        <div class="automail-email-group-header">
                            <h4>📁 ${label} (${emailsByLabel[label].length})</h4>
                        </div>
                        <div class="automail-email-group-content">
                `;
                
                emailsByLabel[label].forEach(email => {
                    html += createEmailCard(email, true); // true = show edit button
                });
                
                html += `
                        </div>
                    </div>
                `;
            }
        });

        // Show unlabeled emails
        if (unlabeledEmails.length > 0) {
            html += `
                <div class="automail-email-group">
                    <div class="automail-email-group-header">
                        <h4>📝 Unlabeled (${unlabeledEmails.length})</h4>
                    </div>
                    <div class="automail-email-group-content">
            `;
            
            unlabeledEmails.forEach(email => {
                html += createEmailCard(email, false); // false = no edit button yet
            });
            
            html += `
                    </div>
                </div>
            `;
        }

        container.innerHTML = html;
    } else {
        // For specific tabs (spam, important, etc.), show simple list
        let html = '';
        emails.forEach(email => {
            html += createEmailCard(email, !!email.aiLabel);
        });
        container.innerHTML = html;
    }

    // Add event listeners for edit buttons
    container.querySelectorAll('.automail-edit-label-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const emailId = button.getAttribute('data-email-id');
            handleManualEmailLabel(emailId);
        });
    });
}

/**
 * Create an email card with optional edit button
 */
function createEmailCard(email, showEditButton = false) {
    // Handle different timestamp formats (processed emails vs cleaned spam)
    const timeAgo = formatRelativeTime(email.timestamp || email.emailDate || email.cleanedAt || Date.now());
    const isProcessed = email.aiLabel && email.actionsProcessed;
    const isCleanedSpam = email.cleanedAt;
    const folderStatus = isCleanedSpam ? '🗑️ Moved to trash' : (isProcessed ? '📁 Moved to folder' : (email.aiLabel ? '🏷️ Labeled' : '📧'));
    
    return `
        <div class="automail-email-item ${email.read ? 'read' : 'unread'}" 
             data-email-id="${email.id}">
            <div class="automail-email-header">
                <span class="automail-email-sender">${escapeHtml(email.sender || email.from || 'Unknown')}</span>
                <div class="automail-email-actions">
                    ${email.aiLabel ? `
                        <span class="automail-email-label automail-label-${email.aiLabel.toLowerCase()}" 
                              title="AI Confidence: ${Math.round((email.aiConfidence || 0) * 100)}%">
                            ${email.aiLabel}
                        </span>
                    ` : ''}
                    ${showEditButton ? `
                        <button class="automail-edit-label-btn automail-btn automail-btn-mini" 
                                data-email-id="${email.id}" 
                                title="Edit label">
                            ✏️
                        </button>
                    ` : ''}
                </div>
            </div>
            
            <div class="automail-email-subject" title="${escapeHtml(email.subject || 'No Subject')}">
                ${folderStatus} ${escapeHtml((email.subject || 'No Subject').substring(0, 60))}${(email.subject || '').length > 60 ? '...' : ''}
            </div>
            
            <div class="automail-email-snippet">
                ${escapeHtml((email.snippet || email.content || '').substring(0, 100))}${(email.snippet || email.content || '').length > 100 ? '...' : ''}
            </div>
            
            <div class="automail-email-footer">
                <span class="automail-email-time">${timeAgo}</span>
                ${email.aiLabel ? `
                    <span class="automail-email-status">
                        ${isProcessed ? '✅ In folder' : '🔄 Processing...'}
                    </span>
                ` : ''}
            </div>
        </div>
    `;
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
        console.log('🛑 STOP BUTTON ACTIVATED - Using nuclear stop protocol...');
        updateStatus('⏹️ Stopping processing...', 'info');
        
        let stopMethods = [];
        let successCount = 0;
        
        // Method 1: Multiple stop commands to background script
        const stopCommands = ['stopProcessing', 'emergencyStop', 'nuclearStop', 'clearAllIntervals'];
        for (const command of stopCommands) {
            try {
                console.log(`📤 Sending ${command} to background script...`);
                const response = await chrome.runtime.sendMessage({ action: command });
                if (response && response.success) {
                    console.log(`✅ ${command} succeeded`);
                    successCount++;
                    stopMethods.push(`${command}: SUCCESS`);
                    break; // One success is enough for this method
                } else {
                    console.log(`❌ ${command} failed`);
                    stopMethods.push(`${command}: FAILED`);
                }
            } catch (error) {
                console.log(`❌ ${command} error:`, error.message);
                stopMethods.push(`${command}: ERROR - ${error.message}`);
            }
        }
        
        // Method 2: Storage override (if storage APIs work)
        try {
            if (chrome && chrome.storage && chrome.storage.local) {
                await chrome.storage.local.set({
                    isProcessing: false,
                    processingMode: 'BUTTON_STOPPED',
                    forceStopRequested: true,
                    hasMoreEmails: false,
                    allEmailsProcessed: true,
                    buttonStopTime: Date.now()
                });
                console.log('✅ Storage override succeeded');
                successCount++;
                stopMethods.push('Storage override: SUCCESS');
            } else {
                console.log('❌ Storage APIs not available');
                stopMethods.push('Storage override: FAILED - APIs not available');
            }
        } catch (error) {
            console.log('❌ Storage override failed:', error.message);
            stopMethods.push('Storage override: FAILED - ' + error.message);
        }
        
        // Method 3: BRUTE FORCE INTERVAL CLEARING (The method that worked!)
        try {
            console.log('💥 Executing brute force interval clearing...');
            let clearedCount = 0;
            
            // Clear all possible intervals (this is what worked in the console!)
            for (let i = 1; i < 10000; i++) {
                try {
                    clearInterval(i);
                    clearedCount++;
                } catch (e) {
                    // Ignore individual failures
                }
            }
            
            console.log(`✅ Brute force cleared ${clearedCount} intervals`);
            successCount++;
            stopMethods.push(`Brute force: SUCCESS - Cleared ${clearedCount} intervals`);
        } catch (error) {
            console.log('❌ Brute force clearing failed:', error.message);
            stopMethods.push('Brute force: FAILED - ' + error.message);
        }
        
        // Method 4: Clear local intervals
        try {
            // Clear progress update interval
            if (window.automailProgressInterval) {
                clearInterval(window.automailProgressInterval);
                window.automailProgressInterval = null;
                console.log('✅ Cleared progress interval');
            }
            
            // Clear status timeout
            if (window.automailStatusTimeout) {
                clearTimeout(window.automailStatusTimeout);
                window.automailStatusTimeout = null;
                console.log('✅ Cleared status timeout');
            }
            
            successCount++;
            stopMethods.push('Local cleanup: SUCCESS');
        } catch (error) {
            console.log('❌ Local cleanup failed:', error.message);
            stopMethods.push('Local cleanup: FAILED - ' + error.message);
        }
        
        // Update UI state
        sidebarState.isProcessing = false;
        updateSidebarUI();
        
        // Report results
        console.log('📊 STOP BUTTON RESULTS:');
        console.log(`Success count: ${successCount}/4 methods`);
        stopMethods.forEach((method, index) => {
            console.log(`  ${index + 1}. ${method}`);
        });
        
        if (successCount > 0) {
            updateStatus('✅ Processing stopped successfully (Nuclear protocol)', 'success');
            console.log('✅ STOP BUTTON SUCCESS - At least one method worked');
            
            // Advanced monitoring system for 30 seconds
            let monitoringCount = 0;
            const monitoringInterval = setInterval(async () => {
                monitoringCount++;
                console.log(`🔍 Stop monitoring check ${monitoringCount}/6...`);
                
                try {
                    // Check background script status
                    const bgStatus = await chrome.runtime.sendMessage({ action: 'getProcessingStatus' });
                    console.log('📊 Background status:', bgStatus);
                    
                    // Check storage status
                    const storageStatus = await chrome.storage.local.get([
                        'isProcessing', 'processingMode', 'forceStopRequested'
                    ]);
                    console.log('💾 Storage status:', storageStatus);
                    
                    // If still processing after 30 seconds, something is very wrong
                    if (monitoringCount >= 6) {
                        console.log('🚨 CRITICAL: Processing may still be running after 30 seconds!');
                        updateStatus('⚠️ Processing may still be running - Try browser restart', 'warning');
                        clearInterval(monitoringInterval);
                    }
                    
                    // If confirmed stopped, end monitoring early
                    if (!bgStatus.isProcessing && !storageStatus.isProcessing) {
                        console.log('✅ CONFIRMED: Processing fully stopped');
                        updateStatus('✅ Processing confirmed stopped', 'success');
                        clearInterval(monitoringInterval);
                    }
                    
                } catch (error) {
                    console.log(`⚠️ Monitoring error ${monitoringCount}:`, error.message);
                    if (monitoringCount >= 6) {
                        clearInterval(monitoringInterval);
                    }
                }
            }, 5000); // Check every 5 seconds
            
        } else {
            updateStatus('❌ Stop failed - Close extension UI manually', 'error');
            console.log('❌ ALL STOP METHODS FAILED - Close extension UI manually');
        }
        
        console.log('✅ Processing stopped via enhanced Stop button');
        
    } catch (error) {
        console.error('Automail: Stop processing error:', error);
        updateStatus(`❌ Failed to stop: ${error.message}`, 'error');
        
        // Emergency fallback - try brute force clearing anyway
        try {
            console.log('🚨 Emergency fallback - trying brute force anyway...');
            for (let i = 1; i < 10000; i++) {
                clearInterval(i);
            }
            console.log('✅ Emergency brute force completed');
            updateStatus('⚠️ Emergency stop executed', 'warning');
        } catch (e) {
            console.log('❌ Emergency fallback also failed');
        }
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
    const scrollContainer = document.querySelector('.automail-main-content');
    if (!scrollContainer) {
        console.log('❌ Scroll container not found for advanced test');
        return;
    }
    
    console.log('📊 Advanced Scrollbar Test:');
    console.log(`   Container height: ${scrollContainer.offsetHeight}px`);
    console.log(`   Content height: ${scrollContainer.scrollHeight}px`);
    console.log(`   Scroll top: ${scrollContainer.scrollTop}px`);
    console.log(`   Scrollable: ${scrollContainer.scrollHeight > scrollContainer.offsetHeight}`);
    
    // Test if scrolling is working
    const originalScrollTop = scrollContainer.scrollTop;
    scrollContainer.scrollTo(0, 50);
    
    setTimeout(() => {
        const newScrollTop = scrollContainer.scrollTop;
        console.log(`   Scroll test: ${originalScrollTop} → ${newScrollTop} (${newScrollTop !== originalScrollTop ? 'WORKING' : 'NOT WORKING'})`);
        scrollContainer.scrollTo(0, originalScrollTop); // Reset
    }, 100);
}

// =====================================
// AI TAB UNDO & MANUAL LABELING FUNCTIONALITY
// =====================================

/**
 * Handle undoing AI label for a specific email
 */
async function handleUndoEmailLabel(emailId) {
    if (!emailId) {
        console.error('❌ No email ID provided for undo');
        return;
    }
    
    try {
        showLoading('Undoing AI label...');
        
        const response = await chrome.runtime.sendMessage({
            action: 'undoEmailLabel',
            emailId: emailId
        });
        
        hideLoading();
        
        if (response.success) {
            updateStatus(`✅ Successfully removed AI label from email`, 'success');
            // Refresh email display to show updated data
            await loadStoredData();
        } else {
            updateStatus(`❌ Failed to undo label: ${response.error}`, 'error');
        }
    } catch (error) {
        hideLoading();
        console.error('❌ Error undoing email label:', error);
        updateStatus('❌ Error undoing label', 'error');
    }
}

/**
 * Handle manually labeling a specific email
 */
async function handleManualEmailLabel(emailId) {
    if (!emailId) {
        console.error('❌ No email ID provided for manual labeling');
        return;
    }
    
    // Find the email in current data
    const email = sidebarState.emailData.find(e => e.id === emailId);
    if (!email) {
        console.error('❌ Email not found in current data');
        updateStatus('❌ Email not found', 'error');
        return;
    }
    
    showManualLabelModal(email);
}

/**
 * Handle manual labeling for all emails (bulk action)
 */
async function handleManualLabelAll() {
    const aiClassifiedEmails = sidebarState.emailData.filter(email => email.aiLabel);
    
    if (aiClassifiedEmails.length === 0) {
        updateStatus('ℹ️ No AI-classified emails to manually label', 'info');
        return;
    }
    
    showBulkManualLabelModal(aiClassifiedEmails);
}

/**
 * Handle undoing all AI labels
 */
async function handleUndoAllLabels() {
    const aiClassifiedEmails = sidebarState.emailData.filter(email => email.aiLabel);
    
    if (aiClassifiedEmails.length === 0) {
        updateStatus('ℹ️ No AI labels to undo', 'info');
        return;
    }
    
    const confirmed = confirm(`Are you sure you want to undo AI labels for ${aiClassifiedEmails.length} emails? This cannot be undone.`);
    
    if (!confirmed) {
        return;
    }
    
    try {
        showLoading(`Undoing ${aiClassifiedEmails.length} AI labels...`);
        
        const response = await chrome.runtime.sendMessage({
            action: 'undoAllLabels'
        });
        
        hideLoading();
        
        if (response.success) {
            updateStatus(`✅ Successfully removed ${response.undoCount} AI labels`, 'success');
            // Refresh email display to show updated data
            await loadStoredData();
        } else {
            updateStatus(`❌ Failed to undo labels: ${response.error}`, 'error');
        }
    } catch (error) {
        hideLoading();
        console.error('❌ Error undoing all labels:', error);
        updateStatus('❌ Error undoing labels', 'error');
    }
}

/**
 * Show modal for manually labeling a single email
 */
function showManualLabelModal(email) {
    const modal = createModal('Manual Email Labeling', `
        <div class="automail-email-preview">
            <div class="automail-email-preview-subject">${escapeHtml(email.subject || 'No Subject')}</div>
            <div class="automail-email-preview-sender">From: ${escapeHtml(email.sender || 'Unknown')}</div>
            <div class="automail-email-preview-snippet">${escapeHtml((email.snippet || email.content || '').substring(0, 200))}${(email.snippet || email.content || '').length > 200 ? '...' : ''}</div>
        </div>
        
        <div class="automail-form-group">
            <label class="automail-form-label" for="manual-label-select">Choose Label:</label>
            <select id="manual-label-select" class="automail-form-select">
                <option value="">-- Select Label --</option>
                <option value="Work" ${email.aiLabel === 'Work' ? 'selected' : ''}>Work</option>
                <option value="Personal" ${email.aiLabel === 'Personal' ? 'selected' : ''}>Personal</option>
                <option value="Important" ${email.aiLabel === 'Important' ? 'selected' : ''}>Important</option>
                <option value="Spam" ${email.aiLabel === 'Spam' ? 'selected' : ''}>Spam</option>
                <option value="Review" ${email.aiLabel === 'Review' ? 'selected' : ''}>Review</option>
                <option value="Promotions" ${email.aiLabel === 'Promotions' ? 'selected' : ''}>Promotions</option>
                <option value="remove">Remove Label</option>
            </select>
        </div>
        
        ${email.aiLabel ? `
            <div class="automail-form-group">
                <label class="automail-form-label">Current AI Label:</label>
                <div style="padding: 8px; background: #f8f9fa; border-radius: 4px; color: #666;">
                    ${email.aiLabel} (${Math.round((email.aiConfidence || 0) * 100)}% confidence)
                </div>
            </div>
        ` : ''}
    `, [
        {
            text: 'Cancel',
            class: 'automail-btn-secondary',
            action: 'close'
        },
        {
            text: 'Apply Label',
            class: 'automail-btn-primary',
            action: async () => {
                const selectedLabel = document.getElementById('manual-label-select').value;
                if (!selectedLabel) {
                    alert('Please select a label');
                    return false;
                }
                
                try {
                    showLoading('Applying manual label...');
                    
                    const response = await chrome.runtime.sendMessage({
                        action: 'manualLabelEmail',
                        emailId: email.id,
                        label: selectedLabel === 'remove' ? null : selectedLabel
                    });
                    
                    hideLoading();
                    
                    if (response.success) {
                        updateStatus(`✅ Successfully applied label: ${selectedLabel === 'remove' ? 'Label removed' : selectedLabel}`, 'success');
                        // Refresh email display to show updated data
                        await loadStoredData();
                        return true; // Close modal
                    } else {
                        updateStatus(`❌ Failed to apply label: ${response.error}`, 'error');
                        return false; // Keep modal open
                    }
                } catch (error) {
                    hideLoading();
                    console.error('❌ Error applying manual label:', error);
                    updateStatus('❌ Error applying label', 'error');
                    return false;
                }
            }
        }
    ]);
    
    document.body.appendChild(modal);
}

/**
 * Show modal for bulk manual labeling
 */
function showBulkManualLabelModal(emails) {
    const modal = createModal('Bulk Manual Labeling', `
        <div style="margin-bottom: 16px;">
            <strong>${emails.length} emails</strong> will be affected by this action.
        </div>
        
        <div class="automail-form-group">
            <label class="automail-form-label" for="bulk-label-select">Choose Action:</label>
            <select id="bulk-label-select" class="automail-form-select">
                <option value="">-- Select Action --</option>
                <option value="Work">Label all as Work</option>
                <option value="Personal">Label all as Personal</option>
                <option value="Important">Label all as Important</option>
                <option value="Spam">Label all as Spam</option>
                <option value="Review">Label all as Review</option>
                <option value="Promotions">Label all as Promotions</option>
                <option value="remove">Remove all AI labels</option>
            </select>
        </div>
        
        <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 4px; padding: 12px; margin-top: 16px;">
            <strong>⚠️ Warning:</strong> This action will override all existing AI labels and cannot be undone.
        </div>
    `, [
        {
            text: 'Cancel',
            class: 'automail-btn-secondary',
            action: 'close'
        },
        {
            text: 'Apply to All',
            class: 'automail-btn-danger',
            action: async () => {
                const selectedAction = document.getElementById('bulk-label-select').value;
                if (!selectedAction) {
                    alert('Please select an action');
                    return false;
                }
                
                const confirmed = confirm(`Are you sure you want to apply "${selectedAction === 'remove' ? 'Remove labels' : selectedAction}" to ${emails.length} emails?`);
                if (!confirmed) return false;
                
                try {
                    showLoading(`Applying bulk label to ${emails.length} emails...`);
                    
                    const response = await chrome.runtime.sendMessage({
                        action: 'bulkManualLabel',
                        emailIds: emails.map(e => e.id),
                        label: selectedAction === 'remove' ? null : selectedAction
                    });
                    
                    hideLoading();
                    
                    if (response.success) {
                        updateStatus(`✅ Successfully updated ${response.updatedCount} emails`, 'success');
                        // Refresh email display to show updated data
                        await loadStoredData();
                        return true; // Close modal
                    } else {
                        updateStatus(`❌ Failed to apply bulk labels: ${response.error}`, 'error');
                        return false; // Keep modal open
                    }
                } catch (error) {
                    hideLoading();
                    console.error('❌ Error applying bulk labels:', error);
                    updateStatus('❌ Error applying bulk labels', 'error');
                    return false;
                }
            }
        }
    ]);
    
    document.body.appendChild(modal);
}

/**
 * Create a modal dialog
 */
function createModal(title, bodyHTML, buttons = []) {
    const modal = document.createElement('div');
    modal.className = 'automail-modal';
    
    modal.innerHTML = `
        <div class="automail-modal-content">
            <div class="automail-modal-header">
                <h3 class="automail-modal-title">${escapeHtml(title)}</h3>
                <button class="automail-modal-close">&times;</button>
            </div>
            <div class="automail-modal-body">
                ${bodyHTML}
            </div>
            <div class="automail-modal-actions">
                ${buttons.map(btn => `
                    <button class="automail-btn-modal ${btn.class}" data-action="${btn.action || 'close'}">
                        ${escapeHtml(btn.text)}
                    </button>
                `).join('')}
            </div>
        </div>
    `;
    
    // Close modal handlers
    const closeModal = () => {
        modal.remove();
    };
    
    modal.querySelector('.automail-modal-close').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
    
    // Button handlers
    buttons.forEach((btn, index) => {
        const buttonEl = modal.querySelectorAll('.automail-btn-modal')[index];
        if (btn.action === 'close') {
            buttonEl.addEventListener('click', closeModal);
        } else if (typeof btn.action === 'function') {
            buttonEl.addEventListener('click', async () => {
                const result = await btn.action();
                if (result === true) {
                    closeModal();
                }
            });
        }
    });
    
    return modal;
}

/**
 * Handle clean spam emails action
 */
async function handleCleanSpam() {
    try {
        console.log('🧹 handleCleanSpam function called!');
        console.log('🧹 Starting spam cleanup process...');
        
        // Show confirmation modal
        const confirmModal = createModal(
            '🗑️ Clean Spam Emails',
            `
            <div class="automail-form-group">
                <p><strong>This action will:</strong></p>
                <ul>
                    <li>Find all emails in your Gmail SPAM folder</li>
                    <li>Move them permanently to the trash</li>
                    <li>This action cannot be undone</li>
                </ul>
                <p>Are you sure you want to proceed?</p>
            </div>
            `,
            [
                { text: 'Cancel', class: 'automail-btn-secondary', action: 'cancel' },
                { text: 'Clean Spam', class: 'automail-btn-warning', action: 'confirm' }
            ]
        );
        
        document.body.appendChild(confirmModal);
        console.log('🔍 Modal added to DOM:', confirmModal);
        console.log('🔍 Modal display style:', window.getComputedStyle(confirmModal).display);
        console.log('🔍 Modal z-index:', window.getComputedStyle(confirmModal).zIndex);
        
        // Wait for user confirmation
        const confirmed = await new Promise(resolve => {
            confirmModal.addEventListener('click', (e) => {
                console.log('🖱️ Modal clicked:', e.target);
                console.log('🖱️ Click target action:', e.target.dataset.action);
                console.log('🖱️ Click target text:', e.target.textContent?.trim());
                console.log('🖱️ Click target classes:', e.target.className);
                
                // Only respond to button clicks
                if (e.target.classList.contains('automail-btn-modal')) {
                    if (e.target.dataset.action === 'confirm') {
                        console.log('✅ User confirmed spam cleanup');
                        confirmModal.remove();
                        resolve(true);
                    } else if (e.target.dataset.action === 'cancel') {
                        console.log('❌ User cancelled spam cleanup');
                        confirmModal.remove();
                        resolve(false);
                    }
                } else if (e.target.classList.contains('automail-modal-close')) {
                    console.log('❌ User closed modal via X button');
                    confirmModal.remove();
                    resolve(false);
                } else if (e.target === confirmModal) {
                    console.log('❌ User clicked outside modal');
                    confirmModal.remove();
                    resolve(false);
                }
                // Don't remove modal or resolve for other clicks (like content area)
            });
        });
        
        if (!confirmed) {
            console.log('🚫 Spam cleanup cancelled by user');
            return;
        }
        
        console.log('✅ User confirmed spam cleanup');
        updateStatus('🧹 Starting spam cleanup...', 'info');
        showLoading('Fetching spam emails from Gmail...');
        
        // Small delay to show the loading state started
        await new Promise(resolve => setTimeout(resolve, 100));
        
        try {
            // Send message to background script to clean spam with timeout
            const response = await Promise.race([
                chrome.runtime.sendMessage({
                    action: 'cleanSpamEmails'
                }),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Cleanup timeout after 60 seconds')), 60000)
                )
            ]);
            
            hideLoading();
            
            if (response && response.success) {
                updateStatus(
                    `🎉 ${response.message} (${response.cleaned}/${response.total})`,
                    'success'
                );
                
                // Update spam tab with cleaned emails
                if (response.cleanedEmails && response.cleanedEmails.length > 0) {
                    updateSpamTab(response.cleanedEmails);
                    console.log(`📧 Updated spam tab with ${response.cleanedEmails.length} cleaned emails`);
                }
                
                if (response.errors && response.errors.length > 0) {
                    console.warn('⚠️ Some errors occurred during cleanup:', response.errors);
                    updateStatus(
                        `⚠️ Completed with ${response.errors.length} errors - check console`,
                        'warning'
                    );
                }
                
                console.log('🎉 Spam cleanup completed successfully:', response);
            } else {
                console.error('❌ Spam cleanup failed:', response?.error || 'Unknown error');
                updateStatus(`❌ Failed to clean spam: ${response?.error || 'Unknown error'}`, 'error');
            }
        } catch (error) {
            hideLoading();
            console.error('❌ Error during spam cleanup:', error);
            updateStatus(`❌ Cleanup error: ${error.message}`, 'error');
        }
        
    } catch (error) {
        console.error('❌ Error handling spam cleanup:', error);
        updateStatus(`❌ Error cleaning spam: ${error.message}`, 'error');
        hideLoading();
    }
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

/**
 * Handle force refresh emails debug action
 */
async function handleForceRefresh() {
    try {
        console.log('🔄 Starting force refresh...');
        showLoading('Force refreshing emails...');
        updateStatus('🔄 Force refreshing emails from Gmail...', 'info');
        
        const response = await chrome.runtime.sendMessage({
            action: 'forceRefreshEmails'
        });
        
        if (response && response.success) {
            console.log('✅ Force refresh completed');
            updateStatus('✅ Emails refreshed from Gmail', 'success');
            // Reload the UI data
            await loadStoredData();
        } else {
            throw new Error(response?.error || 'Unknown error during force refresh');
        }
        
    } catch (error) {
        console.error('❌ Error force refreshing emails:', error);
        updateStatus('❌ Error force refreshing emails', 'error');
    } finally {
        hideLoading();
    }
}

/**
 * Handle debug inbox state action
 */
async function handleDebugInbox() {
    try {
        console.log('🔍 Starting inbox debug...');
        showLoading('Analyzing inbox state...');
        updateStatus('🔍 Debugging inbox state...', 'info');
        
        const response = await chrome.runtime.sendMessage({
            action: 'debugCurrentInbox'
        });
        
        if (response && response.success) {
            const debug = response.debug;
            console.log('📊 Debug analysis completed:', debug);
            
            // Show debug results in a modal
            const debugHTML = `
                <div style="font-family: monospace; font-size: 12px;">
                    <p><strong>📧 Gmail Inbox Count:</strong> ${debug.actualInboxCount}</p>
                    <p><strong>💾 Stored Emails:</strong> ${debug.storedEmailsTotal}</p>
                    <p><strong>🏷️ AI Labeled:</strong> ${debug.emailsWithAILabels}</p>
                    <p><strong>📥 Marked in Inbox:</strong> ${debug.emailsMarkedInInbox}</p>
                    <p><strong>📤 Marked Moved:</strong> ${debug.emailsMarkedMoved}</p>
                    <p><strong>⚠️ Discrepancy:</strong> ${debug.discrepancy}</p>
                    <hr>
                    <p><strong>Sample Emails:</strong></p>
                    ${debug.sampleStoredEmails.map(e => `
                        <div style="margin: 5px 0; padding: 5px; background: #f5f5f5;">
                            <p>ID: ${e.id}</p>
                            <p>Subject: ${e.subject}</p>
                            <p>AI Label: ${e.aiLabel || 'None'}</p>
                            <p>In Inbox: ${e.inInbox !== false ? 'Yes' : 'No'}</p>
                        </div>
                    `).join('')}
                </div>
            `;
            
            createModal('🔍 Inbox Debug Analysis', debugHTML, [
                { text: 'Close', action: 'close' }
            ]);
            
            updateStatus('✅ Debug analysis completed', 'success');
        } else {
            throw new Error(response?.error || 'Unknown error during debug');
        }
        
    } catch (error) {
        console.error('❌ Error debugging inbox:', error);
        updateStatus('❌ Error debugging inbox', 'error');
    } finally {
        hideLoading();
    }
}

/**
 * Handle clear stored data action
 */
async function handleClearStoredData() {
    try {
        if (!confirm('⚠️ Are you sure you want to clear all stored email data? This will force a complete refresh on next fetch.')) {
            return;
        }
        
        console.log('🗑️ Clearing stored data...');
        showLoading('Clearing stored data...');
        updateStatus('🗑️ Clearing stored data...', 'info');
        
        // Clear all email-related stored data
        await chrome.storage.local.remove([
            'emailData', 
            'lastFetchTime',
            'lastLabelingTime',
            'processingStats',
            'userCorrections'
        ]);
        
        // Reset UI
        clearAllEmailDisplays();
        
        // Update stats
        document.getElementById('automail-stat-total').textContent = '0';
        document.getElementById('automail-stat-moved').textContent = '0';
        document.getElementById('automail-stat-confidence').textContent = '0%';
        document.getElementById('automail-stat-corrections').textContent = '0';
        
        console.log('✅ Stored data cleared');
        updateStatus('✅ Stored data cleared - fetch emails to reload', 'success');
        
    } catch (error) {
        console.error('❌ Error clearing stored data:', error);
        updateStatus('❌ Error clearing stored data', 'error');
    } finally {
        hideLoading();
    }
}

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

/**
 * Handle review results button click
 */
async function handleReviewResults() {
    try {
        console.log('📊 Starting email review...');
        showLoading('Analyzing processed emails...');
        
        const response = await chrome.runtime.sendMessage({ action: 'reviewEmails' });
        
        if (response.success) {
            console.log('✅ Email review initiated successfully');
            switchTab('review'); // Switch to review tab to show results
        } else {
            console.error('❌ Email review failed:', response.error);
            updateStatus(`Review failed: ${response.error}`, 'error');
        }
        
    } catch (error) {
        console.error('❌ Review error:', error);
        updateStatus(`Review error: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
}

/**
 * Display review results in the review tab
 */
function displayReviewResults(analysisData) {
    try {
        console.log('📊 Displaying review results:', analysisData);
        
        const reviewTab = document.getElementById('automail-review-emails');
        if (!reviewTab) {
            console.error('❌ Review tab not found');
            return;
        }
        
        // Create comprehensive review dashboard
        const reviewHTML = `
            <div class="review-dashboard">
                <div class="review-summary">
                    <h4>📊 Processing Summary</h4>
                    <div class="summary-stats">
                        <div class="stat-card">
                            <span class="stat-number">${analysisData.totalEmails}</span>
                            <span class="stat-label">Total Processed</span>
                        </div>
                        <div class="stat-card">
                            <span class="stat-number">${analysisData.lowConfidenceEmails.length}</span>
                            <span class="stat-label">Need Review</span>
                        </div>
                    </div>
                </div>
                
                <div class="category-analysis">
                    <h4>📂 Category Breakdown</h4>
                    ${Object.entries(analysisData.categoryBreakdown).map(([category, stats]) => `
                        <div class="category-review-item">
                            <div class="category-header">
                                <span class="category-name">${category}</span>
                                <span class="category-count">${stats.count} emails</span>
                            </div>
                            <div class="confidence-display">
                                <div class="confidence-bar">
                                    <div class="confidence-fill" style="width: ${stats.avgConfidence * 100}%"></div>
                                </div>
                                <span class="confidence-text">${Math.round(stats.avgConfidence * 100)}% confidence</span>
                            </div>
                            ${stats.needsReview > 0 ? 
                                `<div class="needs-review-badge">${stats.needsReview} emails need review</div>` : 
                                '<div class="all-good-badge">✅ All emails look good</div>'
                            }
                        </div>
                    `).join('')}
                </div>
                
                ${analysisData.lowConfidenceEmails.length > 0 ? `
                    <div class="low-confidence-section">
                        <h4>⚠️ Low Confidence Classifications</h4>
                        <p>These emails might be in the wrong category:</p>
                        ${analysisData.lowConfidenceEmails.slice(0, 5).map(email => `
                            <div class="email-review-card">
                                <div class="email-subject">${email.subject}</div>
                                <div class="email-details">
                                    <span class="email-from">From: ${email.from}</span>
                                    <span class="email-category">Category: ${email.currentCategory}</span>
                                    <span class="confidence-score">${Math.round(email.confidence * 100)}% confidence</span>
                                </div>
                                <div class="email-actions">
                                    <button class="btn-reclassify" data-email-id="${email.id}">🔄 Reclassify</button>
                                    <button class="btn-correct" data-email-id="${email.id}">✓ Correct</button>
                                </div>
                            </div>
                        `).join('')}
                        ${analysisData.lowConfidenceEmails.length > 5 ? 
                            `<p class="more-results">... and ${analysisData.lowConfidenceEmails.length - 5} more emails</p>` : ''
                        }
                    </div>
                ` : `
                    <div class="all-good-section">
                        <h4>🎉 Great Job!</h4>
                        <p>All emails were classified with high confidence. No manual review needed.</p>
                    </div>
                `}
                
                <div class="review-actions">
                    <button id="review-by-category" class="automail-btn automail-btn-primary">
                        📂 Review by Category
                    </button>
                    <button id="fix-low-confidence" class="automail-btn automail-btn-warning">
                        ⚠️ Fix Low Confidence
                    </button>
                    <button id="create-custom-rules" class="automail-btn automail-btn-info">
                        🔧 Create Rules
                    </button>
                    <button id="undo-all-processing" class="automail-btn automail-btn-danger">
                        ↶ Undo All
                    </button>
                </div>
            </div>
        `;
        
        reviewTab.innerHTML = reviewHTML;
        
        // Update review count in tab
        const reviewCount = document.getElementById('automail-review-count');
        if (reviewCount) {
            reviewCount.textContent = `${analysisData.lowConfidenceEmails.length} emails`;
        }
        
        // Show review button since we have results
        if (sidebarElements.reviewResultsBtn) {
            sidebarElements.reviewResultsBtn.style.display = 'inline-block';
        }
        
        console.log('✅ Review results displayed successfully');
        
    } catch (error) {
        console.error('❌ Error displaying review results:', error);
    }
}

/**
 * Update status indicators in the UI
 */
function updateStatusIndicators() {
    const connectionStatus = document.getElementById('automail-connection-status');
    const processingStatus = document.getElementById('automail-processing-status');
    const monitoringStatus = document.getElementById('automail-monitoring-status');
    
    if (connectionStatus) {
        if (sidebarState.isAuthenticated) {
            connectionStatus.textContent = '🟢 Connected to Gmail';
            connectionStatus.style.color = '#28a745';
        } else {
            connectionStatus.textContent = '🔴 Not connected';
            connectionStatus.style.color = '#dc3545';
        }
    }
    
    if (processingStatus) {
        if (sidebarState.isProcessing) {
            processingStatus.textContent = '⚡ Processing emails...';
            processingStatus.style.color = '#ffc107';
        } else if (sidebarState.emailData.length > 0) {
            processingStatus.textContent = '✅ Processing complete';
            processingStatus.style.color = '#28a745';
        } else {
            processingStatus.textContent = '⏸️ Not processing';
            processingStatus.style.color = '#6c757d';
        }
    }
    
    if (monitoringStatus) {
        if (sidebarState.isProcessing) {
            monitoringStatus.textContent = '👀 Monitoring for new emails';
            monitoringStatus.style.color = '#17a2b8';
        } else {
            monitoringStatus.textContent = '📭 Not monitoring';
            monitoringStatus.style.color = '#6c757d';
        }
    }
}

/**
 * Show/hide review results button based on processing state
 */
function updateReviewButtonVisibility(isProcessing, hasProcessedEmails) {
    if (sidebarElements.reviewResultsBtn) {
        // Show review button when processing is complete and there are processed emails
        if (!isProcessing && hasProcessedEmails) {
            sidebarElements.reviewResultsBtn.style.display = 'inline-block';
        } else {
            sidebarElements.reviewResultsBtn.style.display = 'none';
        }
    }
}

/**
 * Handle category filter change in review tab
 */
async function handleCategoryFilterChange() {
    try {
        const categoryFilter = document.getElementById('automail-category-filter');
        const selectedCategory = categoryFilter.value;
        
        console.log(`🔍 Filtering emails by category: ${selectedCategory}`);
        showLoading('Loading emails...');
        
        const response = await chrome.runtime.sendMessage({ 
            action: 'getProcessedEmails',
            category: selectedCategory 
        });
        
        if (response.success) {
            displayProcessedEmails(response.emails, selectedCategory);
        } else {
            console.error('❌ Failed to get processed emails:', response.error);
            updateStatus(`Failed to load emails: ${response.error}`, 'error');
        }
        
    } catch (error) {
        console.error('❌ Error filtering emails:', error);
        updateStatus(`Error filtering emails: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
}

/**
 * Handle refresh emails button click
 */
async function handleRefreshEmails() {
    try {
        console.log('🔄 Refreshing processed emails...');
        showLoading('Refreshing emails...');
        
        const categoryFilter = document.getElementById('automail-category-filter');
        const selectedCategory = categoryFilter?.value || 'all';
        
        const response = await chrome.runtime.sendMessage({ 
            action: 'getProcessedEmails',
            category: selectedCategory,
            forceRefresh: true
        });
        
        if (response.success) {
            displayProcessedEmails(response.emails, selectedCategory);
            updateStatus('✅ Emails refreshed', 'success');
        } else {
            console.error('❌ Failed to refresh emails:', response.error);
            updateStatus(`Failed to refresh emails: ${response.error}`, 'error');
        }
        
    } catch (error) {
        console.error('❌ Error refreshing emails:', error);
        updateStatus(`Error refreshing emails: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
}

/**
 * Display processed emails with edit capabilities
 */
function displayProcessedEmails(emails, category) {
    const reviewContainer = document.getElementById('automail-review-emails');
    if (!reviewContainer) return;
    
    if (emails.length === 0) {
        reviewContainer.innerHTML = `
            <div class="automail-empty-state">
                <p>No emails found</p>
                <p class="automail-empty-subtitle">
                    ${category === 'all' ? 'No processed emails yet' : `No emails in ${category} category`}
                </p>
            </div>
        `;
        return;
    }
    
    // Group emails by category if showing all
    const emailsByCategory = {};
    if (category === 'all') {
        emails.forEach(email => {
            const cat = email.currentCategory || 'Unknown';
            if (!emailsByCategory[cat]) {
                emailsByCategory[cat] = [];
            }
            emailsByCategory[cat].push(email);
        });
    } else {
        emailsByCategory[category] = emails;
    }
    
    let emailsHTML = '';
    
    Object.entries(emailsByCategory).forEach(([cat, categoryEmails]) => {
        emailsHTML += `
            <div class="email-category-section">
                <div class="category-section-header">
                    <h4>${cat} (${categoryEmails.length} emails)</h4>
                    <button class="btn-bulk-edit" data-category="${cat}">✏️ Bulk Edit</button>
                </div>
                <div class="category-emails">
                    ${categoryEmails.map(email => createEditableEmailCard(email)).join('')}
                </div>
            </div>
        `;
    });
    
    reviewContainer.innerHTML = emailsHTML;
    
    // Add event listeners for edit actions
    setupEmailEditListeners();
}

/**
 * Create an editable email card with correction options
 */
function createEditableEmailCard(email) {
    const confidenceColor = email.confidence > 0.7 ? '#28a745' : email.confidence > 0.5 ? '#ffc107' : '#dc3545';
    const categories = ['Security', 'Newsletter', 'Finance', 'Support', 'General'];
    
    return `
        <div class="editable-email-card" data-email-id="${email.id}">
            <div class="email-card-header">
                <div class="email-card-info">
                    <div class="email-card-subject">${escapeHtml(email.subject)}</div>
                    <div class="email-card-from">From: ${escapeHtml(email.from)}</div>
                    <div class="email-card-snippet">${escapeHtml(email.snippet.substring(0, 100))}...</div>
                </div>
                <div class="email-card-actions">
                    <div class="current-category-badge" style="background-color: ${confidenceColor}">
                        ${email.currentCategory}
                        <span class="confidence-score">${Math.round(email.confidence * 100)}%</span>
                    </div>
                </div>
            </div>
            
            <div class="email-card-controls">
                <div class="category-selector">
                    <label>Move to:</label>
                    <select class="category-select" data-email-id="${email.id}">
                        ${categories.map(cat => `
                            <option value="${cat}" ${cat === email.currentCategory ? 'selected' : ''}>
                                ${cat}
                            </option>
                        `).join('')}
                    </select>
                    <button class="btn-move-email" data-email-id="${email.id}">Move</button>
                </div>
                
                <div class="email-actions-row">
                    <button class="btn-move-to-inbox" data-email-id="${email.id}">📥 Back to Inbox</button>
                    <button class="btn-delete-email" data-email-id="${email.id}">🗑️ Delete</button>
                    <button class="btn-create-rule" data-email-id="${email.id}">🔧 Create Rule</button>
                </div>
            </div>
        </div>
    `;
}

/**
 * Setup event listeners for email edit actions
 */
function setupEmailEditListeners() {
    // Move email buttons
    document.querySelectorAll('.btn-move-email').forEach(btn => {
        btn.addEventListener('click', handleMoveEmail);
    });
    
    // Move to inbox buttons
    document.querySelectorAll('.btn-move-to-inbox').forEach(btn => {
        btn.addEventListener('click', handleMoveToInbox);
    });
    
    // Delete email buttons
    document.querySelectorAll('.btn-delete-email').forEach(btn => {
        btn.addEventListener('click', handleDeleteEmail);
    });
    
    // Create rule buttons
    document.querySelectorAll('.btn-create-rule').forEach(btn => {
        btn.addEventListener('click', handleCreateRule);
    });
    
    // Bulk edit buttons
    document.querySelectorAll('.btn-bulk-edit').forEach(btn => {
        btn.addEventListener('click', handleBulkEdit);
    });
}

/**
 * Handle moving an email to a different category
 */
async function handleMoveEmail(event) {
    try {
        const emailId = event.target.dataset.emailId;
        const categorySelect = document.querySelector(`.category-select[data-email-id="${emailId}"]`);
        const newCategory = categorySelect.value;
        
        console.log(`🔄 Moving email ${emailId} to ${newCategory}`);
        showLoading('Moving email...');
        
        const response = await chrome.runtime.sendMessage({
            action: 'reclassifyEmail',
            emailId: emailId,
            newCategory: newCategory,
            reason: 'user_correction'
        });
        
        if (response.success) {
            updateStatus(`✅ Email moved to ${newCategory}`, 'success');
            // Refresh the current view
            handleRefreshEmails();
        } else {
            throw new Error(response.error || 'Failed to move email');
        }
        
    } catch (error) {
        console.error('❌ Error moving email:', error);
        updateStatus(`Error moving email: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
}

/**
 * Handle moving an email back to inbox
 */
async function handleMoveToInbox(event) {
    try {
        const emailId = event.target.dataset.emailId;
        
        console.log(`📥 Moving email ${emailId} back to inbox`);
        showLoading('Moving to inbox...');
        
        const response = await chrome.runtime.sendMessage({
            action: 'moveToInbox',
            emailId: emailId
        });
        
        if (response.success) {
            updateStatus('✅ Email moved back to inbox', 'success');
            // Refresh the current view
            handleRefreshEmails();
        } else {
            throw new Error(response.error || 'Failed to move email to inbox');
        }
        
    } catch (error) {
        console.error('❌ Error moving email to inbox:', error);
        updateStatus(`Error moving to inbox: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
}

/**
 * Handle deleting an email
 */
async function handleDeleteEmail(event) {
    try {
        const emailId = event.target.dataset.emailId;
        
        if (!confirm('Are you sure you want to delete this email? This action cannot be undone.')) {
            return;
        }
        
        console.log(`🗑️ Deleting email ${emailId}`);
        showLoading('Deleting email...');
        
        const response = await chrome.runtime.sendMessage({
            action: 'deleteEmail',
            emailId: emailId
        });
        
        if (response.success) {
            updateStatus('✅ Email deleted', 'success');
            // Refresh the current view
            handleRefreshEmails();
        } else {
            throw new Error(response.error || 'Failed to delete email');
        }
        
    } catch (error) {
        console.error('❌ Error deleting email:', error);
        updateStatus(`Error deleting email: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
}

/**
 * Handle creating a rule based on an email
 */
async function handleCreateRule(event) {
    try {
        const emailId = event.target.dataset.emailId;
        
        // Show rule creation modal
        showCreateRuleModal(emailId);
        
    } catch (error) {
        console.error('❌ Error creating rule:', error);
        updateStatus(`Error creating rule: ${error.message}`, 'error');
    }
}

/**
 * Handle bulk editing emails
 */
async function handleBulkEdit(event) {
    try {
        const category = event.target.dataset.category;
        
        // Show bulk edit modal
        showBulkEditModal(category);
        
    } catch (error) {
        console.error('❌ Error bulk editing:', error);
        updateStatus(`Error bulk editing: ${error.message}`, 'error');
    }
}

/**
 * Show create rule modal
 */
function showCreateRuleModal(emailId) {
    const modalHTML = `
        <div class="rule-creation-form">
            <h4>Create Classification Rule</h4>
            <p>Create a rule to automatically classify similar emails in the future.</p>
            
            <div class="automail-form-group">
                <label>Rule Type:</label>
                <select id="rule-type" class="automail-form-input">
                    <option value="sender">Based on Sender</option>
                    <option value="subject">Based on Subject Keywords</option>
                    <option value="domain">Based on Sender Domain</option>
                </select>
            </div>
            
            <div class="automail-form-group">
                <label>Target Category:</label>
                <select id="rule-category" class="automail-form-input">
                    <option value="Security">Security</option>
                    <option value="Newsletter">Newsletter</option>
                    <option value="Finance">Finance</option>
                    <option value="Support">Support</option>
                    <option value="General">General</option>
                </select>
            </div>
            
            <div class="automail-form-group">
                <label>Rule Description:</label>
                <input type="text" id="rule-description" class="automail-form-input" 
                       placeholder="e.g., All emails from this sender go to Newsletter">
            </div>
        </div>
    `;
    
    createModal('Create Classification Rule', modalHTML, [
        { 
            text: 'Create Rule', 
            action: () => createClassificationRule(emailId),
            class: 'automail-btn-primary'
        },
        { 
            text: 'Cancel', 
            action: 'close',
            class: 'automail-btn-secondary'
        }
    ]);
}

/**
 * Show bulk edit modal
 */
function showBulkEditModal(category) {
    const modalHTML = `
        <div class="bulk-edit-form">
            <h4>Bulk Edit ${category} Emails</h4>
            <p>Apply changes to all emails in the ${category} category.</p>
            
            <div class="automail-form-group">
                <label>Action:</label>
                <select id="bulk-action" class="automail-form-input">
                    <option value="move">Move to different category</option>
                    <option value="inbox">Move all back to inbox</option>
                    <option value="delete">Delete all</option>
                </select>
            </div>
            
            <div class="automail-form-group" id="bulk-target-category">
                <label>Target Category:</label>
                <select id="bulk-new-category" class="automail-form-input">
                    <option value="Security">Security</option>
                    <option value="Newsletter">Newsletter</option>
                    <option value="Finance">Finance</option>
                    <option value="Support">Support</option>
                    <option value="General">General</option>
                </select>
            </div>
        </div>
    `;
    
    createModal('Bulk Edit Emails', modalHTML, [
        { 
            text: 'Apply Changes', 
            action: () => applyBulkEdit(category),
            class: 'automail-btn-primary'
        },
        { 
            text: 'Cancel', 
            action: 'close',
            class: 'automail-btn-secondary'
        }
    ]);
    
    // Show/hide target category based on action
    document.getElementById('bulk-action').addEventListener('change', (e) => {
        const targetCategoryDiv = document.getElementById('bulk-target-category');
        if (e.target.value === 'move') {
            targetCategoryDiv.style.display = 'block';
        } else {
            targetCategoryDiv.style.display = 'none';
        }
    });
}

/**
 * Create a modal dialog (unified version that returns the modal element)
 */
function createModal(title, content, buttons) {
    // Remove existing modal if any
    const existingModal = document.getElementById('automail-modal');
    if (existingModal) {
        existingModal.remove();
    }
    
    const modal = document.createElement('div');
    modal.id = 'automail-modal';
    modal.className = 'automail-modal';
    
    modal.innerHTML = `
        <div class="automail-modal-content">
            <div class="automail-modal-header">
                <h3 class="automail-modal-title">${escapeHtml(title)}</h3>
                <button class="automail-modal-close">&times;</button>
            </div>
            <div class="automail-modal-body">
                ${content}
            </div>
            <div class="automail-modal-actions">
                ${buttons.map(btn => `
                    <button class="automail-btn-modal ${btn.class}" data-action="${btn.action || 'close'}">
                        ${escapeHtml(btn.text)}
                    </button>
                `).join('')}
            </div>
        </div>
    `;
    
    // Close modal handlers
    const closeModal = () => {
        modal.remove();
    };
    
    modal.querySelector('.automail-modal-close').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
    
    // Button handlers
    buttons.forEach((btn, index) => {
        const buttonEl = modal.querySelectorAll('.automail-btn-modal')[index];
        if (btn.action === 'close') {
            buttonEl.addEventListener('click', closeModal);
        } else if (typeof btn.action === 'function') {
            buttonEl.addEventListener('click', async () => {
                const result = await btn.action();
                if (result === true) {
                    closeModal();
                }
            });
        }
    });
    
    return modal;
}

/**
 * Create classification rule based on email
 */
async function createClassificationRule(emailId) {
    try {
        const ruleType = document.getElementById('rule-type').value;
        const ruleCategory = document.getElementById('rule-category').value;
        const ruleDescription = document.getElementById('rule-description').value;
        
        if (!ruleDescription.trim()) {
            updateStatus('Please enter a rule description', 'error');
            return;
        }
        
        console.log(`🔧 Creating classification rule for email ${emailId}`);
        showLoading('Creating rule...');
        
        const response = await chrome.runtime.sendMessage({
            action: 'createClassificationRule',
            emailId: emailId,
            ruleType: ruleType,
            category: ruleCategory,
            description: ruleDescription
        });
        
        if (response.success) {
            updateStatus('✅ Classification rule created', 'success');
            document.getElementById('automail-modal').remove();
        } else {
            throw new Error(response.error || 'Failed to create rule');
        }
        
    } catch (error) {
        console.error('❌ Error creating rule:', error);
        updateStatus(`Error creating rule: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
}

/**
 * Apply bulk edit to category emails
 */
async function applyBulkEdit(category) {
    try {
        const bulkAction = document.getElementById('bulk-action').value;
        const newCategory = document.getElementById('bulk-new-category')?.value;
        
        if (bulkAction === 'move' && !newCategory) {
            updateStatus('Please select a target category', 'error');
            return;
        }
        
        let confirmMessage = '';
        switch (bulkAction) {
            case 'move':
                confirmMessage = `Move all ${category} emails to ${newCategory}?`;
                break;
            case 'inbox':
                confirmMessage = `Move all ${category} emails back to inbox?`;
                break;
            case 'delete':
                confirmMessage = `Delete all ${category} emails? This cannot be undone!`;
                break;
        }
        
        if (!confirm(confirmMessage)) {
            return;
        }
        
        console.log(`🔄 Applying bulk edit: ${bulkAction} to ${category}`);
        showLoading('Applying bulk changes...');
        
        const response = await chrome.runtime.sendMessage({
            action: 'bulkEditEmails',
            category: category,
            bulkAction: bulkAction,
            newCategory: newCategory
        });
        
        if (response.success) {
            updateStatus(`✅ Bulk edit applied to ${response.emailCount} emails`, 'success');
            document.getElementById('automail-modal').remove();
            // Refresh the current view
            handleRefreshEmails();
        } else {
            throw new Error(response.error || 'Failed to apply bulk edit');
        }
        
    } catch (error) {
        console.error('❌ Error applying bulk edit:', error);
        updateStatus(`Error applying bulk edit: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
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

// Initialize when content script loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeAutomail);
} else {
    initializeAutomail();
}

/**
 * Update spam tab with cleaned spam emails
 */
async function updateSpamTab(cleanedEmails) {
    try {
        console.log('🗑️ Updating spam tab with cleaned emails:', cleanedEmails);
        
        // Update spam count
        const spamCountElement = document.getElementById('automail-spam-count');
        if (spamCountElement) {
            spamCountElement.textContent = `${cleanedEmails.length} emails cleaned`;
        }
        
        // Update spam tab display
        updateTabEmailDisplay('spam', cleanedEmails);
        
        console.log('✅ Spam tab updated successfully');
    } catch (error) {
        console.error('❌ Error updating spam tab:', error);
    }
}

/**
 * Update spam tab from stored data
 */
async function updateSpamTabFromStorage() {
    try {
        const data = await chrome.storage.local.get(['cleanedSpamEmails', 'lastSpamCleanup']);
        
        if (data.cleanedSpamEmails && data.cleanedSpamEmails.length > 0) {
            console.log('📧 Loading spam emails from storage:', data.cleanedSpamEmails.length);
            updateSpamTab(data.cleanedSpamEmails);
        } else {
            // Show empty state
            const spamCountElement = document.getElementById('automail-spam-count');
            if (spamCountElement) {
                spamCountElement.textContent = '0 emails';
            }
            updateTabEmailDisplay('spam', []);
        }
    } catch (error) {
        console.error('❌ Error loading spam emails from storage:', error);
    }
}

} catch (error) {
    console.error('Automail: Error in main wrapper:', error);
} 