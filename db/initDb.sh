#!/bin/bash

sudo apt-get install postgresql
sudo -u postgres psql -c "CREATE USER mofacts WITH PASSWORD 'test101';"
sudo -u postgres createdb mofacts --owner=mofacts
sudo adduser --disabled-password --gecos "" mofacts
sudo echo "host    all             all             10.0.0.0/16             md5" >> /etc/postgresql/10/main/pg_hba.conf
sudo echo "listen_addresses = '*'" >> /etc/postgresql/10/main/postgresql.conf
sudo -u mofacts psql -f initTables.sql
sudo apt-get install npm -y
npm install pg-promise
sudo -u mofacts which node initFixtures.js
sudo systemctl restart postgresql