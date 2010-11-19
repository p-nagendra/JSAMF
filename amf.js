/**
* @file amf.js
* @desc An AMF library in JavaScript
* @auth James Ward, Torleif West
*
* Copyright (c) 2010
* All rights reserved.

* Redistribution and use in source and binary forms, with or without modification, are
* permitted provided that the following conditions are met:
*
*    1. Redistributions of source code must retain the above copyright notice, this list of
*       conditions and the following disclaimer.
*
*    2. Redistributions in binary form must reproduce the above copyright notice, this list
*       of conditions and the following disclaimer in the documentation and/or other materials
*       provided with the distribution.
*
* THIS SOFTWARE IS PROVIDED BY JAMES WARD ''AS IS'' AND ANY EXPRESS OR IMPLIED
* WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND
* FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL JAMES WARD OR
* CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
* CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
* SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
* ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
* NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF
* ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*
* The views and conclusions contained in the software and documentation are those of the
* authors and should not be interpreted as representing official policies, either expressed
* or implied, of James Ward.
*
*/

// fallback swf bridge for IE (js file still encodes the data)
var swfBridgeLocation = "js/bridge.swf";

//
var swfBridgeRemotingProxyList = new Array();


function decodeAMF(data)
{
    var bytes = new amf.ByteArray(data, amf.Endian.BIG);

    //console.log(dumpHex(bytes));
    var version = bytes.readUnsignedShort();
    bytes.objectEncoding = amf.ObjectEncoding.AMF0;

    var response = new amf.AMFPacket();
    // Headers
    var headerCount = bytes.readUnsignedShort();
    for (var h = 0; h < headerCount; h++)
    {
        var headerName = bytes.readUTF();
        var mustUnderstand = bytes.readBoolean();
        bytes.readInt(); // read header length

        // Handle AVM+ type marker
        if (version == amf.ObjectEncoding.AMF3)
        {
            var typeMarker = bytes.readByte();
            if (typeMarker == amf.Amf0Types.kAvmPlusObjectType)
                bytes.objectEncoding = amf.ObjectEncoding.AMF3;
            else
                bytes.pos = bytes.pos - 1;
        }

        var headerValue = bytes.readObject();
    
        var header = new amf.AMFHeader(headerName, mustUnderstand, headerValue);
        response.headers.push(header);

        // Reset to AMF0 for next header
        bytes.objectEncoding = amf.ObjectEncoding.AMF0;
    }
    // Message Bodies
    var messageCount = bytes.readUnsignedShort();
    for (var m = 0; m < messageCount; m++)
    {
        var targetURI = bytes.readUTF();
        var responseURI = bytes.readUTF();
        bytes.readInt(); // Consume message body length...

        // Handle AVM+ type marker
        if (version == amf.ObjectEncoding.AMF3)
        {
            var typeMarker = bytes.readByte();
            if (typeMarker == amf.Amf0Types.kAvmPlusObjectType)
                bytes.objectEncoding = amf.ObjectEncoding.AMF3;
            else
                bytes.pos = bytes.pos - 1;
        }
        var messageBody = bytes.readObject();

        var message = new amf.AMFMessage(targetURI, responseURI, messageBody);
        response.messages.push(message);
        
        bytes.objectEncoding = amf.ObjectEncoding.AMF0;
    }

    return response;
}

function ErrorClass() {
    
}


// remoting proxy type
function RemotingProxy(url, service, encoding)
{
    this.url = url;
    this.service = service;
    this.encoding = encoding;
    this.handles = new Array();
    this.response_number = 0;

    // vars used if you're using the swf gateway
    this.flashgateway;
    this.flashgatewayloaded;
    this.flashgatewaybuffer = new Array();

    // either AMF 0 or 3.
    if (encoding != amf.ObjectEncoding.AMF0 &&
        encoding != amf.ObjectEncoding.AMF3) {
        this.encoding = amf.ObjectEncoding.AMF0;
    }

    // if you're on IE, we need to add the flash file to send the binary data.
    if('undefined' != typeof(window.ActiveXObject)) {
        var bridge = '<object classid="clsid:D27CDB6E-AE6D-11cf-96B8-444553540000" \
             id="ExternalFlashInterface" width="400" height="400"\
             codebase="http://download.macromedia.com/pub/shockwave/cabs/flash/swflash.cab">\
         <param name="movie" value="'+swfBridgeLocation+'" />\
         <param name="allowScriptAccess" value="sameDomain" />\
         <embed src="'+swfBridgeLocation+'"\
             width="400" height="400" name="ExternalFlashInterface" align="middle"\
             play="true" loop="false" quality="high" allowScriptAccess="sameDomain"\
             type="application/x-shockwave-flash"\
             pluginspage="http://www.macromedia.com/go/getflashplayer">\
         </embed>\
        </object>';
        document.body.innerHTML += bridge;

        if (navigator.appName.indexOf("Microsoft") != -1) {
            this.flashgateway = window["ExternalFlashInterface"];
        } else {
            this.flashgateway = document["ExternalFlashInterface"];
        }
        this.flashgatewayloaded = false;
        swfBridgeRemotingProxyList.push (this);
    }
    registerClassAlias("flex.messaging.messages.ErrorMessage", ErrorClass);
}

// object that gets created upon a remote request
RemotingProxy.RequestHandle = function (req, resultFunction, statusFunction, n)
{
    this.req = req;
    this.resultFunction = resultFunction;
    this.statusFunction = statusFunction;
    this.response_number = n;
}

// callback after receiving data
RemotingProxy.prototype._callBackFunction = function (handle) {
    if (handle.req.readyState == 4) {
        if (handle.req.status == 200) {
            var o = decodeAMF(handle.req.responseText);
            // ErrorClass
            console.log(o.messages);
            handle.resultFunction(o.messages[0].body);
        } else {
            handle.statusFunction('ERROR: AJAX request status = ' + handle.req.status);
        }
    }
}

