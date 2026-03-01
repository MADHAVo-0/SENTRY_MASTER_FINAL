"""
Advanced Behavioral Anomaly Detection System

This module implements a multi-layered anomaly detection system for file behavior monitoring:
1. Context Identification using K-means clustering
2. Fingerprint Analysis using Multivariate Gaussian
3. Deviation Detection using Mahalanobis Distance
4. Risk Evaluation using Adaptive Thresholding
"""

import numpy as np
import pickle
from pathlib import Path
from typing import Dict, List, Tuple, Optional
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from scipy.stats import multivariate_normal
from scipy.spatial.distance import mahalanobis
import warnings
warnings.filterwarnings('ignore')


class BehavioralAnomalyDetector:
    """
    Advanced anomaly detection system for file behavior monitoring.
    
    Uses a multi-stage approach:
    - K-means for behavioral context clustering
    - Multivariate Gaussian for normal behavior modeling
    - Mahalanobis distance for anomaly scoring
    - Adaptive thresholding for dynamic risk assessment
    """
    
    def __init__(self, n_contexts: int = 5, adaptive_window: int = 100):
        """
        Initialize the anomaly detector.
        
        Args:
            n_contexts: Number of behavioral contexts (K-means clusters)
            adaptive_window: Window size for adaptive threshold calculation
        """
        self.n_contexts = n_contexts
        self.adaptive_window = adaptive_window
        
        # Context Identification: K-means clustering
        self.kmeans = KMeans(n_clusters=n_contexts, random_state=42, n_init=10)
        self.scaler = StandardScaler()
        
        # Fingerprint Analysis: Multivariate Gaussian parameters per context
        self.context_means = {}  # Mean vectors for each context
        self.context_covariances = {}  # Covariance matrices for each context
        self.context_gaussians = {}  # Fitted Gaussian distributions
        
        # Deviation Detection: Mahalanobis distance tracking
        self.mahalanobis_history = []  # Historical distances for adaptive thresholding
        
        # Risk Evaluation: Adaptive thresholds per context
        self.adaptive_thresholds = {}  # Dynamic thresholds for each context
        self.baseline_threshold = 3.0  # Initial baseline (3 std deviations)
        
        # Model state
        self.is_trained = False
        self.feature_names = None
        
    def fit(self, X: np.ndarray, feature_names: Optional[List[str]] = None) -> 'BehavioralAnomalyDetector':
        """
        Train the anomaly detection model on normal behavior data.
        
        Args:
            X: Training data of shape (n_samples, n_features)
            feature_names: Optional list of feature names
            
        Returns:
            self: The trained detector
        """
        print(f"Training anomaly detector on {X.shape[0]} samples with {X.shape[1]} features...")
        
        # Store feature names
        self.feature_names = feature_names or [f"feature_{i}" for i in range(X.shape[1])]
        
        # Step 1: Context Identification using K-means
        print("Step 1: Identifying behavioral contexts using K-means...")
        X_scaled = self.scaler.fit_transform(X)
        context_labels = self.kmeans.fit_predict(X_scaled)
        
        # Step 2: Fingerprint Analysis using Multivariate Gaussian
        print("Step 2: Learning normal behavior fingerprints using Multivariate Gaussian...")
        for context_id in range(self.n_contexts):
            # Get samples belonging to this context
            context_mask = context_labels == context_id
            context_samples = X_scaled[context_mask]
            
            if len(context_samples) < 2:
                print(f"Warning: Context {context_id} has insufficient samples, using global statistics")
                context_samples = X_scaled
            
            # Calculate mean and covariance for this context
            mean = np.mean(context_samples, axis=0)
            cov = np.cov(context_samples.T)
            
            # Add regularization to ensure positive definite covariance
            cov += np.eye(cov.shape[0]) * 1e-6
            
            # Store parameters
            self.context_means[context_id] = mean
            self.context_covariances[context_id] = cov
            
            # Create multivariate Gaussian distribution
            try:
                self.context_gaussians[context_id] = multivariate_normal(mean=mean, cov=cov, allow_singular=True)
                print(f"  Context {context_id}: {np.sum(context_mask)} samples, mean={mean[:3].round(2)}...")
            except Exception as e:
                print(f"  Warning: Could not create Gaussian for context {context_id}: {e}")
        
        # Step 3: Calculate initial Mahalanobis distances for baseline
        print("Step 3: Calculating baseline Mahalanobis distances...")
        for i, sample in enumerate(X_scaled):
            context = context_labels[i]
            if context in self.context_covariances:
                try:
                    cov_inv = np.linalg.inv(self.context_covariances[context])
                    dist = mahalanobis(sample, self.context_means[context], cov_inv)
                    self.mahalanobis_history.append(dist)
                except:
                    pass
        
        # Step 4: Initialize adaptive thresholds
        print("Step 4: Initializing adaptive thresholds...")
        if self.mahalanobis_history:
            baseline_mean = np.mean(self.mahalanobis_history)
            baseline_std = np.std(self.mahalanobis_history)
            
            for context_id in range(self.n_contexts):
                # Set initial threshold at mean + 3*std for each context
                self.adaptive_thresholds[context_id] = baseline_mean + self.baseline_threshold * baseline_std
                print(f"  Context {context_id}: Initial threshold = {self.adaptive_thresholds[context_id]:.3f}")
        
        self.is_trained = True
        print("✓ Training complete!\n")
        return self
    
    def predict(self, X: np.ndarray) -> Dict:
        """
        Predict anomalies and risk scores for new data.
        
        Args:
            X: Input data of shape (n_samples, n_features)
            
        Returns:
            Dict containing:
                - contexts: Identified behavioral contexts
                - mahalanobis_distances: Deviation scores
                - risk_scores: Normalized risk scores (0-1)
                - is_anomaly: Boolean flags for anomalies
                - risk_levels: Risk categorization (low/medium/high/critical)
        """
        if not self.is_trained:
            raise ValueError("Model must be trained before prediction. Call fit() first.")
        
        # Scale features
        X_scaled = self.scaler.transform(X)
        
        n_samples = X_scaled.shape[0]
        results = {
            'contexts': np.zeros(n_samples, dtype=int),
            'mahalanobis_distances': np.zeros(n_samples),
            'risk_scores': np.zeros(n_samples),
            'is_anomaly': np.zeros(n_samples, dtype=bool),
            'risk_levels': []
        }
        
        for i, sample in enumerate(X_scaled):
            # Step 1: Context Identification
            context = self.kmeans.predict([sample])[0]
            results['contexts'][i] = context
            
            # Step 2: Deviation Detection using Mahalanobis Distance
            if context in self.context_covariances:
                try:
                    cov_inv = np.linalg.inv(self.context_covariances[context])
                    dist = mahalanobis(sample, self.context_means[context], cov_inv)
                    results['mahalanobis_distances'][i] = dist
                    
                    # Update adaptive threshold
                    self._update_adaptive_threshold(context, dist)
                    
                    # Step 3: Risk Evaluation using Adaptive Thresholding
                    threshold = self.adaptive_thresholds.get(context, self.baseline_threshold)
                    
                    # Normalize risk score (0-1 scale)
                    risk_score = min(dist / (threshold * 1.5), 1.0)
                    results['risk_scores'][i] = risk_score
                    
                    # Determine if anomaly
                    results['is_anomaly'][i] = dist > threshold
                    
                    # Categorize risk level
                    if dist > threshold * 1.5:
                        risk_level = 'critical'
                    elif dist > threshold:
                        risk_level = 'high'
                    elif dist > threshold * 0.7:
                        risk_level = 'medium'
                    else:
                        risk_level = 'low'
                    
                    results['risk_levels'].append(risk_level)
                    
                except Exception as e:
                    # Handle singular matrix or other errors
                    results['mahalanobis_distances'][i] = 0
                    results['risk_scores'][i] = 0
                    results['is_anomaly'][i] = False
                    results['risk_levels'].append('low')
            else:
                results['risk_levels'].append('unknown')
        
        return results
    
    def _update_adaptive_threshold(self, context: int, new_distance: float):
        """
        Update adaptive threshold for a context using a sliding window approach.
        
        This handles behavioral drift by adjusting thresholds based on recent observations.
        
        Args:
            context: Context ID
            new_distance: New Mahalanobis distance to incorporate
        """
        # Add to history (maintain sliding window)
        self.mahalanobis_history.append(new_distance)
        if len(self.mahalanobis_history) > self.adaptive_window:
            self.mahalanobis_history.pop(0)
        
        # Recalculate adaptive threshold
        if len(self.mahalanobis_history) >= 10:  # Minimum samples for reliable estimate
            recent_mean = np.mean(self.mahalanobis_history[-self.adaptive_window:])
            recent_std = np.std(self.mahalanobis_history[-self.adaptive_window:])
            
            # Update threshold: mean + 3*std (99.7% confidence interval)
            new_threshold = recent_mean + self.baseline_threshold * recent_std
            
            # Smooth the update (exponential moving average)
            alpha = 0.1  # Learning rate for threshold adaptation
            if context in self.adaptive_thresholds:
                self.adaptive_thresholds[context] = (
                    alpha * new_threshold + (1 - alpha) * self.adaptive_thresholds[context]
                )
            else:
                self.adaptive_thresholds[context] = new_threshold
    
    def get_feature_importance(self, X: np.ndarray) -> Dict[str, float]:
        """
        Calculate feature importance based on variance contribution to Mahalanobis distance.
        
        Args:
            X: Sample data
            
        Returns:
            Dictionary mapping feature names to importance scores
        """
        if not self.is_trained:
            raise ValueError("Model must be trained first.")
        
        X_scaled = self.scaler.transform(X)
        
        # Calculate variance explained by each feature across all contexts
        feature_importance = np.zeros(X_scaled.shape[1])
        
        for context_id, cov in self.context_covariances.items():
            # Eigenvalues represent variance along principal components
            eigenvalues = np.linalg.eigvalsh(cov)
            feature_importance += np.abs(eigenvalues)
        
        # Normalize to sum to 1
        feature_importance /= feature_importance.sum()
        
        # Create mapping to feature names
        importance_dict = {
            self.feature_names[i]: float(feature_importance[i])
            for i in range(len(self.feature_names))
        }
        
        # Sort by importance
        return dict(sorted(importance_dict.items(), key=lambda x: x[1], reverse=True))
    
    def save_model(self, filepath: str):
        """Save the trained model to disk."""
        # Ensure directory exists
        path = Path(filepath)
        path.parent.mkdir(parents=True, exist_ok=True)
        
        model_data = {
            'kmeans': self.kmeans,
            'scaler': self.scaler,
            'context_means': self.context_means,
            'context_covariances': self.context_covariances,
            'adaptive_thresholds': self.adaptive_thresholds,
            'mahalanobis_history': self.mahalanobis_history,
            'n_contexts': self.n_contexts,
            'adaptive_window': self.adaptive_window,
            'baseline_threshold': self.baseline_threshold,
            'is_trained': self.is_trained,
            'feature_names': self.feature_names
        }
        
        with open(filepath, 'wb') as f:
            pickle.dump(model_data, f)
        print(f"Model saved to {filepath}")
    
    def load_model(self, filepath: str):
        """Load a trained model from disk."""
        with open(filepath, 'rb') as f:
            model_data = pickle.load(f)
        
        self.kmeans = model_data['kmeans']
        self.scaler = model_data['scaler']
        self.context_means = model_data['context_means']
        self.context_covariances = model_data['context_covariances']
        self.adaptive_thresholds = model_data['adaptive_thresholds']
        self.mahalanobis_history = model_data['mahalanobis_history']
        self.n_contexts = model_data['n_contexts']
        self.adaptive_window = model_data['adaptive_window']
        self.baseline_threshold = model_data['baseline_threshold']
        self.is_trained = model_data['is_trained']
        self.feature_names = model_data['feature_names']
        
        # Reconstruct Gaussian distributions
        self.context_gaussians = {}
        for context_id in self.context_means.keys():
            try:
                self.context_gaussians[context_id] = multivariate_normal(
                    mean=self.context_means[context_id],
                    cov=self.context_covariances[context_id],
                    allow_singular=True
                )
            except:
                pass
        
        print(f"Model loaded from {filepath}")
        return self


