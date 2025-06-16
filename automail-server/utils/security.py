"""
Security utilities for Automail AI Server
Handles API key validation, rate limiting, and request security
"""
import time
import logging
from functools import wraps
from typing import Dict, Optional
from flask import request, jsonify
from config.config import get_config

config = get_config()
logger = logging.getLogger(__name__)

# In-memory rate limiting storage (in production, use Redis or database)
_rate_limit_storage = {}

class SecurityError(Exception):
    """Custom security exception"""
    pass

def validate_api_key(api_key: str) -> bool:
    """
    Validate API key against configured key
    
    Args:
        api_key: API key from request header
        
    Returns:
        True if valid, False otherwise
    """
    if not api_key:
        return False
    
    # In production, you might want to hash the API key or use a database lookup
    return api_key == config.API_KEY

def check_rate_limit(client_id: str, limit_per_minute: int = None) -> bool:
    """
    Check if client has exceeded rate limit
    
    Args:
        client_id: Identifier for the client (IP address or API key)
        limit_per_minute: Rate limit per minute (defaults to config)
        
    Returns:
        True if within limit, False if exceeded
    """
    if limit_per_minute is None:
        limit_per_minute = config.RATE_LIMIT_PER_MINUTE
    
    current_time = time.time()
    current_minute = int(current_time // 60)
    
    # Clean up old entries (older than 2 minutes)
    to_remove = []
    for stored_client, (minute, count) in _rate_limit_storage.items():
        if current_minute - minute > 1:
            to_remove.append(stored_client)
    
    for client in to_remove:
        del _rate_limit_storage[client]
    
    # Check current client
    if client_id in _rate_limit_storage:
        stored_minute, count = _rate_limit_storage[client_id]
        
        if stored_minute == current_minute:
            if count >= limit_per_minute:
                return False
            _rate_limit_storage[client_id] = (current_minute, count + 1)
        else:
            # New minute, reset count
            _rate_limit_storage[client_id] = (current_minute, 1)
    else:
        # First request from this client
        _rate_limit_storage[client_id] = (current_minute, 1)
    
    return True

def get_client_identifier() -> str:
    """
    Get unique identifier for the client
    Uses API key if available, otherwise IP address
    """
    api_key = request.headers.get('X-API-Key')
    if api_key:
        return f"api_key_{api_key[-8:]}"  # Use last 8 chars for identification
    
    # Fallback to IP address
    return f"ip_{request.environ.get('HTTP_X_FORWARDED_FOR', request.environ.get('REMOTE_ADDR', 'unknown'))}"

def validate_json_input(data: Dict, required_fields: list) -> Optional[str]:
    """
    Validate JSON input data with proper email handling
    
    Args:
        data: JSON data from request
        required_fields: List of required field names
        
    Returns:
        Error message if validation fails, None if valid
    """
    if not data:
        return "No JSON data provided"
    
    if not isinstance(data, dict):
        return "Invalid JSON format"
    
    for field in required_fields:
        if field not in data:
            return f"Missing required field: {field}"
        
        # Special handling for different field types
        field_value = data[field]
        
        if field == 'emails':
            # For batch classification - validate email array
            if not isinstance(field_value, list):
                return f"Field '{field}' must be an array"
            
            if len(field_value) == 0:
                return f"Field '{field}' cannot be empty"
                
            # Validate each email object
            for i, email in enumerate(field_value):
                if not isinstance(email, dict):
                    return f"Email {i+1} must be an object with content and subject"
                
                if 'content' not in email:
                    return f"Email {i+1} missing required field: content"
                    
                if not isinstance(email['content'], str):
                    return f"Email {i+1} content must be a string"
                    
        elif field == 'corrections':
            # For training endpoint - validate corrections array
            if not isinstance(field_value, list):
                return f"Field '{field}' must be an array"
                
        else:
            # Standard string fields (content, subject, prompt, etc.)
            if not field_value and field_value != "":  # Allow empty strings
                return f"Invalid value for field: {field}"
            
            if not isinstance(field_value, str):
                return f"Field '{field}' must be a string"
    
    return None

def sanitize_input(text: str, max_length: int = None) -> str:
    """
    Sanitize input text for security
    
    Args:
        text: Input text to sanitize
        max_length: Maximum allowed length (defaults to config)
        
    Returns:
        Sanitized text
    """
    if max_length is None:
        max_length = config.MAX_CONTENT_LENGTH
    
    if not text or not isinstance(text, str):
        return ""
    
    # Remove potentially dangerous characters
    sanitized = text.replace('\x00', '')  # Remove null bytes
    sanitized = sanitized.replace('\r\n', '\n')  # Normalize line endings
    
    # Truncate to max length
    if len(sanitized) > max_length:
        sanitized = sanitized[:max_length]
    
    return sanitized.strip()

def require_api_key(f):
    """
    Decorator to require valid API key for endpoints
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            # Get API key from header
            api_key = request.headers.get('X-API-Key')
            
            if not api_key:
                logger.warning(f"Missing API key in request from {request.remote_addr}")
                return jsonify({
                    'error': 'Missing API key',
                    'message': 'X-API-Key header is required'
                }), 401
            
            # Validate API key
            if not validate_api_key(api_key):
                logger.warning(f"Invalid API key attempted from {request.remote_addr}")
                return jsonify({
                    'error': 'Invalid API key',
                    'message': 'The provided API key is not valid'
                }), 401
            
            # Check rate limiting
            client_id = get_client_identifier()
            if not check_rate_limit(client_id):
                logger.warning(f"Rate limit exceeded for client {client_id}")
                return jsonify({
                    'error': 'Rate limit exceeded',
                    'message': f'Maximum {config.RATE_LIMIT_PER_MINUTE} requests per minute allowed'
                }), 429
            
            return f(*args, **kwargs)
            
        except Exception as e:
            logger.error(f"Security check error: {str(e)}")
            return jsonify({
                'error': 'Security check failed',
                'message': 'Unable to validate request'
            }), 500
    
    return decorated_function

def validate_request_data(required_fields: list):
    """
    Decorator to validate JSON request data
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            try:
                # Check content type
                if not request.is_json:
                    return jsonify({
                        'error': 'Invalid content type',
                        'message': 'Content-Type must be application/json'
                    }), 400
                
                # Get JSON data
                data = request.get_json()
                
                # Validate required fields
                error_message = validate_json_input(data, required_fields)
                if error_message:
                    return jsonify({
                        'error': 'Invalid request data',
                        'message': error_message
                    }), 400
                
                # Sanitize input fields
                for field in required_fields:
                    if field in data:
                        data[field] = sanitize_input(data[field])
                
                # Store sanitized data in request context
                request.validated_data = data
                
                return f(*args, **kwargs)
                
            except Exception as e:
                logger.error(f"Request validation error: {str(e)}")
                return jsonify({
                    'error': 'Request validation failed',
                    'message': 'Unable to process request data'
                }), 400
        
        return decorated_function
    return decorator

def log_security_event(event_type: str, details: str, client_id: str = None):
    """
    Log security-related events
    
    Args:
        event_type: Type of security event
        details: Details about the event
        client_id: Client identifier (optional)
    """
    if client_id is None:
        client_id = get_client_identifier()
    
    logger.warning(f"SECURITY EVENT [{event_type}]: {details} - Client: {client_id}")

def get_rate_limit_status(client_id: str = None) -> Dict:
    """
    Get current rate limit status for a client
    
    Args:
        client_id: Client identifier (optional, uses current request if not provided)
        
    Returns:
        Dict with rate limit information
    """
    if client_id is None:
        client_id = get_client_identifier()
    
    current_minute = int(time.time() // 60)
    
    if client_id in _rate_limit_storage:
        stored_minute, count = _rate_limit_storage[client_id]
        if stored_minute == current_minute:
            remaining = max(0, config.RATE_LIMIT_PER_MINUTE - count)
        else:
            remaining = config.RATE_LIMIT_PER_MINUTE
    else:
        remaining = config.RATE_LIMIT_PER_MINUTE
    
    return {
        'limit': config.RATE_LIMIT_PER_MINUTE,
        'remaining': remaining,
        'reset_time': (current_minute + 1) * 60  # Next minute
    } 