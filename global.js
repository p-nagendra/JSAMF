// MUST be from same domain. Firefox 'preflights' data from other URLS with OPTIONS
var url = "/gateway.php";
var service;



// VOs here.
function ThumbnailVO()
{
}

// encode the hex to base 64 image
function _hexTob64(hex)
{
    //var hex = this.thumbnail.data;
    //if(!hex) return '';
    var b64array = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
    var outstr = '';

    // every three hex numbers, encode four Base64 characters
    for ( i = 0; i < hex.length; i+=3) {
        var c1 = hex.charCodeAt(i) & 0xFF;
        var c2 = hex.charCodeAt(i+1) & 0xFF;
        var c3 = hex.charCodeAt(i+2) & 0xFF;
        var n1 = c1 >> 2;
        var n2 = ((c1 << 4) & 48) + ((c2 & 240) >> 4);
        var n3 = ((c2 << 2) & 60) + ((c3 >> 6) & 3);
        var n4 = c3 & 63;
        n1 = n1 & 63;
        n2 = n2 & 63;
        n3 = n3 & 63;
        n4 = n4 & 63;
        outstr += b64array.charAt(n1) + b64array.charAt(n2);
        outstr += (hex.length <= i+1) ? '=' : b64array.charAt(n3);
        outstr += (hex.length <= i+2) ? '=' : b64array.charAt(n4);
    }
    return outstr;
}


function CommentCountVO()
{
}
function CommentVO()
{
}
function DrawingVO()
{
    this.commentCount = new Integer();
    this.penStrokes = new Array();
    this.title = "";
    this.serverinfo = null;//???
    this.name = "";
    this.time = Number.NaN;
    this.id = 0;
}
function _addLine (d,sx,sy,ex,ey)
{
    var line = new LineVO();
    var drawing = document.getElementById("Drawing");
    line.startx.data = sx / drawing.width * dsp.max16Bit;//cords are actually precentages
    line.starty.data = sy / drawing.height * dsp.max16Bit;
    line.endx.data = ex / drawing.width * dsp.max16Bit;
    line.endy.data = ey / drawing.height * dsp.max16Bit;
    d.penStrokes.push(line);
}
function LineVO()
{
    this.startx = new Integer();
    this.starty = new Integer();
    this.endx = new Integer();
    this.endy = new Integer();
    this.thickness = new Integer();
    this.thickness.data = 1;
}
function ThumbnailVO()
{
}








function loopResult(l) {
    var gallery = document.getElementById("Gallery");
    for (var i = 0; i < l.length; i ++) {
        if (l[i] instanceof ThumbnailVO) {
            var str = _hexTob64(l[i].thumbnail.data);
            var thmb = ('<div class="thumbnail"><a href="#">');
            thmb += '<img alt="Embedded Image" src="data:image/png;base64,';
            thmb +=  str + '"/></a><h4>' + l[i].id + '</h4></div>';

            gallery.innerHTML += thmb;
        } else if (l[i] instanceof DrawingVO) {
            alert('herE?') ;
        } else {
            console.log(l[i]);
        }
    }
    document.close();
}
function getDocHeight() {
    var D = document;
    return Math.max(
        Math.max(D.body.scrollHeight, D.documentElement.scrollHeight),
        Math.max(D.body.offsetHeight, D.documentElement.offsetHeight),
        Math.max(D.body.clientHeight, D.documentElement.clientHeight)
    );
}
function isOnBottom() {
    var totalHeight, currentScroll, visibleHeight;
    var st = document.documentElement.scrollTop;
    currentScroll = st ? st : document.body.scrollTop;
    
    totalHeight = getDocHeight();
    visibleHeight = document.documentElement.clientHeight;

    return (totalHeight <= currentScroll + visibleHeight);
}


var gallery_page_number = 0;
var flashgateway;

dsp  = {
    currentmode: 0,
    currentDrawing: null,
    max16Bit: 65535
};


