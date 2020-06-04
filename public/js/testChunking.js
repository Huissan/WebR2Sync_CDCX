var fs = require('fs');
var rabin = require('rabinjs');
var fastcdc = require('./fastcdc.js');
const {performance} = require('perf_hooks');

// var data_path = 'C:/Users/MrMar/Desktop/dataSet/data_10M.txt';

// var rabin_path = 'C:/Users/MrMar/Desktop/dataSet/Rabin_Chunking.txt';
var data_path = '/home/jw/dataset/data.txt';
var rabin_path = '/home/jw/dataset/Rabin_Chunking_2.txt';
var rabin_file = fs.createWriteStream(rabin_path);
rabin_file.on('error', function (err) {
	console.log('Writing errors:' + err + 'in RABIN');
});

// var gear_path = 'C:/Users/MrMar/Desktop/dataSet/Fast_Chunking.txt';
// var gear_file = fs.createWriteStream(gear_path);
// gear_file.on('error', function (err) {
// 	console.log('Writing errors:' + err + 'in GEAR');
// });

var opts = {
	// polynomial: 1, 
	min: 2 * 1024,
	max: 32 * 1024,
	avgBits: 13
};

var rabin_cnt = 0
var timer_rabin = performance.now();
var listOfRabinChunkSize = [];
fs.createReadStream(data_path).pipe(rabin(opts))
	.on('data', function (d) {
		var end = rabin_cnt + d.length;
		var s = '[start: ' + rabin_cnt + ' end: ' + end + ' length: ' + d.length + ']';
		listOfRabinChunkSize.push(s);
		rabin_cnt = end;
	})
	.on('end', function (d) {
		console.log('RABIN - Chunking time: ', performance.now() - timer_rabin);
		console.log('RABIN - Total chunks: ', listOfRabinChunkSize.length);
		listOfRabinChunkSize.forEach(function (e) {
			rabin_file.write(e + '\n');
		});
		rabin_file.end();
	});


// var listOfGearChunkSize = [];
// timer_gear = performance.now();
// var s_data = fs.readFileSync(data_path);
// var dataView = new Uint8Array(s_data);

// fastcdc.Init('Mask_8KB');
// var start = 0;
// for (; ;) {
// 	if(start >= dataView.length)
//         break;
// 	end = fastcdc.ChunkData(dataView, start, dataView.length);
// 	listOfGearChunkSize.push(end - start);
// 	start = end;
// }
// console.log('FAST - Chunking time: ', performance.now() - timer_gear);
// console.log('FAST - Total chunks: ' + listOfGearChunkSize.length);

// listOfGearChunkSize.forEach(function (e) {
// 	gear_file.write(e + '\n');
// });
// gear_file.end();