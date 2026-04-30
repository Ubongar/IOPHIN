#!/usr/bin/env python3
"""
Redis Status Checker for IOPHIN
Verifies all Redis and API components are operational
"""

import subprocess
import json
import sys
from urllib.request import urlopen, Request
from urllib.error import URLError
import time

def check_redis():
    """Check if Redis server is responding"""
    try:
        result = subprocess.run(
            ['C:\\Users\\Michael\\Downloads\\redis\\redis-cli.exe', 'ping'],
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode == 0 and 'PONG' in result.stdout:
            return True, "Redis is responding"
        else:
            return False, f"Redis not responding: {result.stderr}"
    except Exception as e:
        return False, f"Redis connection failed: {str(e)}"

def check_redis_keys():
    """Get count of cached keys"""
    try:
        result = subprocess.run(
            ['C:\\Users\\Michael\\Downloads\\redis\\redis-cli.exe', 'DBSize'],
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode == 0:
            # Parse "(integer) N" format
            output = result.stdout.strip()
            count = output.split()[-1] if output else "0"
            return True, f"{count} keys cached"
        return False, "Failed to get key count"
    except Exception as e:
        return False, f"Error: {str(e)}"

def check_api():
    """Check if API server is responding"""
    try:
        req = Request('http://localhost:5000/api/health')
        response = urlopen(req, timeout=5)
        data = json.loads(response.read().decode())
        if data.get('status') == 'healthy':
            return True, "API is healthy"
        else:
            return False, f"API unhealthy: {data}"
    except URLError as e:
        return False, f"API not responding: {str(e)}"
    except Exception as e:
        return False, f"API check failed: {str(e)}"

def check_api_redis_integration():
    """Verify API can access Redis"""
    try:
        req = Request('http://localhost:5000/api/stats')
        response = urlopen(req, timeout=10)
        data = json.loads(response.read().decode())
        if 'totalLGAs' in data:
            return True, "API-Redis integration working"
        else:
            return False, "API returned unexpected response"
    except Exception as e:
        return False, f"Integration check failed: {str(e)}"

def print_status(check_name, passed, message):
    """Print formatted status line"""
    status = "✅" if passed else "❌"
    print(f"{status}  {check_name:<35} {message}")

def main():
    print("\n" + "="*70)
    print("  IOPHIN Redis & Backend Status Check")
    print("="*70 + "\n")

    checks = [
        ("Redis Server", check_redis),
        ("Redis Keys", check_redis_keys),
        ("API Server", check_api),
        ("API-Redis Integration", check_api_redis_integration),
    ]

    results = []
    for check_name, check_func in checks:
        try:
            passed, message = check_func()
            results.append((check_name, passed, message))
            print_status(check_name, passed, message)
        except Exception as e:
            results.append((check_name, False, str(e)))
            print_status(check_name, False, str(e))

    # Summary
    print("\n" + "="*70)
    passed_count = sum(1 for _, passed, _ in results if passed)
    total_count = len(results)
    
    if passed_count == total_count:
        print(f"  ✅ ALL CHECKS PASSED ({passed_count}/{total_count})")
        print("="*70 + "\n")
        return 0
    else:
        print(f"  ⚠️  SOME CHECKS FAILED ({passed_count}/{total_count})")
        print("="*70 + "\n")
        print("  Failed checks:")
        for name, passed, msg in results:
            if not passed:
                print(f"    • {name}: {msg}")
        print()
        return 1

if __name__ == '__main__':
    sys.exit(main())
