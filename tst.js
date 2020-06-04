console.log("hello");
console.time('test');
function sleep(){
    var now = new Date().getTime() + 1000;
    
    var timer = new Date();
    while(timer.getTime() < now){
        timer = new Date();
    }
    console.log('sleeping')
}
function aa(callback){callback();
    console.log('hello');
    
}
var first = aa(sleep)