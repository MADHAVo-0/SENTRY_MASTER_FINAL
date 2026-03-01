"""
Model Manager CLI for ACFBF

Command-line interface for:
- Training models on event data
- Making predictions
- Evaluating model performance
- Loading/saving models
"""

import sys
import json
import argparse
import sqlite3
from pathlib import Path
from datetime import datetime, timedelta
import numpy as np

# Import ACFBF components
from feature_extractor import FeatureExtractor
from concept_model import BehavioralAnomalyDetector


class ModelManager:
    """Manage ACFBF model training, prediction, and evaluation."""
    
    def __init__(self, model_path: str = "trained_model.pkl"):
        """Initialize model manager."""
        self.model_path = model_path
        self.detector = None
        self.extractor = FeatureExtractor(window_minutes=5)
        
    def load_events_from_db(self, db_path: str, limit: int = None, hours_back: int = None) -> list:
        """
        Load events from SQLite database.
        
        Args:
            db_path: Path to SQLite database
            limit: Maximum number of events to load
            hours_back: Only load events from last N hours
            
        Returns:
            List of event dictionaries
        """
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        query = "SELECT * FROM file_events"
        params = []
        
        if hours_back:
            cutoff_time = datetime.now() - timedelta(hours=hours_back)
            query += " WHERE created_at >= ?"
            params.append(cutoff_time.isoformat())
        
        query += " ORDER BY created_at DESC"
        
        if limit:
            query += " LIMIT ?"
            params.append(limit)
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        conn.close()
        
        # Convert to list of dicts
        events = [dict(row) for row in rows]
        return events
    
    def load_events_from_json(self, json_path: str) -> list:
        """Load events from JSON file."""
        with open(json_path, 'r') as f:
            events = json.load(f)
        return events
    
    def train_model(self, events: list, n_contexts: int = 5):
        """
        Train the anomaly detection model.
        
        Args:
            events: List of event dictionaries
            n_contexts: Number of behavioral contexts
        """
        print(f"\n{'='*70}")
        print("TRAINING ACFBF MODEL")
        print(f"{'='*70}\n")
        
        # Extract features
        print(f"Processing {len(events)} events...")
        features = self.extractor.extract_features(events)
        
        # Convert to array
        feature_array = self.extractor.features_to_array(features).reshape(1, -1)
        
        # If we have multiple events, use batch extraction
        if len(events) > 100:
            print("Using sliding window feature extraction...")
            feature_list = self.extractor.extract_features_batch(events, window_size=100)
            feature_arrays = [self.extractor.features_to_array(f) for f in feature_list]
            X = np.array(feature_arrays)
        else:
            X = feature_array
        
        print(f"Extracted features: shape={X.shape}")
        
        # Initialize and train detector
        self.detector = BehavioralAnomalyDetector(n_contexts=n_contexts)
        self.detector.fit(X, feature_names=self.extractor.get_feature_names())
        
        # Save model
        self.detector.save_model(self.model_path)
        
        print(f"\n{'='*70}")
        print("✓ Model training complete!")
        print(f"{'='*70}\n")
        
        return self.detector
    
    def load_model(self):
        """Load trained model from disk."""
        if not Path(self.model_path).exists():
            raise FileNotFoundError(f"Model file not found: {self.model_path}")
        
        self.detector = BehavioralAnomalyDetector()
        self.detector.load_model(self.model_path)
        print(f"✓ Model loaded from {self.model_path}")
        return self.detector
    
    def predict(self, events: list) -> dict:
        """
        Make predictions on new events.
        
        Args:
            events: List of event dictionaries
            
        Returns:
            Dictionary with predictions and features
        """
        if self.detector is None:
            self.load_model()
        
        # Extract features
        features = self.extractor.extract_features(events)
        X = self.extractor.features_to_array(features).reshape(1, -1)
        
        # Make prediction
        results = self.detector.predict(X)
        
        # Combine with features
        output = {
            'features': features,
            'context': int(results['contexts'][0]),
            'mahalanobis_distance': float(results['mahalanobis_distances'][0]),
            'risk_score': float(results['risk_scores'][0]),
            'is_anomaly': bool(results['is_anomaly'][0]),
            'risk_level': results['risk_levels'][0],
            'timestamp': datetime.now().isoformat()
        }
        
        return output
    
    def evaluate(self, events: list, labels: list = None):
        """
        Evaluate model performance.
        
        Args:
            events: List of event dictionaries
            labels: Optional true labels (1 for anomaly, 0 for normal)
        """
        if self.detector is None:
            self.load_model()
        
        print(f"\n{'='*70}")
        print("MODEL EVALUATION")
        print(f"{'='*70}\n")
        
        # Extract features
        feature_list = self.extractor.extract_features_batch(events, window_size=100)
        X = np.array([self.extractor.features_to_array(f) for f in feature_list])
        
        # Make predictions
        results = self.detector.predict(X)
        
        # Display results
        print(f"Total samples evaluated: {len(results['contexts'])}")
        print(f"Anomalies detected: {np.sum(results['is_anomaly'])} ({np.sum(results['is_anomaly'])/len(results['is_anomaly'])*100:.1f}%)")
        
        # Risk level distribution
        from collections import Counter
        risk_dist = Counter(results['risk_levels'])
        print("\nRisk Level Distribution:")
        for level in ['low', 'medium', 'high', 'critical']:
            count = risk_dist.get(level, 0)
            pct = count / len(results['risk_levels']) * 100 if results['risk_levels'] else 0
            print(f"  {level.capitalize():10}: {count:4} ({pct:5.1f}%)")
        
        # Feature importance
        print("\nTop 5 Most Important Features:")
        importance = self.detector.get_feature_importance(X)
        for i, (feature, score) in enumerate(list(importance.items())[:5], 1):
            print(f"  {i}. {feature:25}: {score:.4f}")
        
        # If labels provided, calculate accuracy metrics
        if labels is not None and len(labels) == len(results['is_anomaly']):
            labels = np.array(labels)
            predictions = results['is_anomaly']
            
            tp = np.sum((predictions == True) & (labels == 1))
            tn = np.sum((predictions == False) & (labels == 0))
            fp = np.sum((predictions == True) & (labels == 0))
            fn = np.sum((predictions == False) & (labels == 1))
            
            accuracy = (tp + tn) / len(labels)
            precision = tp / (tp + fp) if (tp + fp) > 0 else 0
            recall = tp / (tp + fn) if (tp + fn) > 0 else 0
            f1_score = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0
            
            print("\nClassification Metrics:")
            print(f"  Accuracy:  {accuracy:.3f}")
            print(f"  Precision: {precision:.3f}")
            print(f"  Recall:    {recall:.3f}")
            print(f"  F1 Score:  {f1_score:.3f}")
        
        print(f"\n{'='*70}\n")
        
        return results


