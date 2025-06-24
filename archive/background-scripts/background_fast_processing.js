/**
 * FAST EMAIL PROCESSING BACKGROUND SCRIPT
 * 
 * Improved version with:
 * - Faster processing (all emails at once, not one by one)
 * - Better user feedback
 * - Simplified AI fallback
 * - Manual stop/start control
 */

console.log('🚀 Loading FAST email processing background script...');

// Processing state
let isProcessing = false;
let processingStats = {
  totalProcessed: 0,
  currentBatch: 0,
  errors: 0,
  startTime: null
};

// Extension lifecycle
chrome.runtime.onInstalled.addListener(() => {
  console.log('✅ Fast processing extension installed');
  chrome.storage.local.set({
    isAuthenticated: false,
    isProcessing: false,
    processingStats: processingStats
  });
});

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('📨 Received message:', request.action);
  
  switch (request.action) {
    case 'login':
      handleLogin(sendResponse);
      return true;
    case 'logout':
      handleLogout(sendResponse);
      return true;
    case 'startProcessing':
      startFastProcessing(sendResponse);
      return true;
    case 'stopProcessing':
      stopProcessing(sendResponse);
      return true;
    case 'getStatus':
      getProcessingStatus(sendResponse);
      return true;
    case 'reviewEmails':
      reviewProcessedEmails(sendResponse);
      return true;
    case 'getProcessedEmails':
      getProcessedEmails(request.category, request.forceRefresh, sendResponse);
      return true;
    case 'reclassifyEmail':
      reclassifyEmail(request.emailId, request.newCategory, request.reason, sendResponse);
      return true;
    case 'moveToInbox':
      moveEmailToInbox(request.emailId, sendResponse);
      return true;
    case 'deleteEmail':
      deleteEmail(request.emailId, sendResponse);
      return true;
    case 'testConnection':
      sendResponse({ 
        success: true, 
        message: 'Background script is working'
      });
      return true;
    default:
      console.warn('❓ Unknown action:', request.action);
      sendResponse({ success: false, error: 'Unknown action' });
  }
});

/**
 * Handle login with the working Chrome identity approach
 */
