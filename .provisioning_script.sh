#!/bin/bash

#Make sure we can find the custom meteor packages
echo "export METEOR_PACKAGE_DIRS=/home/vagrant/mofacts/custom_packages" >> ~/.profile
echo "dos2unix mofacts/mofacts/run_meteor" >> ~/.profile
echo "sudo systemctl restart syllable.service" >> ~/.profile

# Make a symbolic link to the sync'ed directory for more "natural" work
ln -s /vagrant "$HOME/mofacts"

# We will need to be able to compile some binary packages for Meteor
sudo apt-get update
sudo apt-get install -y build-essential
sudo apt-get install -y gcc
sudo apt-get install -y g++
sudo apt-get install -y make
sudo apt-get install -y automake
sudo apt-get install -y git


###############################################################################
# Install MongoDB

# Use MongoDB 4.2
wget -qO - https://www.mongodb.org/static/pgp/server-4.2.asc | sudo apt-key add -
echo "deb http://repo.mongodb.org/apt/debian buster/mongodb-org/4.2 main" | sudo tee /etc/apt/sources.list.d/mongodb-org-4.2.list
sudo apt-get update
sudo apt-get install -y mongodb-org

sudo systemctl enable mongod

sudo apt-get install dos2unix

# Change mongo to listen on all addresses (which is fine since we're walled off)
PDIR="$HOME/.provision"
mkdir -p "$PDIR"

CFGSRC="/etc/mongod.conf"
CFGBASE="$PDIR/mongod.conf"

cp $CFGSRC "$CFGBASE.old"
cat "$CFGBASE.old" \
 | sed "s/bind_ip: 127.0.0.1/bind_ip: 0.0.0.0/" \
 | sed "s/bindIp: 127.0.0.1/bindIp: 0.0.0.0/" \
 > "$CFGBASE.new"
sudo cp "$CFGBASE.new" $CFGSRC

# Now restart the service since we've changed the config
sudo systemctl restart mongod
###############################################################################

# Install and configure postgres
dos2unix /vagrant/db/initDb.sh
bash /vagrant/db/initDb.sh

# Install Java 8
sudo apt-get install -y openjdk-8-jre

# Set up syllable systemd service
sudo cp /vagrant/syllables_subsystem/syllable.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable syllable.service
sudo systemctl start syllable.service

# Install nodejs 12.x
curl -sL https://deb.nodesource.com/setup_12.x | sudo bash -
sudo apt install -y nodejs

# Install meteor
curl https://install.meteor.com/?release=1.12 | sh

# In case we're running on a Windows host, we force the use of mounting instead
# of symlinks for meteor packages
cd "$HOME/mofacts/mofacts"

dos2unix run_meteor

sudo umount .meteor/local -f
rm .meteor/local -rf
mkdir -p .meteor/local

sudo umount packages -f
rm packages -rf
mkdir -p packages

mkdir -p "$HOME/.meteor/local"
sudo mount --bind "$HOME/.meteor/local" .meteor/local

mkdir -p "$HOME/.meteor/packages"
sudo mount --bind "$HOME/.meteor/packages" packages

#meteor update
meteor npm install --save babel-runtime --no-bin-links

#install meteor up deployer
npm install -g mup

# Set up dynamic config
bash /vagrant/scripts/server/setDynamicConfig.sh

# Remove Ubuntu's landscape stuff and clear login messages
sudo apt-get purge -y landscape-client landscape-common
sudo rm -f /etc/update-motd/*
sudo rm -f /etc/motd
sudo touch /etc/motd


# Spit out some messages for the user - to do this we'll need to create a message
# of the day (motd) file, and change the sshd_config file
cat << EOF | sudo tee /etc/motd

==============================================================================
Some helpful hints for working with meteor-based mofacts:

 * You can use your favorite code editor and version control application in
   the host operating system - you can just use this little login to start,
   stop, or restart the mofacts application

 * To run mofacts:

    cd mofacts/mofacts
    ./run_meteor

 * Connect to mofacts from your host operating system at:

    http://127.0.0.1:3000/

 * The provided meteor script (run_meteor above) insures that mofacts uses the
   correct MongoDB instance installed in this virtual machine. To access the
   MongoDB data from your host operating system (for instance, with RoboMongo)
   you should connect to IP address 127.0.0.1 and port 30017
==============================================================================

EOF

SSHDSRC="/etc/ssh/sshd_config"
SSHDBASE="$PDIR/sshd_config"

# Note that below we set the SSH variable PrintMotd to no - which is odd because
# that's exactly what we want to happen. However, Ubuntu configures a PAM motd
# module that will print the motd file on login. If we don't set the sshd config
# variable PrintMotd to no, our message would be displayed twice

cp "$SSHDSRC" "$SSHDBASE.old"
grep -v PrintMotd "$SSHDBASE.old" > "$SSHDBASE.new"
printf "\n\nPrintMotd no\n" >> "$SSHDBASE.new"
sudo cp "$SSHDBASE.new" "$SSHDSRC"

#add startup script to bashrc
#echo "bash ~/mofacts/mofacts/startup.sh" >> ~/.bashrc