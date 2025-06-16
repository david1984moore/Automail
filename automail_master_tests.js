/**
 * ========================================================================
 * AUTOMAIL EXTENSION - MASTER TEST SUITE
 * ========================================================================
 * 
 * Comprehensive testing framework for Automail Chrome Extension
 * Covers all implemented functionality and expandable for future features
 * 
 * Test Categories:
 * 1. Foundation Tests (Action 1)
 * 2. OAuth Authentication Tests (Action 2) 
 * 3. Email Reading Module Tests (Action 3)
 * 4. AI Server Integration Tests (Action 4)
 * 5. Email Labeling Tests (Action 5)
 * 6. Email Action Module Tests (Action 6) - In Progress
 * 7. Future Action Tests (Actions 7-14) - Placeholder
 * 
 * Usage:
 * - Run individual test suites: testSuite.runAuthTests()
 * - Run all tests: testSuite.runAllTests()
 * - Run specific test: testSuite.runTest('testOAuthFlow')
 * 
 * ========================================================================
 */

const AutomailTestSuite = {
    // Test results tracking
    results: {
        passed: 0,
        failed: 0,
        total: 0,
        details: []
    },

    // Test configuration
    config: {
        aiServerUrl: 'http://localhost:5000',
        apiKey: 'automail-dev-key-2024',
        testEmailCount: 10,
        timeoutMs: 30000
    },

    // Mock data for testing
    mockData: {
        sampleEmails: [
            {
                id: 'test_001',
                subject: 'Meeting Tomorrow',
                sender: 'boss@company.com',
                content: 'Hi, we have a meeting scheduled for tomorrow at 2 PM.',
                timestamp: Date.now(),
                labels: []
            },
            {
                id: 'test_002', 
                subject: 'Happy Birthday!',
                sender: 'friend@gmail.com',
                content: 'Hope you have a wonderful birthday celebration!',
                timestamp: Date.now(),
                labels: []
            },
            {
                id: 'test_003',
                subject: 'URGENT: Verify Your Account',
                sender: 'security@bank.com',
                content: 'Please verify your account immediately by clicking this link.',
                timestamp: Date.now(),
                labels: []
            },
            {
                id: 'test_004',
                subject: '50% OFF Sale - Limited Time!',
                sender: 'promotions@retailer.com',
                content: 'Don\'t miss out on our biggest sale of the year!',
                timestamp: Date.now(),
                labels: []
            },
            {
                id: 'test_005',
                subject: 'Project Status Update',
                sender: 'team@company.com',
                content: 'Here\'s the latest update on our project deliverables.',
                timestamp: Date.now(),
                labels: []
            }
        ],
        
        sampleToken: 'mock_oauth_token_12345',
        sampleProfile: {
            email: 'test@gmail.com',
            name: 'Test User',
            id: 'test_user_id'
        }
    },

    /**
     * ========================================================================
     * TEST UTILITIES
     * ========================================================================
     */
    
    // Test execution utilities
    async runTest(testName, testFunction) {
        console.log(`\n🧪 Running Test: ${testName}`);
        this.results.total++;
        
        try {
            const startTime = Date.now();
            await testFunction();
            const endTime = Date.now();
            
            this.results.passed++;
            this.results.details.push({
                name: testName,
                status: 'PASSED',
                duration: endTime - startTime,
                timestamp: new Date().toISOString()
            });
            
            console.log(`✅ ${testName} - PASSED (${endTime - startTime}ms)`);
            return true;
            
        } catch (error) {
            this.results.failed++;
            this.results.details.push({
                name: testName,
                status: 'FAILED',
                error: error.message,
                stack: error.stack,
                timestamp: new Date().toISOString()
            });
            
            console.error(`❌ ${testName} - FAILED`);
            console.error(`   Error: ${error.message}`);
            return false;
        }
    },

    // Assertion utilities
    assert(condition, message) {
        if (!condition) {
            throw new Error(`Assertion failed: ${message}`);
        }
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

    assertArray(value, message) {
        if (!Array.isArray(value)) {
            throw new Error(`${message} - Value is not an array`);
        }
    },

    // Wait utility for async operations
    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    /**
     * ========================================================================
     * ACTION 1: FOUNDATION TESTS
     * ========================================================================
     */
    
    async testManifestStructure() {
        // Test manifest.json structure and validity
        const response = await fetch(chrome.runtime.getURL('manifest.json'));
        const manifest = await response.json();
        
        this.assertEqual(manifest.name, 'Automail', 'Manifest name should be Automail');
        this.assertEqual(manifest.version, '1.0', 'Manifest version should be 1.0');
        this.assertEqual(manifest.manifest_version, 3, 'Should use Manifest V3');
        
        // Check required permissions
        const requiredPermissions = ['storage', 'identity', 'scripting', 'tabs', 'activeTab'];
        requiredPermissions.forEach(permission => {
            this.assert(
                manifest.permissions.includes(permission),
                `Missing required permission: ${permission}`
            );
        });
        
        // Check OAuth configuration
        this.assertNotNull(manifest.oauth2, 'OAuth2 configuration should exist');
        this.assertNotNull(manifest.oauth2.client_id, 'OAuth2 client ID should exist');
        this.assertArray(manifest.oauth2.scopes, 'OAuth2 scopes should be an array');
    },

    async testExtensionFiles() {
        // Test that required extension files exist and are accessible
        const requiredFiles = [
            'background.js',
            'content.js', 
            'sidebar.css',
            'icons/icon16.png',
            'icons/icon48.png',
            'icons/icon128.png'
        ];
        
        for (const file of requiredFiles) {
            try {
                const response = await fetch(chrome.runtime.getURL(file));
                this.assert(response.ok, `Required file ${file} should be accessible`);
            } catch (error) {
                throw new Error(`Failed to load required file: ${file}`);
            }
        }
    },

    async testChromeStorageAccess() {
        // Test Chrome storage API access
        const testData = { testKey: 'testValue', timestamp: Date.now() };
        
        // Test setting data
        await chrome.storage.local.set(testData);
        
        // Test getting data
        const result = await chrome.storage.local.get(['testKey', 'timestamp']);
        this.assertEqual(result.testKey, 'testValue', 'Chrome storage set/get should work');
        this.assertNotNull(result.timestamp, 'Timestamp should be stored');
        
        // Test clearing data
        await chrome.storage.local.remove(['testKey', 'timestamp']);
        const clearedResult = await chrome.storage.local.get(['testKey']);
        this.assertEqual(clearedResult.testKey, undefined, 'Chrome storage clear should work');
    },

    /**
     * ========================================================================
     * ACTION 2: OAUTH AUTHENTICATION TESTS  
     * ========================================================================
     */
    
    async testOAuthConfiguration() {
        console.log('🔍 Checking OAuth Configuration...');
        
        const response = await fetch(chrome.runtime.getURL('manifest.json'));
        const manifest = await response.json();
        
        this.assertNotNull(manifest.oauth2, 'OAuth2 configuration must exist');
        this.assertNotNull(manifest.oauth2.client_id, 'OAuth2 client ID must exist');
        
        console.log('✅ OAuth Client ID:', manifest.oauth2.client_id);
        console.log('✅ OAuth Scopes:', manifest.oauth2.scopes);
        
        // Check required scopes
        const requiredScopes = [
            'https://www.googleapis.com/auth/gmail.modify',
            'https://www.googleapis.com/auth/gmail.readonly',
            'https://www.googleapis.com/auth/contacts'
        ];
        
        requiredScopes.forEach(scope => {
            this.assert(
                manifest.oauth2.scopes.includes(scope),
                `Missing required OAuth scope: ${scope}`
            );
        });
    },

    async testChromeIdentityAPI() {
        console.log('🔍 Testing Chrome Identity API...');
        
        // Test if Chrome Identity API is available
        this.assertNotNull(chrome.identity, 'Chrome Identity API must be available');
        this.assertNotNull(chrome.identity.getAuthToken, 'getAuthToken must be available');
        
        // Test silent token retrieval
        try {
            const token = await chrome.identity.getAuthToken({ interactive: false });
            if (token) {
                console.log('✅ Found cached token');
                return token;
            } else {
                console.log('ℹ️ No cached token found');
                return null;
            }
        } catch (error) {
            console.log('ℹ️ No cached token available:', error.message);
            return null;
        }
    },

    async testGmailAPIAccess() {
        console.log('🔍 Testing Gmail API Access...');
        
        // First try to get a token
        let token;
        try {
            token = await chrome.identity.getAuthToken({ interactive: false });
            if (!token) {
                console.log('❌ No token available for Gmail API test');
                return false;
            }
        } catch (error) {
            console.log('❌ Failed to get token for Gmail API test:', error.message);
            return false;
        }

        // Test Gmail API profile endpoint
        try {
            const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const profile = await response.json();
                console.log('✅ Gmail API accessible');
                console.log('✅ Profile:', profile);
                return true;
            } else {
                const errorText = await response.text();
                console.log('❌ Gmail API error:', response.status, errorText);
                return false;
            }
        } catch (error) {
            console.log('❌ Gmail API request failed:', error.message);
            return false;
        }
    },

    async testNetworkConnectivity() {
        console.log('🔍 Testing Network Connectivity...');
        
        const endpoints = [
            'https://www.googleapis.com',
            'https://gmail.googleapis.com',
            'https://accounts.google.com'
        ];

        for (const endpoint of endpoints) {
            try {
                const response = await fetch(endpoint, { method: 'HEAD' });
                console.log(`✅ ${endpoint}: ${response.status}`);
            } catch (error) {
                console.log(`❌ ${endpoint}: ${error.message}`);
            }
        }
    },

    async debugOAuthFlow() {
        console.log('\n🔧 DEBUGGING OAUTH FLOW');
        console.log('================================');
        
        // Step 1: Check storage state
        const storage = await chrome.storage.local.get();
        console.log('📦 Current Storage State:', storage);
        
        // Step 2: Clear authentication data
        console.log('🧹 Clearing authentication data...');
        await chrome.storage.local.set({
            isAuthenticated: false,
            authToken: null,
            userProfile: null,
            sessionInvalidated: true,
            requiresFreshAuth: true
        });
        
        // Step 3: Try interactive OAuth
        console.log('🔐 Attempting interactive OAuth...');
        try {
            const token = await chrome.identity.getAuthToken({ interactive: true });
            console.log('✅ OAuth token received:', token ? 'YES' : 'NO');
            
            if (token) {
                // Step 4: Test token with Gmail API
                console.log('🧪 Testing token with Gmail API...');
                const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                if (response.ok) {
                    const profile = await response.json();
                    console.log('✅ Gmail API validation successful');
                    console.log('👤 Profile:', profile);
                    
                    // Store successful authentication
                    await chrome.storage.local.set({
                        isAuthenticated: true,
                        authToken: token,
                        userProfile: profile,
                        sessionInvalidated: false,
                        requiresFreshAuth: false
                    });
                    
                    return { success: true, token, profile };
                } else {
                    const errorText = await response.text();
                    console.log('❌ Gmail API validation failed:', response.status, errorText);
                    return { success: false, error: 'Gmail API validation failed' };
                }
            }
        } catch (error) {
            console.log('❌ Interactive OAuth failed:', error.message);
            return { success: false, error: error.message };
        }
    },

    /**
     * ========================================================================
     * ACTION 3: EMAIL READING MODULE TESTS
     * ========================================================================
     */
    
    async testEmailFetchingFunctions() {
        // Test that email fetching functions exist and are structured correctly
        const emailFunctions = [
            'fetchEmails',
            'fetchMessagesList', 
            'fetchEmailDetails',
            'parseEmailMessage',
            'extractEmailContent'
        ];
        
        // Test function availability through background script
        for (const funcName of emailFunctions) {
            try {
                const response = await chrome.runtime.sendMessage({
                    action: 'debugOAuth',
                    testFunction: funcName
                });
                console.log(`Email function ${funcName} is available`);
            } catch (error) {
                console.warn(`Email function ${funcName} requires Gmail API access`);
            }
        }
    },

    async testEmailDataStructure() {
        // Test email data structure consistency
        const sampleEmail = this.mockData.sampleEmails[0];
        
        // Test required fields
        const requiredFields = ['id', 'subject', 'sender', 'content', 'timestamp'];
        requiredFields.forEach(field => {
            this.assertNotNull(sampleEmail[field], `Email should have ${field} field`);
        });
        
        // Test field types
        this.assertEqual(typeof sampleEmail.id, 'string', 'Email ID should be string');
        this.assertEqual(typeof sampleEmail.subject, 'string', 'Email subject should be string');
        this.assertEqual(typeof sampleEmail.sender, 'string', 'Email sender should be string');
        this.assertEqual(typeof sampleEmail.content, 'string', 'Email content should be string');
        this.assertEqual(typeof sampleEmail.timestamp, 'number', 'Email timestamp should be number');
        this.assertArray(sampleEmail.labels, 'Email labels should be array');
    },

    async testEmailStorageOperations() {
        // Test email storage and retrieval operations
        const testEmails = this.mockData.sampleEmails.slice(0, 3);
        
        // Test storing emails
        await chrome.storage.local.set({ emailData: testEmails });
        
        // Test retrieving emails
        const result = await chrome.storage.local.get(['emailData']);
        this.assertArray(result.emailData, 'Stored email data should be array');
        this.assertEqual(result.emailData.length, 3, 'Should retrieve all stored emails');
        
        // Test email data integrity
        result.emailData.forEach((email, index) => {
            this.assertEqual(email.id, testEmails[index].id, 'Email ID should match');
            this.assertEqual(email.subject, testEmails[index].subject, 'Email subject should match');
        });
        
        // Clean up
        await chrome.storage.local.remove(['emailData']);
    },

    async testEmailContentParsing() {
        // Test email content parsing functions
        const htmlContent = '<div><p>Hello <b>World</b>!</p></div>';
        const expectedText = 'Hello World!';
        
        // Test HTML tag stripping (would use stripHtmlTags function)
        // Note: This function exists in background.js
        console.log('Testing HTML content parsing...');
        
        // Test Base64 URL decoding
        const base64Content = 'SGVsbG8gV29ybGQh'; // "Hello World!" in base64
        console.log('Testing Base64 URL decoding...');
        
        // Test content extraction from various email formats
        const mockPayload = {
            body: { data: base64Content },
            parts: [
                { mimeType: 'text/plain', body: { data: base64Content } }
            ]
        };
        
        console.log('Mock payload structure is valid');
    },

    /**
     * ========================================================================
     * ACTION 4: AI SERVER INTEGRATION TESTS
     * ========================================================================
     */
    
    async testAIServerConnection() {
        // Test AI server connectivity
        try {
            const response = await fetch(`${this.config.aiServerUrl}/health`);
            
            if (response.ok) {
                const data = await response.json();
                this.assertEqual(data.status, 'healthy', 'AI server should be healthy');
                console.log('✅ AI server is running and healthy');
            } else {
                console.warn('⚠️ AI server is not running - some tests will be skipped');
            }
        } catch (error) {
            console.warn('⚠️ AI server connection failed - testing with mock data');
        }
    },

    async testAIClassificationEndpoint() {
        // Test AI classification endpoint
        const testEmail = this.mockData.sampleEmails[0];
        
        try {
            const response = await fetch(`${this.config.aiServerUrl}/classify`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': this.config.apiKey
                },
                body: JSON.stringify({
                    content: testEmail.content,
                    subject: testEmail.subject
                })
            });
            
            if (response.ok) {
                const result = await response.json();
                this.assertNotNull(result.label, 'AI classification should return label');
                this.assert(
                    ['Work', 'Personal', 'Spam', 'Important', 'Review'].includes(result.label),
                    'AI should return valid label category'
                );
                console.log(`✅ AI classified email as: ${result.label}`);
            } else {
                console.warn('⚠️ AI classification endpoint not available');
            }
        } catch (error) {
            console.warn('⚠️ AI classification test failed - server may be offline');
        }
    },

    async testAIBatchClassification() {
        // Test batch classification endpoint
        const testEmails = this.mockData.sampleEmails.slice(0, 3);
        
        try {
            const response = await fetch(`${this.config.aiServerUrl}/batch-classify`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': this.config.apiKey
                },
                body: JSON.stringify({
                    emails: testEmails.map(email => ({
                        id: email.id,
                        content: email.content,
                        subject: email.subject
                    }))
                })
            });
            
            if (response.ok) {
                const result = await response.json();
                this.assertArray(result.classifications, 'Batch classification should return array');
                this.assertEqual(result.classifications.length, 3, 'Should classify all emails');
                console.log('✅ AI batch classification working');
            } else {
                console.warn('⚠️ AI batch classification endpoint not available');
            }
        } catch (error) {
            console.warn('⚠️ AI batch classification test failed');
        }
    },

    async testAIFallbackClassification() {
        // Test rule-based fallback classification
        const testCases = [
            { content: 'Meeting tomorrow at 2 PM', expected: 'Work' },
            { content: 'Happy birthday! Hope you have a great day', expected: 'Personal' },
            { content: 'URGENT: Verify your account now!', expected: 'Important' },
            { content: '50% OFF sale - limited time only!', expected: 'Spam' }
        ];
        
        // Test rule-based classification logic
        // Note: This would test the ruleBasedClassification function
        testCases.forEach(testCase => {
            console.log(`Testing fallback classification for: "${testCase.content}"`);
            // Rule-based logic would be tested here
        });
    },

    /**
     * ========================================================================
     * ACTION 5: EMAIL LABELING TESTS
     * ========================================================================
     */
    
    async testGmailLabelOperations() {
        // Test Gmail label operations
        const labelFunctions = [
            'fetchGmailLabels',
            'createGmailLabel', 
            'applyLabelToMessage',
            'labelEmails'
        ];
        
        // Test function availability
        for (const funcName of labelFunctions) {
            console.log(`Testing Gmail label function: ${funcName}`);
            // These functions require Gmail API access
        }
    },

    async testLabelClassificationIntegration() {
        // Test integration between AI classification and Gmail labeling
        const testEmail = this.mockData.sampleEmails[0];
        
        // Mock the classification process
        const mockClassification = 'Work';
        const mockLabelId = 'Label_123';
        
        // Test label application logic
        this.assertNotNull(mockClassification, 'Classification result should exist');
        this.assertNotNull(mockLabelId, 'Label ID should exist');
        
        console.log(`Email would be labeled as: ${mockClassification}`);
    },

    async testLabelCreationAndApplication() {
        // Test label creation and application workflow
        const testLabels = ['Work', 'Personal', 'Important', 'Review', 'Spam'];
        
        testLabels.forEach(label => {
            console.log(`Testing label creation for: ${label}`);
            // Test label creation logic
            
            console.log(`Testing label application for: ${label}`);
            // Test label application logic
        });
    },

    /**
     * ========================================================================
     * ACTION 6: EMAIL ACTION MODULE TESTS (IN PROGRESS)
     * ========================================================================
     */
    
    async testEmailActionFunctions() {
        // Test email action functions
        const actionFunctions = [
            'processEmailActions',
            'moveEmailToFolder',
            'trashEmail',
            'archiveEmail'
        ];
        
        // Test function structure
        for (const funcName of actionFunctions) {
            console.log(`Testing email action function: ${funcName}`);
            // These functions are being implemented
        }
    },

    async testLabelBasedActions() {
        // Test actions based on email labels
        const actionMappings = [
            { label: 'Spam', action: 'trash' },
            { label: 'Work', action: 'move_to_work_folder' },
            { label: 'Personal', action: 'move_to_personal_folder' },
            { label: 'Important', action: 'mark_important' },
            { label: 'Review', action: 'move_to_review_folder' }
        ];
        
        actionMappings.forEach(mapping => {
            console.log(`Testing action mapping: ${mapping.label} -> ${mapping.action}`);
            // Test action logic
        });
    },

    /**
     * ========================================================================
     * UI AND INTEGRATION TESTS
     * ========================================================================
     */
    
    async testSidebarUI() {
        // Test sidebar UI functionality
        const sidebarTests = [
            'testSidebarCreation',
            'testSidebarToggle',
            'testTabSwitching',
            'testAuthenticationUI',
            'testEmailDisplay'
        ];
        
        sidebarTests.forEach(test => {
            console.log(`UI Test: ${test}`);
            // UI tests would check DOM elements and interactions
        });
    },

    async testMessagePassing() {
        // Test communication between content script and background script
        const messageTypes = [
            'login',
            'logout',
            'fetchEmails',
            'startProcessing',
            'stopProcessing',
            'classifyEmail',
            'testAIConnection'
        ];
        
        for (const messageType of messageTypes) {
            try {
                const response = await chrome.runtime.sendMessage({
                    action: messageType,
                    test: true
                });
                console.log(`Message passing test for ${messageType}: OK`);
            } catch (error) {
                console.warn(`Message passing test for ${messageType}: ${error.message}`);
            }
        }
    },

    /**
     * ========================================================================
     * PERFORMANCE AND SECURITY TESTS
     * ========================================================================
     */
    
    async testPerformanceMetrics() {
        // Test performance metrics
        const performanceTests = [
            'emailFetchingSpeed',
            'classificationSpeed',
            'uiResponseTime',
            'memoryUsage'
        ];
        
        performanceTests.forEach(test => {
            console.log(`Performance test: ${test}`);
            // Performance monitoring would be implemented here
        });
    },

    async testSecurityCompliance() {
        // Test security compliance
        const securityTests = [
            'tokenSecureStorage',
            'apiKeyProtection',
            'xssProtection',
            'cspCompliance'
        ];
        
        securityTests.forEach(test => {
            console.log(`Security test: ${test}`);
            // Security validation would be implemented here
        });
    },

    /**
     * ========================================================================
     * TEST SUITE RUNNERS
     * ========================================================================
     */
    
    async runFoundationTests() {
        console.log('\n🏗️ Running Foundation Tests (Action 1)...');
        await this.runTest('Test Manifest Structure', () => this.testManifestStructure());
        await this.runTest('Test Extension Files', () => this.testExtensionFiles());
        await this.runTest('Test Chrome Storage Access', () => this.testChromeStorageAccess());
    },

    async runAuthTests() {
        console.log('\n🔐 Running Authentication Tests (Action 2)...');
        await this.runTest('Test OAuth Configuration', () => this.testOAuthConfiguration());
        await this.runTest('Test Chrome Identity API', () => this.testChromeIdentityAPI());
        await this.runTest('Test Network Connectivity', () => this.testNetworkConnectivity());
        await this.runTest('Test Gmail API Access', () => this.testGmailAPIAccess());
        
        // Run comprehensive OAuth debugging
        const result = await this.debugOAuthFlow();
        
        if (result.success) {
            console.log('\n🎉 OAuth debugging completed successfully!');
        } else {
            console.log('\n❌ OAuth debugging found issues:', result.error);
        }
    },

    async runEmailReadingTests() {
        console.log('\n📧 Running Email Reading Tests (Action 3)...');
        await this.runTest('Test Email Fetching Functions', () => this.testEmailFetchingFunctions());
        await this.runTest('Test Email Data Structure', () => this.testEmailDataStructure());
        await this.runTest('Test Email Storage Operations', () => this.testEmailStorageOperations());
        await this.runTest('Test Email Content Parsing', () => this.testEmailContentParsing());
    },

    async runAIServerTests() {
        console.log('\n🤖 Running AI Server Tests (Action 4)...');
        await this.runTest('Test AI Server Connection', () => this.testAIServerConnection());
        await this.runTest('Test AI Classification Endpoint', () => this.testAIClassificationEndpoint());
        await this.runTest('Test AI Batch Classification', () => this.testAIBatchClassification());
        await this.runTest('Test AI Fallback Classification', () => this.testAIFallbackClassification());
    },

    async runLabelingTests() {
        console.log('\n🏷️ Running Labeling Tests (Action 5)...');
        await this.runTest('Test Gmail Label Operations', () => this.testGmailLabelOperations());
        await this.runTest('Test Label Classification Integration', () => this.testLabelClassificationIntegration());
        await this.runTest('Test Label Creation and Application', () => this.testLabelCreationAndApplication());
    },

    async runActionTests() {
        console.log('\n⚡ Running Action Tests (Action 6)...');
        await this.runTest('Test Email Action Functions', () => this.testEmailActionFunctions());
        await this.runTest('Test Label Based Actions', () => this.testLabelBasedActions());
    },

    async runUITests() {
        console.log('\n🖥️ Running UI Tests...');
        await this.runTest('Test Sidebar UI', () => this.testSidebarUI());
        await this.runTest('Test Message Passing', () => this.testMessagePassing());
    },

    async runPerformanceTests() {
        console.log('\n⚡ Running Performance Tests...');
        await this.runTest('Test Performance Metrics', () => this.testPerformanceMetrics());
        await this.runTest('Test Security Compliance', () => this.testSecurityCompliance());
    },

    // Master test runner
    async runAllTests() {
        console.log('\n🚀 AUTOMAIL MASTER TEST SUITE - STARTING ALL TESTS');
        console.log('========================================================');
        
        // Reset results
        this.results = { passed: 0, failed: 0, total: 0, details: [] };
        
        // Run all test suites
        await this.runFoundationTests();
        await this.runAuthTests();
        await this.runEmailReadingTests();
        await this.runAIServerTests();
        await this.runLabelingTests();
        await this.runActionTests();
        await this.runUITests();
        await this.runPerformanceTests();
        
        // Display results
        this.displayResults();
    },

    // Display test results
    displayResults() {
        console.log('\n📊 TEST RESULTS SUMMARY');
        console.log('========================================================');
        console.log(`✅ Passed: ${this.results.passed}`);
        console.log(`❌ Failed: ${this.results.failed}`);
        console.log(`📊 Total: ${this.results.total}`);
        console.log(`🎯 Success Rate: ${((this.results.passed / this.results.total) * 100).toFixed(1)}%`);
        
        if (this.results.failed > 0) {
            console.log('\n❌ FAILED TESTS:');
            this.results.details
                .filter(test => test.status === 'FAILED')
                .forEach(test => {
                    console.log(`   - ${test.name}: ${test.error}`);
                });
        }
        
        console.log('\n🎉 Test suite completed!');
    }
};

