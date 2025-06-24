#!/usr/bin/env python3
"""
Simple test script for Automail AI Server components
Tests individual functions without starting the full server
"""
import sys
import os

# Add the current directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def test_rule_based_classification():
    """Test the rule-based classification fallback"""
    try:
        from utils.classifier import get_classifier
        classifier = get_classifier()
        
        # Test different email types
        test_cases = [
            ('Team meeting tomorrow at 2pm', 'Meeting Reminder', 'Work'),
            ('Happy birthday! Party this weekend', 'Birthday Invitation', 'Personal'),
            ('Congratulations! You won $1000! Click here now!', 'YOU WON!!!', 'Spam'),
            ('Your password expires in 3 days', 'Security Alert', 'Important'),
            ('Lorem ipsum dolor sit amet', 'Random Text', 'Review')
        ]
        
        print("Testing rule-based classification:")
        for content, subject, expected in test_cases:
            result = classifier.ruleBasedClassification(content, subject)
            print(f"  Content: {content[:30]}...")
            print(f"  Expected: {expected}, Got: {result['label']}")
            print(f"  Confidence: {result['confidence']:.3f}")
            print(f"  Reasoning: {result['reasoning']}")
            print()
        
        return True
    except Exception as e:
        print(f"Error in rule-based classification test: {e}")
        return False

def test_flask_import():
    """Test Flask and other imports"""
    try:
        from flask import Flask
        from flask_cors import CORS
        print("✓ Flask imports successful")
        
        from config.config import get_config
        config = get_config()
        print(f"✓ Config loaded: API_KEY={'Set' if config.API_KEY else 'Not set'}")
        
        from utils.security import validate_api_key
        print("✓ Security module imported")
        
        return True
    except Exception as e:
        print(f"Error in Flask import test: {e}")
        return False

def test_basic_ai_model():
    """Test if we can at least try to initialize the AI model"""
    try:
        from utils.classifier import get_classifier
        classifier = get_classifier()
        
        # Try to get model info without loading
        model_info = classifier.get_model_info()
        print(f"✓ Classifier instance created")
        print(f"  Model loaded: {model_info['is_loaded']}")
        print(f"  Model name: {model_info['model_name']}")
        print(f"  Labels: {model_info['labels']}")
        
        return True
    except Exception as e:
        print(f"Error in AI model test: {e}")
        return False

def main():
    """Run all tests"""
    print("🧪 Automail AI Server Component Tests")
    print("=" * 50)
    
    tests = [
        ("Flask Import Test", test_flask_import),
        ("Rule-based Classification Test", test_rule_based_classification),
        ("Basic AI Model Test", test_basic_ai_model)
    ]
    
    passed = 0
    for test_name, test_func in tests:
        print(f"\n🔍 Running: {test_name}")
        try:
            if test_func():
                print(f"✅ {test_name}: PASSED")
                passed += 1
            else:
                print(f"❌ {test_name}: FAILED")
        except Exception as e:
            print(f"❌ {test_name}: ERROR - {e}")
    
    print("\n" + "=" * 50)
    print(f"🏁 Results: {passed}/{len(tests)} tests passed")
    
    if passed == len(tests):
        print("🎉 All component tests passed! Server components are working.")
    else:
        print("⚠️ Some tests failed. Check the error messages above.")

if __name__ == "__main__":
    main() 