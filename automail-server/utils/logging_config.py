"""
Logging configuration for Automail AI Server
Sets up structured logging for debugging and monitoring
"""
import logging
import sys
from datetime import datetime
from config.config import get_config

config = get_config()

class ColorFormatter(logging.Formatter):
    """Custom formatter with color coding for console output"""
    
    # Color codes
    COLORS = {
        'DEBUG': '\033[94m',     # Blue
        'INFO': '\033[92m',      # Green
        'WARNING': '\033[93m',   # Yellow
        'ERROR': '\033[91m',     # Red
        'CRITICAL': '\033[95m',  # Magenta
        'ENDC': '\033[0m'        # End color
    }
    
    def format(self, record):
        # Add color to levelname
        if record.levelname in self.COLORS:
            record.levelname = f"{self.COLORS[record.levelname]}{record.levelname}{self.COLORS['ENDC']}"
        
        return super().format(record)

def setup_logging():
    """Configure logging for the application"""
    
    # Create root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.DEBUG if config.DEBUG else logging.INFO)
    
    # Clear existing handlers
    root_logger.handlers.clear()
    
    # Console handler with color formatting
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.DEBUG if config.DEBUG else logging.INFO)
    
    console_format = ColorFormatter(
        fmt='%(asctime)s | %(levelname)-8s | %(name)s | %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    console_handler.setFormatter(console_format)
    root_logger.addHandler(console_handler)
    
    # File handler for persistent logging
    try:
        file_handler = logging.FileHandler('automail-server.log')
        file_handler.setLevel(logging.INFO)
        
        file_format = logging.Formatter(
            fmt='%(asctime)s | %(levelname)-8s | %(name)s | %(funcName)s:%(lineno)d | %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        file_handler.setFormatter(file_format)
        root_logger.addHandler(file_handler)
    except Exception as e:
        print(f"Warning: Could not set up file logging: {e}")
    
    # Set specific logger levels
    logging.getLogger('werkzeug').setLevel(logging.WARNING)  # Reduce Flask noise
    logging.getLogger('transformers').setLevel(logging.WARNING)  # Reduce transformer noise
    logging.getLogger('torch').setLevel(logging.WARNING)  # Reduce PyTorch noise
    
    # Log startup message
    logger = logging.getLogger(__name__)
    logger.info("Automail AI Server logging initialized")
    logger.info(f"Log level: {'DEBUG' if config.DEBUG else 'INFO'}")
    
    return root_logger

def log_request_info(request, response_data=None, processing_time=None):
    """Log structured request information"""
    logger = logging.getLogger('automail.requests')
    
    # Extract request info
    method = request.method
    endpoint = request.endpoint or request.path
    client_ip = request.environ.get('HTTP_X_FORWARDED_FOR', request.environ.get('REMOTE_ADDR', 'unknown'))
    api_key_present = bool(request.headers.get('X-API-Key'))
    content_length = request.content_length or 0
    
    # Build log message
    log_parts = [
        f"{method} {endpoint}",
        f"IP: {client_ip}",
        f"API Key: {'Yes' if api_key_present else 'No'}",
        f"Size: {content_length}B"
    ]
    
    if processing_time:
        log_parts.append(f"Time: {processing_time:.3f}s")
    
    if response_data and isinstance(response_data, dict):
        if 'error' in response_data:
            log_parts.append(f"Error: {response_data['error']}")
        elif 'label' in response_data:
            log_parts.append(f"Result: {response_data['label']}")
    
    logger.info(" | ".join(log_parts))

def log_classification_result(content_preview, result, processing_time):
    """Log classification results for monitoring"""
    logger = logging.getLogger('automail.classification')
    
    preview = content_preview[:50].replace('\n', ' ') if content_preview else 'Empty'
    
    logger.info(
        f"Email classified: '{preview}...' -> "
        f"{result['label']} ({result['confidence']:.3f}) in {processing_time:.3f}s"
    )

def log_model_status(event, details=None):
    """Log AI model status events"""
    logger = logging.getLogger('automail.model')
    
    if event == 'loading':
        logger.info("Loading AI model...")
    elif event == 'loaded':
        logger.info("AI model loaded successfully")
    elif event == 'error':
        logger.error(f"AI model error: {details}")
    elif event == 'fallback':
        logger.warning(f"Using fallback classification: {details}")

def log_security_event(event_type, details, client_info=None):
    """Log security-related events"""
    logger = logging.getLogger('automail.security')
    
    message = f"SECURITY [{event_type}]: {details}"
    if client_info:
        message += f" | Client: {client_info}"
    
    if event_type in ['invalid_api_key', 'rate_limit_exceeded', 'suspicious_activity']:
        logger.warning(message)
    else:
        logger.info(message)

# Configure logging on import
setup_logging() 