dsp.currentMode = {
    gallery: 0,
    drawing: 1,
    viewing: 2
}
dsp.onscroll = function  () {
    if(dsp.currentmode == dsp.currentMode.gallery) {
        if (isOnBottom() && gallery_page_number < 3) {
            service.getGallery(++gallery_page_number);
        }
    }
}
dsp.setmode = function (newModeType) {
    dsp.currentmode = newModeType;
    var submitButton = document.getElementById("Submit");
    var galleryButton = document.getElementById("View");
    var commentButton = document.getElementById("Comment");
    //var drawingCanvas = document.getElementById("Drawing");
    var drawingConatainer = document.getElementById("DrawingContainer");
    var message = document.getElementById("Message");

    
    // looing at gallery
    if(dsp.currentmode == dsp.currentMode.gallery) {
        document.getElementById("Gallery").innerHTML = '';
        gallery_page_number = 0;
        service.getGallery(gallery_page_number);
        galleryButton.style.display = 'none';
        drawingConatainer.style.display = 'none';
        commentButton.style.display = 'none';
        submitButton.innerHTML = "Start Drawing";
        message.innerHTML = '';
    }

    // drawing
    if(dsp.currentmode == dsp.currentMode.drawing) {
        document.getElementById("Gallery").innerHTML = '';
        galleryButton.style.display = '';
        drawingConatainer.style.display = '';
        commentButton.style.display = 'none';
        submitButton.innerHTML = "Submit Drawing";
        message.innerHTML = "Draw a sketch then press 'Submit Drawing' to swap with a strangers";
        dsp.currentDrawing = new DrawingVO();
    }
    
    // vewing another cunts drawing
    if(dsp.currentmode == dsp.currentMode.viewing) {
        commentButton.style.display = '';
    }
}
dsp.clickSubmit = function () {
    if(dsp.currentmode != dsp.currentMode.drawing) {
        dsp.setmode(dsp.currentMode.drawing);
    } else {
        service.setDrawing(dsp.currentDrawing);
        // submit your drawing
    }
}
dsp.clickView = function () {
    dsp.setmode(dsp.currentMode.gallery);
}
dsp.clickFlash = function () {
    window.location.href = "flash/";
}
dsp.clickComment = function () {
    //dsp.setmode(dsp.currentMode.gallery);
}

//
ev_canvas = function(ev) {
    if (ev.layerX || ev.layerX == 0) { // Firefox
        ev._x = ev.layerX;
        ev._y = ev.layerY;
    } else if (ev.offsetX || ev.offsetX == 0) { // Opera
        ev._x = ev.offsetX;
        ev._y = ev.offsetY;
    }

    // Call the event handler of the tool.
    var func = tool[ev.type];
    if (func) {
        func(ev);
    }
}

tool_pencil = function  () {
    var tool = this;
    this.started = false;
    context = document.getElementById('Drawing').getContext('2d');
    var startx, starty, endx, endy;

    // This is called when you start holding down the mouse button.
    // This starts the pencil drawing.
    this.mousedown = function (ev) {
        context.beginPath();
        context.moveTo(ev._x, ev._y);
        tool.started = true;
        startx = ev._x;
        starty = ev._y;
    };

    // This function is called every time you move the mouse. Obviously, it only
    // draws if the tool.started state is set to true (when you are holding down
    // the mouse button).
    this.mousemove = function (ev) {
        if (tool.started) {
            endx = startx;
            endy = starty;
            context.lineTo(ev._x, ev._y);
            startx = ev._x;
            starty = ev._y;
            _addLine(dsp.currentDrawing, startx, starty, endx, endy);
            context.stroke();
        }
    };

    // This is called when you release the mouse button.
    this.mouseup = function (ev) {
        if (tool.started) {
            document.getElementById("Message").innerHTML = "Use Z and X to undo/redo.";
            tool.mousemove(ev);
            tool.started = false;
        }
    };
}

