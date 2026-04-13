# Personal Finance Manager

## 🚀 Project Overview

Personal Finance Manager is a full-stack finance tracking platform built with:
- Backend: Django + Django REST Framework
- Frontend: React + Vite
- Auth: JWT + tight permission control
- Persistence: PostgreSQL
- Asynchronous work: Celery (Redis broker)
- Containerization: Docker + docker-compose

This repo includes all layers (API, UI, business logic, async tasks, integration endpoints) and is aimed at production-capable behavior, developer onboarding, and easy extension.

## 🌟 Core Features

- User account management (registration, login, profile, roles)
- Role-based access control (Admin, Account Manager, Normal User)
- Budget planning + goal tracking
- Multi-account management (bank accounts, wallets, etc.)

## 👥 Role Permissions

### Administrator
- Full user management across all roles
- Create/update/delete users and assign roles
- System settings read/write access
- View all reports and audit logs

### Account Manager
- Manage assigned normal users only
- List/query users assigned via manager relationships
- View/manage normal user financial data only through assignment scope
- Cannot create users in management endpoint (admin-only)

### Normal User
- Manage own accounts, transactions, budgets, goals
- No access to management user CRUD endpoints
- Only authenticated and active users can access personal data

- Transaction CRUD with filtering and advanced search
- Recurring transactions and scheduled payments
- Expense/income dashboards, reports, export to CSV
- Notifications/feed (alerts for budgets, bills, goals)
- Payment requests / bill scanning pipeline (rule-based) 
- Exchange rates / investments tracking
- Audit logs and activity history
- Admin/manager dashboards and role-based access

## 🏗️ Repository Structure

- `backend/`: Django project (core, users, transactions, services, APIs, Celery)
- `frontend/`: React Vite application with modular UX components
- `nginx/`: reverse proxy config for production compose
- `docker-compose.yml`: local multi-service orchestrator
- `PROJECT_GUIDE.md`: quick start in original format

## 🧩 Tech Stack

- Python 3.11+ (Django 5.x compatible likely)
- Django, Django REST Framework, django-filters, djangorestframework-simplejwt
- Celery + Redis (task queue)
- PostgreSQL
- React 18+ + Vite + Axios
- Tailwind/Bootstrap style components in UI
- Webpack / Vite dev servers

## ⚙️ Prerequisites

- Python 3.11
- Node.js 18+ and npm/yarn
- PostgreSQL 14+
- Redis (for Celery locally)
- Docker + docker-compose (optional but recommended)

## 🔧 Environment Configuration

### Backend

1. Copy:

```bash
cd backend
cp .env.example .env
```

2. Set values:

- `SECRET_KEY`
- `DEBUG=1` or `0`
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- `FRONTEND_URL` (e.g., `http://localhost:5173`)
- `PAGE_SIZE` (default pagination size)

### Frontend

1. Copy if used:

```bash
cd frontend
cp .env.example .env
```

2. Set values:

- `VITE_API_BASE=http://localhost:8000/api`
- `VITE_AUTH_BASE=...` (if present)

## ▶️ Local Development (Backend)

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py create_demo_data   # optional but recommended
python manage.py runserver
```

- API base: `http://localhost:8000/api`
- Admin: `http://localhost:8000/admin`

## ▶️ Local Development (Frontend)

```bash
cd frontend
npm install
npm run dev
```

- App base: `http://localhost:5173`
- Login with demo user `alice/password123` (from create_demo_data)

## 🐳 Dockerized Development

```bash
docker compose up --build
```

Service matrix:
- `web` (Django + Gunicorn)
- `worker` (Celery worker)
- `redis`
- `postgres`
- `frontend` (React production build served by Nginx)

## 🧪 Testing

### Backend tests

```bash
cd backend
python manage.py test
```

### Frontend checks

```bash
cd frontend
npm run lint
npm run build
```

### Postman API Testing

Import the demo collection for comprehensive API testing:

1. Open Postman
2. Click "Import" 
3. Select `backend/Postman/pfm_demo_postman_collection.json`
4. Set collection variables:
   - `base_url`: `http://localhost:8000/api`
5. Run requests in order:
   - Start with Authentication folder to login and set tokens
   - Create users as admin
   - Test role-based permissions
   - Create finance data as user

