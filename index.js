const colors  	 	= require('colors');
const express 	 	= require('express');
const bodyParser 	= require('body-parser');
const path    	 	= require('path');
const fs     	 	= require('fs');
const cors   		= require('cors')  
const router 		= express.Router()
const extend 	 	= require('util')._extend;
const join   	 	= require('path').join;
const session 		= require('express-session');
const Db            = require('mongodb').Db;
const MongoClient   = require('mongodb').MongoClient;
const ObjectID      = require('mongodb').ObjectID;
const ReplSet       = require('mongodb').ReplSet;
const Server        = require('mongodb').Server;
const url 			= require('url');
const mo 			= require('method-override');
const eh 			= require('errorhandler');
const _ 			= require("underscore");

"use strict";

//Create APP
const app    	= express();  
const http      = require('http').Server(app);
const io        = require('socket.io')(http);
	  
// Routes 
// ----------------------------------------------
const model  		= require('./lib/model.js'); 
const routes 		= require( join(fs.realpathSync('config/',{}), '/routes.js'));
const local 		= require( join(fs.realpathSync('config/',{}), '/local.js'));
const sessconf 		= require( join(fs.realpathSync('config/',{}), '/sessions.js')).session;
const auth 			= sessconf.auth;
const polices 		= require('./lib/polices.js');

// Configuration 
// ----------------------------------------------
const port    		= local.port || 9991;
const socketport	= local.socketport || 9992;

// Create application/json parser
var jsonParser = bodyParser.json()

// Use the body-parser package in our application
app.use(bodyParser.json({limit: '100mb'}));
app.use(bodyParser.urlencoded({limit: '100mb', extended: true}));

// Allow Cors  	
app.use(cors());  

// var allowCrossDomain = function(req, res, next) {
// 	    res.header('Access-Control-Allow-Origin', '*');
//     	res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
//     	res.header('Access-Control-Allow-Headers', 'Content-Type');
// 	    next();
// 	}

// app.use(allowCrossDomain);


// Auth Middleware
// ----------------------------------------------
app.use(function (req, res, next) {
	
	var ip     = (req.headers['x-forwarded-for'] || '').split(',')[0] || req.connection.remoteAddress.split(':').slice(-1)[0];
	var origin = req.headers.origin;
	var token  = req.headers.token;
	var secret = req.headers.secret;
	if( auth ){	  
		switch( auth.type ){
	  		case 'token':	  			  		
		  		polices.token(token,secret,ip,origin,function(r,data){
		  		  if(r){
		  		  	this.account = data;		  		 
				    next();
				  } else {
				    return res.status(401).json({status:401,msg:'Unauthorized, invalid token or missing'})
				  }
		  		}) 	  		
			break;
			case 'userlogin':
				// TO-DO
		  	break;  
		}
	}else{ 
		next();
	}
})

// Dynamically include routes (Controller)
// ----------------------------------------------
fs.readdirSync(fs.realpathSync('controllers',{})).forEach(function (file) {
    var route = require(fs.realpathSync('controllers',{}) +'/'+ file);      
    for( x in route){
        var action     = route[x];
        var uriname    = x.replace('index','');
        var uriname    = uriname.replace(/[A-Z]/g, function(s){ return "-" + s; }).toLowerCase();     
        var xfile      = file.replace('.js','') ;
        var xfile      = xfile == 'index' && uriname.length == 0 ? xfile.replace('index','') : xfile ;   
        var uri        = join('/',xfile,uriname);
        if( typeof( routes[uri] ) != 'undefined' ){          
          app[routes[uri].method](uri,action);
        }else{
          app.all(uri,action);
        }     
  	}
}); 

// Dynamically require models (models)
// ----------------------------------------------
fs.readdirSync(fs.realpathSync('models',{})).forEach(function(file,i) { 
      var name            = file.replace('.js','') ;
      var modelname       = name.charAt(0).toUpperCase() + name.slice(1);

      // console.log( join(fs.realpathSync('models',{}),'/', file) );
      //require file
      this[modelname] = require(join(fs.realpathSync('models',{}),'/', file));               
      
      //attributes
      this[modelname]._collection = name;

      //extendig model 
      this[modelname] = _.extend({}, model, this[modelname]);

      
});


app.use(function(req, res, next) {
  var err = new Error();
  //console.log(err);
  res.status(400).json({status:400,msg:'Bad Request'});      
});

global.tenant  		= { config:local, io:io };

// Run server
// ----------------------------------------------
module.exports.run = function(){

	
	// Allow Cors  	
	app.use(cors());  

	// Enable Trust Proxy
	app.enable('trust proxy', 1);

	// // Run HTTP Server
	// // ---------------------------------
	// app.listen(port, function () {
	//   //console.log( '========================================================='.strikethrough.green);
	//   console.log( (' Tenant Services running at port '+port + ' ').bgGreen.black);
	//   console.log( ('--------------------------------------------------').gray);
	// });

	// Run Socket Server
	// ---------------------------------
	http.listen(port, function () {
	  //console.log( '========================================================='.strikethrough.green);
	  console.log( (' Tenant Socket Services running at port '+port + ' ').bgGreen.black);
	  console.log( ('--------------------------------------------------').gray);
	});

}
