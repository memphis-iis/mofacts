cd /mofacts

meteor npm install --save bcrypt

meteor build --allow-superuser ./build --architecture os.linux.x86_64

cp build/mofacts.tar.gz /artifacts
