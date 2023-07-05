#!/bin/bash
#NOTE: This script needs to be run OUTSIDE of the vagrant guest OS so that it can capture dev machine git config information

commitID=$(git rev-parse HEAD)
buildTimestamp=$(date)
buildersUsername=$(git config user.name)
branch=$(git branch | grep \* | cut -d ' ' -f2)
repoURL=$(git config --get remote.origin.url)

cat << EOF > mofacts/client/views/versionInfo.js
//NOTE: This file will be out of date on any machine except the one that last created the deployment tarball
Session.set("versionInfo",
{
"commitID":"$commitID",
"buildTimestamp":"$buildTimestamp",
"buildersUsername":"$buildersUsername",
"branch":"$branch",
"repoURL":"$repoURL"
}
);
EOF

cat << EOF > mofacts/private/versionInfo.json
{
"commitID":"$commitID",
"buildTimestamp":"$buildTimestamp",
"buildersUsername":"$buildersUsername",
"branch":"$branch",
"repoURL":"$repoURL"
}
EOF

vagrant ssh -c "cd mofacts/mofacts/build; meteor build ./ --architecture os.linux.x86_64"
