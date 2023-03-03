#if /app/src does not exist, then create it
echo "Creating /app/src directory"
mkdir -p /app/src

#set the

#if there is a mofacts.tar.gz in the /mofacts_config directory, then extract it to /app/src
if [ -f /mofacts_config/mofacts.tar.gz ]; then
    echo "Extracting mofacts.tar.gz to /app/src"
    tar -xzf /mofacts_config/mofacts.tar.gz -C /app/src
fi

#copy /mofacts_config/star.json to /app/src/bundle/
echo "Copying /mofacts_config/star.json to /app/src/bundle/"
cp /mofacts_config/star.json /app/src/bundle/

#run npm install
echo "Running npm install"
cd /app/src/bundle/programs/server
npm install

#set the METEOR_SETTINGS_WORKAROUND environment variable to the contents of /mofacts_config/settings.json
echo "Setting METEOR_SETTINGS_WORKAROUND environment variable"
export METEOR_SETTINGS_WORKAROUND=$(cat /mofacts_config/settings.json)

#run nodejs app mofacts
echo "Running nodejs app mofacts"
node /app/src/bundle/main.js