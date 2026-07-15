import os

# Automatically bind to the PORT environment variable provided by Render.
# If not provided, fallback to 2929.
port = os.environ.get("PORT", "2929")
bind = f"0.0.0.0:{port}"

# Recommended Render settings
workers = 2
timeout = 30
