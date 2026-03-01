"""
Synthetic Data Generator for ACFBF Training

Generates realistic file operation patterns including:
- Normal office work behavior
- Data exfiltration patterns
- Ransomware-like activity
- Late-night anomalies
"""

import numpy as np
import json
from datetime import datetime, timedelta
from typing import List, Dict
import random


class SyntheticDataGenerator:
    """Generate synthetic file operation data for model training."""
    
    def __init__(self, seed: int = 42):
        """Initialize generator with random seed for reproducibility."""
        np.random.seed(seed)
        random.seed(seed)
        
        # File types and paths
        self.document_extensions = ['pdf', 'docx', 'xlsx', 'pptx', 'txt', 'csv']
        self.image_extensions = ['jpg', 'png', 'gif', 'bmp', 'svg']
        self.code_extensions = ['py', 'js', 'java', 'cpp', 'html', 'css']
        self.sensitive_extensions = ['db', 'sql', 'env', 'key', 'pem', 'config']
        self.executable_extensions = ['exe', 'bat', 'ps1', 'sh']
        
        self.directories = [
            'C:/Users/user/Documents',
            'C:/Users/user/Downloads',
            'C:/Users/user/Desktop',
            'C:/Users/user/Pictures',
            'C:/Users/user/Projects',
            'C:/Users/user/AppData/Local/Temp',
            'D:/Backup',
            'E:/ExternalDrive'
        ]
        
        self.file_names = [
            'report', 'presentation', 'budget', 'meeting_notes', 'project',
            'analysis', 'data', 'backup', 'archive', 'document', 'spreadsheet',
            'image', 'photo', 'screenshot', 'config', 'settings', 'temp'
        ]
    
    def generate_normal_behavior(self, num_events: int = 1000, 
                                 duration_hours: int = 8) -> List[Dict]:
        """
        Generate normal office work behavior patterns.
        
        Args:
            num_events: Number of events to generate
            duration_hours: Time span for events
            
        Returns:
            List of event dictionaries
        """
        events = []
        base_time = datetime.now().replace(hour=9, minute=0, second=0, microsecond=0)
        
        for i in range(num_events):
            # Normal working hours (9 AM - 5 PM)
            hours_offset = random.uniform(0, duration_hours)
            timestamp = base_time + timedelta(hours=hours_offset)
            
            # Event type distribution (normal behavior)
            event_type_choice = random.random()
            if event_type_choice < 0.5:  # 50% access/read
                event_type = random.choice(['access', 'read'])
            elif event_type_choice < 0.8:  # 30% modify
                event_type = 'modify'
            elif event_type_choice < 0.9:  # 10% create
                event_type = 'create'
            else:  # 10% delete
                event_type = 'delete'
            
            # File type (mostly documents)
            ext_choice = random.random()
            if ext_choice < 0.6:
                extension = random.choice(self.document_extensions)
            elif ext_choice < 0.8:
                extension = random.choice(self.image_extensions)
            elif ext_choice < 0.95:
                extension = random.choice(self.code_extensions)
            else:
                extension = random.choice(self.sensitive_extensions)
            
            # File path (mostly work directories)
            directory = random.choice(self.directories[:5])  # Exclude external drives
            file_name = f"{random.choice(self.file_names)}_{i % 100}.{extension}"
            file_path = f"{directory}/{file_name}"
            
            event = {
                'event_type': event_type,
                'file_path': file_path,
                'file_name': file_name,
                'file_extension': extension,
                'created_at': timestamp.isoformat(),
                'is_external_drive': 0,
                'user_id': 'normal_user',
                'process_name': random.choice(['word.exe', 'excel.exe', 'chrome.exe', 'explorer.exe'])
            }
            events.append(event)
        
        return sorted(events, key=lambda x: x['created_at'])
    
    def generate_data_exfiltration(self, num_events: int = 200) -> List[Dict]:
        """
        Generate data exfiltration pattern.
        
        Characteristics:
        - High delete rate
        - External drive usage
        - Sensitive file access
        - Burst activity
        """
        events = []
        base_time = datetime.now().replace(hour=22, minute=0, second=0)  # Late night
        
        # Concentrated in short time span (burst pattern)
        duration_minutes = 30
        
        for i in range(num_events):
            # Concentrated timestamps
            minutes_offset = random.uniform(0, duration_minutes)
            timestamp = base_time + timedelta(minutes=minutes_offset)
            
            # High proportion of sensitive files
            if random.random() < 0.7:  # 70% sensitive
                extension = random.choice(self.sensitive_extensions + self.document_extensions)
            else:
                extension = random.choice(self.document_extensions)
            
            # Mix of access and delete operations
            if random.random() < 0.6:
                event_type = 'access'
            else:
                event_type = 'delete'
            
            # Often to external drive
            if random.random() < 0.5:
                directory = 'E:/ExternalDrive'
                is_external = 1
            else:
                directory = random.choice(self.directories[:3])
                is_external = 0
            
            file_name = f"{random.choice(['confidential', 'passwords', 'database', 'backup'])}_{i}.{extension}"
            file_path = f"{directory}/{file_name}"
            
            event = {
                'event_type': event_type,
                'file_path': file_path,
                'file_name': file_name,
                'file_extension': extension,
                'created_at': timestamp.isoformat(),
                'is_external_drive': is_external,
                'user_id': 'suspicious_user',
                'process_name': 'powershell.exe'
            }
            events.append(event)
        
        return sorted(events, key=lambda x: x['created_at'])
    
    def generate_ransomware_pattern(self, num_events: int = 500) -> List[Dict]:
        """
        Generate ransomware-like activity pattern.
        
        Characteristics:
        - Very high write rate
        - High delete rate
        - Sequential file access
        - Many unique files
        """
        events = []
        base_time = datetime.now()
        
        # Extremely concentrated (ransomware works fast)
        duration_minutes = 10
        
        for i in range(num_events):
            # Very concentrated timestamps (high burstiness)
            minutes_offset = random.uniform(0, duration_minutes)
            timestamp = base_time + timedelta(minutes=minutes_offset)
            
            # Mostly writes and deletes
            event_type = random.choice(['modify', 'modify', 'delete', 'create'])
            
            # Mix of file types
            extension = random.choice(self.document_extensions + self.image_extensions)
            
            # Sequential unique files
            directory = random.choice(self.directories[:4])
            file_name = f"file_{i}.{extension}"
            file_path = f"{directory}/{file_name}"
            
            event = {
                'event_type': event_type,
                'file_path': file_path,
                'file_name': file_name,
                'file_extension': extension,
                'created_at': timestamp.isoformat(),
                'is_external_drive': 0,
                'user_id': 'ransomware_process',
                'process_name': random.choice(['suspicious.exe', 'unknown.exe', 'malware.exe'])
            }
            events.append(event)
        
        return sorted(events, key=lambda x: x['created_at'])
    
    def generate_mixed_dataset(self, 
                              normal_ratio: float = 0.8,
                              total_events: int = 2000) -> List[Dict]:
        """
        Generate mixed dataset with normal and anomalous behavior.
        
        Args:
            normal_ratio: Proportion of normal events (0-1)
            total_events: Total number of events to generate
            
        Returns:
            List of all events mixed together
        """
        num_normal = int(total_events * normal_ratio)
        num_anomalous = total_events - num_normal
        
        # Generate normal events
        normal_events = self.generate_normal_behavior(num_events=num_normal)
        
        # Generate anomalous events (split between types)
        num_exfiltration = num_anomalous // 2
        num_ransomware = num_anomalous - num_exfiltration
        
        exfiltration_events = self.generate_data_exfiltration(num_events=num_exfiltration)
        ransomware_events = self.generate_ransomware_pattern(num_events=num_ransomware)
        
        # Combine and shuffle
        all_events = normal_events + exfiltration_events + ransomware_events
        random.shuffle(all_events)
        
        return all_events
    
    def save_to_json(self, events: List[Dict], filepath: str):
        """Save events to JSON file."""
        with open(filepath, 'w') as f:
            json.dump(events, f, indent=2)
        print(f"Saved {len(events)} events to {filepath}")
    
    def save_to_csv(self, events: List[Dict], filepath: str):
        """Save events to CSV file."""
        import csv
        
        if not events:
            return
        
        fieldnames = events[0].keys()
        with open(filepath, 'w', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(events)
        
        print(f"Saved {len(events)} events to {filepath}")


def main():
    """Generate synthetic training data."""
    print("=" * 70)
    print("SYNTHETIC DATA GENERATION FOR ACFBF TRAINING")
    print("=" * 70)
    
    generator = SyntheticDataGenerator(seed=42)
    
    # Generate different behavior patterns
    print("\n1. Generating normal behavior patterns...")
    normal = generator.generate_normal_behavior(num_events=1000)
    print(f"   Generated {len(normal)} normal events")
    
    print("\n2. Generating data exfiltration patterns...")
    exfiltration = generator.generate_data_exfiltration(num_events=200)
    print(f"   Generated {len(exfiltration)} exfiltration events")
    
    print("\n3. Generating ransomware patterns...")
    ransomware = generator.generate_ransomware_pattern(num_events=300)
    print(f"   Generated {len(ransomware)} ransomware events")
    
    print("\n4. Generating mixed training dataset...")
    mixed = generator.generate_mixed_dataset(normal_ratio=0.8, total_events=3000)
    print(f"   Generated {len(mixed)} total events (80% normal, 20% anomalous)")
    
    # Save datasets
    print("\n5. Saving datasets...")
    generator.save_to_json(normal, 'ACFBF/data_normal.json')
    generator.save_to_json(exfiltration, 'ACFBF/data_exfiltration.json')
    generator.save_to_json(ransomware, 'ACFBF/data_ransomware.json')
    generator.save_to_json(mixed, 'ACFBF/data_training.json')
    
    # Display statistics
    print("\n" + "=" * 70)
    print("DATASET STATISTICS")
    print("=" * 70)
    
    def show_stats(events, name):
        event_types = {}
        for e in events:
            et = e['event_type']
            event_types[et] = event_types.get(et, 0) + 1
        
        print(f"\n{name}:")
        print(f"  Total events: {len(events)}")
        print(f"  Event type distribution:")
        for et, count in sorted(event_types.items()):
            print(f"    {et:15}: {count:5} ({count/len(events)*100:.1f}%)")
    
    show_stats(normal, "Normal Behavior")
    show_stats(exfiltration, "Data Exfiltration")
    show_stats(ransomware, "Ransomware Pattern")
    
    print("\n" + "=" * 70)
    print("✓ Synthetic data generation complete!")
    print("=" * 70)


if __name__ == "__main__":
    main()
