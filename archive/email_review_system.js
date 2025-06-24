/**
 * EMAIL REVIEW & CORRECTION SYSTEM
 * 
 * Comprehensive system for reviewing, correcting, and optimizing email classifications
 * after automated processing is complete.
 */

class EmailReviewSystem {
  constructor() {
    this.processedEmails = [];
    this.categories = ['Security', 'Newsletter', 'Finance', 'Support', 'General'];
    this.userCorrections = [];
    this.customRules = [];
  }

  /**
   * Initialize the review system - gather all processed emails
   */
  async initialize() {
    console.log('🔍 Initializing Email Review System...');
    
    try {
      // Get auth token
      const { authToken } = await chrome.storage.local.get(['authToken']);
      if (!authToken) {
        throw new Error('Not authenticated');
      }

      // Gather all emails from Automail labels
      await this.gatherProcessedEmails(authToken);
      
      // Analyze classifications
      this.analyzeClassifications();
      
      // Display review dashboard
      this.displayReviewDashboard();
      
      console.log('✅ Email Review System initialized');
      
    } catch (error) {
      console.error('❌ Failed to initialize review system:', error);
      throw error;
    }
  }

  /**
   * Gather all emails that were processed and moved to Automail labels
   */
  async gatherProcessedEmails(authToken) {
    console.log('📧 Gathering processed emails...');
    
    this.processedEmails = [];
    
    for (const category of this.categories) {
      try {
        const labelName = `Automail-${category}`;
        const emails = await this.getEmailsInLabel(authToken, labelName);
        
        for (const email of emails) {
          email.currentCategory = category;
          email.originalCategory = category; // Track original classification
          email.confidence = this.calculateConfidence(email, category);
          email.needsReview = email.confidence < 0.7; // Flag low confidence emails
        }
        
        this.processedEmails.push(...emails);
        console.log(`📂 Found ${emails.length} emails in ${labelName}`);
        
      } catch (error) {
        console.error(`❌ Error gathering emails from ${category}:`, error);
      }
    }
    
    console.log(`📊 Total processed emails found: ${this.processedEmails.length}`);
  }

