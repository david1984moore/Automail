# Google Cloud Console Setup Verification Checklist

## 🔧 Pre-Debug Checklist

Before running the OAuth debugger, ensure your Google Cloud Console is properly configured:

### 1. Project Setup ✅
- [ ] Created a Google Cloud Console project
- [ ] Project is active and accessible
- [ ] Billing account linked (if required)

### 2. API Enablement ✅
- [ ] Gmail API is enabled
- [ ] Google People API is enabled  
- [ ] OAuth2 API is enabled

### 3. OAuth Consent Screen ✅
- [ ] OAuth consent screen configured
- [ ] User type set (Internal/External)
- [ ] App name, email, and domain configured
- [ ] Scopes added:
  - `https://www.googleapis.com/auth/gmail.modify`
  - `https://www.googleapis.com/auth/gmail.readonly`
  - `https://www.googleapis.com/auth/contacts`

### 4. OAuth Client Configuration ✅
- [ ] OAuth 2.0 Client ID created
- [ ] Application type: Chrome extension
- [ ] Extension ID matches your actual extension ID
- [ ] Authorized origins configured (if applicable)

### 5. Extension Configuration ✅
- [ ] Extension ID in manifest matches Google Cloud Console
- [ ] Client ID in manifest matches Google Cloud Console
- [ ] All required scopes in manifest
- [ ] Extension loaded in Chrome Developer Mode

## 🚀 How to Run the OAuth Debugger

1. **Open Gmail** in Chrome: `https://mail.google.com`

2. **Open Chrome DevTools**: 
   - Press F12 or Right-click → Inspect
   - Go to Console tab

3. **Copy and paste** the entire contents of `oauth_debug_console.js` into the console

4. **Press Enter** to run the debugger

5. **Follow the prompts** - the debugger will:
   - Check extension configuration
   - Test OAuth setup
   - Attempt authentication
   - Test Gmail API access
   - Provide specific error messages

## 🔍 Common Issues and Solutions

### Issue 1: "OAuth2 configuration not found"
**Solution**: Check your `manifest.json` file has the `oauth2` section with `client_id` and `scopes`

### Issue 2: "Extension ID mismatch"
**Solution**: 
1. Check your extension ID in Chrome: `chrome://extensions/`
2. Update Google Cloud Console OAuth client with the correct ID

### Issue 3: "Gmail API access denied"
**Solution**:
1. Ensure Gmail API is enabled in Google Cloud Console
2. Check OAuth consent screen has the correct scopes
3. Verify your Google account has permission to access the API

### Issue 4: "Token validation failed"
**Solution**:
1. Clear all browser data for Google accounts
2. Re-run the OAuth flow
3. Check for any Chrome extension conflicts

### Issue 5: "Network connectivity issues"
**Solution**:
1. Check your internet connection
2. Verify no firewall blocking Google APIs
3. Try disabling VPN if using one

## 📋 Manual Verification Steps

If the debugger doesn't work, manually verify:

1. **Extension Loading**:
   ```javascript
   // Run in console
   console.log(chrome.runtime.getManifest());
   ```

2. **OAuth Client ID**:
   ```javascript
   // Check manifest
   console.log(chrome.runtime.getManifest().oauth2);
   ```

3. **Chrome Identity API**:
   ```javascript
   // Test identity API
   chrome.identity.getAuthToken({interactive: false}, token => {
       console.log('Token:', token);
   });
   ```

4. **Gmail API Test**:
   ```javascript
   // Test Gmail API (replace TOKEN with actual token)
   fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
       headers: { 'Authorization': 'Bearer TOKEN' }
   }).then(r => r.json()).then(console.log);
   ```

## 🆘 If All Else Fails

1. **Double-check Google Cloud Console setup**
2. **Create a new OAuth client ID**
3. **Reload the extension**
4. **Clear all Chrome data related to Google accounts**
5. **Try with a different Google account**

## 📞 Getting Help

When asking for help, please provide:
- Full console output from the debugger
- Your extension ID
- Screenshots of Google Cloud Console OAuth settings
- Any specific error messages

---

**Next Step**: Run the OAuth debugger and report the results! 