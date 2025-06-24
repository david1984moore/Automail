<!--
Created on: 6/17/2025
Edited on: 6/17/2025, 6/24/2025
-->

# AUTOMAIL PRIVATE CONFIGURATION REFERENCE
**⚠️ CONFIDENTIAL - DO NOT COMMIT TO PUBLIC REPOS ⚠️**

This document contains all critical configuration values, API keys, and setup information for the Automail Chrome Extension.

## 🔑 CRITICAL CONFIGURATION VALUES

### OAuth Configuration
```
✅ CORRECT Client ID: 506990861082-8dss8jehi5ijek4sfg2p1srj439hk6vh.apps.googleusercontent.com
❌ WRONG Client ID:   506990861082-8dss8jehi5jek4sfg2p1srj439hk6vh.apps.googleusercontent.com
                                            ^^^^^ (missing 'i')

Google Cloud Project: automail-extension-462419
OAuth Client Name: automail-extension
OAuth Client Type: Chrome Extension
```

### Chrome Extension Configuration
```
Current Extension ID: oloiihekbokaappgjealnboadccdhen
Extension Name: Automail
Extension Version: 1.0
Extension Description: AI-powered Gmail automation extension for reading, labeling, moving, and composing emails
```

### AI Server Configuration
```
Production Server: https://automail-ai-server-506990861082.us-east4.run.app
Local Development: http://localhost:5000 or http://127.0.0.1:5000
API Key: automail-prod-key-2024
Timeout: 10000ms
Retry Attempts: 3
```

### Gmail API Scopes
```
https://www.googleapis.com/auth/gmail.modify
https://www.googleapis.com/auth/gmail.readonly
```

## 📁 FILE STRUCTURE

### Active Files (Currently Working)
```
manifest.json                          - Main extension manifest (uses chrome-identity-only)
background_chrome_identity_only.js     - Current working background script
content.js                            - Content script for Gmail integration
sidebar.css                           - Sidebar styling
```

### Background Scripts (Available)
```
background_chrome_identity_only.js     - ✅ WORKING - Simple Chrome identity only
background_minimal.js                  - Basic OAuth implementation
background_fixed.js                    - Complex OAuth with email processing
background_working_oauth.js            - Manual OAuth fallback (causes 404s)
```

### Backup/Reference Files
```
manifest_backup.json                   - Simple working manifest
manifest_test.json                     - Test configuration
manifest_new_oauth.json               - Template with placeholder client ID
```

## 🔧 MANIFEST.JSON CONFIGURATION

### Current Working Manifest Structure
```json
{
  "manifest_version": 3,
  "name": "Automail",
  "version": "1.0",
  "description": "AI-powered Gmail automation extension for reading, labeling, moving, and composing emails",
  "permissions": [
    "storage",
    "identity",
    "tabs"
  ],
  "host_permissions": [
    "https://mail.google.com/*",
    "https://gmail.googleapis.com/*"
  ],
  "background": {
    "service_worker": "background_chrome_identity_only.js"
  },
  "action": {
    "default_title": "Automail - Toggle Sidebar"
  },
  "content_scripts": [
    {
      "matches": ["https://mail.google.com/*"],
      "js": ["content.js"],
      "css": ["sidebar.css"],
      "run_at": "document_end"
    }
  ],
  "oauth2": {
    "client_id": "506990861082-8dss8jehi5ijek4sfg2p1srj439hk6vh.apps.googleusercontent.com",
    "scopes": [
      "https://www.googleapis.com/auth/gmail.modify",
      "https://www.googleapis.com/auth/gmail.readonly"
    ]
  }
}
```

## 🚨 TROUBLESHOOTING GUIDE

### OAuth "bad client id: (0)" Error
**ROOT CAUSE**: Wrong client ID in manifest.json
**SOLUTION**: Ensure client ID is exactly: `506990861082-8dss8jehi5ijek4sfg2p1srj439hk6vh.apps.googleusercontent.com`

### OAuth 404 Error After Google Approval
**ROOT CAUSE**: Using manual OAuth redirect (not needed for Chrome extensions)
**SOLUTION**: Use only Chrome identity API, not manual OAuth flows

### Extension Won't Load
**ROOT CAUSE**: Invalid manifest.json (usually invalid "key" field)
**SOLUTION**: Remove "key" field from manifest.json for development

### Gmail API Permission Denied
**ROOT CAUSE**: Missing scopes or wrong extension ID in Google Cloud Console
**SOLUTION**: Verify extension ID matches in Google Cloud Console

## 🔐 GOOGLE CLOUD CONSOLE SETUP

### Project Information
```
Project Name: automail-extension
Project ID: automail-extension-462419
Project Number: 506990861082
```

### APIs Enabled
- Gmail API
- Google+ API (for identity)

### OAuth Client Configuration
```
Name: automail-extension
Type: Chrome Extension
Item ID: oloiihekbokaappgjealnboadccdhen
```

### Service Account (if needed)
```
Email: 506990861082-compute@developer.gserviceaccount.com
```

## 📝 DEVELOPMENT WORKFLOW

### Testing OAuth
1. Reload extension in chrome://extensions/
2. Click Automail sidebar login button
3. Should see Chrome OAuth popup
4. Should return to Gmail with green "Connected" status

### Debugging
1. Open Chrome DevTools on Gmail page
2. Go to Extensions -> Automail -> service worker
3. Check console for detailed logs

### Common Commands for DevTools Console
```javascript
// Clear OAuth cache
chrome.identity.clearAllCachedAuthTokens(() => console.log('Cleared'));

// Check extension storage
chrome.storage.local.get(null, (data) => console.log(data));

// Clear extension storage
chrome.storage.local.clear();
```

## 🎯 CURRENT STATUS (Working Configuration)

✅ OAuth Authentication: WORKING
✅ Gmail API Access: WORKING  
✅ Extension Loading: WORKING
✅ Sidebar Display: WORKING
⏳ Email Processing: READY TO TEST
⏳ AI Classification: READY TO TEST

## 🔄 BACKUP COMMANDS

### Quick Reset (if things break)
```bash
# Copy working manifest
cp manifest_backup.json manifest.json

# Use simple background script
# Edit manifest.json to use "background_minimal.js"
```

### Nuclear Reset (if completely broken)
1. Remove extension completely
2. Clear Chrome cache: %LOCALAPPDATA%\Google\Chrome\User Data\Default\Local Extension Settings
3. Reload extension fresh
4. Use this document to restore configuration

---
**📅 Last Updated**: $(date)
**🔧 Current Configuration**: Chrome Identity Only + Correct Client ID
**✅ Status**: OAUTH WORKING - Ready for email processing development 