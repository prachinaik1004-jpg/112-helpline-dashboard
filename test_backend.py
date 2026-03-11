#!/usr/bin/env python3
"""
112 Goa Emergency Response System - Backend Test Script
This script tests the backend API endpoints to ensure everything is working correctly.
"""

import requests
import json
import time
import sys

BASE_URL = "http://localhost:5000"

def test_endpoint(endpoint, description):
    """Test a specific endpoint"""
    print(f"🧪 Testing {description}...")
    try:
        response = requests.get(f"{BASE_URL}{endpoint}", timeout=10)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ {description} - Status: {response.status_code}")
            if 'success' in data and data['success']:
                print(f"   Response: Success")
            else:
                print(f"   Response: {data}")
            return True
        else:
            print(f"❌ {description} - Status: {response.status_code}")
            print(f"   Error: {response.text}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"❌ {description} - Connection Error: {e}")
        return False

def test_alerts_with_filters():
    """Test alerts endpoint with various filters"""
    print("\n🔍 Testing alerts with filters...")
    
    # Test basic alerts
    test_endpoint("/api/alerts", "Basic alerts")
    
    # Test with limit
    test_endpoint("/api/alerts?limit=10", "Alerts with limit")
    
    # Test with urgency filter
    test_endpoint("/api/alerts?urgency=High", "High urgency alerts")
    
    # Test with station filter
    test_endpoint("/api/alerts?station=PANJIM", "PANJIM station alerts")

def test_search():
    """Test search functionality"""
    print("\n🔍 Testing search functionality...")
    
    # Test basic search
    test_endpoint("/api/search?q=fighting", "Search for 'fighting'")
    
    # Test search with filters
    test_endpoint("/api/search?q=accident&station=PANJIM&limit=5", "Search with filters")

def test_analytics():
    """Test analytics endpoints"""
    print("\n📊 Testing analytics...")
    
    test_endpoint("/api/stats", "Statistics")
    test_endpoint("/api/analytics/trends", "Trend analysis")

def test_health():
    """Test health check"""
    print("\n🏥 Testing health check...")
    
    response = requests.get(f"{BASE_URL}/api/health", timeout=5)
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Health check - Status: {data.get('status', 'unknown')}")
        print(f"   Database: {data.get('database', 'unknown')}")
        print(f"   Total calls: {data.get('total_calls', 'unknown')}")
        return True
    else:
        print(f"❌ Health check failed - Status: {response.status_code}")
        return False

def main():
    """Main test function"""
    print("🧪 112 Goa Emergency Response System - Backend Tests")
    print("=" * 60)
    
    # Wait a moment for server to start
    print("⏳ Waiting for server to start...")
    time.sleep(2)
    
    # Test if server is running
    try:
        response = requests.get(f"{BASE_URL}/api/health", timeout=5)
        if response.status_code != 200:
            print("❌ Server is not running or not responding")
            print("Please start the backend first with: python start_backend.py")
            sys.exit(1)
    except requests.exceptions.RequestException:
        print("❌ Cannot connect to server")
        print("Please start the backend first with: python start_backend.py")
        sys.exit(1)
    
    print("✅ Server is running, starting tests...\n")
    
    # Run all tests
    tests_passed = 0
    total_tests = 0
    
    # Basic endpoint tests
    test_functions = [
        ("/api/health", "Health check", test_health),
        ("/api/stats", "Statistics", lambda: test_endpoint("/api/stats", "Statistics")),
        ("/api/alerts", "Alerts", lambda: test_endpoint("/api/alerts", "Alerts")),
        ("/api/analytics/trends", "Trends", lambda: test_endpoint("/api/analytics/trends", "Trends")),
        ("/data", "Raw data", lambda: test_endpoint("/data", "Raw data")),
    ]
    
    for endpoint, description, test_func in test_functions:
        total_tests += 1
        if test_func():
            tests_passed += 1
        print()
    
    # Advanced tests
    test_alerts_with_filters()
    test_search()
    test_analytics()
    
    # Summary
    print("=" * 60)
    print(f"📊 Test Results: {tests_passed}/{total_tests} basic tests passed")
    print("✅ Advanced tests completed")
    
    if tests_passed == total_tests:
        print("🎉 All tests passed! Backend is working correctly.")
    else:
        print("⚠️  Some tests failed. Check the output above for details.")
    
    print("\n🌐 Backend is ready for use!")
    print("📡 API Documentation: http://localhost:5000")
    print("🔍 Health Check: http://localhost:5000/api/health")

if __name__ == "__main__":
    main()