def main():
    """CLI entry point."""
    parser = argparse.ArgumentParser(description="ACFBF Model Manager")
    subparsers = parser.add_subparsers(dest='command', help='Command to execute')
    
    # Train command
    train_parser = subparsers.add_parser('train', help='Train the model')
    train_parser.add_argument('--data', required=True, help='Path to training data (JSON file)')
    train_parser.add_argument('--contexts', type=int, default=5, help='Number of contexts')
    train_parser.add_argument('--output', default='trained_model.pkl', help='Output model path')
    
    # Predict command
    predict_parser = subparsers.add_parser('predict', help='Make predictions')
    predict_parser.add_argument('--data', help='Path to event data (JSON file)')
    predict_parser.add_argument('--db', help='Path to SQLite database')
    predict_parser.add_argument('--hours', type=int, help='Only use events from last N hours')
    predict_parser.add_argument('--limit', type=int, default=1000, help='Max events to process')
    predict_parser.add_argument('--model', default='trained_model.pkl', help='Model path')
    
    # Evaluate command
    eval_parser = subparsers.add_parser('evaluate', help='Evaluate model')
    eval_parser.add_argument('--data', required=True, help='Path to test data (JSON file)')
    eval_parser.add_argument('--model', default='ACFBF/trained_model.pkl', help='Model path')
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return
    
    # Initialize manager
    manager = ModelManager(model_path=args.output if args.command == 'train' else args.model)
    
    # Execute command
    if args.command == 'train':
        events = manager.load_events_from_json(args.data)
        manager.train_model(events, n_contexts=args.contexts)
    
    elif args.command == 'predict':
        if args.db:
            events = manager.load_events_from_db(args.db, limit=args.limit, hours_back=args.hours)
        elif args.data:
            events = manager.load_events_from_json(args.data)
        else:
            print("Error: Must provide either --data or --db")
            return
        
        if not events:
            print("No events to process")
            return
        
        result = manager.predict(events)
        print(json.dumps(result, indent=2))
    
    elif args.command == 'evaluate':
        events = manager.load_events_from_json(args.data)
        manager.evaluate(events)


if __name__ == "__main__":
    main()
