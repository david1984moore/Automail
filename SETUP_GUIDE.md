# Automail Setup Guide - Google Cloud Console Configuration

## Prerequisites
- Google account with access to Google Cloud Console
- Chrome browser with Developer Mode enabled

## Step 1: Create Google Cloud Project

1. **Go to Google Cloud Console**
   - Visit [https://console.cloud.google.com/](https://console.cloud.google.com/)
   - Sign in with your Google account

2. **Create New Project**
   - Click "Select a project" dropdown in the top navigation
   - Click "New Project"
   - Enter project name: `automail-extension`
   - Click "Create"

3. **Select Your Project**
   - Wait for project creation (1-2 minutes)
   - Select your new project from the dropdown

## Step 2: Enable Required APIs

1. **Enable Gmail API**
   - Go to "APIs & Services" > "Library"
   - Search for "Gmail API"
   - Click on "Gmail API" and click "Enable"

2. **Enable People API** (for contacts)
   - In the API Library, search for "People API"
   - Click on "People API" and click "Enable"

## Step 3: Configure OAuth Consent Screen

1. **Go to OAuth Consent Screen**
   - Navigate to "APIs & Services" > "OAuth consent screen"

2. **Choose User Type**
   - Select "External" (unless you have a Google Workspace account)
   - Click "Create"

3. **Fill App Information**
   - **App name**: `Automail`
   - **User support email**: Your email address
   - **Developer contact email**: Your email address
   - **App domain** (optional): Leave blank for testing
   - Click "Save and Continue"

4. **Configure Scopes**
   - Click "Add or Remove Scopes"
   - Add these scopes:
     - `https://www.googleapis.com/auth/gmail.modify`
     - `https://www.googleapis.com/auth/contacts`
   - Click "Update" then "Save and Continue"

5. **Add Test Users** (for External apps)
   - Click "Add Users"
   - Add your email address and any other test users
   - Click "Save and Continue"

6. **Review and Submit**
   - Review all information
   - Click "Back to Dashboard"

## Step 4: Create OAuth Credentials

1. **Go to Credentials**
   - Navigate to "APIs & Services" > "Credentials"

2. **Create OAuth Client ID**
   - Click "Create Credentials" > "OAuth 2.0 Client IDs"
   - **Application type**: Select "Chrome extension"
   - **Name**: `Automail Extension`

3. **Configure Extension ID**
   - You'll need your extension ID first. To get it:
     - Load your extension in Chrome Developer Mode
     - Copy the extension ID from chrome://extensions/
   - **Item ID**: Paste your extension ID
   - Click "Create"

4. **Save Credentials**
   - Copy the **Client ID** (ends with `.apps.googleusercontent.com`)
   - You'll need this for the manifest.json file

## Step 5: Update Extension Configuration

1. **Update manifest.json**
   - Open your `manifest.json` file
   - Replace `YOUR_GOOGLE_CLIENT_ID` with your actual Client ID:
   ```json
   "oauth2": {
     "client_id": "your-actual-client-id.apps.googleusercontent.com",
     "scopes": [
       "https://www.googleapis.com/auth/gmail.modify",
       "https://www.googleapis.com/auth/contacts"
     ]
   }
   ```

2. **Generate Extension Key** (Optional but Recommended)
   - For consistent extension ID across installations
   - In Chrome, go to chrome://extensions/
   - Click "Pack extension"
   - Select your extension folder
   - This generates a .pem file
   - Copy the key from the .pem file to manifest.json

## Step 6: Test Authentication

1. **Reload Extension**
   - Go to chrome://extensions/
   - Click the reload button for Automail

2. **Test Login**
   - Click on the Automail extension icon
   - Click "Login with Google"
   - You should see a Google OAuth popup
   - Grant the requested permissions
   - Verify successful authentication

## Troubleshooting

### Common Issues

1. **"Error 400: redirect_uri_mismatch"**
   - Ensure your extension ID in Google Cloud Console matches your actual extension ID
   - Reload the extension and try again

2. **"This app isn't verified"**
   - This is normal for testing
   - Click "Advanced" > "Go to Automail (unsafe)"
   - For production, you'll need Google verification

3. **"Access blocked"**
   - Ensure you've added your email as a test user in OAuth consent screen
   - Check that all required scopes are added

4. **Token validation fails**
   - Verify APIs are enabled in Google Cloud Console
   - Check that scopes match between manifest.json and OAuth consent screen

### Debug Mode

1. **Check Extension Console**
   - Right-click extension icon > "Inspect popup"
   - Check Console tab for errors

2. **Check Background Script**
   - Go to chrome://extensions/
   - Click "service worker" link for Automail
   - Check Console for authentication errors

### Security Notes

- Never share your Client ID publicly in production
- For production apps, complete Google's verification process
- Regularly rotate credentials if compromised
- Use HTTPS for all production domains

## Production Deployment

For publishing to Chrome Web Store:

1. **Complete OAuth Verification**
   - Submit your app for Google verification
   - Provide privacy policy and terms of service
   - Complete security assessment

2. **Update OAuth Consent Screen**
   - Change from "Testing" to "In production"
   - Add official app domains

3. **Generate Production Build**
   - Remove test configurations
   - Minify and optimize code
   - Package for Chrome Web Store

---

**Need Help?**
- [Google Cloud Console Documentation](https://cloud.google.com/docs)
- [Chrome Extension OAuth Guide](https://developer.chrome.com/docs/extensions/reference/identity/)
- [Gmail API Documentation](https://developers.google.com/gmail/api) 