/**
 * FIXED AUTOMAIL BACKGROUND SCRIPT
 * 
 * This is a complete rewrite that fixes the infinite processing loop issue.
 * The key fixes:
 * 1. Proper Gmail inbox querying - only fetch emails actually in inbox
 * 2. Streamlined processing cycle that doesn't reprocess moved emails
 * 3. Proper email movement out of inbox using Gmail API
 * 4. Clear state management to prevent loops
 * 5. Proper verification that emails are moved
 */

// AI API Configuration
const AI_API_CONFIG = {
  baseUrl: 'https://automail-ai-server-506990861082.us-east4.run.app',
  apiKey: 'automail-prod-key-2024',
  timeout: 10000,
  retryAttempts: 3,
  fallbackEnabled: true
};

// Processing state
let processingInterval = null;
let isProcessing = false;

// Extension lifecycle
chrome.runtime.onInstalled.addListener(() => {
  console.log('Automail extension installed');
  initializeExtension();
});

chrome.runtime.onStartup.addListener(() => {
  console.log('Automail extension started');
  initializeExtension();
});

/**
 * Initialize extension
 */
async function initializeExtension() {
  try {
    console.log('🚀 Initializing Fixed Automail...');
    
    await chrome.storage.local.set({
      isAuthenticated: false,
      isProcessing: false,
      emailsProcessed: 0,
      lastProcessingTime: 0
    });
    
    console.log('✅ Extension initialized');
  } catch (error) {
    console.error('❌ Error initializing extension:', error);
  }
}

/**
 * Handle messages from content script
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'login':
      handleLogin(sendResponse);
      return true;
    case 'logout':
      handleLogout(sendResponse);
      return true;
    case 'startProcessing':
      startEmailProcessing(sendResponse);
      return true;
    case 'stopProcessing':
      stopEmailProcessing(sendResponse);
      return true;
    case 'getStatus':
      getProcessingStatus(sendResponse);
      return true;
    default:
      sendResponse({ success: false, error: 'Unknown action' });
  }
});

/**
 * Handle login
 */
