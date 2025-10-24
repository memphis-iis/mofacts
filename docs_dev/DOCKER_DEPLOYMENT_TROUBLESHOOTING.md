# Docker Deployment Troubleshooting Guide

This document covers common issues encountered during Docker-based deployment of MoFaCTS and their solutions, based on real deployment experiences.

## Table of Contents
- [SSH Access Recovery](#ssh-access-recovery)
- [Docker Build Issues](#docker-build-issues)
- [Deployment Issues](#deployment-issues)
- [Runtime Errors](#runtime-errors)
- [Apache/Reverse Proxy Issues](#apachereverse-proxy-issues)

---

## SSH Access Recovery

### Lost SSH Key to AWS Instance

**Problem:** Cannot access AWS EC2 instance because SSH key was lost.

**Solution:**

1. **Generate a new SSH key pair locally:**
   ```bash
   ssh-keygen -t rsa -b 4096 -f ~/.ssh/aws_recovery_key -N ""
   ```

2. **Create a user data script** to add the new key to the instance. This script will run on next boot:
   ```bash
   #!/bin/bash
   TARGET_USER="ubuntu"  # or ec2-user for Amazon Linux

   PUBLIC_KEY="your-ssh-public-key-here"

   mkdir -p /home/$TARGET_USER/.ssh
   chmod 700 /home/$TARGET_USER/.ssh
   echo "$PUBLIC_KEY" >> /home/$TARGET_USER/.ssh/authorized_keys
   chmod 600 /home/$TARGET_USER/.ssh/authorized_keys
   chown -R $TARGET_USER:$TARGET_USER /home/$TARGET_USER/.ssh
   ```

3. **Apply via AWS Console:**
   - Stop the instance
   - Actions → Instance settings → Edit user data
   - Paste the script using multipart MIME format (to force run on every boot):

   ```
   Content-Type: multipart/mixed; boundary="//"
   MIME-Version: 1.0

   --//
   Content-Type: text/cloud-config; charset="us-ascii"
   MIME-Version: 1.0

   #cloud-config
   cloud_final_modules:
   - [scripts-user, always]

   --//
   Content-Type: text/x-shellscript; charset="us-ascii"
   MIME-Version: 1.0

   #!/bin/bash
   [paste script here]

   --//--
   ```

4. **Start instance and connect:**
   ```bash
   ssh -i ~/.ssh/aws_recovery_key ubuntu@your-server-ip
   ```

5. **Clean up:** After successful connection, stop instance, clear user data, restart.

---

## Docker Build Issues

### Issue: "No route definitions found" after deployment

**Symptoms:**
- Browser shows "No route definitions found" error
- Iron Router not loading routes
- Application appears to load but no routing works

**Root Causes:**
1. Docker image built from wrong branch or old cached code
2. `build:` sections missing from docker-compose.yml during build
3. Browser caching old JavaScript bundles

**Solutions:**

1. **Verify you're on the correct branch:**
   ```bash
   git branch --show-current
   git log --oneline -1
   ```

2. **Ensure docker-compose.yml has build sections** for local builds:
   ```yaml
   services:
     mofacts:
       image: yourdockerhub/mofacts-mini:yourtag
       build:                    # THIS MUST BE PRESENT FOR BUILDING
         context: ../../
         dockerfile: Dockerfile
   ```

3. **Build with --no-cache flag:**
   ```bash
   cd mofacts/.deploy
   docker compose build --no-cache
   docker compose push
   ```

4. **On server, pull and restart:**
   ```bash
   cd /var/www/mofacts
   sudo docker compose pull
   sudo docker compose down
   sudo docker compose up -d
   ```

5. **Verify the new image is running:**
   ```bash
   sudo docker images ppavlikmemphis/mofacts-mini --format '{{.ID}} {{.CreatedAt}}'
   sudo docker inspect mofacts --format='{{.Image}}'
   ```

6. **Clear browser cache:** Hard refresh (Ctrl+Shift+R) or use incognito mode

---

### Issue: Memory errors during container startup

**Symptoms:**
```
FATAL ERROR: Ineffective mark-compacts near heap limit
Allocation failed - JavaScript heap out of memory
```

**Cause:** Docker memory limits in docker-compose.yml are too restrictive (e.g., 512MB).

**Solution:**

Remove or significantly increase memory limits:

```yaml
# BAD - Too restrictive for production:
deploy:
  resources:
    limits:
      memory: 512M

# GOOD - Remove limits for production:
services:
  mofacts:
    restart: always  # No deploy/resources section
```

For production deployments, **do not set memory limits** unless you have specific constraints. The Meteor application needs sufficient memory during startup.

---

### Issue: npm packages not available on client-side

**Symptoms:**
```
Uncaught Error: Cannot find module 'plyr'
    at y (url_common.js:80:1)
```

**Cause:** In Meteor, npm packages are server-side by default. Client-side imports of npm packages fail unless properly configured.

**Solution:**

Use CDN versions for client-side libraries:

1. **Add CDN script to `client/index.html`:**
   ```html
   <head>
     <link rel="stylesheet" href="https://cdn.plyr.io/3.7.8/plyr.css" />
   </head>
   <body>
     <script src="https://cdn.plyr.io/3.7.8/plyr.min.js"></script>
   </body>
   ```

2. **Update the import in your code:**
   ```javascript
   // BEFORE (causes error):
   import Plyr from 'plyr';

   // AFTER (uses global from CDN):
   // Plyr loaded from CDN in index.html
   /* global Plyr */
   ```

This error will cascade and prevent other modules from loading, including router definitions!

---

## Deployment Issues

### Issue: Cannot access deployment even though container is running

**Symptoms:**
- Container shows as "Up" in `docker ps`
- `curl localhost:3000` works on server
- External access shows "Connection refused" or "502 Bad Gateway"

**Cause:** Apache reverse proxy not running or misconfigured.

**Solution:**

1. **Check if Apache is running:**
   ```bash
   sudo systemctl status apache2
   ```

2. **Start Apache if stopped:**
   ```bash
   sudo systemctl start apache2
   sudo systemctl enable apache2  # Auto-start on boot
   ```

3. **Verify Apache configuration:**
   ```bash
   cat /etc/apache2/sites-enabled/*default*
   ```

   Should include:
   ```apache
   <VirtualHost *:443>
       ServerName staging.optimallearning.org
       ProxyPass / http://127.0.0.1:3000/
       ProxyPassReverse / http://127.0.0.1:3000/
       # ... SSL config
   </VirtualHost>
   ```

4. **Check Apache error logs:**
   ```bash
   sudo tail -f /var/log/apache2/error.log
   ```

---

### Issue: nginx-proxy-manager interfering with production

**Symptoms:**
- Site worked locally but not in production
- 502 errors even though container is healthy

**Cause:** nginx-proxy-manager was used for local development but left running on production server, conflicting with Apache.

**Solution:**

1. **Stop nginx-proxy-manager:**
   ```bash
   sudo docker stop nginx-proxy-manager-app-1
   ```

2. **Verify Apache is handling the domain:**
   ```bash
   curl -I http://localhost  # Should show Apache headers
   ```

**Note:** nginx-proxy-manager is for local development only. Production uses Apache for reverse proxy and SSL termination.

---

## Runtime Errors

### Issue: MongoDB connection errors

**Symptoms:**
```
MongoServerSelectionError: connection timed out
```

**Causes:**
1. MongoDB container not running
2. Network configuration issues
3. Service name mismatch in docker-compose.yml

**Solutions:**

1. **Check MongoDB container:**
   ```bash
   sudo docker ps --filter 'name=mongo'
   sudo docker logs mofacts-mongodb-1
   ```

2. **Verify service name matches MONGO_URL:**
   ```yaml
   services:
     mongodb:  # Service name
       image: mongo:latest

     mofacts:
       environment:
         MONGO_URL: mongodb://mongodb:27017/MoFACT  # Must match service name
   ```

3. **Check for orphan containers:**
   ```bash
   sudo docker compose down --remove-orphans
   sudo docker compose up -d
   ```

4. **Verify network connectivity:**
   ```bash
   sudo docker exec mofacts ping mongodb
   ```

---

### Issue: MongoDB won't start - lock file error

**Symptoms:**
```
DBPathInUse: Unable to lock the lock file: /data/db/mongod.lock
Another mongod instance is already running
```

**Cause:** Multiple MongoDB containers trying to use the same data volume.

**Solution:**
```bash
sudo docker compose down --remove-orphans  # Stop all containers
sudo docker compose up -d                   # Start fresh
```

---

## Apache/Reverse Proxy Issues

### Issue: WebSocket connections failing

**Symptoms:**
- Meteor hot code push not working
- DDP connection errors
- Degraded real-time functionality

**Cause:** Apache not configured to proxy WebSocket connections.

**Solution:**

Ensure Apache config includes WebSocket proxy:

```apache
<VirtualHost *:443>
    ProxyRequests Off

    # WebSocket proxying - MUST come BEFORE regular proxy
    ProxyPass /websocket ws://localhost:3000/websocket
    ProxyPassMatch ^/sockjs/(.*)/websocket ws://localhost:3000/sockjs/$1/websocket

    # Regular HTTP proxying
    ProxyPass / http://127.0.0.1:3000/
    ProxyPassReverse / http://127.0.0.1:3000/
    ProxyPreserveHost on
</VirtualHost>
```

Enable required modules:
```bash
sudo a2enmod proxy
sudo a2enmod proxy_http
sudo a2enmod proxy_wstunnel
sudo systemctl restart apache2
```

---

## Verification Checklist

After any deployment, verify the following:

### On Local Machine (after build):
- [ ] Correct git branch checked out
- [ ] `docker images` shows new image with recent timestamp
- [ ] `docker compose push` completed successfully

### On Production Server (after deployment):
- [ ] `docker compose pull` completed successfully
- [ ] `docker ps` shows all containers running
- [ ] `docker logs mofacts --tail 50` shows successful startup
- [ ] Apache is running: `systemctl status apache2`
- [ ] Site accessible externally
- [ ] No console errors in browser (F12)
- [ ] Routes working (no "No route definitions found")

### Smoke Tests:
- [ ] Home page loads
- [ ] Login works
- [ ] Navigation between pages works
- [ ] Check browser console for errors

---

## Quick Reference Commands

### Build and Deploy (Local → Server):
```bash
# On local machine:
cd mofacts/.deploy
docker compose build --no-cache
docker compose push

# On server:
cd /var/www/mofacts
sudo docker compose pull
sudo docker compose down
sudo docker compose up -d
sudo docker logs mofacts -f
```

### Troubleshooting Commands:
```bash
# Check container status
sudo docker ps -a

# View logs
sudo docker logs mofacts --tail 100
sudo docker logs mofacts -f  # Follow mode

# Check images
sudo docker images

# Check Apache
sudo systemctl status apache2
sudo tail -f /var/log/apache2/error.log

# Restart everything
sudo docker compose down --remove-orphans
sudo docker compose up -d
sudo systemctl restart apache2
```

---

## Additional Resources

- Main README: `README.md`
- Detailed Apache setup: `docs_dev/DEPLOYING.md`
- Docker compose examples: `mofacts/.deploy/assets/`
  - `docker-compose-local-build.yml` - For building images
  - `docker-compose-server-production.yml` - For production deployment