async function handleLogin(sendResponse) {
  try {
    console.log('🔐 Starting login...');
    
    // Clear any existing auth first
    await chrome.storage.local.remove(['authToken', 'isAuthenticated', 'userProfile']);
    
    // Clear cached tokens
    try {
      await new Promise((resolve) => {
        chrome.identity.clearAllCachedAuthTokens(() => resolve());
      });
    } catch (e) {
      console.log('ℹ️ No cached tokens to clear');
    }
    
    // Get OAuth token
    const authToken = await chrome.identity.getAuthToken({ 
      interactive: true
    });
    
    if (!authToken) {
      throw new Error('No auth token received');
    }
    
    // Handle token as object or string
    let tokenString = authToken;
    if (typeof authToken === 'object' && authToken !== null) {
      tokenString = authToken.token || authToken.access_token || authToken.accessToken;
    }
    
    // Test token with Gmail
    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
      headers: { 
        'Authorization': `Bearer ${tokenString}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Gmail API validation failed: ${response.status}`);
    }
    
    const profile = await response.json();
    
    // Store authentication
    await chrome.storage.local.set({
      authToken: tokenString,
      isAuthenticated: true,
      userProfile: profile,
      loginTime: Date.now()
    });
    
    console.log('✅ Login successful for:', profile.emailAddress);
    sendResponse({ success: true, profile: profile });
    
  } catch (error) {
    console.error('❌ Login failed:', error);
    await chrome.storage.local.set({ isAuthenticated: false });
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Handle logout
 */
async function handleLogout(sendResponse) {
  try {
    isProcessing = false;
    await chrome.storage.local.remove(['authToken', 'isAuthenticated', 'userProfile']);
    await chrome.storage.local.set({ isAuthenticated: false, isProcessing: false });
    
    try {
      await new Promise((resolve) => {
        chrome.identity.clearAllCachedAuthTokens(() => resolve());
      });
    } catch (e) {}
    
    console.log('✅ Logout successful');
    sendResponse({ success: true });
  } catch (error) {
    console.error('❌ Logout failed:', error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Start FAST email processing
 */
async function startFastProcessing(sendResponse) {
  try {
    console.log('🚀 Starting FAST email processing...');
    
    if (isProcessing) {
      sendResponse({ success: false, error: 'Processing already running' });
      return;
    }
    
    const { isAuthenticated, authToken } = await chrome.storage.local.get(['isAuthenticated', 'authToken']);
    
    if (!isAuthenticated || !authToken) {
      sendResponse({ success: false, error: 'Not authenticated' });
      return;
    }
    
    isProcessing = true;
    processingStats = {
      totalProcessed: 0,
      currentBatch: 0,
      errors: 0,
      startTime: Date.now()
    };
    
    await chrome.storage.local.set({ isProcessing: true, processingStats });
    
    console.log('✅ Fast processing started');
    sendResponse({ success: true });
    
    // Start processing immediately
    await processFastBatch(authToken);
    
    // Start real-time monitoring for new emails
    startRealtimeMonitoring(authToken);
    
  } catch (error) {
    console.error('❌ Failed to start processing:', error);
    isProcessing = false;
    await chrome.storage.local.set({ isProcessing: false });
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Process emails in batches quickly
 */
async function processFastBatch(authToken) {
  if (!isProcessing) return;
  
  try {
    console.log('🔄 Processing fast batch...');
    
    // Get ALL emails in inbox
    const inboxEmails = await getInboxEmails(authToken);
    
    if (inboxEmails.length === 0) {
      console.log('✅ No more emails in inbox - processing complete!');
      await stopProcessing();
      return;
    }
    
    console.log(`📧 Processing ${inboxEmails.length} emails in fast batch...`);
    
    // Process emails in parallel (faster)
    const promises = inboxEmails.map(async (email) => {
      try {
        // Quick classification (simplified)
        const classification = quickClassifyEmail(email);
        
        // Move to folder
        await moveEmailToFolder(authToken, email, classification);
        
        processingStats.totalProcessed++;
        console.log(`✅ Processed: "${email.subject}" → ${classification}`);
        
        return { success: true, classification };
      } catch (error) {
        processingStats.errors++;
        console.error(`❌ Error processing email "${email.subject}":`, error);
        return { success: false, error: error.message };
      }
    });
    
    // Wait for all emails to process
    const results = await Promise.all(promises);
    const successful = results.filter(r => r.success).length;
    
    console.log(`📊 Batch complete: ${successful}/${inboxEmails.length} emails processed`);
    
    // Update stats
    processingStats.currentBatch++;
    await chrome.storage.local.set({ processingStats });
    
    // Continue processing if there might be more emails
    if (isProcessing && successful > 0) {
      // Small delay then check for more
      setTimeout(() => processFastBatch(authToken), 2000);
    } else {
      console.log('✅ All emails processed!');
      await stopProcessing();
    }
    
  } catch (error) {
    console.error('❌ Error in fast processing batch:', error);
    processingStats.errors++;
    await chrome.storage.local.set({ processingStats });
  }
}

/**
 * Start real-time monitoring for new emails
 */
function startRealtimeMonitoring(authToken) {
  console.log('🔄 Starting real-time email monitoring...');
  
  // Clear any existing monitoring
  if (window.realtimeMonitorInterval) {
    clearInterval(window.realtimeMonitorInterval);
  }
  
  // Check for new emails every 30 seconds
  window.realtimeMonitorInterval = setInterval(async () => {
    if (!isProcessing) {
      console.log('⏹️ Processing stopped, clearing real-time monitoring');
      clearInterval(window.realtimeMonitorInterval);
      window.realtimeMonitorInterval = null;
      return;
    }
    
    try {
      console.log('🔍 Checking for new emails...');
      
      // Get current inbox emails
      const inboxEmails = await getInboxEmails(authToken);
      
      if (inboxEmails.length > 0) {
        console.log(`📬 Found ${inboxEmails.length} new emails in inbox - processing...`);
        
        // Process new emails
        for (const email of inboxEmails) {
          try {
            const classification = quickClassifyEmail(email);
            await moveEmailToFolder(authToken, email, classification);
            
            processingStats.totalProcessed++;
            console.log(`✅ Real-time processed: "${email.subject}" → ${classification}`);
            
            // Notify UI of new email processed
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
              if (tabs[0] && tabs[0].url.includes('mail.google.com')) {
                chrome.tabs.sendMessage(tabs[0].id, {
                  action: 'updateEmailDisplay'
                });
              }
            });
            
          } catch (error) {
            processingStats.errors++;
            console.error(`❌ Real-time processing error for "${email.subject}":`, error);
          }
        }
        
        // Update stats
        await chrome.storage.local.set({ processingStats });
        
      } else {
        console.log('📭 No new emails in inbox');
      }
      
    } catch (error) {
      console.error('❌ Error in real-time monitoring:', error);
    }
    
  }, 30000); // Check every 30 seconds
  
  console.log('✅ Real-time monitoring started (checking every 30 seconds)');
}

/**
 * Get emails in inbox
 */
async function getInboxEmails(authToken) {
  try {
    const response = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages?q=in:inbox&maxResults=50',
      { headers: { 'Authorization': `Bearer ${authToken}` } }
    );
    
    if (!response.ok) {
      throw new Error(`Gmail API error: ${response.status}`);
    }
    
    const data = await response.json();
    if (!data.messages || data.messages.length === 0) {
      return [];
    }
    
    // Get email details in parallel
    const emailPromises = data.messages.slice(0, 10).map(async (msg) => {
      const emailResponse = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`,
        { headers: { 'Authorization': `Bearer ${authToken}` } }
      );
      
      if (!emailResponse.ok) return null;
      
      const emailData = await emailResponse.json();
      const headers = emailData.payload.headers || [];
      
      return {
        id: emailData.id,
        subject: headers.find(h => h.name === 'Subject')?.value || 'No Subject',
        from: headers.find(h => h.name === 'From')?.value || 'Unknown Sender',
        snippet: emailData.snippet || ''
      };
    });
    
    const emails = await Promise.all(emailPromises);
    return emails.filter(email => email !== null);
    
  } catch (error) {
    console.error('❌ Error getting inbox emails:', error);
    return [];
  }
}

/**
 * Quick email classification (simplified, faster)
 */
function quickClassifyEmail(email) {
  const subject = email.subject.toLowerCase();
  const from = email.from.toLowerCase();
  const snippet = email.snippet.toLowerCase();
  
  // Quick rules-based classification
  if (subject.includes('security') || subject.includes('alert') || subject.includes('warning')) {
    return 'Security';
  }
  
  if (from.includes('noreply') || from.includes('no-reply') || subject.includes('newsletter')) {
    return 'Newsletter';
  }
  
  if (subject.includes('invoice') || subject.includes('payment') || subject.includes('billing')) {
    return 'Finance';
  }
  
  if (from.includes('support') || subject.includes('support') || subject.includes('help')) {
    return 'Support';
  }
  
  // Default to General
  return 'General';
}

/**
 * Move email to folder
 */
async function moveEmailToFolder(authToken, email, classification) {
  try {
    // Get or create label
    const labelId = await getOrCreateLabel(authToken, `Automail-${classification}`);
    
    // Move email
    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${email.id}/modify`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          addLabelIds: [labelId],
          removeLabelIds: ['INBOX']
        })
      }
    );
    
    if (!response.ok) {
      throw new Error(`Failed to move email: ${response.status}`);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error moving email:', error);
    throw error;
  }
}

/**
 * Get or create label
 */
async function getOrCreateLabel(authToken, labelName) {
  try {
    // Check if label exists
    const response = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/labels',
      { headers: { 'Authorization': `Bearer ${authToken}` } }
    );
    
    if (response.ok) {
      const data = await response.json();
      const existingLabel = data.labels.find(label => label.name === labelName);
      if (existingLabel) {
        return existingLabel.id;
      }
    }
    
    // Create new label
    const createResponse = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/labels',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: labelName,
          labelListVisibility: 'labelShow',
          messageListVisibility: 'show'
        })
      }
    );
    
    if (!createResponse.ok) {
      throw new Error(`Failed to create label: ${createResponse.status}`);
    }
    
    const labelData = await createResponse.json();
    return labelData.id;
    
  } catch (error) {
    console.error('❌ Error with label:', error);
    throw error;
  }
}

