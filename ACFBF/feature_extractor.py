"""
Feature Extractor for ACFBF Anomaly Detection

Extracts 10 behavioral features from file operation events:
1. access_rate - files accessed per minute
2. write_rate - writes per minute
3. delete_rate - deletes per minute
4. read_write_ratio - reads / writes
5. sensitive_file_ratio - sensitive accesses / total
6. unique_file_ratio - unique files / total ops
7. access_time_entropy - time-of-day irregularity
8. operation_entropy - diversity of ops
9. burstiness_index - max_rate / avg_rate
10. directory_diversity - unique dirs / total ops
"""

import numpy as np
from typing import List, Dict, Tuple
from collections import Counter
from datetime import datetime, timedelta
import json
import math


# Sensitive file extensions
SENSITIVE_EXTENSIONS = {
    'pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'ppt', 'pptx',
    'txt', 'rtf', 'db', 'sql', 'json', 'xml', 'config', 'env',
    'key', 'pem', 'p12', 'pfx', 'cer', 'crt'
}

# Read operations
READ_OPERATIONS = {'access', 'read', 'open'}

# Write operations
WRITE_OPERATIONS = {'create', 'modify', 'write', 'update', 'change'}

# Delete operations
DELETE_OPERATIONS = {'delete', 'unlink', 'remove', 'delete_dir', 'unlinkDir'}


