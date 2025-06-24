#!/usr/bin/env python3
"""
Fast-start Automail AI Server
Starts immediately with async AI model loading for instant testing
"""

import sys
import time
import logging
import threading
from pathlib import Path
from flask import Flask, request, jsonify
from flask_cors import CORS

# Add current directory to Python path
sys.path.insert(0, str(Path(__file__).parent))

from config.config import get_config
from utils.security import require_api_key, validate_request_data, get_rate_limit_status
from utils.logging_config import log_request_info, log_model_status

# Get configuration
config = get_config()
logger = logging.getLogger(__name__)

# Create Flask app
app = Flask(__name__)
app.config.from_object(config)

# Enable CORS for Chrome extension
CORS(app, origins=config.CORS_ORIGINS)

# Global state
classifier = None
model_loading = False
model_loaded = False
model_error = None

def load_model_async():
    """Load AI model in background thread"""
    global classifier, model_loading, model_loaded, model_error
    
    try:
        model_loading = True
        log_model_status('loading')
        
        from utils.classifier import get_classifier
        classifier = get_classifier()
        
        success = classifier.load_model()
        
        if success:
            model_loaded = True
            log_model_status('loaded')
            logger.info("🎉 AI model loaded successfully in background!")
        else:
            model_error = "Failed to load AI model"
            log_model_status('error', model_error)
    
    except Exception as e:
        model_error = str(e)
        log_model_status('error', model_error)
        logger.error(f"❌ Background model loading failed: {e}")
    
    finally:
        model_loading = False

@app.before_request
def before_request():
    """Log request information"""
    request.start_time = time.time()

@app.after_request
def after_request(response):
    """Log response information"""
    try:
        processing_time = time.time() - getattr(request, 'start_time', time.time())
        
        # Add rate limit headers
        try:
            rate_limit_info = get_rate_limit_status()
            response.headers['X-RateLimit-Limit'] = str(rate_limit_info['limit'])
            response.headers['X-RateLimit-Remaining'] = str(rate_limit_info['remaining'])
            response.headers['X-RateLimit-Reset'] = str(rate_limit_info['reset_time'])
        except:
            pass
    except Exception as e:
        logger.error(f"Error in after_request: {str(e)}")
    
    return response

@app.route('/health', methods=['GET'])
def health_check():
    """
    Health check endpoint - works immediately
    """
    try:
        global model_loading, model_loaded, model_error
        
        # Model status
        if model_loaded:
            model_status = "loaded"
            model_info = classifier.get_model_info() if classifier else {}
        elif model_loading:
            model_status = "loading"
            model_info = {"status": "downloading_model"}
        elif model_error:
            model_status = "error"
            model_info = {"error": model_error}
        else:
            model_status = "not_started"
            model_info = {"status": "ready_to_load"}
        
        return jsonify({
            'status': 'healthy',
            'server': 'Automail AI Server (Fast Start)',
            'version': '1.0.0',
            'model_status': model_status,
            'model_loaded': model_loaded,
            'model_info': model_info,
            'fallback_available': True,
            'timestamp': time.time()
        }), 200
        
    except Exception as e:
        logger.error(f"Health check error: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': 'Health check failed',
            'timestamp': time.time()
        }), 500

@app.route('/classify', methods=['POST'])
@require_api_key
@validate_request_data(['content'])
def classify_email():
    """
    Classify email - uses AI if loaded, fallback otherwise
    """
    try:
        start_time = time.time()
        
        data = request.validated_data
        content = data['content']
        subject = data.get('subject', '')
        
        global model_loaded, classifier
        
        # Use AI if loaded, otherwise use fallback
        if model_loaded and classifier:
            result = classifier.classify_email(content, subject)
        else:
            # Rule-based fallback
            result = rule_based_fallback(content, subject)
            
        processing_time = time.time() - start_time
        result['processing_time'] = round(processing_time, 3)
        result['timestamp'] = time.time()
        result['method'] = 'ai' if model_loaded else 'fallback'
        
        return jsonify(result), 200
        
    except Exception as e:
        logger.error(f"Classification error: {str(e)}")
        return jsonify({
            'error': 'Classification failed',
            'message': 'Using emergency fallback',
            'label': 'Review',
            'confidence': 0.1,
            'reasoning': 'Server error - manual review recommended',
            'method': 'emergency'
        }), 500

