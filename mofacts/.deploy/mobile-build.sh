#!/bin/bah

#ask for server address (http:// is not optional), port and output path
echo "Enter server address (http:// is not optional):"
read server
echo "Enter port:"
read port
echo "Enter output path:"
read path

#build the app
cd ~/mofacts/mofacts
meteor build --server $server:$port --directory $path --mobile-settings settings.json

#copy the apk release file to the ~/mofacts directory
cp $path/android/release-unsigned.apk ~/mofacts/mofacts.apk

#install keytool, jarsigner and zipalign
sudo apt-get install -y zipalign keytool jarsigner

#if there is no keystore file, create one
if [ ! -f ~/mofacts/mofacts.keystore ]; then
    keytool -genkey -v -keystore ~/mofacts/mofacts.keystore -alias mofacts -keyalg RSA -keysize 2048 -validity 10000
fi

#sign the apk file
jarsigner -verbose -sigalg SHA1withRSA -digestalg SHA1 -keystore ~/mofacts/mofacts.keystore ~/mofacts/mofacts.apk mofacts

#append -unaligned to the filename
mv ~/mofacts/mofacts.apk ~/mofacts/mofacts-unaligned.apk

#zipalign the apk file
zipalign -v 4 ~/mofacts/mofacts-unaligned.apk ~/mofacts/mofacts.apk

#remove the unaligned file
rm ~/mofacts/mofacts-unaligned.apk

#write output message
echo "The signed apk file is located at ~/mofacts/mofacts.apk"



