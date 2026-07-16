# Deployment Guide

## Prerequisites

- Node.js >= 18.0.0
- MongoDB (local or cloud)
- CloudBase account (for Tencent Cloud deployment)

## Local Deployment

### 1. Clone and Install

```bash
git clone <repository-url>
cd company-secretary-management-system
npm install
cd client && npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your configuration
```

### 3. Start MongoDB

```bash
# Using MongoDB Atlas
# Update MONGODB_URI in .env

# Using local MongoDB
mongod --dbpath /path/to/data
```

### 4. Build and Run

```bash
# Development
npm run dev

# Production
npm run client:build
npm start
```

## CloudBase (Tencent Cloud) Deployment

### 1. Install CloudBase CLI

```bash
npm install -g @cloudbase/cli
```

### 2. Login

```bash
cloudbase login
```

### 3. Initialize Project

```bash
cloudbase init
# Follow the prompts
```

### 4. Configure Database

- Go to CloudBase Console
- Enable MongoDB
- Update MONGODB_URI in CloudBase environment variables

### 5. Deploy

```bash
# Deploy static hosting
cd client
npm run build
cd ..
cloudbase hosting:deploy dist

# Deploy as cloud function
cloudbase functions:deploy
```

## Docker Deployment

### Build Image

```bash
docker build -t company-secretary-ms:latest .
```

### Run Container

```bash
docker run -d \
  --name company-secretary-ms \
  -p 5000:5000 \
  -e MONGODB_URI=mongodb://mongo:27017/company-secretary \
  -e JWT_SECRET=your-secret-key \
  --link mongo:mongo \
  company-secretary-ms:latest
```

### Docker Compose

```bash
docker-compose up -d
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| PORT | Server port | 5000 |
| MONGODB_URI | MongoDB connection string | mongodb://localhost:27017/company-secretary |
| JWT_SECRET | JWT signing secret | - |
| NODE_ENV | Environment | development |
| CLIENT_URL | Frontend URL | http://localhost:5173 |
| SMTP_HOST | SMTP server | - |
| SMTP_PORT | SMTP port | 587 |
| SMTP_USER | SMTP username | - |
| SMTP_PASS | SMTP password | - |

## Database Setup

### Initial Admin User

After first deployment, register an admin user:

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Admin",
    "email": "admin@example.com",
    "password": "admin123",
    "role": "admin"
  }'
```

## Troubleshooting

### MongoDB Connection Failed

- Check MONGODB_URI in .env
- Ensure MongoDB is running
- Check network/firewall settings

### Build Errors

- Clear node_modules and reinstall: `rm -rf node_modules && npm install`
- Check Node.js version: `node -v` (should be >= 18)
- Clear npm cache: `npm cache clean --force`

### CORS Errors

- Update CLIENT_URL in .env to match your frontend URL
- Ensure backend CORS configuration allows your frontend origin

## Security Checklist

- [ ] Change default JWT_SECRET
- [ ] Enable HTTPS in production
- [ ] Set up rate limiting
- [ ] Configure proper MongoDB authentication
- [ ] Add input validation and sanitization
- [ ] Enable CORS for specific domains only
- [ ] Use environment variables for sensitive data
- [ ] Set up backup strategy for MongoDB
- [ ] Enable logging and monitoring
- [ ] Regular security updates

## Performance Optimization

1. Enable gzip compression
2. Implement database indexing
3. Use CDN for static assets
4. Enable caching
5. Optimize images
6. Use Redis for session management
7. Implement database connection pooling

## Monitoring

- Application logs: `pm2 logs`
- Database metrics: MongoDB Atlas dashboard
- Server metrics: CloudBase monitoring or third-party tools
- Error tracking: Sentry or similar

## Backup Strategy

- MongoDB daily backups
- Automated backup to cloud storage
- Retain backups for 30 days
- Test restore procedure regularly

## Support

For deployment issues, contact:
- Email: support@example.com
- Documentation: https://docs.example.com
- Issues: https://github.com/example/issues
