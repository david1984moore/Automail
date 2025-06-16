// Simple Automail Labeling Test Script
// Paste this entire script into Chrome DevTools Console while on Gmail

console.log('🧪 Loading Automail Labeling Test...');

// Test AI connection
async function testAI() {
    console.log('🔗 Testing AI connection...');
    try {
        const result = await chrome.runtime.sendMessage({
            action: 'testAIConnection'
        });
        console.log('AI Test Result:', result);
        return result.success;
    } catch (error) {
        console.error('AI test failed:', error);
        return false;
    }
}

// Test email labeling
async function testLabeling() {
    console.log('🏷️ Testing email labeling...');
    try {
        const result = await chrome.runtime.sendMessage({
            action: 'labelEmails'
        });
        console.log('Labeling Result:', result);
        return result.success;
    } catch (error) {
        console.error('Labeling test failed:', error);
        return false;
    }
}

// Check email data
async function checkEmails() {
    console.log('📧 Checking email data...');
    try {
        const data = await chrome.storage.local.get(['emailData', 'isAuthenticated']);
        console.log(`Authenticated: ${data.isAuthenticated}`);
        console.log(`Total emails: ${data.emailData?.length || 0}`);
        
        if (data.emailData?.length > 0) {
            const labeled = data.emailData.filter(e => e.labeledAt);
            console.log(`Labeled emails: ${labeled.length}`);
            
            // Show label distribution
            const labels = {};
            labeled.forEach(e => {
                labels[e.aiLabel] = (labels[e.aiLabel] || 0) + 1;
            });
            console.log('Label distribution:', labels);
        }
        
        return data;
    } catch (error) {
        console.error('Error checking emails:', error);
        return null;
    }
}

// Run complete test
async function runTest() {
    console.log('🚀 Starting Automail Labeling Test...');
    console.log('=====================================');
    
    // Step 1: Check AI
    const aiOk = await testAI();
    if (!aiOk) {
        console.log('❌ AI test failed - stopping');
        return;
    }
    
    // Step 2: Check emails
    const emailData = await checkEmails();
    if (!emailData?.emailData?.length) {
        console.log('❌ No emails found - try fetching emails first');
        return;
    }
    
    // Step 3: Test labeling
    const labelingOk = await testLabeling();
    if (!labelingOk) {
        console.log('❌ Labeling test failed');
        return;
    }
    
    // Step 4: Check results
    console.log('📊 Final results:');
    await checkEmails();
    
    console.log('✅ Test complete! Check Gmail for new labels.');
}

// Make functions available globally
window.testAI = testAI;
window.testLabeling = testLabeling;
window.checkEmails = checkEmails;
window.runTest = runTest;

console.log('✅ Test script loaded!');
console.log('💡 Run: runTest() to start the complete test');
console.log('💡 Or run individual tests: testAI(), testLabeling(), checkEmails()'); 