/**
 * Stop processing
 */
async function stopProcessing(sendResponse = null) {
  try {
    isProcessing = false;
    
    // Stop real-time monitoring
    if (window.realtimeMonitorInterval) {
      clearInterval(window.realtimeMonitorInterval);
      window.realtimeMonitorInterval = null;
      console.log('🔄 Real-time monitoring stopped');
    }
    
    const finalStats = {
      ...processingStats,
      endTime: Date.now(),
      duration: Date.now() - (processingStats.startTime || Date.now())
    };
    
    await chrome.storage.local.set({ 
      isProcessing: false,
      processingStats: finalStats
    });
    
    console.log('✅ Processing stopped. Final stats:', finalStats);
    
    if (sendResponse) {
      sendResponse({ success: true, stats: finalStats });
    }
  } catch (error) {
    console.error('❌ Error stopping processing:', error);
    if (sendResponse) {
      sendResponse({ success: false, error: error.message });
    }
  }
}

/**
 * Get processing status
 */
async function getProcessingStatus(sendResponse) {
  try {
    const { isProcessing: currentlyProcessing, processingStats: currentStats } = 
      await chrome.storage.local.get(['isProcessing', 'processingStats']);
    
    sendResponse({ 
      success: true, 
      isProcessing: currentlyProcessing,
      stats: currentStats || processingStats
    });
  } catch (error) {
    console.error('❌ Error getting status:', error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Initialize email review system
 */
async function reviewProcessedEmails(sendResponse) {
  try {
    console.log('🔍 Starting email review...');
    
    // Import the review system (simulate)
    const reviewSystem = new EmailReviewSystem();
    await reviewSystem.initialize();
    
    sendResponse({ 
      success: true, 
      message: 'Email review system initialized' 
    });
    
  } catch (error) {
    console.error('❌ Failed to start email review:', error);
    sendResponse({ 
      success: false, 
      error: error.message 
    });
  }
}

/**
 * EmailReviewSystem class (embedded)
 */
class EmailReviewSystem {
  constructor() {
    this.processedEmails = [];
    this.categories = ['Security', 'Newsletter', 'Finance', 'Support', 'General'];
    this.userCorrections = [];
  }

  async initialize() {
    console.log('🔍 Initializing Email Review System...');
    
    try {
      const { authToken } = await chrome.storage.local.get(['authToken']);
      if (!authToken) {
        throw new Error('Not authenticated');
      }

      // Gather processed emails
      await this.gatherProcessedEmails(authToken);
      
      // Analyze and display results
      this.analyzeClassifications();
      this.displayReviewDashboard();
      
      console.log('✅ Email Review System initialized');
      
    } catch (error) {
      console.error('❌ Failed to initialize review system:', error);
      throw error;
    }
  }

  async gatherProcessedEmails(authToken) {
    console.log('📧 Gathering processed emails...');
    
    this.processedEmails = [];
    
    for (const category of this.categories) {
      try {
        const labelName = `Automail-${category}`;
        const emails = await this.getEmailsInLabel(authToken, labelName);
        
        for (const email of emails) {
          email.currentCategory = category;
          email.confidence = this.calculateConfidence(email, category);
          email.needsReview = email.confidence < 0.7;
        }
        
        this.processedEmails.push(...emails);
        console.log(`📂 Found ${emails.length} emails in ${labelName}`);
        
      } catch (error) {
        console.error(`❌ Error gathering emails from ${category}:`, error);
      }
    }
    
    console.log(`📊 Total processed emails found: ${this.processedEmails.length}`);
  }

  async getEmailsInLabel(authToken, labelName) {
    try {
      // Get labels
      const labelsResponse = await fetch(
        'https://gmail.googleapis.com/gmail/v1/users/me/labels',
        { headers: { 'Authorization': `Bearer ${authToken}` } }
      );
      
      if (!labelsResponse.ok) return [];
      
      const labelsData = await labelsResponse.json();
      const label = labelsData.labels.find(l => l.name === labelName);
      
      if (!label) return [];
      
      // Get messages
      const messagesResponse = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?labelIds=${label.id}&maxResults=50`,
        { headers: { 'Authorization': `Bearer ${authToken}` } }
      );
      
      if (!messagesResponse.ok) return [];
      
      const messagesData = await messagesResponse.json();
      if (!messagesData.messages) return [];
      
      // Get email details
      const emailPromises = messagesData.messages.slice(0, 20).map(async (msg) => {
        try {
          const emailResponse = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`,
            { headers: { 'Authorization': `Bearer ${authToken}` } }
          );
          
          if (!emailResponse.ok) return null;
          
          const emailData = await emailResponse.json();
          const headers = emailData.payload.headers || [];
          
          return {
            id: emailData.id,
            subject: headers.find(h => h.name === 'Subject')?.value || 'No Subject',
            from: headers.find(h => h.name === 'From')?.value || 'Unknown Sender',
            snippet: emailData.snippet || ''
          };
          
        } catch (error) {
          return null;
        }
      });
      
      const emails = await Promise.all(emailPromises);
      return emails.filter(email => email !== null);
      
    } catch (error) {
      console.error(`❌ Error getting emails in label ${labelName}:`, error);
      return [];
    }
  }

  calculateConfidence(email, category) {
    const subject = email.subject.toLowerCase();
    const from = email.from.toLowerCase();
    const snippet = email.snippet.toLowerCase();
    
    let confidence = 0.5;
    
    switch (category) {
      case 'Security':
        if (subject.includes('security') || subject.includes('alert')) confidence += 0.3;
        break;
      case 'Newsletter':
        if (from.includes('noreply') || from.includes('newsletter')) confidence += 0.3;
        break;
      case 'Finance':
        if (subject.includes('invoice') || subject.includes('payment')) confidence += 0.3;
        break;
      case 'Support':
        if (subject.includes('support') || subject.includes('help')) confidence += 0.3;
        break;
      case 'General':
        confidence = 0.4;
        break;
    }
    
    return Math.min(confidence, 1.0);
  }

  analyzeClassifications() {
    this.analysisResults = {
      totalEmails: this.processedEmails.length,
      categoryBreakdown: {},
      lowConfidenceEmails: []
    };
    
    for (const category of this.categories) {
      const categoryEmails = this.processedEmails.filter(e => e.currentCategory === category);
      this.analysisResults.categoryBreakdown[category] = {
        count: categoryEmails.length,
        avgConfidence: categoryEmails.reduce((sum, e) => sum + e.confidence, 0) / categoryEmails.length || 0,
        needsReview: categoryEmails.filter(e => e.needsReview).length
      };
    }
    
    this.analysisResults.lowConfidenceEmails = this.processedEmails
      .filter(e => e.needsReview)
      .sort((a, b) => a.confidence - b.confidence);
    
    console.log('📈 Analysis complete:', this.analysisResults);
  }

  displayReviewDashboard() {
    console.log('🎛️ Displaying review dashboard...');
    
    // Send summary to content script for display
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].url.includes('mail.google.com')) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'showReviewResults',
          data: this.analysisResults
        });
      }
    });
  }
}

