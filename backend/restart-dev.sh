#!/bin/bash

echo "🔄 Restarting backend server..."

# Kill any existing Node processes on port 3001
lsof -ti:3001 | xargs kill -9 2>/dev/null

# Clear ts-node cache
rm -rf node_modules/.cache/ts-node 2>/dev/null

# Wait a moment
sleep 2

# Start the server
npm run dev