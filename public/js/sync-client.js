/**
 * Created by xiaohe on 2016/12/9.
 * client functions for web-sync
 */

// Check for the various File API support.
if (window.File && window.FileReader && window.FileList && window.Blob) {
    // Great success! All the File APIs are supported.
    console.log("Great success! All the File APIs are supported.")
} else {
    alert('The File APIs are not fully supported in this browser.');
}

var Buffer = require('buffer').Buffer;
var lz4 = require('lz4');


var current_file = null;
var block_size =  32 * 1024;
var chunkSize  =  1024 * 1024 * 1024; // bytes

var chunk_cache = [];
var test_hash_average = 0;
var test_hash_times = 0;

var checksumStart, checksumTime;
var checksumdocSend, checksumdocACK;
var patchStart, patchTime;
var patchdocSend, patchdocACK;
var syncStart;
var traffic;
var cmprSum;
var decmprSum;

var f_compress = {
    deflate: function(data) {
        return Buffer.from(pako.deflate(data));
    },
    lz4: function(data) {
        return lz4.encode(Buffer.from(data));
    },
    none: function(data) {
        return data;
    }
};

var f_decompress = {
    deflate: function(data) {
        return pako.inflate(data).buffer;
    },
    lz4: function(data) {
        return lz4.decode(Buffer.from(data)).buffer;
    },
    none: function(data) {
        return data;
    }
};


var socket = io.connect('http://' + window.location.hostname + ':8005', {
    // setup timeout params
    pingTimeout: 20 * 30 * 1000,
    pingInterval: 20 * 25 * 1000,
    upgradeTimeout: 10 * 60 * 1000,
});

socket.on('EBL', function (req) {
    expectedBlockLength = req.EBL;
    console.log(expectedBlockLength);
    fastcdc.Init(expectedBlockLength);
    cmprSum = 0;
    decmprSum = 0;
    bdwLock.P('speed');
    startSpeedTest();
});

socket.on('checksumdocACK', function(req){
    checksumdocACK = new Date().getTime();
});

socket.on('matchdoc', function (req) {
    socket.emit('matchdocACK');
    var matchdoc = req.matchdoc;
    var cmprMethod = req.compress;

    traffic += matchdoc.byteLength;
    console.log("<<receive matchdoc of ", req.filename);

    var decmprStart = new Date().getTime();
    var fd = f_decompress[cmprMethod];
    matchdoc = fd(matchdoc);
    decmprSum += new Date().getTime() - decmprStart;

    patchStart = new Date().getTime();
    createPatchBlocks(matchdoc);
});

socket.on('patchdocACK', function(req){
    patchdocACK = new Date().getTime();
});

socket.on('SyncOver', function (req) {
    socket.emit('SyncOverACK');
    current_file = null;
    console.log('<<receive sync success');
    syncTime = new Date().getTime() - syncStart;
    $("#result").text("同步成功！时间：" + syncTime + "ms / " + traffic + " b");
    // console.info('all traffic is', traffic, 'b');
    socket.compress(false).emit('inform_time', {
        'checksumTrans': (checksumdocACK - checksumdocSend), 
        'patchTrans': (patchdocACK - patchdocSend),

        'initializeTime': (checksumStart - syncStart),
        'checksumTime': checksumTime,
        'round1Time': (checksumdocACK - checksumStart),
        'patchTime': patchTime,
        'round3Time': (patchdocACK - patchStart),

        'compressTime': cmprSum,
        'decompressTime': decmprSum,
        'syncTime': syncTime,
        'traffic': traffic
    });
    bdwLock.V();   // release the bandwidthlock
});

function appendBlock(buffer, block) {
    var tmp = new Uint8Array(buffer.byteLength + block.byteLength);
    tmp.set(new Uint8Array(buffer), 0);
    tmp.set(block, buffer.byteLength);
    return tmp.buffer;
}
/*
 * get patch blocks
 * 4 bytes - blocksize
 * 4 bytes - patch blocks size
 * for each block
 *  4 bytes - block index
 *  4 bytes - n size
 *  n bytes - file content
 */
