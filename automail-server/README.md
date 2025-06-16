# Automail AI Server

🤖 **AI-powered email classification server for the Automail Chrome extension**

## Overview

The Automail AI Server provides intelligent email classification using DistilBERT, enabling the Chrome extension to automatically categorize emails into Work, Personal, Spam, Important, and Review categories.

## Features

- 🧠 **AI Classification**: DistilBERT-based email categorization
- 🔒 **Secure API**: API key authentication and rate limiting
- ⚡ **Fast Processing**: Optimized for real-time email classification
- 📦 **Batch Processing**: Classify multiple emails in a single request
- 🛡️ **Fallback System**: Rule-based classification when AI is unavailable
- 📊 **Structured Logging**: Comprehensive request and performance monitoring

## Quick Start

### 1. Install Dependencies

```bash
cd automail-server
pip install -r requirements.txt
```

### 2. Start the Server

```bash
python app.py
```

The server will start on `http://localhost:5000` by default.

### 3. Test the API

```bash
# Health check
curl http://localhost:5000/health

# Classify an email
curl -X POST http://localhost:5000/classify \
  -H "Content-Type: application/json" \
  -H "X-API-Key: automail-dev-key-2024" \
  -d '{"content": "Team meeting tomorrow at 2pm", "subject": "Meeting Reminder"}'
```

## API Endpoints

### Health Check
```
GET /health
```
Returns server status and model information.

### Classify Email
```
POST /classify
Content-Type: application/json
X-API-Key: your-api-key

{
  "content": "email body content",
  "subject": "email subject (optional)"
}
```

**Response:**
```json
{
  "label": "Work",
  "confidence": 0.85,
  "reasoning": "AI classification based on content analysis",
  "processing_time": 0.123,
  "timestamp": 1640995200.0
}
```

### Batch Classify
```
POST /batch-classify
Content-Type: application/json
X-API-Key: your-api-key

{
  "emails": [
    {"content": "email 1 content", "subject": "email 1 subject"},
    {"content": "email 2 content", "subject": "email 2 subject"}
  ]
}
```

**Response:**
```json
{
  "results": [
    {"label": "Work", "confidence": 0.85, ...},
    {"label": "Personal", "confidence": 0.72, ...}
  ],
  "processing_time": 1.234,
  "total_emails": 2
}
```

## Configuration

### Environment Variables

Create a `.env` file in the server directory:

```env
# Server settings
HOST=127.0.0.1
PORT=5000
FLASK_ENV=development
FLASK_DEBUG=true

# Security
API_KEY=your-secure-api-key-here
RATE_LIMIT_PER_MINUTE=100

# AI Model
MODEL_NAME=distilbert-base-uncased
MODEL_CACHE_DIR=./models
MAX_CONTENT_LENGTH=16384

# CORS
CORS_ORIGINS=chrome-extension://*,http://localhost:*
```

### Default Configuration

- **Host**: `127.0.0.1`
- **Port**: `5000`
- **API Key**: `automail-dev-key-2024` (development only)
- **Rate Limit**: 100 requests per minute
- **Model**: DistilBERT sentiment analysis (fine-tuned for email classification)

## Security

### API Key Authentication
All endpoints (except `/health`) require an `X-API-Key` header:

```bash
curl -H "X-API-Key: automail-dev-key-2024" ...
```

### Rate Limiting
- Default: 100 requests per minute per API key/IP
- Returns HTTP 429 when exceeded
- Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

### Input Validation
- JSON schema validation
- Content length limits (16KB default)
- Input sanitization for security

## Classification Labels

The AI classifies emails into these categories:

- **Work**: Business emails, meetings, projects
- **Personal**: Family, friends, personal communications
- **Spam**: Promotional content, suspicious emails
- **Important**: Security alerts, urgent notifications
- **Review**: Uncertain classifications requiring manual review

## Testing

Run the comprehensive test suite:

```bash
cd automail-server
python tests/test_classifier.py
```

Test coverage includes:
- API endpoint functionality
- Authentication and authorization
- Rate limiting
- Error handling
- Classification accuracy

## Performance

### Benchmarks (on typical hardware)
- **Single classification**: ~100-200ms
- **Batch (10 emails)**: ~500-800ms
- **Memory usage**: ~1-2GB (model in memory)
- **Throughput**: ~300-500 emails/minute

### Optimization Tips
- Keep server running for model caching
- Use batch endpoints for multiple emails
- Monitor memory usage in production
- Consider GPU acceleration for high loads

## Deployment

### Local Development
```bash
python app.py
```

### Production (Gunicorn)
```bash
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

### Docker (Future)
A Dockerfile will be provided for containerized deployment.

### Environment-Specific Settings

**Development:**
- Debug mode enabled
- Detailed logging
- CORS allows all origins

**Production:**
- Debug mode disabled
- Structured logging to files
- Restricted CORS origins
- Environment-based API keys

## Integration with Chrome Extension

The Chrome extension communicates with this server through the following flow:

1. **Authentication**: Extension sends API key in headers
2. **Email Processing**: Extension sends email content to `/classify`
3. **Label Application**: Extension uses returned labels in Gmail
4. **Batch Processing**: Multiple emails processed via `/batch-classify`

### Configuration in Extension

Update the background script with server settings:

```javascript
const AI_API_CONFIG = {
    baseUrl: 'http://localhost:5000',  // Development
    apiKey: 'automail-dev-key-2024',
    timeout: 10000,
    retryAttempts: 3
};
```

## Troubleshooting

### Common Issues

**Server won't start:**
- Check Python dependencies: `pip install -r requirements.txt`
- Verify port availability: `netstat -an | grep 5000`
- Check Python version: Requires Python 3.7+

**Model loading errors:**
- Ensure internet connection for model download
- Check disk space for model cache (~500MB)
- Verify transformers library installation

**Classification errors:**
- Check API key configuration
- Verify JSON payload format
- Monitor server logs for details

**Poor accuracy:**
- The model uses sentiment analysis as a base
- Consider fine-tuning with email-specific data
- Rule-based fallback provides basic classification

### Logging

Server logs include:
- Request/response timing
- Classification results
- Security events
- Model status
- Error details

Log files: `automail-server.log`

## Future Enhancements

- 🎯 **Fine-tuned Models**: Email-specific training data
- 🚀 **Performance**: GPU acceleration, model optimization
- 📝 **Compose Feature**: AI-powered email drafting
- 🧠 **Learning**: User feedback incorporation
- 🔄 **Scaling**: Horizontal scaling, load balancing
- 📦 **Deployment**: Docker containers, cloud platforms

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Submit a pull request

## License

This project is part of the Automail Chrome extension suite.

---

**Need help?** Check the logs, review the test suite, or examine the source code for detailed implementation. 