# WebR2Sync_CDCX

Improvements compared to WebR2Sync+(https://github.com/WebDeltaSync/WebR2sync_plus):
1. Replace chunking method from Fixed-Sized Chunking(FSC) to Content-Defined Chunking(CDC);
2. Add the network-adaptive compression selection module. 

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
>> \>\> Now, visit localhost:8005 on your browser

## Document
> Client: WebR2sync_CDCX/public/js/sync-client.js
> 
> Server: WebR2sync_CDCX/app.js
> 
> Implements of chunking of data and matching of duplicate data blocks: WebR2sync_CDCX/bit-sync.js
> 
> Implement of generating delta patch: 
> 
> Implement of CDC: WebR2sync_CDC/public/js/fastcdc.js
> 
> Inplement of compression selection: WebR2Sync_CDCX/public/js/networkaware.js