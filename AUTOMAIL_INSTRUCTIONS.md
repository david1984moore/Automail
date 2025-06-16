# Automail Extension - Complete Development Instructions

## Project Overview
**Goal**: Create a Chrome extension that automates Gmail tasks (reading, labeling, moving, trashing, composing) using AI, with an intuitive sidebar UI for non-technical users.

---

## Action 1: Set Up the Project Foundation

**Goal Reminder**: The goal of Automail is to create a Chrome extension that automates Gmail tasks (reading, labeling, moving, trashing, composing) using AI, with an intuitive sidebar UI for non-technical users.

**Task**: Initialize the project structure for a Chrome extension.

### Detailed Steps:
1. Create a directory named `automail`
2. Initialize a Git repository: Run `git init` and create a `.gitignore` file excluding `node_modules`, `.env`, and temporary files
3. Set up a basic Chrome extension structure with the following files:
   - `manifest.json`: Define extension metadata and permissions
   - `background.js`: Handle background tasks (e.g., email polling)
   - `popup.html`: Base for the sidebar UI
   - `popup.js`: UI logic and API interactions
   - `styles.css`: UI styling
4. In `manifest.json`, include:
   - Extension name: "Automail"
   - Version: "1.0"
   - Permissions: ["storage", "identity", "https://www.googleapis.com/auth/gmail.modify", "https://www.googleapis.com/auth/contacts"]
   - Background script: `background.js`
   - Popup: `popup.html`
5. Add a comment at the top of each file explaining its purpose
6. Install Node.js dependencies (if needed) via `npm init -y` and `npm install axios` for API calls
7. Test the extension by loading it in Chrome (Developer Mode → Load Unpacked)

### Constraints:
- Use Chrome extension APIs only
- Keep the structure modular for future updates

### Debugging:
- Check Chrome's extension console for errors
- Ensure `manifest.json` is valid JSON

**Output**: A functional project scaffold

---

## Action 2: Implement Secure OAuth Authentication

**Goal Reminder**: The goal of Automail is to automate Gmail tasks securely, with a UI that includes login/logout functionality.

**Task**: Set up OAuth 2.0 for Gmail and People API access.

### Detailed Steps:
1. Register a project in the Google Cloud Console to get a Client ID and Client Secret
2. Configure OAuth scopes: `https://www.googleapis.com/auth/gmail.modify` and `https://www.googleapis.com/auth/contacts`
3. In `background.js`, use Chrome's identity API to initiate OAuth:
   - Call `chrome.identity.getAuthToken({ interactive: true })` to get an access token
   - Store the token in `chrome.storage.local`
4. In `popup.html`, add:
   - A "Login with Google" button (visible when not authenticated)
   - A "Logout" button (visible when authenticated)
5. In `popup.js`:
   - Add event listeners for login/logout buttons
   - On login, trigger the OAuth flow via a message to `background.js`
   - On logout, call `chrome.identity.removeCachedAuthToken` and clear `chrome.storage.local`
6. Test authentication flow completely
7. Add comments explaining each function

### Constraints:
- Use Chrome's identity API for OAuth
- Ensure tokens are stored securely and cleared on logout

### Debugging:
- Log OAuth errors to the console
- Verify scopes in the Google Cloud Console

**Output**: A working login/logout system

---

## Action 3: Develop the Email Reading Module

**Goal Reminder**: The goal of Automail is to read and comprehend all emails (existing and new) to enable automation.

**Task**: Fetch emails using the Gmail API.

### Detailed Steps:
1. In `background.js`, create a function `fetchEmails` to:
   - Get the auth token from `chrome.storage.local`
   - Use axios to call `https://gmail.googleapis.com/gmail/v1/users/me/messages` with query `q=from:*` for existing emails
   - For each message ID, call `messages.get` to retrieve subject, sender, date, and content (parse `payload.parts` or `payload.body`)
   - On first run (after login), fetch all existing emails
2. Set up real-time email detection:
   - Use `gmail.users.watch` to push notifications (if supported) or poll every 10 seconds for new emails (`q=from:* is:unread`)
