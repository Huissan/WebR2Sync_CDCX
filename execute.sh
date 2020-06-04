#!/bin/bash
nohup /home/ubuntu/.nvm/versions/node/v12.8.1/bin/node app.js --EBL $1 > local.log 2>&1 &
