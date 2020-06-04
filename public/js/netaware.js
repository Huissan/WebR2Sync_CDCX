// Network-aware compress selection

// Simple bandwidth lock implementation
// Allocate for full bandwidth
// Can be preemptively allocated
var bdwLock = {
    user: null,
    status: 'free',
    P: function(user, preempt = false) {
        if (preempt || this.status === 'free') {
            this.user = user;
            this.status = 'busy';
            return null;
        }
        return this.user;
    },
    V: function() {
        this.user = null
        this.status = 'free'
        return true;
    }
};

var compressParams = {
    deflate: [1.105e-4, 497.7632],
    lz4: [3.5544e-6, 38.669]
};

var decompressParams = {
    deflate: [1.2554e-5, 41.0822],
    lz4: [1.7623e-6, 1.9465]
};

var compressRate = {
    deflate: 0.38,
    lz4: 0.6
}


// Bandwidth test module
var speedTest = new Speedtest();

speedTest.setParameter("test_order","U");
speedTest.setParameter("time_auto", true);
speedTest.setParameter("url_ul","speed/empty.txt");
speedTest.setParameter("time_ul_max", 10);

speedTest.onupdate = function(data) {
    // callback to update speed results
    if (data.testState === 3 && data.ulStatus.length > 0) {
        var ul = parseFloat(data.ulStatus);
        if (ul != NaN) {
            ulArr.push(ul);
        }
    }
}

speedTest.onend = function(aborted) {
    bdwLock.V();    // release the bandwidth lock
    if(aborted){
        console.log("test aborted!");
    }
    if (ulArr.length > 0) {
        var speedSum = 0;
        ulArr.forEach(speed => {
            speedSum += speed;
        });
        networkSpeed = speedSum / ulArr.length;
        ulArr = []; // reset ulArr for next testing
        $('#speed').text("当前带宽: " + networkSpeed.toFixed(2) + " Mbps");
    }
}


var ulArr = [];
var dlArr = [];
var networkSpeed;

function startSpeedTest() {
    speedTest.start();
    bdwLock.P('speed');
}


// var threshold = 1024 * 1024;
function compressSelect(fileSize) {
    let networkSpeed_Byte = 1e6 * networkSpeed / 8; // divide 8 for bits to bytes
    var compensateTime = {
        none: 1000 * fileSize / networkSpeed_Byte   // millisecond
    };
    var cmprMethod = 'none';
    var min_time = compensateTime[cmprMethod];

    for (let cmpr in compressParams) {
        // Compensate time: time prediction by linear approximation
        let a_c = compressParams[cmpr][0], b_c = compressParams[cmpr][1];
        let a_d = decompressParams[cmpr][0], b_d = decompressParams[cmpr][1];
        let t_c = (a_c * fileSize + b_c), t_d = (a_d * fileSize + b_d); // milliseconds
        let cmprTransTime = 1000 * fileSize * compressRate[cmpr] / networkSpeed_Byte;

        compensateTime[cmpr] = (t_c + t_d) + cmprTransTime;
        if (compensateTime[cmpr] < min_time) {
            cmprMethod = cmpr;
            min_time = compensateTime[cmpr];
        }
    }
    console.log(compensateTime);
    return cmprMethod;
}