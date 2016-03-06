#!/bin/bash

# For use inside docker shell (github.com/mzedeler/dsh)

echo "check_certificate = off" >> ~/.wgetrc
wget -qO- https://raw.githubusercontent.com/creationix/nvm/v0.31.0/install.sh | bash
. /root/.nvm/nvm.sh
nvm install v5.6.0
nvm use v5.6.0

npm install && npm run forever

