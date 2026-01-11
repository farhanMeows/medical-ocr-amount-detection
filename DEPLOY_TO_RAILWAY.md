# 🚀 Deploy to Railway - Step by Step

## ✅ Your Project is Ready!
- ✅ GitHub repository pushed
- ✅ All dependencies configured
- ✅ Frontend and backend in same project
- ✅ Environment variables set

---

## 📋 DEPLOYMENT STEPS (5 minutes)

### **Step 1: Create Railway Account**
1. Go to https://railway.app
2. Click **"Start for Free"**
3. Sign up with GitHub (easiest option)
4. Authorize Railway to access your GitHub

### **Step 2: Create New Project**
1. Click **"+ Create"** or **"Create New Project"**
2. Select **"Deploy from GitHub repo"**
3. Search for: `medical-ocr-amount-detection`
4. Click to connect it

### **Step 3: Configure Environment Variables**
Railway will auto-detect Node.js. Now add your variables:

In the Railway dashboard:
1. Click **"Variables"** tab
2. Add these variables:

```
PORT=3000
NODE_ENV=production
MIN_OCR_CONFIDENCE=0.5
MAX_FILE_SIZE_MB=5
MAX_TEXT_LENGTH=10000
LOG_LEVEL=info
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=30
```

### **Step 4: Deploy**
1. Click **"Deploy"** button
2. Wait for build to complete (2-5 minutes)
3. Once green "Running" status appears, you're done! ✅

### **Step 5: Get Your Live URL**
1. In Railway dashboard, look for **"Domains"** section
2. Copy the URL that looks like: `https://your-project.up.railway.app`
3. Your app is live!

---

## 🧪 Test Your Deployment

### **1. Health Check**
Open in browser:
```
https://your-project.up.railway.app/health
```
Should return: `{"status":"ok","service":"plum-ocr-backend"}`

### **2. Frontend**
Open in browser:
```
https://your-project.up.railway.app/
```
You should see the clean white UI!

### **3. Test API**
Use curl or Postman:
```bash
# Test with text
curl -X POST https://your-project.up.railway.app/api/extract/step1 \
  -H "Content-Type: application/json" \
  -d '{"text":"Total: $250.00, Paid: $100.00, Due: $150.00"}'
```

---

## 🔄 Auto-Deploy on GitHub Push

**Great news!** After this initial setup:
- Every time you push to GitHub, Railway automatically redeploys
- No manual steps needed
- You can work locally and push changes anytime

```bash
# Just push your code normally
git add .
git commit -m "your message"
git push origin main
# Railway will redeploy automatically!
```

---

## 📊 Monitor Your Deployment

In Railway Dashboard:
- **Logs**: Click "Logs" to see real-time server logs
- **Metrics**: CPU, Memory, Network usage
- **Deployments**: View deployment history

---

## 🆘 Troubleshooting

### **Build fails?**
1. Check logs in Railway dashboard
2. Make sure `npm start` works locally:
   ```bash
   npm start
   # Should say "Server running on http://localhost:3000"
   ```

### **Tesseract not working?**
Railway has built-in support for Tesseract.js ✅
- If issues, Railway auto-installs dependencies

### **Port errors?**
Railway sets `PORT` automatically. Your app reads it:
```javascript
const PORT = config.port; // Uses $PORT env var
```
This is already configured correctly! ✅

---

## 📱 Share Your App

Your live URL:
```
https://your-project.up.railway.app
```

Share this URL with anyone to let them use your OCR tool! 🎉

---

## 💡 Pro Tips

1. **Check logs frequently**: 
   - Railway Dashboard → Logs
   - Shows any errors in production

2. **Environment Variables**:
   - Don't commit `.env` file
   - Set all secrets in Railway dashboard

3. **Scale if needed**:
   - Railway auto-scales based on traffic
   - You can increase resources in settings

4. **Custom Domain** (optional):
   - Railway supports custom domains
   - Add your own domain like `ocr.mycompany.com`

---

## 🎯 You're Done!

Your medical OCR application with:
- ✅ Backend (Node.js + Express)
- ✅ Frontend (HTML/CSS/JS)
- ✅ OCR Pipeline (Tesseract.js)
- ✅ Live on the internet

...is now **LIVE on Railway!** 🚀🎉

Have fun! 🎊