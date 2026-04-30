#!/usr/bin/env python3
"""
Redis Cache Hit/Miss Test
Measures cache effectiveness and performance impact
"""

import redis
import json
import time
import requests
from datetime import datetime
from statistics import mean

REDIS_URL = 'redis://localhost:6379'
API_BASE = 'http://localhost:5000'

class RedisCacheTest:
    def __init__(self):
        self.redis_client = None
        self.results = {
            'timestamp': datetime.now().isoformat(),
            'endpoints': []
        }
    
    def connect_redis(self):
        """Connect to Redis"""
        try:
            self.redis_client = redis.from_url(REDIS_URL)
            self.redis_client.ping()
            print("✓ Connected to Redis")
            return True
        except Exception as e:
            print(f"✗ Redis connection failed: {e}")
            return False
    
    def get_redis_stats(self):
        """Get Redis memory and key statistics"""
        try:
            info = self.redis_client.info('memory')
            dbsize = self.redis_client.dbsize()
            
            stats = {
                'memory_used_mb': round(info.get('used_memory', 0) / 1024 / 1024, 2),
                'memory_peak_mb': round(info.get('used_memory_peak', 0) / 1024 / 1024, 2),
                'total_keys': dbsize,
                'evicted_keys': info.get('evicted_keys', 0),
                'expired_keys': info.get('expired_keys', 0)
            }
            return stats
        except Exception as e:
            print(f"✗ Error getting Redis stats: {e}")
            return None
    
    def test_endpoint_caching(self, endpoint, test_name, calls=3):
        """
        Test single endpoint caching
        Measure: first call (cache miss), subsequent calls (cache hits)
        """
        print(f"\n📍 Testing: {test_name}")
        print(f"   Endpoint: {endpoint}")
        
        # Clear relevant cache before test
        keys_before = self.redis_client.dbsize()
        
        durations = []
        cache_status = []
        
        for call_num in range(calls):
            start = time.perf_counter()
            try:
                response = requests.get(f"{API_BASE}{endpoint}", timeout=10)
                end = time.perf_counter()
                
                duration_ms = (end - start) * 1000
                durations.append(duration_ms)
                
                # Determine if cache hit or miss
                # Typically: first call slower (miss), subsequent faster (hit)
                if call_num == 0:
                    status = "MISS (first call)"
                else:
                    # If significantly faster than first, it's likely a cache hit
                    if duration_ms < durations[0] * 0.5:
                        status = "HIT (cache)"
                    else:
                        status = "MISS (expired or slow DB)"
                
                cache_status.append(status)
                
                if response.status_code == 200:
                    size_kb = len(response.content) / 1024
                    print(f"   Call {call_num + 1}: {duration_ms:.2f}ms - {status} ({size_kb:.1f} KB)")
                else:
                    print(f"   Call {call_num + 1}: ERROR {response.status_code}")
            
            except requests.exceptions.Timeout:
                print(f"   Call {call_num + 1}: TIMEOUT (>10s)")
                durations.append(10000)
                cache_status.append("TIMEOUT")
            except Exception as e:
                print(f"   Call {call_num + 1}: ERROR - {str(e)}")
        
        keys_after = self.redis_client.dbsize()
        
        result = {
            'endpoint': endpoint,
            'test_name': test_name,
            'calls': calls,
            'first_call_ms': round(durations[0], 2),
            'avg_subsequent_ms': round(mean(durations[1:]), 2) if len(durations) > 1 else 0,
            'speedup_factor': round(durations[0] / mean(durations[1:]), 1) if len(durations) > 1 and mean(durations[1:]) > 0 else 0,
            'cache_hits': sum(1 for s in cache_status if 'HIT' in s),
            'cache_misses': sum(1 for s in cache_status if 'MISS' in s),
            'keys_added': keys_after - keys_before,
            'total_time_ms': round(sum(durations), 2)
        }
        
        self.results['endpoints'].append(result)
        return result
    
    def test_concurrent_requests(self, endpoint, num_requests=10):
        """Test multiple concurrent requests to measure cache effectiveness"""
        print(f"\n🔄 Concurrent Test: {num_requests} requests to {endpoint}")
        
        import concurrent.futures
        
        durations = []
        hits = 0
        misses = 0
        
        def make_request():
            try:
                start = time.perf_counter()
                response = requests.get(f"{API_BASE}{endpoint}", timeout=10)
                end = time.perf_counter()
                return (end - start) * 1000
            except:
                return None
        
        with concurrent.futures.ThreadPoolExecutor(max_workers=num_requests) as executor:
            futures = [executor.submit(make_request) for _ in range(num_requests)]
            
            for future in concurrent.futures.as_completed(futures):
                duration = future.result()
                if duration:
                    durations.append(duration)
                    # First few requests might be slow (cache miss/populate)
                    # Later ones should be fast (cache hit)
                    if duration < 50:
                        hits += 1
                    else:
                        misses += 1
        
        avg = mean(durations) if durations else 0
        min_val = min(durations) if durations else 0
        max_val = max(durations) if durations else 0
        
        print(f"   {len(durations)} requests completed")
        print(f"   Avg: {avg:.2f}ms | Min: {min_val:.2f}ms | Max: {max_val:.2f}ms")
        print(f"   Est. Cache Hits: {hits} | Cache Misses: {misses}")
        
        return {
            'concurrent_requests': num_requests,
            'avg_ms': round(avg, 2),
            'min_ms': round(min_val, 2),
            'max_ms': round(max_val, 2),
            'est_hits': hits,
            'est_misses': misses
        }
    
    def run_all_tests(self):
        """Run comprehensive cache tests"""
        print("\n" + "="*70)
        print("  Redis Cache Effectiveness Tests")
        print("="*70)
        
        if not self.connect_redis():
            return
        
        # Get initial stats
        redis_stats = self.get_redis_stats()
        print(f"\n📊 Redis Status:")
        print(f"   Memory Used: {redis_stats['memory_used_mb']}MB")
        print(f"   Total Keys: {redis_stats['total_keys']}")
        
        # Test 1: Stats endpoint (fast, frequently accessed)
        print("\n1️⃣  Statistics Endpoint (Cache TTL: 120s):")
        self.test_endpoint_caching(
            '/api/stats',
            'Global Statistics',
            calls=5
        )
        
        # Test 2: Rankings endpoint (medium load)
        print("\n2️⃣  Rankings Endpoint (Cache TTL: 300s):")
        self.test_endpoint_caching(
            '/api/rankings?limit=20',
            'Top 20 LGA Rankings',
            calls=5
        )
        
        # Test 3: Hotspots endpoint (large response)
        print("\n3️⃣  Hotspots Endpoint (Cache TTL: 300s):")
        self.test_endpoint_caching(
            '/api/hotspots?type=critical',
            'Critical Hotspots',
            calls=3
        )
        
        # Test 4: Health endpoint (always fast, no cache needed)
        print("\n4️⃣  Health Endpoint (No caching):")
        self.test_endpoint_caching(
            '/api/health',
            'API Health Check',
            calls=3
        )
        
        # Test 5: Concurrent requests
        print("\n5️⃣  Concurrent Request Test:")
        concurrent_result = self.test_concurrent_requests('/api/stats', num_requests=10)
        
        # Final stats
        print("\n" + "="*70)
        print("📈 Final Redis Stats:")
        print("="*70)
        
        redis_stats_final = self.get_redis_stats()
        print(f"   Memory Used: {redis_stats_final['memory_used_mb']}MB")
        print(f"   Total Keys: {redis_stats_final['total_keys']}")
        print(f"   Memory Overhead: {redis_stats_final['memory_used_mb'] - redis_stats['memory_used_mb']:.2f}MB")
        
        # Summary analysis
        print("\n" + "="*70)
        print("🎯 Cache Performance Summary:")
        print("="*70)
        
        total_speedup = 0
        for ep in self.results['endpoints']:
            if ep.get('speedup_factor', 0) > 1:
                print(f"\n{ep['test_name']}:")
                print(f"  First call:  {ep['first_call_ms']}ms (cache miss)")
                print(f"  Avg after:   {ep['avg_subsequent_ms']}ms (cache hit)")
                print(f"  Speedup:     {ep['speedup_factor']}x faster")
                print(f"  Cache Hits:  {ep['cache_hits']} | Misses: {ep['cache_misses']}")
                total_speedup += ep['speedup_factor']
        
        if self.results['endpoints']:
            avg_speedup = total_speedup / len(self.results['endpoints'])
            print(f"\n📊 Average Speedup: {avg_speedup:.1f}x faster with caching")
        
        # Save results
        self.save_results()
    
    def save_results(self):
        """Save results to JSON"""
        output_file = 'results/perf/redis_cache_test.json'
        try:
            with open(output_file, 'w') as f:
                json.dump(self.results, f, indent=2)
            print(f"\n✓ Results saved to: {output_file}")
        except Exception as e:
            print(f"✗ Error saving results: {e}")

if __name__ == '__main__':
    test = RedisCacheTest()
    test.run_all_tests()
