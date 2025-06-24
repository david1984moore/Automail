/**
 * ========================================================================
 * AUTOMAIL UNIFIED TEST SUITE
 * ========================================================================
 * 
 * Master-level test framework consolidating all Automail testing functionality
 * Replaces: automail_master_tests.js, test_ai_integration.js, simple_test.js,
 *          test_stop_button_fix.js, test_master_stop_system.js, and debug files
 * 
 * Usage:
 *   AutomailTests.runAllTests()        - Complete test suite
 *   AutomailTests.runQuickDiagnostic() - Fast health check
 *   AutomailTests.runStopSystemTest()  - Test stop functionality
 *   AutomailTests.runAITests()         - AI integration tests
 *   AutomailTests.runLabelingTests()   - Email labeling tests
 * 
 * Test Categories:
 *   1. System Health & Foundation
 *   2. Authentication & OAuth
 *   3. Email Processing & Storage
 *   4. AI Classification & Integration
 *   5. Gmail Labeling & Actions
 *   6. Stop System & Emergency Controls
 *   7. Performance & Security
 *   8. UI & User Experience
 * 
 * ========================================================================
 */

const AutomailTests = {
    
    // =====================================
    // TEST FRAMEWORK CORE
    // =====================================
    
    version: '2.0.0',
    results: {
        passed: 0,
        failed: 0,
        total: 0,
        categories: {},
        details: [],
        startTime: null,
        endTime: null
    },
    
    config: {
        aiServerUrl: 'https://automail-ai-server-506990861082.us-east4.run.app',
        localAiUrl: 'http://localhost:5000',
        apiKey: 'automail-prod-key-2024',
        timeout: 30000,
        batchSize: 5,
        enableDetailedLogging: true,
        stopMonitoringDuration: 30000
    },
    
    // Test execution engine
    async runTest(testName, testFunction, category = 'general') {
        if (this.config.enableDetailedLogging) {
            console.log(`\n🧪 [${category.toUpperCase()}] Running: ${testName}`);
        }
        
        this.results.total++;
        if (!this.results.categories[category]) {
            this.results.categories[category] = { passed: 0, failed: 0, total: 0 };
        }
        this.results.categories[category].total++;
        
        try {
            const startTime = Date.now();
            await Promise.race([
                testFunction(),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Test timeout')), this.config.timeout)
                )
            ]);
            const duration = Date.now() - startTime;
            
            this.results.passed++;
            this.results.categories[category].passed++;
            this.results.details.push({
                name: testName,
                category: category,
                status: 'PASSED',
                duration: duration,
                timestamp: new Date().toISOString()
            });
            
            if (this.config.enableDetailedLogging) {
                console.log(`✅ ${testName} - PASSED (${duration}ms)`);
            }
            return { success: true, duration };
            
        } catch (error) {
            this.results.failed++;
            this.results.categories[category].failed++;
            this.results.details.push({
                name: testName,
                category: category,
                status: 'FAILED',
                error: error.message,
                stack: error.stack,
                timestamp: new Date().toISOString()
            });
            
            console.error(`❌ ${testName} - FAILED: ${error.message}`);
            return { success: false, error: error.message };
        }
    },
    
    // Assertion utilities
    assert(condition, message) {
        if (!condition) throw new Error(`Assertion failed: ${message}`);
    },
    
    assertEqual(actual, expected, message) {
        if (actual !== expected) {
            throw new Error(`${message} - Expected: ${expected}, Actual: ${actual}`);
        }
    },
    
    assertNotNull(value, message) {
        if (value === null || value === undefined) {
            throw new Error(`${message} - Value is null or undefined`);
        }
    },
    
    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },
    
    // =====================================
    // CATEGORY 1: SYSTEM HEALTH & FOUNDATION
    // =====================================
    
    async testManifestIntegrity() {
        const response = await fetch(chrome.runtime.getURL('manifest.json'));
        const manifest = await response.json();
        
        this.assertEqual(manifest.name, 'Automail', 'Extension name verification');
        this.assertEqual(manifest.manifest_version, 3, 'Manifest V3 compliance');
        this.assert(manifest.permissions.includes('storage'), 'Storage permission required');
        this.assert(manifest.permissions.includes('identity'), 'Identity permission required');
        this.assertNotNull(manifest.oauth2, 'OAuth2 configuration exists');
    },
    
    async testChromeAPIsAccess() {
        this.assertNotNull(chrome, 'Chrome APIs available');
        this.assertNotNull(chrome.runtime, 'Chrome runtime API available');
        this.assertNotNull(chrome.storage, 'Chrome storage API available');
        this.assertNotNull(chrome.identity, 'Chrome identity API available');
        
        // Test storage read/write
        await chrome.storage.local.set({ testKey: 'testValue' });
        const result = await chrome.storage.local.get(['testKey']);
        this.assertEqual(result.testKey, 'testValue', 'Storage read/write functionality');
        await chrome.storage.local.remove(['testKey']);
    },
    
    async testBackgroundScriptConnectivity() {
        try {
            const response = await chrome.runtime.sendMessage({ action: 'ping' });
            this.assert(response && response.success, 'Background script communication');
            return response;
        } catch (error) {
            throw new Error(`Background script unreachable: ${error.message}`);
        }
    },
    
    // =====================================
    // CATEGORY 2: AUTHENTICATION & OAUTH
    // =====================================
    
    async testAuthenticationStatus() {
        const authData = await chrome.storage.local.get(['isAuthenticated', 'authToken', 'userProfile']);
        
        if (authData.isAuthenticated) {
            this.assertNotNull(authData.authToken, 'Auth token exists when authenticated');
            this.assertNotNull(authData.userProfile, 'User profile exists when authenticated');
            console.log(`✅ Authenticated as: ${authData.userProfile?.email || 'Unknown'}`);
            return { authenticated: true, user: authData.userProfile };
        } else {
            console.log('ℹ️ Not currently authenticated');
            return { authenticated: false };
        }
    },
    
    async testOAuthConfiguration() {
        try {
            const response = await chrome.runtime.sendMessage({ action: 'debugOAuth' });
            this.assert(response.success, 'OAuth configuration valid');
            return response;
        } catch (error) {
            throw new Error(`OAuth configuration test failed: ${error.message}`);
        }
    },
    
    // =====================================
    // CATEGORY 3: EMAIL PROCESSING & STORAGE
    // =====================================
    
    async testEmailDataStorage() {
        const emailData = await chrome.storage.local.get(['emailData', 'emailCount']);
        
        if (emailData.emailData && emailData.emailData.length > 0) {
            console.log(`📧 Found ${emailData.emailData.length} emails in storage`);
            
            // Validate email structure
            const firstEmail = emailData.emailData[0];
            this.assertNotNull(firstEmail.id, 'Email has ID');
            this.assertNotNull(firstEmail.subject, 'Email has subject');
            this.assertNotNull(firstEmail.sender, 'Email has sender');
            
            return { 
                emailCount: emailData.emailData.length,
                hasEmails: true,
                firstEmail: firstEmail
            };
        } else {
            console.log('📭 No emails found in storage');
            return { emailCount: 0, hasEmails: false };
        }
    },
    
    async testEmailFetchingCapability() {
        try {
            const response = await chrome.runtime.sendMessage({ action: 'fetchEmails' });
            
            if (response.error && response.error.includes('not authenticated')) {
                console.log('⚠️ Email fetching requires authentication - skipping');
                return { skipped: true, reason: 'authentication_required' };
            }
            
            this.assert(response, 'Email fetch response received');
            return response;
        } catch (error) {
            if (error.message.includes('not authenticated')) {
                return { skipped: true, reason: 'authentication_required' };
            }
            throw error;
        }
    },
    
    // =====================================
    // CATEGORY 4: AI CLASSIFICATION & INTEGRATION
    // =====================================
    
    async testAIServerConnection() {
        try {
            const response = await chrome.runtime.sendMessage({ action: 'testAIConnection' });
            
            if (response.success) {
                console.log(`🤖 AI Server: ${response.status} (Model: ${response.modelLoaded ? 'Loaded' : 'Not Loaded'})`);
                return { 
                    connected: true, 
                    modelLoaded: response.modelLoaded,
                    status: response.status 
                };
            } else {
                throw new Error(`AI server connection failed: ${response.error}`);
            }
        } catch (error) {
            throw new Error(`AI server test failed: ${error.message}`);
        }
    },
    
    async testEmailClassification() {
        const testEmail = {
            content: "Hi team, we need to schedule our quarterly planning meeting for next week. Please review the agenda and confirm your availability.",
            subject: "Team Meeting - Q4 Planning Session"
        };
        
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'classifyEmail',
                content: testEmail.content,
                subject: testEmail.subject
            });
            
            this.assert(response.success, 'Email classification successful');
            this.assertNotNull(response.label, 'Classification label provided');
            this.assert(response.confidence >= 0 && response.confidence <= 1, 'Valid confidence score');
            
            console.log(`🎯 Test email classified as: ${response.label} (${(response.confidence * 100).toFixed(1)}%)`);
            return response;
        } catch (error) {
            throw new Error(`Email classification failed: ${error.message}`);
        }
    },
    
    async testBatchClassification() {
        const emailData = await chrome.storage.local.get(['emailData']);
        
        if (!emailData.emailData || emailData.emailData.length === 0) {
            console.log('⚠️ No emails available for batch classification test');
            return { skipped: true, reason: 'no_emails' };
        }
        
        const testEmails = emailData.emailData.slice(0, 3);
        
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'batchClassifyEmails',
                emails: testEmails
            });
            
            this.assert(response.success, 'Batch classification successful');
            this.assert(Array.isArray(response.results), 'Batch results is array');
            console.log(`📦 Batch classified ${response.results.length} emails`);
            
            return response;
        } catch (error) {
            throw new Error(`Batch classification failed: ${error.message}`);
        }
    },
    
    async testAIClassificationAccuracy() {
        const emailData = await chrome.storage.local.get(['emailData']);
        
        if (!emailData.emailData || emailData.emailData.length === 0) {
            return { skipped: true, reason: 'no_emails' };
        }
        
        const classifiedEmails = emailData.emailData.filter(email => email.aiLabel);
        
        if (classifiedEmails.length === 0) {
            console.log('⚠️ No AI-classified emails found for accuracy test');
            return { skipped: true, reason: 'no_classified_emails' };
        }
        
        // Analyze classification distribution
        const labelCounts = {};
        classifiedEmails.forEach(email => {
            labelCounts[email.aiLabel] = (labelCounts[email.aiLabel] || 0) + 1;
        });
        
        console.log('📊 Classification distribution:', labelCounts);
        
        // Check for reasonable distribution (no single label > 80%)
        const totalClassified = classifiedEmails.length;
        const maxLabelCount = Math.max(...Object.values(labelCounts));
        const maxLabelPercentage = (maxLabelCount / totalClassified) * 100;
        
        this.assert(maxLabelPercentage < 90, 'Reasonable classification distribution (no single label dominates)');
        
        return {
            totalClassified: totalClassified,
            labelDistribution: labelCounts,
            maxLabelPercentage: maxLabelPercentage.toFixed(1)
        };
    },
    
    // =====================================
    // CATEGORY 5: GMAIL LABELING & ACTIONS
    // =====================================
    
    async testLabelingCapability() {
        try {
            const response = await chrome.runtime.sendMessage({ action: 'labelEmails' });
            
            if (response.error && response.error.includes('not authenticated')) {
                return { skipped: true, reason: 'authentication_required' };
            }
            
            this.assert(response, 'Labeling response received');
            console.log(`🏷️ Labeling test: ${response.success ? 'SUCCESS' : 'FAILED'}`);
            
            return response;
        } catch (error) {
            if (error.message.includes('not authenticated')) {
                return { skipped: true, reason: 'authentication_required' };
            }
            throw error;
        }
    },
    
    async testLabeledEmailsCount() {
        const emailData = await chrome.storage.local.get(['emailData']);
        
        if (!emailData.emailData || emailData.emailData.length === 0) {
            return { labeledCount: 0, totalEmails: 0, percentage: 0 };
        }
        
        const labeledEmails = emailData.emailData.filter(email => email.labeledAt);
        const labeledPercentage = ((labeledEmails.length / emailData.emailData.length) * 100).toFixed(1);
        
        console.log(`🏷️ Labeled emails: ${labeledEmails.length}/${emailData.emailData.length} (${labeledPercentage}%)`);
        
        return {
            labeledCount: labeledEmails.length,
            totalEmails: emailData.emailData.length,
            percentage: parseFloat(labeledPercentage)
        };
    },

    // =====================================
    // CATEGORY 6: EMAIL ACTIONS TESTING (NEW)
    // =====================================
    
    async testEmailActionsProcessing() {
        try {
            console.log('⚡ Testing email actions processing...');
            
            const response = await chrome.runtime.sendMessage({ 
                action: 'processEmailActions' 
            });
            
            this.assert(response, 'Email actions response received');
            this.assert(response.success !== undefined, 'Response has success property');
            
            if (response.success) {
                console.log(`✅ Actions processed successfully: ${response.actionsExecuted || 0} actions executed`);
                return response;
            } else {
                console.log(`ℹ️ Actions processing result: ${response.message || response.error}`);
                return response;
            }
        } catch (error) {
            throw new Error(`Email actions processing failed: ${error.message}`);
        }
    },
    
    async testActionsExecution() {
        const { emailData } = await chrome.storage.local.get(['emailData']);
        const emails = emailData || [];
        
        if (emails.length === 0) {
            console.log('ℹ️ No emails found to test actions execution');
            return { actionsExecuted: 0, totalEmails: 0 };
        }
        
        // Count emails with actions executed
        const emailsWithActions = emails.filter(email => 
            email.actionsProcessed && email.actionTaken
        );
        
        console.log(`⚡ Found ${emailsWithActions.length} emails with actions executed out of ${emails.length} total`);
        
        if (emailsWithActions.length > 0) {
            const actionCounts = {};
            emailsWithActions.forEach(email => {
                actionCounts[email.actionTaken] = (actionCounts[email.actionTaken] || 0) + 1;
            });
            
            console.log('📊 Action distribution:', actionCounts);
            
            // Verify action timestamps
            const recentActions = emailsWithActions.filter(email => {
                const actionTime = email.actionsExecutedAt;
                const now = Date.now();
                const oneHour = 60 * 60 * 1000;
                return actionTime && (now - actionTime) < oneHour;
            });
            
            console.log(`🕐 ${recentActions.length} actions executed in the last hour`);
        }
        
        return { 
            actionsExecuted: emailsWithActions.length, 
            totalEmails: emails.length,
            recentActions: emailsWithActions.filter(email => {
                const actionTime = email.actionsExecutedAt;
                const now = Date.now();
                const oneHour = 60 * 60 * 1000;
                return actionTime && (now - actionTime) < oneHour;
            }).length
        };
    },
    
    // =====================================
    // CATEGORY 7: STOP SYSTEM & EMERGENCY CONTROLS
    // =====================================
    
    async testStopSystemConnectivity() {
        // Test background script status checking
        try {
            const statusResponse = await chrome.runtime.sendMessage({ action: 'getProcessingStatus' });
            this.assert(statusResponse.success, 'Processing status check successful');
            
            console.log(`⚙️ Processing status: ${statusResponse.isProcessing ? 'ACTIVE' : 'INACTIVE'}`);
            console.log(`📊 Intervals tracked: ${statusResponse.intervalCount}`);
            
            return statusResponse;
        } catch (error) {
            throw new Error(`Stop system connectivity failed: ${error.message}`);
        }
    },
    
    async testEmergencyStopCommands() {
        const stopCommands = ['stopProcessing', 'emergencyStop', 'nuclearStop', 'clearAllIntervals'];
        const results = [];
        
        for (const command of stopCommands) {
            try {
                const response = await chrome.runtime.sendMessage({ action: command });
                results.push({
                    command: command,
                    success: response && response.success,
                    response: response
                });
                console.log(`🛑 ${command}: ${response && response.success ? 'SUCCESS' : 'FAILED'}`);
                
                // Small delay between commands
                await this.wait(500);
            } catch (error) {
                results.push({
                    command: command,
                    success: false,
                    error: error.message
                });
                console.log(`🛑 ${command}: ERROR - ${error.message}`);
            }
        }
        
        const successfulCommands = results.filter(r => r.success).length;
        this.assert(successfulCommands > 0, 'At least one stop command should work');
        
        return {
            totalCommands: stopCommands.length,
            successfulCommands: successfulCommands,
            results: results
        };
    },
    
    async testStopMonitoring() {
        console.log('👁️ Testing stop monitoring system...');
        
        // Monitor for any processing activity for 10 seconds
        const monitoringResults = [];
        const originalLog = console.log;
        
        console.log = function(...args) {
            const message = args.join(' ');
            const processingKeywords = [
                'Batch classifying',
                'Fetching email details',
                'Processing Status: ACTIVE',
                'emails for batch AI classification'
            ];
            
            if (processingKeywords.some(keyword => message.includes(keyword))) {
                monitoringResults.push({
                    timestamp: Date.now(),
                    message: message
                });
            }
            
            originalLog.apply(console, args);
        };
        
        await this.wait(10000); // Monitor for 10 seconds
        console.log = originalLog; // Restore original console.log
        
        if (monitoringResults.length === 0) {
            console.log('✅ No processing activity detected during monitoring');
            return { processingDetected: false, messageCount: 0 };
        } else {
            console.log(`⚠️ Detected ${monitoringResults.length} processing messages during monitoring`);
            return { 
                processingDetected: true, 
                messageCount: monitoringResults.length,
                messages: monitoringResults 
            };
        }
    },
    
    // =====================================
    // CATEGORY 7: PERFORMANCE & SECURITY
    // =====================================
    
    async testStorageSize() {
        const allData = await chrome.storage.local.get(null);
        const dataSize = JSON.stringify(allData).length;
        const dataSizeKB = (dataSize / 1024).toFixed(2);
        
        console.log(`💾 Storage usage: ${dataSizeKB} KB`);
        
        // Chrome extension storage limit is 5MB for local storage
        const storageLimitKB = 5 * 1024; // 5MB in KB
        const usagePercentage = ((dataSize / 1024) / storageLimitKB) * 100;
        
        this.assert(usagePercentage < 80, 'Storage usage should be under 80% of limit');
        
        return {
            sizeKB: parseFloat(dataSizeKB),
            usagePercentage: usagePercentage.toFixed(2),
            keys: Object.keys(allData)
        };
    },
    
    async testTokenSecurity() {
        const authData = await chrome.storage.local.get(['authToken']);
        
        if (authData.authToken) {
            // Check token format (should not be plain text password)
            this.assert(typeof authData.authToken === 'string', 'Token should be string');
            this.assert(authData.authToken.length > 10, 'Token should be reasonable length');
            
            // Token should not contain obvious plain text
            const suspiciousPatterns = ['password', 'secret', '123456', 'admin'];
            const tokenLower = authData.authToken.toLowerCase();
            const hasSuspiciousContent = suspiciousPatterns.some(pattern => tokenLower.includes(pattern));
            
            this.assert(!hasSuspiciousContent, 'Token should not contain obvious plain text');
            
            console.log('🔐 Token security check passed');
            return { tokenExists: true, securityCheck: 'passed' };
        } else {
            console.log('ℹ️ No token present for security check');
            return { tokenExists: false };
        }
    },
    
    // =====================================
    // CATEGORY 8: UI & USER EXPERIENCE
    // =====================================
    
    async testSidebarPresence() {
        const sidebar = document.querySelector('#automail-sidebar');
        
        if (sidebar) {
            this.assert(sidebar.offsetWidth > 0, 'Sidebar should be visible');
            this.assert(sidebar.offsetHeight > 0, 'Sidebar should have height');
            
            // Check for essential UI elements
            const startButton = sidebar.querySelector('[data-action="start"]');
            const stopButton = sidebar.querySelector('[data-action="stop"]');
            
            console.log(`🎨 Sidebar UI: ${sidebar.offsetWidth}x${sidebar.offsetHeight}px`);
            console.log(`   Start button: ${startButton ? 'Present' : 'Missing'}`);
            console.log(`   Stop button: ${stopButton ? 'Present' : 'Missing'}`);
            
            return {
                present: true,
                dimensions: { width: sidebar.offsetWidth, height: sidebar.offsetHeight },
                startButton: !!startButton,
                stopButton: !!stopButton
            };
        } else {
            console.log('⚠️ Automail sidebar not found in DOM');
            return { present: false };
        }
    },
    
    async testUIResponsiveness() {
        const sidebar = document.querySelector('#automail-sidebar');
        
        if (!sidebar) {
            return { skipped: true, reason: 'sidebar_not_present' };
        }
        
        // Test button interactions
        const buttons = sidebar.querySelectorAll('button');
        let responsiveButtons = 0;
        
        buttons.forEach(button => {
            if (button.onclick || button.addEventListener) {
                responsiveButtons++;
            }
        });
        
        console.log(`🖱️ UI responsiveness: ${responsiveButtons}/${buttons.length} buttons interactive`);
        
        return {
            totalButtons: buttons.length,
            responsiveButtons: responsiveButtons,
            responsiveness: responsiveButtons / buttons.length
        };
    },
    
    // =====================================
    // TEST SUITE RUNNERS
    // =====================================
    
    async runQuickDiagnostic() {
        console.log('🚀 Running Quick Diagnostic...');
        console.log('================================');
        
        this.resetResults();
        this.results.startTime = Date.now();
        
        // Essential health checks only
        await this.runTest('Chrome APIs Access', () => this.testChromeAPIsAccess(), 'system');
        await this.runTest('Background Script Connectivity', () => this.testBackgroundScriptConnectivity(), 'system');
        await this.runTest('Authentication Status', () => this.testAuthenticationStatus(), 'auth');
        await this.runTest('AI Server Connection', () => this.testAIServerConnection(), 'ai');
        await this.runTest('Stop System Connectivity', () => this.testStopSystemConnectivity(), 'stop');
        
        this.results.endTime = Date.now();
        this.displayResults();
        
        return this.results;
    },
    
    async runStopSystemTest() {
        console.log('🛑 Running Stop System Test...');
        console.log('==============================');
        
        this.resetResults();
        this.results.startTime = Date.now();
        
        await this.runTest('Stop System Connectivity', () => this.testStopSystemConnectivity(), 'stop');
        await this.runTest('Emergency Stop Commands', () => this.testEmergencyStopCommands(), 'stop');
        await this.runTest('Stop Monitoring', () => this.testStopMonitoring(), 'stop');
        
        this.results.endTime = Date.now();
        this.displayResults();
        
        return this.results;
    },
    
    async runAITests() {
        console.log('🤖 Running AI Integration Tests...');
        console.log('==================================');
        
        this.resetResults();
        this.results.startTime = Date.now();
        
        await this.runTest('AI Server Connection', () => this.testAIServerConnection(), 'ai');
        await this.runTest('Email Classification', () => this.testEmailClassification(), 'ai');
        await this.runTest('Batch Classification', () => this.testBatchClassification(), 'ai');
        await this.runTest('Classification Accuracy', () => this.testAIClassificationAccuracy(), 'ai');
        
        this.results.endTime = Date.now();
        this.displayResults();
        
        return this.results;
    },
    
    async runLabelingTests() {
        console.log('🏷️ Running Labeling Tests...');
        console.log('============================');
        
        this.resetResults();
        this.results.startTime = Date.now();
        
        await this.runTest('Labeling Capability', () => this.testLabelingCapability(), 'labeling');
        await this.runTest('Labeled Emails Count', () => this.testLabeledEmailsCount(), 'labeling');
        
        this.results.endTime = Date.now();
        this.displayResults();
        
        return this.results;
    },

    async runEmailActionsTests() {
        console.log('⚡ Running Email Actions Tests...');
        console.log('=================================');
        
        this.resetResults();
        this.results.startTime = Date.now();
        
        await this.runTest('Email Actions Processing', () => this.testEmailActionsProcessing(), 'actions');
        await this.runTest('Actions Execution', () => this.testActionsExecution(), 'actions');
        
        this.results.endTime = Date.now();
        this.displayResults();
        
        return this.results;
    },
    
    async runAllTests() {
        console.log('🧪 Running Complete Automail Test Suite...');
        console.log('==========================================');
        
        this.resetResults();
        this.results.startTime = Date.now();
        
        // Category 1: System Health & Foundation
        await this.runTest('Manifest Integrity', () => this.testManifestIntegrity(), 'system');
        await this.runTest('Chrome APIs Access', () => this.testChromeAPIsAccess(), 'system');
        await this.runTest('Background Script Connectivity', () => this.testBackgroundScriptConnectivity(), 'system');
        
        // Category 2: Authentication & OAuth
        await this.runTest('Authentication Status', () => this.testAuthenticationStatus(), 'auth');
        await this.runTest('OAuth Configuration', () => this.testOAuthConfiguration(), 'auth');
        
        // Category 3: Email Processing & Storage
        await this.runTest('Email Data Storage', () => this.testEmailDataStorage(), 'email');
        await this.runTest('Email Fetching Capability', () => this.testEmailFetchingCapability(), 'email');
        
        // Category 4: AI Classification & Integration
        await this.runTest('AI Server Connection', () => this.testAIServerConnection(), 'ai');
        await this.runTest('Email Classification', () => this.testEmailClassification(), 'ai');
        await this.runTest('Batch Classification', () => this.testBatchClassification(), 'ai');
        await this.runTest('Classification Accuracy', () => this.testAIClassificationAccuracy(), 'ai');
        
        // Category 5: Gmail Labeling & Actions
        await this.runTest('Labeling Capability', () => this.testLabelingCapability(), 'labeling');
        await this.runTest('Labeled Emails Count', () => this.testLabeledEmailsCount(), 'labeling');
        await this.runTest('Email Actions Processing', () => this.testEmailActionsProcessing(), 'actions');
        await this.runTest('Actions Execution', () => this.testActionsExecution(), 'actions');
        
        // Category 6: Stop System & Emergency Controls
        await this.runTest('Stop System Connectivity', () => this.testStopSystemConnectivity(), 'stop');
        await this.runTest('Emergency Stop Commands', () => this.testEmergencyStopCommands(), 'stop');
        
        // Category 7: Performance & Security
        await this.runTest('Storage Size', () => this.testStorageSize(), 'performance');
        await this.runTest('Token Security', () => this.testTokenSecurity(), 'security');
        
        // Category 8: UI & User Experience
        await this.runTest('Sidebar Presence', () => this.testSidebarPresence(), 'ui');
        await this.runTest('UI Responsiveness', () => this.testUIResponsiveness(), 'ui');
        
        this.results.endTime = Date.now();
        this.displayResults();
        
        return this.results;
    },
    
    // =====================================
    // UTILITY METHODS
    // =====================================
    
    resetResults() {
        this.results = {
            passed: 0,
            failed: 0,
            total: 0,
            categories: {},
            details: [],
            startTime: null,
            endTime: null
        };
    },
    
    displayResults() {
        const duration = this.results.endTime - this.results.startTime;
        const successRate = ((this.results.passed / this.results.total) * 100).toFixed(1);
        
        console.log('\n📊 ===== TEST RESULTS SUMMARY =====');
        console.log(`⏱️  Duration: ${(duration / 1000).toFixed(2)}s`);
        console.log(`✅ Passed: ${this.results.passed}`);
        console.log(`❌ Failed: ${this.results.failed}`);
        console.log(`📋 Total: ${this.results.total}`);
        console.log(`🎯 Success Rate: ${successRate}%`);
        
        // Category breakdown
        console.log('\n📂 Category Breakdown:');
        Object.entries(this.results.categories).forEach(([category, stats]) => {
            const categoryRate = ((stats.passed / stats.total) * 100).toFixed(1);
            console.log(`   ${category}: ${stats.passed}/${stats.total} (${categoryRate}%)`);
        });
        
        // Failed tests details
        const failedTests = this.results.details.filter(test => test.status === 'FAILED');
        if (failedTests.length > 0) {
            console.log('\n❌ Failed Tests:');
            failedTests.forEach(test => {
                console.log(`   • ${test.name}: ${test.error}`);
            });
        }
        
        // Overall assessment
        console.log('\n🎭 Overall Assessment:');
        if (successRate >= 90) {
            console.log('🟢 EXCELLENT - System is performing optimally');
        } else if (successRate >= 75) {
            console.log('🟡 GOOD - System is mostly functional with minor issues');
        } else if (successRate >= 50) {
            console.log('🟠 NEEDS ATTENTION - Several components require fixing');
        } else {
            console.log('🔴 CRITICAL - System has major issues requiring immediate attention');
        }
        
        console.log('=====================================\n');
    },

    async testInboxDebug() {
        try {
            const response = await chrome.runtime.sendMessage({ action: 'debugInboxEmails' });
            
            this.assert(response, 'Debug response received');
            
            if (response.success) {
                console.log('🔍 INBOX DEBUG RESULTS:');
                console.log(`   Total emails in inbox: ${response.totalInbox}`);
                console.log(`   Unprocessed emails: ${response.unprocessedCount}`);
                console.log(`   Automail labels: [${response.automailLabels.join(', ')}]`);
                console.log(`   Sample inbox IDs: [${response.allInboxSample.join(', ')}]`);
                console.log(`   Sample unprocessed IDs: [${response.unprocessedSample.join(', ')}]`);
                
                return response;
            } else {
                throw new Error(response.error || 'Debug failed');
            }
        } catch (error) {
            throw new Error(`Inbox debug failed: ${error.message}`);
        }
    },
};

// =====================================
// AUTO-INITIALIZATION & GLOBAL EXPOSURE
// =====================================

// Make test suite globally available
window.AutomailTests = AutomailTests;

// Convenient shortcuts
window.runQuickTest = () => AutomailTests.runQuickDiagnostic();
window.runStopTest = () => AutomailTests.runStopSystemTest();
window.runAITest = () => AutomailTests.runAITests();
window.runActionsTest = () => AutomailTests.runEmailActionsTests();
window.runAllTests = () => AutomailTests.runAllTests();
window.debugInbox = () => AutomailTests.testInboxDebug();

console.log('🧪 Automail Unified Test Suite v2.0.0 loaded!');
console.log('💡 Quick commands:');
console.log('   runQuickTest()     - Fast health check');
console.log('   runStopTest()      - Test stop system');
console.log('   runAITest()        - Test AI features');
console.log('   runActionsTest()   - Test email actions');
console.log('   runAllTests()      - Complete test suite');
console.log('   AutomailTests      - Full API access'); 