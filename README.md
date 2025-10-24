# MoFaCTS README

MoFaCTS is a Meteor.js driven, responsive implementation of the FaCT System
designed for use by mobile participants.
- [Documentation Wiki](https://github.com/memphis-iis/mofacts/wiki)
- [Development Setup](#one-time-setup-for-mofacts)
- [Docker Deployment](#Deploying-Using-Docker)

Please see the docs subdirectory for a complete description of deployment and
production setup.

## One-Time Setup for MoFaCTS
### Development Setup

Follow these instructions to get a local copy of Mofacts up and running on your machine.

### Prerequisites

Before you begin, you will need the following installed:
* **Node.js**: Version `12.x`
* **npm**: Version `6.x`
* **Meteor.js**: Version `1.12`

We strongly recommend using **[nvm](https://github.com/nvm-sh/nvm)** (Node Version Manager) to manage your Node.js and npm versions to avoid conflicts.

---

### Installation

1.  **Clone the Repository**
    Clone this repository to your local machine.
    ```bash
    git clone https://github.com/memphis-iis/mofacts.git
    cd mofacts/mofacts/
    ```

2.  **Set Up Node.js Environment**
    If you are using `nvm`, run the following commands to install and use the correct Node.js version specified in the project's `.nvmrc` file.
    ```bash
    nvm install 12
    nvm use 12
    ```

3.  **Install Meteor.js**
    Install the specific version of Meteor required for this project.
    ```bash
    curl https://install.meteor.com/\?release\=1.12 | sh
    ```

4.  **Create Configuration File**
    Create your own settings file by copying the example file. You will need to edit **settings.json** with your local configuration details (e.g., admin/teacher emails, symspell settings, feedback cache locations).
    ```bash
    cp example.settings.json settings.json
    ```

5.  **Install Dependencies**
    Install all of the required npm packages.
    ```bash
    npm install
    ```

6.  **Run the Application**
    You can now start the Meteor development server.
    ```bash
    meteor run --settings settings.json
    ```

## Deploying Using Docker

### Local Development with Docker

You can run MoFaCTS locally using Docker Compose for a containerized development environment.

#### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/) installed on your system
- A valid `settings.json` file in `mofacts/.deploy/assets/` directory

#### Quick Start

1. **Navigate to the deployment directory:**
   ```bash
   cd mofacts/.deploy
   ```

2. **Build and start the services:**
   ```bash
   docker compose up -d
   ```

3. **Access the application:**
   - MoFaCTS app: [http://localhost:3000](http://localhost:3000)
   - Syllables service: port 4567

4. **Stop the services:**
   ```bash
   docker compose down
   ```

### Production Deployment to AWS/Remote Server

This section covers deploying MoFaCTS to a production server (e.g., AWS EC2 instance running Ubuntu).

#### Server Prerequisites

- Ubuntu 18.04 or later
- Docker and Docker Compose installed
- Apache web server (for reverse proxy and SSL)
- SSH access to the server
- `/mofactsAssets` directory with `settings.json` and other required assets

#### 1. Server Setup

**Install Apache and configure as reverse proxy:**

Apache should be configured to proxy requests from your domain to the Docker container on port 3000. See `docs_dev/DEPLOYING.md` for detailed Apache configuration including SSL setup with Let's Encrypt.

Key Apache configuration for the domain:
```apache
<VirtualHost *:443>
    ServerName staging.optimallearning.org

    ProxyRequests Off
    ProxyPass /websocket ws://localhost:3000/websocket
    ProxyPassMatch ^/sockjs/(.*)/websocket ws://localhost:3000/sockjs/$1/websocket
    ProxyPass / http://127.0.0.1:3000/
    ProxyPassReverse / http://127.0.0.1:3000/
    ProxyPreserveHost on

    # SSL configuration here
</VirtualHost>
```

**Ensure Apache is running:**
```bash
sudo systemctl start apache2
sudo systemctl enable apache2
```

#### 2. Building and Pushing Docker Images

**On your local development machine:**

1. **Navigate to the deployment directory:**
   ```bash
   cd mofacts/.deploy
   ```

2. **Ensure the docker-compose.yml has build sections:**
   The `docker-compose.yml` file must include `build:` sections for building from source:
   ```yaml
   services:
     mofacts:
       image: yourdockerhub/mofacts-mini:yourtag
       build:
         context: ../../
         dockerfile: Dockerfile
       # ... other configuration
   ```

3. **Build the Docker images:**
   ```bash
   docker compose build --no-cache
   ```

   The `--no-cache` flag ensures a clean build from scratch, avoiding cached layers.

4. **Push images to Docker Hub:**
   ```bash
   docker compose push
   ```

#### 3. Deploying to Production Server

**On the production server:**

1. **Navigate to the deployment directory:**
   ```bash
   cd /var/www/mofacts
   ```

2. **Ensure the docker-compose.yaml is configured for production:**
   - Remove `build:` sections (production uses pre-built images)
   - Set correct `ROOT_URL` environment variable
   - Configure proper restart policies
   - Set up networks for container communication

   Example production configuration:
   ```yaml
   services:
     mofacts:
       container_name: mofacts
       restart: always
       image: yourdockerhub/mofacts-mini:yourtag
       environment:
         ROOT_URL: https://staging.optimallearning.org
         MONGO_URL: mongodb://mongodb:27017/MoFACT
         PORT: 3000
         METEOR_SETTINGS_WORKAROUND: '/mofactsAssets/settings.json'
       # ... other configuration
   ```

3. **Pull the latest images:**
   ```bash
   sudo docker compose pull
   ```

4. **Stop existing containers and start with new images:**
   ```bash
   sudo docker compose down
   sudo docker compose up -d
   ```

5. **Verify the deployment:**
   ```bash
   sudo docker ps  # Check containers are running
   sudo docker logs mofacts --tail 50  # Check application logs
   ```

#### 4. Common Deployment Issues and Solutions

**Issue: "No route definitions found" or module errors**
- **Cause:** The Docker image was built from old/cached source code
- **Solution:** Rebuild with `--no-cache` flag and ensure you're on the correct git branch

**Issue: Out of memory errors during startup**
- **Cause:** Docker memory limits too restrictive (e.g., 512MB limit)
- **Solution:** Remove or increase memory limits in docker-compose.yml. For production, do not set memory limits or set them higher (e.g., 2GB+)

**Issue: Cannot access site (502 Bad Gateway)**
- **Cause:** Apache not running or not configured correctly
- **Solution:**
  ```bash
  sudo systemctl status apache2
  sudo systemctl start apache2
  ```
  Verify Apache virtual host configuration points to localhost:3000

**Issue: npm packages not available on client-side (e.g., "Cannot find module 'plyr'")**
- **Cause:** Meteor doesn't automatically bundle npm packages for client-side use
- **Solution:** Use CDN versions for client-side libraries. Add script tags in `client/index.html` and use `/* global PackageName */` instead of `import`

#### 5. Updating an Existing Deployment

To deploy new code changes:

1. **On local machine:**
   ```bash
   cd mofacts/.deploy
   docker compose build --no-cache
   docker compose push
   ```

2. **On production server:**
   ```bash
   cd /var/www/mofacts
   sudo docker compose pull
   sudo docker compose down
   sudo docker compose up -d
   ```

3. **Monitor the deployment:**
   ```bash
   sudo docker logs mofacts -f  # Follow logs in real-time
   ```

#### 6. Important Notes

- **Database persistence:** MongoDB data persists in Docker volumes even when containers are stopped/removed
- **Asset files:** Place settings.json and other assets in `/mofactsAssets` on the server
- **Build context:** The Dockerfile uses `context: ../../` which means it builds from the repository root
- **Image tags:** Use meaningful tags (e.g., `staging`, `production`, branch names) to track deployments
- **Rollback:** Keep previous image tags to quickly rollback if needed: `docker tag yourdockerhub/mofacts-mini:current yourdockerhub/mofacts-mini:backup-YYYYMMDD`

---

## Additional Resources

- **Detailed deployment guide:** See `docs_dev/DEPLOYING.md` for comprehensive Apache setup and configuration
- **Docker compose examples:** See `mofacts/.deploy/docker-compose.yml` for working configuration
- **Server setup scripts:** See `scripts/server/` directory for automated server setup scripts

### Latest DOI (IES_Fall_2019 Release)

[![DOI](https://zenodo.org/badge/202790770.svg)](https://zenodo.org/badge/latestdoi/202790770)
