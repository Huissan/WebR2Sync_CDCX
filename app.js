var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var fs = require("fs");
var OSS = require('ali-oss');
var co = require('co');
var util = require('util');
var  argv = require('yargs').argv
var Buffer = require('buffer').Buffer;
const lz4 = require('lz4');
const zlib = require('zlib');
const pako = require('pako');

// var logPath = '../fastcdc.log';
// var logFile = fs.createWriteStream(logPath, { flags: 'a' });
//
// console.log = function () {
//     logFile.write(util.format.apply(null, arguments) + '\n');
//     //process.stdout.write(util.format.apply(null, arguments) + '\n');
// }

var client = new OSS({
    region: 'oss-cn-shanghai',
    accessKeyId: 'LTAIiTUIWMffMbLD',
    accessKeySecret: 'Ykcf2pSp3uTP9IKCqqRHzJXMgDwQzC',
    bucket: 'xiaohe-websync',
    internal: true,
    endpoint: 'oss-cn-shanghai-internal.aliyuncs.com',
});

var index = require('./routes/index');
var users = require('./routes/users');
var speed = require('./routes/speed');
var BSync = require('./public/js/bit-sync');
var fastcdc = require('./public/js/fastcdc');

var arrayBufferToBuffer = require('arraybuffer-to-buffer');

var stream = require('stream');
var streamToBuffer = require('stream-to-buffer');


var basePath = __dirname + "/upload/";

var app = express();

var server = require('http').Server(app);
var io = require('socket.io')(server, {
    permessageDeflate: false,
    // setup timeout params
    pingTimeout: 10 * 60 * 1000,
    pingInterval: 10 * 55 * 1000,
    upgradeTimeout: 15 * 60 * 1000,
});

var direct_stream = false;
const mode = 'test-modify'; // formal, test-full, test-modify


server.listen(8005);

/* match_cache = [filename1:(1234 bytes,matchdoc],
    }
 */
var match_cache = {};
var patch_cache = {};
var patch_num_cache = {};

var origin_file_cache = {};

var matchdocSend, matchdocACK;
var syncOverSend, syncOverACK;
var matchStart, matchTime;
var combine_fp_time;
var filename;
var cmprSum, decmprSum;


// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', index);
app.use('/users', users);
app.use('/speed', speed);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// error handler
app.use(function (err, req, res, next) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    // render the error page
    res.status(err.status || 500);
    res.render('error');
});

var expectedBlockLength = 'Mask_8KB';
fastcdc.Init(expectedBlockLength);

var f_compress =  {
    deflate: function(data) {
        return zlib.deflateSync(data);
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
        return zlib.inflateSync(data);
    },
    lz4: function(data) {
        return lz4.decode(Buffer.from(data));
    },
    none: function(data) {
        return data;
    }
};