/**
 * Get processed emails for management interface
 */
async function getProcessedEmails(category, forceRefresh, sendResponse) {
  try {
    console.log(`📧 Getting processed emails for category: ${category}`);
    
    const { authToken } = await chrome.storage.local.get(['authToken']);
    if (!authToken) {
      throw new Error('Not authenticated');
    }
    
    const categories = category === 'all' ? 
      ['Security', 'Newsletter', 'Finance', 'Support', 'General'] : 
      [category];
    
    let allEmails = [];
    
    for (const cat of categories) {
      try {
        const labelName = `Automail-${cat}`;
        const emails = await getEmailsInLabel(authToken, labelName, 100); // Get more emails for management
        
        // Add category and confidence info
        emails.forEach(email => {
          email.currentCategory = cat;
          email.confidence = quickClassifyEmailConfidence(email, cat);
        });
        
        allEmails.push(...emails);
        
      } catch (error) {
        console.error(`❌ Error getting emails from ${cat}:`, error);
      }
    }
    
    // Sort by date (newest first)
    allEmails.sort((a, b) => new Date(b.internalDate) - new Date(a.internalDate));
    
    console.log(`📊 Retrieved ${allEmails.length} processed emails`);
    
    sendResponse({ 
      success: true, 
      emails: allEmails,
      category: category 
    });
    
  } catch (error) {
    console.error('❌ Error getting processed emails:', error);
    sendResponse({ 
      success: false, 
      error: error.message 
    });
  }
}

