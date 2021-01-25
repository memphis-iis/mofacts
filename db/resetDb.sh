#!/bin/bash

sudo -u postgres psql -c 'drop database mofacts'
sudo -u postgres createdb mofacts
sudo -u mofacts psql -f initTables.sql
sudo -u mofacts node initFixtures.js