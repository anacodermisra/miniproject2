# 🚀 MindPulse Deployment Guide

This guide covers the deployment of the three MindPulse components: the **FastAPI Backend**, the **Next.js Frontend**, and the **Python Desktop Client**.

---

## Option 1: Docker Compose (Recommended for Self-Hosting)

The easiest way to deploy MindPulse is using Docker Compose. This orchestrates both the backend and frontend in a unified environment.

### 📋 Prerequisites
- [Docker](https://www.docker.com/get-started)
- [Docker Compose](https://docs.docker.com/compose/install/)

### 🚀 Setup
1. **Clone the repository** (if you haven't already).
2. **Configure Environment Variables**:
   Update `docker-compose.yml` or create a `.env` file in the root:
   ```env
   JWT_SECRET_KEY=your_secure_random_key_here
   MINDPULSE_API_URL=http://your-server-ip:5000/api/v1
   ```
3. **Launch the stack**:
   ```bash
   docker-compose up -d --build
   ```
4. **Access the App**:
   - Web Dashboard: `http://localhost:3000`
   - API Docs: `http://localhost:5000/docs`

---

## Option 2: Cloud Deployment (PaaS)

For high availability, you can separate the frontend and backend.

### 🌐 Frontend (Vercel / Netlify)
1. **Connect your Git repo** to Vercel.
2. **Environment Variables**:
   - `NEXT_PUBLIC_API_URL`: `https://your-backend-api.com/api/v1`
   - `NEXT_PUBLIC_WS_URL`: `wss://your-backend-api.com/api/v1/ws/stress`
3. **Build Command**: `npm run build`

### ⚙️ Backend (Render / Heroku / Railway)
1. **Deploy using the `Dockerfile`** in the `backend/` directory or run manually:
   ```bash
   pip install -r requirements.txt
   uvicorn app.main:app --host 0.0.0.0 --port $PORT
   ```
2. **Environment Variables**:
   - `JWT_SECRET_KEY`: A secure random string.
   - `ALLOWED_ORIGINS`: Your frontend URL (e.g., `https://mindpulse-dashboard.vercel.app`).
3. **Persistence**: Since MindPulse uses SQLite, ensure you use a "Disk" or "Volume" in Render/Railway to persist `backend/ml/artifacts/history.db`.

---

## Option 3: Desktop Client Packaging

The desktop client (`run_client.py`) needs to be distributed to users. To avoid requiring them to install Python, you can package it as a `.exe`.

### 📦 Creating a Windows Executable
1. **Install PyInstaller**:
   ```bash
   pip install pyinstaller
   ```
2. **Build the Executable**:
   ```bash
   pyinstaller --onefile --noconsole --icon=icon.ico run_client.py
   ```
   *Note: Remove `--noconsole` if you want to see debug output during testing.*
3. **Distribution**:
   - The compiled file will be in the `dist/` folder.
   - Users simply run `run_client.exe`.
   - Ensure they have the correct `MINDPULSE_API_URL` set in their environment variables or modify the script to point to your production URL.

---

## 🔒 Security Checklist
- [ ] Change `JWT_SECRET_KEY` from the default.
- [ ] Update `ALLOWED_ORIGINS` in the backend to match your frontend domain.
- [ ] Use `HTTPS` and `WSS` in production.
- [ ] Regularly backup `history.db` located in `backend/ml/artifacts/`.

---

## 🛠️ Performance Tuning
- **CPU Limits**: The backend XGBoost model can be CPU-intensive during inference. Ensure your server has at least 1 vCPU and 2GB RAM.
- **WebSocket Limits**: Ensure your reverse proxy (Nginx/Cloudflare) supports long-lived WebSocket connections.
