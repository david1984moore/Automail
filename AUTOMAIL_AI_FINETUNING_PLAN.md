<!--
Created on: 6/24/2025
Edited on: 6/24/2025
-->

# Automail AI Fine-Tuning Implementation Plan

## Overview
Transform Automail from zero-shot classification to personalized AI that learns from user's existing Gmail labels and email patterns.

## Current Architecture Analysis

### Client-Side (Chrome Extension)
- **Location**: User's browser
- **Files**: `manifest.json`, `background.js`, `content.js`, `sidebar.css`
- **Responsibilities**:
  - Gmail OAuth authentication
  - Email fetching via Gmail API
  - AI server communication
  - Email labeling and movement
  - User interface management

### Server-Side (Google Cloud)
- **Location**: Google Cloud Platform
- **Files**: `automail-server/` Flask application
- **Current AI**: BART zero-shot classification with 16 predefined categories
- **Responsibilities**:
  - Email content analysis
  - Classification API endpoints
  - Model inference

## Implementation Phases

### Phase 1: Data Collection & Analysis (Week 1-2)

#### 1.1 Gmail Data Harvesting
**Objective**: Extract user's existing Gmail labels and associated emails for training data

**Client-Side Implementation** (`background.js`):
```javascript
/**
 * Collect all user labels and sample emails for training
 */
async function collectUserLabelData(authToken) {
  try {
    console.log('🔍 Collecting user label data for AI training...');
    
    // Get all user-created labels (exclude system labels)
    const labelsResponse = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/labels',
      {
        headers: { 'Authorization': `Bearer ${authToken}` }
      }
    );
    const labelsData = await labelsResponse.json();
    
    // Filter to user-created labels only
    const userLabels = labelsData.labels.filter(label => 
      label.type === 'user' && 
      !['INBOX', 'SENT', 'DRAFT', 'SPAM', 'TRASH'].includes(label.name)
    );
    
    const trainingData = [];
    
    // For each label, collect sample emails (50-100 per label)
    for (const label of userLabels) {
      console.log(`📧 Collecting emails for label: ${label.name}`);
      
      const emailsResponse = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?labelIds=${label.id}&maxResults=100`,
        {
          headers: { 'Authorization': `Bearer ${authToken}` }
        }
      );
      const emailsData = await emailsResponse.json();
      
      if (emailsData.messages) {
        // Get detailed email content for each message
        for (const message of emailsData.messages) {
          const emailDetail = await getEmailDetail(authToken, message.id);
          if (emailDetail) {
            trainingData.push({
              content: `${emailDetail.subject} ${emailDetail.body}`,
              label: label.name,
              metadata: {
                sender: emailDetail.sender,
                date: emailDetail.date,
                messageId: message.id,
                threadId: message.threadId
              }
            });
          }
        }
      }
    }
    
    console.log(`✅ Collected ${trainingData.length} training samples from ${userLabels.length} labels`);
    return trainingData;
    
  } catch (error) {
    console.error('❌ Error collecting user label data:', error);
    return [];
  }
}

/**
 * Send training data to server for processing
 */
