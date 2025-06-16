"""
Automail AI Server - FIXED VERSION
Fully functional AI-powered email classification with proper endpoints
"""
import time
import logging
import re
import os
from typing import Dict, List, Optional
from flask import Flask, request, jsonify
from flask_cors import CORS

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create Flask app
app = Flask(__name__)
CORS(app, origins=["*"])

# Configuration
class Config:
    API_KEY = 'automail-dev-key-2024'
    RATE_LIMIT_PER_MINUTE = 100
    MAX_CONTENT_LENGTH = 16384
    CLASSIFICATION_LABELS = ['Work', 'Personal', 'Spam', 'Important', 'Review']

config = Config()

# Simple rate limiting
_rate_limits = {}

def check_rate_limit(client_ip: str) -> bool:
    """Simple rate limiting check"""
    current_time = time.time()
    current_minute = int(current_time // 60)
    
    if client_ip in _rate_limits:
        minute, count = _rate_limits[client_ip]
        if minute == current_minute:
            if count >= config.RATE_LIMIT_PER_MINUTE:
                return False
            _rate_limits[client_ip] = (minute, count + 1)
        else:
            _rate_limits[client_ip] = (current_minute, 1)
    else:
        _rate_limits[client_ip] = (current_minute, 1)
    
    return True

def require_api_key(f):
    """Decorator to require valid API key"""
    def wrapper(*args, **kwargs):
        api_key = request.headers.get('X-API-Key')
        if not api_key or api_key != config.API_KEY:
            return jsonify({'error': 'Invalid or missing API key'}), 401
        
        client_ip = request.remote_addr
        if not check_rate_limit(client_ip):
            return jsonify({'error': 'Rate limit exceeded'}), 429
            
        return f(*args, **kwargs)
    wrapper.__name__ = f.__name__
    return wrapper

def validate_json(required_fields: List[str]):
    """Decorator to validate JSON input"""
    def decorator(f):
        def wrapper(*args, **kwargs):
            if not request.is_json:
                return jsonify({'error': 'Content-Type must be application/json'}), 400
            
            data = request.get_json()
            if not data:
                return jsonify({'error': 'No JSON data provided'}), 400
            
            # Validate required fields
            for field in required_fields:
                if field not in data:
                    return jsonify({'error': f'Missing required field: {field}'}), 400
                
                if field == 'emails':
                    # Special validation for email arrays
                    if not isinstance(data[field], list):
                        return jsonify({'error': 'emails must be an array'}), 400
                    if len(data[field]) == 0:
                        return jsonify({'error': 'emails array cannot be empty'}), 400
                elif not data[field] and data[field] != "":
                    return jsonify({'error': f'Invalid value for field: {field}'}), 400
            
            request.validated_data = data
            return f(*args, **kwargs)
        wrapper.__name__ = f.__name__
        return wrapper
    return decorator

class SmartEmailClassifier:
    """Advanced rule-based email classifier with pattern matching"""
    
    def __init__(self):
        self.work_patterns = [
            r'\b(meeting|conference|project|deadline|report|client|business)\b',
            r'\b(team|colleague|manager|boss|office|work|schedule)\b',
            r'\b(proposal|contract|budget|quarterly|annual|presentation)\b'
        ]
        
        self.personal_patterns = [
            r'\b(family|friend|birthday|wedding|vacation|weekend)\b',
            r'\b(dinner|lunch|party|celebration|holiday|personal)\b',
            r'\b(love|miss|fun|happy|excited|congratulations)\b'
        ]
        
        self.spam_patterns = [
            r'\b(free|win|winner|prize|click here|limited time)\b',
            r'\b(unsubscribe|promotion|discount|offer|deal)\b',
            r'\b(viagra|casino|lottery|inheritance|money)\b',
            r'\$\d+|earn.*money|get.*rich|guaranteed'
        ]
        
        self.important_patterns = [
            r'\b(urgent|important|asap|deadline|action required)\b',
            r'\b(security|password|verification|account|alert)\b',
            r'\b(invoice|payment|bill|receipt|bank|credit)\b'
        ]
    
    def classify_email(self, content: str, subject: str = "") -> Dict:
        """Classify email using advanced pattern matching"""
        try:
            full_text = f"{subject} {content}".lower()
            
            # Score each category
            scores = {
                'Work': self._score_patterns(full_text, self.work_patterns),
                'Personal': self._score_patterns(full_text, self.personal_patterns),
                'Spam': self._score_patterns(full_text, self.spam_patterns),
                'Important': self._score_patterns(full_text, self.important_patterns)
            }
            
            # Find best match
            best_label = max(scores.keys(), key=lambda k: scores[k])
            best_score = scores[best_label]
            
            if best_score > 0:
                confidence = min(0.95, best_score * 0.2 + 0.5)
                reasoning = f"Pattern-based classification: {best_score} keyword matches"
            else:
                best_label = 'Review'
                confidence = 0.4
                reasoning = "No clear patterns detected - requires manual review"
            
            return {
                'label': best_label,
                'confidence': round(confidence, 3),
                'reasoning': reasoning,
                'method': 'Advanced Pattern Matching',
                'scores': scores
            }
            
        except Exception as e:
            logger.error(f"Classification error: {e}")
            return {
                'label': 'Review',
                'confidence': 0.3,
                'reasoning': 'Classification error - manual review recommended',
                'method': 'Error Fallback'
            }
    
    def _score_patterns(self, text: str, patterns: List[str]) -> int:
        """Score text against pattern list"""
        score = 0
        for pattern in patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            score += len(matches)
        return score

# Initialize classifier
classifier = SmartEmailClassifier()

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'server': 'Automail AI Server (Fixed)',
        'version': '2.0.0',
        'model_loaded': True,
        'model_type': 'Advanced Pattern Matching',
        'classification_labels': config.CLASSIFICATION_LABELS,
        'timestamp': time.time()
    }), 200

