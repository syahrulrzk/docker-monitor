#!/usr/bin/env python3
"""
Simple HTTP server to serve the built frontend application.
This runs alongside the main FastAPI backend.
"""

import http.server
import socketserver
import os
import threading
import time
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

FRONTEND_PORT = 3000
FRONTEND_DIR = os.path.join(os.path.dirname(__file__), 'frontend', 'dist')

class QuietHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    """Custom request handler that suppresses log messages"""

    def log_message(self, format, *args):
        # Suppress default logging to reduce noise
        pass

    def end_headers(self):
        # Add CORS headers for development
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

def serve_frontend():
    """Serve the frontend on port 3000"""
    try:
        # Change to frontend dist directory
        if os.path.exists(FRONTEND_DIR):
            os.chdir(FRONTEND_DIR)
            logger.info(f"Serving frontend from: {FRONTEND_DIR}")
        else:
            logger.error(f"Frontend build directory not found: {FRONTEND_DIR}")
            logger.error("Please run 'npm run build' in the frontend directory first")
            return

        # Create server
        with socketserver.TCPServer(("", FRONTEND_PORT), QuietHTTPRequestHandler) as httpd:
            logger.info(f"Frontend server started on port {FRONTEND_PORT}")
            logger.info(f"Access at: http://localhost:{FRONTEND_PORT}")

            # Serve forever
            httpd.serve_forever()

    except Exception as e:
        logger.error(f"Error starting frontend server: {e}")

if __name__ == "__main__":
    serve_frontend()
