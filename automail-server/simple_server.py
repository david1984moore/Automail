#!/usr/bin/env python3
"""
Simple Automail Server - Rule-Based Classification
Fast startup, reliable deployment for Cloud Run
"""

import os
import time
import re
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

def rule_based_classify(content, subject=""):
    """Smart rule-based email classification"""
    full_text = f"{subject} {content}".lower()
    
    # Enhanced patterns for better accuracy
    patterns = {
        'Spam': [
            'unsubscribe', 'click here', 'limited time', 'act now',
            'free money', 'guarantee', 'winner', 'congratulations',
            'viagra', 'casino', 'lottery', 'inheritance', 'nigerian prince',
            'phishing', 'bitcoin', 'crypto', 'investment opportunity'
        ],
        'Important': [
            'urgent', 'important', 'asap', 'deadline', 'action required',
            'verification', 'security', 'password', 'account', 'confirm',
            'invoice', 'payment', 'bill', 'receipt', 'overdue', 'expires',
            'suspended', 'locked', 'verify', '2fa', 'two factor'
        ],
        'Work': [
            'meeting', 'project', 'deadline', 'report', 'team',
            'client', 'business', 'office', 'conference', 'schedule',
            'proposal', 'contract', 'budget', 'quarterly', 'slack',
            'zoom', 'calendar', 'outlook', 'employee', 'hr'
        ],
        'Personal': [
            'family', 'friend', 'vacation', 'birthday', 'dinner',
            'weekend', 'party', 'holiday', 'personal', 'home',
            'love', 'wedding', 'anniversary', 'graduation', 'baby'
        ]
    }
    
    # Score each category
    scores = {}
    for label, keywords in patterns.items():
        score = sum(2 if keyword in full_text else 0 for keyword in keywords)
        # Bonus for subject line matches
        subject_score = sum(3 if keyword in subject.lower() else 0 for keyword in keywords)
        scores[label] = score + subject_score
    
    # Determine best match
    if scores:
        best_label = max(scores.keys(), key=lambda k: scores[k])
        max_score = scores[best_label]
        
        if max_score >= 3:  # High confidence threshold
            confidence = min(0.9, max_score * 0.15)
            return {
                'label': best_label,
                'confidence': round(confidence, 3),
                'reasoning': f'Rule-based classification (score: {max_score})'
            }
        elif max_score > 0:  # Medium confidence
            confidence = min(0.7, max_score * 0.1)
            return {
                'label': best_label,
                'confidence': round(confidence, 3),
                'reasoning': f'Rule-based classification (low confidence: {max_score})'
            }
    
    # Default classification
    return {
        'label': 'Review',
        'confidence': 0.5,
        'reasoning': 'No clear classification patterns found'
    }

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'healthy',
        'timestamp': time.time(),
        'version': '1.0.0',
        'service': 'automail-simple-server',
        'classifier': 'rule-based'
    }), 200

@app.route('/classify', methods=['POST'])
def classify_email():
    try:
        # Check API key
        api_key = request.headers.get('X-API-Key')
        expected_key = os.getenv('API_KEY', 'automail-prod-key-2024')
        if not api_key or api_key != expected_key:
            return jsonify({'error': 'Invalid API key'}), 401

        data = request.get_json()
        if not data or 'content' not in data:
            return jsonify({'error': 'Missing email content'}), 400

        content = data['content']
        subject = data.get('subject', '')

        result = rule_based_classify(content, subject)
        return jsonify(result), 200

    except Exception as e:
        return jsonify({
            'error': 'Classification failed',
            'message': str(e)
        }), 500

@app.route('/batch-classify', methods=['POST'])
def batch_classify_emails():
    try:
        # Check API key
        api_key = request.headers.get('X-API-Key')
        expected_key = os.getenv('API_KEY', 'automail-prod-key-2024')
        if not api_key or api_key != expected_key:
            return jsonify({'error': 'Invalid API key'}), 401

        data = request.get_json()
        if not data or 'emails' not in data:
            return jsonify({'error': 'Missing emails data'}), 400

        emails = data['emails']
        if not isinstance(emails, list):
            return jsonify({'error': 'Invalid emails format'}), 400

        results = []
        for email in emails:
            content = email.get('content', '')
            subject = email.get('subject', '')
            result = rule_based_classify(content, subject)
            results.append(result)

        return jsonify({
            'results': results,
            'count': len(results),
            'timestamp': time.time()
        }), 200

    except Exception as e:
        return jsonify({
            'error': 'Batch classification failed',
            'message': str(e)
        }), 500

@app.route('/', methods=['GET'])
def root():
    return jsonify({
        'service': 'Automail Simple Server',
        'version': '1.0.0',
        'status': 'running',
        'classifier': 'rule-based',
        'endpoints': [
            'GET /health - Health check',
            'POST /classify - Classify single email',
            'POST /batch-classify - Classify multiple emails'
        ]
    }), 200

if __name__ == '__main__':
    host = os.getenv('HOST', '0.0.0.0')
    port = int(os.getenv('PORT', 8080))
    debug = os.getenv('FLASK_ENV', 'production') == 'development'
    
    print(f"🚀 Starting Automail Simple Server on {host}:{port}")
    print(f"📊 Using rule-based classification")
    print(f"🔑 API Key: {'✓ Set' if os.getenv('API_KEY') else '✗ Not set'}")
    
    app.run(host=host, port=port, debug=debug, threaded=True) 