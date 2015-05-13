#!/bin/bash

# Install MongoDB
sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv 7F0CEB10
echo "deb http://repo.mongodb.org/apt/ubuntu "$(lsb_release -sc)"/mongodb-org/3.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-3.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org

# Change mongo to listen on all addresses (which is fine since we're walled off)
sed "s/bind_ip/#bind_ip/" < /etc/mongod.conf | sudo tee /etc/mongod.conf

# Install meteor
curl https://install.meteor.com/ | sh

# Make a symbolic link to the sync'ed directory for more "natural" work
ln -s /vagrant ~/mofacts
