"""
Simple verification script to test ACFBF ML system
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(__file__))

from feature_extractor import FeatureExtractor
from concept_model import ACFBFModel
import json

def test_feature_extraction():
    """Test feature extraction"""
    print("=" * 60)
    print("TEST 1: Feature Extraction")
    print("=" * 60)
    
    # Sample events
    events = [
        {"event_type": "create", "file_path": "C:/test.txt", "created_at": "2026-02-03T09:00:00"},
        {"event_type": "modify", "file_path": "C:/test.txt", "created_at": "2026-02-03T09:01:00"},
        {"event_type": "delete", "file_path": "C:/test.txt", "created_at": "2026-02-03T09:02:00"},
    ]
    
    extractor = FeatureExtractor()
    features = extractor.extract_features(events)
    
    print(f"✓ Extracted features shape: {features.shape}")
    print(f"✓ Feature vector: {features[0][:3]}... (showing first 3 values)")
    print("✓ Feature extraction: PASSED\n")
    return True

def test_model_prediction():
    """Test model prediction"""
    print("=" * 60)
    print("TEST 2: Model Prediction")
    print("=" * 60)
    
    model_path = os.path.join(os.path.dirname(__file__), 'trained_model.pkl')
    
    if not os.path.exists(model_path):
        print(f"✗ Model file not found: {model_path}")
        return False
    
    # Load model
    model = ACFBFModel(n_contexts=5)
    model.load_model(model_path)
    print(f"✓ Model loaded successfully from {model_path}")
    
    # Create sample data
    import numpy as np
    sample_features = np.array([[0.1, 0.05, 0.02, 1.5, 0.1, 0.8, 2.1, 1.3, 1.2, 0.5]])
    
    # Predict
    prediction = model.predict(sample_features)
    
    print(f"✓ Risk Score: {prediction['risk_score']:.3f}")
    print(f"✓ Context: {prediction['context']}")
    print(f"✓ Risk Level: {prediction['risk_level']}")
    print(f"✓ Is Anomaly: {prediction['is_anomaly']}")
    print("✓ Model prediction: PASSED\n")
    return True

def test_end_to_end():
    """Test complete pipeline"""
    print("=" * 60)
    print("TEST 3: End-to-End Pipeline")
    print("=" * 60)
    
    # Load training data
    data_path = os.path.join(os.path.dirname(__file__), 'training_data.json')
    
    if not os.path.exists(data_path):
        print(f"✗ Training data not found: {data_path}")
        return False
    
    with open(data_path, 'r') as f:
        events = json.load(f)
    
    print(f"✓ Loaded {len(events)} events from training data")
    
    # Extract features
    extractor = FeatureExtractor()
    features = extractor.extract_features(events[:50])  # Use first 50 events
    print(f"✓ Extracted features for {len(features)} event groups")
    
    # Load model and predict
    model = ACFBFModel(n_contexts=5)
    model.load_model(os.path.join(os.path.dirname(__file__), 'trained_model.pkl'))
    
    prediction = model.predict(features[-1:])  # Predict on last group
    
    print(f"✓ Prediction complete:")
    print(f"  - Risk Score: {prediction['risk_score']:.3f}")
    print(f"  - Risk Level: {prediction['risk_level']}")
    print("✓ End-to-end pipeline: PASSED\n")
    return True

def main():
    """Run all tests"""
    print("\n" + "=" * 60)
    print("ACFBF ML SYSTEM VERIFICATION")
    print("=" * 60 + "\n")
    
    tests = [
        test_feature_extraction,
        test_model_prediction,
        test_end_to_end
    ]
    
    results = []
    for test in tests:
        try:
            result = test()
            results.append(result)
        except Exception as e:
            print(f"✗ Test failed with error: {e}\n")
            results.append(False)
    
    # Summary
    print("=" * 60)
    print("SUMMARY")
    print("=" * 60)
    passed = sum(results)
    total = len(results)
    print(f"Passed: {passed}/{total} tests")
    
    if passed == total:
        print("\n✓ ALL TESTS PASSED - System is operational!")
        return 0
    else:
        print(f"\n✗ {total - passed} test(s) failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())
