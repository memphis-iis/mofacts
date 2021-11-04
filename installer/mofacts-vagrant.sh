echo "Downloading newest version of mofacts."
cd /c/MoFACTs
git clone https://github.com/memphis-iis/mofacts-ies.git
echo "starting vagrant"
cd mofacts-ies
vagrant up
vagrant ssh