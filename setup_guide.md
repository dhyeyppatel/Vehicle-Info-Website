# VehicleScan Terminal: Setup & Deployment Guide

This guide will walk you through setting up the VehicleScan Terminal v2.0 locally for development and deploying it to Render for production.

---

## 1. Local Development Setup

### Prerequisites
- Python 3.10+ installed
- MongoDB URI (e.g. MongoDB Atlas)

### Steps

1. **Clone the Repository**
   ```bash
   git clone https://github.com/dhyeyppatel/Vehicle-Info-Website.git
   cd "Vehicle-Info-Website"
   ```

2. **Configure Environment Variables**
   Inside the `backend/` folder, create a `.env` file based on `.env.example`:
   ```bash
   cd backend
   copy .env.example .env
   ```
   Open `backend/.env` and ensure the following are set:
   - `MONGO_URI`: Your MongoDB connection string.
   - `SHRINKEARN_API_KEY`: Your ShrinkEarn API key.
   - `VEHICLE_API_BASE`: The upstream API URL.

3. **Install Dependencies**
   It's recommended to use a virtual environment, but you can install directly:
   ```bash
   pip install -r requirements.txt
   ```

4. **Run the Server**
   To start the Flask development server (which also serves the frontend):
   ```bash
   # Windows (PowerShell)
   $env:FLASK_ENV="development"
   $env:PORT="5001"
   python app.py

   # Linux/Mac
   FLASK_ENV=development PORT=5001 python app.py
   ```

5. **Test in Browser**
   Open `http://localhost:5001` in your web browser. 
   *(Note: ShrinkEarn may block local testing by returning an invalid response for `localhost`. The backend will automatically detect this and grant you the token directly so you can test the UI).*

---

## 2. Deploying to Render (Production)

The repository is already configured with a `render.yaml` file, making deployment completely automatic.

### Steps

1. **Push to GitHub**
   Ensure all your code is pushed to the `main` or `master` branch of your GitHub repository.

2. **Connect to Render**
   - Log into [Render.com](https://render.com).
   - Click **New +** and select **Blueprint**.
   - Connect your GitHub repository (`dhyeyppatel/Vehicle-Info-Website`).
   - Render will automatically read the `render.yaml` file and set up a **Web Service** using Python and Gunicorn.

3. **Set Environment Variables on Render**
   - Go to your newly created Web Service on the Render Dashboard.
   - Navigate to the **Environment** tab.
   - Add the following variables:
     - `MONGO_URI`: `mongodb+srv://dhyeyfileshare:Dhyey2974@fileshare.rb8ld09.mongodb.net/?retryWrites=true&w=majority&appName=fileshare`
     - `SHRINKEARN_API_KEY`: Your token string.
     - `FLASK_ENV`: `production`

4. **Done!**
   Render will automatically run `pip install -r backend/requirements.txt` and start the server using Gunicorn. Once the deployment says "Live", click the Render URL (e.g., `https://vehicle-scan-terminal.onrender.com`) to use the live site!
