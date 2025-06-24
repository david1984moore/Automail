/**
 * CHROME IDENTITY ONLY BACKGROUND SCRIPT
 * 
 * Uses only Chrome's identity API since we now have the correct client ID
 */

console.log('🚀 Loading Chrome Identity Only background script...');

let isProcessing = false;

// Extension lifecycle
chrome.runtime.onInstalled.addListener(() => {
  console.log('✅ Chrome Identity extension installed');
  chrome.storage.local.set({
    isAuthenticated: false,
    isProcessing: false
  });
});

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('📨 Received message:', request.action);
  
  switch (request.action) {
    case 'login':
      handleChromeIdentityLogin(sendResponse);
      return true;
    case 'logout':
      handleLogout(sendResponse);
      return true;
    case 'startProcessing':
      handleStartProcessing(sendResponse);
      return true;
    case 'stopProcessing':
      handleStopProcessing(sendResponse);
      return true;
    case 'cleanSpamEmails':
      handleCleanSpamEmails(sendResponse);
      return true;
    case 'getStatus':
      sendResponse({ 
        success: true, 
        isProcessing: isProcessing,
        message: 'Status retrieved'
      });
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
 * Chrome Identity Login - Clean and Simple
 */
async function handleChromeIdentityLogin(sendResponse) {
  try {
    console.log('🔐 Starting Chrome Identity login...');
    
    // Clear any existing auth first
    await chrome.storage.local.remove(['authToken', 'isAuthenticated', 'userProfile']);
    
    // Clear any cached tokens to force fresh login
    try {
      console.log('🧹 Clearing cached tokens...');
      await new Promise((resolve) => {
        chrome.identity.clearAllCachedAuthTokens(() => {
          console.log('✅ Cached tokens cleared');
          resolve();
        });
      });
    } catch (e) {
      console.log('ℹ️ No cached tokens to clear');
    }
    
    console.log('🔐 Requesting fresh OAuth token...');
    
    // Get OAuth token
    const authToken = await chrome.identity.getAuthToken({ 
      interactive: true
    });
    
    console.log('✅ Auth token received, type:', typeof authToken);
    
    if (!authToken) {
      throw new Error('No auth token received from Chrome identity API');
    }
    
    // Handle token as object or string
    let tokenString = authToken;
    if (typeof authToken === 'object' && authToken !== null) {
      tokenString = authToken.token || authToken.access_token || authToken.accessToken;
    }
    
    if (!tokenString || tokenString.length < 10) {
      throw new Error('Invalid token received from Chrome identity API');
    }
    
    console.log('🧪 Testing token with Gmail API...');
    
    // Test the token with Gmail API
    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
      headers: { 
        'Authorization': `Bearer ${tokenString}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('📡 Gmail API response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Gmail API error response:', errorText);
      throw new Error(`Gmail API validation failed: ${response.status} - ${errorText}`);
    }
    
    const profile = await response.json();
    console.log('✅ Gmail API validation successful for:', profile.emailAddress);
    
    // Store authentication
    await chrome.storage.local.set({
      authToken: tokenString,
      isAuthenticated: true,
      userProfile: profile,
      loginTime: Date.now(),
      method: 'chrome-identity'
    });
    
    console.log('✅ Chrome Identity login completed successfully');
    sendResponse({ 
      success: true, 
      profile: profile,
      method: 'chrome-identity'
    });
    
  } catch (error) {
    console.error('❌ Chrome Identity login failed:', error);
    
    await chrome.storage.local.set({
      isAuthenticated: false,
      lastLoginError: error.message,
      lastLoginErrorTime: Date.now()
    });
    
    sendResponse({ 
      success: false, 
      error: error.message 
    });
  }
}

/**
 * Handle logout
 */
async function handleLogout(sendResponse) {
  try {
    console.log('🔐 Logging out...');
    
    isProcessing = false;
    
    // Clear auth data
    await chrome.storage.local.remove([
      'authToken', 
      'isAuthenticated', 
      'userProfile'
    ]);
    
    // Clear cached tokens
    try {
      await new Promise((resolve) => {
        chrome.identity.clearAllCachedAuthTokens(() => {
          resolve();
        });
      });
    } catch (e) {
      console.log('No tokens to clear on logout');
    }
    
    await chrome.storage.local.set({
      isAuthenticated: false,
      isProcessing: false
    });
    
    console.log('✅ Logout successful');
    sendResponse({ success: true });
    
  } catch (error) {
    console.error('❌ Logout failed:', error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Handle start processing
 */
async function handleStartProcessing(sendResponse) {
  try {
    console.log('🚀 Starting email processing...');
    
    // Check if already processing
    if (isProcessing) {
      console.log('⚠️ Already processing emails');
      sendResponse({ success: false, error: 'Already processing emails' });
      return;
    }
    
    // Check authentication
    const authData = await chrome.storage.local.get(['authToken', 'isAuthenticated']);
    if (!authData.isAuthenticated || !authData.authToken) {
      console.log('❌ Not authenticated');
      sendResponse({ success: false, error: 'Not authenticated. Please login first.' });
      return;
    }
    
    isProcessing = true;
    await chrome.storage.local.set({ isProcessing: true });
    
    console.log('✅ Email processing started');
    sendResponse({ success: true, message: 'Email processing started' });
    
    // Start the actual processing
    processEmails(authData.authToken);
    
  } catch (error) {
    console.error('❌ Error starting processing:', error);
    isProcessing = false;
    await chrome.storage.local.set({ isProcessing: false });
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Handle stop processing
 */
async function handleStopProcessing(sendResponse) {
  try {
    console.log('⏹️ Stopping email processing...');
    
    isProcessing = false;
    await chrome.storage.local.set({ isProcessing: false });
    
    console.log('✅ Email processing stopped');
    sendResponse({ success: true, message: 'Email processing stopped' });
    
  } catch (error) {
    console.error('❌ Error stopping processing:', error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Process emails (simplified version)
 */
async function processEmails(authToken) {
  try {
    console.log('📧 Starting to process emails...');
    
    // Get inbox emails
    const response = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages?q=in:inbox&maxResults=10',
      { headers: { 'Authorization': `Bearer ${authToken}` } }
    );
    
    if (!response.ok) {
      throw new Error(`Gmail API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.messages || data.messages.length === 0) {
      console.log('📭 No emails in inbox to process');
      isProcessing = false;
      await chrome.storage.local.set({ 
        isProcessing: false,
        lastProcessingResult: {
          success: true,
          message: 'Your inbox is already clean! No emails found to process.',
          timestamp: Date.now(),
          emailsProcessed: 0
        }
      });
      return;
    }
    
    console.log(`📬 Found ${data.messages.length} emails to process`);
    
    // Process each email
    for (const message of data.messages) {
      if (!isProcessing) break; // Stop if processing was cancelled
      
      try {
        await processEmail(authToken, message.id);
      } catch (error) {
        console.error(`❌ Error processing email ${message.id}:`, error);
      }
    }
    
    console.log('✅ Email processing completed');
    isProcessing = false;
    await chrome.storage.local.set({ 
      isProcessing: false,
      lastProcessingResult: {
        success: true,
        message: `Successfully processed ${data.messages.length} emails`,
        timestamp: Date.now(),
        emailsProcessed: data.messages.length
      }
    });
    
  } catch (error) {
    console.error('❌ Error in processEmails:', error);
    isProcessing = false;
    await chrome.storage.local.set({ isProcessing: false });
  }
}

/**
 * Process individual email
 */
async function processEmail(authToken, messageId) {
  try {
    // Get email details
    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}`,
      { headers: { 'Authorization': `Bearer ${authToken}` } }
    );
    
    if (!response.ok) {
      throw new Error(`Failed to get email: ${response.status}`);
    }
    
    const email = await response.json();
    const headers = email.payload.headers || [];
    
    const subject = headers.find(h => h.name === 'Subject')?.value || 'No Subject';
    const from = headers.find(h => h.name === 'From')?.value || 'Unknown';
    
    console.log(`📧 Processing: "${subject}" from ${from}`);
    
    // Simple classification
    const classification = classifyEmail(subject, from);
    
    // Move to appropriate folder
    await moveEmailToFolder(authToken, messageId, classification);
    
    console.log(`✅ Moved "${subject}" to ${classification}`);
    
  } catch (error) {
    console.error('❌ Error processing individual email:', error);
    throw error;
  }
}

/**
 * Simple email classification
 */
function classifyEmail(subject, from) {
  const subjectLower = subject.toLowerCase();
  const fromLower = from.toLowerCase();
  
  if (subjectLower.includes('security') || subjectLower.includes('alert')) {
    return 'Security';
  }
  
  if (fromLower.includes('noreply') || subjectLower.includes('newsletter')) {
    return 'Newsletter';
  }
  
  if (subjectLower.includes('invoice') || subjectLower.includes('payment')) {
    return 'Finance';
  }
  
  return 'General';
}

/**
 * Move email to folder
 */
async function moveEmailToFolder(authToken, messageId, classification) {
  try {
    // Get or create label
    const labelId = await getOrCreateLabel(authToken, `Automail-${classification}`);
    
    // Move email
    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`,
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
    
  } catch (error) {
    console.error('❌ Error moving email:', error);
    throw error;
  }
}

