"""
Test script for Automail AI Server endpoints
Tests classification functionality and API endpoints
"""
import requests
import json
import time

# Test configuration
BASE_URL = 'http://localhost:5000'
API_KEY = 'automail-dev-key-2024'

# Test email samples
TEST_EMAILS = [
    {
        'content': 'Team meeting tomorrow at 2pm in conference room B. Please bring quarterly reports.',
        'subject': 'Team Meeting - Q4 Planning',
        'expected': 'Work'
    },
    {
        'content': 'Happy birthday! Hope you have a wonderful day. Looking forward to the party this weekend.',
        'subject': 'Happy Birthday!',
        'expected': 'Personal'
    },
    {
        'content': 'Congratulations! You have won $1,000,000! Click here to claim your prize now. Limited time offer!',
        'subject': 'YOU WON!!!',
        'expected': 'Spam'
    },
    {
        'content': 'Your password will expire in 3 days. Please click here to update your security settings immediately.',
        'subject': 'Security Alert - Password Expiring',
        'expected': 'Important'
    },
    {
        'content': 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt.',
        'subject': 'Random text',
        'expected': 'Review'
    }
]

def test_health_endpoint():
    """Test the health check endpoint"""
    print("🩺 Testing health endpoint...")
    try:
        response = requests.get(f"{BASE_URL}/health")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Health check passed: {data['status']}")
            print(f"   Model loaded: {data['model_loaded']}")
            return True
        else:
            print(f"❌ Health check failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Health check error: {str(e)}")
        return False

def test_classify_endpoint():
    """Test the single email classification endpoint"""
    print("\n📧 Testing email classification...")
    
    headers = {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY
    }
    
    correct_predictions = 0
    total_tests = len(TEST_EMAILS)
    
    for i, email in enumerate(TEST_EMAILS, 1):
        print(f"\n  Test {i}/{total_tests}: {email['subject']}")
        
        payload = {
            'content': email['content'],
            'subject': email['subject']
        }
        
        try:
            start_time = time.time()
            response = requests.post(f"{BASE_URL}/classify", json=payload, headers=headers)
            response_time = time.time() - start_time
            
            if response.status_code == 200:
                result = response.json()
                predicted_label = result['label']
                confidence = result['confidence']
                
                is_correct = predicted_label == email['expected']
                if is_correct:
                    correct_predictions += 1
                
                status = "✅" if is_correct else "❌"
                print(f"    {status} Predicted: {predicted_label} (confidence: {confidence:.3f})")
                print(f"    Expected: {email['expected']}")
                print(f"    Response time: {response_time:.3f}s")
                print(f"    Reasoning: {result.get('reasoning', 'N/A')}")
                
            else:
                print(f"    ❌ Request failed: {response.status_code}")
                print(f"    Error: {response.text}")
                
        except Exception as e:
            print(f"    ❌ Request error: {str(e)}")
    
    accuracy = (correct_predictions / total_tests) * 100
    print(f"\n📊 Classification Results:")
    print(f"   Accuracy: {accuracy:.1f}% ({correct_predictions}/{total_tests})")
    
    return accuracy > 50  # Consider it successful if > 50% accuracy

def test_batch_classify_endpoint():
    """Test the batch classification endpoint"""
    print("\n📦 Testing batch classification...")
    
    headers = {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY
    }
    
    # Prepare batch payload
    emails = [
        {'content': email['content'], 'subject': email['subject']} 
        for email in TEST_EMAILS[:3]  # Test with first 3 emails
    ]
    
    payload = {'emails': emails}
    
    try:
        start_time = time.time()
        response = requests.post(f"{BASE_URL}/batch-classify", json=payload, headers=headers)
        response_time = time.time() - start_time
        
        if response.status_code == 200:
            result = response.json()
            results = result['results']
            total_emails = result['total_emails']
            processing_time = result['processing_time']
            
            print(f"✅ Batch classification successful:")
            print(f"   Emails processed: {total_emails}")
            print(f"   Server processing time: {processing_time:.3f}s")
            print(f"   Total response time: {response_time:.3f}s")
            
            for i, classification in enumerate(results):
                print(f"   Email {i+1}: {classification['label']} ({classification['confidence']:.3f})")
            
            return True
        else:
            print(f"❌ Batch classification failed: {response.status_code}")
            print(f"Error: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Batch classification error: {str(e)}")
        return False

