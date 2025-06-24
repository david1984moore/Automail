"""
Automail AI Server - Flask Application
Provides AI-powered email classification endpoints for the Automail Chrome extension
"""
import time
import logging
from flask import Flask, request, jsonify
from flask_cors import CORS
import os

# Import utilities
from config.config import get_config
from utils.classifier import get_classifier
from utils.security import require_api_key, validate_request_data, get_rate_limit_status
from utils.logging_config import log_request_info, log_classification_result, log_model_status

# Get configuration
config = get_config()
logger = logging.getLogger(__name__)

# Create Flask app
app = Flask(__name__)
app.config.from_object(config)

# Enable CORS for Chrome extension
CORS(app, origins=config.CORS_ORIGINS)

# Global classifier instance
classifier = get_classifier()

def initialize_model():
    """Initialize AI model on startup"""
    try:
        log_model_status('loading')
        success = classifier.load_model()
        if success:
            log_model_status('loaded')
        else:
            log_model_status('error', 'Failed to load model on startup')
    except Exception as e:
        log_model_status('error', str(e))

@app.before_request
def before_request():
    """Log request information"""
    request.start_time = time.time()

@app.after_request
def after_request(response):
    """Log response information"""
    try:
        processing_time = time.time() - getattr(request, 'start_time', time.time())
        
        # Try to get response data for logging
        response_data = None
        if response.is_json:
            try:
                response_data = response.get_json()
            except:
                pass
        
        log_request_info(request, response_data, processing_time)
        
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
    Health check endpoint
    Returns server status and model information
    """
    try:
        model_info = classifier.get_model_info()
        
        return jsonify({
            'status': 'healthy',
            'server': 'Automail AI Server',
            'version': '1.0.0',
            'model_loaded': model_info['is_loaded'],
            'model_info': model_info,
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
    Classify email content using AI
    
    Expected JSON payload:
    {
        "content": "email body content",
        "subject": "email subject (optional)"
    }
    
    Returns:
    {
        "label": "Work|Personal|Spam|Important|Review",
        "confidence": 0.85,
        "reasoning": "AI classification based on content analysis"
    }
    """
    try:
        start_time = time.time()
        
        # Get validated data from security middleware
        data = request.validated_data
        content = data['content']
        subject = data.get('subject', '')
        
        logger.debug(f"Classifying email with content length: {len(content)}")
        
        # Perform classification
        result = classifier.classify_email(content, subject)
        
        processing_time = time.time() - start_time
        
        # Log classification result
        log_classification_result(content, result, processing_time)
        
        # Add metadata to response
        result['processing_time'] = round(processing_time, 3)
        result['timestamp'] = time.time()
        result['server_version'] = '1.0.0'
        
        return jsonify(result), 200
        
    except Exception as e:
        logger.error(f"Classification error: {str(e)}")
        return jsonify({
            'error': 'Classification failed',
            'message': 'Unable to classify email content',
            'label': 'Review',
            'confidence': 0.1,
            'reasoning': 'Server error - manual review recommended'
        }), 500

@app.route('/batch-classify', methods=['POST'])
@require_api_key
@validate_request_data(['emails'])
def batch_classify_emails():
    """
    Classify multiple emails in a single request
    
    Expected JSON payload:
    {
        "emails": [
            {"content": "email 1 content", "subject": "email 1 subject"},
            {"content": "email 2 content", "subject": "email 2 subject"}
        ]
    }
    
    Returns:
    {
        "results": [
            {"label": "Work", "confidence": 0.85, ...},
            {"label": "Personal", "confidence": 0.72, ...}
        ],
        "processing_time": 1.234,
        "total_emails": 2
    }
    """
    try:
        start_time = time.time()
        
        # Get validated data
        data = request.validated_data
        emails = data.get('emails', [])
        
        if not isinstance(emails, list):
            return jsonify({
                'error': 'Invalid emails format',
                'message': 'emails must be an array'
            }), 400
        
        if len(emails) > 50:  # Limit batch size
            return jsonify({
                'error': 'Batch size too large',
                'message': 'Maximum 50 emails per batch'
            }), 400
        
        logger.debug(f"Batch classifying {len(emails)} emails")
        
        # Perform batch classification
        results = classifier.batch_classify(emails)
        
        processing_time = time.time() - start_time
        
        logger.info(f"📧 Batch classified {len(emails)} emails in {processing_time:.3f}s")
        
        return jsonify({
            'results': results,
            'processing_time': round(processing_time, 3),
            'total_emails': len(emails),
            'timestamp': time.time(),
            'server_version': '1.0.0'
        }), 200
        
    except Exception as e:
        logger.error(f"Batch classification error: {str(e)}")
        return jsonify({
            'error': 'Batch classification failed',
            'message': 'Unable to process email batch',
            'results': []
        }), 500