3. Store email data in `chrome.storage.local` as an array of objects: `{ id, subject, sender, content, timestamp }`
4. Log each step (e.g., "Fetched 10 emails", "Stored email ID: xyz")
5. Test with a test Gmail account:
   - Send 5 test emails and verify they're fetched
   - Check storage for email data
6. Add comments for each function

### Constraints:
- Handle pagination in `messages.list`
- Parse both plain text and HTML email bodies
- Avoid excessive API calls (batch requests if possible)

### Debugging:
- Log API response errors
- Verify email content parsing with diverse email types

**Output**: A module that fetches and stores emails

---

## Action 4: Set Up a Server-Side AI API

**Goal Reminder**: The goal of Automail is to use AI to classify and process emails efficiently.

**Task**: Create a Flask API to host DistilBERT.

### Detailed Steps:
1. Create a new directory `automail-server`
2. Initialize a Python project: `pip install flask transformers torch`
3. Create `app.py` with a `/classify` POST endpoint:
   - Load DistilBERT (`distilbert-base-uncased` from Hugging Face)
   - Accept JSON input: `{ "content": "email text" }`
   - Return JSON: `{ "label": "Work|Personal|Spam|Important|Review" }`
4. Secure the endpoint with an API key in the request header (`X-API-Key`)
5. Add error handling for invalid inputs or model failures
6. Test locally: Run `flask run`, send a sample email content via Postman
7. Add comments explaining model loading and endpoint logic
8. Prepare for deployment (e.g., Heroku free tier) but keep local for now

### Constraints:
- Use a free/low-cost model (DistilBERT)
- Optimize for minimal latency (e.g., cache model in memory)

### Debugging:
- Log model predictions and errors
- Test with varied email content

**Output**: A working AI API

---

## Action 5: Build the Labeling Module

**Goal Reminder**: The goal of Automail is to accurately label emails and learn from existing labels.

**Task**: Apply AI-generated labels to emails.

### Detailed Steps:
1. In `background.js`, create a function `labelEmail`:
   - Fetch existing Gmail labels (`labels.list`)
   - For each email in storage, send its content to the AI API (`/classify`)
   - If the predicted label exists, apply it via `messages.modify`
   - If not, create a new label (`labels.create`) and apply it
2. Handle special cases:
   - "Review" label for uncertain classifications
   - "Important" for emails matching criteria (e.g., verification codes)
3. Log each step
4. Test with 10 test emails
5. Add comments for each function

### Constraints:
- Apply only one label per email
- Retry API failures up to 3 times

### Debugging:
- Log API and Gmail response errors
- Verify label consistency in Gmail UI

**Output**: A module that labels emails accurately

---

## Action 6: Create the Action Module

**Goal Reminder**: The goal of Automail is to move, trash, or archive emails immediately after labeling.

**Task**: Execute email actions based on labels.

### Detailed Steps:
1. In `background.js`, create a function `processEmailActions`:
   - For each labeled email:
     - "Spam" or "Promotions" → Trash (`messages.trash`) unless flagged "Important"
     - "Review" → Move to "Review" label folder
     - Other labels → Move to corresponding label folder
   - Check Spam/Promotions folders and re-label if needed
2. Process new emails immediately and existing emails on first run
3. Log actions
4. Test with 10 test emails
5. Add comments for each function

### Constraints:
- Process emails in real-time (within 10 seconds of arrival)
- Handle Gmail API rate limits

### Debugging:
- Log action failures
- Verify folder changes in Gmail UI

**Output**: A module that executes email actions

---

## Action 7: Implement the Composition Module

**Goal Reminder**: The goal of Automail is to compose and respond to emails in the user's style.

**Task**: Generate and send email drafts.

### Detailed Steps:
1. In `background.js`, create a function `analyzeUserStyle`:
   - Fetch 50 sent emails (`q=from:me`)
   - Extract tone, length, and vocabulary (send to AI API for analysis)
2. Create a function `composeEmail`:
   - For emails requiring a response, send content to AI API (`/compose`) with user style data
   - Store draft in `chrome.storage.local`: `{ emailId, draftContent, status: "pending" }`