function resize() {
    if(dsp.currentmode == dsp.currentMode.gallery) return;
    
    var drawing = document.getElementById('Drawing');
    var mwidth = getCanvasContainerSize()[0];
    var mheight = getCanvasContainerSize()[1];
    
    var aspectRatio = .75;
    var fakeheight = mheight / aspectRatio;
    var newwidth, newheight;

    if (fakeheight < mwidth) {
        newwidth = mheight / aspectRatio;
        newheight = mheight;
    } else {
        newwidth = mwidth;
        newheight = mwidth * aspectRatio;
    }

    drawing.width = newwidth;
    drawing.height = newheight;
    var lastx, lasty;

    for (var i = 0; i < dsp.currentDrawing.penStrokes.length; i++) {
        var l = dsp.currentDrawing.penStrokes[i];
        if (i == 0) {
            context.beginPath();
            context.moveTo(l.startx.data / dsp.max16Bit * drawing.width, l.starty.data / dsp.max16Bit * drawing.height);
        }
        if(lastx != l.endx.data && lasty != l.endy.data)
            context.moveTo(
                l.startx.data / dsp.max16Bit * drawing.width,
                l.starty.data / dsp.max16Bit * drawing.height);
        context.lineTo(
            l.endx.data / dsp.max16Bit * drawing.width,
            l.endy.data / dsp.max16Bit * drawing.height);
            
        lastx = l.startx.data;
        lasty = l.starty.data;
        context.stroke();
    }
}

function getCanvasContainerSize() {
    var size = new Array();
    var container = document.getElementById('DrawingContainer');
    size[0] = Math.max(
        container.scrollWidth,
        container.offsetWidth,
        container.clientWidth
    );
    size[1] = getDocHeight() - 20;

    return size;
}


// called when page loads
function setup() {
    // Register your VO objects
    registerClassAlias("deadlydiddle.CommentCountVO", CommentCountVO);
    registerClassAlias("deadlydiddle.CommentVO", CommentVO);
    registerClassAlias("deadlydiddle.DrawingVO", DrawingVO);
    registerClassAlias("deadlydiddle.LineVO", LineVO);
    registerClassAlias("deadlydiddle.ThumbnailVO", ThumbnailVO);

    // create service remoting object
    service = new RemotingProxy(url, 'deadlydiddle.MyService', amf.ObjectEncoding.AMF3);
    service.addHandler('getGallery', function(r){loopResult(r);}, function(e){console.log('error ' + e)});
    service.addHandler('getComments', function(r){loopResult(r);}, function(e){console.log('error ' + e)});
    service.addHandler('getDrawing', function(r){loopResult(r);}, function(e){console.log('error ' + e)});
    service.addHandler('getComments', function(r){loopResult(r);}, function(e){console.log('error ' + e)});
    service.addHandler('setDrawing', function(r){loopResult(r);}, function(e){console.log('error ' + e)});

    // ask the service class to get functions defined with addHandler
    //service.getComments(1091);
    //service.getGallery(gallery_page_number);
    document.onscroll = dsp.onscroll;
    document.getElementById("Submit").onclick = dsp.clickSubmit;
    document.getElementById("View").onclick = dsp.clickView;
    document.getElementById("Flash").onclick = dsp.clickFlash;
    document.getElementById("Comment").onclick = dsp.clickComment;

    // set mode drawing
    dsp.setmode(dsp.currentMode.drawing);

    // Pencil tool instance.
    tool = new tool_pencil();
    canvas = document.getElementById('Drawing');
    
    // Attach the mousedown, mousemove and mouseup event listeners.
    canvas.addEventListener('mousedown', ev_canvas, false);
    canvas.addEventListener('mousemove', ev_canvas, false);
    canvas.addEventListener('mouseup',   ev_canvas, false);

    window.onresize = resize;
    resize();
    //document.getElementById('Drawing').addEventListener('mousemove', ev_mousemove, false);
}

// init on load
if (document.getElementById) {
	window.onload = setup;
}
