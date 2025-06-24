<!--
Created on: 6/17/2025
Edited on: 6/17/2025, 6/24/2025
-->

# Automail - Comprehensive Technical Reference Guide

**Version:** 1.0  
**Last Updated:** 6/24/2025  
**Document Purpose:** Complete technical reference for Automail Chrome Extension development and maintenance

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture Components](#2-architecture-components)
3. [Chrome Extension Implementation](#3-chrome-extension-implementation)
4. [AI Classification Server](#4-ai-classification-server)
5. [Email Processing Flow](#5-email-processing-flow)
6. [User Interface Implementation](#6-user-interface-implementation)
7. [Security Framework](#7-security-framework)
8. [Performance Optimizations](#8-performance-optimizations)
9. [Error Handling & Logging](#9-error-handling--logging)
10. [Deployment Configuration](#10-deployment-configuration)
11. [Development Guidelines](#11-development-guidelines)
12. [Troubleshooting Guide](#12-troubleshooting-guide)

---

## 1. System Overview

### Project Description
Automail is a sophisticated Chrome extension that provides AI-powered email automation for Gmail users. The system combines a client-side Chrome extension with a cloud-based AI server to automatically classify, organize, and process emails.

### Key Features
- 🔐 Secure OAuth 2.0 authentication with Gmail
- 🤖 AI-powered email classification using DistilBERT
- 📧 Automated email processing and organization
- ✍️ Smart email composition and replies
- 📱 Intuitive sidebar interface
- 🎯 Contact management integration
- 📊 Learning from user preferences

### High-Level Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Gmail Frontend │◄──►│ Chrome Extension │◄──►│   AI Server     │
│                 │    │                  │    │   (Flask)       │
│ - Email Display │    │ - Content Script │    │ - DistilBERT    │
│ - User Interface│    │ - Background     │    │ - Classification│
│                 │    │ - Service Worker │    │ - API Endpoints │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                               │
                               ▼
                       ┌──────────────────┐
                       │   Gmail API      │
                       │ - OAuth 2.0      │
                       │ - Email Access   │
                       │ - Email Modify   │
                       └──────────────────┘
```

---

## 2. Architecture Components

### Core Components

1. **Chrome Extension Frontend** - User interface and Gmail integration
2. **Chrome Extension Backend** - Email processing and API communication  
3. **AI Classification Server** - Machine learning email categorization
4. **Gmail API Integration** - Email access and manipulation

### File Structure
```
Automail/
├── manifest.json                 # Extension configuration
├── background.js                 # Main service worker
├── background_fixed.js           # Fixed implementation (current)
├── content.js                    # Gmail integration script
├── sidebar.css                   # UI styling
├── automail-server/              # AI server backend
│   ├── app.py                   # Flask application
│   ├── utils/classifier.py     # AI classification engine
│   ├── utils/security.py       # API security
│   └── config/config.py         # Configuration
└── [Various test and debug files]
```

---

## 3. Chrome Extension Implementation

### 3.1 Manifest Configuration (manifest.json)

**Key Configuration Elements:**
```json
{
  "manifest_version": 3,
  "name": "Automail",
  "permissions": [
    "storage", "identity", "scripting", "tabs", "activeTab"
  ],
  "host_permissions": [
    "https://mail.google.com/*",
    "https://gmail.googleapis.com/*",
    "https://automail-ai-server-506990861082.us-east4.run.app/*"
  ],
  "oauth2": {
    "client_id": "506990861082-8dss8jehi5jek4sfg2p1srj439hk6vh.apps.googleusercontent.com",
    "scopes": [
      "https://www.googleapis.com/auth/gmail.modify",
      "https://www.googleapis.com/auth/gmail.readonly"
    ]
  }
}
```

**Critical Notes:**
- Uses Chrome Extension Manifest V3 for future compatibility
- OAuth2 client ID must match Google Cloud Console configuration
- Host permissions include both local development and production AI server

### 3.2 Background Service Worker (background_fixed.js)

**Current Implementation:** `background_fixed.js` (fixed infinite loop issue)

**Key Functions:**

#### Authentication Handler
```javascript
async function handleLogin(sendResponse) {
  // 1. Clear existing auth data
  // 2. Remove cached tokens 
  // 3. Request fresh OAuth token
  // 4. Validate token with Gmail API
  // 5. Store authentication securely
}
```

#### Email Processing Cycle
```javascript
async function processEmailsCycle(authToken) {
  // 1. Fetch inbox emails using "in:inbox" query
  // 2. Process each email through AI classification
  // 3. Move processed emails out of inbox immediately
  // 4. Prevents infinite reprocessing loop
}
```

**Critical Fix:** The system now uses Gmail "in:inbox" query that ONLY returns emails actually in inbox, immediately moves processed emails out of inbox using `removeLabelIds: ['INBOX']`, ensuring moved emails won't appear in future inbox queries.

#### AI Configuration
```javascript
const AI_API_CONFIG = {
  baseUrl: 'https://automail-ai-server-506990861082.us-east4.run.app',
  apiKey: 'automail-prod-key-2024',
  timeout: 10000,
  retryAttempts: 3,
  fallbackEnabled: true
};
```

### 3.3 Content Script Implementation (content.js)

**Primary Responsibilities:**
- Inject and manage sidebar UI within Gmail
- Handle user interactions and authentication flow
- Communicate with background script
- Implement security measures for session management

**Security Features:**
```javascript
// Auto-logout on navigation
window.addEventListener('beforeunload', async (event) => {
  await chrome.storage.local.set({
    isAuthenticated: false,
    sessionInvalidated: true,
    requiresFreshAuth: true
  });
});

// Domain change detection
const urlObserver = new MutationObserver(() => {
  // Force logout if navigating away from Gmail
});
```

**Key Security Measures:**
- Automatic logout when navigating away from Gmail
- Session invalidation on tab closure
- Domain protection monitoring
- Fresh authentication requirements after security events

---

## 4. AI Classification Server

### 4.1 Flask Application (app.py)

**Main Server Configuration:**
```python
app = Flask(__name__)
CORS(app, origins=config.CORS_ORIGINS)
classifier = get_classifier()
```

**Core Endpoints:**
- `GET /health` - Server health check
- `POST /classify` - Single email classification  
- `POST /batch-classify` - Multiple email classification
- `POST /compose` - AI email composition
- `POST /train` - Model training with user corrections

### 4.2 AI Classifier (utils/classifier.py)

**Model Architecture:**
- **Primary Model:** `facebook/bart-large-mnli` (zero-shot classification)
- **Fallback:** Rule-based keyword matching
- **Categories:** Work, Personal, Spam, Important, Review

**Classification Labels:**
```python
self.classification_labels = [
    "work and business communications",
    "personal and social messages", 
    "spam and promotional content",
    "important and urgent notifications",
    "newsletters and updates",
    "financial and banking communications",
    # ... additional categories
]
```

**Content Preprocessing:**
```python
def preprocess_email_content(self, content: str, subject: str = "") -> str:
    # 1. Combine subject and content
    # 2. Remove excessive whitespace
    # 3. Clean email signatures
    # 4. Remove URLs and email addresses  
    # 5. Truncate to model limits (512 tokens)
```

**Fallback Classification:**
```python
def rule_based_classification(self, content: str, subject: str = "") -> Dict:
    patterns = {
        'Spam': ['unsubscribe', 'click here', 'limited time', ...],
        'Important': ['urgent', 'important', 'asap', 'deadline', ...],
        'Work': ['meeting', 'project', 'deadline', 'report', ...],
        'Personal': ['family', 'friend', 'vacation', 'birthday', ...]
    }
    # Score and return best match
```

### 4.3 Security Implementation (utils/security.py)

**API Security Features:**
- API key authentication for all endpoints
- Rate limiting to prevent abuse
- Input validation and sanitization
- CORS configuration for authorized domains

---

## 5. Email Processing Flow

### 5.1 Processing Cycle (Fixed Implementation)

**Critical Fix Applied:** The infinite processing loop issue has been resolved with the following approach:

1. **Inbox Query:** Uses Gmail API with `"in:inbox"` query to fetch only emails currently in inbox
2. **Email Processing:** Each email is classified and labeled using AI
3. **Immediate Movement:** Processed emails are immediately moved out of inbox using Gmail API `modify` with `removeLabelIds: ['INBOX']`
4. **Loop Prevention:** Since moved emails no longer appear in inbox queries, reprocessing is prevented
5. **Natural Termination:** Processing terminates when inbox is empty

**Key Functions:**
```javascript
// Get only inbox emails
async function getInboxEmails(authToken) {
  const response = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=in:inbox&maxResults=10`,
    { headers: { 'Authorization': `Bearer ${authToken}` }}
  );
}

// Move email out of inbox
async function moveEmailToFolder(authToken, email, classification) {
  const response = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${email.id}/modify`,
    {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${authToken}` },
      body: JSON.stringify({
        removeLabelIds: ['INBOX'],
        addLabelIds: [labelId]
      })
    }
  );
}
```

### 5.2 Classification Process

1. **Email Extraction:** Content and metadata extracted from Gmail API
2. **AI Classification:** Content sent to AI server for categorization
3. **Fallback Handling:** Rule-based classification if AI fails
4. **Label Assignment:** Gmail labels created/assigned based on classification
5. **Verification:** Confirm email movement was successful

---

## 6. User Interface Implementation

### 6.1 Sidebar Design (sidebar.css)

**Layout Structure:**
```css
.automail-sidebar {
    position: fixed !important;
    top: 0 !important;
    right: 0 !important;
    width: 380px !important;
    height: 100vh !important;
    z-index: 999999 !important;
}
```

**Key UI Components:**
- **Header:** Title and control buttons
- **Authentication Section:** Login/logout controls
- **Tab Navigation:** Recent Activity, Smart Reply, AI Suggestions, Important
- **Email List:** Processed emails with status indicators
- **Settings Panel:** User preferences and controls

**Responsive Breakpoints:**
- Desktop: 380px sidebar width
- Tablet (≤1200px): 320px width
- Mobile (≤768px): Full screen overlay

### 6.2 Email Display Components

**Email Item Structure:**
```css
.automail-email-item {
    background: white;
    border-bottom: 1px solid #f0f0f0;
    padding: 12px 16px;
    transition: background-color 0.2s ease;
}
```

**Classification Badges:**
```css
.automail-label-work { background: #4285f4; }
.automail-label-personal { background: #34a853; }
.automail-label-important { background: #ea4335; }
.automail-label-spam { background: #ff6d01; }
.automail-label-review { background: #9aa0a6; }
```

---

## 7. Security Framework

### 7.1 OAuth 2.0 Implementation

**Google Cloud Console Configuration:**
- **Client ID:** `506990861082-8dss8jehi5jek4sfg2p1srj439hk6vh.apps.googleusercontent.com`
- **Scopes:** `gmail.modify`, `gmail.readonly`
- **Redirect URIs:** Chrome extension specific

**Common OAuth Issues:**
- **"Bad client id" error:** Usually Chrome cache issue, not Google Cloud Console configuration
- **Solutions:** Clear Chrome cache, reload extension, regenerate extension key

### 7.2 Chrome Extension Security

**Session Management:**
```javascript
// Security logout on navigation
window.addEventListener('beforeunload', async (event) => {
    await chrome.storage.local.set({
        isAuthenticated: false,
        sessionInvalidated: true,
        requiresFreshAuth: true,
        logoutReason: 'navigation_unload'
    });
});
```

**Token Validation:**
```javascript
async function validateToken(token) {
    const response = await fetch(
        'https://gmail.googleapis.com/gmail/v1/users/me/profile',
        { headers: { 'Authorization': `Bearer ${token}` }}
    );
    return response.ok;
}
```

### 7.3 API Security

**Server-Side Security:**
- API key authentication (`automail-prod-key-2024`)
- Rate limiting (configurable limits)
- Input validation and sanitization
- CORS restrictions to authorized domains

---

## 8. Performance Optimizations

### 8.1 Batch Processing

**Batch Endpoint:**
```python
@app.route('/batch-classify', methods=['POST'])
def batch_classify_emails():
    # Process up to 50 emails per request
    # Returns bulk classification results
```

**Benefits:**
- Reduced API calls
- Improved processing speed
- Better resource utilization

### 8.2 Model Optimization

**Caching Strategy:**
- In-memory model storage
- Persistent model instances
- GPU acceleration when available

**Performance Metrics:**
- Average classification time: ~200ms per email
- Batch processing: ~50 emails in 3-5 seconds
- Model loading time: ~10-15 seconds (one-time)

---

## 9. Error Handling & Logging

### 9.1 Error Handling Patterns

**Background Script:**
```javascript
try {
    const result = await processEmailsCycle(authToken);
    console.log('✅ Processing completed successfully');
} catch (error) {
    console.error('❌ Processing failed:', error);
    await chrome.storage.local.set({ 
        lastError: error.message,
        lastErrorTime: Date.now()
    });
}
```

**AI Server:**
```python
try:
    result = classifier.classify_email(content, subject)
    return jsonify(result), 200
except Exception as e:
    logger.error(f"Classification error: {str(e)}")
    return jsonify({
        'label': 'Review',
        'confidence': 0.1,
        'reasoning': 'Server error - manual review recommended'
    }), 500
```

### 9.2 Logging Configuration

**Chrome Extension Logging:**
- Console logging with emoji indicators
- Chrome storage for error persistence
- User-friendly error messages

**Server Logging:**
- Structured JSON logging
- Request/response tracking
- Performance monitoring
- Classification result logging

---

## 10. Deployment Configuration

### 10.1 Chrome Extension Deployment

**Build Process:**
1. Zip extension files (excluding test files)
2. Upload to Chrome Web Store Developer Dashboard
3. Review process (typically 1-3 days)
4. Publication to users

**Required Files for Distribution:**
```
automail-extension/
├── manifest.json
├── background_fixed.js  (rename to background.js)
├── content.js
├── sidebar.css
├── icon16.png
├── icon48.png
└── icon128.png
```

### 10.2 AI Server Deployment

**Google Cloud Run Configuration:**
```yaml
# render.yaml
services:
- type: web
  name: automail-ai-server
  env: python
  buildCommand: pip install -r requirements.txt
  startCommand: python app.py
  envVars:
  - key: FLASK_ENV
    value: production
```

**Environment Variables:**
- `AUTOMAIL_API_KEY`: API authentication key
- `MODEL_CACHE_DIR`: Model storage directory
- `FLASK_ENV`: Environment configuration

---

## 11. Development Guidelines

### 11.1 Code Organization

**File Naming Conventions:**
- `background_*.js` - Service worker implementations
- `*_test.js` - Test files
- `debug_*.js` - Debugging utilities
- `manifest_*.json` - Configuration variants

**Development Files (exclude from production):**
- All `*_test.js` files
- All `debug_*.js` files
- `manifest_backup.json`, `manifest_test.json`
- Documentation files (`.md`)

### 11.2 Testing Strategy

**Extension Testing:**
1. Load unpacked extension in Chrome developer mode
2. Test OAuth flow with Gmail account
3. Verify email processing functionality
4. Test error handling scenarios

**Server Testing:**
```bash
# Run server tests
cd automail-server
python -m pytest tests/

# Test classification endpoint
curl -X POST http://localhost:5000/classify \
  -H "X-API-Key: automail-prod-key-2024" \
  -H "Content-Type: application/json" \
  -d '{"content": "Meeting tomorrow at 2pm", "subject": "Team Standup"}'
```

### 11.3 Debug Workflows

**OAuth Issues:**
1. Check Google Cloud Console configuration
2. Clear Chrome extension cache
3. Reload extension completely
4. Check browser console for error details

**Processing Issues:**
1. Monitor background script console
2. Check Gmail API quotas
3. Verify AI server connectivity
4. Review classification confidence scores

---

## 12. Troubleshooting Guide

### 12.1 Common Issues

**OAuth "Bad Client ID" Error:**
- **Cause:** Chrome browser cache or extension reload issue
- **Solution:** Clear Chrome cache, reload extension, check Google Cloud Console

**Infinite Processing Loop:**
- **Cause:** Emails not being moved out of inbox properly
- **Solution:** Use `background_fixed.js` implementation with proper Gmail API calls

**AI Classification Failures:**
- **Cause:** Server connectivity or model loading issues
- **Solution:** Check server health endpoint, verify API key, fallback to rule-based classification

### 12.2 Debug Tools

**Chrome Extension:**
- Developer Tools → Extensions → Automail → Inspect views
- Background script console
- Content script console
- Chrome storage inspector

**AI Server:**
- Health check: `GET /health`
- Log monitoring on Google Cloud Run
- Performance metrics dashboard

### 12.3 Performance Issues

**Slow Email Processing:**
- Check batch size (reduce if necessary)
- Monitor server response times
- Verify Gmail API quota usage

**UI Responsiveness:**
- Check CSS z-index conflicts
- Monitor DOM injection performance
- Verify event listener efficiency

---

## Development Contact & Support

**Project Repository:** Internal Automail codebase
**AI Server:** Google Cloud Run deployment
**Chrome Extension:** Chrome Web Store (when published)

**Key Configuration Values:**
- OAuth Client ID: `506990861082-8dss8jehi5jek4sfg2p1srj439hk6vh.apps.googleusercontent.com`
- AI Server URL: `https://automail-ai-server-506990861082.us-east4.run.app`
- API Key: `automail-prod-key-2024`

---

*This document serves as the comprehensive technical reference for the Automail project. Keep it updated as the system evolves.* 