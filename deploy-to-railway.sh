#!/bin/bash

# Railway Deployment Script
# This script helps deploy the Medical OCR project to Railway

echo "🚀 Medical OCR Deployment Script for Railway"
echo "============================================"

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found. Install it first:"
    echo "npm install -g @railway/cli"
    echo "Then run: railway login"
    exit 1
fi

# Check if logged in
if ! railway whoami &> /dev/null; then
    echo "❌ Not logged in to Railway. Run: railway login"
    exit 1
fi

echo "✅ Railway CLI ready"

# Initialize Railway project
echo "📦 Initializing Railway project..."
railway init

# Set environment variables
echo "🔧 Setting environment variables..."
railway variables set NODE_ENV=production
railway variables set PORT=3000
railway variables set MIN_OCR_CONFIDENCE=0.5
railway variables set MAX_FILE_SIZE_MB=5
railway variables set MAX_TEXT_LENGTH=10000
railway variables set LOG_LEVEL=info

echo "🚀 Deploying to Railway..."
railway up

echo "✅ Deployment complete!"
echo ""
echo "🌐 Your app will be available at the URL shown above"
echo "📊 Check logs with: railway logs"
echo "🔄 Future deployments: just push to your git repo"

echo ""
echo "🧪 Test your deployment:"
echo "  Health: curl https://your-app.railway.app/health"
echo "  Frontend: Open https://your-app.railway.app in browser"</content>
<parameter name="filePath">/Users/master/Developer/medical-ocr-amount-detection/deploy-to-railway.sh