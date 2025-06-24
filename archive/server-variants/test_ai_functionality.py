#!/usr/bin/env python3
"""
Simple test script to verify AI functionality works
This will help us test the core AI features before running the full server
"""

import sys
import os
sys.path.append(os.path.dirname(__file__))

from utils.classifier import get_classifier
from utils.logging_config import setup_logging

def test_ai_classification():
    """Test AI email classification functionality"""
    
    print("🤖 Testing Automail AI Classification System")
    print("=" * 50)
    
    # Initialize logging
    setup_logging()
    
    # Get classifier instance
    print("📚 Loading AI classifier...")
    classifier = get_classifier()
    
    # Load model
    print("🔄 Loading DistilBERT model...")
    success = classifier.load_model()
    
    if not success:
        print("❌ Failed to load AI model, testing fallback classification...")
    else:
        print("✅ AI model loaded successfully!")
    
    # Test emails
    test_emails = [
        {
            "subject": "Team Meeting - Q4 Planning",
            "content": "Hi team, we need to discuss our quarterly goals and project deadlines for Q4. Please review the attached documents before our meeting tomorrow at 3 PM in the conference room."
        },
        {
            "subject": "Birthday Party Invitation!",
            "content": "Hey! You're invited to my birthday party this Saturday at 7 PM. We'll have pizza, games, and cake. Hope to see you there! RSVP by Friday please."
        },
        {
            "subject": "URGENT: Account Verification Required",
            "content": "Your account security may be compromised. Please click here immediately to verify your account credentials and prevent unauthorized access."
        },
        {
            "subject": "Limited Time Offer - 90% OFF!",
            "content": "Congratulations! You've been selected for our exclusive promotion. Click now to claim your massive discount before it expires. Act fast!"
        },
        {
            "subject": "Re: Project Update",
            "content": "Thanks for the update on the client presentation. The deadline is tight but achievable. Let's schedule a quick sync tomorrow morning to review the final slides."
        }
    ]
    
    print(f"\n📧 Testing {len(test_emails)} sample emails:")
    print("-" * 50)
    
    for i, email in enumerate(test_emails, 1):
        print(f"\n📬 Email {i}:")
        print(f"   Subject: {email['subject']}")
        print(f"   Content: {email['content'][:60]}...")
        
        # Classify email
        result = classifier.classify_email(email['content'], email['subject'])
        
        print(f"   🎯 Classification: {result['label']}")
        print(f"   📊 Confidence: {result['confidence']:.2f}")
        print(f"   💭 Reasoning: {result['reasoning'][:80]}...")
    
    print("\n" + "=" * 50)
    print("✅ AI Classification Test Complete!")
    
    # Test batch classification
    print("\n🔄 Testing batch classification...")
    batch_results = classifier.batch_classify(test_emails)
    print(f"✅ Batch processed {len(batch_results)} emails successfully")
    
    return True

if __name__ == "__main__":
    try:
        test_ai_classification()
        print("\n🎉 All tests passed! The AI system is working correctly.")
        print("\n💡 Next steps:")
        print("   1. Start the Flask server with: python app.py")
        print("   2. Test the Chrome extension integration")
        print("   3. Check the AI labels in the sidebar")
        
    except Exception as e:
        print(f"\n❌ Test failed with error: {str(e)}")
        print("\n🔧 This may indicate missing dependencies or configuration issues.")
        sys.exit(1) 