ssh -t staging "sudo -S ./createMongoDump.sh"

scp staging:mongodump.tar.gz ./

tar -xzf ./mongodump.tar.gz
