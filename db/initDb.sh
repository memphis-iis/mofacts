#!/bin/bash

sudo apt-get install -y postgresql
sudo -u postgres psql -c "CREATE USER mofacts WITH PASSWORD 'test101';"
sudo -u postgres createdb mofacts --owner=mofacts
sudo adduser --disabled-password --gecos "" mofacts
sudo -u mofacts psql -f /vagrant/db/initTables.sql
echo "host    all             all             10.0.0.0/16             md5" | sudo tee -a /etc/postgresql/10/main/pg_hba.conf
echo "listen_addresses = '*'" | sudo tee -a /etc/postgresql/10/main/postgresql.conf
cd /vagrant/db
sudo apt-get install -y npm
npm install pg-promise
sudo -u mofacts node initFixtures.js
#sudo systemctl restart postgresql