def test_api_security():
    """Test API security (authentication and rate limiting)"""
    print("\n🔒 Testing API security...")
    
    # Test without API key
    print("  Testing request without API key...")
    try:
        response = requests.post(f"{BASE_URL}/classify", json={'content': 'test'})
        if response.status_code == 401:
            print("  ✅ Correctly rejected request without API key")
        else:
            print(f"  ❌ Expected 401, got {response.status_code}")
    except Exception as e:
        print(f"  ❌ Error testing no API key: {str(e)}")
    
    # Test with invalid API key
    print("  Testing request with invalid API key...")
    try:
        headers = {'X-API-Key': 'invalid-key', 'Content-Type': 'application/json'}
        response = requests.post(f"{BASE_URL}/classify", json={'content': 'test'}, headers=headers)
        if response.status_code == 401:
            print("  ✅ Correctly rejected invalid API key")
        else:
            print(f"  ❌ Expected 401, got {response.status_code}")
    except Exception as e:
        print(f"  ❌ Error testing invalid API key: {str(e)}")
    
    # Test rate limiting (make rapid requests)
    print("  Testing rate limiting...")
    try:
        headers = {'X-API-Key': API_KEY, 'Content-Type': 'application/json'}
        rapid_requests = 0
        rate_limited = False
        
        for i in range(10):  # Make 10 rapid requests
            response = requests.post(f"{BASE_URL}/classify", json={'content': 'test'}, headers=headers)
            if response.status_code == 429:
                rate_limited = True
                break
            rapid_requests += 1
        
        if rate_limited:
            print(f"  ✅ Rate limiting activated after {rapid_requests} requests")
        else:
            print(f"  ℹ️ No rate limiting triggered in 10 requests (might be normal for dev)")
            
    except Exception as e:
        print(f"  ❌ Error testing rate limiting: {str(e)}")

def test_error_handling():
    """Test error handling scenarios"""
    print("\n🚨 Testing error handling...")
    
    headers = {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY
    }
    
    # Test missing required field
    print("  Testing missing content field...")
    try:
        response = requests.post(f"{BASE_URL}/classify", json={'subject': 'test'}, headers=headers)
        if response.status_code == 400:
            print("  ✅ Correctly handled missing content field")
        else:
            print(f"  ❌ Expected 400, got {response.status_code}")
    except Exception as e:
        print(f"  ❌ Error testing missing field: {str(e)}")
    
    # Test empty content
    print("  Testing empty content...")
    try:
        response = requests.post(f"{BASE_URL}/classify", json={'content': ''}, headers=headers)
        if response.status_code in [200, 400]:  # Either handle gracefully or reject
            print("  ✅ Handled empty content appropriately")
        else:
            print(f"  ❌ Unexpected status code: {response.status_code}")
    except Exception as e:
        print(f"  ❌ Error testing empty content: {str(e)}")
    
    # Test invalid endpoint
    print("  Testing invalid endpoint...")
    try:
        response = requests.post(f"{BASE_URL}/invalid", json={'content': 'test'}, headers=headers)
        if response.status_code == 404:
            print("  ✅ Correctly returned 404 for invalid endpoint")
        else:
            print(f"  ❌ Expected 404, got {response.status_code}")
    except Exception as e:
        print(f"  ❌ Error testing invalid endpoint: {str(e)}")

def main():
    """Run all tests"""
    print("🧪 Automail AI Server Test Suite")
    print("=" * 50)
    
    # Check if server is running
    if not test_health_endpoint():
        print("❌ Server is not accessible. Make sure it's running on localhost:5000")
        return
    
    # Run all tests
    tests = [
        test_classify_endpoint,
        test_batch_classify_endpoint,
        test_api_security,
        test_error_handling
    ]
    
    passed_tests = 0
    for test_func in tests:
        try:
            if test_func():
                passed_tests += 1
        except Exception as e:
            print(f"❌ Test {test_func.__name__} failed with error: {str(e)}")
    
    print("\n" + "=" * 50)
    print(f"🏁 Test Results: {passed_tests}/{len(tests)} tests passed")
    
    if passed_tests == len(tests):
        print("🎉 All tests passed! AI Server is working correctly.")
    else:
        print("⚠️ Some tests failed. Please check the server configuration.")

if __name__ == '__main__':
    main() 