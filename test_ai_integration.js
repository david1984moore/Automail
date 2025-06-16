/**
 * Debug script to test AI integration in Chrome Extension
 * Run this in the browser console to test AI functionality
 */

// Test AI connection
async function testAI() {
    console.log('🧪 Testing AI Integration...');
    
    try {
        // Test AI connection
        const connectionTest = await chrome.runtime.sendMessage({
            action: 'testAIConnection'
        });
        
        console.log('🔗 AI Connection Test:', connectionTest);
        
        if (connectionTest.success) {
            console.log('✅ AI Server is connected!');
            console.log(`   Model Loaded: ${connectionTest.modelLoaded}`);
            console.log(`   Status: ${connectionTest.status}`);
        } else {
            console.log('❌ AI Server connection failed:', connectionTest.error);
            return false;
        }
        
        // Test single email classification
        const testEmail = {
            content: "Hi team, we need to schedule our quarterly planning meeting for next week. Please review the agenda.",
            subject: "Team Meeting - Q4 Planning"
        };
        
        console.log('📧 Testing single email classification...');
        const classificationResult = await chrome.runtime.sendMessage({
            action: 'classifyEmail',
            content: testEmail.content,
            subject: testEmail.subject
        });
        
        console.log('🎯 Classification Result:', classificationResult);
        
        if (classificationResult.success) {
            console.log(`✅ Email classified as: ${classificationResult.label}`);
            console.log(`   Confidence: ${(classificationResult.confidence * 100).toFixed(1)}%`);
            console.log(`   Reasoning: ${classificationResult.reasoning}`);
            console.log(`   Method: ${classificationResult.method || 'unknown'}`);
        } else {
            console.log('❌ Classification failed:', classificationResult.error);
        }
        
        return true;
        
    } catch (error) {
        console.error('💥 AI test failed:', error);
        return false;
    }
}

// Check current email data and AI classifications
async function checkEmailData() {
    console.log('📊 Checking stored email data...');
    
    try {
        const data = await chrome.storage.local.get(['emailData', 'isProcessing', 'lastAIProcessing']);
        
        console.log(`📧 Total emails: ${data.emailData?.length || 0}`);
        console.log(`🔄 Processing active: ${data.isProcessing || false}`);
        console.log(`🤖 Last AI processing: ${data.lastAIProcessing ? new Date(data.lastAIProcessing).toLocaleString() : 'Never'}`);
        
        if (data.emailData?.length > 0) {
            const classifiedEmails = data.emailData.filter(email => email.aiLabel);
            console.log(`🎯 AI classified emails: ${classifiedEmails.length}`);
            
            if (classifiedEmails.length > 0) {
                console.log('🏷️ Classification breakdown:');
                const labelCounts = {};
                classifiedEmails.forEach(email => {
                    labelCounts[email.aiLabel] = (labelCounts[email.aiLabel] || 0) + 1;
                });
                
                Object.entries(labelCounts).forEach(([label, count]) => {
                    console.log(`   ${label}: ${count} emails`);
                });
                
                // Show first few classified emails
                console.log('📝 Sample classified emails:');
                classifiedEmails.slice(0, 3).forEach((email, index) => {
                    console.log(`   ${index + 1}. "${email.subject}" → ${email.aiLabel} (${(email.aiConfidence * 100).toFixed(1)}%)`);
                });
            } else {
                console.log('⚠️ No emails have AI classifications yet');
                
                // Check if emails have content
                const emailsWithContent = data.emailData.filter(email => email.content);
                console.log(`📄 Emails with content: ${emailsWithContent.length}`);
                
                if (emailsWithContent.length > 0) {
                    console.log('📝 Sample email content (first email):');
                    const firstEmail = emailsWithContent[0];
                    console.log(`   Subject: ${firstEmail.subject}`);
                    console.log(`   Content preview: ${(firstEmail.content || '').substring(0, 100)}...`);
                    console.log(`   Has aiLabel: ${!!firstEmail.aiLabel}`);
                }
            }
        } else {
            console.log('📭 No emails found in storage');
        }
        
        return data;
        
    } catch (error) {
        console.error('💥 Error checking email data:', error);
        return null;
    }
}

