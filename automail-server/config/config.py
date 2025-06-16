"""
Configuration settings for Automail AI Server
"""
import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    """Base configuration class"""
    
    # Flask settings
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'automail-dev-secret-2024'
    
    # Server settings
    HOST = os.environ.get('HOST') or '127.0.0.1'
    PORT = int(os.environ.get('PORT') or 5000)
    DEBUG = os.environ.get('FLASK_DEBUG', 'False').lower() == 'true'
    
    # API settings
    API_KEY = os.environ.get('API_KEY') or 'automail-dev-key-2024'
    RATE_LIMIT_PER_MINUTE = int(os.environ.get('RATE_LIMIT_PER_MINUTE') or 100)
    
    # AI Model settings
    MODEL_NAME = os.environ.get('MODEL_NAME') or 'distilbert-base-uncased'
    MODEL_CACHE_DIR = os.environ.get('MODEL_CACHE_DIR') or './models'
    CLASSIFICATION_LABELS = [
        'Work', 'Personal', 'Spam', 'Important', 'Review'
    ]
    
    # Request settings
    MAX_CONTENT_LENGTH = int(os.environ.get('MAX_CONTENT_LENGTH') or 16384)  # 16KB
    REQUEST_TIMEOUT = int(os.environ.get('REQUEST_TIMEOUT') or 30)
    
    # CORS settings
    CORS_ORIGINS = os.environ.get('CORS_ORIGINS', '*').split(',')

class DevelopmentConfig(Config):
    """Development configuration"""
    DEBUG = True
    
class ProductionConfig(Config):
    """Production configuration"""
    DEBUG = False
    HOST = '0.0.0.0'
    
    # Use environment variables for production (fallback to default if not set)
    API_KEY = os.environ.get('API_KEY') or Config.API_KEY

# Configuration mapping
config_map = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig
}

def get_config():
    """Get configuration based on environment"""
    env = os.environ.get('FLASK_ENV', 'development')
    return config_map.get(env, config_map['default']) 