/**
 * Enhanced getEmailsInLabel with more details
 */
async function getEmailsInLabel(authToken, labelName, maxResults = 50) {
  try {
    // Get label ID
    const labelsResponse = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/labels',
      { headers: { 'Authorization': `Bearer ${authToken}` } }
    );
    
    if (!labelsResponse.ok) return [];
    
    const labelsData = await labelsResponse.json();
    const label = labelsData.labels.find(l => l.name === labelName);
    
    if (!label) return [];
    
    // Get messages
    const messagesResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?labelIds=${label.id}&maxResults=${maxResults}`,
      { headers: { 'Authorization': `Bearer ${authToken}` } }
    );
    
    if (!messagesResponse.ok) return [];
    
    const messagesData = await messagesResponse.json();
    if (!messagesData.messages) return [];
    
    // Get detailed email info
    const emailPromises = messagesData.messages.map(async (msg) => {
      try {
        const emailResponse = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`,
          { headers: { 'Authorization': `Bearer ${authToken}` } }
        );
        
        if (!emailResponse.ok) return null;
        
        const emailData = await emailResponse.json();
        const headers = emailData.payload.headers || [];
        
        return {
          id: emailData.id,
          threadId: emailData.threadId,
          subject: headers.find(h => h.name === 'Subject')?.value || 'No Subject',
          from: headers.find(h => h.name === 'From')?.value || 'Unknown Sender',
          to: headers.find(h => h.name === 'To')?.value || '',
          date: headers.find(h => h.name === 'Date')?.value || '',
          snippet: emailData.snippet || '',
          size: emailData.sizeEstimate || 0,
          labels: emailData.labelIds || [],
          internalDate: emailData.internalDate
        };
        
      } catch (error) {
        console.error(`❌ Error getting email ${msg.id}:`, error);
        return null;
      }
    });
    
    const emails = await Promise.all(emailPromises);
    return emails.filter(email => email !== null);
    
  } catch (error) {
    console.error(`❌ Error getting emails in label ${labelName}:`, error);
    return [];
  }
}

