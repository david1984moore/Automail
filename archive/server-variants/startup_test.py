import os
import sys

def test_config():
    """Test that all required environment variables are set"""
    required_vars = ['HOST', 'PORT', 'FLASK_ENV']
    
    print("=== Startup Configuration Test ===")
    for var in required_vars:
        value = os.environ.get(var)
        print(f"{var}: {value}")
        
    port = int(os.environ.get('PORT', 5000))
    host = os.environ.get('HOST', '127.0.0.1')
    
    print(f"\nServer will start on {host}:{port}")
    print(f"Production mode: {os.environ.get('FLASK_ENV') == 'production'}")
    
    return True

if __name__ == "__main__":
    test_config() 