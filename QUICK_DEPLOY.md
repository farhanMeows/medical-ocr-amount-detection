# 🚀 QUICK START: Deploy to Railway NOW!

## 3 Simple Steps to Go Live

### **Step 1: Open Railway** (1 minute)
👉 Go to: https://railway.app
- Click "Start for Free"
- Sign in with GitHub
- Authorize access

### **Step 2: Connect Your Repo** (2 minutes)
1. Click **"Create New Project"**
2. Select **"Deploy from GitHub repo"**
3. Search & select: **`medical-ocr-amount-detection`**
4. Authorize Railway access to your repo

### **Step 3: Set Environment Variables** (1 minute)
In Railway dashboard → Variables tab, add:
```
PORT=3000
NODE_ENV=production
MIN_OCR_CONFIDENCE=0.5
MAX_FILE_SIZE_MB=5
MAX_TEXT_LENGTH=10000
LOG_LEVEL=info
```

Click **"Deploy"** and wait 2-5 minutes...

---

## ✅ You're Live!

Once build is complete:
1. Go to your **Domains** section in Railway
2. Copy your URL: `https://your-project.up.railway.app`
3. **DONE!** 🎉

Test it:
- 🌐 Open URL in browser → See your OCR app!
- 🔧 Check health: `/health` endpoint
- 📤 Upload images to process bills

---

## 🔄 Future Updates

Just push to GitHub and Railway auto-deploys:
```bash
git add .
git commit -m "your changes"
git push origin main
```

No manual steps needed! ✨

---

## 📞 Need Help?

- **See logs**: Railway Dashboard → Logs
- **Check status**: Look for green "Running" badge
- **Test locally first**: `npm start` then visit `http://localhost:3000`

---

## 📊 Your App Components

✅ Backend: Node.js + Express (with Tesseract OCR)
✅ Frontend: Clean HTML/CSS/JavaScript 
✅ Database: None needed (stateless)
✅ API: 4-step OCR pipeline

Everything is ready to deploy! 🚀