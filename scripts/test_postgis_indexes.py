#!/usr/bin/env python3
"""
PostGIS Spatial Indexing Performance Test
Measures query performance with/without spatial indexes
"""

import psycopg2
import time
import json
from statistics import mean, stdev
from datetime import datetime

# Database connection
DB_CONFIG = {
    'host': 'localhost',
    'database': 'iophin_db',
    'user': 'postgres',
    'password': 'changeme_in_production',
    'port': 5432
}

class PostGISIndexTest:
    def __init__(self):
        self.conn = None
        self.cursor = None
        self.results = {
            'timestamp': datetime.now().isoformat(),
            'tests': []
        }
    
    def connect(self):
        """Connect to PostgreSQL"""
        try:
            self.conn = psycopg2.connect(**DB_CONFIG)
            self.cursor = self.conn.cursor()
            print("✓ Connected to PostgreSQL")
            return True
        except Exception as e:
            print(f"✗ Connection failed: {e}")
            return False
    
    def check_spatial_indexes(self):
        """Check what spatial indexes exist"""
        try:
            self.cursor.execute("""
                SELECT 
                    tablename,
                    indexname,
                    indexdef
                FROM pg_indexes
                WHERE indexdef LIKE '%gist%' OR indexdef LIKE '%spatial%'
                ORDER BY tablename;
            """)
            indexes = self.cursor.fetchall()
            
            print("\n📍 Spatial Indexes Found:")
            for table, index, definition in indexes:
                print(f"  • {table}.{index}")
                print(f"    └─ {definition[:80]}...")
            
            return len(indexes) > 0
        except Exception as e:
            print(f"✗ Error checking indexes: {e}")
            return False
    
    def test_spatial_query(self, bbox_coords, test_name, use_index=True):
        """
        Test spatial query performance
        bbox_coords: (min_lon, min_lat, max_lon, max_lat)
        """
        min_lon, min_lat, max_lon, max_lat = bbox_coords
        
        # Spatial query - viewport intersection
        query = f"""
            SELECT 
                lga_id,
                lga_name,
                state,
                ST_AsGeoJSON(geometry) as geom,
                mpi_value,
                composite_score
            FROM lga_boundaries
            WHERE ST_Intersects(
                geometry,
                ST_MakeEnvelope({min_lon}, {min_lat}, {max_lon}, {max_lat}, 4326)
            )
            LIMIT 100;
        """
        
        durations = []
        
        # Run query 5 times to get average
        for i in range(5):
            start = time.perf_counter()
            try:
                self.cursor.execute(query)
                results = self.cursor.fetchall()
                end = time.perf_counter()
                duration = (end - start) * 1000  # Convert to ms
                durations.append(duration)
            except Exception as e:
                print(f"✗ Query failed: {e}")
                return None
        
        avg_duration = mean(durations)
        min_duration = min(durations)
        max_duration = max(durations)
        
        result = {
            'test': test_name,
            'avg_ms': round(avg_duration, 2),
            'min_ms': round(min_duration, 2),
            'max_ms': round(max_duration, 2),
            'rows_returned': len(results) if results else 0
        }
        
        return result
    
    def test_lga_detail_query(self, lga_id, test_name):
        """Test LGA detail query"""
        query = f"""
            SELECT 
                lga_id,
                lga_name,
                state,
                region,
                mpi_value,
                nightlight_value,
                composite_score,
                risk_level,
                population_density,
                health_facilities,
                schools,
                roads_km,
                electricity_access,
                water_access
            FROM lga_data
            WHERE lga_id = {lga_id};
        """
        
        durations = []
        for i in range(10):
            start = time.perf_counter()
            try:
                self.cursor.execute(query)
                result = self.cursor.fetchone()
                end = time.perf_counter()
                duration = (end - start) * 1000
                durations.append(duration)
            except Exception as e:
                print(f"✗ Query failed: {e}")
                return None
        
        avg_duration = mean(durations)
        
        result = {
            'test': test_name,
            'avg_ms': round(avg_duration, 2),
            'std_dev': round(stdev(durations), 2) if len(durations) > 1 else 0,
            'p95_ms': round(sorted(durations)[int(len(durations) * 0.95)], 2)
        }
        
        return result
    
    def test_anomaly_detection_query(self, test_name):
        """Test anomaly detection query"""
        query = """
            SELECT 
                anomaly_id,
                lga_id,
                lga_name,
                anomaly_type,
                severity,
                anomaly_score,
                timestamp,
                description
            FROM detected_anomalies
            WHERE timestamp >= NOW() - INTERVAL '7 days'
            AND severity >= 0.7
            ORDER BY timestamp DESC
            LIMIT 50;
        """
        
        durations = []
        for i in range(5):
            start = time.perf_counter()
            try:
                self.cursor.execute(query)
                results = self.cursor.fetchall()
                end = time.perf_counter()
                duration = (end - start) * 1000
                durations.append(duration)
            except Exception as e:
                print(f"✗ Query failed: {e}")
                return None
        
        avg_duration = mean(durations)
        
        result = {
            'test': test_name,
            'avg_ms': round(avg_duration, 2),
            'rows_returned': len(results) if results else 0
        }
        
        return result
    
    def run_all_tests(self):
        """Run comprehensive spatial index tests"""
        print("\n" + "="*70)
        print("  PostGIS Spatial Indexing Performance Tests")
        print("="*70)
        
        if not self.connect():
            return
        
        # Check existing indexes
        has_indexes = self.check_spatial_indexes()
        
        if not has_indexes:
            print("\n⚠️  WARNING: No spatial indexes found!")
            print("   Run: CREATE INDEX idx_lga_geom ON lga_boundaries USING GIST(geometry);")
        
        print("\n📊 Running Tests...")
        
        # Test 1: Viewport queries (different zoom levels)
        print("\n1️⃣  Viewport Queries (Spatial Intersection):")
        
        # Full Nigeria bbox
        result = self.test_spatial_query(
            (2.668, 4.277, 14.680, 13.892),
            "Full Country Viewport"
        )
        if result:
            self.results['tests'].append(result)
            print(f"   ✓ Full Country: {result['avg_ms']}ms avg (returned {result['rows_returned']} LGAs)")
        
        # Zoomed region (e.g., Northern Nigeria)
        result = self.test_spatial_query(
            (5.0, 9.0, 10.0, 13.0),
            "Regional Viewport (North)"
        )
        if result:
            self.results['tests'].append(result)
            print(f"   ✓ Regional View: {result['avg_ms']}ms avg (returned {result['rows_returned']} LGAs)")
        
        # Highly zoomed (single LGA)
        result = self.test_spatial_query(
            (8.5, 10.5, 9.0, 11.0),
            "Zoomed LGA Viewport"
        )
        if result:
            self.results['tests'].append(result)
            print(f"   ✓ Zoomed View: {result['avg_ms']}ms avg (returned {result['rows_returned']} LGAs)")
        
        # Test 2: LGA detail queries
        print("\n2️⃣  LGA Detail Panel Queries:")
        
        result = self.test_lga_detail_query(1, "LGA Detail Query")
        if result:
            self.results['tests'].append(result)
            print(f"   ✓ Detail Panel: {result['avg_ms']}ms avg (p95: {result['p95_ms']}ms)")
        
        # Test 3: Anomaly feed
        print("\n3️⃣  Anomaly Feed Queries:")
        
        result = self.test_anomaly_detection_query("Anomaly Feed Query")
        if result:
            self.results['tests'].append(result)
            print(f"   ✓ Anomaly Feed: {result['avg_ms']}ms avg (returned {result['rows_returned']} anomalies)")
        
        # Summary
        print("\n" + "="*70)
        print("📈 Test Summary:")
        print("="*70)
        
        for test in self.results['tests']:
            print(f"\n{test['test']}:")
            print(f"  Average: {test['avg_ms']}ms")
            if 'p95_ms' in test:
                print(f"  95th percentile: {test['p95_ms']}ms")
            if 'rows_returned' in test:
                print(f"  Rows: {test['rows_returned']}")
        
        # Save results
        self.save_results()
        self.conn.close()
    
    def save_results(self):
        """Save results to JSON"""
        output_file = 'results/perf/postgis_index_test.json'
        try:
            with open(output_file, 'w') as f:
                json.dump(self.results, f, indent=2)
            print(f"\n✓ Results saved to: {output_file}")
        except Exception as e:
            print(f"✗ Error saving results: {e}")

if __name__ == '__main__':
    test = PostGISIndexTest()
    test.run_all_tests()
