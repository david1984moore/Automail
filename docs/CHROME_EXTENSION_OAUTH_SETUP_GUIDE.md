<!--
Created on: 6/17/2025
Edited on: 6/17/2025, 6/24/2025
-->

# Chrome Extension OAuth 2.0 Setup Guide

## Critical Issue with Current Setup

Your current OAuth client is configured as a **Web Application**, but Chrome Extensions require a **Chrome Extension** client type. This is why you're getting "Invalid Credentials" errors.

## Complete Fresh Setup Process

### Step 1: Delete Current OAuth Client (REQUIRED)

1. Go to [Google Cloud Console Credentials](https://console.cloud.google.com/apis/credentials)
2. Find your current OAuth client: `506990861082-8dss8jehi5jek4sfg2p1srj439hk6vh.apps.googleusercontent.com`
3. Click the trash icon to **DELETE** it
4. Confirm deletion

### Step 2: Create NEW Chrome Extension OAuth Client

1. Go to [Google Cloud Console Credentials](https://console.cloud.google.com/apis/credentials)
2. Click **+ CREATE CREDENTIALS**
3. Select **OAuth 2.0 Client ID**
4. **CRITICAL**: Choose **Chrome Extension** (NOT Web Application)
5. Fill in:
   - **Name**: `Automail Extension`
   - **Item ID**: `oldiihekbokaappgjealnboadccdhen` (your actual extension ID)

### Step 3: Verify APIs are Enabled

Ensure these APIs are enabled in your project:
1. [Gmail API](https://console.cloud.google.com/apis/library/gmail.googleapis.com)
2. [Google People API](https://console.cloud.google.com/apis/library/people.googleapis.com) (optional but recommended)

### Step 4: Configure OAuth Consent Screen

1. Go to [OAuth Consent Screen](https://console.cloud.google.com/apis/credentials/consent)
2. Ensure it's configured as **External** (unless you're a Google Workspace customer)
3. Add your email as a test user
4. Add required scopes:
   - `https://www.googleapis.com/auth/gmail.modify`
   - `https://www.googleapis.com/auth/gmail.readonly`

### Step 5: Update manifest.json

```json
{
  "oauth2": {
    "client_id": "YOUR_NEW_CHROME_EXTENSION_CLIENT_ID.apps.googleusercontent.com",
    "scopes": [
      "https://www.googleapis.com/auth/gmail.modify",
      "https://www.googleapis.com/auth/gmail.readonly"
    ]
  }
}
```

## Why This is Different for Chrome Extensions

- **Chrome Extensions** use a different OAuth flow than web apps
- They use `chrome.identity.getAuthToken()` instead of redirect-based flows
- Google validates that the extension ID matches the registered ID
- The client type MUST be "Chrome Extension" in Google Cloud Console

## Common Issues and Solutions

### Issue: "deleted_client" error
**Solution**: The old client was deleted. Create a new Chrome Extension client.

### Issue: "invalid_client" error  
**Solution**: Extension ID doesn't match. Verify the Item ID in Google Cloud Console matches your actual extension ID.

### Issue: "redirect_uri_mismatch" error
**Solution**: Chrome Extensions don't use redirect URIs. This suggests you're using a Web Application client instead of Chrome Extension client.

## Testing the New Setup

After creating the new Chrome Extension OAuth client:

1. Update manifest.json with the new client ID
2. Reload the extension in Chrome
3. Test authentication by clicking "Login with Google"
4. Check the console for any remaining errors

## Verification Steps

1. **Extension ID Match**: Verify `oldiihekbokaappgjealnboadccdhen` in Google Cloud Console matches Chrome extension
2. **Client Type**: Confirm the OAuth client shows "Chrome Extension" (not "Web Application")
3. **Scopes**: Verify Gmail scopes are properly configured
4. **Test User**: Ensure your email is added as a test user

## If You Still Have Issues

If authentication still fails after following this guide:

1. Check if you need to verify your app (if using sensitive scopes)
2. Ensure you're using the latest `chrome.identity` API correctly
3. Verify your Google Workspace admin hasn't restricted OAuth apps (if applicable)

The key insight is that **Chrome Extensions are NOT web applications** and require their own specific OAuth client type in Google Cloud Console. 