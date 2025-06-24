FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Copy requirements first for better caching
COPY requirements-cloud.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements-cloud.txt

# Copy application code
COPY . .

# Expose port
EXPOSE 8080

# Set environment variables
ENV HOST=0.0.0.0
ENV PORT=8080
ENV FLASK_ENV=production
ENV API_KEY=automail-prod-key-2024

# Run the application
CMD ["python", "cloud_app.py"] 