/**
 * Calculate confidence score for email classification
 */
function quickClassifyEmailConfidence(email, category) {
  const subject = email.subject.toLowerCase();
  const from = email.from.toLowerCase();
  const snippet = email.snippet.toLowerCase();
  
  let confidence = 0.5; // Base confidence
  
  switch (category) {
    case 'Security':
      if (subject.includes('security') || subject.includes('alert') || subject.includes('warning')) {
        confidence += 0.3;
      }
      if (from.includes('security') || from.includes('alert')) {
        confidence += 0.2;
      }
      break;
      
    case 'Newsletter':
      if (from.includes('noreply') || from.includes('no-reply') || from.includes('newsletter')) {
        confidence += 0.3;
      }
      if (subject.includes('newsletter') || snippet.includes('unsubscribe')) {
        confidence += 0.2;
      }
      break;
      
    case 'Finance':
      if (subject.includes('invoice') || subject.includes('payment') || subject.includes('billing')) {
        confidence += 0.3;
      }
      if (from.includes('billing') || from.includes('finance')) {
        confidence += 0.2;
      }
      break;
      
    case 'Support':
      if (subject.includes('support') || subject.includes('help')) {
        confidence += 0.3;
      }
      if (from.includes('support') || from.includes('help')) {
        confidence += 0.2;
      }
      break;
      
    case 'General':
      // General gets lower confidence since it's the fallback
      confidence = 0.4;
      break;
  }
  
  return Math.min(confidence, 1.0);
}

/**
 * Reclassify an email to a different category
 */