async function sendTrainingDataToServer(trainingData, userEmail) {
  try {
    const response = await fetch(`${AI_API_CONFIG.baseUrl}/collect-training-data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': AI_API_CONFIG.apiKey
      },
      body: JSON.stringify({
        user_id: userEmail,
        training_data: trainingData,
        timestamp: Date.now()
      })
    });
    
    return await response.json();
  } catch (error) {
    console.error('❌ Error sending training data to server:', error);
    return { success: false, error: error.message };
  }
}
```

#### 1.2 Training Dataset Structure
**Server-Side Implementation** (`automail-server/utils/training_data.py`):
```python
"""
Training data management for personalized email classification
"""
import json
import pandas as pd
from typing import List, Dict, Tuple
import sqlite3
from datetime import datetime
import hashlib

class TrainingDataManager:
    def __init__(self, data_dir: str = "training_data"):
        self.data_dir = data_dir
        self.db_path = f"{data_dir}/training_data.db"
        self.init_database()
    
    def init_database(self):
        """Initialize SQLite database for training data"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS user_training_data (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                email_content TEXT NOT NULL,
                user_label TEXT NOT NULL,
                sender TEXT,
                date TEXT,
                message_id TEXT,
                thread_id TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_validated BOOLEAN DEFAULT FALSE
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS user_models (
                user_id TEXT PRIMARY KEY,
                model_path TEXT,
                training_samples INTEGER,
                accuracy REAL,
                last_trained TIMESTAMP,
                model_version INTEGER DEFAULT 1
            )
        ''')
        
        conn.commit()
        conn.close()
    
    def store_training_data(self, user_id: str, training_data: List[Dict]) -> bool:
        """Store training data for a user"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            for sample in training_data:
                cursor.execute('''
                    INSERT INTO user_training_data 
                    (user_id, email_content, user_label, sender, date, message_id, thread_id)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                ''', (
                    user_id,
                    sample['content'],
                    sample['label'],
                    sample['metadata'].get('sender', ''),
                    sample['metadata'].get('date', ''),
                    sample['metadata'].get('messageId', ''),
                    sample['metadata'].get('threadId', '')
                ))
            
            conn.commit()
            conn.close()
            return True
            
        except Exception as e:
            print(f"Error storing training data: {e}")
            return False
    
    def get_training_data(self, user_id: str) -> pd.DataFrame:
        """Retrieve training data for a user"""
        conn = sqlite3.connect(self.db_path)
        query = '''
            SELECT email_content, user_label, sender, date 
            FROM user_training_data 
            WHERE user_id = ? AND is_validated = TRUE
        '''
        df = pd.read_sql_query(query, conn, params=(user_id,))
        conn.close()
        return df
```

#### 1.3 Data Quality Assessment
**Server-Side Implementation** (`automail-server/utils/data_analysis.py`):
```python
def analyze_user_training_data(user_id: str) -> Dict:
    """Analyze user's training data quality and distribution"""
    data_manager = TrainingDataManager()
    df = data_manager.get_training_data(user_id)
    
    analysis = {
        'total_samples': len(df),
        'unique_labels': df['user_label'].nunique(),
        'label_distribution': df['user_label'].value_counts().to_dict(),
        'min_samples_per_label': df['user_label'].value_counts().min(),
        'max_samples_per_label': df['user_label'].value_counts().max(),
        'labels_with_insufficient_data': [],
        'training_readiness': False
    }
    
    # Identify labels with insufficient training data
    for label, count in analysis['label_distribution'].items():
        if count < 20:  # Minimum threshold for training
            analysis['labels_with_insufficient_data'].append({
                'label': label,
                'current_samples': count,
                'needed_samples': 20 - count
            })
    
    # Determine if ready for training
    analysis['training_readiness'] = (
        analysis['total_samples'] >= 100 and
        analysis['unique_labels'] >= 3 and
        analysis['min_samples_per_label'] >= 20
    )
    
    return analysis
```

### Phase 2: Model Architecture Upgrade (Week 3)

#### 2.1 Personalized Classification Model
**Server-Side Implementation** (`automail-server/utils/personalized_classifier.py`):
```python
"""
Personalized email classifier using fine-tuned DistilBERT
"""
import torch
from transformers import (
    DistilBertTokenizer, 
    DistilBertForSequenceClassification,
    TrainingArguments,
    Trainer,
    DataCollatorWithPadding
)
from datasets import Dataset
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report
import os
import json

class PersonalizedEmailClassifier:
    def __init__(self, user_id: str):
        self.user_id = user_id
        self.base_model = "distilbert-base-uncased"
        self.user_model_path = f"models/user_{user_id}_classifier"
        self.tokenizer = DistilBertTokenizer.from_pretrained(self.base_model)
        self.model = None
        self.label_to_id = {}
        self.id_to_label = {}
        
    def prepare_training_data(self, training_df) -> Dataset:
        """Prepare training data for DistilBERT"""
        # Create label mappings
        unique_labels = training_df['user_label'].unique()
        self.label_to_id = {label: idx for idx, label in enumerate(unique_labels)}
        self.id_to_label = {idx: label for label, idx in self.label_to_id.items()}
        
        # Convert labels to IDs
        training_df['label_id'] = training_df['user_label'].map(self.label_to_id)
        
        # Split data
        train_texts, val_texts, train_labels, val_labels = train_test_split(
            training_df['email_content'].tolist(),
            training_df['label_id'].tolist(),
            test_size=0.2,
            random_state=42,
            stratify=training_df['label_id']
        )
        
        # Tokenize
        train_encodings = self.tokenizer(train_texts, truncation=True, padding=True, max_length=512)
        val_encodings = self.tokenizer(val_texts, truncation=True, padding=True, max_length=512)
        
        # Create datasets
        train_dataset = Dataset.from_dict({
            'input_ids': train_encodings['input_ids'],
            'attention_mask': train_encodings['attention_mask'],
            'labels': train_labels
        })
        
        val_dataset = Dataset.from_dict({
            'input_ids': val_encodings['input_ids'],
            'attention_mask': val_encodings['attention_mask'],
            'labels': val_labels
        })
        
        return train_dataset, val_dataset
    
    def fine_tune_model(self, training_df) -> Dict:
        """Fine-tune DistilBERT on user's email data"""
        try:
            # Prepare data
            train_dataset, val_dataset = self.prepare_training_data(training_df)
            
            # Load model
            self.model = DistilBertForSequenceClassification.from_pretrained(
                self.base_model,
                num_labels=len(self.label_to_id)
            )
            
            # Training arguments
            training_args = TrainingArguments(
                output_dir=f'./results/{self.user_id}',
                num_train_epochs=3,
                per_device_train_batch_size=16,
                per_device_eval_batch_size=16,
                warmup_steps=500,
                weight_decay=0.01,
                logging_dir=f'./logs/{self.user_id}',
                evaluation_strategy="epoch",
                save_strategy="epoch",
                load_best_model_at_end=True,
                metric_for_best_model="eval_loss",
                greater_is_better=False
            )
            
            # Data collator
            data_collator = DataCollatorWithPadding(tokenizer=self.tokenizer)
            
            # Trainer
            trainer = Trainer(
                model=self.model,
                args=training_args,
                train_dataset=train_dataset,
                eval_dataset=val_dataset,
                data_collator=data_collator,
                tokenizer=self.tokenizer
            )
            
            # Train
            trainer.train()
            
            # Save model
            os.makedirs(self.user_model_path, exist_ok=True)
            trainer.save_model(self.user_model_path)
            self.tokenizer.save_pretrained(self.user_model_path)
            
            # Save label mappings
            with open(f"{self.user_model_path}/label_mappings.json", 'w') as f:
                json.dump({
                    'label_to_id': self.label_to_id,
                    'id_to_label': self.id_to_label
                }, f)
            
            # Evaluate
            predictions = trainer.predict(val_dataset)
            accuracy = accuracy_score(val_dataset['labels'], predictions.predictions.argmax(-1))
            
            return {
                'success': True,
                'accuracy': accuracy,
                'model_path': self.user_model_path,
                'num_labels': len(self.label_to_id),
                'training_samples': len(training_df)
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    def load_user_model(self) -> bool:
        """Load user's trained model"""
        try:
            if not os.path.exists(self.user_model_path):
                return False
                
            self.model = DistilBertForSequenceClassification.from_pretrained(self.user_model_path)
            self.tokenizer = DistilBertTokenizer.from_pretrained(self.user_model_path)
            
            # Load label mappings
            with open(f"{self.user_model_path}/label_mappings.json", 'r') as f:
                mappings = json.load(f)
                self.label_to_id = mappings['label_to_id']
                self.id_to_label = mappings['id_to_label']
            
            return True
        except Exception as e:
            print(f"Error loading user model: {e}")
            return False
    
    def classify_email(self, content: str, subject: str = "") -> Dict:
        """Classify email using personalized model"""
        try:
            if self.model is None:
                if not self.load_user_model():
                    return {'error': 'Model not available'}
            
            # Preprocess
            full_text = f"{subject} {content}"
            inputs = self.tokenizer(full_text, truncation=True, padding=True, max_length=512, return_tensors="pt")
            
            # Predict
            with torch.no_grad():
                outputs = self.model(**inputs)
                predictions = torch.nn.functional.softmax(outputs.logits, dim=-1)
                predicted_class_id = predictions.argmax().item()
                confidence = predictions[0][predicted_class_id].item()
            
            predicted_label = self.id_to_label[predicted_class_id]
            
            return {
                'label': predicted_label,
                'confidence': round(confidence, 3),
                'reasoning': f'Personalized AI classification trained on user data'
            }
            
        except Exception as e:
            return {
                'error': f'Classification failed: {str(e)}',
                'label': 'Review',
                'confidence': 0.1
            }
```

#### 2.2 Server API Endpoints
**Server-Side Implementation** (`automail-server/app.py` additions):
```python
@app.route('/collect-training-data', methods=['POST'])
@require_api_key
@validate_request_data(['user_id', 'training_data'])
def collect_training_data():
    """Collect and store user's training data"""
    try:
        data = request.validated_data
        user_id = data['user_id']
        training_data = data['training_data']
        
        # Store training data
        data_manager = TrainingDataManager()
        success = data_manager.store_training_data(user_id, training_data)
        
        if success:
            # Analyze data quality
            analysis = analyze_user_training_data(user_id)
            
            return jsonify({
                'success': True,
                'message': f'Stored {len(training_data)} training samples',
                'analysis': analysis
            }), 200
        else:
            return jsonify({
                'success': False,
                'error': 'Failed to store training data'
            }), 500
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/train-personalized-model', methods=['POST'])
@require_api_key
@validate_request_data(['user_id'])
def train_personalized_model():
    """Train personalized model for user"""
    try:
        data = request.validated_data
        user_id = data['user_id']
        
        # Get training data
        data_manager = TrainingDataManager()
        training_df = data_manager.get_training_data(user_id)
        
        if len(training_df) < 100:
            return jsonify({
                'success': False,
                'error': 'Insufficient training data',
                'required_samples': 100,
                'current_samples': len(training_df)
            }), 400
        
        # Train model
        classifier = PersonalizedEmailClassifier(user_id)
        result = classifier.fine_tune_model(training_df)
        
        if result['success']:
            # Update model registry
            data_manager.update_model_info(user_id, result)
            
        return jsonify(result), 200 if result['success'] else 500
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/classify-personalized', methods=['POST'])
@require_api_key
@validate_request_data(['user_id', 'content'])
def classify_with_personalized_model():
    """Classify email using user's personalized model"""
    try:
        data = request.validated_data
        user_id = data['user_id']
        content = data['content']
        subject = data.get('subject', '')
        
        # Use personalized classifier
        classifier = PersonalizedEmailClassifier(user_id)
        result = classifier.classify_email(content, subject)
        
        # Fallback to general model if personalized fails
        if 'error' in result:
            general_classifier = get_classifier()  # Existing general classifier
            result = general_classifier.classify_email(content, subject)
            result['source'] = 'general_model'
        else:
            result['source'] = 'personalized_model'
        
        return jsonify(result), 200
        
    except Exception as e:
        return jsonify({
            'error': str(e),
            'label': 'Review',
            'confidence': 0.1
        }), 500
```

### Phase 3: Smart Label Creation (Week 4)

#### 3.1 Dynamic Label Generation
**Server-Side Implementation** (`automail-server/utils/label_suggestions.py`):
```python
"""
Smart label suggestion system using clustering and keyword extraction
"""
import numpy as np
from sklearn.cluster import KMeans, DBSCAN
from sklearn.feature_extraction.text import TfidfVectorizer
from transformers import pipeline
import re
from typing import List, Dict, Tuple

class LabelSuggestionEngine:
    def __init__(self):
        self.vectorizer = TfidfVectorizer(max_features=1000, stop_words='english')
        self.summarizer = pipeline("summarization", model="facebook/bart-large-cnn")
        
    def suggest_labels_for_unlabeled_emails(self, emails: List[Dict], min_cluster_size: int = 5) -> List[Dict]:
        """Suggest new labels for unlabeled emails using clustering"""
        try:
            if len(emails) < min_cluster_size:
                return []
            
            # Extract text content
            texts = [f"{email.get('subject', '')} {email.get('content', '')}" for email in emails]
            
            # Vectorize emails
            tfidf_matrix = self.vectorizer.fit_transform(texts)
            
            # Perform clustering
            n_clusters = min(5, len(emails) // min_cluster_size)  # Max 5 clusters
            kmeans = KMeans(n_clusters=n_clusters, random_state=42)
            cluster_labels = kmeans.fit_predict(tfidf_matrix)
            
            suggestions = []
            
            # Generate label suggestions for each cluster
            for cluster_id in range(n_clusters):
                cluster_emails = [emails[i] for i, label in enumerate(cluster_labels) if label == cluster_id]
                
                if len(cluster_emails) >= min_cluster_size:
                    suggested_label = self.generate_label_name(cluster_emails)
                    
                    suggestions.append({
                        'suggested_label': suggested_label,
                        'email_count': len(cluster_emails),
                        'confidence': self.calculate_cluster_confidence(cluster_emails),
                        'sample_emails': cluster_emails[:3],  # First 3 as examples
                        'keywords': self.extract_keywords(cluster_emails)
                    })
            
            return suggestions
            
        except Exception as e:
            print(f"Error generating label suggestions: {e}")
            return []
    
    def generate_label_name(self, emails: List[Dict]) -> str:
        """Generate a meaningful label name for a cluster of emails"""
        try:
            # Extract keywords using TF-IDF
            texts = [f"{email.get('subject', '')} {email.get('content', '')}" for email in emails]
            combined_text = " ".join(texts)
            
            # Get top keywords
            vectorizer = TfidfVectorizer(max_features=10, stop_words='english', ngram_range=(1, 2))
            tfidf_matrix = vectorizer.fit_transform([combined_text])
            feature_names = vectorizer.get_feature_names_out()
            scores = tfidf_matrix.toarray()[0]
            
            # Get top keywords
            top_keywords = [feature_names[i] for i in scores.argsort()[-3:][::-1]]
            
            # Generate label based on patterns
            label_name = self.create_label_from_keywords(top_keywords, emails)
            
            return label_name
            
        except Exception as e:
            return "Auto-Suggested"
    
    def create_label_from_keywords(self, keywords: List[str], emails: List[Dict]) -> str:
        """Create a label name from keywords and email patterns"""
        # Common email patterns
        if any('meeting' in kw.lower() or 'calendar' in kw.lower() for kw in keywords):
            return "Meetings"
        elif any('invoice' in kw.lower() or 'payment' in kw.lower() or 'bill' in kw.lower() for kw in keywords):
            return "Finance"
        elif any('newsletter' in kw.lower() or 'update' in kw.lower() for kw in keywords):
            return "Newsletters"
        elif any('project' in kw.lower() or 'task' in kw.lower() for kw in keywords):
            return "Projects"
        elif any('social' in kw.lower() or 'friend' in kw.lower() for kw in keywords):
            return "Social"
        else:
            # Use most relevant keyword as base
            main_keyword = keywords[0] if keywords else "misc"
            return main_keyword.title().replace('_', ' ')
    
    def extract_keywords(self, emails: List[Dict]) -> List[str]:
        """Extract meaningful keywords from email cluster"""
        texts = [f"{email.get('subject', '')} {email.get('content', '')}" for email in emails]
        combined_text = " ".join(texts)
        
        vectorizer = TfidfVectorizer(max_features=20, stop_words='english')
        tfidf_matrix = vectorizer.fit_transform([combined_text])
        feature_names = vectorizer.get_feature_names_out()
        scores = tfidf_matrix.toarray()[0]
        
        # Return top keywords
        top_indices = scores.argsort()[-10:][::-1]
        return [feature_names[i] for i in top_indices]
    
    def calculate_cluster_confidence(self, emails: List[Dict]) -> float:
        """Calculate confidence score for cluster quality"""
        # Simple heuristic based on cluster size and keyword consistency
        cluster_size = len(emails)
        size_score = min(1.0, cluster_size / 10)  # Normalize to 1.0
        
        # Keyword consistency (simplified)
        keywords = self.extract_keywords(emails)
        consistency_score = min(1.0, len(keywords) / 5)  # More keywords = more coherent
        
        return (size_score + consistency_score) / 2
```

#### 3.2 Client-Side Label Suggestion UI
**Client-Side Implementation** (`content.js` additions):
```javascript
/**
 * Handle label suggestions for unlabeled emails
 */
async function suggestLabelsForUnlabeledEmails() {
  try {
    showLoading('Analyzing unlabeled emails...');
    
    // Get unlabeled emails (emails still in inbox after processing)
    const authToken = await getStoredAuthToken();
    const unlabeledEmails = await getUnlabeledEmails(authToken);
    
    if (unlabeledEmails.length < 5) {
      updateStatus('Not enough unlabeled emails for suggestions (minimum 5 required)', 'warning');
      return;
    }
    
    // Send to server for analysis
    const response = await fetch(`${AI_API_CONFIG.baseUrl}/suggest-labels`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': AI_API_CONFIG.apiKey
      },
      body: JSON.stringify({
        user_id: await getUserEmail(),
        emails: unlabeledEmails
      })
    });
    
    const suggestions = await response.json();
    
    if (suggestions.success && suggestions.label_suggestions.length > 0) {
      showLabelSuggestionsModal(suggestions.label_suggestions);
    } else {
      updateStatus('No label suggestions found', 'info');
    }
    
  } catch (error) {
    console.error('Error getting label suggestions:', error);
    updateStatus('Failed to get label suggestions', 'error');
  } finally {
    hideLoading();
  }
}

/**
 * Show modal with label suggestions
 */
function showLabelSuggestionsModal(suggestions) {
  const modalHTML = `
    <div class="automail-modal-content">
      <h3>🏷️ Smart Label Suggestions</h3>
      <p>Based on analysis of your unlabeled emails, here are suggested new labels:</p>
      
      <div class="label-suggestions-list">
        ${suggestions.map((suggestion, index) => `
          <div class="suggestion-item" data-index="${index}">
            <div class="suggestion-header">
              <h4>${suggestion.suggested_label}</h4>
              <span class="email-count">${suggestion.email_count} emails</span>
              <span class="confidence-score">Confidence: ${(suggestion.confidence * 100).toFixed(0)}%</span>
            </div>
            
            <div class="suggestion-details">
              <div class="keywords">
                <strong>Keywords:</strong> ${suggestion.keywords.slice(0, 5).join(', ')}
              </div>
              
              <div class="sample-emails">
                <strong>Sample emails:</strong>
                <ul>
                  ${suggestion.sample_emails.map(email => `
                    <li>${email.subject || 'No subject'} - ${email.sender}</li>
                  `).join('')}
                </ul>
              </div>
            </div>
            
            <div class="suggestion-actions">
              <button class="automail-btn automail-btn-primary accept-suggestion" data-index="${index}">
                ✅ Create Label
              </button>
              <button class="automail-btn automail-btn-secondary modify-suggestion" data-index="${index}">
                ✏️ Modify Name
              </button>
              <button class="automail-btn automail-btn-secondary reject-suggestion" data-index="${index}">
                ❌ Reject
              </button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  
  const buttons = [
    {
      text: 'Close',
      class: 'automail-btn-secondary',
      onclick: () => document.querySelector('.automail-modal').remove()
    }
  ];
  
  const modal = createModal('Smart Label Suggestions', modalHTML, buttons);
  
  // Add event listeners for suggestion actions
  setupSuggestionActionListeners(suggestions);
}

/**
 * Set up event listeners for suggestion actions
 */
function setupSuggestionActionListeners(suggestions) {
  // Accept suggestion
  document.querySelectorAll('.accept-suggestion').forEach(button => {
    button.addEventListener('click', async (e) => {
      const index = parseInt(e.target.dataset.index);
      const suggestion = suggestions[index];
      await createLabelFromSuggestion(suggestion);
    });
  });
  
  // Modify suggestion
  document.querySelectorAll('.modify-suggestion').forEach(button => {
    button.addEventListener('click', (e) => {
      const index = parseInt(e.target.dataset.index);
      const suggestion = suggestions[index];
      showModifyLabelModal(suggestion);
    });
  });
  
  // Reject suggestion
  document.querySelectorAll('.reject-suggestion').forEach(button => {
    button.addEventListener('click', (e) => {
      const index = parseInt(e.target.dataset.index);
      e.target.closest('.suggestion-item').remove();
    });
  });
}

/**
 * Create label from accepted suggestion
 */
async function createLabelFromSuggestion(suggestion) {
  try {
    const authToken = await getStoredAuthToken();
    
    // Create the label in Gmail
    const labelResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: suggestion.suggested_label,
        messageListVisibility: 'show',
        labelListVisibility: 'labelShow'
      })
    });
    
    if (labelResponse.ok) {
      const newLabel = await labelResponse.json();
      updateStatus(`✅ Created label: ${suggestion.suggested_label}`, 'success');
      
      // Optionally: Ask user if they want to apply this label to the suggested emails
      showApplyLabelConfirmation(newLabel, suggestion);
    } else {
      updateStatus(`❌ Failed to create label: ${suggestion.suggested_label}`, 'error');
    }
    
  } catch (error) {
    console.error('Error creating label from suggestion:', error);
    updateStatus('Failed to create suggested label', 'error');
  }
}
```

### Phase 4: Implementation Timeline

#### Week 1: Data Collection Infrastructure
- [ ] Implement `collectUserLabelData()` in `background.js`
- [ ] Create `TrainingDataManager` class in server
- [ ] Add `/collect-training-data` API endpoint
- [ ] Create database schema for training data
- [ ] Add data quality analysis functions
- [ ] Test with real Gmail data

#### Week 2: Model Training Pipeline
- [ ] Implement `PersonalizedEmailClassifier` class
- [ ] Add model training infrastructure
- [ ] Create `/train-personalized-model` endpoint
- [ ] Set up model storage in Google Cloud Storage
- [ ] Implement model loading and inference
- [ ] Add fallback to general model

#### Week 3: Integration & Testing
- [ ] Update client-side to use personalized classification
- [ ] Implement user feedback collection
- [ ] Add model performance monitoring
- [ ] Create retraining schedule
- [ ] Test end-to-end workflow
- [ ] Performance optimization

#### Week 4: Smart Features
- [ ] Implement label suggestion engine
- [ ] Add clustering and keyword extraction
- [ ] Create suggestion UI components
- [ ] Implement continuous learning loop
- [ ] Add user preference learning
- [ ] Final testing and optimization

### Phase 5: Success Metrics

#### Performance Indicators
- **Classification Accuracy**: >85% on user's email data
- **User Satisfaction**: <10% manual corrections needed
- **Processing Speed**: <2 seconds per email
- **Training Time**: <30 minutes for initial model
- **Label Relevance**: >80% of suggested labels accepted

#### Monitoring & Analytics
- Track classification accuracy over time
- Monitor user correction frequency
- Measure label suggestion acceptance rate
- Analyze model performance degradation
- User engagement metrics

### Phase 6: Future Enhancements

#### Advanced AI Features
- Multi-label classification (emails with multiple categories)
- Priority scoring based on content and sender
- Automated response generation
- Email summarization
- Smart scheduling integration

#### Collaborative Learning
- Anonymous pattern sharing across users
- Industry-specific model variants
- Federated learning implementation
- Community label suggestions

#### Enterprise Features
- Team-based label sharing
- Department-specific models
- Integration with enterprise email systems
- Advanced security and compliance features

## Technical Requirements

### Server Infrastructure
- **CPU**: Minimum 4 cores for model training
- **RAM**: 16GB minimum for DistilBERT fine-tuning
- **Storage**: 50GB for models and training data
- **GPU**: Optional but recommended for faster training

### Dependencies
- **Python**: transformers, torch, sklearn, pandas, flask
- **JavaScript**: No additional dependencies beyond existing
- **Database**: SQLite for development, PostgreSQL for production

### Security Considerations
- Encrypt training data at rest
- Secure API key management
- User data isolation
- GDPR compliance for EU users
- Regular security audits

## Risk Mitigation

### Technical Risks
- **Model Training Failures**: Implement robust error handling and fallbacks
- **Performance Issues**: Monitor and optimize resource usage
- **Data Quality Problems**: Implement validation and cleaning pipelines

### User Experience Risks
- **Poor Predictions**: Maintain fallback to rule-based classification
- **Training Time**: Provide clear progress indicators
- **Complex UI**: Keep interface simple and intuitive

### Business Risks
- **API Rate Limits**: Implement efficient batching and caching
- **Storage Costs**: Monitor and optimize model storage
- **User Adoption**: Provide clear value demonstration 