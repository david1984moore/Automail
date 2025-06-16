#!/usr/bin/env python3
"""
Debug version of the Automail AI Server
This version includes comprehensive error handling and diagnostics
"""

import sys
import time
import logging
import traceback
from pathlib import Path

# Add current directory to Python path
sys.path.insert(0, str(Path(__file__).parent))

def test_dependencies():
    """Test all required dependencies"""
    print("🔍 Testing dependencies...")
    
    try:
        import flask
        print(f"✅ Flask {flask.__version__}")
    except ImportError as e:
        print(f"❌ Flask: {e}")
        return False
    
    try:
        import torch
        print(f"✅ PyTorch {torch.__version__}")
    except ImportError as e:
        print(f"❌ PyTorch: {e}")
        return False
    
    try:
        import transformers
        print(f"✅ Transformers {transformers.__version__}")
    except ImportError as e:
        print(f"❌ Transformers: {e}")
        return False
    
    try:
        from flask_cors import CORS
        print(f"✅ Flask-CORS")
    except ImportError as e:
        print(f"❌ Flask-CORS: {e}")
        return False
    
    return True

def test_imports():
    """Test internal module imports"""
    print("\n🔍 Testing internal imports...")
    
    try:
        from config.config import get_config
        print("✅ Config module")
        config = get_config()
        print(f"   Host: {config.HOST}")
        print(f"   Port: {config.PORT}")
        print(f"   Debug: {config.DEBUG}")
    except Exception as e:
        print(f"❌ Config: {e}")
        return False
    
    try:
        from utils.classifier import get_classifier
        print("✅ Classifier module")
    except Exception as e:
        print(f"❌ Classifier: {e}")
        return False
    
    try:
        from utils.security import require_api_key
        print("✅ Security module")
    except Exception as e:
        print(f"❌ Security: {e}")
        return False
    
    try:
        from utils.logging_config import setup_logging
        print("✅ Logging module")
    except Exception as e:
        print(f"❌ Logging: {e}")
        return False
    
    return True

def test_port_binding():
    """Test if we can bind to the target port"""
    print("\n🔍 Testing port binding...")
    
    import socket
    
    try:
        from config.config import get_config
        config = get_config()
        
        # Test socket binding
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        sock.bind((config.HOST, config.PORT))
        sock.listen(1)
        print(f"✅ Can bind to {config.HOST}:{config.PORT}")
        sock.close()
        return True
        
    except Exception as e:
        print(f"❌ Port binding failed: {e}")
        return False

def start_server_debug():
    """Start the server with comprehensive error handling"""
    print("\n🚀 Starting debug server...")
    
    try:
        # Import Flask app
        from app import app, config, classifier
        
        print(f"📋 Server Configuration:")
        print(f"   Host: {config.HOST}")
        print(f"   Port: {config.PORT}")
        print(f"   Debug: {config.DEBUG}")
        print(f"   API Key: {'Set' if config.API_KEY else 'Not set'}")
        
        # Initialize AI model
        print("\n🤖 Initializing AI model...")
        if classifier.load_model():
            print("✅ AI model loaded successfully")
        else:
            print("⚠️ AI model failed to load (will use fallback)")
        
        # Start the server with explicit parameters
        print(f"\n🌐 Starting Flask server on {config.HOST}:{config.PORT}")
        print("📝 Server logs will appear below:")
        print("=" * 60)
        
        app.run(
            host=config.HOST,
            port=config.PORT,
            debug=False,  # Disable debug mode to avoid conflicts
            threaded=True,
            use_reloader=False  # Disable reloader to avoid issues
        )
        
    except KeyboardInterrupt:
        print("\n⏹️ Server stopped by user")
    except Exception as e:
        print(f"\n❌ Server error: {e}")
        print(f"📋 Full traceback:")
        traceback.print_exc()
        return False
    
    return True

def main():
    """Main debug function"""
    print("🤖 Automail AI Server - Debug Mode")
    print("=" * 50)
    
    # Test dependencies
    if not test_dependencies():
        print("\n❌ Dependency test failed")
        return False
    
    # Test imports
    if not test_imports():
        print("\n❌ Import test failed")
        return False
    
    # Test port binding
    if not test_port_binding():
        print("\n❌ Port binding test failed")
        return False
    
    print("\n✅ All tests passed! Starting server...")
    print("\n💡 To test the server:")
    print("   1. Keep this terminal open")
    print("   2. Open a new terminal")
    print("   3. Run: curl -X GET http://localhost:5000/health")
    print("   4. Check the Chrome extension")
    
    # Start server
    return start_server_debug()

if __name__ == "__main__":
    try:
        success = main()
        if not success:
            print("\n❌ Debug session failed")
            sys.exit(1)
    except Exception as e:
        print(f"\n💥 Critical error: {e}")
        traceback.print_exc()
        sys.exit(1) 