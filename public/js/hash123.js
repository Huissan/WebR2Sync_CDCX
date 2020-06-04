var MMHASH3;
if(!MMHASH3){
    MMHASH3 = require('./murmurhash3');
    SipHash = require('./siphash');
}
var sha1;
if(!sha1){
    sha1 = require('./sha1');
}


var MOD_ADLER = 65521;
var hash123 = new function()
{
    this.md5 = function(message,seed,offset,end) {
        message = message.slice(offset,end);
        // Convert to byte array
        if (message.constructor == String) message = UTF8.stringToBytes(message);
        /* else, assume byte array already */
        var bytesToWords = function (bytes) {
            for (var words = [], i = 0, b = 0; i < bytes.length; i++, b += 8)
                words[b >>> 5] |= (bytes[i] & 0xFF) << (24 - b % 32);
            return words;
        }

        var m = bytesToWords(message),
            l = message.length * 8,
            a =  1732584193,
            b = -271733879,
            c = -1732584194,
            d =  271733878;

        // Swap endian
        for (var i = 0; i < m.length; i++) {
            m[i] = ((m[i] <<  8) | (m[i] >>> 24)) & 0x00FF00FF |
                ((m[i] << 24) | (m[i] >>>  8)) & 0xFF00FF00;
        }

        // Padding
        m[l >>> 5] |= 0x80 << (l % 32);
        m[(((l + 64) >>> 9) << 4) + 14] = l;

        // Method shortcuts
        // Auxiliary functions
        var FF  = function (a, b, c, d, x, s, t) {
            var n = a + (b & c | ~b & d) + (x >>> 0) + t;
            return ((n << s) | (n >>> (32 - s))) + b;
        };
        var GG  = function (a, b, c, d, x, s, t) {
            var n = a + (b & d | c & ~d) + (x >>> 0) + t;
            return ((n << s) | (n >>> (32 - s))) + b;
        };
        var HH  = function (a, b, c, d, x, s, t) {
            var n = a + (b ^ c ^ d) + (x >>> 0) + t;
            return ((n << s) | (n >>> (32 - s))) + b;
        };
        var II  = function (a, b, c, d, x, s, t) {
            var n = a + (c ^ (b | ~d)) + (x >>> 0) + t;
            return ((n << s) | (n >>> (32 - s))) + b;
        };

        for (var i = 0; i < m.length; i += 16) {

            var aa = a,
                bb = b,
                cc = c,
                dd = d;

            a = FF(a, b, c, d, m[i+ 0],  7, -680876936);
            d = FF(d, a, b, c, m[i+ 1], 12, -389564586);
            c = FF(c, d, a, b, m[i+ 2], 17,  606105819);
            b = FF(b, c, d, a, m[i+ 3], 22, -1044525330);
            a = FF(a, b, c, d, m[i+ 4],  7, -176418897);
            d = FF(d, a, b, c, m[i+ 5], 12,  1200080426);
            c = FF(c, d, a, b, m[i+ 6], 17, -1473231341);
            b = FF(b, c, d, a, m[i+ 7], 22, -45705983);
            a = FF(a, b, c, d, m[i+ 8],  7,  1770035416);
            d = FF(d, a, b, c, m[i+ 9], 12, -1958414417);
            c = FF(c, d, a, b, m[i+10], 17, -42063);
            b = FF(b, c, d, a, m[i+11], 22, -1990404162);
            a = FF(a, b, c, d, m[i+12],  7,  1804603682);
            d = FF(d, a, b, c, m[i+13], 12, -40341101);
            c = FF(c, d, a, b, m[i+14], 17, -1502002290);
            b = FF(b, c, d, a, m[i+15], 22,  1236535329);

            a = GG(a, b, c, d, m[i+ 1],  5, -165796510);
            d = GG(d, a, b, c, m[i+ 6],  9, -1069501632);
            c = GG(c, d, a, b, m[i+11], 14,  643717713);
            b = GG(b, c, d, a, m[i+ 0], 20, -373897302);
            a = GG(a, b, c, d, m[i+ 5],  5, -701558691);
            d = GG(d, a, b, c, m[i+10],  9,  38016083);
            c = GG(c, d, a, b, m[i+15], 14, -660478335);
            b = GG(b, c, d, a, m[i+ 4], 20, -405537848);
            a = GG(a, b, c, d, m[i+ 9],  5,  568446438);
            d = GG(d, a, b, c, m[i+14],  9, -1019803690);
            c = GG(c, d, a, b, m[i+ 3], 14, -187363961);
            b = GG(b, c, d, a, m[i+ 8], 20,  1163531501);
            a = GG(a, b, c, d, m[i+13],  5, -1444681467);
            d = GG(d, a, b, c, m[i+ 2],  9, -51403784);
            c = GG(c, d, a, b, m[i+ 7], 14,  1735328473);
            b = GG(b, c, d, a, m[i+12], 20, -1926607734);

            a = HH(a, b, c, d, m[i+ 5],  4, -378558);
            d = HH(d, a, b, c, m[i+ 8], 11, -2022574463);
            c = HH(c, d, a, b, m[i+11], 16,  1839030562);
            b = HH(b, c, d, a, m[i+14], 23, -35309556);
            a = HH(a, b, c, d, m[i+ 1],  4, -1530992060);
            d = HH(d, a, b, c, m[i+ 4], 11,  1272893353);
            c = HH(c, d, a, b, m[i+ 7], 16, -155497632);
            b = HH(b, c, d, a, m[i+10], 23, -1094730640);
            a = HH(a, b, c, d, m[i+13],  4,  681279174);
            d = HH(d, a, b, c, m[i+ 0], 11, -358537222);
            c = HH(c, d, a, b, m[i+ 3], 16, -722521979);
            b = HH(b, c, d, a, m[i+ 6], 23,  76029189);
            a = HH(a, b, c, d, m[i+ 9],  4, -640364487);
            d = HH(d, a, b, c, m[i+12], 11, -421815835);
            c = HH(c, d, a, b, m[i+15], 16,  530742520);
            b = HH(b, c, d, a, m[i+ 2], 23, -995338651);

            a = II(a, b, c, d, m[i+ 0],  6, -198630844);
            d = II(d, a, b, c, m[i+ 7], 10,  1126891415);
            c = II(c, d, a, b, m[i+14], 15, -1416354905);
            b = II(b, c, d, a, m[i+ 5], 21, -57434055);
            a = II(a, b, c, d, m[i+12],  6,  1700485571);
            d = II(d, a, b, c, m[i+ 3], 10, -1894986606);
            c = II(c, d, a, b, m[i+10], 15, -1051523);
            b = II(b, c, d, a, m[i+ 1], 21, -2054922799);
            a = II(a, b, c, d, m[i+ 8],  6,  1873313359);
            d = II(d, a, b, c, m[i+15], 10, -30611744);
            c = II(c, d, a, b, m[i+ 6], 15, -1560198380);
            b = II(b, c, d, a, m[i+13], 21,  1309151649);
            a = II(a, b, c, d, m[i+ 4],  6, -145523070);
            d = II(d, a, b, c, m[i+11], 10, -1120210379);
            c = II(c, d, a, b, m[i+ 2], 15,  718787259);
            b = II(b, c, d, a, m[i+ 9], 21, -343485551);

            a = (a + aa) >>> 0;
            b = (b + bb) >>> 0;
            c = (c + cc) >>> 0;
            d = (d + dd) >>> 0;

        }
        var rotl = function (n, b) {
            return (n << b) | (n >>> (32 - b));
        }
        var endian = function (n) {

            // If number given, swap endian
            if (n.constructor == Number) {
                return rotl(n,  8) & 0x00FF00FF |
                    rotl(n, 24) & 0xFF00FF00;
            }

            // Else, assume array and swap all items
            for (var i = 0; i < n.length; i++)
                n[i] = endian(n[i]);
            return n;

        };
        return new Uint32Array([a, b, c, d]);

    }

    var md5_1 = MMHASH3.lib.x86.hash128_arraybuffer;

    this.md5_2 = function (message,seed,offset,end) {
        var m = message.slice(offset,end);
        return SipHash.lib.hash(m);
    }
    this.sha1 = function(message,seed,offset,end){
        var m = message.slice(offset, end);
        return sha1.arrayBuffer(m);
    }

    /**
     * Create a fast 16 bit hash of a 32bit number. Just using a simple mod 2^16 for this for now.
     * TO: Evaluate the distribution of adler32 to see if simple modulus is appropriate as a hashing function, or wheter 2^16 should be replaced with a prime
     */
    this.hash16 = function(i)
    {
        // return num % 65536;
        var p =  1867;
        return ((i>>16)& 0xffff ^ ((i&0xffff) * p)) & 0xffff;
    }

    /**
     * Create a 32 bit checksum for the block, based on the adler-32 checksum, with M as 2^16
     * Used to feed the rollingChecksum function, so returns the broken out pieces that are required for fast calc (since there's no reason to do pointless
     * bit manipulation, we just cache the parts, like {a: ..., b: ..., checksum: ... }.
     *
     * Offset is the start, and end is the last byte for the block to be calculated. end - offset should equal the blockSize - 1
     *
     * Data should be a Uint8Array
     *
     * TDO: according to wikipedia, the zlib compression library has a much more efficient implementation of adler. To speed this up, it might be worth investigating whether that can be used here.
     */
    this.adler32 = function(offset, end, data)
    {
        var a = 1, b= 0;

        //adjust the end to make sure we don't exceed the extents of the data.
        if(end >= data.length)
            end = data.length;

        for(i=offset; i < end; i++)
        {
            a += data[i];
            b += a;
            a %= MOD_ADLER;
            b %= MOD_ADLER;
        }
        return {a: a>>>0, b: b>>>0, checksum: ((b << 16) | a) >>>0};

    }

    /**
     * Performs a very fast rolling checksum for incremental searching using Tridgell's modification of adler-32 for rolling checksum
     * Returns an object suitable for use in additional calls to rollingChecksum, same as the adler32 function. This needs to be called with an offset of at least 1!
     * It is the responsibility of the called to make sure we don't exceed the bounds of the data, i.e. end MUST be less than data.length
     */
    function rollingChecksum(adlerInfo, offset, end, data)
    {
        newdata = 0;
        if(end < data.length)
            newdata = data[end];
        else
            end = data.length-1;
        var temp = data[offset - 1]; //this is the first byte used in the previous iteration
        var a = ((adlerInfo.a - temp + newdata) % MOD_ADLER + MOD_ADLER)%MOD_ADLER;
        var b = ((adlerInfo.b - ((end - offset + 1) * temp) + a - 1) % MOD_ADLER + MOD_ADLER)%MOD_ADLER;
        return {a: a>>>0, b: b>>>0, checksum: ((b << 16) | a)>>>0};
    }

    /**
     * This is a function born of annoyance. You can't create a Uint32Array at a non 4 byte boundary. So this is necessary to read
     * a 32bit int from an arbitrary location. Lame.
     *
     * BTW: This assumes everything to be little endian.
     */
    function readInt32(uint8View, offset)
    {
        return (uint8View[offset] | uint8View[++offset] << 8 | uint8View[++offset] << 16 | uint8View[++offset] << 24) >>> 0;
    }
}

if(((typeof require) != "undefined") &&
    ((typeof module) != "undefined") &&
    ((typeof module.exports) != "undefined"))
    module.exports = hash123;