@app.route('/compose', methods=['POST'])
@require_api_key
@validate_request_data(['prompt'])
def compose_email():
    """
    Generate email draft using AI-powered composition
    
    Expected JSON payload:
    {
        "prompt": "context for email composition",
        "style": "professional|casual|formal"
    }
    """
    try:
        data = request.validated_data
        prompt = data['prompt']
        style = data.get('style', 'professional')
        
        # Generate email based on style and prompt
        email_templates = {
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
        
        template = email_templates.get(style, email_templates['professional'])
        
        # Generate subject based on prompt keywords
        prompt_lower = prompt.lower()
        
        if any(word in prompt_lower for word in ['meeting', 'schedule', 'appointment']):
            subject = 'Meeting Request'
        elif any(word in prompt_lower for word in ['follow', 'update', 'status']):
            subject = 'Follow-up'
        elif any(word in prompt_lower for word in ['thank', 'appreciation']):
            subject = 'Thank You'
        elif any(word in prompt_lower for word in ['request', 'ask', 'need']):
            subject = 'Request for Assistance'
        else:
            subject = 'Re: Your message'
        
        # Generate email content
        if 'meeting' in prompt_lower:
            content = f"""I hope this email finds you well.

I would like to schedule a meeting to discuss {prompt.lower()}. Please let me know your availability for the coming week.

Looking forward to hearing from you."""
            
        elif 'follow' in prompt_lower:
            content = f"""I wanted to follow up regarding {prompt.lower()}.

Could you please provide an update on the current status? If you need any additional information from my side, please let me know.

Thank you for your time."""
            
        elif 'thank' in prompt_lower:
            content = f"""Thank you for {prompt.lower()}.

I really appreciate your assistance and the time you took to help me with this matter.

Please don't hesitate to reach out if you need anything from my side."""
            
        else:
            content = f"""I hope you're doing well.

I'm reaching out regarding {prompt.lower()}. I would appreciate your assistance or feedback on this matter.

Please let me know if you need any additional information."""
        
        # Format final email
        final_draft = f"""{template['greeting']},

{content}

{template['closing']}"""
        
        return jsonify({
            'draft': final_draft,
            'subject': subject,
            'style': style,
            'prompt_analyzed': prompt,
            'template_used': template['tone'],
            'timestamp': time.time(),
            'server_version': '1.0.0'
        }), 200
        
    except Exception as e:
        logger.error(f"Email composition error: {str(e)}")
        return jsonify({
            'error': 'Email composition failed',
            'message': 'Unable to generate email draft',
            'fallback_draft': 'Thank you for your message. I will get back to you soon.',
            'fallback_subject': 'Re: Your message'
        }), 500

@app.route('/train', methods=['POST'])
@require_api_key
@validate_request_data(['corrections'])
def train_model():
    """
    Accept training corrections (placeholder for future implementation)
    
    Expected JSON payload:
    {
        "corrections": [
            {"email_id": "123", "correct_label": "Work", "original_label": "Personal"}
        ]
    }
    """
    try:
        data = request.validated_data
        corrections = data['corrections']
        
        if not isinstance(corrections, list):
            return jsonify({
                'error': 'Invalid corrections format',
                'message': 'corrections must be an array'
            }), 400
        
        logger.info(f"📚 Received {len(corrections)} training corrections")
        
        # Placeholder implementation - in a real system, you'd retrain or fine-tune the model
        return jsonify({
            'status': 'success',
            'message': 'Training corrections received',
            'corrections_processed': len(corrections),
            'model_updated': False,  # Placeholder
            'note': 'This is a placeholder implementation',
            'timestamp': time.time()
        }), 200
        
    except Exception as e:
        logger.error(f"Training error: {str(e)}")
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

@app.errorhandler(500)
def internal_error(error):
    """Handle 500 errors"""
    logger.error(f"Internal server error: {str(error)}")
    return jsonify({
        'error': 'Internal server error',
        'message': 'An unexpected error occurred'
    }), 500

if __name__ == '__main__':
    try:
        # Cloud-friendly configuration
        import os
        
        # Use environment variables for cloud deployment
        host = os.getenv('HOST', '0.0.0.0')  # Always bind to all interfaces in cloud
        port = int(os.getenv('PORT', 8080))  # Default to Cloud Run port
        debug = os.getenv('FLASK_ENV', 'development') != 'production'
        
        logger.info(f"Environment check - HOST: {os.getenv('HOST')}, PORT: {os.getenv('PORT')}, FLASK_ENV: {os.getenv('FLASK_ENV')}")
        logger.info(f"Resolved values - host: {host}, port: {port}, debug: {debug}")
        
        logger.info("Starting Automail AI Server...")
        logger.info(f"Server configuration:")
        logger.info(f"   Host: {host}")
        logger.info(f"   Port: {port}")
        logger.info(f"   Debug: {debug}")
        logger.info(f"   API Key: {'Set' if config.API_KEY else 'Not set'}")
        logger.info(f"   Rate Limit: {config.RATE_LIMIT_PER_MINUTE} requests/minute")
        
        # Initialize model on startup
        log_model_status('loading')
        if classifier.load_model():
            log_model_status('loaded')
        else:
            log_model_status('error', 'Failed to load model - will use fallback')
        
        # Start server
        app.run(
            host=host,
            port=port,
            debug=debug,
            threaded=True
        )
        
    except Exception as e:
        logger.error(f"Failed to start server: {str(e)}")
        exit(1) 