  /**
   * Get emails in a specific label
   */
  async getEmailsInLabel(authToken, labelName) {
    try {
      // First get the label ID
      const labelsResponse = await fetch(
        'https://gmail.googleapis.com/gmail/v1/users/me/labels',
        { headers: { 'Authorization': `Bearer ${authToken}` } }
      );
      
      if (!labelsResponse.ok) {
        throw new Error(`Failed to get labels: ${labelsResponse.status}`);
      }
      
      const labelsData = await labelsResponse.json();
      const label = labelsData.labels.find(l => l.name === labelName);
      
      if (!label) {
        console.log(`📂 Label ${labelName} not found`);
        return [];
      }
      
      // Get emails in this label
      const messagesResponse = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?labelIds=${label.id}&maxResults=100`,
        { headers: { 'Authorization': `Bearer ${authToken}` } }
      );
      
      if (!messagesResponse.ok) {
        throw new Error(`Failed to get messages: ${messagesResponse.status}`);
      }
      
      const messagesData = await messagesResponse.json();
      
      if (!messagesData.messages) {
        return [];
      }
      
      // Get detailed information for each email
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
   * Calculate confidence score for an email classification
   */
  calculateConfidence(email, category) {
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
        if (from.includes('noreply') || from.includes('newsletter')) {
          confidence += 0.3;
        }
        if (subject.includes('unsubscribe') || snippet.includes('unsubscribe')) {
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
   * Analyze classifications and identify patterns
   */
  analyzeClassifications() {
    console.log('📊 Analyzing classifications...');
    
    this.analysisResults = {
      totalEmails: this.processedEmails.length,
      categoryBreakdown: {},
      lowConfidenceEmails: [],
      potentialIssues: [],
      senderPatterns: {},
      subjectPatterns: {}
    };
    
    // Category breakdown
    for (const category of this.categories) {
      const categoryEmails = this.processedEmails.filter(e => e.currentCategory === category);
      this.analysisResults.categoryBreakdown[category] = {
        count: categoryEmails.length,
        avgConfidence: categoryEmails.reduce((sum, e) => sum + e.confidence, 0) / categoryEmails.length || 0,
        needsReview: categoryEmails.filter(e => e.needsReview).length
      };
    }
    
    // Low confidence emails
    this.analysisResults.lowConfidenceEmails = this.processedEmails
      .filter(e => e.needsReview)
      .sort((a, b) => a.confidence - b.confidence);
    
    // Sender patterns
    const senderCounts = {};
    this.processedEmails.forEach(email => {
      const sender = email.from.split('<')[0].trim();
      if (!senderCounts[sender]) {
        senderCounts[sender] = { total: 0, categories: {} };
      }
      senderCounts[sender].total++;
      senderCounts[sender].categories[email.currentCategory] = 
        (senderCounts[sender].categories[email.currentCategory] || 0) + 1;
    });
    
    this.analysisResults.senderPatterns = senderCounts;
    
    console.log('📈 Analysis complete:', this.analysisResults);
  }

  /**
   * Display the review dashboard in the sidebar
   */
  displayReviewDashboard() {
    console.log('🎛️ Displaying review dashboard...');
    
    // Create dashboard HTML
    const dashboardHTML = this.createDashboardHTML();
    
    // Send to content script to display
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].url.includes('mail.google.com')) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'showReviewDashboard',
          html: dashboardHTML,
          data: this.analysisResults
        });
      }
    });
  }

  /**
   * Create the HTML for the review dashboard
   */
  createDashboardHTML() {
    return `
      <div class="email-review-dashboard">
        <h3>📊 Email Processing Review</h3>
        
        <div class="processing-summary">
          <p><strong>Total Processed:</strong> ${this.analysisResults.totalEmails} emails</p>
          <p><strong>Needs Review:</strong> ${this.analysisResults.lowConfidenceEmails.length} emails</p>
        </div>
        
        <div class="category-breakdown">
          <h4>📂 Category Breakdown</h4>
          ${Object.entries(this.analysisResults.categoryBreakdown).map(([category, stats]) => `
            <div class="category-item">
              <div class="category-header">
                <span class="category-name">${category}</span>
                <span class="category-count">${stats.count} emails</span>
              </div>
              <div class="category-stats">
                <div class="confidence-bar">
                  <div class="confidence-fill" style="width: ${stats.avgConfidence * 100}%"></div>
                </div>
                <span class="confidence-text">${Math.round(stats.avgConfidence * 100)}% confidence</span>
                ${stats.needsReview > 0 ? `<span class="needs-review">${stats.needsReview} need review</span>` : ''}
              </div>
              <div class="category-actions">
                <button onclick="reviewCategory('${category}')" class="btn-review">Review ${category}</button>
                <button onclick="viewEmails('${category}')" class="btn-view">View All</button>
              </div>
            </div>
          `).join('')}
        </div>
        
        <div class="quick-actions">
          <h4>⚡ Quick Actions</h4>
          <button onclick="reviewLowConfidence()" class="btn-primary">Review Low Confidence Emails</button>
          <button onclick="createCustomRule()" class="btn-secondary">Create Custom Rule</button>
          <button onclick="bulkReclassify()" class="btn-secondary">Bulk Reclassify</button>
          <button onclick="undoProcessing()" class="btn-danger">Undo All Processing</button>
        </div>
        
        <div class="search-section">
          <h4>🔍 Find Emails</h4>
          <input type="text" id="email-search" placeholder="Search by sender, subject, or content...">
          <button onclick="searchEmails()" class="btn-search">Search</button>
        </div>
      </div>
    `;
  }

  /**
   * Reclassify an email to a different category
   */
  async reclassifyEmail(emailId, newCategory, reason = 'user_correction') {
    try {
      console.log(`🔄 Reclassifying email ${emailId} to ${newCategory}`);
      
      const { authToken } = await chrome.storage.local.get(['authToken']);
      if (!authToken) {
        throw new Error('Not authenticated');
      }
      
      // Find the email
      const email = this.processedEmails.find(e => e.id === emailId);
      if (!email) {
        throw new Error('Email not found');
      }
      
      const oldCategory = email.currentCategory;
      
      // Get label IDs
      const oldLabelId = await this.getLabelId(authToken, `Automail-${oldCategory}`);
      const newLabelId = await this.getLabelId(authToken, `Automail-${newCategory}`);
      
      // Move email to new label
      const response = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${emailId}/modify`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            addLabelIds: [newLabelId],
            removeLabelIds: [oldLabelId]
          })
        }
      );
      
      if (!response.ok) {
        throw new Error(`Failed to reclassify email: ${response.status}`);
      }
      
      // Update local data
      email.currentCategory = newCategory;
      email.confidence = this.calculateConfidence(email, newCategory);
      
      // Record the correction for learning
      this.userCorrections.push({
        emailId,
        oldCategory,
        newCategory,
        reason,
        timestamp: Date.now(),
        email: {
          subject: email.subject,
          from: email.from,
          snippet: email.snippet
        }
      });
      
      // Save corrections to storage
      await chrome.storage.local.set({ 
        userCorrections: this.userCorrections 
      });
      
      console.log(`✅ Email reclassified: ${oldCategory} → ${newCategory}`);
      return true;
      
    } catch (error) {
      console.error('❌ Failed to reclassify email:', error);
      throw error;
    }
  }

  /**
   * Get label ID by name
   */
  async getLabelId(authToken, labelName) {
    const response = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/labels',
      { headers: { 'Authorization': `Bearer ${authToken}` } }
    );
    
    if (!response.ok) {
      throw new Error(`Failed to get labels: ${response.status}`);
    }
    
    const data = await response.json();
    const label = data.labels.find(l => l.name === labelName);
    
    if (!label) {
      throw new Error(`Label ${labelName} not found`);
    }
    
    return label.id;
  }

  /**
   * Create a custom classification rule based on user patterns
   */
  async createCustomRule(pattern, category, description) {
    const rule = {
      id: Date.now().toString(),
      pattern,
      category,
      description,
      created: Date.now(),
      timesApplied: 0
    };
    
    this.customRules.push(rule);
    
    await chrome.storage.local.set({
      customRules: this.customRules
    });
    
    console.log('✅ Custom rule created:', rule);
    return rule;
  }

  /**
   * Undo all processing - move emails back to inbox
   */
  async undoAllProcessing() {
    console.log('🔄 Undoing all email processing...');
    
    try {
      const { authToken } = await chrome.storage.local.get(['authToken']);
      if (!authToken) {
        throw new Error('Not authenticated');
      }
      
      let restored = 0;
      let errors = 0;
      
      for (const email of this.processedEmails) {
        try {
          // Get current label ID
          const currentLabelId = await this.getLabelId(authToken, `Automail-${email.currentCategory}`);
          
          // Move back to inbox
          const response = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${email.id}/modify`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                addLabelIds: ['INBOX'],
                removeLabelIds: [currentLabelId]
              })
            }
          );
          
          if (response.ok) {
            restored++;
          } else {
            errors++;
          }
          
          // Small delay to respect rate limits
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (error) {
          console.error(`❌ Error restoring email ${email.id}:`, error);
          errors++;
        }
      }
      
      console.log(`✅ Undo complete: ${restored} emails restored, ${errors} errors`);
      return { restored, errors };
      
    } catch (error) {
      console.error('❌ Failed to undo processing:', error);
      throw error;
    }
  }
}

// Export for use in background script
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EmailReviewSystem;
} 