// 
function FlashCallbackSuccess( str ) {
    try {
        var mstr = unescape(str);
        var o = decodeAMF(mstr);
    }
    catch (e) {
          txt="There was an error on this page.\n\n";
          txt+="Error description: " + e.description + "\n\n";
          txt+="Click OK to continue.\n\n";
          alert(txt);
    }
    //handle.resultFunction(o.messages[0].body);;
    return false;
}

// if the flash file has failed to send message, we just ignore it
function FlashCallbackFailure( str ){
    alert(str);
    return false;
}

// once the flash player has loaded, you can now send any buffered messages
// note this may fail under multiple RemotingProxy's
function FlashInterfaceLoaded() {
    var remotingProxy = swfBridgeRemotingProxyList.pop();
    remotingProxy.flashgatewayloaded = true;
    for (var i = 0; i < remotingProxy.flashgatewaybuffer.length; i ++) {
        var b = remotingProxy.flashgatewaybuffer[i];
        remotingProxy.flashgateway.sendData(b[0], b[1]);
    }
    remotingProxy.flashgatewaybuffer = new Array(); //erase buffer
}

// adds a remoting function to this handler
RemotingProxy.prototype.addHandler = function(
    handlestr,
    resultFunction,
    statusFunction)
{
    // create handle function
    this[handlestr] = function () {
        var headers = new Array();
        var handle;

        // begin to write the request for data
        var bytes = new amf.ByteArray('', amf.Endian.BIG);
        bytes.writeInt(this.encoding, 16);// protocol version 0 or 3.
        bytes.writeInt(headers.length, 16);// headers count
        bytes.writeInt(arguments.length, 16);// messages count
        
        for (var h in headers) {
            // @TODO test headers
            bytes.writeUTF(h.name); //header name
            bytes.writeInt(0, 8);// must understand
            bytes.writeInt(headers.length, 32);//  write header data length
            bytes.writeInt(1, 8); // type of header (????)
        }

        // write the body
        bytes.writeUTF(this.service +'.'+ handlestr);//  target
        bytes.writeUTF("/"+(this.response_number++));//  responce
        bytes.writeInt(0x0e, 32);//  byte-length of message ( -1 for unknowen)
        this.handles[this.response_number] = this[handlestr];

        // write body args as an array.
        var args = new Array();
        for( var i = 0; i < arguments.length; i++ ) args.push(arguments[i]);
        bytes.writeObject(args);

        // string to send
        var str = bytes.data;

        if (window.XMLHttpRequest && 'undefined' == typeof(window.ActiveXObject)) {
            req = new XMLHttpRequest();
            //XHR binary charset opt by Marcus Granado 2006 [http://mgran.blogspot.com]
            req.overrideMimeType('text/plain; charset=x-user-defined');
            req.open("POST", url, true);
            req.setRequestHeader("Content-Type", "application/x-amf");
            handle = new RemotingProxy.RequestHandle(req, resultFunction,statusFunction, this.response_number);
            req.onreadystatechange = function () {
                RemotingProxy.prototype._callBackFunction(handle);
            };
        }

        // the browser must support binary Http requests
        if('undefined' != typeof(req) && req.sendAsBinary) { // firefox (w3 standard)
            req.sendAsBinary(str);
        } else if ('undefined' != typeof(BlobBuilder)) { // chrome
            //var bb = new BlobBuilder();
            //bb.append(str);
            req.send(bytes.blobData.getBlob());
        }else if (window.ActiveXObject) {   // IE
            // gateway not ready, buffer the requests
            if(!this.flashgatewayloaded) {
                var ar = new Array(url, escape(str));
                this.flashgatewaybuffer.push(ar);
                return;
            }
            try {
                this.flashgateway.sendData(url, escape(str));
            } catch (e) {
                // @TODO have a cry here
                alert('failed to send binary data ' + e.description);
            }
        } else {
            // Safari does not convert binary to string. Let's hope if gets here, so does your browser
            req.send(str);
        }
    }
}

function dumpHex(bytes)
{
    var s = "";
    var i = 0;
    var chunk = [];

    while (i < bytes.length)
    {

        if (((i % 16) == 0) && (i != 0))
        {
            s += writeChunk(chunk, 16) + "\n";
            chunk = [];
        }

        chunk.push(bytes.readByte());

        i++;
    }
    s += writeChunk(chunk, 16);

    bytes.pos = 0;

    return s;
}

function writeChunk(chunk, width)
{
    var s = "";

    for (var i = 0; i < chunk.length; i++)
    {
        if (((i % 4) == 0) && (i != 0))
        {
            s += " ";
        }

        var b = chunk[i];

        var ss = b.toString(16) + " ";
        if (ss.length == 2)
        {
            ss = "0" + ss;
        }

        s += ss;
    }

    for (var i = 0; i < (width - chunk.length); i++)
    {
        s += "   ";
    }

    var j = Math.floor((width - chunk.length) / 4);
    for (var i = 0; i < j; i++)
    {
        s += " ";
    }
    s += "   ";
    for (var i = 0; i < chunk.length; i++)
    {
        var b = chunk[i];

        if ((b <= 126) && (b > 32))
        {
            var ss = String.fromCharCode(b);
            s += ss;
        }
        else
        {
            s += ".";
        }
    }

    return s;
}

// 'static' data definitions
if ('undefined' == typeof(amf))
{
    amf = {
        registeredClasses: [],
        RegisteredClass: function (name, funt) {
            this.name = name;
            this.initFunct = funt;
        }
    };
}


