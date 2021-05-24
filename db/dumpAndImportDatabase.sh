#!/bin/bash

sudo cp /home/andrew/mofacts.dump /home/mofacts/mofacts.dump
sudo -u postgres psql -c "DROP DATABASE mofacts"
sudo -u postgres createdb mofacts --owner=mofacts
sudo -u mofacts psql mofacts < mofacts.dump