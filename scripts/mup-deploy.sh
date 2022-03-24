#!/bin/sh

# Author : Rusty Haner
# Script follows here:

echo "Starting MoFACTs Deployment. Please answer the following for congiguration."
echo "This script will also create a public key for your server which will be deleted after for security reasons."
echo "Previous keys on this vagrant box will be lost."
echo "Press Enter to Continue or CTRL+C to quit."
read CONTINUE
echo "Test Logins Active? TRUE/FALSE"
read TEST_LOGINS 
echo "Google Client Id?"
read GOOGLE_CLIENT_ID
echo "Google Secret?"
read GOOGLE_SECRET
echo "Owner's Gmail <yourname@gmail.com>"
read OWNER_GMAIL
echo "Elaborated Feedback Filename:"
read FEEDBACK_FILE
echo "Glossary Filename:"
read GLOSSARY_FILE
echo "DEBUG Enable (true/false):" 
read DEBUG_ENABLED
echo "Target Server IP (xxx.xxx.xxx.xxx):"
read TARGET_IP
echo "Target Server Username:"
read TARGET_USERNAME

echo "Deleting previous Meteor Up settings.json."
rm -rf ~/mofacts/mofacts/.deploy/settings.json

echo "Writing new Meteor Up settings.json."
touch ~/mofacts/mofacts/.deploy/settings.json
echo "{ 
  \"logNotice\": \"Meteor Up Config\", 
  \"public\": { 
      \"testLogin\":"$TEST_LOGINS"
  }, 
  \"google\": { 
      \"clientId\": \""$GOOGLE_CLIENT_ID"\", 
      \"secret\": \""$GOOGLE_SECRET"\" 
  }, \n
  \"owner\": \""$OWNER_GMAIL"\",  
  \"initRoles\": { \n 
      \"admins\": [\""$OWNER_GMAIL"\",\"vagrant@vagrant-ubuntu-trusty-64\"],  
      \"teachers\": [] 
  }, 
  \"definitionalFeedbackDataLocation\":\"/mofacts_resources/"$GLOSSARY_FILE"\",  
  \"elaboratedFeedbackDataLocation\":\"/mofacts_resources/"$FEEDBACK_FILE"\",  
  \"debug\":"$DEBUG_ENABLED"
}" > ~/mofacts/mofacts/.deploy/settings.json

echo "DONE with writing settings.json."

echo "Deleting SSH Keys"
rm -rf ~/.ssh/id_rsa

echo "Creating SSH Key. Press Enter 3 times."
ssh-keygen -b 2048 -t rsa

echo "Copying SSH Keys to Server"
eval `ssh-agent -s`
openssl rsa -in ~/.ssh/id_rsa -outform pem > ~/.ssh/id_rsa.pem
chmod 600 ~/.ssh/id_rsa.pem
ssh-add ~/.ssh/id_rsa.pem
ssh-copy-id -i ~/.ssh/id_rsa $TARGET_USERNAME@$TARGET_IP

echo "Setting up server permissions. You might have to type in the root password a lot."
echo "This includes allowing automatic sudo for sudoers in /etc/sudoers. Please be advised."
OUTPUT="%sudo ALL=(ALL) NOPASSWD:ALL"
ssh -t $TARGET_USERNAME@$TARGET_IP "sudo mkdir /mofacts_resources;
sudo setfacl -m u:"$TARGET_USERNAME":rwx /mofacts_resources;
sudo adduser "$TARGET_USERNAME" sudo;
sudo sh -c \"echo '%sudo ALL=(ALL) NOPASSWD:ALL' >> /etc/sudoers\""


echo "DELETING old mup.js."
rm -rf ~/mofacts/mofacts/.deploy/mup.js

echo "module.exports = {
  servers: {
    one: {
      host: '"$TARGET_IP"',
      username: '"$TARGET_USERNAME"',
      pem: '~/.ssh/id_rsa'
    }
  },
  app: {
    name: 'MoFACTs-Postgres',
    path: '../',
    volumes: {
      '/mofacts_resources/': '/mofacts_resources/'
    },
    docker: {
      image: 'abernix/meteord:node-12-base',
      buildInstructions: [
        'RUN echo \"deb http://apt.postgresql.org/pub/repos/apt stretch-pgdg main\" > /etc/apt/sources.list.d/pgdg.list',
        'RUN apt-get update && apt-get install -y --allow-unauthenticated postgresql-9.3 postgresql-client-9.3 postgresql-contrib-9.3',
        'USER postgres',
        'RUN    /etc/init.d/postgresql start && psql --command \"CREATE USER mofacts WITH SUPERUSER PASSWORD \'test101\';\" && createdb -O mofacts mofacts',
        'RUN echo \"host all  all    0.0.0.0/0  md5\" >> /etc/postgresql/9.3/main/pg_hba.conf',
        'RUN echo \"listen_addresses=\'*\'\" >> /etc/postgresql/9.3/main/postgresql.conf',
        'EXPOSE 5432',
        'VOLUME  [\"/etc/postgresql\", \"/var/log/postgresql\", \"/var/lib/postgresql\"]'
      ]
    },
    servers: {
      one: {}
    },
    buildOptions: {
      serverOnly: true
    },
    env: {
      ROOT_URL: 'http://"$TARGET_IP"',
      MONGO_URL: 'mongodb://localhost/mofacts'
    }
  },
  mongo: {
    version: '4.2.0',
    servers: {
      one: {}
    }
  }
};" > ~/mofacts/mofacts/.deploy/mup.js

echo "DONE with writing mup.js."

echo "Copying cache and resources to server:/mofacts_resources. Assume default locations."
scp ~/mofacts/$FEEDBACK_FILE $TARGET_USERNAME@$TARGET_IP:/mofacts_resources
scp ~/mofacts/$GLOSSARY_FILE $TARGET_USERNAME@$TARGET_IP:/mofacts_resources

echo "Installing Meteor Up."
sudo npm install mup -g

echo "Ready to Configure Meteor Server. Enter to continue, CTRL+C to abort."
read CONTINUE
cd ~/mofacts/mofacts/.deploy
mup setup

echo "Ready to Deploy. Enter to continue, CTRL+C to abort."
read CONTINUE
mup deploy

echo "Deployed at http://$TARGET_IP/"