The collection includes demo data for admin/manager/user workflows with automatic token management.

## 🛠️ API Highlights

### Auth
- `POST /api/auth/register/`
- `POST /api/auth/login/`
- `POST /api/auth/token/refresh/`
- `POST /api/auth/logout/` (if implemented)

### Transactions
- `GET /api/transactions/`
- `POST /api/transactions/`
- `GET /api/transactions/{id}/`, `PUT`, `PATCH`, `DELETE`
- Filters: `date_from`, `date_to`, `type`, `category`, `min_amount`, `max_amount`, `ordering`

### Categories/Budgets/Goals/Accounts
- REST endpoints under `/api/categories/`, `/api/budgets/`, `/api/goals/`, `/api/accounts/`

### Reporting
- `GET /api/summary/`
- `GET /api/reports/monthly/`
- `GET /api/export/csv/` (download)

### Extended
- `POST /api/payments/`, `/api/billscan/`, `/api/notifications/`, etc.

> All endpoints require Bearer JWT authentication except registration/login.

## � Deployment Guide

### Prerequisites for Production
- Domain name (e.g., from Namecheap, Cloudflare)
- SSL certificate (Let's Encrypt free option)
- Server with 2GB+ RAM (DigitalOcean, AWS, Linode, etc.)
- PostgreSQL database
- Redis instance

### Option 1: Railway (Easiest - Recommended)

**Backend Deployment:**
```bash
# 1. Install Railway CLI
npm install -g @railway/cli

# 2. Login
railway login

# 3. Initialize project
cd backend
railway init

# 4. Add PostgreSQL database
railway add --database

# 5. Add Redis (optional, for Celery)
railway add --database redis

# 6. Set environment variables
railway variables set SECRET_KEY="your-secure-key-here"
railway variables set DEBUG=False
railway variables set ALLOWED_HOSTS="your-domain.com,*.railway.app"
railway variables set CORS_ALLOWED_ORIGINS="https://your-frontend-domain.com"

# 7. Deploy
railway up

# 8. Run migrations
railway run python manage.py migrate

# 9. Create superuser (optional)
railway run python manage.py createsuperuser
```

**Frontend Deployment:**
```bash
cd frontend

# 1. Update API URL in .env.production
VITE_API_URL=https://your-backend-url.railway.app

# 2. Build
npm run build

# 3. Deploy to Vercel/Netlify
# - Connect GitHub repo to Vercel
# - Or drag 'dist' folder to Netlify
```

### Option 2: VPS Deployment (DigitalOcean/AWS/Linode)

**Step 1: Server Setup**
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install dependencies
sudo apt install python3-pip python3-venv nginx postgresql redis-server git -y

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
```

**Step 2: Database Setup**
```bash
# Create PostgreSQL database
sudo -u postgres psql

CREATE DATABASE financemanager;
CREATE USER financeuser WITH PASSWORD 'securepassword';
GRANT ALL PRIVILEGES ON DATABASE financemanager TO financeuser;
\q
```

**Step 3: Application Setup**
```bash
# Create app directory
sudo mkdir -p /var/www/finance-manager
cd /var/www/finance-manager
sudo chown -R $USER:$USER .

# Clone repository
git clone https://github.com/yourusername/personal-finance-manager.git .

# Backend setup
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Create production settings
cp .env.example .env
# Edit .env with production values
```

**Step 4: Systemd Services**
```bash
# Create Gunicorn service
sudo tee /etc/systemd/system/finance-backend.service << 'EOF'
[Unit]
Description=Finance Manager Backend
After=network.target postgresql.service redis.service

[Service]
User=www-data
Group=www-data
WorkingDirectory=/var/www/finance-manager/backend
Environment="PATH=/var/www/finance-manager/backend/venv/bin"
Environment="SECRET_KEY=your-secret-key"
Environment="DEBUG=False"
Environment="DATABASE_URL=postgres://financeuser:password@localhost/financemanager"
ExecStart=/var/www/finance-manager/backend/venv/bin/gunicorn finance_manager.wsgi:application --workers 3 --bind 0.0.0.0:8000
Restart=always

[Install]
WantedBy=multi-user.target
EOF

# Create Celery Worker service (optional)
sudo tee /etc/systemd/system/finance-celery.service << 'EOF'
[Unit]
Description=Finance Manager Celery Worker
After=network.target redis.service

[Service]
User=www-data
Group=www-data
WorkingDirectory=/var/www/finance-manager/backend
Environment="PATH=/var/www/finance-manager/backend/venv/bin"
Environment="SECRET_KEY=your-secret-key"
Environment="DEBUG=False"
ExecStart=/var/www/finance-manager/backend/venv/bin/celery -A finance_manager worker -l info
Restart=always

[Install]
WantedBy=multi-user.target
EOF

# Enable and start services
sudo systemctl daemon-reload
sudo systemctl enable finance-backend
sudo systemctl start finance-backend
sudo systemctl enable finance-celery
sudo systemctl start finance-celery
```

**Step 5: Nginx Configuration**
```bash
# Create Nginx config
sudo tee /etc/nginx/sites-available/finance-manager << 'EOF'
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    
    # Frontend (static files)
    location / {
        root /var/www/finance-manager/frontend/dist;
        try_files $uri $uri/ /index.html;
        index index.html;
    }
    
    # Backend API
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeout settings
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # Admin panel
    location /admin/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    # Static files (Django admin)
    location /static/ {
        alias /var/www/finance-manager/backend/staticfiles/;
    }
    
    # Media files
    location /media/ {
        alias /var/www/finance-manager/backend/media/;
    }
}
EOF