3. In `popup.js`, display drafts for user review (with "Send" or "Edit" options)
4. Send approved drafts via `messages.send`
5. Log composition steps
6. Test with 5 test emails
7. Add comments for each function

### Constraints:
- Use user's sent emails for style
- Require user approval for sending

### Debugging:
- Log draft generation errors
- Verify drafts in Gmail's Drafts folder

**Output**: A module for composing emails

---

## Action 8: Develop the Learning Module

**Goal Reminder**: The goal of Automail is to learn from user patterns and preferences.

**Task**: Enable AI to adapt based on user actions.

### Detailed Steps:
1. In `background.js`, create a function `trackUserActions`:
   - Monitor manual label changes, moves, or trashes via Gmail API events
   - Store actions in `chrome.storage.local`: `{ emailId, action, label, timestamp }`
2. Create a function `updateAIModel`:
   - Send action data to AI API (`/train`) to refine classification
   - Update every 24 hours or on user trigger
3. In `popup.js`, add a "Learn from my actions" toggle to enable/disable learning
4. Log learning updates
5. Test with 5 manual actions
6. Add comments for each function

### Constraints:
- Minimize API calls for training
- Respect user toggle setting

### Debugging:
- Log training API errors
- Verify classification improvements

**Output**: A module that learns from user behavior

---

## Action 9: Design the User Interface (Sidebar)

**Goal Reminder**: The goal of Automail is to provide an intuitive, minimalist UI for controlling email automation.

**Task**: Build a collapsible sidebar UI.

### Detailed Steps:
1. In `popup.html`, create:
   - A collapsible sidebar (toggle via a button)
   - Header: "Automail" title (left), pause button (right)
   - Tabs: Recent Activity, Smart Reply, AI Suggestions, Important

2. **Recent Activity Tab**:
   - Display a scrollable list of processed emails: `{ subject, sender, summary, action, timestamp, undoButton }`
   - Undo button opens a modal to change label/action

3. **Smart Reply Tab**:
   - Add "Auto Reply" toggle
   - Input box for response instructions
   - Dropdown: Professional, Friendly, Brief, Detailed

4. **AI Suggestions Tab**:
   - Toggles: "Learn from my actions", "Get AI recommendations"
   - Display suggestions with tab title notifications

5. **Important Tab**:
   - List important emails
   - Modal per email: Label, Action, Reply (checkbox, input, "Respond to similar emails" option)
   - "Notify me" toggle

6. **Quick Actions**:
   - Buttons: "Start Processing" (disappears after first click), "Stop Processing"
   - Toggle processing state in `background.js`

7. In `styles.css`:
   - Use sans-serif fonts, white background, subtle shadows
   - Ensure responsiveness for small screens

8. In `popup.js`:
   - Fetch email data from storage to populate tabs
   - Handle button clicks and modal interactions

9. Test UI comprehensively
10. Add comments for each component

### Constraints:
- Keep UI non-technical and intuitive
- Use plain English for all text

### Debugging:
- Log UI event errors
- Test on multiple screen sizes

**Output**: A polished sidebar UI

---

## Action 10: Add Contact Management

**Goal Reminder**: The goal of Automail is to manage Gmail tasks, including adding contacts.

**Task**: Integrate Google People API for contact management.

### Detailed Steps:
1. In `background.js`, create a function `manageContacts`:
   - Fetch frequent senders from email metadata
   - Use `people.connections.list` to check existing contacts
   - Suggest new contacts via the AI API (based on email frequency)
2. In `popup.js`, display suggestions in the AI Suggestions tab with "Add to Contacts" buttons
3. Add contacts via `people.createContact` on user approval
4. Log contact actions
5. Test with 5 test senders
6. Add comments for each function

### Constraints:
- Require user approval for additions
- Limit suggestions to frequent senders

### Debugging:
- Log API errors
- Verify contacts in Gmail

**Output**: A module for contact management

---

## Action 11: Optimize Performance and Security

**Goal Reminder**: The goal of Automail is to be responsive, secure, and efficient.

**Task**: Enhance performance and security.

