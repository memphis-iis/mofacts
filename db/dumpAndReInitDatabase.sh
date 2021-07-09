#!/bin/bash

sudo -u postgres psql -c "DROP DATABASE mofacts"
sudo -u postgres createdb mofacts --owner=mofacts
sudo -u mofacts psql -f ./initTables.sql