// dynamic objects get made here
function registerClassAlias(VOname, classVO)
{
    amf.registeredClasses.push(new amf.RegisteredClass(VOname, classVO));
}

// src http://ejohn.org/blog/simple-javascript-inheritance/
(function()
{
    var initializing = false;

    // Base Class implementation
    this.Class = function()
    {
    };

    // Create a new Class that inherits from this class
    Class.extend = function(prop)
    {
        var _super = this.prototype;

        // Instantiate a base class (but only create the instance,
        // don't run the init constructor)
        initializing = true;
        var prototype = new this();
        initializing = false;

        // Copy the properties over onto the new prototype
        for (var name in prop)
        {
            // Check if we're overwriting an existing function
            prototype[name] = typeof prop[name] == "function" &&
            typeof _super[name] == "function" && fnTest.test(prop[name]) ?
            (function(name, fn)
            {
                return function()
                {
                    var tmp = this._super;

                    // Add a new ._super() method that is the same method
                    // but on the super-class
                    this._super = _super[name];

                    // The method only need to be bound temporarily, so we
                    // remove it when we're done executing
                    var ret = fn.apply(this, arguments);
                    this._super = tmp;

                    return ret;
                };
            })(name, prop[name]) :
            prop[name];
        }

        // The dummy class constructor
        function Class()
        {
            // All construction is actually done in the init method
            if (!initializing && this.init)
                this.init.apply(this, arguments);
        }

        // Populate our constructed prototype object
        Class.prototype = prototype;

        // Enforce the constructor to be what we expect
        Class.constructor = Class;

        // And make this class extendable
        Class.extend = arguments.callee;

        return Class;
    };
})();

//Enum for big or little endian.
amf.Endian = {
    BIG: 0,
    LITTLE: 1
};

// AMF encoding type
amf.ObjectEncoding = {
    AMF0: 0,
    AMF3: 3
};

// AMF data types 
amf.Amf0Types = {
    kNumberType:         0,
    kBooleanType:        1,
    kStringType:         2,
    kObjectType:         3,
    kMovieClipType:      4,
    kNullType:           5,
    kUndefinedType:      6,
    kReferenceType:      7,
    kECMAArrayType:      8,
    kObjectEndType:      9,
    kStrictArrayType:   10,
    kDateType:          11,
    kLongStringType:    12,
    kUnsupportedType:   13,
    kRecordsetType:     14,
    kXMLObjectType:     15,
    kTypedObjectType:   16,
    kAvmPlusObjectType: 17
};

// AMF3 datatypes
amf.Amf3Types = {
    kUndefinedType:    0,
    kNullType:       1,
    kFalseType:      2,
    kTrueType:       3,
    kIntegerType:    4,
    kDoubleType:     5,
    kStringType:     6,
    kXMLType:        7,
    kDateType:       8,
    kArrayType:      9,
    kObjectType:     10,
    kAvmPlusXmlType: 11,
    kByteArrayType:  12
};

// each AMF message has a target
amf.AMFMessage = Class.extend({
    targetURL: "",
    responseURI: "",
    body: {},
    init: function(targetURL, responseURI, body)
    {
        this.targetURL = targetURL;
        this.responseURI = responseURI;
        this.body = body;
    }
});

amf.AMFPacket = Class.extend({
    version:  0,
    headers: [],
    messages: [],
    init: function(version)
    {
        this.version = (version !== undefined) ? version : 0;
        this.headers = new Array();
        this.messages = new Array();
    }
});

amf.AMFHeader = Class.extend({
    name: "",
    mustUnderstand: false,
    data: {},
    init: function(name, mustUnderstand, data)
    {
        this.name = name;
        this.mustUnderstand = (mustUnderstand != undefined) ? mustUnderstand : false;
        this.data = data;
    }
});


// AMF 0 objects
function Integer()
{
    this.data = 0;
}
Integer.prototype.set = function(i)
{
    this.data = parseInt(i);
}

/**
 * Attempt to imitate AS3's ByteArray as very high-performance javascript.
 * I aliased the functions to have shorter names, like ReadUInt32 as well as ReadUnsignedInt.
 * I used some code from http://fhtr.blogspot.com/2009/12/3d-models-and-parsing-binary-data-with.html
 * to kick-start it, but I added optimizations and support both big and little endian.
 * Note that you cannot change the endianness after construction.
 * @extends Class
 */