@app.route('/batch-classify', methods=['POST'])
@require_api_key
@validate_request_data(['emails'])
def batch_classify_emails():
    """
    Batch classify emails
    """
    try:
        start_time = time.time()
        
        data = request.validated_data
        emails = data.get('emails', [])
        
        if not isinstance(emails, list) or len(emails) > 50:
            return jsonify({
                'error': 'Invalid request',
                'message': 'emails must be an array with max 50 items'
            }), 400
        
        global model_loaded, classifier
        
        results = []
        for email in emails:
            content = email.get('content', '')
            subject = email.get('subject', '')
            
            if model_loaded and classifier:
                result = classifier.classify_email(content, subject)
            else:
                result = rule_based_fallback(content, subject)
            
            results.append(result)
        
        processing_time = time.time() - start_time
        
        return jsonify({
            'results': results,
            'processing_time': round(processing_time, 3),
            'total_emails': len(emails),
            'method': 'ai' if model_loaded else 'fallback',
            'timestamp': time.time()
        }), 200
        
    except Exception as e:
        logger.error(f"Batch classification error: {str(e)}")
        return jsonify({
            'error': 'Batch classification failed',
            'results': []
        }), 500

def rule_based_fallback(content, subject):
    """Rule-based classification fallback"""
    full_text = f"{subject} {content}".lower()
    
    patterns = {
        'Spam': ['unsubscribe', 'click here', 'limited time', 'act now', 'free money'],
        'Important': ['urgent', 'important', 'asap', 'deadline', 'action required', 'verification'],
        'Work': ['meeting', 'project', 'report', 'team', 'client', 'business', 'conference'],
        'Personal': ['family', 'friend', 'vacation', 'birthday', 'party', 'personal']
    }
    
    scores = {}
    for label, keywords in patterns.items():
        scores[label] = sum(1 for keyword in keywords if keyword in full_text)
    
    if any(scores.values()):
        best_label = max(scores.keys(), key=lambda k: scores[k])
        max_score = scores[best_label]
        confidence = min(0.8, max_score * 0.25)
        
        return {
            'label': best_label,
            'confidence': confidence,
            'reasoning': 'Rule-based classification using keyword matching'
        }
    
    return {
        'label': 'Review',
        'confidence': 0.5,
        'reasoning': 'No clear patterns found - requires manual review'
    }

@app.errorhandler(404)
def not_found(error):
    return jsonify({
        'error': 'Not found',
        'message': 'Endpoint does not exist',
        'available_endpoints': ['GET /health', 'POST /classify', 'POST /batch-classify']
    }), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({
        'error': 'Internal server error',
        'message': 'An unexpected error occurred'
    }), 500

if __name__ == '__main__':
    try:
        print("🚀 Automail AI Server - Fast Start Mode")
        print("=" * 50)
        print(f"🌐 Server starting on {config.HOST}:{config.PORT}")
        print("⚡ Server will start immediately")
        print("🤖 AI model will load in background")
        print("📡 Fallback classification available immediately")
        print("=" * 50)
        
        # Start AI model loading in background
        model_thread = threading.Thread(target=load_model_async, daemon=True)
        model_thread.start()
        
        # Start server immediately
        app.run(
            host=config.HOST,
            port=config.PORT,
            debug=False,
            threaded=True,
            use_reloader=False
        )
        
    except Exception as e:
        logger.error(f"Failed to start server: {str(e)}")
        print(f"❌ Server startup failed: {e}")
        sys.exit(1) 