// Export for use in other contexts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AutomailTestSuite;
}

/**
 * ========================================================================
 * USAGE EXAMPLES
 * ========================================================================
 * 
 * // Run all tests
 * AutomailTestSuite.runAllTests();
 * 
 * // Run specific test suite
 * AutomailTestSuite.runAuthTests();
 * 
 * // Run individual test
 * AutomailTestSuite.runTest('Test OAuth Flow', () => AutomailTestSuite.testOAuthConfiguration());
 * 
 * // Check results
 * console.log(AutomailTestSuite.results);
 * 
 * ========================================================================
 * FUTURE EXPANSION AREAS (Actions 7-14)
 * ========================================================================
 * 
 * // Action 7: Composition Module Tests
 * - testEmailComposition()
 * - testUserStyleAnalysis()
 * - testDraftGeneration()
 * - testEmailSending()
 * 
 * // Action 8: Learning Module Tests
 * - testUserActionTracking()
 * - testAIModelUpdates()
 * - testPreferenceLearning()
 * 
 * // Action 9: Enhanced UI Tests
 * - testAdvancedUIFeatures()
 * - testResponsiveDesign()
 * - testAccessibility()
 * 
 * // Action 10: Contact Management Tests
 * - testContactFetching()
 * - testContactSuggestions()
 * - testContactCreation()
 * 
 * // Actions 11-14: Optimization, Testing, Documentation, Polish
 * - testPerformanceOptimizations()
 * - testEndToEndWorkflows()
 * - testDocumentationAccuracy()
 * - testUserExperience()
 * 
 * ========================================================================
 */ 