amf.ByteArray = Class.extend({
    data: '' ,
    blobData: null,
    length: 0 ,
    pos: 0 ,
    pow: Math.pow ,
    endian: amf.Endian.BIG  ,
    TWOeN23: Math.pow(2, -23) ,
    TWOeN52: Math.pow(2, -52)  ,
    objectEncoding: amf.ObjectEncoding.AMF0 ,
    stringTable: [] ,
    objectTable: [] ,
    traitTable: []

    /** @constructor */
    ,
    init: function(data, endian)
    {
        this.data = (data !== undefined) ? data : '';
        if (endian !== undefined) this.endian = endian;
        this.length = data.length;

        this.stringTable = new Array();
        this.objectTable = new Array();
        this.traitTable = new Array();
        
        if('undefined' != typeof(BlobBuilder)) {
            this.blobData = new BlobBuilder();
        }


        // Cache the function pointers based on endianness.
        // This avoids doing an if-statement in every function call.
        var funcExt = (endian == amf.Endian.BIG) ? 'BE' : 'LE';
        var funcs = [ 'readInt16', 'readUInt30','readUInt32',
        'readUInt16', 'readFloat32', 'readFloat64'];
        for (var func in funcs)
        {
            this[funcs[func]] = this[funcs[func] + funcExt];
        }

        // Add redundant members that match actionscript for compatibility
        var funcMap = {
            readByte: 'readByte',
            readUnsignedInt: 'readUInt32',
            readFloat: 'readFloat32',
            readDouble: 'readDouble',
            readShort: 'readInt16',
            readUnsignedShort: 'readUnsignedShort',
            readBoolean: 'readBool',
            readInt: 'readInt',
            writeInt:'writeInt',
            writeUTF:'writeUTF',
            //writeAMF3Int:'writeAMF3Int',
            readString: 'readString',
            hexTob64: 'hexTob64',
            base64ToHex: 'base64ToHex',
            writeInt29:'writeInt29'
        };
        for (var func in funcMap)
        {
            this[func] = this[funcMap[func]];
        }
    },
    writeInt29:function (i) {
        i = parseInt(i);
        i &= 0x1fffffff;
        if(i < 0x80)
        {
            this.data += i;
        }
        else if(i < 0x4000)
        {
            this.data += (i >> 7 & 0x7f | 0x80) + (i & 0x7f);
        }
        else if(i < 0x200000)
        {
            this.data += (i >> 14 & 0x7f | 0x80) + (i >> 7 & 0x7f | 0x80) + (i & 0x7f);
        }
        else
        {
            this.data += (i >> 22 & 0x7f | 0x80) + (i >> 15 & 0x7f | 0x80) +
                (i >> 8 & 0x7f | 0x80) + (i & 0xff);
        }
    },
    readByte: function()
    {
        var cc = this.data.charCodeAt(this.pos++);
        return (cc & 0xFF);
    },
    readByteRaw: function()
    {
        return this.data[this.pos++];
    },
    writeByte: function(byt)
    {
        // @TODO: make a blob builder equivalent
        if('undefined' != typeof(BlobBuilder)) {
        }
        this.data = this.data + String.fromCharCode(byt & 0xFF);

    },
    readBool: function()
    {
        return (this.data.charCodeAt(this.pos++) & 0xFF) ? true : false;
    },
    readUInt30BE: function()
    {
        var ch1 = this.readByte();
        var ch2 = this.readByte();
        var ch3 = this.readByte();
        var ch4 = this.readByte();

        if (ch1 >= 64)
            return undefined;

        return ch4 | (ch3 << 8) | (ch2 << 16) | (ch1 << 24);
    },
    readUInt32BE: function()
    {
        var data = this.data, pos = (this.pos += 4) - 4;
        return  ((data.charCodeAt(pos) & 0xFF) << 24) |
        ((data.charCodeAt(++pos) & 0xFF) << 16) |
        ((data.charCodeAt(++pos) & 0xFF) << 8) |
        (data.charCodeAt(++pos) & 0xFF);
    }
    ,
    readInt: function()
    {
        if(this.endian == amf.Endian.BIG) {
            return this.readInt32BE();
        } else {
            return this.readInt32LE();
        }
    }
    ,
    readInt32BE: function()
    {
        var data = this.data, pos = (this.pos += 4) - 4;
        var x = ((data.charCodeAt(pos) & 0xFF) << 24) |
        ((data.charCodeAt(++pos) & 0xFF) << 16) |
        ((data.charCodeAt(++pos) & 0xFF) << 8) |
        (data.charCodeAt(++pos) & 0xFF);
        return (x >= 2147483648) ? x - 4294967296 : x;
    }

    ,
    readUInt16BE: function()
    {
        var data = this.data, pos = (this.pos += 2) - 2;
        return  ((data.charCodeAt(pos) & 0xFF) << 8) |
        (data.charCodeAt(++pos) & 0xFF);
    }
    ,
    readInt16BE: function()
    {
        var data = this.data, pos = (this.pos += 2) - 2;
        var x = ((data.charCodeAt(pos) & 0xFF) << 8) |
        (data.charCodeAt(++pos) & 0xFF);
        return (x >= 32768) ? x - 65536 : x;
    },
    readDouble: function (){
        if(this.endian == amf.Endian.BIG) {
            return this.readFloat64BE();
        } else {
            return this.readFloat64LE();
        }
    },
    readUnsignedShort: function (){
        if(this.endian == amf.Endian.BIG) {
            return this.readInt16BE();
        } else {
            return this.readInt16LE();
        }
    } ,
    readFloat32LE: function()

    {
        var b4 = this.readByte(),
        b3 = this.readByte(),
        b2 = this.readByte();
        b1 = this.readByte();

        var sign = 1 - ((b1 >> 7) << 1);                   // sign = bit 0
        var exp = (((b1 << 1) & 0xFF) | (b2 >> 7)) - 127;  // exponent = bits 1..8
        var sig = ((b2 & 0x7F) << 16) | (b3 << 8) | b4;    // significand = bits 9..31
        if (sig == 0 && exp == -127)
            return 0.0;
        return sign * (1 + this.TWOeN23 * sig) * this.pow(2, exp);
    } ,
    readFloat32BE: function()

    {
        var b1 = this.readByte(),
        b2 = this.readByte(),
        b3 = this.readByte(),
        b4 = this.readByte();
        var sign = 1 - ((b1 >> 7) << 1);                   // sign = bit 0
        var exp = (((b1 << 1) & 0xFF) | (b2 >> 7)) - 127;  // exponent = bits 1..8
        var sig = ((b2 & 0x7F) << 16) | (b3 << 8) | b4;    // significand = bits 9..31
        if (sig == 0 && exp == -127)
            return 0.0;
        return sign * (1 + this.TWOeN23 * sig) * this.pow(2, exp);
    } ,
    readFloat64BE: function()

    {
        var b1 = this.readByte();
        var b2 = this.readByte();
        var b3 = this.readByte();
        var b4 = this.readByte();
        var b5 = this.readByte();
        var b6 = this.readByte();
        var b7 = this.readByte();
        var b8 = this.readByte();

        var sign = 1 - ((b1 >> 7) << 1);									// sign = bit 0
        var exp = (((b1 << 4) & 0x7FF) | (b2 >> 4)) - 1023;					// exponent = bits 1..11

        // This crazy toString() stuff works around the fact that js ints are
        // only 32 bits and signed, giving us 31 bits to work with
        var sig = (((b2 & 0xF) << 16) | (b3 << 8) | b4).toString(2) +
        ((b5 >> 7) ? '1' : '0') +
        (((b5 & 0x7F) << 24) | (b6 << 16) | (b7 << 8) | b8).toString(2);	// significand = bits 12..63

        sig = parseInt(sig, 2);

        if (sig == 0 && exp == -1023)
            return 0.0;

        return sign*(1.0 + this.TWOeN52*sig)*this.pow(2, exp);
    }

    ,
    readUInt29: function()
    {
        // @TODO fix in IE. After reading a byte array, this function sometimes
        // returns the wrong value
        var value;

        // Each byte must be treated as unsigned
        var b = this.readByte();
        
        if (b < 128)
            return b;

        value = (b & 0x7F) << 7;
        b = this.readByte() & 0xFF;

        if (b < 128)
            return (value | b);

        value = (value | (b & 0x7F)) << 7;
        b = this.readByte() & 0xFF;

        if (b < 128)
            return (value | b);

        value = (value | (b & 0x7F)) << 8;
        b = this.readByte() & 0xFF;

        return (value | b);
    }

    ,
    readUInt30LE: function()
    {
        var ch1 = readByte();
        var ch2 = readByte();
        var ch3 = readByte();
        var ch4 = readByte();

        if (ch4 >= 64)
            return undefined;

        return ch1 | (ch2 << 8) | (ch3 << 16) | (ch4 << 24);
    }

    ,
    readUInt32LE: function()
    {
        var data = this.data, pos = (this.pos += 4);
        return  ((data.charCodeAt(--pos) & 0xFF) << 24) |
        ((data.charCodeAt(--pos) & 0xFF) << 16) |
        ((data.charCodeAt(--pos) & 0xFF) << 8) |
        (data.charCodeAt(--pos) & 0xFF);
    }
    ,
    readInt32LE: function()
    {
        var data = this.data, pos = (this.pos += 4);
        var x = ((data.charCodeAt(--pos) & 0xFF) << 24) |
        ((data.charCodeAt(--pos) & 0xFF) << 16) |
        ((data.charCodeAt(--pos) & 0xFF) << 8) |
        (data.charCodeAt(--pos) & 0xFF);
        return (x >= 2147483648) ? x - 4294967296 : x;
    }

    ,
    readUInt16LE: function()
    {
        var data = this.data, pos = (this.pos += 2);
        return  ((data.charCodeAt(--pos) & 0xFF) << 8) |
        (data.charCodeAt(--pos) & 0xFF);
    }
    ,
    readInt16LE: function()
    {
        var data = this.data, pos = (this.pos += 2);
        var x = ((data.charCodeAt(--pos) & 0xFF) << 8) |
        (data.charCodeAt(--pos) & 0xFF);
        return (x >= 32768) ? x - 65536 : x;
    }

    ,
    readFloat64LE: function()
    {
        var b1 = this.readByte(),
        b2 = this.readByte(),
        b3 = this.readByte(),
        b4 = this.readByte(),
        b5 = this.readByte(),
        b6 = this.readByte(),
        b7 = this.readByte(),
        b8 = this.readByte();
        var sign = 1 - ((b1 >> 7) << 1);									// sign = bit 0
        var exp = (((b1 << 4) & 0x7FF) | (b2 >> 4)) - 1023;					// exponent = bits 1..11

        // This crazy toString() stuff works around the fact that js ints are
        // only 32 bits and signed, giving us 31 bits to work with
        var sig = (((b2 & 0xF) << 16) | (b3 << 8) | b4).toString(2) +
        ((b5 >> 7) ? '1' : '0') +
        (((b5 & 0x7F) << 24) | (b6 << 16) | (b7 << 8) | b8).toString(2);	// significand = bits 12..63

        sig = parseInt(sig, 2);
        if (sig == 0 && exp == -1023)
            return 0.0;
        return sign * (1.0 + this.TWOeN52 * sig) * this.pow(2, exp);
    }

    ,
    readDate: function()
    {
        var time_ms = this.readDouble();
        var tz_min = this.readUInt16BE();
        return new Date(time_ms + tz_min * 60 * 1000);
    }

    ,
    readString: function(len)
    {
        var str = "";

        while (len > 0)
        {
            str += String.fromCharCode(this.readByte());
            len--;
        }
        return str;
    }

    ,
    readUTF: function()
    {
        var s = this.readString(this.readUnsignedShort());
        return s;
    }

    ,
    readLongUTF: function()
    {
        return this.readString(this.readUInt30());
    }

    ,
    stringToXML: function(str)
    {
        var xmlDoc;

        if (window.DOMParser)
        {
            var parser = new DOMParser();
            xmlDoc = parser.parseFromString(str, "text/xml");
        }
        else // IE
        {
            xmlDoc = new ActiveXObject("Microsoft.XMLDOM");
            xmlDoc.async = false;
            xmlDoc.loadXML(stc);
        }

        return xmlDoc;
    }

    ,
    readXML: function()
    {
        var xml = this.readLongUTF();

        return this.stringToXML(xml);
    }

    ,
    readStringAMF3: function()
    {
        var ref = this.readUInt29();
        if ((ref & 1) == 0) {// This is a reference
            return this.stringTable[(ref >> 1)];
        }

        var len = (ref >> 1);

        if (0 == len)
            return "";

        var str = this.readString(len);

        this.stringTable.push(str);

        return str;
    }

    ,
    readTraits: function(ref)
    {
        var traitInfo = new Object();
        traitInfo.properties = new Array();

        if ((ref & 3) == 1)
            return this.traitTable[(ref >> 2)];

        traitInfo.externalizable = ((ref & 4) == 4);

        traitInfo.dynamic = ((ref & 8) == 8);

        traitInfo.count = (ref >> 4);
        traitInfo.className = this.readStringAMF3();

        this.traitTable.push(traitInfo);

        for (var i = 0; i < traitInfo.count; i++)
        {
            var propName = this.readStringAMF3();
            traitInfo.properties.push(propName);
        }

        return traitInfo;
    }

    ,
    readExternalizable: function(className)
    {
        return this.readObject();
    }

    ,
    readObject: function()
    {
        if (this.objectEncoding == amf.ObjectEncoding.AMF0)
        {
            return this.readAMF0Object();
        }
        else if (this.objectEncoding == amf.ObjectEncoding.AMF3)
        {
            return this.readAMF3Object();
        }
    }

    ,
    readAMF0Object: function()
    {
        var marker = this.readByte();
        if (marker == amf.Amf0Types.kNumberType)
        {
            return this.readDouble();
        }
        else if (marker == amf.Amf0Types.kBooleanType)
        {
            return this.readBoolean();
        }
        else if (marker == amf.Amf0Types.kStringType)
        {
            return this.readUTF();
        }
        else if ((marker == amf.Amf0Types.kObjectType) || (marker == amf.Amf0Types.kECMAArrayType))
        {
            var o = new Object();

            // @TODO: test this
            for (var i = 0; i < amf.registeredClasses.length; i++) {
                if(amf.registeredClasses[i].name == className) {
                    o = new amf.registeredClasses[i].initFunct();
                }
            }
            
            var ismixed = (marker == 0x08);

            var size = null;
            if (ismixed)
                this.readUInt30();

            while (true)
            {
                var c1 = this.readByte();
                var c2 = this.readByte();
                var name = this.readString((c1 << 8) | c2);
                var k = this.readByte();
                if (k == 0x09)
                    break;

                this.pos--;

                o[name] = readObject();
            }

            return o;
        }
        else if (marker == amf.Amf0Types.kStrictArrayType)
        {
            var size = this.readInt();
            var a = new Array();

            for (var i = 0; i < size; ++i)
            {
                a.push(this.readObject());
            }

            return a;
        }
        else if (marker == amf.Amf0Types.kTypedObjectType)
        {
            var o = new Object();

            var typeName = this.readUTF();
            var propertyName = this.readUTF();
            var type = this.readByte();
            while (type != kObjectEndType)
            {
                var value = this.readObject();
                o[propertyName] = value;

                propertyName = this.readUTF();
                type = this.readByte();
            }

            return o;
        }
        else if (marker == amf.Amf0Types.kAvmPlusObjectType)
        {
            return this.readAMF3Object();
        }
        else if (marker == amf.Amf0Types.kNullType)
        {
            return null;
        }
        else if (marker == amf.Amf0Types.kUndefinedType)
        {
            return undefined;
        }
        else if (marker == amf.Amf0Types.kReferenceType)
        {
            var refNum = this.readUnsignedShort();
            var value = this.objectTable[refNum];

            return value;
        }
        else if (marker == amf.Amf0Types.kDateType)
        {
            return this.readDate();
        }
        else if (marker == amf.Amf0Types.kLongStringType)
        {
            return this.readLongUTF();
        }
        else if (marker == amf.Amf0Types.kXMLObjectType)
        {
            return this.readXML();
        }
        throw ("AMF0 Decoding failure. ID with type " + marker + " found.");
    }

    ,
    readAMF3Object: function()
    {
        var marker = this.readByte();
        if (marker == amf.Amf3Types.kUndefinedType)
        {
            return undefined;
        }
        else if (marker == amf.Amf3Types.kNullType)
        {
            return null;
        }
        else if (marker == amf.Amf3Types.kFalseType)
        {
            return false;
        }
        else if (marker == amf.Amf3Types.kTrueType)
        {
            return true;
        }
        else if (marker == amf.Amf3Types.kIntegerType)
        {
            var i = this.readUInt29();

            return i;
        }
        else if (marker == amf.Amf3Types.kDoubleType)
        {
            return this.readDouble();
        }
        else if (marker == amf.Amf3Types.kStringType)
        {
            return this.readStringAMF3();
        }
        else if (marker == amf.Amf3Types.kXMLType)
        {
            return this.readXML();
        }
        else if (marker == amf.Amf3Types.kDateType)
        {
            var ref = this.readUInt29();

            if ((ref & 1) == 0)
                return this.objectTable[(ref >> 1)];

            var d = this.readDouble();
            var value = new Date(d);
            this.objectTable.push(value);

            return value;
        }
        else if (marker == amf.Amf3Types.kArrayType)
        {
            var ref = this.readUInt29();

            if ((ref & 1) == 0)
                return this.objectTable[(ref >> 1)];

            var len = (ref >> 1);

            var key = this.readStringAMF3();

            if (key == "")
            {
                var a = new Array();
                this.objectTable.push(a); // this was lacking in prev versions

                for (var i = 0; i < len; i++)
                {
                    var value = this.readAMF3Object();
                    a.push(value);
                }

                return a;
            }

            // mixed array
            var result = {};
            this.objectTable.push(result);

            while (key != "")
            {
                result[key] = this.readAMF3Object();
                key = this.readStringAMF3();
            }

            for (var i = 0; i < len; i++)
            {
                result[i] = this.readObject();
            }

            return result;
        }
        else if (marker == amf.Amf3Types.kObjectType)
        {
            var o = new Object();

            var ref = this.readUInt29();

            if ((ref & 1) == 0)
                return this.objectTable[(ref >> 1)];

            var ti = this.readTraits(ref);
            var className = ti.className;
            var externalizable = ti.externalizable;

            for (var i = 0; i < amf.registeredClasses.length; i++) {
                if(amf.registeredClasses[i].name == className) {
                    o = new amf.registeredClasses[i].initFunct();
                }
            }
            this.objectTable.push(o);

            if (externalizable)
            {
                o = this.readExternalizable(className);
            }
            else
            {
                var len = ti.properties.length;

                for (var i = 0; i < len; i++)
                {
                    var propName = ti.properties[i];
                    var value = this.readAMF3Object();

                    o[propName] = value;
                }
                if (ti.dynamic)
                {
                    for (; ;)
                    {
                        var name = this.readStringAMF3();
                        if (name == null || name.length == 0) break;
                        var value = this.readAMF3Object();
                        o[name] = value;
                    }
                }
            }

            return o;
        }
        else if (marker == amf.Amf3Types.kAvmPlusXmlType)
        {
            var ref = this.readUInt29();

            if ((ref & 1) == 0)
                return this.stringToXML(this.objectTable[(ref >> 1)]);

            var len = (ref >> 1);

            if (0 == len)
                return null;


            var str = this.readString(len);

            var xml = this.stringToXML(str);

            this.objectTable.push(xml);

            return xml;
        }
        else if (marker == amf.Amf3Types.kByteArrayType)
        {
            //
            // @TODO write this so it works in IE. there's an error where
            // after reading the byte array, the readUInt29() after reads the
            // wrong byte.
            //
            // small byte arrays don't seem to be affected
            //

            var ref = this.readUInt29();
            if ((ref & 1) == 0)
                return this.objectTable[(ref >> 1)];

            var len = (ref >> 1);

            var ba = new amf.ByteArray('', amf.Endian.BIG);

            this.objectTable.push(ba);

            for (var i = 0; i < len; i++) {
                ba.writeByte(this.readByte());
            }

            return ba;
        }
        alert ('failure in ' + marker);
        throw ("AMF3 Decoding failure. ID with type " + marker + " found.");
    },
    // from http://jsfromhell.com/classes/binary-parser
    writeInt: function(number, bits)
    {
        var lp = bits / 8;
        var max = Math.pow(2, bits), r = [];
        (number >= max || number < -(max >> 1)) && (number = 0);
        number < 0 && (number += max);
        for(; number; r[r.length] = String.fromCharCode(number % 256), number = Math.floor(number / 256));
        for(bits = -(-bits >> 3) - r.length; bits--; r[r.length] = "\0");
        this.data += ((this.endian == amf.Endian.BIG ? r.reverse() : r).join(""));

        // @TODO blobbuilder equivilant 
        //if('undefined' != typeof(BlobBuilder)) {
            //this.blobData.append(this.endian == amf.Endian.BIG ? r.reverse() : r);
        //}
    },
    writeUTF: function (str)
    {
        this.writeInt(str.length, 16); // unsigned short (max 65535)
        this.data += str;
        // @TODO blobbuilder
        //if('undefined' != typeof(BlobBuilder)) {
            //this.blobData.append(this.data);
        //}
    },// fr : http://snippets.dzone.com/posts/show/685
    writeDouble: function( data ) {
        data = parseFloat(data);
        var precisionBits = 52;
        var exponentBits = 11;
        var bias = Math.pow( 2, exponentBits - 1 ) - 1, minExp = -bias + 1, maxExp = bias, minUnnormExp = minExp - precisionBits,
        status = isNaN( n = parseFloat( data ) ) || n == -Infinity || n == +Infinity ? n : 0,
        exp = 0, len = 2 * bias + 1 + precisionBits + 3, bin = new Array( len ),
        signal = ( n = status !== 0 ? 0 : n ) < 0, n = Math.abs( n ), intPart = Math.floor( n ), floatPart = n - intPart,
        i, lastBit, rounded, j, result;
        for( i = len; i; bin[--i] = 0 );
        for( i = bias + 2; intPart && i; bin[--i] = intPart % 2, intPart = Math.floor( intPart / 2 ) );
        for( i = bias + 1; floatPart > 0 && i; ( bin[++i] = ( ( floatPart *= 2 ) >= 1 ) - 0 ) && --floatPart );
        for( i = -1; ++i < len && !bin[i]; );
        if( bin[( lastBit = precisionBits - 1 + ( i = ( exp = bias + 1 - i ) >= minExp && exp <= maxExp ? i + 1 : bias + 1 - ( exp = minExp - 1 ) ) ) + 1] ){
            if( !( rounded = bin[lastBit] ) )
                for( j = lastBit + 2; !rounded && j < len; rounded = bin[j++] );
            for( j = lastBit + 1; rounded && --j >= 0; ( bin[j] = !bin[j] - 0 ) && ( rounded = 0 ) );
        }
        for( i = i - 2 < 0 ? -1 : i - 3; ++i < len && !bin[i]; );
        if( ( exp = bias + 1 - i ) >= minExp && exp <= maxExp )
            ++i;
        else if( exp < minExp ){
            //console.log(exp != bias + 1 - len && exp < minUnnormExp);
            i = bias + 1 - ( exp = minExp - 1 );
        }
        if( intPart || status !== 0 ){
            //console.log( intPart ? "encodeFloat::float overflow" : "encodeFloat::" + status );
            exp = maxExp + 1;
            i = bias + 2;
            if( status == -Infinity )
                signal = 1;
            else if( isNaN( status ) )
                bin[i] = 1;
        }
        for( n = Math.abs( exp + bias ), j = exponentBits + 1, result = ""; --j; result = ( n % 2 ) + result, n = n >>= 1 );
        for( n = 0, j = 0, i = ( result = ( signal ? "1" : "0" ) + result + bin.slice( i, i + precisionBits ).join( "" ) ).length, r = []; i; j = ( j + 1 ) % 8 ){
            n += ( 1 << j ) * result.charAt( --i );
            if( j == 7 ){
                r[r.length] = String.fromCharCode( n );
                n = 0;
            }
        }
        r[r.length] = n ? String.fromCharCode( n ) : "";
        this.data += ( this.endian == amf.Endian.BIG ? r.reverse() : r ).join( "" );
    },
    writeAMF0Array: function (array)
    {
        // Strict Array Type
        this.writeInt(amf.Amf0Types.kStrictArrayType, 8);
        this.writeInt(array.length, 32);

        for(var i = 0; i < array.length; i++)
        {
            this.writeObject(array[i]);
        }
    },
    writeObject : function(d)
    {
        // console.log("writeObject type " + typeof(d) + " (" + d + ")");
        // todo: test this shit
        if (d == undefined){
            this.writeInt(amf.Amf0Types.kAvmPlusObjectType, 8);
            this.writeInt(amf.Amf3Types.kUndefinedType, 8);
        }else if (d === false) {
            this.writeInt(amf.Amf0Types.kBooleanType, 8);
            this.writeInt(0, 8);
        }else if (d === true) {
            this.writeInt(amf.Amf0Types.kBooleanType, 8);
            this.writeInt(1, 8);
            // Integer data type is a AMF3 thing
        } else if (d instanceof Integer || typeof(d) == 'Integer') {
            this.writeInt(amf.Amf0Types.kAvmPlusObjectType, 8);
            this.writeAMFInt(d.data);
        }else if (typeof(d) == 'number' || d == Number.NaN) {
            this.writeInt(amf.Amf0Types.kNumberType, 8);
            this.writeDouble(d); // double
        } else if (d instanceof String || typeof(d) == 'string') {
            this.writeAmf0String(d);
        } else if (d instanceof Array) {
            this.writeAMF0Array(d);
        } else if (d instanceof Object) {
            // writeTypedObject
            var typedObject = false;
            for(var i = 0; i < amf.registeredClasses.length; i++) {
                var o = amf.registeredClasses[i];
                if(d instanceof o.initFunct) {
                    typedObject = true;
                    this.writeInt(amf.Amf0Types.kTypedObjectType, 8);
                    this.writeUTF(o.name);

                    for(var prop in d) {
                        this.writeUTF(prop);
                        this.writeObject(d[prop]);
                    }
                    this.writeUTF("");
                    this.writeByte(9);
                }
            }
            // writeAnonymousObject
            if(!typedObject) {
                console.log('class not registered, write');
                console.log(d);
                // if it's a function starting with _, we skip it
                if(typeof(d) == 'function') {
                    console.log(d.toString())
                    var functionname = d.toString().match(/^function\s(\w+)/);
                    console.log("functionname = " + functionname);
                }
                this.writeInt(amf.Amf0Types.kObjectType, 8);
                for(var prop in d) {
                    this.writeUTF(prop);
                    this.writeObject(d[prop]);
                    console.log("write object var " + prop  + " = " + d[prop]);
                }
                this.writeUTF("");
                this.writeByte(9);
            }
        } else {
            console.log('can\'t write type ' + typeof(d));
        }
    },
    writeAMFInt: function(d)
	{
        //check valid range for 29bits
		if (d >= 0xF0000000 && d <= 0x0FFFFFFF)
        {
            d = d & 0x1FFFFFFF; // Mask is 2^29 - 1
            this.writeInt(amf.Amf3Types.kIntegerType, 8);
            writeUInt29(d);
        } else {
			//overflow condition would occur upon int conversion
            this.writeInt(amf.Amf3Types.kDoubleType, 8);
			this.writeDouble(d);
		}
	},
    writeUInt29: function (ref) {
        if (ref < 0x80) {
            this.writeByte(ref);
        } else if (ref < 0x4000) {
            this.writeByte(((ref >> 7) & 0x7F) | 0x80);
            this.writeByte(ref & 0x7F);
        } else if (ref < 0x200000) {
            this.writeByte(((ref >> 14) & 0x7F) | 0x80);
            this.writeByte(((ref >> 7) & 0x7F) | 0x80);
            this.writeByte(ref & 0x7F);
        } else if (ref < 0x40000000) {
            this.writeByte(((ref >> 22) & 0x7F) | 0x80);
            this.writeByte(((ref >> 15) & 0x7F) | 0x80);
            this.writeByte(((ref >> 8) & 0x7F) | 0x80);
            this.writeByte(ref & 0xFF);
        } else {
            throw ("Integer out of range: " + ref);
        }
    },
    writeAmf0String: function (d)
    {
        this.writeInt(amf.Amf0Types.kStringType, 8);
        this.writeInt(d.length, 16);
        var len = 0;
        while (len < d.length)
        {
            this.writeByte(d.charCodeAt(len))
            len++;
        }
    },
    writeAmf3String: function (d)
    {
        if( d == "" )
        {
            //Write 0x01 to specify the empty ctring
            this.data += 0x01;
        }
        else
        {
            if( ! d in this.stringTable)
            {
                this.writeInt29(d.length*2 + 1);
                this.data += d;
                return this.stringTable.push(d);
            }
            else
            {
                // search for reused strings
                for (var i=0; i < this.stringTable.length; i++) {
                    if (this.stringTable[i] == d) {
                        this.writeInt29(i << 1);
                        return i;
                    }
                    throw("failed to find amf3 string");
                }
            }
        }
    },
    hexTob64: function (hex)
    {
        if(!hex) return '';
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
});