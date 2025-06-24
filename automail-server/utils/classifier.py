"""
Email Classification using DistilBERT
Provides intelligent email categorization for the Automail system
"""
import os
import re
import logging
from typing import Dict, List, Tuple, Optional
import torch
from transformers import (
    DistilBertTokenizer, 
    DistilBertForSequenceClassification, 
    pipeline
)
from config.config import get_config

config = get_config()
logger = logging.getLogger(__name__)

class EmailClassifier:
    """
    AI-powered email classifier using DistilBERT
    Provides email categorization with confidence scores
    """
    
    def __init__(self):
        self.model = None
        self.tokenizer = None
        self.classifier = None
        self.labels = config.CLASSIFICATION_LABELS
        self.model_cache_dir = config.MODEL_CACHE_DIR
        self.is_loaded = False
        
        # Ensure model cache directory exists
        os.makedirs(self.model_cache_dir, exist_ok=True)
        
    def load_model(self) -> bool:
        """
        Load proper email classification model
        Returns True if successful, False otherwise
        """
        try:
            logger.info("Loading email classification model...")
            
            # Use a proper text classification model for emails
            # Option 1: Use zero-shot classification with email categories
            model_name = "facebook/bart-large-mnli"  # Better for email classification
            
            from transformers import pipeline
            
            # Create zero-shot classification pipeline
            self.classifier = pipeline(
                "zero-shot-classification",
                model=model_name,
                device=0 if torch.cuda.is_available() else -1
            )
            
                    # Define comprehensive email classification labels for detailed categorization
        self.classification_labels = [
            "work and business communications",
            "personal and social messages", 
            "spam and promotional content",
            "important and urgent notifications",
            "newsletters and updates",
            "financial and banking communications",
            "shopping and e-commerce notifications",
            "travel and booking confirmations",
            "educational and learning content",
            "social media and platform notifications",
            "health and medical communications",
            "legal and official documents",
            "technical and IT communications",
            "project management and collaboration",
            "customer service and support",
            "entertainment and media content"
        ]
            
            self.is_loaded = True
            logger.info("Email classification model loaded successfully")
            return True
            
        except Exception as e:
            logger.error(f"Failed to load email classification model: {str(e)}")
            # Fallback to rule-based if model fails
            self.is_loaded = False
            return False
    
    def preprocess_email_content(self, content: str, subject: str = "") -> str:
        """
        Preprocess email content for better classification
        Combines subject and content, cleans text
        """
        try:
            # Combine subject and content
            full_text = f"{subject} {content}" if subject else content
            
            # Remove excessive whitespace
            full_text = re.sub(r'\s+', ' ', full_text)
            
            # Remove email signatures (common patterns)
            full_text = re.sub(r'--\s*\n.*', '', full_text, flags=re.DOTALL)
            full_text = re.sub(r'Sent from my.*', '', full_text)
            full_text = re.sub(r'Best regards.*', '', full_text, flags=re.DOTALL)
            
            # Remove URLs
            full_text = re.sub(r'http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+', '', full_text)
            
            # Remove email addresses
            full_text = re.sub(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', '', full_text)
            
            # Truncate to reasonable length (DistilBERT has token limits)
            if len(full_text) > 512:
                full_text = full_text[:512]
            
            return full_text.strip()
            
        except Exception as e:
            logger.error(f"Error preprocessing email content: {str(e)}")
            return content[:512] if content else ""
    
    def rule_based_classification(self, content: str, subject: str = "") -> Dict:
        """
        Fallback rule-based classification when AI model is unavailable
        Uses keyword matching for basic categorization
        """
        try:
            full_text = f"{subject} {content}".lower()
            
            # Define keyword patterns for each category
            patterns = {
                'Spam': [
                    'unsubscribe', 'click here', 'limited time', 'act now',
                    'free money', 'guarantee', 'winner', 'congratulations',
                    'viagra', 'casino', 'lottery', 'inheritance'
                ],
                'Important': [
                    'urgent', 'important', 'asap', 'deadline', 'action required',
                    'verification', 'security', 'password', 'account', 'confirm',
                    'invoice', 'payment', 'bill', 'receipt'
                ],
                'Work': [
                    'meeting', 'project', 'deadline', 'report', 'team',
                    'client', 'business', 'office', 'conference', 'schedule',
                    'proposal', 'contract', 'budget', 'quarterly'
                ],
                'Personal': [
                    'family', 'friend', 'vacation', 'birthday', 'dinner',
                    'weekend', 'party', 'holiday', 'personal', 'home'
                ]
            }
            
            # Score each category
            scores = {}
            for label, keywords in patterns.items():
                score = sum(1 for keyword in keywords if keyword in full_text)
                scores[label] = score
            
            # Determine best match
            if scores:
                best_label = max(scores.keys(), key=lambda k: scores[k])
                max_score = scores[best_label]
                
                if max_score > 0:
                    confidence = min(0.8, max_score * 0.2)  # Cap at 80%
                    return {
                        'label': best_label,
                        'confidence': confidence,
                        'reasoning': f'Rule-based classification using keyword matching'
                    }
            
            # Default classification
            return {
                'label': 'Review',
                'confidence': 0.5,
                'reasoning': 'No clear classification patterns found - requires manual review'
            }
            
        except Exception as e:
            logger.error(f"Error in rule-based classification: {str(e)}")
            return {
                'label': 'Review',
                'confidence': 0.3,
                'reasoning': 'Classification error - manual review recommended'
            }
    
    def classify_email(self, content: str, subject: str = "") -> Dict:
        """
        Classify email content using zero-shot classification
        
        Args:
            content: Email body content
            subject: Email subject line
            
        Returns:
            Dict with label, confidence, and reasoning
        """
        try:
            # Ensure model is loaded
            if not self.is_loaded:
                logger.warning("AI model not loaded, attempting to load...")
                if not self.load_model():
                    logger.warning("AI model unavailable, using rule-based fallback")
                    return self.rule_based_classification(content, subject)
            
            # Preprocess content
            processed_text = self.preprocess_email_content(content, subject)
            
            if not processed_text:
                return {
                    'label': 'Review',
                    'confidence': 0.1,
                    'reasoning': 'Empty or invalid email content'
                }
            
            # Perform zero-shot classification
            result = self.classifier(processed_text, self.classification_labels)
            
            # Extract top prediction
            top_label = result['labels'][0]
            confidence = result['scores'][0]
            
            # Map detailed labels to intelligent categories
            label_mapping = {
                "work and business communications": "Work",
                "personal and social messages": "Personal",
                "spam and promotional content": "Spam",
                "important and urgent notifications": "Important",
                "newsletters and updates": "Newsletters",
                "financial and banking communications": "Finance",
                "shopping and e-commerce notifications": "Shopping",
                "travel and booking confirmations": "Travel",
                "educational and learning content": "Education",
                "social media and platform notifications": "Social-Media",
                "health and medical communications": "Health",
                "legal and official documents": "Legal",
                "technical and IT communications": "Technical",
                "project management and collaboration": "Projects",
                "customer service and support": "Support",
                "entertainment and media content": "Entertainment"
            }
            
            final_label = label_mapping.get(top_label, "Review")
            
            # Apply confidence-based refinement
            if confidence < 0.6:
                final_label = "Review"  # Low confidence items need manual review
            elif confidence > 0.9 and "spam" in top_label.lower():
                final_label = "Spam"  # High confidence spam detection
            
            return {
                'label': final_label,
                'confidence': round(confidence, 3),
                'reasoning': f'AI zero-shot classification: {top_label} ({confidence:.3f})'
            }
            
        except Exception as e:
            logger.error(f"Error in AI classification: {str(e)}")
            logger.warning("Falling back to rule-based classification")
            return self.rule_based_classification(content, subject)
    
    def batch_classify(self, emails: List[Dict]) -> List[Dict]:
        """
        Classify multiple emails efficiently
        
        Args:
            emails: List of dicts with 'content' and optional 'subject' keys
            
        Returns:
            List of classification results
        """
        try:
            results = []
            
            for email in emails:
                content = email.get('content', '')
                subject = email.get('subject', '')
                
                result = self.classify_email(content, subject)
                results.append(result)
            
            return results
            
        except Exception as e:
            logger.error(f"Error in batch classification: {str(e)}")
            return [{'label': 'Review', 'confidence': 0.1, 'reasoning': 'Batch processing error'}] * len(emails)
    
    def get_model_info(self) -> Dict:
        """Get information about the loaded model"""
        return {
            'is_loaded': self.is_loaded,
            'model_name': config.MODEL_NAME,
            'labels': self.labels,
            'cache_dir': self.model_cache_dir
        }

# Global classifier instance
_classifier_instance = None

def get_classifier() -> EmailClassifier:
    """Get singleton classifier instance"""
    global _classifier_instance
    if _classifier_instance is None:
        _classifier_instance = EmailClassifier()
    return _classifier_instance 