/**
 * Get or create Gmail label
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
    
    const newLabel = await createResponse.json();
    return newLabel.id;
    
  } catch (error) {
    console.error('❌ Error with label:', error);
    throw error;
  }
}

/**
 * Handle clean spam emails
 */
async function handleCleanSpamEmails(sendResponse) {
  try {
    console.log('🧹 Starting spam cleanup...');
    
    // Check authentication
    const authData = await chrome.storage.local.get(['authToken', 'isAuthenticated']);
    if (!authData.isAuthenticated || !authData.authToken) {
      console.log('❌ Not authenticated');
      sendResponse({ success: false, error: 'Not authenticated. Please login first.' });
      return;
    }
    
    const authToken = authData.authToken;
    let totalFound = 0;
    let totalCleaned = 0;
    let errors = [];
    
    try {
      console.log('🔍 Fetching spam emails...');
      
      // Get emails in SPAM folder
      const response = await fetch(
        'https://gmail.googleapis.com/gmail/v1/users/me/messages?q=in:spam&maxResults=500',
        { headers: { 'Authorization': `Bearer ${authToken}` } }
      );
      
      if (!response.ok) {
        throw new Error(`Gmail API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.messages || data.messages.length === 0) {
        console.log('📭 No spam emails found');
        sendResponse({ 
          success: true, 
          message: 'No spam emails found to clean',
          total: 0,
          cleaned: 0,
          errors: []
        });
        return;
      }
      
             totalFound = data.messages.length;
       console.log(`📬 Found ${totalFound} spam emails to delete`);
       
       let cleanedSpamEmails = [];
       
       // Get details and move each spam email to trash
       for (const message of data.messages) {
         try {
           // First, get email details before moving it
           const detailResponse = await fetch(
             `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}`,
             { headers: { 'Authorization': `Bearer ${authToken}` } }
           );
           
           let emailDetails = null;
           if (detailResponse.ok) {
             const emailData = await detailResponse.json();
             const headers = emailData.payload.headers || [];
             emailDetails = {
               id: message.id,
               subject: headers.find(h => h.name === 'Subject')?.value || 'No Subject',
               from: headers.find(h => h.name === 'From')?.value || 'Unknown Sender',
               snippet: emailData.snippet || '',
               cleanedAt: Date.now()
             };
           }
           
           // Then move it to trash
           const moveResponse = await fetch(
             `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}/modify`,
             {
               method: 'POST',
               headers: { 
                 'Authorization': `Bearer ${authToken}`,
                 'Content-Type': 'application/json'
               },
               body: JSON.stringify({
                 addLabelIds: ['TRASH'],
                 removeLabelIds: ['SPAM']
               })
             }
           );
           
           if (moveResponse.ok) {
             totalCleaned++;
             console.log(`🗑️ Moved spam email to trash: ${message.id}`);
             
             // Add to cleaned emails list if we got details
             if (emailDetails) {
               cleanedSpamEmails.push(emailDetails);
             }
           } else {
             const errorText = await moveResponse.text();
             console.error(`❌ Failed to move ${message.id}:`, errorText);
             errors.push(`Failed to move ${message.id}: ${errorText}`);
           }
           
         } catch (error) {
           console.error(`❌ Error moving spam email ${message.id}:`, error);
           errors.push(`Error moving ${message.id}: ${error.message}`);
         }
       }
      
             const successMessage = `Spam cleanup completed! Moved ${totalCleaned} of ${totalFound} emails to trash`;
       console.log(`✅ ${successMessage}`);
       
       // Store cleaned spam emails for UI display
       await chrome.storage.local.set({
         cleanedSpamEmails: cleanedSpamEmails,
         lastSpamCleanup: {
           timestamp: Date.now(),
           totalFound: totalFound,
           totalCleaned: totalCleaned,
           errors: errors
         }
       });
       
       sendResponse({
         success: true,
         message: successMessage,
         total: totalFound,
         cleaned: totalCleaned,
         errors: errors,
         cleanedEmails: cleanedSpamEmails
       });
      
    } catch (error) {
      console.error('❌ Error during spam cleanup:', error);
      sendResponse({
        success: false,
        error: error.message,
        total: totalFound,
        cleaned: totalCleaned,
        errors: errors
      });
    }
    
  } catch (error) {
    console.error('❌ Error handling spam cleanup:', error);
    sendResponse({ success: false, error: error.message });
  }
}

console.log('✅ Chrome Identity Only background script loaded'); 