#!/bin/bash

echo "Insuring git installed"
sudo apt-get install -y git

echo "Insuring proper packages folder"
sudo umount .meteor/local -f
rm .meteor/local -rf
mkdir -p .meteor/local

sudo umount packages -f
rm packages -rf
mkdir -p packages

mkdir -p $HOME/.meteor/local
sudo mount --bind $HOME/.meteor/local .meteor/local

mkdir -p $HOME/.meteor/packages
sudo mount --bind $HOME/.meteor/packages packages

if [ ! -d packages ]; then
    echo "packages directory does not exist - exiting"
    exit 1
fi
cd packages

echo "Manually getting scss"
rm -fr meteor-scss
git clone https://github.com/fourseven/meteor-scss.git

echo "If everything worked, you should be able to run:"
echo "./run_meteor update"