// Manually trigger AI processing
async function triggerAIProcessing() {
    console.log('🚀 Manually triggering AI processing...');
    
    try {
        // This should trigger the processEmailsWithAI function
        const data = await chrome.storage.local.get(['emailData']);
        
        if (!data.emailData || data.emailData.length === 0) {
            console.log('❌ No emails to process');
            return false;
        }
        
        console.log(`📧 Found ${data.emailData.length} emails to potentially classify`);
        
        // Filter emails without AI classification
        const unclassifiedEmails = data.emailData.filter(email => !email.aiLabel);
        console.log(`🆕 Unclassified emails: ${unclassifiedEmails.length}`);
        
        if (unclassifiedEmails.length === 0) {
            console.log('✅ All emails already classified');
            return true;
        }
        
        // Test batch classification
        const batchResult = await chrome.runtime.sendMessage({
            action: 'batchClassifyEmails',
            emails: unclassifiedEmails.slice(0, 3) // Test with first 3 emails
        });
        
        console.log('📦 Batch classification result:', batchResult);
        
        if (batchResult.success && batchResult.results) {
            console.log(`✅ Successfully classified ${batchResult.results.length} emails`);
            
            // Show results
            batchResult.results.forEach((result, index) => {
                console.log(`   ${index + 1}. ${result.label} (${(result.confidence * 100).toFixed(1)}%)`);
            });
            
            return true;
        } else {
            console.log('❌ Batch classification failed:', batchResult.error);
            return false;
        }
        
    } catch (error) {
        console.error('💥 Error triggering AI processing:', error);
        return false;
    }
}

// Run full diagnostic
async function runDiagnostics() {
    console.log('🔬 Running full AI integration diagnostics...');
    console.log('=' * 50);
    
    const connectionOk = await testAI();
    console.log('');
    
    await checkEmailData();
    console.log('');
    
    if (connectionOk) {
        await triggerAIProcessing();
    }
    
    console.log('');
    console.log('🏁 Diagnostics complete!');
    console.log('💡 If AI classifications still don\'t appear:');
    console.log('   1. Check if processing is active');
    console.log('   2. Try stopping and starting email processing');
    console.log('   3. Check the AI server is running (http://localhost:5000/health)');
    console.log('   4. Look for any console errors during processing');
}

// Test email labeling functionality
async function testLabeling() {
    console.log('🏷️ Testing Email Labeling...');
    
    try {
        // Check authentication first
        const authData = await chrome.storage.local.get(['isAuthenticated', 'authToken']);
        
        if (!authData.isAuthenticated || !authData.authToken) {
            console.log('❌ Not authenticated - cannot test labeling');
            return false;
        }
        
        console.log('✅ Authentication verified');
        
        // Test label fetching
        console.log('📋 Testing Gmail labels fetch...');
        const labelResult = await chrome.runtime.sendMessage({
            action: 'labelEmails'
        });
        
        console.log('🏷️ Labeling Result:', labelResult);
        
        if (labelResult.success) {
            console.log(`✅ Successfully labeled ${labelResult.labeled}/${labelResult.total} emails`);
            
            if (labelResult.errors && labelResult.errors.length > 0) {
                console.log(`⚠️ ${labelResult.errors.length} errors occurred:`);
                labelResult.errors.forEach((error, index) => {
                    console.log(`   ${index + 1}. ${error}`);
                });
            }
        } else {
            console.log('❌ Labeling failed:', labelResult.error);
            return false;
        }
        
        return true;
        
    } catch (error) {
        console.error('💥 Labeling test failed:', error);
        return false;
    }
}