async function handleLogin(sendResponse) {
  try {
    console.log('🔐 Starting ENHANCED login with better error handling...');
    
    // Clear any existing auth data first
    console.log('🧹 Clearing existing auth data...');
    await chrome.storage.local.remove(['authToken', 'isAuthenticated', 'userProfile']);
    
    // Try to remove any cached tokens
    try {
      const cachedTokens = await chrome.identity.getAuthToken({ interactive: false });
      if (cachedTokens) {
        await chrome.identity.removeCachedAuthToken({ token: cachedTokens });
        console.log('🗑️ Removed cached token');
      }
    } catch (e) {
      console.log('No cached tokens to remove');
    }
    
    console.log('🔐 Requesting fresh OAuth token...');
    
    // Get OAuth token
    const authToken = await chrome.identity.getAuthToken({ 
      interactive: true
    });
    
    console.log('📧 OAuth token received, type:', typeof authToken);
    console.log('📧 Raw token:', authToken);
    
    // Extract token string from object if needed
    let tokenString = authToken;
    if (typeof authToken === 'object' && authToken !== null) {
      tokenString = authToken.token || authToken.access_token || authToken.accessToken;
      console.log('📧 Extracted token string from object');
    }
    
    console.log('📧 Token string length:', tokenString ? tokenString.length : 'null');
    
    if (!tokenString) {
      throw new Error('Failed to obtain valid auth token - user may have cancelled OAuth');
    }
    
    // Validate token with better error reporting
    console.log('🔍 Validating token with Gmail API...');
    const validationResult = await validateToken(tokenString);
    
    if (!validationResult.valid) {
      console.error('❌ Token validation details:', validationResult);
      throw new Error(`Token validation failed: ${validationResult.error}`);
    }
    
    console.log('✅ Token validated successfully');
    console.log('👤 User profile:', validationResult.profile?.emailAddress);
    
    // Store authentication
    await chrome.storage.local.set({
      authToken: tokenString,
      isAuthenticated: true,
      userProfile: validationResult.profile,
      lastLoginTime: Date.now()
    });
    
    console.log('✅ Login completed successfully');
    sendResponse({ success: true, profile: validationResult.profile });
    
  } catch (error) {
    console.error('❌ Login failed with error:', error);
    console.error('❌ Error stack:', error.stack);
    
    await chrome.storage.local.set({ 
      isAuthenticated: false,
      lastLoginError: error.message,
      lastLoginErrorTime: Date.now()
    });
    
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Handle logout
 */
async function handleLogout(sendResponse) {
  try {
    console.log('🔐 Logging out...');
    
    // Stop processing
    await stopProcessing();
    
    // Clear auth data
    await chrome.storage.local.remove(['authToken', 'isAuthenticated', 'userProfile']);
    
    console.log('✅ Logout successful');
    sendResponse({ success: true });
    
  } catch (error) {
    console.error('❌ Logout failed:', error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Validate auth token with Gmail API
 */
async function validateToken(token) {
  try {
    console.log('🔍 Validating token with Gmail API...');
    
    // Fix: Handle token as object or string
    let tokenString = token;
    if (typeof token === 'object' && token !== null) {
      tokenString = token.token || token.access_token || token.accessToken || JSON.stringify(token);
    }
    
    console.log('🔍 Token type:', typeof token);
    console.log('🔍 Token string starts with:', tokenString ? tokenString.substring(0, 20) + '...' : 'null');
    
          const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
        headers: { 
          'Authorization': `Bearer ${tokenString}`,
          'Content-Type': 'application/json'
        }
      });
    
    console.log('📡 Gmail API response status:', response.status);
    console.log('📡 Gmail API response headers:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Gmail API error response:', errorText);
      throw new Error(`Gmail API error ${response.status}: ${errorText}`);
    }
    
    const profile = await response.json();
    console.log('✅ Profile validation successful for:', profile.emailAddress);
    
    return { valid: true, profile };
    
  } catch (error) {
    console.error('❌ Token validation failed:', error);
    return { valid: false, error: error.message };
  }
}

/**
 * START PROCESSING - This is the main function that fixes the infinite loop
 */
async function startEmailProcessing(sendResponse) {
  try {
    console.log('🚀 Starting FIXED email processing...');
    
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
    await chrome.storage.local.set({ isProcessing: true });
    
    // Start processing cycle
    processingInterval = setInterval(() => {
      processEmailsCycle(authToken);
    }, 30000); // Process every 30 seconds
    
    // Run first cycle immediately
    await processEmailsCycle(authToken);
    
    console.log('✅ Email processing started');
    sendResponse({ success: true });
    
  } catch (error) {
    console.error('❌ Failed to start processing:', error);
    isProcessing = false;
    await chrome.storage.local.set({ isProcessing: false });
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * CORE PROCESSING CYCLE - This is the heart of the fix
 * 
 * The key insight: We only process emails that are currently in the inbox.
 * Once an email is moved out of the inbox, it won't appear in future inbox queries.
 * This prevents the infinite reprocessing loop.
 */
async function processEmailsCycle(authToken) {
  try {
    console.log('🔄 Running FIXED processing cycle...');
    
    // STEP 1: Get emails currently in inbox (and ONLY those in inbox)
    const inboxEmails = await getInboxEmails(authToken);
    
    if (inboxEmails.length === 0) {
      console.log('✅ No emails in inbox - all emails have been processed and moved!');
      return;
    }
    
    console.log(`📧 Found ${inboxEmails.length} emails still in inbox that need processing`);
    
    // STEP 2: Process each email
    let processedCount = 0;
    for (const email of inboxEmails) {
      try {
        console.log(`🔄 Processing email: "${email.subject.substring(0, 50)}"`);
        
        // Classify email
        const classification = await classifyEmail(email);
        console.log(`🏷️ Classified as: ${classification}`);
        
        // Move to appropriate folder (removes from inbox)
        await moveEmailToFolder(authToken, email, classification);
        
        processedCount++;
        console.log(`✅ Successfully moved email to ${classification} folder`);
        
        // Small delay to respect API limits
        await new Promise(resolve => setTimeout(resolve, 300));
        
      } catch (error) {
        console.error(`❌ Error processing email ${email.id}:`, error);
      }
    }
    
    console.log(`📊 Cycle complete: ${processedCount}/${inboxEmails.length} emails processed and moved out of inbox`);
    
    // Update stats
    await chrome.storage.local.set({
      lastProcessingTime: Date.now(),
      emailsProcessedInLastCycle: processedCount,
      totalEmailsProcessed: (await chrome.storage.local.get(['totalEmailsProcessed'])).totalEmailsProcessed + processedCount || processedCount
    });
    
  } catch (error) {
    console.error('❌ Error in processing cycle:', error);
  }
}

/**
 * Get emails currently in inbox
 * 
 * KEY FIX: We query Gmail with "in:inbox" which ONLY returns emails currently in the inbox.
 * Once emails are moved to folders (out of inbox), they won't appear in this query anymore.
 */
async function getInboxEmails(authToken) {
  try {
    // Query Gmail for emails in inbox ONLY
    const response = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages?q=in:inbox&maxResults=20',
      {
        headers: { 'Authorization': `Bearer ${authToken}` }
      }
    );
    
    if (!response.ok) {
      throw new Error(`Gmail API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.messages) {
      console.log('📭 No messages in inbox');
      return [];
    }
    
    console.log(`📧 Gmail returned ${data.messages.length} messages from inbox query`);
    
    // Get details for each email
    const emails = [];
    for (const message of data.messages) {
      const email = await getEmailDetail(authToken, message.id);
      if (email) {
        emails.push(email);
      }
    }
    
    return emails;
    
  } catch (error) {
    console.error('❌ Error getting inbox emails:', error);
    return [];
  }
}

/**
 * Get email detail
 */
async function getEmailDetail(authToken, messageId) {
  try {
    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}`,
      {
        headers: { 'Authorization': `Bearer ${authToken}` }
      }
    );
    
    if (!response.ok) {
      if (response.status === 404) {
        console.warn(`⚠️ Email ${messageId} not found (may have been deleted)`);
        return null;
      }
      throw new Error(`Gmail API error: ${response.status}`);
    }
    
    const message = await response.json();
    
    // Parse email
    const headers = message.payload.headers || [];
    const getHeader = (name) => {
      const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
      return header ? header.value : '';
    };
    
    const subject = getHeader('Subject') || '(No Subject)';
    const sender = getHeader('From') || '(Unknown)';
    const content = extractContent(message.payload);
    
    return {
      id: messageId,
      subject,
      sender,
      content: content.substring(0, 1000) // Limit content length
    };
    
  } catch (error) {
    console.error(`❌ Error getting email detail ${messageId}:`, error);
    return null;
  }
}

/**
 * Extract content from email payload
 */
function extractContent(payload) {
  try {
    if (payload.body && payload.body.data) {
      return decodeBase64(payload.body.data);
    }
    
    if (payload.parts) {
      for (const part of payload.parts) {
        if (part.mimeType === 'text/plain' && part.body && part.body.data) {
          return decodeBase64(part.body.data);
        }
      }
      
      // Try text/html if no plain text
      for (const part of payload.parts) {
        if (part.mimeType === 'text/html' && part.body && part.body.data) {
          return stripHtml(decodeBase64(part.body.data));
        }
      }
    }
    
    return '';
  } catch (error) {
    console.error('❌ Error extracting content:', error);
    return '';
  }
}

/**
 * Decode base64 content
 */
function decodeBase64(data) {
  try {
    return atob(data.replace(/-/g, '+').replace(/_/g, '/'));
  } catch (error) {
    return '';
  }
}

/**
 * Strip HTML tags
 */
function stripHtml(html) {
  try {
    return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
  } catch (error) {
    return html;
  }
}

/**
 * Classify email using AI or rules
 */
async function classifyEmail(email) {
  try {
    // Try AI classification first
    const aiResult = await callAIClassification(email.content, email.subject);
    if (aiResult.success) {
      return aiResult.classification;
    }
    
    // Fallback to rule-based classification
    return ruleBasedClassification(email.content, email.subject, email.sender);
    
  } catch (error) {
    console.error('❌ Error classifying email:', error);
    return 'General'; // Default classification
  }
}

/**
 * Call AI classification API
 */
async function callAIClassification(content, subject) {
  try {
    const response = await fetch(`${AI_API_CONFIG.baseUrl}/classify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': AI_API_CONFIG.apiKey
      },
      body: JSON.stringify({
        content: `Subject: ${subject}\n\n${content}`.substring(0, 1000)
      }),
      signal: AbortSignal.timeout(AI_API_CONFIG.timeout)
    });
    
    if (!response.ok) {
      throw new Error(`AI API error: ${response.status}`);
    }
    
    const result = await response.json();
    return { success: true, classification: result.label };
    
  } catch (error) {
    console.warn('⚠️ AI classification failed, using fallback:', error.message);
    return { success: false };
  }
}

/**
 * Rule-based classification fallback
 */
function ruleBasedClassification(content, subject, sender) {
  const text = `${subject} ${content} ${sender}`.toLowerCase();
  
  // Spam/Promotions patterns
  if (text.includes('unsubscribe') || text.includes('promotion') || 
      text.includes('deal') || text.includes('sale') || 
      text.includes('discount') || text.includes('offer') ||
      text.includes('free shipping') || text.includes('limited time')) {
    return 'Promotions';
  }
  
  // Work patterns
  if (text.includes('meeting') || text.includes('project') || 
      text.includes('deadline') || text.includes('report') ||
      text.includes('colleague') || text.includes('office') ||
      text.includes('conference') || text.includes('proposal')) {
    return 'Work';
  }
  
  // Personal patterns
  if (text.includes('family') || text.includes('friend') || 
      text.includes('personal') || text.includes('vacation') ||
      text.includes('birthday') || text.includes('wedding')) {
    return 'Personal';
  }
  
  // Updates/Notifications patterns
  if (text.includes('newsletter') || text.includes('update') || 
      text.includes('notification') || text.includes('alert') ||
      text.includes('reminder') || text.includes('confirm')) {
    return 'Updates';
  }
  
  return 'General';
}

/**
 * Move email to appropriate folder
 * 
 * KEY FIX: This function adds the appropriate label AND removes the INBOX label.
 * This ensures the email is moved out of the inbox and won't appear in future inbox queries.
 */
async function moveEmailToFolder(authToken, email, classification) {
  try {
    console.log(`📁 Moving email "${email.subject.substring(0, 30)}" to ${classification} folder...`);
    
    // Get or create label
    const labelName = `Automail-${classification}`;
    const labelId = await getOrCreateLabel(authToken, labelName);
    
    // CRITICAL: Move email by adding new label AND removing INBOX label
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
          removeLabelIds: ['INBOX'] // This is crucial - removes email from inbox
        })
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gmail API error ${response.status}: ${errorText}`);
    }
    
    console.log(`✅ Successfully moved email to ${labelName} folder and removed from inbox`);
    
    // Verify the move (optional but good for debugging)
    await verifyEmailMoved(authToken, email.id, labelId);
    
  } catch (error) {
    console.error(`❌ Error moving email to folder:`, error);
    throw error;
  }
}

/**
 * Verify email was actually moved (for debugging)
 */
async function verifyEmailMoved(authToken, messageId, expectedLabelId) {
  try {
    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}`,
      {
        headers: { 'Authorization': `Bearer ${authToken}` }
      }
    );
    
    if (response.ok) {
      const message = await response.json();
      const hasInbox = (message.labelIds || []).includes('INBOX');
      const hasExpectedLabel = (message.labelIds || []).includes(expectedLabelId);
      
      if (hasInbox) {
        console.warn(`⚠️ Email ${messageId} still has INBOX label after move!`);
      } else if (hasExpectedLabel) {
        console.log(`✅ Verified: Email ${messageId} successfully moved out of inbox`);
      }
    }
  } catch (error) {
    console.warn('Could not verify email move:', error);
  }
}

/**
 * Get or create Gmail label
 */
async function getOrCreateLabel(authToken, labelName) {
  try {
    // Get existing labels
    const response = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/labels',
      {
        headers: { 'Authorization': `Bearer ${authToken}` }
      }
    );
    
    if (!response.ok) {
      throw new Error(`Gmail API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Find existing label
    const existingLabel = data.labels.find(label => 
      label.name.toLowerCase() === labelName.toLowerCase()
    );
    
    if (existingLabel) {
      return existingLabel.id;
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
    console.log(`✅ Created new label: ${labelName}`);
    
    return newLabel.id;
    
  } catch (error) {
    console.error(`❌ Error getting/creating label ${labelName}:`, error);
    throw error;
  }
}

/**
 * Stop processing
 */
async function stopEmailProcessing(sendResponse) {
  try {
    console.log('🛑 Stopping email processing...');
    
    await stopProcessing();
    
    console.log('✅ Processing stopped');
    sendResponse({ success: true });
    
  } catch (error) {
    console.error('❌ Error stopping processing:', error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Internal stop processing
 */
async function stopProcessing() {
  if (processingInterval) {
    clearInterval(processingInterval);
    processingInterval = null;
  }
  
  isProcessing = false;
  await chrome.storage.local.set({ isProcessing: false });
}

/**
 * Get processing status
 */
async function getProcessingStatus(sendResponse) {
  try {
    const data = await chrome.storage.local.get([
      'isProcessing', 'emailsProcessedInLastCycle', 'lastProcessingTime', 'totalEmailsProcessed'
    ]);
    
    sendResponse({
      success: true,
      isProcessing: data.isProcessing || false,
      emailsProcessedInLastCycle: data.emailsProcessedInLastCycle || 0,
      lastProcessingTime: data.lastProcessingTime || 0,
      totalEmailsProcessed: data.totalEmailsProcessed || 0
    });
    
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
} 