### Detailed Steps:
1. Batch Gmail API calls (e.g., batch endpoint for multiple `messages.modify`)
2. Store API keys in `chrome.storage.local` (encrypted)
3. Limit background polling to every 10 seconds
4. Compress email data in storage (e.g., remove redundant fields)
5. Test performance with 100 emails
6. Add comments for optimizations

### Constraints:
- Stay within Gmail API quotas
- Ensure no sensitive data is logged

### Debugging:
- Monitor performance in Chrome's Task Manager
- Log rate limit errors

**Output**: An optimized, secure extension

---

## Action 12: Test Iteratively

**Goal Reminder**: The goal of Automail is to work reliably across all features.

**Task**: Conduct comprehensive testing.

### Detailed Steps:
1. Create a test Gmail account with:
   - 50 existing emails (varied types: work, personal, spam, promotions)
   - 5 new emails sent during testing
2. Test each module:
   - Email Reading: Verify all emails fetched
   - Labeling: Check correct labels applied
   - Actions: Confirm moves/trash
   - Composition: Validate draft style and sending
   - UI: Test all tabs, buttons, and modals
3. Log all test results in a `test.log` file
4. Fix any failures and retest
5. Add comments summarizing test cases

### Constraints:
- Use a test account to avoid affecting real data
- Cover edge cases (e.g., empty inbox, large attachments)

### Debugging:
- Review logs for errors
- Use Chrome's DevTools for UI issues

**Output**: A fully tested extension

---

## Action 13: Document the Code

**Goal Reminder**: The goal of Automail is to be maintainable for future updates.

**Task**: Add comprehensive documentation.

### Detailed Steps:
1. Add JSDoc-style comments to all functions in `background.js` and `popup.js`
2. Create a `README.md` with:
   - Project overview
   - Setup instructions (e.g., Google Cloud setup, local server)
   - Usage guide for non-technical users
3. Organize code into folders: `src/extension`, `src/server`
4. Test documentation by following setup instructions
5. Add comments for documentation purpose

### Constraints:
- Keep documentation non-technical where possible
- Ensure all functions are covered

### Debugging:
- Verify README instructions work
- Check comment clarity

**Output**: Well-documented code

---

## Action 14: Final Polish

**Goal Reminder**: The goal of Automail is to be intuitive and shareable with friends, family, and the world.

**Task**: Finalize the extension for release.

### Detailed Steps:
1. Abstract technical setup in the UI:
   - Hide API configs behind a "Setup" button that auto-configures
   - Use plain English for all prompts (e.g., "Connect your Gmail")
2. Test the full flow:
   - Login → Start Processing → Process 10 emails → Review UI → Stop Processing
3. Optimize UI for shareability:
   - Add a welcome message in the sidebar
   - Ensure all text is friendly and clear
4. Verify continuous operation (runs until manually stopped)
5. Package the extension for Chrome Web Store (optional)
6. Add comments for final changes

### Constraints:
- Ensure no technical knowledge needed for setup
- Maintain minimalist design

### Debugging:
- Test with non-technical users (simulate family/friends)
- Log any UI confusion

**Output**: A polished, user-ready extension

---

## Development Status Tracking

- ✅ **Action 1: Project Foundation** - COMPLETED
- ✅ **Action 2: OAuth Authentication** - COMPLETED  
- ✅ **Action 3: Email Reading Module** - COMPLETED
- ✅ **Action 4: AI API Setup** - COMPLETED
- ✅ **Action 5: Labeling Module** - COMPLETED
- ⏳ **Action 6: Action Module** - PENDING
- ⏳ **Action 7: Composition Module** - PENDING
- ⏳ **Action 8: Learning Module** - PENDING
- ⏳ **Action 9: UI Design** - PENDING
- ⏳ **Action 10: Contact Management** - PENDING
- ⏳ **Action 11: Performance Optimization** - PENDING
- ⏳ **Action 12: Testing** - PENDING
- ⏳ **Action 13: Documentation** - PENDING
- ⏳ **Action 14: Final Polish** - PENDING

---

*This instruction manual serves as the complete reference for building the Automail extension according to the original specifications.*
