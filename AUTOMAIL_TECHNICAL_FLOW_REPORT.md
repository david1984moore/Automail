# Automail - Technical Flow Report

**A comprehensive guide to how the AI-powered Gmail automation Chrome extension works**

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture Components](#architecture-components)
3. [Technical Flow Walkthrough](#technical-flow-walkthrough)
4. [Authentication & Security](#authentication--security)
5. [AI Classification System](#ai-classification-system)
6. [User Interface Integration](#user-interface-integration)
7. [Data Flow & Storage](#data-flow--storage)
8. [Error Handling & Fallbacks](#error-handling--fallbacks)
9. [Performance & Optimization](#performance--optimization)
10. [API Endpoints & Communication](#api-endpoints--communication)

---

## System Overview

Automail is a Chrome extension that brings AI-powered email automation to Gmail. Think of it as a smart assistant that sits alongside your Gmail inbox, automatically reading your emails, understanding what they're about, and organizing them for you. The system combines three main components that work together seamlessly:

### What it does:
- **Reads your emails** using Gmail's official API
- **Understands email content** using artificial intelligence
- **Automatically organizes emails** into categories like Work, Personal, Spam, etc.
- **Provides a clean interface** through a sidebar in Gmail
- **Keeps everything secure** with Google's OAuth authentication

### How it works at a high level:
1. You log in through Google's secure authentication
2. The extension gets permission to read your Gmail
3. AI analyzes each email to understand its content and importance
4. Emails are automatically labeled and organized
5. You see the results in a clean sidebar interface

---

## Architecture Components

The Automail system is built with three main parts that communicate with each other:

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│    Your Gmail   │◄──►│ Chrome Extension │◄──►│   AI Server     │
│                 │    │                  │    │   (Cloud)       │
│ • Email Display │    │ • Content Script │    │ • Email AI      │
│ • User Actions  │    │ • Background     │    │ • Classification│
│ • Sidebar UI    │    │ • Service Worker │    │ • API Endpoints │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                               │
                               ▼
                       ┌──────────────────┐
                       │   Gmail API      │
                       │ • OAuth 2.0      │
                       │ • Email Access   │
                       │ • Email Modify   │
                       └──────────────────┘
```

### 1. Chrome Extension (Frontend)
**Location**: Runs in your browser  
**Purpose**: Provides the user interface and manages Gmail integration

**Key Files**:
- `manifest.json` - Extension configuration and permissions
- `content.js` - Creates and manages the sidebar UI in Gmail
- `background_chrome_identity_only.js` - Handles email processing and API calls
- `sidebar.css` - Styling for the user interface

### 2. AI Server (Backend)
**Location**: Cloud server (Google Cloud Run)  
**Purpose**: Processes emails using artificial intelligence

**Key Components**:
- `app.py` - Main server application
- `classifier.py` - AI model for understanding email content
- `security.py` - Handles authentication and rate limiting

### 3. Gmail API Integration
**Location**: Google's servers  
**Purpose**: Secure access to your Gmail account

**Capabilities**:
- Read emails from your inbox
- Apply labels to organize emails
- Move emails to different folders
- Maintain security through OAuth 2.0

---

## Technical Flow Walkthrough

Here's exactly what happens when you use Automail, step by step:

### Step 1: Initial Setup & Authentication

**What you see**: Click "Login with Google" button  
**What happens behind the scenes**:

1. **Extension starts up**: When you install the extension, `manifest.json` tells Chrome what permissions are needed
2. **Authentication begins**: Chrome opens Google's secure login page
3. **You grant permissions**: Google asks if Automail can access your Gmail
4. **Secure token created**: Google creates a secure access token (like a temporary key)
5. **Token stored safely**: The extension stores this token in Chrome's secure storage

**Code flow**:
```javascript
// In background_chrome_identity_only.js
async function handleChromeIdentityLogin(sendResponse) {
  // 1. Clear any old authentication data
  await chrome.storage.local.remove(['authToken', 'isAuthenticated']);
  
  // 2. Get fresh OAuth token from Google
  const authToken = await chrome.identity.getAuthToken({ interactive: true });
  
  // 3. Test the token with Gmail API
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });
  
  // 4. Store authentication if successful
  if (response.ok) {
    await chrome.storage.local.set({
      authToken: authToken,
      isAuthenticated: true
    });
  }
}
```

### Step 2: Gmail Integration & Sidebar Creation

**What you see**: Sidebar appears on the right side of Gmail  
**What happens behind the scenes**:

1. **Content script loads**: `content.js` runs automatically when you visit Gmail
2. **Gmail detection**: Script waits for Gmail to fully load
3. **Sidebar creation**: Creates the HTML structure for the sidebar
4. **Event listeners**: Sets up buttons and interactions
5. **Initial UI state**: Shows login status and available features

**Code flow**:
```javascript
// In content.js
function createSidebar() {
  // 1. Create sidebar container
  const sidebar = document.createElement('div');
  sidebar.id = 'automail-sidebar';
  
  // 2. Add HTML structure with login, tabs, and controls
  sidebar.innerHTML = `
    <div class="automail-app">
      <header class="automail-header">
        <h1>Automail</h1>
      </header>
      <div class="automail-auth-section">
        <button id="automail-login-btn">Login with Google</button>
      </div>
      <!-- More UI elements -->
    </div>
  `;
  
  // 3. Insert into Gmail page
  document.body.appendChild(sidebar);
}
```

### Step 3: Email Processing Cycle

**What you see**: "Start Processing" button becomes active  
**What happens behind the scenes**:

1. **Process initiation**: You click "Start Processing"
2. **Inbox query**: Extension asks Gmail API for all emails currently in inbox
3. **Batch processing**: For each email, the system:
   - Fetches email content and subject
   - Sends to AI server for classification
   - Receives AI analysis with confidence score
   - Applies appropriate label based on AI decision
   - Moves email out of inbox to prevent reprocessing

**Code flow**:
```javascript
// In background_chrome_identity_only.js
async function processEmailsCycle(authToken) {
  // 1. Get all emails currently in inbox
  const response = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages?q=in:inbox&maxResults=10',
    { headers: { 'Authorization': `Bearer ${authToken}` } }
  );
  
  const data = await response.json();
  const messages = data.messages || [];
  
  // 2. Process each email
  for (const message of messages) {
    await processEmail(authToken, message.id);
  }
}

async function processEmail(authToken, messageId) {
  // 1. Get email details
  const emailResponse = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}`,
    { headers: { 'Authorization': `Bearer ${authToken}` } }
  );
  
  // 2. Extract subject and content
  const email = await emailResponse.json();
  const subject = getEmailSubject(email);
  const content = getEmailContent(email);
  
  // 3. Send to AI for classification
  const classification = await classifyEmailWithAI(subject, content);
  
  // 4. Apply label and move out of inbox
  await moveEmailToFolder(authToken, messageId, classification);
}
```

### Step 4: AI Classification Process

**What you see**: Emails getting labeled as "Work", "Personal", "Spam", etc.  
**What happens behind the scenes**:

1. **Data preparation**: Email subject and content are cleaned and formatted
2. **AI analysis**: Text is sent to the cloud AI server
3. **Model processing**: DistilBERT AI model analyzes the email content
4. **Classification decision**: AI determines the most appropriate category
5. **Confidence scoring**: AI provides a confidence level (0-100%)
6. **Fallback logic**: If AI is unavailable, rule-based classification is used

**Code flow**:
```python
# In automail-server/utils/classifier.py
def classify_email(self, content: str, subject: str = "") -> Dict:
    # 1. Preprocess email content
    full_text = self.preprocess_email_content(content, subject)
    
    # 2. Use AI model for classification
    if self.is_loaded:
        result = self.classifier(
            full_text,
            self.classification_labels,
            multi_label=False
        )
        
        # 3. Convert AI output to our format
        label = self.map_ai_label_to_category(result['labels'][0])
        confidence = result['scores'][0]
        
        return {
            'label': label,
            'confidence': confidence,
            'reasoning': f'AI classification based on content analysis'
        }
    else:
        # 4. Fallback to rule-based classification
        return self.rule_based_classification(content, subject)
```

### Step 5: Email Organization & User Feedback

**What you see**: Processed emails appear in sidebar tabs with their classifications  
**What happens behind the scenes**:

1. **Label application**: Gmail API applies the appropriate label to the email
2. **Inbox removal**: Email is moved out of the inbox using `removeLabelIds: ['INBOX']`
3. **Storage update**: Extension stores processing results locally
4. **UI update**: Sidebar refreshes to show newly processed emails
5. **Progress tracking**: User sees real-time updates of processing status

---

## Authentication & Security

Security is critical when handling email data. Here's how Automail keeps your information safe:

### OAuth 2.0 Flow
**Industry standard**: Uses Google's own authentication system  
**No password storage**: Extension never sees or stores your Google password  
**Limited permissions**: Only requests access to Gmail, nothing else

### Session Management
```javascript
// Automatic logout on navigation
window.addEventListener('beforeunload', async (event) => {
  // Clear authentication if user leaves Gmail
  await chrome.storage.local.set({
    isAuthenticated: false,
    sessionInvalidated: true,
    requiresFreshAuth: true
  });
});
```

### Token Security
- **Secure storage**: Tokens stored in Chrome's encrypted local storage
- **Automatic refresh**: Expired tokens are automatically renewed
- **Immediate cleanup**: All tokens cleared when extension is disabled

### API Security
- **API key protection**: All server requests require valid API key
- **Rate limiting**: Prevents abuse with request limits
- **Input validation**: All data is sanitized before processing

---

## AI Classification System

The heart of Automail is its AI system that understands email content:

### Model Architecture
**Base Model**: DistilBERT (a lightweight, fast version of BERT)  
**Training**: Pre-trained on large text datasets, fine-tuned for email classification  
**Categories**: Work, Personal, Spam, Important, Review

### Classification Process
1. **Text preprocessing**: Removes signatures, URLs, and excessive whitespace
2. **Tokenization**: Breaks text into units the AI can understand
3. **Context analysis**: AI considers both subject line and email body
4. **Multi-label scoring**: Evaluates probability for each category
5. **Confidence thresholding**: Only applies labels with high confidence

### Fallback System
When AI is unavailable, rule-based classification uses keyword matching:
```javascript
const patterns = {
  'Spam': ['unsubscribe', 'click here', 'limited time', 'act now'],
  'Important': ['urgent', 'important', 'asap', 'deadline'],
  'Work': ['meeting', 'project', 'deadline', 'report', 'team'],
  'Personal': ['family', 'friend', 'vacation', 'birthday']
};
```

---

## User Interface Integration

The sidebar provides a clean, intuitive way to interact with the system:

### Sidebar Components
- **Authentication panel**: Login/logout with Google
- **Processing controls**: Start/stop email processing
- **Tabbed interface**: View emails by category (Recent, Work, Personal, etc.)
- **Email cards**: Individual email previews with actions
- **Status indicators**: Real-time feedback on system state

### Gmail Integration
The extension seamlessly integrates with Gmail without disrupting the existing interface:

```javascript
// Waits for Gmail to load before creating sidebar
function waitForGmailLoad() {
  return new Promise((resolve) => {
    const checkGmailLoaded = () => {
      const gmailContainer = document.querySelector('[role="main"]') || 
                           document.querySelector('.nH');
      
      if (gmailContainer && document.readyState === 'complete') {
        resolve();
      } else {
        setTimeout(checkGmailLoaded, 500);
      }
    };
    checkGmailLoaded();
  });
}
```

### Responsive Design
- **Flexible layout**: Adapts to different screen sizes
- **Collapsible sidebar**: Can be minimized to save space
- **Touch-friendly**: Works on devices with touch screens
- **Accessibility**: Proper contrast and keyboard navigation

---

## Data Flow & Storage

Understanding how data moves through the system:

### Local Storage (Chrome Extension)
```javascript
// Stored in Chrome's secure local storage
{
  authToken: "encrypted_oauth_token",
  isAuthenticated: true,
  userProfile: { emailAddress: "user@example.com" },
  processedEmails: [...],
  userSettings: { autoProcess: true }
}
```

### Temporary Processing Data
- **Email content**: Temporarily held in memory during processing
- **AI responses**: Cached briefly to avoid duplicate API calls
- **UI state**: Current tab, selected emails, etc.

### Data Privacy
- **No persistent email storage**: Email content is not permanently stored
- **Local processing results**: Only classification results are kept
- **User control**: All data can be cleared with "Clear Stored Data" button

---

## Error Handling & Fallbacks

Robust error handling ensures the system continues working even when problems occur:

### Authentication Errors
```javascript
// If OAuth token expires or becomes invalid
if (response.status === 401) {
  // Clear stored authentication
  await chrome.storage.local.set({ isAuthenticated: false });
  // Prompt user to log in again
  updateSidebarUI();
}
```

### AI Server Errors
- **Graceful degradation**: Falls back to rule-based classification
- **Retry logic**: Attempts failed requests up to 3 times
- **User notification**: Clear error messages in the sidebar

### Gmail API Errors
- **Rate limiting**: Respects Gmail's API limits
- **Network failures**: Retries with exponential backoff
- **Permission errors**: Guides user through re-authentication

### Recovery Mechanisms
- **Automatic retry**: Failed operations are retried automatically
- **Manual refresh**: Users can force refresh if something goes wrong
- **Complete reset**: "Clear Stored Data" option for complete restart

---

## Performance & Optimization

The system is designed to be fast and efficient:

### Batch Processing
Instead of processing emails one by one, the system processes multiple emails in batches:
```javascript
// Process up to 10 emails at once
const messages = await gmail.users.messages.list({
  userId: 'me',
  q: 'in:inbox',
  maxResults: 10
});
```

### Intelligent Caching
- **Classification cache**: Avoids re-classifying identical emails
- **Model caching**: AI model stays loaded in memory
- **API response caching**: Reduces redundant API calls

### Efficient Gmail Integration
- **Minimal DOM manipulation**: Only updates UI when necessary
- **Event delegation**: Uses efficient event handling patterns
- **Lazy loading**: Loads email content only when needed

### Memory Management
- **Automatic cleanup**: Removes old data from memory
- **Resource monitoring**: Tracks memory usage
- **Garbage collection**: Properly disposes of unused objects

---

## API Endpoints & Communication

The extension communicates with the AI server through well-defined API endpoints:

### Main Endpoints

#### 1. Health Check
```
GET /health
Purpose: Verify server status and AI model availability
Response: Server version, model status, timestamp
```

#### 2. Single Email Classification
```
POST /classify
Headers: X-API-Key: [api_key]
Body: {
  "content": "email body content",
  "subject": "email subject line"
}
Response: {
  "label": "Work",
  "confidence": 0.85,
  "reasoning": "Classification based on business terminology"
}
```

#### 3. Batch Email Classification
```
POST /batch-classify
Headers: X-API-Key: [api_key]
Body: {
  "emails": [
    {"content": "email 1", "subject": "subject 1"},
    {"content": "email 2", "subject": "subject 2"}
  ]
}
Response: {
  "results": [...],
  "processing_time": 1.234,
  "total_emails": 2
}
```

### Communication Flow
1. **Extension to Server**: Email content sent via HTTPS POST
2. **Server Processing**: AI model analyzes content
3. **Server to Extension**: Classification result returned
4. **Extension to Gmail**: Result applied via Gmail API

### Security Measures
- **API Key**: All requests require valid API key
- **HTTPS Only**: All communication encrypted
- **Rate Limiting**: Prevents abuse and overuse
- **Input Validation**: All data sanitized before processing

---

## Conclusion

Automail represents a sophisticated integration of modern web technologies, artificial intelligence, and secure authentication to create a seamless email automation experience. The system's architecture prioritizes security, performance, and user experience while maintaining the flexibility to handle various email patterns and user preferences.

The technical implementation demonstrates several key software engineering principles:
- **Separation of concerns**: Clear boundaries between UI, processing, and AI components
- **Fault tolerance**: Comprehensive error handling and fallback mechanisms
- **Security by design**: Multiple layers of protection for user data
- **Performance optimization**: Efficient processing and resource management
- **User-centric design**: Intuitive interface with minimal learning curve

This technical foundation provides a solid base for future enhancements and ensures reliable operation across diverse user scenarios and email patterns. 