io.on('connection', function (socket) {
    socket.emit('EBL', {'EBL': expectedBlockLength});

    socket.on('syncStart', function(req) {
        // Used for modified-sync testing
        cmprSum = 0;
        decmprSum = 0;
        if (mode == 'test-modify') {
            var src = __dirname + '/upload/data_10M.txt';
            var dst = __dirname + '/upload/data.txt';
            fs.createReadStream(src).pipe(fs.createWriteStream(dst));
        }
    });

    socket.on('checksumdoc', function (req) {
        socket.emit('checksumdocACK');
        filename = req.filename;
        var checksumdoc = req.checksumdoc;
        var cmprMethod = req.compress;

        var decmprStart = new Date().getTime();
        var fd = f_decompress[cmprMethod];
        checksumdoc = fd(checksumdoc);
        decmprSum += new Date().getTime() - decmprStart;

        console.log('Generate matchdoc of file: ', filename);
        console.log('Checksumdoc traffic:', checksumdoc.length);
        filePath = basePath + filename;
        matchStart = new Date().getTime();

        checksumdocView = new Uint8Array(checksumdoc);
        checksumdocBuffer = checksumdocView.buffer;

        fs.stat(filePath, function (err, stat) {
            if (err == null) {
                getFileData(filePath, function (data) {
                    origin_file_cache[filename] = data;
                    var matchret = BSync.createMatchDocument(checksumdocBuffer, data);
                    var matchdoc = matchret[0];
                    var filebytelength = matchret[1];
                    var numBlocks = matchret[2];
                    match_cache[filename] = [filebytelength, numBlocks, matchdoc];
                    
                    var cmprStart = new Date().getTime();
                    var fc = f_compress[cmprMethod];
                    matchdoc = fc(matchdoc);
                    cmprSum += new Date().getTime() - cmprStart;
                    
                    matchTime = new Date().getTime() - matchStart;
                    console.log('Matchdoc traffic: ', matchdoc.byteLength);

                    matchdocSend = new Date().getTime();
                    socket.emit('matchdoc', {
                        'filename': filename,
                        'matchdoc': matchdoc,
                        'compress': cmprMethod
                    });
                });
            } else {
                origin_file_cache[filename] = new ArrayBuffer(0);
                var matchret = BSync.createMatchDocument(checksumdocBuffer, new ArrayBuffer(0));
                var matchdoc = matchret[0];
                var filebytelength = matchret[1];
                var numBlocks = matchret[2];
                match_cache[filename] = [filebytelength, numBlocks, matchdoc];
                
                var cmprStart = new Date().getTime();
                var fc = f_compress[cmprMethod];
                matchdoc = fc(matchdoc);
                cmprSum += new Date().getTime() - cmprStart;

                matchTime = new Date().getTime() - matchStart;
                console.log('Matchdoc traffic: ', matchdoc.byteLength);

                matchdocSend = new Date().getTime();
                socket.emit('matchdoc', {
                    'filename': filename,
                    'matchdoc': matchdoc,
                    'compress': cmprMethod
                });
            }
        });
    });

    socket.on('matchdocACK', function(req){
        matchdocACK = new Date().getTime();
    });

    socket.on('patchdoc', function (req) {
        socket.emit('patchdocACK');
        filename = req.filename;
        var patchdoc = req.patchdoc;
        var cmprMethod = req.compress;

        var combineStart = new Date().getTime();
        console.log('Patchdoc of file: ', filename);
        console.log('Patchdoc traffic:', patchdoc.length);

        var decmprStart = new Date().getTime();
        var fd = f_decompress[cmprMethod];
        patchdoc = fd(patchdoc);
        decmprSum += new Date().getTime() - decmprStart;

        //todo combine patch doc and matched blocks
        var matchdoc = match_cache[filename][2];
        var numBlocks = match_cache[filename][1];
        var filebytelength = match_cache[filename][0];
        var matchtable = BSync.parseMatchDocument(matchdoc);
        filePath = basePath + filename;
        var newFilebuffer = new ArrayBuffer(filebytelength);
        var file8View = new Uint8Array(newFilebuffer);
        if (!patch_cache[filename]) {
            patch_cache[filename] = {};
            patch_num_cache[filename] = 0;
        }

        parsePatchDoc(filename, patchdoc, function () {
            if (patch_num_cache[filename] == req.numChunk) {
                data = origin_file_cache[filename];
                var data8View = new Uint8Array(data);
                var dataoffset = 0;
                for (i = 0; i < numBlocks; i++) {
                    //i is blockindex
                    if (matchtable[i] != undefined) {
                        var start = matchtable[i][0];
                        var end = matchtable[i][1];

                        file8View.set(data8View.slice(start, end), dataoffset);
                        dataoffset += (end - start);
                    } else {
                        blockcontent = patch_cache[filename][i];
                        block8View = new Uint8Array(blockcontent);
                        // for(j = 0; j < blockcontent.byteLength;j++){
                        //     file8View[dataoffset++] = block8View[j];
                        // }
                        file8View.set(block8View, dataoffset);
                        dataoffset += block8View.length;
                    }
                }
                fs.writeFile(filePath, arrayBufferToBuffer(newFilebuffer), function (err) {
                    if (err) {
                        throw 'error writing file: ' + err;
                    } else {
                        combine_fp_time = new Date().getTime() - combineStart;
                        console.log('File write over~');
                        console.log("Combine fp:" + combine_fp_time);
                        BlockSyncStatus = 'success';
                        syncOverSend = new Date().getTime();
                        socket.emit('SyncOver', {'BlockSyncStatus': BlockSyncStatus});

                        //console.log('冲突:',BSync.hash16_coll);
                    }
                    //reset cache
                    delete match_cache[filename]
                    delete patch_num_cache[filename]
                    delete patch_cache[filename]
                });
            }
        });
    });

    socket.on('SyncOverACK', function(req){
        syncOverACK = new Date().getTime();
        if (mode == 'test-full') {
            // Use for full-sync testing
            fs.unlink(__dirname + '/upload/' + filename, (err) => {
                if (err) {
                    console.log(err);
                }
            });
        }
    });

    socket.on('inform_time', function (req) {
        var matchdocTrans = matchdocACK - matchdocSend;
        var syncOverTrans = syncOverACK - syncOverSend;
        var netTime = req.checksumTrans + matchdocTrans
                    + req.patchTrans + syncOverTrans;
        cmprSum += req.compressTime;
        decmprSum += req.decompressTime;
        
        console.log("-------------- Network Delay --------------");
        console.log("Trans - Checksumdoc: ", req.checksumTrans);
        console.log("Trans - Matchdoc: ", matchdocTrans);
        console.log("Trans - Patchdoc: ", req.patchTrans);
        console.log("Trans - SyncOver: ", syncOverTrans);
        console.log("Total trans time:", netTime);

        console.log("----------- Stage Consumption -------------");
        console.log("Initialization: ", req.initializeTime);
        console.log("Checksum time:", req.checksumTime);
        console.log("Match time:", matchTime);
        console.log("Patch time: ", req.patchTime);

        console.log("---------------- Sum Ups -----------------");
        console.log("Total compress time:", cmprSum);
        console.log("Total decompress time:", decmprSum);
        console.log("Total traffic:", req.traffic);
        console.log("Total sync time:", req.syncTime);
        console.log("------------------------------------------");

        // Data recording
        paramList = [
            netTime, req.checksumTime, matchTime, req.patchTime, 
            combine_fp_time, cmprSum, decmprSum, req.syncTime
        ];
        fs.writeFile('synctime.txt', paramList.join('\t') + '\n', {flag: 'a+'}, (err, data) => {
            if (err) {
                console.log(err);
            } else {
                console.log('Data record over~');
            }
        });

    });
});

function parsePatchDoc(filename, patchdoc, callback) {
    var patchdoc8View = new Uint8Array(patchdoc);
    var patchdoc32View = new Uint32Array(patchdoc8View.buffer);
    var patch_offset = 1;
    var numPatch = patchdoc32View[0];
    // var patchtable = {};
    for (i = 0; i < numPatch; i++) {
        var blockindex = patchdoc32View[patch_offset];
        patch_offset++;
        var currentblocksize = patchdoc32View[patch_offset];
        patch_offset++;
        var filecontent = new ArrayBuffer(currentblocksize);
        var file8View = new Uint8Array(filecontent);
        for (j = 0; j < currentblocksize; j++) {
            file8View[j] = patchdoc8View[patch_offset * 4 + j];
        }
        patch_offset += Math.ceil(j / 4);
        patch_cache[filename][blockindex] = filecontent;
    }
    patch_num_cache[filename]++;
    callback();
}

// 在服务器端读取文件
function getFileData(file, callback) {
    fs.readFile(file, function (err, data) {
        if (err) {
            // console.error("Error getting file data: " + err);
        }
        callback(data);
    });
}


module.exports = app;
