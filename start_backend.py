#!/usr/bin/env python3
"""
112 Goa Emergency Response System - Backend Startup Script
This script handles the complete setup and startup of the backend system.
"""

import os
import sys
import subprocess
import sqlite3
from pathlib import Path

def check_python_version():
    """Check if Python version is compatible"""
    if sys.version_info < (3, 7):
        print("❌ Error: Python 3.7 or higher is required")
        print(f"Current version: {sys.version}")
        sys.exit(1)
    print(f"✅ Python version: {sys.version.split()[0]}")

def install_dependencies():
    """Install required Python packages"""
    print("📦 Installing dependencies...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])
        print("✅ Dependencies installed successfully")
    except subprocess.CalledProcessError as e:
        print(f"❌ Error installing dependencies: {e}")
        sys.exit(1)

def check_csv_file():
    """Check if CSV file exists"""
    csv_path = "cleaned_ALL_DATA_IN_DETAIL.csv"
    if not os.path.exists(csv_path):
        print(f"❌ Error: CSV file not found: {csv_path}")
        print("Please ensure the CSV file is in the current directory")
        sys.exit(1)
    print(f"✅ CSV file found: {csv_path}")

def check_database():
    """Check database status"""
    db_path = "emergency_data.db"
    if os.path.exists(db_path):
        try:
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM emergency_calls")
            count = cursor.fetchone()[0]
            conn.close()
            print(f"✅ Database found with {count} records")
        except Exception as e:
            print(f"⚠️  Database exists but may be corrupted: {e}")
            print("Database will be recreated on startup")
    else:
        print("ℹ️  Database will be created on first startup")

def start_backend():
    """Start the backend server"""
    print("\n🚀 Starting 112 Goa Emergency Response Backend...")
    print("=" * 60)
    
    try:
        # Import and run the backend
        from backend import app, data_manager
        print("✅ Backend modules loaded successfully")
        print("✅ Database initialized and data loaded")
        print("\n🌐 Server is starting...")
        print("📡 API Documentation: http://localhost:5000")
        print("🔍 Health Check: http://localhost:5000/api/health")
        print("📊 Statistics: http://localhost:5000/api/stats")
        print("\nPress Ctrl+C to stop the server")
        print("=" * 60)
        
        app.run(debug=True, host='0.0.0.0', port=5000)
        
    except KeyboardInterrupt:
        print("\n\n🛑 Server stopped by user")
    except Exception as e:
        print(f"\n❌ Error starting server: {e}")
        sys.exit(1)

def main():
    """Main startup function"""
    print("🚨 112 Goa Emergency Response System - Backend Setup")
    print("=" * 60)
    
    # Pre-flight checks
    check_python_version()
    check_csv_file()
    install_dependencies()
    check_database()
    
    # Start the backend
    start_backend()

if __name__ == "__main__":
    main()