async function reclassifyEmail(emailId, newCategory, reason, sendResponse) {
  try {
    console.log(`🔄 Reclassifying email ${emailId} to ${newCategory}`);
    
    const { authToken } = await chrome.storage.local.get(['authToken']);
    if (!authToken) {
      throw new Error('Not authenticated');
    }
    
    // Get current labels for the email
    const emailResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${emailId}`,
      { headers: { 'Authorization': `Bearer ${authToken}` } }
    );
    
    if (!emailResponse.ok) {
      throw new Error(`Failed to get email: ${emailResponse.status}`);
    }
    
    const emailData = await emailResponse.json();
    const currentLabels = emailData.labelIds || [];
    
    // Find current Automail label to remove
    const labelsResponse = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/labels',
      { headers: { 'Authorization': `Bearer ${authToken}` } }
    );
    
    if (!labelsResponse.ok) {
      throw new Error(`Failed to get labels: ${labelsResponse.status}`);
    }
    
    const labelsData = await labelsResponse.json();
    const automailLabels = labelsData.labels.filter(l => l.name.startsWith('Automail-'));
    
    const currentAutomailLabel = automailLabels.find(l => currentLabels.includes(l.id));
    const newLabelId = await getOrCreateLabel(authToken, `Automail-${newCategory}`);
    
    // Prepare label changes
    const addLabelIds = [newLabelId];
    const removeLabelIds = currentAutomailLabel ? [currentAutomailLabel.id] : [];
    
    // Move the email
    const modifyResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${emailId}/modify`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          addLabelIds,
          removeLabelIds
        })
      }
    );
    
    if (!modifyResponse.ok) {
      throw new Error(`Failed to reclassify email: ${modifyResponse.status}`);
    }
    
    // Log the correction for learning
    const correction = {
      emailId,
      oldCategory: currentAutomailLabel ? currentAutomailLabel.name.replace('Automail-', '') : 'Unknown',
      newCategory,
      reason,
      timestamp: Date.now()
    };
    
    // Store correction
    const { userCorrections = [] } = await chrome.storage.local.get(['userCorrections']);
    userCorrections.push(correction);
    await chrome.storage.local.set({ userCorrections });
    
    console.log(`✅ Email reclassified successfully`);
    
    sendResponse({ 
      success: true,
      correction 
    });
    
  } catch (error) {
    console.error('❌ Error reclassifying email:', error);
    sendResponse({ 
      success: false, 
      error: error.message 
    });
  }
}

/**
 * Move an email back to inbox
 */
async function moveEmailToInbox(emailId, sendResponse) {
  try {
    console.log(`📥 Moving email ${emailId} back to inbox`);
    
    const { authToken } = await chrome.storage.local.get(['authToken']);
    if (!authToken) {
      throw new Error('Not authenticated');
    }
    
    // Get current labels
    const emailResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${emailId}`,
      { headers: { 'Authorization': `Bearer ${authToken}` } }
    );
    
    if (!emailResponse.ok) {
      throw new Error(`Failed to get email: ${emailResponse.status}`);
    }
    
    const emailData = await emailResponse.json();
    const currentLabels = emailData.labelIds || [];
    
    // Get all labels to find Automail labels
    const labelsResponse = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/labels',
      { headers: { 'Authorization': `Bearer ${authToken}` } }
    );
    
    if (!labelsResponse.ok) {
      throw new Error(`Failed to get labels: ${labelsResponse.status}`);
    }
    
    const labelsData = await labelsResponse.json();
    const automailLabels = labelsData.labels.filter(l => 
      l.name.startsWith('Automail-') && currentLabels.includes(l.id)
    );
    
    // Move back to inbox
    const modifyResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${emailId}/modify`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          addLabelIds: ['INBOX'],
          removeLabelIds: automailLabels.map(l => l.id)
        })
      }
    );
    
    if (!modifyResponse.ok) {
      throw new Error(`Failed to move email to inbox: ${modifyResponse.status}`);
    }
    
    console.log(`✅ Email moved back to inbox`);
    
    sendResponse({ success: true });
    
  } catch (error) {
    console.error('❌ Error moving email to inbox:', error);
    sendResponse({ 
      success: false, 
      error: error.message 
    });
  }
}

/**
 * Delete an email
 */
async function deleteEmail(emailId, sendResponse) {
  try {
    console.log(`🗑️ Deleting email ${emailId}`);
    
    const { authToken } = await chrome.storage.local.get(['authToken']);
    if (!authToken) {
      throw new Error('Not authenticated');
    }
    
    // Move to trash (Gmail's delete behavior)
    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${emailId}/trash`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` }
      }
    );
    
    if (!response.ok) {
      throw new Error(`Failed to delete email: ${response.status}`);
    }
    
    console.log(`✅ Email deleted (moved to trash)`);
    
    sendResponse({ success: true });
    
  } catch (error) {
    console.error('❌ Error deleting email:', error);
    sendResponse({ 
      success: false, 
      error: error.message 
    });
  }
}

console.log('✅ Fast email processing background script loaded'); 