function createPatchBlocks(matchdoc) {
    if (!current_file) {
        console.log('current file is null!');
        return;
    }
    console.log("收到了");
    var match_table = BSync.parseMatchDocument(matchdoc);
    var numChunk = Math.ceil(current_file.size/chunkSize);


    parseFile(current_file, function (type, data, start, stop) {
        var patchdoc = new ArrayBuffer(10000);
        var patchsize = 10000;
        var patchdoc32View = new Uint32Array(patchdoc);
        var patchdoc8View = new Uint8Array(patchdoc);
        var numPatch = 0;
        patchdoc32View[0] = numPatch;
        var doc_offset = 4;
        var data_offset = 0;

        var data8View = new Uint8Array(data);
        var checksumdoc = chunk_cache[0];
        var checksumView = new Uint32Array(checksumdoc);
        var blockCount = checksumView[0];
        var checkOffset = 2;
        var allocateTime = 0
        for (var i = 0; i < blockCount; i++) {
            var blockLength = checksumView[checkOffset + 1];
            if (match_table[i] != undefined) {
                data_offset += blockLength;
            } else {
                if (patchsize < doc_offset + blockLength + 4 * 2) {
                    var addLength = Math.ceil((blockLength + patchsize) / 4) * 4;
                    patchdoc = appendBlock(patchdoc, new ArrayBuffer(addLength));
                    patchdoc32View = new Uint32Array(patchdoc);
                    patchdoc8View = new Uint8Array(patchdoc);
                    patchsize += addLength;
                }

                //not match save into patch
                numPatch++;
                patchdoc32View[doc_offset / 4] = i;
                doc_offset += 4;

                patchdoc32View[doc_offset / 4] = blockLength;
                doc_offset += 4;
                var allocateStart = new Date().getTime();
                for (var j = 0; j < blockLength; j++) {
                    patchdoc8View[doc_offset] = data8View[data_offset + j];
                    doc_offset++;
                }
                allocateTime += (new Date().getTime() - allocateStart);
                data_offset += blockLength;
                //if doc_offset is not 4-times
                doc_offset = Math.ceil(doc_offset / 4) * 4;
            }
            checkOffset += 8;
        }
        console.log("allocate time:", allocateTime);
        patchdoc32View[0] = numPatch;
        patchTime = new Date().getTime() - patchStart;
        console.info(current_file.name, 'Patchdoc time is', patchTime, 'ms');
        console.log('Patchdoc from', start, 'to', stop, ':', doc_offset, current_file.size);
        patchdoc = patchdoc.slice(0, doc_offset);

        var cmprStart = new Date().getTime();
        var cmprMethod = compressSelect(patchdoc.byteLength);
        console.log("Patchdoc compress:", cmprMethod);
        var fc = f_compress[cmprMethod];
        patchdoc = fc(patchdoc);
        cmprSum += new Date().getTime() - cmprStart;

        //emit the patchdoc
        traffic += patchdoc.byteLength;

        patchdocSend = new Date().getTime();
        socket.compress(false).emit('patchdoc', {
            'filename': current_file.name, 
            'patchdoc': patchdoc,
            'numChunk': numChunk,
            'compress': cmprMethod
        });
    })

}

/*
 * parse file
 */
function parseFile(file, callback) {
    var offset = 0;
    var self = this; // we need a reference to the current object
    var chunkReaderBlock = null;

    var readEventHandler = function (evt) {
        if (evt.target.error == null) {
            var start = offset;
            offset += evt.target.result.byteLength;
            var stop = offset;
            callback('data', evt.target.result, start, stop); // callback for handling read chunk

        } else {
            console.log("Read error: " + evt.target.error);
            return;
        }
        if (offset >= file.size) {
            // console.log("Done reading file");
            return;
        }
        chunkReaderBlock(offset, chunkSize, file);
    };

    chunkReaderBlock = function (_offset, length, _file) {
        var r = new FileReader();
        var start = _offset;
        var stop = start + length;
        if (stop > _file.size) stop = _file.size;
        if (file.webkitSlice) {
            var blob = file.webkitSlice(start, stop);
        } else if (file.mozSlice) {
            var blob = file.mozSlice(start, stop);
        } else if (file.slice) {
            blob = file.slice(start, stop);
        }
        r.onloadend = readEventHandler;
        r.readAsArrayBuffer(blob);
    }

    // now let's start the read with the first block
    chunkReaderBlock(offset, chunkSize, file);
}
/*
 * load blocks from file
 * @param: block_size : bytes
 */
function load_blocks() {
    // block_size = blockSize;
    traffic = 0;
    speedTest.abort();
    bdwLock.P('sync', true);    // preemptively allocate the bandwidth lock
    $("#result").text("同步开始");
    syncStart = new Date().getTime();

    var files = document.getElementById('files').files;
    if (!files.length) {
        alert('Please select a file!');
        return;
    }
    current_file = files[0];
    var filename = current_file.name;
    socket.emit('syncStart', {
        'filename': filename
    });

    parseFile(current_file, function (type, data, start, stop) {
        checksumStart = new Date().getTime();
        checksumdoc = BSync.createChecksumDocument(data);

        chunk_cache = [checksumdoc];
        var docView = new Uint32Array(checksumdoc);

        //console.log('checksum from',start,'to',stop,':',doc_offset,"/",all_docLength/4);

        console.log('All checksum length is ', checksumdoc.byteLength);
        console.log('>>emit checksum doc', checksumdoc.byteLength);
        checksumTime = new Date().getTime() - checksumStart;
        console.log('Checksum time: ', checksumTime, 'ms');
        
        var cmprStart = new Date().getTime();
        var cmprMethod = compressSelect(checksumdoc.byteLength);
        console.log("Checksumdoc compress:", cmprMethod);
        var fc = f_compress[cmprMethod];
        checksumdoc = fc(checksumdoc);
        cmprSum += new Date().getTime() - cmprStart;
        
        traffic += checksumdoc.byteLength;

        checksumdocSend = new Date().getTime();
        socket.compress(false).emit('checksumdoc', {
            'filename': filename, 
            'checksumdoc': checksumdoc,
            'compress': cmprMethod
        }); 

        // test_hash_average += checksumTime;
        // test_hash_times ++;
        // console.log('average time is',test_hash_average/test_hash_times,'ms');
    });
}


// Test network environment at regular intervals
var intvl = setInterval(() => {
    while(bdwLock.P('speed')) {
        // bandwidth is occupied by another module
        var timer = setTimeout(() => {}, 500);
        clearTimeout(timer);
    }
    startSpeedTest();
}, 60 * 1000);
clearInterval(intvl);
