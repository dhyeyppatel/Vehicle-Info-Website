# VehicleScan Terminal v2.0

A highly stylized, "Cyber Hacker" themed Indian Vehicle Registration lookup application. It uses a custom Node-like/Flask proxy backend to fetch RTO data from a public upstream source and displays it in a beautiful, matrix-rain aesthetic interface.

## Features
- 🏎️ **Instant Lookup:** Fetch vehicle info, owner details, challans, insurance, and PUC data using just the Registration Number.
- 🎨 **Cyber Terminal UI:** Fully responsive CSS with Matrix WebGL background, scanlines, and glowing accents.
- 🔒 **Token-Based Access:** Protects the upstream API through a ShrinkEarn-powered token gateway (grants 5 free searches per token).
- 🛡️ **Protect Your Info:** A dedicated portal for vehicle owners to verify and hide their PII from public searches.
- 🗄️ **MongoDB Powered:** Uses MongoDB to track access tokens and protected vehicles securely.
- 🚀 **Proxy Backend:** Python/Flask backend hides the API key, handles CORS, implements Rate Limiting (30/15min), and securely strips PII for protected vehicles.

## Project Structure
This is a monorepo setup containing both frontend and backend.
- `frontend/` - Contains all static files (`index.html`, `app.js`, `style.css`, etc.)
- `backend/` - Contains the Python Flask application (`app.py`, `requirements.txt`).
- `render.yaml` - Configuration file for one-click deployment on Render.

## Setup Guide

Follow the instructions in [`setup_guide.md`](./setup_guide.md) to run it locally or deploy it to a cloud provider like Render.

## Technologies Used
- **Frontend:** HTML5, CSS3, Vanilla JavaScript, WebGL (Matrix Rain).
- **Backend:** Python, Flask, Flask-Limiter, PyMongo, Gunicorn.
- **Database:** MongoDB.
- **Hosting:** Configured for Render.

## Disclaimer
Data is sourced from publicly available third-party services. This application is for educational purposes only and should not be used as official documentation. See `disclaimer.html` for full details.
