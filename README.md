# Latest DOI (IES_Fall_2019 Release)

[![DOI](https://zenodo.org/badge/202790770.svg)](https://zenodo.org/badge/latestdoi/202790770)

# MoFaCTS README

MoFaCTS is a Meteor.js driven, responsive implementation of the FaCT System
designed for use by mobile participants.
- [Documentation Wiki](https://github.com/memphis-iis/mofacts/wiki)
- [Development Setup](#one-time-setup-for-mofacts)
- [Docker Deployment](#deploying-using-docker)

Please see the docs subdirectory for a complete description of deployment and
production setup.

# One-Time Setup for MoFaCTS

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

## Testing
To run both server and client tests* in Vagrant, use

```
TEST_WATCH=1 ./run_meteor test --driver-package meteortesting:mocha --settings ./settings.json --allow-incompatible-update
```
*The `--full-app` option may be used for integration testing.

## When you're done with development

Once you've reached a stopping point, you should shut down your environment
cleanly. If you still have mofacts running, stop it with CTRL+C. Then you can
exit the SSH session by entering `exit` at the command prompt in the virtual
machine. After you exit, you should be back in your native OS environment
where you originally entered `vagrant ssh`. From here you can stop the virtual
machine:

````
$ vagrant halt
````

This is fine for the end of a development session, but if you want to remove
the virtual machine from your computer you can delete it:

````
$ vagrant destroy
````

This is a low risk activity, since you can always run `vagrant up` to recreate
the virtual machine for you.

## Notes on Upgrading from Meteor 1.8.3 releases to Meteor 1.12 releases

There are two options to upgrade meteor to fix the issue of expired certificates, depending individual cases.

### Destroy vagrant environment and re-provision and use the latest branch that is compatible with 1.12
    
    -vagrant destroy, pull 1.12 branch, vagrant up

### Update your environment to run node 12 and meteor 1.12:
    
    -Must install nodejs 12.x
        curl -sL https://deb.nodesource.com/setup_12.x | sudo bash -
        sudo apt install -y nodejs        
    
    -Must install meteor 1.12
        curl https://install.meteor.com/?release=1.12 | sh

    -update npm packages and upgrade incompatible package
        sudo rm -rf package-lock.json node_modules
        sudo npm cache clean --force
        sudo npm i --unsafe-perm node-sass
        NODE_TLS_REJECT_UNAUTHORIZED=0 meteor remove fourseven:scss
        NODE_TLS_REJECT_UNAUTHORIZED=0 meteor add fourseven:scss@4.12.0
        
    -**if using an old branch** manually upgrade mofacts to 1.12 
        meteor update --release 1.12
        
      

## FAQs

### Question

I'm encountering the following error when trying to run meteor:
````
vagrant@vagrant-ubuntu-trusty-64:~/mofacts/mofacts$ ./run_meteor
-bash: ./run_meteor: /bin/bash^M: bad interpreter: No such file or directory
````

### Solution

This is an error due to the run_meteor file's line endings being converted to windows line endings and not linux line endings.  To fix it simply run the following commands inside the vagrant vm:

````
sudo apt-get install dos2unix
dos2unix run_meteor
````

Then simply run meteor as normal with

````
./run_meteor
````

## Caveats

* Older versions of Firefox that don't support HTML5 Web Audio are not compatible with MoFaCTs. This incompatibility
  is usually indicated by a "speechSynthesis is not defined or supported" error in the console.

* Server deployments should be performed as the root user, e.g. `sudo ./deploy.sh`. Failing to do this will cause a build
  error relating to the _fibers_ package.

* MoFaCTs runs on Node 8.x. Older versions of Node will throw a libstdc++.so.6 at build time.

* MoFaCTs must be built for Linux 64-bit architecture (`os.linux.x86_64`) _without_ Node being installed on the
  vagrant host machine. With Node host conflicts or the wrong architecture specified, a `unexpected token { const pause ...`
  error can be seen at build time.


# Deploying Using Docker

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