class FeatureExtractor:
    """Extract behavioral features from file operation events."""
    
    def __init__(self, window_minutes: int = 5):
        """
        Initialize feature extractor.
        
        Args:
            window_minutes: Size of sliding window in minutes for rate calculations
        """
        self.window_minutes = window_minutes
        
    def extract_features(self, events: List[Dict]) -> Dict[str, float]:
        """
        Extract all 10 features from a list of file events.
        
        Args:
            events: List of event dictionaries with keys:
                - event_type: Type of operation (create, modify, delete, etc.)
                - file_path: Full path to file
                - file_name: Name of file
                - file_extension: File extension
                - created_at: Timestamp of event
                
        Returns:
            Dictionary with 10 features
        """
        if not events:
            return self._get_zero_features()
        
        # Parse timestamps
        for event in events:
            if isinstance(event.get('created_at'), str):
                event['created_at'] = datetime.fromisoformat(event['created_at'].replace('Z', '+00:00'))
        
        # Calculate time span
        timestamps = [e['created_at'] for e in events if 'created_at' in e]
        if not timestamps:
            return self._get_zero_features()
        
        time_span_minutes = (max(timestamps) - min(timestamps)).total_seconds() / 60.0
        if time_span_minutes < 0.1:  # Less than 6 seconds
            time_span_minutes = 0.1  # Minimum to avoid division by zero
        
        # Extract features
        features = {}
        
        # 1. Access Rate (files accessed per minute)
        access_count = sum(1 for e in events if self._is_read_operation(e['event_type']))
        features['access_rate'] = access_count / time_span_minutes
        
        # 2. Write Rate (writes per minute)
        write_count = sum(1 for e in events if self._is_write_operation(e['event_type']))
        features['write_rate'] = write_count / time_span_minutes
        
        # 3. Delete Rate (deletes per minute)
        delete_count = sum(1 for e in events if self._is_delete_operation(e['event_type']))
        features['delete_rate'] = delete_count / time_span_minutes
        
        # 4. Read/Write Ratio
        if write_count > 0:
            features['read_write_ratio'] = access_count / write_count
        else:
            features['read_write_ratio'] = access_count  # If no writes, just use read count
        
        # 5. Sensitive File Ratio
        sensitive_count = sum(1 for e in events if self._is_sensitive_file(e))
        features['sensitive_file_ratio'] = sensitive_count / len(events) if events else 0.0
        
        # 6. Unique File Ratio
        all_files = [e.get('file_path', '') for e in events if e.get('file_path')]
        unique_files = len(set(all_files))
        features['unique_file_ratio'] = unique_files / len(events) if events else 0.0
        
        # 7. Access Time Entropy (time-of-day irregularity)
        features['access_time_entropy'] = self._calculate_time_entropy(timestamps)
        
        # 8. Operation Entropy (diversity of operations)
        operations = [e['event_type'] for e in events if 'event_type' in e]
        features['operation_entropy'] = self._calculate_entropy(operations)
        
        # 9. Burstiness Index (max_rate / avg_rate)
        features['burstiness_index'] = self._calculate_burstiness(events, timestamps)
        
        # 10. Directory Diversity (unique dirs / total ops)
        directories = []
        for e in events:
            file_path = e.get('file_path', '')
            if file_path:
                # Extract directory from path
                dir_path = file_path.rsplit('/', 1)[0] if '/' in file_path else file_path.rsplit('\\', 1)[0]
                directories.append(dir_path)
        
        unique_dirs = len(set(directories))
        features['directory_diversity'] = unique_dirs / len(events) if events else 0.0
        
        return features
    
    def extract_features_batch(self, events: List[Dict], window_size: int = None) -> List[Dict[str, float]]:
        """
        Extract features for multiple time windows using a sliding window approach.
        
        Args:
            events: List of all events sorted by timestamp
            window_size: Number of events per window (default: all events)
            
        Returns:
            List of feature dictionaries, one per window
        """
        if window_size is None or window_size >= len(events):
            return [self.extract_features(events)]
        
        feature_list = []
        for i in range(0, len(events), window_size // 2):  # 50% overlap
            window_events = events[i:i + window_size]
            if len(window_events) >= 5:  # Minimum events for meaningful features
                features = self.extract_features(window_events)
                feature_list.append(features)
        
        return feature_list
    
    def _is_read_operation(self, event_type: str) -> bool:
        """Check if event is a read operation."""
        return event_type.lower() in READ_OPERATIONS
    
    def _is_write_operation(self, event_type: str) -> bool:
        """Check if event is a write operation."""
        return event_type.lower() in WRITE_OPERATIONS
    
    def _is_delete_operation(self, event_type: str) -> bool:
        """Check if event is a delete operation."""
        return event_type.lower() in DELETE_OPERATIONS
    
    def _is_sensitive_file(self, event: Dict) -> bool:
        """Check if file is considered sensitive."""
        file_ext = event.get('file_extension', '').lower().lstrip('.')
        file_name = event.get('file_name', '').lower()
        
        # Check extension
        if file_ext in SENSITIVE_EXTENSIONS:
            return True
        
        # Check filename for sensitive keywords
        sensitive_keywords = ['password', 'secret', 'confidential', 'private', 
                             'key', 'credential', 'token', 'auth', 'bank', 'ssn']
        return any(keyword in file_name for keyword in sensitive_keywords)
    
    def _calculate_entropy(self, items: List[str]) -> float:
        """
        Calculate Shannon entropy of a list of items.
        Higher entropy = more diverse/irregular.
        """
        if not items:
            return 0.0
        
        # Count occurrences
        counts = Counter(items)
        total = len(items)
        
        # Calculate Shannon entropy
        entropy = 0.0
        for count in counts.values():
            probability = count / total
            if probability > 0:
                entropy -= probability * math.log2(probability)
        
        return entropy
    
    def _calculate_time_entropy(self, timestamps: List[datetime]) -> float:
        """
        Calculate entropy of time-of-day distribution.
        Groups timestamps into hourly bins and calculates entropy.
        """
        if not timestamps:
            return 0.0
        
        # Extract hour of day for each timestamp
        hours = [ts.hour for ts in timestamps]
        
        return self._calculate_entropy([str(h) for h in hours])
    
    def _calculate_burstiness(self, events: List[Dict], timestamps: List[datetime]) -> float:
        """
        Calculate burstiness index: ratio of max rate to average rate.
        High burstiness indicates sporadic intense activity.
        """
        if len(timestamps) < 2:
            return 1.0
        
        # Sort by timestamp
        sorted_events = sorted(zip(timestamps, events), key=lambda x: x[0])
        
        # Calculate rates in 1-minute windows
        time_span = (max(timestamps) - min(timestamps)).total_seconds() / 60.0
        if time_span < 1:
            return 1.0
        
        # Create 1-minute bins
        start_time = min(timestamps)
        num_bins = max(1, int(time_span) + 1)
        bins = [0] * num_bins
        
        for ts, event in sorted_events:
            bin_index = int((ts - start_time).total_seconds() / 60.0)
            if 0 <= bin_index < num_bins:
                bins[bin_index] += 1
        
        # Calculate max rate and average rate
        max_rate = max(bins) if bins else 0
        avg_rate = sum(bins) / len(bins) if bins else 0
        
        if avg_rate > 0:
            return max_rate / avg_rate
        else:
            return 1.0
    
    def _get_zero_features(self) -> Dict[str, float]:
        """Return feature dictionary with all zeros."""
        return {
            'access_rate': 0.0,
            'write_rate': 0.0,
            'delete_rate': 0.0,
            'read_write_ratio': 0.0,
            'sensitive_file_ratio': 0.0,
            'unique_file_ratio': 0.0,
            'access_time_entropy': 0.0,
            'operation_entropy': 0.0,
            'burstiness_index': 1.0,
            'directory_diversity': 0.0
        }
    
    @staticmethod
    def get_feature_names() -> List[str]:
        """Return list of feature names in order."""
        return [
            'access_rate',
            'write_rate',
            'delete_rate',
            'read_write_ratio',
            'sensitive_file_ratio',
            'unique_file_ratio',
            'access_time_entropy',
            'operation_entropy',
            'burstiness_index',
            'directory_diversity'
        ]
    
    def features_to_array(self, features: Dict[str, float]) -> np.ndarray:
        """Convert feature dictionary to numpy array in correct order."""
        feature_names = self.get_feature_names()
        return np.array([features.get(name, 0.0) for name in feature_names])
    
    def features_to_json(self, features: Dict[str, float]) -> str:
        """Convert features to JSON string."""
        return json.dumps(features, indent=2)


def main():
    """Test feature extraction with sample data."""
    print("Feature Extractor Test\n" + "=" * 60)
    
    # Create sample events
    base_time = datetime.now()
    sample_events = [
        {
            'event_type': 'create',
            'file_path': 'C:/Users/test/Documents/report.pdf',
            'file_name': 'report.pdf',
            'file_extension': 'pdf',
            'created_at': base_time
        },
        {
            'event_type': 'modify',
            'file_path': 'C:/Users/test/Documents/report.pdf',
            'file_name': 'report.pdf',
            'file_extension': 'pdf',
            'created_at': base_time + timedelta(seconds=30)
        },
        {
            'event_type': 'access',
            'file_path': 'C:/Users/test/Downloads/image.jpg',
            'file_name': 'image.jpg',
            'file_extension': 'jpg',
            'created_at': base_time + timedelta(minutes=1)
        },
        {
            'event_type': 'delete',
            'file_path': 'C:/Users/test/Temp/temp.txt',
            'file_name': 'temp.txt',
            'file_extension': 'txt',
            'created_at': base_time + timedelta(minutes=2)
        },
    ]
    
    # Extract features
    extractor = FeatureExtractor(window_minutes=5)
    features = extractor.extract_features(sample_events)
    
    # Display results
    print("\nExtracted Features:")
    print("-" * 60)
    for name, value in features.items():
        print(f"{name:25}: {value:.4f}")
    
    print("\n" + "=" * 60)
    print("Feature extraction test complete!")


if __name__ == "__main__":
    main()
