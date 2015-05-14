#!/bin/bash


# Make a symbolic link to the sync'ed directory for more "natural" work
ln -s /vagrant ~/mofacts


# Install MongoDB
sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv 7F0CEB10
echo "deb http://repo.mongodb.org/apt/ubuntu "$(lsb_release -sc)"/mongodb-org/3.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-3.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org

# Change mongo to listen on all addresses (which is fine since we're walled off)
PDIR="$HOME/.provision"
mkdir -p $PDIR

CFGSRC="/etc/mongod.conf"
CFGBASE="$PDIR/mongod.conf"

cp $CFGSRC $CFGBASE.old
sed "s/bind_ip/#bind_ip/" < $CFGBASE.old > $CFGBASE.new
sudo cp $CFGBASE.new $CFGSRC

# Now restart the service since we've changed the config
sudo service mongod restart


# Install meteor
curl https://install.meteor.com/ | sh


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

cp $SSHDSRC $SSHDBASE.old
grep -v PrintMotd $SSHDBASE.old > $SSHDBASE.new
printf "\n\nPrintMotd no\n" >> $SSHDBASE.new
sudo cp $SSHDBASE.new $SSHDSRC
