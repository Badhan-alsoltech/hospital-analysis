# Deploying to Render

This backend is ready for deployment on **Render.com**.

## 🚀 Steps to Deploy

1. **Create a GitHub Repository**:
   - Go to GitHub and create a new repository (e.g., `hospital-app-backend`).
   - Push ONLY the contents of this `backend` folder to that repository.
   
   **How to do this from your terminal:**
   ```bash
   cd c:/assingment/PatientsAnalizer/backend
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/hospital-app-backend.git
   git push -u origin main
   ```

2. **Setup on Render**:
   - Create an account on [Render.com](https://render.com).
   - Click **New +** -> **Web Service**.
   - Connect your GitHub account and select the `hospital-app-backend` repository.

3. **Configure Service**:
   - **Name**: `hospital-backend` (or similar)
   - **Region**: Closest to you (e.g., Singapore/India if available, or Oregon/Frankfurt)
   - **Branch**: `main`
   - **Root Directory**: (Leave empty if you pushed only the backend folder)
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`

4. **Environment Variables (CRITICAL!)**:
   - Scroll down to "Environment Variables" section.
   - Click **Add Environment Variable**.
   - **Key**: `MONGO_URI`
   - **Value**: `mongodb+srv://badhanalsoltechastw70031_db_user:QOVM9TOLJZYKLyTm@patients-analyzer.cmprm8k.mongodb.net/healthDB`
   - *(Note: You do NOT need to add PORT, Render sets it automatically).*

5. **Deploy**:
   - Click **Create Web Service**.
   - Wait for the build to finish.
   - Once live, copy the URL (e.g., `https://hospital-backend.onrender.com`).

## 📱 Final Step
- Update your React Native app's `apiService.js` with this new URL.