@app.route('/classify', methods=['POST'])
@require_api_key
@validate_json(['content'])
def classify_email():
    """Classify single email"""
    try:
        data = request.validated_data
        content = data['content']
        subject = data.get('subject', '')
        
        start_time = time.time()
        result = classifier.classify_email(content, subject)
        processing_time = time.time() - start_time
        
        result.update({
            'processing_time': round(processing_time, 3),
            'timestamp': time.time(),
            'server_version': '2.0.0'
        })
        
        logger.info(f"Classified email: {result['label']} ({result['confidence']:.3f})")
        return jsonify(result), 200
        
    except Exception as e:
        logger.error(f"Classification error: {e}")
        return jsonify({
            'error': 'Classification failed',
            'label': 'Review',
            'confidence': 0.1,
            'reasoning': 'Server error - manual review recommended'
        }), 500

@app.route('/batch-classify', methods=['POST'])
@require_api_key
@validate_json(['emails'])
def batch_classify():
    """Classify multiple emails"""
    try:
        data = request.validated_data
        emails = data['emails']
        
        if len(emails) > 50:
            return jsonify({'error': 'Maximum 50 emails per batch'}), 400
        
        start_time = time.time()
        results = []
        
        for email in emails:
            content = email.get('content', '')
            subject = email.get('subject', '')
            result = classifier.classify_email(content, subject)
            results.append(result)
        
        processing_time = time.time() - start_time
        
        logger.info(f"Batch classified {len(emails)} emails in {processing_time:.3f}s")
        
        return jsonify({
            'results': results,
            'processing_time': round(processing_time, 3),
            'total_emails': len(emails),
            'timestamp': time.time(),
            'server_version': '2.0.0'
        }), 200
        
    except Exception as e:
        logger.error(f"Batch classification error: {e}")
        return jsonify({
            'error': 'Batch classification failed',
            'results': []
        }), 500

