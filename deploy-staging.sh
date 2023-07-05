#!/bin/bash

git checkout staging
git fetch
git pull

./mofacts-vagrant-build.sh
scp mofacts/build/mofacts.tar.gz staging:
   
ssh -t staging "\
    sudo -S mv ./mofacts.tar.gz /var/www/mofacts;\
    cd /var/www/mofacts;
    sudo -S ./deploy.sh"
