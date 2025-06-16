// Debug script to check labeling status
// Run this in the background console (chrome://extensions/ → Automail → Inspect views: background page)

console.log('🔍 LABELING DEBUG SCRIPT');
console.log('========================');

async function debugLabelingStatus() {
    try {
        // Check stored email data
        const data = await chrome.storage.local.get(['emailData', 'isAuthenticated']);
        
        if (!data.isAuthenticated) {
            console.log('❌ Not authenticated');
            return;
        }
        
        const emails = data.emailData || [];
        console.log(`📊 Total emails in storage: ${emails.length}`);
        
        // Analyze email classifications and labeling
        const stats = {
            total: emails.length,
            classified: emails.filter(e => e.aiLabel).length,
            labeled: emails.filter(e => e.labeledAt).length,
            important: {
                aiClassified: emails.filter(e => e.aiLabel === 'Important').length,
                gmailLabeled: emails.filter(e => e.gmailLabels && e.gmailLabels.includes('Automail-Important')).length,
                bothClassifiedAndLabeled: emails.filter(e => e.aiLabel === 'Important' && e.labeledAt).length
            },
            review: {
                aiClassified: emails.filter(e => e.aiLabel === 'Review').length,
                gmailLabeled: emails.filter(e => e.gmailLabels && e.gmailLabels.includes('Automail-Review')).length,
                bothClassifiedAndLabeled: emails.filter(e => e.aiLabel === 'Review' && e.labeledAt).length
            }
        };
        
        console.log('📈 LABELING STATISTICS:');
        console.log('=======================');
        console.log(`📧 Total emails: ${stats.total}`);
        console.log(`🤖 AI classified: ${stats.classified}`);
        console.log(`🏷️ Gmail labeled: ${stats.labeled}`);
        console.log('');
        console.log('🔥 IMPORTANT EMAILS:');
        console.log(`   AI classified as Important: ${stats.important.aiClassified}`);
        console.log(`   Gmail labeled "Automail-Important": ${stats.important.gmailLabeled}`);
        console.log(`   Both classified AND labeled: ${stats.important.bothClassifiedAndLabeled}`);
        console.log('');
        console.log('📝 REVIEW EMAILS:');
        console.log(`   AI classified as Review: ${stats.review.aiClassified}`);
        console.log(`   Gmail labeled "Automail-Review": ${stats.review.gmailLabeled}`);
        console.log(`   Both classified AND labeled: ${stats.review.bothClassifiedAndLabeled}`);
        
        // Show sample emails for debugging
        console.log('');
        console.log('🔍 SAMPLE IMPORTANT EMAILS:');
        const importantSamples = emails.filter(e => e.aiLabel === 'Important').slice(0, 3);
        importantSamples.forEach((email, i) => {
            console.log(`   ${i+1}. Subject: "${email.subject}"`);
            console.log(`      AI Label: ${email.aiLabel}`);
            console.log(`      Labeled At: ${email.labeledAt ? new Date(email.labeledAt).toLocaleString() : 'Not labeled'}`);
            console.log(`      Gmail Labels: ${email.gmailLabels ? email.gmailLabels.join(', ') : 'None'}`);
            console.log('');
        });
        
        // Check if labeling is currently running
        const processingData = await chrome.storage.local.get(['isProcessing', 'lastLabelingAttempt']);
        console.log('⚙️ PROCESSING STATUS:');
        console.log(`   Currently processing: ${processingData.isProcessing || false}`);
        console.log(`   Last labeling attempt: ${processingData.lastLabelingAttempt ? new Date(processingData.lastLabelingAttempt).toLocaleString() : 'Never'}`);
        
        return stats;
        
    } catch (error) {
        console.error('❌ Debug error:', error);
    }
}

// Run the debug
debugLabelingStatus(); 