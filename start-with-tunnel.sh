#!/bin/bash

echo "🚀 Starting Ticket Assigner with Public Tunnel"
echo "=============================================="
echo ""

# Check if backend is running
if lsof -Pi :3001 -sTCP:LISTEN -t >/dev/null ; then
    echo "✅ Backend is already running on port 3001"
else
    echo "⚠️  Backend is not running. Please start it first:"
    echo "   cd backend && npm run dev"
    echo ""
    echo "Then run this script again."
    exit 1
fi

echo ""
echo "📡 Starting ngrok tunnel on port 3001..."
echo "----------------------------------------"
echo ""
echo "IMPORTANT: Once ngrok starts:"
echo "1. Copy the HTTPS URL (like https://abc123.ngrok-free.app)"
echo "2. In Freshservice Admin, set webhook URL to:"
echo "   <YOUR-NGROK-URL>/api/webhooks/freshservice/ticket"
echo "3. Use this webhook secret from your .env:"
echo "   884c8bf4252e27280e757907223b878687acffb5538e4bc2cf29849f316dd1e9"
echo ""
echo "Press Ctrl+C to stop the tunnel"
echo ""

# Start ngrok
./ngrok http 3001 --log=stdout