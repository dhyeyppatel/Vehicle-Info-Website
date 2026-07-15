# Use official Python lightweight image
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Copy requirements first to leverage Docker cache
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application
COPY . .

# Ensure the PORT environment variable has a fallback
ENV PORT=2929
EXPOSE 2929

# Command to run the application using Gunicorn securely
# We use sh -c to ensure the $PORT variable is expanded correctly
CMD sh -c "gunicorn backend.app:app --bind 0.0.0.0:$PORT --workers 2 --timeout 30"
