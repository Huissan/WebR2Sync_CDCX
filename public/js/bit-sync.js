/**
 * bit-sync.js
 *
 * For more information see the readme.
 *
 * Source is located at https://github.com/claytongulick/bit-sync
 *
 * Licensed under the MIT License
 *
 * Copyright Clayton C. Gulick
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */


var MMHASH3;
if(!MMHASH3){
    MMHASH3 = require('./murmurhash3');
    SipHash = require('./siphash');
    var performance = Date;
}

var hash123;
if(!hash123)
{
    hash123 = require('./hash123');
}
var fastcdc;
if(!fastcdc)
{

    fastcdc = require('./fastcdc');
}


var BSync = new function()
{
    function appendBuffer( buffer1, buffer2 ) {
        var tmp = new Uint8Array( buffer1.byteLength + buffer2.byteLength );
        tmp.set( new Uint8Array( buffer1 ), 0 );
        tmp.set( new Uint8Array( buffer2 ), buffer1.byteLength );
        return tmp.buffer;
    }
    /**
     * Create a document that contains all of the checksum information for each block in the destination data. Everything is little endian
     * Document structure:
     * First 4 bytes = block size
     * Next 4 bytes = number of blocks
     * 4 byes  = byte length of file
     * Repeat for number of blocks:
     *   4 bytes, adler32 checksum
     *   16 bytes, md5 checksum
     *
     */
    // function createChecksumDocument(blockSize, data)
    // {
    //     var filebytelength = data.byteLength;
    //     var numBlocks = Math.ceil(data.byteLength / blockSize);
    //     var i=0;
    //     var docLength = ( numBlocks * //the number of blocks times
    //     ( 4 +       //the 4 bytes for the adler32 plus
    //     16) +     //the 16 bytes for the md5
    //     4 +         //plus 4 bytes for block size
    //     4 + 4);         //plus 4 bytes for the number of blocks
    //
    //     var doc = new ArrayBuffer(docLength);
    //     var dataView = new Uint8Array(data);
    //     var bufferView = new Uint32Array(doc);
    //     var offset = 3;
    //     var chunkSize = 5; //each chunk is 4 bytes for adler32 and 16 bytes for md5. for Uint32Array view, this is 20 bytes, or 5 4-byte uints
    //
    //     bufferView[0] = blockSize;
    //     bufferView[1] = numBlocks;
    //     bufferView[2] = filebytelength;
    //
    //     //spin through the data and create checksums for each block
    //     for(i=0; i < numBlocks; i++)
    //     {
    //         var start = i * blockSize;
    //         var end = (i * blockSize) + blockSize;
    //
    //         //calculate the adler32 checksum
    //         bufferView[offset] = adler32(start, end - 1, dataView).checksum;
    //         offset++;
    //
    //         //calculate the full md5 checksum
    //         var chunkLength = blockSize;
    //         if((start + blockSize) > data.byteLength)
    //             chunkLength = data.byteLength - start;
    //
    //
    //         var md5sum = md5(dataView,0,start,chunkLength);
    //         // var md5sum = [0,0,0,0]
    //         for(var j=0; j < 4; j++) bufferView[offset++] = md5sum[j];
    //
    //     }
    //
    //     return doc;
    //
    // }
    function createChecksumDocument(data)
    {
        var filebytelength = data.byteLength;

        var doc = new ArrayBuffer(10000);
        var bufferView = new Uint32Array(doc);
        bufferView[0] = 0;//block count
        bufferView[1] = filebytelength;
        var offset = 2;
        var blockCount = 0;
        // var testTimeStart = new Date().getTime();
        fastcdc.Init('Mask_8KB');
        // testTime = new Date().getTime() - testTimeStart;
        // console.log("test time:"+testTime);
        var start = 0;
        var end = 0;
        var dataView = new Uint8Array(data);

        //spin through the data and create checksums for each block
        var chunkTime = 0;
        var adler32Time = 0;
        var sha1Time = 0;
        var chunkstart;
        var adler32start;
        var sha1start;
        for( ; ; )
        {
            if(start >= dataView.length)
                break;
            chunkstart = new Date().getTime();
            end = fastcdc.ChunkData(dataView, start, dataView.length);
            chunkTime += (new Date().getTime() - chunkstart);
            adler32start = new Date().getTime();
            adlerValue = hash123.adler32(start, end, dataView).checksum;
            adler32Time += (new Date().getTime()- adler32start);
            sha1start = new Date().getTime();
            var sha1Buffer = hash123.sha1(dataView, 0, start, end);
            var shalview = new Uint32Array(sha1Buffer);
            sha1Time += (new Date().getTime() - sha1start);
            if (offset+8 >= bufferView.length)
            {
                doc = appendBuffer(doc, new ArrayBuffer(10000));
                bufferView = new Uint32Array(doc);
            }
            bufferView[offset++] = start;//start position
            bufferView[offset++] = end-start;//length
            bufferView[offset++] = adlerValue;//adler32 hash
            for (i=0; i<5; i++)
            {
                bufferView[offset++] = shalview[i];
            }
            blockCount++;
            start = end;
        }
        console.log('chunk:'+chunkTime);
        console.log('Adler32:'+adler32Time);
        console.log('sha1Time:'+sha1Time);

        bufferView[0] = blockCount;

        return doc.slice(0, offset*4);

    }

    /**
     * Parse the checksum document into a hash table
     *
     * The hash table will have 2^16 entries. Each entry will point to an array that has the following strucutre:
     * [
     *  [ [blockIndex, adler32sum, md5sum],[blockIndex, adler32sum, md5sum],... ]
     *  [ [blockIndex, adler32sum, md5sum],[blockIndex, adler32sum, md5sum],... ]
     *  ...
     * ]
     */
    function  parseChecksumDocument(checksumDocument)
    {
        var ret = [];
        var linked_checksum = [];
        var view = new Uint32Array(checksumDocument);
        var blockIndex = 0;
        var numBlocks = view[0];
        var filebytelength = view[1];
        var hashValue;
        var view8 = new Uint8Array(checksumDocument);

        hash123.md5(view8,0,0, view8.length);
        //each chunk in the document is 20 bytes long. 32 bit view indexes 4 bytes, so increment by 5.
        for(i = 2; i <view.length; i += 8)
        {
            blockLength = view[i+1];
            checksumInfo = [
                blockIndex, //the index of the block
                blockLength,
                view[i+2], //the adler32sum
                [view[i+3],view[i+4],view[i+5],view[i+6],view[i+7]] //the md5sum
            ];

            hashValue = hash123.hash16(checksumInfo[2]);
            if(!ret[hashValue]) ret[hashValue] = [];
            ret[hashValue].push(checksumInfo);
            linked_checksum[blockIndex] = [view[i+3],view[i+4],view[i+5],view[i+6],view[i+7]];
            blockIndex++;
        }

        if(numBlocks != blockIndex)
        {
            throw "Error parsing checksum document. Document states the number of blocks is: " + numBlocks + " however, " + blockIndex - 1 + " blocks were discovered";
        }
        return [filebytelength, ret, linked_checksum];

    }

    /**
     * create match document that contains all matched block index
     * 4 bytes - blockSize
     * 4 bytes - num of matched blocks
     * for each matched block
     *    4 bytes - the index of the matched block
     *    4 bytes - the offset in the old file
     */
    function createMatchDocument(checksumDocument, data){
        /**
         * First, check to see if there's a match on the 16 bit hash
         * Then, look through all the entries in the hashtable row for an adler 32 match.
         * Finally, do a strong md5 comparison
         */
        function checkMatch(adlerInfo, hashTable, start, blockLength, data)
        {
            var hash = hash123.hash16(adlerInfo.checksum);

            // return false;
            if(!(hashTable[hash])) {
                // console.log('adler 32 missing');
                return -1;
            }
            // var testblock = block.slice(start,start+chunksize);

            var row = hashTable[hash];

            for(var i=0; i<row.length; i++)
            {
                //compare adler32sum
                //if((row[i][1] & 0xffffffff) != adlerInfo.checksum) continue;
                if((row[i][2]) != adlerInfo.checksum) continue;
                if(row[i][1] != blockLength) continue;
                //do strong comparison
                var sha1value1Buffer = hash123.sha1(data,0, start, end);
                var sha1value1 = new Uint32Array(sha1value1Buffer);

                var sha1value2 = row[i][3];

                if(
                    sha1value1[0] == sha1value2[0] &&
                    sha1value1[1] == sha1value2[1] &&
                    sha1value1[2] == sha1value2[2] &&
                    sha1value1[3] == sha1value2[3] &&
                    sha1value1[4] == sha1value2[4]
                )
                    return row[i][0]; // match found, return the matched block index
            }

            return -1;

        }

        var checksumDocumentView = new Uint32Array(checksumDocument);
        var numBlocks = checksumDocumentView[0];

        var patchDocument = new ArrayBuffer(4);
        var i=0;

        var checksumret = parseChecksumDocument(checksumDocument);
        var filebytelength = checksumret[0];
        var hashTable = checksumret[1];
        var linked_checksum = checksumret[2];

        // var endOffset = data.byteLength - blockSize;

        var dataUint8 = new Uint8Array(data);
        var matchedBlocks = new ArrayBuffer  (10000);
        var matchedBlocksUint32 = new Uint32Array(matchedBlocks);
        var matchCount = 0;
        var matchSize = 0;

        var prematching = false;
        var preindex = null;
        var startTime = performance.now();
        var blockCount = 0;
        var chunkTime = 0;
        var sha1Time = 0;
        fastcdc.Init('Mask_8KB');

        for(;;)
        {
            var start = i;
            var chunkStart = new Date().getTime();
            var end = fastcdc.ChunkData(dataUint8, start, dataUint8.length);
            chunkTime += (new Date().getTime() - chunkStart);
            blockCount++;
            var blockLength = end - start;

            //locality optimized
            // prematching = false;
            if(prematching){
                var predict_index = preindex+1;
                //predict_checksum
                var sha1value2 = linked_checksum[predict_index];
                if(sha1value2){
                    // console.log("predict success!");
                    var sha1Start = new Date().getTime();
                    var sha1value1Buffer = hash123.sha1(data,0, start, end);
                    sha1Time += (new Date().getTime() - sha1Start);
                    var sha1value1 = new Uint32Array(sha1value1Buffer);

                    if(
                        sha1value1[0] == sha1value2[0] &&
                        sha1value1[1] == sha1value2[1] &&
                        sha1value1[2] == sha1value2[2] &&
                        sha1value1[3] == sha1value2[3] &&
                        sha1value1[4] == sha1value2[4]
                    ){
                        matchSize += blockLength;
                        var matchedBlock = predict_index;
                        if(3*(matchCount+1) > matchedBlocksUint32.length)
                        {
                            matchedBlocks = appendBuffer(matchedBlocks, new ArrayBuffer(10000));
                            matchedBlocksUint32 = new Uint32Array(matchedBlocks);
                        }
                        matchedBlocksUint32[3*matchCount] = matchedBlock;
                        matchedBlocksUint32[3*matchCount+1] = start;
                        matchedBlocksUint32[3*matchCount+2] = end;
                        matchCount++;
                        //check to see if we need more memory for the matched blocks

                        i += blockLength;
                        if(i > dataUint8.length -1 ) break;
                        prematching = true;
                        preindex = matchedBlock;
                        continue;
                    }
                }
            }
            // resuse md5 checksum

            var adlerInfo = hash123.adler32(start, end, dataUint8);

            var matchedBlock = checkMatch(adlerInfo, hashTable, start, blockLength, dataUint8);
            if(matchedBlock >=0 )
            {
                //if we have a match, do the following:
                //1) add the matched block index to our tracking buffer
                //2) add match block into match cache
                //3) jump forward blockSize bytes and continue
                if(3*(matchCount+1) >= matchedBlocksUint32.length)
                {
                    matchedBlocks = appendBuffer(matchedBlocks, new ArrayBuffer(10000));
                    matchedBlocksUint32 = new Uint32Array(matchedBlocks);
                }
                matchedBlocksUint32[3*matchCount] = matchedBlock;
                matchedBlocksUint32[3*matchCount+1] = start;
                matchedBlocksUint32[3*matchCount+2] = end;
                matchCount++;
                matchSize += blockLength;
                //check to see if we need more memory for the matched blocks

                prematching = true;
                preindex = matchedBlock;
            } else {
                prematching = false;
            }

            i+=blockLength;
            if(i > dataUint8.length -1) break;
        } //end for each byte in the data

        //console.log("chunk time:", chunkTime);
        //console.log("sha1 time:", sha1Time);
        //console.log(matchedBlocksUint32);
        var test1 = performance.now();
        console.log("match doc create time: " + (test1 - startTime));

        console.log("matchcount = "+matchCount);
        console.log("numblocks = "+numBlocks);
        console.log("############### Match size: " + matchSize);
        var patchDocumentView32 = new Uint32Array(patchDocument);
        patchDocumentView32[0] = matchCount;
        patchDocument = appendBuffer(patchDocument, matchedBlocks.slice(0,matchCount * 4 * 3));


        return [patchDocument,filebytelength, numBlocks];
    }

    /**
     * Apply the patch to the destination data, making it into a duplicate of the source data
     * Due to the inability to modify the size of ArrayBuffers once they have been allocated, this function
     * will return a new ArrayBuffer with the update file data. Note that this will consume a good bit of extra memory.
     */
    function applyPatch(patchDocument, data)
    {
        function appendBlock( buffer, blockUint8) {
            var tmp = new Uint8Array( buffer.byteLength + blockUint8.length);
            tmp.set( new Uint8Array( buffer ), 0 );
            tmp.set( blockUint8, buffer.byteLength );
            return tmp.buffer;
        }

        var patchDocumentView32 = new Uint32Array(patchDocument,0,3);
        var blockSize = patchDocumentView32[0];
        var patchCount = patchDocumentView32[1];
        var matchCount = patchDocumentView32[2];
        var matchedBlockView32 = new Uint32Array(patchDocument,12,matchCount);
        var i=0;
        var j=0;

        //first, let's deal with the simple case where we fully match. This is just an optimization for the unchanged file case.
        //to determine this, the number of matches must exactly equal ceil of data / blockSize, and num patches must be zero
        //additionally, the matched block indexes must start with 1 and be in order. This is to deal with the extreme edge case of a block being relocated
        //on an exact block boundary
        if(patchCount == 0)
            if(Math.ceil(data.byteLength / blockSize) == matchCount)
                for(i = 1; i <= matchCount; i++)
                    if(matchedBlockView32[i-1] != i) { break; }
        if((i - 1) == matchCount) return data; //exact match

        //there was a modification. We need to construct the new document.
        //the way this works is as follows:
        //1) for each patch, get the last index of the matching block
        //2) loop through the matchedBlocks, appending blocks up to the index from step 1
        //3) append the patch at that point
        //4) after all patches have been applied, continue to loop through the matchedBlocks appending each one in order
        var offset = 12 + (matchCount * 4); //offset to the start of the patches
        var lastMatchingBlockIndex=0;
        var patchSize=0;
        var patchView8;
        var matchIndex=0; //the index into the matching blocks array
        var blockIndex=0; //the index of the block in the matching blocks array
        var ret = new ArrayBuffer(0);
        var patchDocumentView8 = new Uint8Array(patchDocument);
        var chunkSize=0;
        for(i=0; i< patchCount; i++)
        {
            lastMatchingBlockIndex = readInt32(patchDocumentView8,offset);
            patchSize = readInt32(patchDocumentView8,offset + 4);
            patchView8 = new Uint8Array(patchDocument, offset + 8, patchSize);
            offset = offset + 8 + patchSize;

            for(;matchIndex < matchedBlockView32.length; matchIndex++)
            {
                blockIndex = matchedBlockView32[matchIndex];
                if(blockIndex > lastMatchingBlockIndex) break;
                if((blockIndex * blockSize) > data.byteLength)
                    chunkSize = data.byteLength % blockSize;
                else chunkSize = blockSize;
                ret = appendBlock(ret, new Uint8Array(data, (blockIndex-1) * blockSize, chunkSize));
            }

            ret = appendBlock(ret, patchView8);
        }

        //we're done with all the patches, add the remaining blocks
        for(;matchIndex < matchedBlockView32.length; matchIndex++)
        {
            blockIndex = matchedBlockView32[matchIndex];
            if((blockIndex * blockSize) > data.byteLength)
                chunkSize = data.byteLength % blockSize;
            else chunkSize = blockSize;
            ret = appendBlock(ret, new Uint8Array(data, (blockIndex-1) * blockSize, chunkSize));
        }

        return ret;
    }
    /*
     * parse match document
     * use hash table to store match document: because js object is hash table
     */
    function parseMatchDocument(matchDocument)
    {
        var ret = [];
        var view = new Uint32Array(matchDocument);
        var matchCount = view[0];
        var offset = 1;
        //each chunk in the document is 20 bytes long. 32 bit view indexes 4 bytes, so increment by 5.
        for(i = 0; i < matchCount;i++)
        {
            match_blockIndex = view[offset++];
            var start = view[offset++];
            var end = view[offset++];

            ret[match_blockIndex] = [start, end];
        }
        return ret;
    }

    /******** Public API ***********/
    this.createChecksumDocument = createChecksumDocument;
    // this.createPatchDocument = createPatchDocument;
    this.createMatchDocument = createMatchDocument;
    this.parseMatchDocument = parseMatchDocument;
    this.applyPatch = applyPatch;
    this.hash16_coll = 0;
};


if(((typeof require) != "undefined") &&
    ((typeof module) != "undefined") &&
    ((typeof module.exports) != "undefined"))
    module.exports = BSync;