# Enable site
sudo ln -s /etc/nginx/sites-available/finance-manager /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

**Step 6: SSL Certificate (Let's Encrypt)**
```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Get SSL certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Auto-renewal test
sudo certbot renew --dry-run
```

**Step 7: Frontend Build**
```bash
cd /var/www/finance-manager/frontend

# Install dependencies
npm install

# Create production .env
echo "VITE_API_URL=https://your-domain.com/api" > .env.production

# Build
npm run build
```

### Option 3: Heroku

```bash
# 1. Install Heroku CLI and login
heroku login

# 2. Create app
heroku create your-finance-app

# 3. Add PostgreSQL
heroku addons:create heroku-postgresql:mini

# 4. Set environment variables
heroku config:set SECRET_KEY="your-secret-key"
heroku config:set DEBUG=False
heroku config:set ALLOWED_HOSTS="your-finance-app.herokuapp.com"
heroku config:set CORS_ALLOWED_ORIGINS="https://your-frontend.vercel.app"

# 5. Deploy backend
cd backend
git init
git add .
git commit -m "Initial commit"
git push heroku main

# 6. Run migrations
heroku run python manage.py migrate

# 7. Deploy frontend to Vercel/Netlify
cd ../frontend
vercel --prod
# OR
netlify deploy --prod --dir=dist
```

### Option 4: Docker Compose (Self-Hosted)

**docker-compose.prod.yml:**
```yaml
version: '3.8'

services:
  db:
    image: postgres:15-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      POSTGRES_DB: financemanager
      POSTGRES_USER: financeuser
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    restart: always

  redis:
    image: redis:7-alpine
    restart: always

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.prod
    command: gunicorn finance_manager.wsgi:application --bind 0.0.0.0:8000 --workers 4
    volumes:
      - ./backend/staticfiles:/app/staticfiles
      - ./backend/media:/app/media
    environment:
      - DEBUG=False
      - SECRET_KEY=${SECRET_KEY}
      - DATABASE_URL=postgres://financeuser:${DB_PASSWORD}@db:5432/financemanager
      - REDIS_URL=redis://redis:6379/0
    depends_on:
      - db
      - redis
    restart: always

  celery:
    build:
      context: ./backend
      dockerfile: Dockerfile.prod
    command: celery -A finance_manager worker -l info
    environment:
      - DEBUG=False
      - SECRET_KEY=${SECRET_KEY}
      - DATABASE_URL=postgres://financeuser:${DB_PASSWORD}@db:5432/financemanager
      - REDIS_URL=redis://redis:6379/0
    depends_on:
      - db
      - redis
    restart: always

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.prod
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/conf.d/default.conf:ro
      - ./backend/staticfiles:/var/www/static:ro
      - ./backend/media:/var/www/media:ro
      - certbot_data:/etc/letsencrypt
    depends_on:
      - backend
    restart: always

volumes:
  postgres_data:
  certbot_data:
```

**Deploy with Docker Compose:**
```bash
# Create .env file
cat > .env << EOF
SECRET_KEY=your-super-secret-key
DB_PASSWORD=your-secure-db-password
EOF

# Build and start
docker-compose -f docker-compose.prod.yml up --build -d

# Run migrations
docker-compose -f docker-compose.prod.yml exec backend python manage.py migrate

# Collect static files
docker-compose -f docker-compose.prod.yml exec backend python manage.py collectstatic --noinput

# Create superuser
docker-compose -f docker-compose.prod.yml exec backend python manage.py createsuperuser
```

### Post-Deployment Checklist

- [ ] SSL certificate installed and auto-renewal configured
- [ ] Database migrations applied
- [ ] Static files collected
- [ ] Environment variables set (DEBUG=False, SECRET_KEY)
- [ ] CORS origins configured for production
- [ ] Admin user created
- [ ] Demo data loaded (optional)
- [ ] Email backend configured (for password reset)
- [ ] Logging configured
- [ ] Monitoring enabled (e.g., Sentry)
- [ ] Backup strategy in place
- [ ] Firewall configured (only 80, 443, 22 open)
- [ ] Regular security updates scheduled

### Performance Optimization

**Backend:**
- Database connection pooling (PgBouncer)
- Redis caching for dashboard data
- Gunicorn workers = 2 × CPU cores + 1
- Static files served by Nginx (not Django)
- Database indexes on frequently queried fields

**Frontend:**
- Code splitting with Vite
- Lazy loading for routes
- Image optimization
- Gzip compression enabled
- CDN for static assets (Cloudflare)

### Troubleshooting Production Issues

**502 Bad Gateway:**
```bash
# Check if backend is running
sudo systemctl status finance-backend

# Check Gunicorn logs
sudo journalctl -u finance-backend -f

# Check Nginx error logs
sudo tail -f /var/log/nginx/error.log
```

**Database Connection Issues:**
```bash
# Test database connection
sudo -u postgres psql -c "SELECT 1;"

# Check max connections
sudo -u postgres psql -c "SHOW max_connections;"
```

**CORS Errors:**
- Verify `CORS_ALLOWED_ORIGINS` includes your frontend domain
- Check protocol matches (http vs https)

### Security Best Practices

1. **Environment Variables**: Never commit `.env` files
2. **Secret Key**: Use 50+ random characters
3. **Database**: Use strong passwords, restrict access
4. **Firewall**: Only open necessary ports
5. **Updates**: Regularly update dependencies
6. **Backups**: Automated daily database backups
7. **HTTPS**: Force SSL redirect
8. **Rate Limiting**: Implement API throttling

---

## �📌 Developer + HR Orientation Notes

- Clean model separation (`users`, `transactions`, `core`), plus REST serializers, viewsets, and filtered querying.
- Completed workflow: data ingestion -> business rules (budgets/goals) -> UI visualization + alerts.
- Scalable architecture: task queue (Celery), external integration stubs (exchange rates, payment rails, OCR pipeline).
- CI-ready: most likely covered by existing test suite + Docker compose reproducibility.

## 👨‍💻 Contribution

- Follow PEP8, Black formatting for Python, ESLint for React.
- Branch naming: `feature/<scope>`, `fix/<scope>`.
- Pull request should include:
  - Summary
  - Testing steps
  - Screenshots for UI changes

## 📎 Troubleshooting / Tips

- Backend `psycopg2.OperationalError`: verify DB container/instance and credentials.
- `django.core.exceptions.AppRegistryNotReady`: ensure migrations run before server start.
- React CORS errors: ensure backend `CORS_ALLOWED_ORIGINS` includes frontend URL.

## 📚 More documentation

- `PROJECT_GUIDE.md`: direct run/deploy steps
- `backend/core/utils.py`, `transactions/services.py`: business logic implementations
- `frontend/src/components`: UI component structure

---

✅ README updated to reflect the upgraded project as requested. It is now comprehensive, HR-ready, and engineering-friendly.
