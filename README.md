# MoFaCTS README

MoFaCTS is a Meteor.js driven, responsive implementation of the FaCT System
designed for use by mobile participants.
- [Documentation Wiki](https://github.com/memphis-iis/mofacts/wiki)
- [Development Setup](#one-time-setup-for-mofacts)
- [Docker Deployment](#deploying-using-docker)

Please see the docs subdirectory for a complete description of deployment and
production setup.

## One-Time Setup for MoFaCTS

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

## Deploying Using Docker (Server Deployment)

You can deploy MoFaCTS and its dependencies easily using Docker Compose.

## 1. Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/) installed on your system.
- A valid `settings.json` file and any required assets in a directory (e.g., `/mofactsAssets`).

## 2. Configuration

- Place your `settings.json` and any other required files in a directory on your host (e.g., `/mofactsAssets`).
- Edit the `docker-compose.yml` file if you need to change asset or data locations.

## 3. Start the Services

From the directory containing your `docker-compose.yml` file, run:

```bash
docker compose up -d
```

This will start:
- MoFaCTS (using the prebuilt image `iisdevs/mofacts-mini:main`)
- MongoDB (data persisted in a Docker volume)
- Syllables service (using `iisdevs/mofacts-syllables`)

## 4. Access the Application

- The MoFaCTS app will be available at [http://localhost:3000](http://localhost:3000).
- The syllables service will be available at port 4567 if needed.

## 5. Stopping and Removing the Services

To stop the services:

```bash
docker compose down
```

This will stop and remove the containers, but the MongoDB data will persist in the named Docker volume.

## 6. Notes

- The `MONGO_URL` and other environment variables are set automatically in the compose file.
- For production, you may want to adjust resource limits or use external MongoDB.
- To update to the latest image, run `docker compose pull` before starting.
- If you want to use a different image tag (e.g., `staging`), edit the `image:` line in the compose file.

---

### Example `docker-compose.yml`

```yaml
version: '3.2'

services:
    mofacts:
        image: iisdevs/mofacts-mini:main
        volumes:
            - type: bind
                source: /mofactsAssets
                target: /mofactsAssets
                bind:
                    propagation: shared
        build:
            context: ../../
            dockerfile: Dockerfile
        ports:
            - '3000:3000'
        depends_on:
            - mongo
            - syllables
        environment:
            ROOT_URL: ${APP_ROOT_URL:-http://localhost}
            MONGO_URL: mongodb://mongo:27017/MoFACT
            PORT: 3000
            METEOR_SETTINGS_WORKAROUND: '/mofactsAssets/settings.json'
        deploy:
            restart_policy:
                condition: on-failure
                delay: 5s
                max_attempts: 3
                window: 120s
            resources:
                limits:
                    cpus: '0.5'
                    memory: 512M
                reservations:
                    cpus: '0.25'
                    memory: 256M

    mongo:
        image: mongo:latest
        command:
            - --storageEngine=wiredTiger
        volumes:
            - data:/data/db

    syllables:
        image: iisdevs/mofacts-syllables
        build:
            context: ../../syllables_subsystem
            dockerfile: Dockerfile
        ports:
            - '4567:4567'


volumes:
    data:
```

### Latest DOI (IES_Fall_2019 Release)

[![DOI](https://zenodo.org/badge/202790770.svg)](https://zenodo.org/badge/latestdoi/202790770)
