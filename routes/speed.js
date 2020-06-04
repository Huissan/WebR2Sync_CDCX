var express = require('express');
var router = express.Router();

router.all('/', function(req, res, next) {
    res.writeHead(200, {
        'Content-Type': 'text/plain', 
        'Pragma': 'no-cache',
        'Connection': 'keep-alive'
    });
    res.end('OK');
});

router.post('/empty.txt', function(req, res, next) {
    res.writeHead(200, {
        'Content-Type': 'text/plain', 
        'Pragma': 'no-cache',
        'Connection': 'keep-alive'
    });
    res.end('OK');
});

module.exports = router;