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
meteor npm install --save meteor-node-stubs