// Check labeled emails in storage
async function checkLabeledEmails() {
    console.log('🔍 Checking labeled emails...');
    
    try {
        const data = await chrome.storage.local.get(['emailData']);
        
        if (!data.emailData || data.emailData.length === 0) {
            console.log('📭 No emails found in storage');
            return;
        }
        
        const labeledEmails = data.emailData.filter(email => email.aiLabel && email.labeledAt);
        console.log(`🏷️ Labeled emails: ${labeledEmails.length}/${data.emailData.length}`);
        
        if (labeledEmails.length > 0) {
            console.log('📊 Label distribution:');
            const labelCounts = {};
            labeledEmails.forEach(email => {
                labelCounts[email.aiLabel] = (labelCounts[email.aiLabel] || 0) + 1;
            });
            
            Object.entries(labelCounts).forEach(([label, count]) => {
                console.log(`   ${label}: ${count} emails`);
            });
            
            // Show recent labeled emails
            console.log('📝 Recently labeled emails:');
            const recentLabeled = labeledEmails
                .sort((a, b) => (b.labeledAt || 0) - (a.labeledAt || 0))
                .slice(0, 5);
                
            recentLabeled.forEach((email, index) => {
                const labeledTime = email.labeledAt ? new Date(email.labeledAt).toLocaleTimeString() : 'Unknown';
                console.log(`   ${index + 1}. "${email.subject}" → ${email.aiLabel} (${(email.aiConfidence * 100).toFixed(1)}%) at ${labeledTime}`);
            });
        } else {
            console.log('⚠️ No emails have been labeled yet');
            
            // Check if emails have AI classifications
            const classifiedEmails = data.emailData.filter(email => email.aiLabel);
            console.log(`🎯 Emails with AI classifications: ${classifiedEmails.length}`);
            
            if (classifiedEmails.length > 0) {
                console.log('💡 Emails are classified but not labeled in Gmail yet');
                console.log('   Try running: automailDebug.testLabeling()');
            }
        }
        
    } catch (error) {
        console.error('💥 Error checking labeled emails:', error);
    }
}

// Test the complete workflow: fetch → classify → label
async function testCompleteWorkflow() {
    console.log('🔄 Testing complete email workflow...');
    console.log('=' * 50);
    
    try {
        // Step 1: Check authentication
        console.log('1️⃣ Checking authentication...');
        const authData = await chrome.storage.local.get(['isAuthenticated', 'authToken']);
        
        if (!authData.isAuthenticated || !authData.authToken) {
            console.log('❌ Not authenticated - please login first');
            return false;
        }
        console.log('✅ Authenticated');
        
        // Step 2: Check AI connection
        console.log('2️⃣ Testing AI connection...');
        const aiTest = await testAI();
        if (!aiTest) {
            console.log('❌ AI connection failed - check server');
            return false;
        }
        console.log('✅ AI connected');
        
        // Step 3: Check email data
        console.log('3️⃣ Checking email data...');
        const emailData = await checkEmailData();
        if (!emailData || !emailData.emailData || emailData.emailData.length === 0) {
            console.log('❌ No emails found - try fetching emails first');
            return false;
        }
        console.log(`✅ Found ${emailData.emailData.length} emails`);
        
        // Step 4: Trigger AI processing (classification)
        console.log('4️⃣ Running AI classification...');
        const classificationResult = await triggerAIProcessing();
        if (!classificationResult) {
            console.log('❌ AI classification failed');
            return false;
        }
        console.log('✅ AI classification completed');
        
        // Step 5: Test labeling
        console.log('5️⃣ Testing email labeling...');
        const labelingResult = await testLabeling();
        if (!labelingResult) {
            console.log('❌ Email labeling failed');
            return false;
        }
        console.log('✅ Email labeling completed');
        
        // Step 6: Verify results
        console.log('6️⃣ Verifying results...');
        await checkLabeledEmails();
        
        console.log('');
        console.log('🎉 Complete workflow test successful!');
        console.log('💡 Check your Gmail to see the applied labels');
        
        return true;
        
    } catch (error) {
        console.error('💥 Complete workflow test failed:', error);
        return false;
    }
}

// Export functions for console use
window.automailDebug = {
    testAI,
    checkEmailData,
    triggerAIProcessing,
    runDiagnostics,
    testLabeling,
    checkLabeledEmails,
    testCompleteWorkflow
};

console.log('🧪 Automail AI Debug Tools loaded!');
console.log('💡 Usage:');
console.log('   automailDebug.runDiagnostics() - Run full test');
console.log('   automailDebug.testAI() - Test AI connection');
console.log('   automailDebug.checkEmailData() - Check email data');
console.log('   automailDebug.triggerAIProcessing() - Manual AI processing');
console.log('   automailDebug.testLabeling() - Test email labeling');
console.log('   automailDebug.checkLabeledEmails() - Check labeled emails');
console.log('   automailDebug.testCompleteWorkflow() - Test complete workflow'); 