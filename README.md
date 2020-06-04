# WebR2Sync_CDCX

Improvements compared to WebR2Sync+(https://github.com/WebDeltaSync/WebR2sync_plus):
1. Replace chunking method from Fixed-Sized Chunking(FSC) to Content-Defined Chunking(CDC) in code file WebR2Sync_CDCX/public/bit-sync.js;
2. Add the network-adaptive compression selection module in WebR2Sync_CDCX/public/js/networkaware.js, with supplicant code files WebR2Sync_CDCX/public/speedtest_worker.js, WebR2Sync_CDCX/public/js/speedtest.js, and the directory WebR2Sync_CDCX/public/speed. 

## Get started
> environment: node.js v12.16.1
>> \>\> git clone this repository
>> 
>> \>\> install npm
>> 
>> \>\> cd to the path of this project
>> 
>> \>\> npm install
>> 
>> \>\> node bin/www
>> 
>> \>\> Now ,visit localhost:8005 on your browser

## Document
> Client: WebR2sync_CDCX/public/js/sync-client.js
> 
> Server: WebR2sync_CDCX/app.js
