#!/usr/bin/env python3
"""
Lightweight Automail AI Server for Cloud Run
Optimized for fast startup and lazy model loading
"""

import os
import time
import logging
from flask import Flask, request, jsonify
from flask_cors import CORS

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create Flask app
app = Flask(__name__)
CORS(app)

# Global classifier (loaded lazily)
classifier = None

def get_or_load_classifier():
    """Lazy load the classifier only when needed"""
    global classifier
    if classifier is None:
        try:
            logger.info("Loading AI classifier...")
            from utils.classifier import get_classifier
            classifier = get_classifier()
            if not classifier.load_model():
                logger.warning("AI model failed to load, using rule-based fallback")
        except Exception as e:
            logger.error(f"Failed to load classifier: {e}")
            classifier = None
    return classifier

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': time.time(),
        'version': '1.0.0',
        'service': 'automail-ai-server'
    }), 200

@app.route('/classify', methods=['POST'])
def classify_email():
    """Classify a single email"""
    try:
        # Get API key from header
        api_key = request.headers.get('X-API-Key')
        if not api_key or api_key != os.getenv('API_KEY', 'automail-prod-key-2024'):
            return jsonify({'error': 'Invalid API key'}), 401

        data = request.get_json()
        if not data or 'content' not in data:
            return jsonify({'error': 'Missing email content'}), 400

        content = data['content']
        subject = data.get('subject', '')

        # Get classifier (lazy load)
        clf = get_or_load_classifier()
        if clf:
            result = clf.classify_email(content, subject)
        else:
            # Fallback classification
            result = {
                'label': 'Review',
                'confidence': 0.5,
                'reasoning': 'AI model unavailable - manual review required'
            }

        return jsonify(result), 200

    except Exception as e:
        logger.error(f"Classification error: {e}")
        return jsonify({
            'error': 'Classification failed',
            'message': str(e)
        }), 500

@app.route('/batch-classify', methods=['POST'])
def batch_classify_emails():
    """Classify multiple emails"""
    try:
        # Get API key from header
        api_key = request.headers.get('X-API-Key')
        if not api_key or api_key != os.getenv('API_KEY', 'automail-prod-key-2024'):
            return jsonify({'error': 'Invalid API key'}), 401

        data = request.get_json()
        if not data or 'emails' not in data:
            return jsonify({'error': 'Missing emails data'}), 400

        emails = data['emails']
        if not isinstance(emails, list):
            return jsonify({'error': 'Invalid emails format'}), 400

        # Get classifier (lazy load)
        clf = get_or_load_classifier()
        results = []

        for email in emails:
            content = email.get('content', '')
            subject = email.get('subject', '')
            
            if clf:
                result = clf.classify_email(content, subject)
            else:
                result = {
                    'label': 'Review',
                    'confidence': 0.5,
                    'reasoning': 'AI model unavailable - manual review required'
                }
            results.append(result)

        return jsonify({
            'results': results,
            'count': len(results),
            'timestamp': time.time()
        }), 200

    except Exception as e:
        logger.error(f"Batch classification error: {e}")
        return jsonify({
            'error': 'Batch classification failed',
            'message': str(e)
        }), 500

@app.route('/', methods=['GET'])
def root():
    """Root endpoint"""
    return jsonify({
        'service': 'Automail AI Server',
        'version': '1.0.0',
        'status': 'running',
        'endpoints': [
            'GET /health - Health check',
            'POST /classify - Classify single email',
            'POST /batch-classify - Classify multiple emails'
        ]
    }), 200

if __name__ == '__main__':
    # Get configuration from environment
    host = os.getenv('HOST', '0.0.0.0')
    port = int(os.getenv('PORT', 8080))
    debug = os.getenv('FLASK_ENV', 'development') != 'production'
    
    logger.info(f"Starting Automail AI Server on {host}:{port}")
    logger.info(f"Debug mode: {debug}")
    logger.info(f"API Key configured: {bool(os.getenv('API_KEY'))}")
    
    # Start server
    app.run(
        host=host,
        port=port,
        debug=debug,
        threaded=True
    ) 