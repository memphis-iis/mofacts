#!/bin/bash

#change wording directory to .deploy
cd .deploy

# Set the app name
APP_NAME="MoFACTs"

# Set the app path
APP_PATH="../"

# Prompt the user for the SSH username
read -p "Enter the SSH username: " SSH_USERNAME

# Prompt the user for the SSH key path
read -p "Enter the path to your SSH private key file: " SSH_KEY_PATH

# Prompt the user for the server IP address
read -p "Enter the server IP address: " SERVER_IP

# Set the domain name to the same value as the server IP address
DOMAIN_NAME=$SERVER_IP

# Set the port to 80
PORT=80

# Prompt the user for their Let's Encrypt email address
read -p "Enter your Let's Encrypt email address: " LETSENCRYPT_EMAIL

# Install mup and mup-docker-deploy
npm install -g mup mup-docker-deploy

# Initialize mup for your app
mup init

# Define the environment variables for your app
ENV_VARS='{
  "ROOT_URL": "http://'$DOMAIN_NAME'",
  "PORT": "'$PORT'"
}'

# Generate the mup.js file
echo "module.exports = {
  servers: {
    one: {
      host: '$SERVER_IP',
      username: '$SSH_USERNAME',
      pem: '$SSH_KEY_PATH'
    }
  },

  app: {
    name: '$APP_NAME',
    path: '$APP_PATH',
    env: $ENV_VARS,
    type: 'docker-image,
    docker: {
      image: 'meteorhacks/meteord:node-12-base',
      deployCheckWaitTime: 300
    },
    deployCheckWaitTime: 600,
    enableUploadProgressBar: true,
    enablePty: true,
    log: {
      driver: 'json-file',
      options: {
        max-size: '100m',
        max-file: '10'
      }
    }
  },

  proxy: {
    domains: '$DOMAIN_NAME',
    ssl: {
      letsEncryptEmail: '$LETSENCRYPT_EMAIL',
      forceSSL: true
    }
  }
}" > mup.js

#copy settings.json to this directory
cp ../settings.json .

#in settings.json, set the logNotice to "Build Config" and set testLogin to false
sed -i 's/"logNotice": ".*"/"logNotice": "Build Config"/' settings.json
sed -i 's/"testLogin": .*/"testLogin": false/' settings.json

#change any directory paths in settings.json that match /home/vagrant/mofacts/mofacts_depends/ to /mofacts_depends/
sed -i 's/\/home\/vagrant\/mofacts\/mofacts_depends\//\/mofacts_depends\//g' settings.json

# Deploy the app
mup setup
mup deploy