def generate_sample_data(n_samples: int = 1000, n_features: int = 8) -> Tuple[np.ndarray, List[str]]:
    """
    Generate synthetic file behavior data for demonstration.
    
    Args:
        n_samples: Number of samples to generate
        n_features: Number of behavioral features
        
    Returns:
        Tuple of (data array, feature names)
    """
    np.random.seed(42)
    
    feature_names = [
        'read_frequency',
        'write_frequency',
        'execution_count',
        'file_size_change',
        'access_time_variance',
        'permission_changes',
        'network_activity',
        'process_count'
    ][:n_features]
    
    # Generate normal behavior (80% of data)
    normal_samples = int(n_samples * 0.8)
    normal_data = np.random.randn(normal_samples, n_features) * 0.5 + 1.0
    
    # Generate some anomalous behavior (20% of data)
    anomaly_samples = n_samples - normal_samples
    anomaly_data = np.random.randn(anomaly_samples, n_features) * 2.0 + 5.0
    
    # Combine
    X = np.vstack([normal_data, anomaly_data])
    
    # Ensure all values are positive (behavioral metrics)
    X = np.abs(X)
    
    return X, feature_names


def main():
    """Demonstration of the Behavioral Anomaly Detection System."""
    
    print("=" * 70)
    print("BEHAVIORAL ANOMALY DETECTION SYSTEM - DEMONSTRATION")
    print("=" * 70)
    print()
    
    # Generate sample data
    print("Generating synthetic file behavior data...")
    X_train, feature_names = generate_sample_data(n_samples=1000, n_features=8)
    X_test, _ = generate_sample_data(n_samples=100, n_features=8)
    print(f"✓ Generated {X_train.shape[0]} training samples and {X_test.shape[0]} test samples\n")
    
    # Initialize and train the detector
    detector = BehavioralAnomalyDetector(n_contexts=5, adaptive_window=100)
    detector.fit(X_train, feature_names=feature_names)
    
    # Make predictions
    print("\n" + "=" * 70)
    print("ANALYZING TEST DATA")
    print("=" * 70 + "\n")
    
    results = detector.predict(X_test)
    
    # Display results summary
    print(f"Total samples analyzed: {len(results['contexts'])}")
    print(f"Anomalies detected: {np.sum(results['is_anomaly'])} ({np.sum(results['is_anomaly'])/len(results['is_anomaly'])*100:.1f}%)")
    print()
    
    # Risk level distribution
    from collections import Counter
    risk_distribution = Counter(results['risk_levels'])
    print("Risk Level Distribution:")
    for level in ['low', 'medium', 'high', 'critical']:
        count = risk_distribution.get(level, 0)
        print(f"  {level.capitalize():8}: {count:3} ({count/len(results['risk_levels'])*100:5.1f}%)")
    print()
    
    # Context distribution
    context_distribution = Counter(results['contexts'])
    print("Behavioral Context Distribution:")
    for context_id in sorted(context_distribution.keys()):
        count = context_distribution[context_id]
        print(f"  Context {context_id}: {count:3} samples ({count/len(results['contexts'])*100:5.1f}%)")
    print()
    
    # Feature importance
    print("Feature Importance Analysis:")
    importance = detector.get_feature_importance(X_train)
    for feature, score in list(importance.items())[:5]:
        print(f"  {feature:25}: {score:.4f}")
    print()
    
    # Show some example detections
    print("Sample Anomaly Detections:")
    anomaly_indices = np.where(results['is_anomaly'])[0][:5]
    for idx in anomaly_indices:
        print(f"  Sample {idx:3} | Context: {results['contexts'][idx]} | "
              f"Mahalanobis Dist: {results['mahalanobis_distances'][idx]:.3f} | "
              f"Risk: {results['risk_scores'][idx]:.3f} | "
              f"Level: {results['risk_levels'][idx].upper()}")
    print()
    
    # Save model
    model_path = "anomaly_detector_model.pkl"
    detector.save_model(model_path)
    print(f"\n✓ Complete! Model saved to {model_path}")
    print("\nThe system is ready to detect behavioral anomalies in file operations.")
    print("=" * 70)


if __name__ == "__main__":
    main()