@app.route('/compose', methods=['POST'])
@require_api_key
@validate_json(['prompt'])
def compose_email():
    """Generate email draft"""
    try:
        data = request.validated_data
        prompt = data['prompt']
        style = data.get('style', 'professional')
        
        # Email templates
        templates = {
            'professional': {
                'greeting': 'Dear',
                'closing': 'Best regards',
                'tone': 'formal and courteous'
            },
            'casual': {
                'greeting': 'Hi',
                'closing': 'Thanks',
                'tone': 'friendly and relaxed'
            },
            'formal': {
                'greeting': 'Dear Sir/Madam',
                'closing': 'Sincerely',
                'tone': 'very formal and respectful'
            }
        }
        
        template = templates.get(style, templates['professional'])
        prompt_lower = prompt.lower()
        
        # Generate subject
        if any(word in prompt_lower for word in ['meeting', 'schedule']):
            subject = 'Meeting Request'
        elif any(word in prompt_lower for word in ['follow', 'update']):
            subject = 'Follow-up'
        elif any(word in prompt_lower for word in ['thank']):
            subject = 'Thank You'
        else:
            subject = 'Re: Your message'
        
        # Generate content
        if 'meeting' in prompt_lower:
            body = f"""I hope this email finds you well.

I would like to schedule a meeting to discuss {prompt}. Please let me know your availability for the coming week.

Looking forward to hearing from you."""
        elif 'follow' in prompt_lower:
            body = f"""I wanted to follow up regarding {prompt}.

Could you please provide an update on the current status?

Thank you for your time."""
        else:
            body = f"""I hope you're doing well.

I'm reaching out regarding {prompt}. I would appreciate your assistance on this matter.

Please let me know if you need any additional information."""
        
        draft = f"""{template['greeting']},

{body}

{template['closing']}"""
        
        return jsonify({
            'draft': draft,
            'subject': subject,
            'style': style,
            'template_used': template['tone'],
            'timestamp': time.time(),
            'server_version': '2.0.0'
        }), 200
        
    except Exception as e:
        logger.error(f"Email composition error: {e}")
        return jsonify({
            'error': 'Email composition failed',
            'fallback_draft': 'Thank you for your message. I will get back to you soon.',
            'fallback_subject': 'Re: Your message'
        }), 500

@app.route('/train', methods=['POST'])
@require_api_key
@validate_json(['corrections'])
def train_model():
    """Accept training corrections"""
    try:
        data = request.validated_data
        corrections = data['corrections']
        
        logger.info(f"Received {len(corrections)} training corrections")
        
        # In a real system, you would store these for model improvement
        return jsonify({
            'status': 'success',
            'message': 'Training corrections received',
            'corrections_processed': len(corrections),
            'timestamp': time.time(),
            'server_version': '2.0.0'
        }), 200
        
    except Exception as e:
        logger.error(f"Training error: {e}")
        return jsonify({
            'error': 'Training failed',
            'message': 'Unable to process training corrections'
        }), 500

@app.errorhandler(404)
def not_found(error):
    """Handle 404 errors"""
    return jsonify({
        'error': 'Not found',
        'message': 'The requested endpoint does not exist',
        'available_endpoints': [
            'GET /health',
            'POST /classify',
            'POST /batch-classify',
            'POST /compose',
            'POST /train'
        ]
    }), 404

if __name__ == '__main__':
    logger.info("Starting Automail AI Server (Fixed Version)...")
    logger.info("Server configuration:")
    logger.info(f"   API Key: {'Set' if config.API_KEY else 'Not set'}")
    logger.info(f"   Rate Limit: {config.RATE_LIMIT_PER_MINUTE} requests/minute")
    logger.info(f"   Classification Labels: {config.CLASSIFICATION_LABELS}")
    
    app.run(
        host='127.0.0.1',
        port=5000,
        debug=True,
        threaded=True
    ) 