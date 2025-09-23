#!/bin/bash
set -e

echo "🚀 Deploying Chips application..."

# Pull latest changes
echo "📥 Pulling latest changes..."
git pull

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Run database migrations
echo "🗄️ Running database migrations..."
npm run db:init

# Build application
echo "🔨 Building application..."
npm run build

# Restart service
echo "🔄 Restarting service..."
sudo systemctl restart chips.service

# Check status
echo "✅ Checking service status..."
sudo systemctl status chips.service --no-pager

echo "🎉 Deployment complete!"