#!/bin/bash

#sudo apt-get install postgresql
sudo -u postgres psql -c "CREATE USER mofacts WITH PASSWORD 'test101';"
sudo -u postgres createdb mofacts
sudo adduser --disabled-password --gecos "" mofacts
sudo echo "local   mofacts         mofacts                                 md5" >> /etc/postgresql/10/main/pg_hba.conf

sudo -u mofacts psql -f initTables.sql
sudo apt-get install npm -y
npm install pg-promise
sudo -u mofacts which node initFixtures.js