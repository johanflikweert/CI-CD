/* var program_name = process.argv[0]; //value will be "node"
var script_path = process.argv[1]; //value will be "yourscript.js"
const first_value = process.argv[2]; //value will be "banana"
const second_value = process.argv[3]; //value will be "monkey"

console.log(first_value)
console.log(second_value)
console.log(script_path)
console.log(program_name) */

//input
const appToDeploy = 'style test';
const branchToDeploy = 'trunk'; //trunk is mainline
const packageCheckingInterval = 10000; //in ms
const startingCheckingInterval = 5000; //in ms
const environment = 'Acceptance'; //values: Test, Acceptance, Production
const headers = {
	"mendix-UserName": 'jonathan.deloo@firstconsulting.nl',
	"mendix-APIKey": 'c8a105a1-9285-46f4-82bc-2b1b70dc66e4'
};

//unused (but required/helpful in future to avoid script running eternally)
const maxWaitMinsForPackageBuilding = 10;
const maxWaitMinsForAppStarting = 10;

//global variables


//constants
//const hostname = 'deploy.mendix.com';
const https = require('https');


//http GET request
function httpGetRequest(options,callback){
	
	const req = https.request(options, (res) => {
		//console.log('statusCode:', res.statusCode);
		//console.log('headers:', res.headers);
		let rawData = '';
		res.on('data', (chunk) => {
			rawData += chunk;
		});
		
		res.on('end', () => {
			try {
				callback(rawData.replace(/\n|\r/g, ""));
			} catch (e) {
				console.error(e.message);
			}
		});  
	});
		
	req.on('error', (e) => {
		console.log('error');
		console.error(e);
	});
	req.end();		
} 

// http POST request
// payload: json string with parameters
function httpPostRequest(options,payload,callback){
	
	const req = https.request(options, (res) => {
		//console.log('statusCode:', res.statusCode);
		//console.log('headers:', res.headers);
		let rawData = '';
		res.on('data', (chunk) => {
			rawData += chunk;
		});
		
		res.on('end', () => {
			try {
				callback(rawData.replace(/\n|\r/g, ""));
			} catch (e) {
				console.error(e.message);
			}
		});  
	});
		
	req.on('error', (e) => {
		console.log('error');
		console.error(e);
	});
	req.write(payload);
	req.end();		
} 

//get all apps for API key account
function getApps(headers,callback){
	
	const options = {
		hostname: 'deploy.mendix.com',
		path: '/api/1/apps/',
		method: 'GET',
		headers: headers
	};
	
	httpGetRequest(options,function(json){
		callback(JSON.parse(json));
	});
}

//get branch information
function getBranch(headers,appId,branch,callback){

	const options = {
		hostname: 'deploy.mendix.com',
		path: encodeURI('/api/1/apps/' + appId + '/branches/' + branch),
		method: 'GET',
		headers: headers
	};
	httpGetRequest(options,function(json){
		callback(JSON.parse(json));
	});
}

//start building package
function startBuild(headers,appId,branchName,revisionNumber,callback){
	
	const payload = {
		Revision : revisionNumber,
		Version : '1.0.0', //for now version hardcoded...
		Branch : branchName
	};

	const options = {
		hostname: 'deploy.mendix.com',
		path: encodeURI('/api/1/apps/' + appId + '/packages/'),
		method: 'POST',
		headers: headers,
	};

	
	httpPostRequest(options,JSON.stringify(payload),function(json){
		callback(JSON.parse(json).PackageId);
	});
}

//check build status of package
function checkBuild(headers,appId,packageId,callback) {
	
	const options = {
		hostname: 'deploy.mendix.com',
		path: encodeURI('/api/1/apps/' + appId + '/packages/' + packageId),
		method: 'GET',
		headers: headers
	};
	
	httpGetRequest(options,function(packageObj){
		
		//Needs check for error, queud, building
 		if(JSON.parse(packageObj).Status == 'Succeeded'){
			console.log('Successfully built package')
			callback(true);
		} else {
			console.log('Still building');		
		}
	});
	
}

//start app
function startApp(headers,appId,environment,callback){
		
	const payload = {
		AutoSyncDb : true
	};

	const options = {
		hostname: 'deploy.mendix.com',
		path: encodeURI('/api/1/apps/' + appId + '/environments/' + environment + '/start'),
		method: 'POST',
		headers: headers
	};

	
	httpPostRequest(options,JSON.stringify(payload),function(json){
		console.log('Starting ' + environment + ' environment');
		callback(JSON.parse(json).JobId);
	}); 
	
}

//stop app
function stopApp(headers,appId,environment,callback){
	
	const payload = {};
	const options = {
		hostname: 'deploy.mendix.com',
		path: encodeURI('/api/1/apps/' + appId + '/environments/' + environment + '/stop'),
		method: 'POST',
		headers: headers
	};

	
	httpPostRequest(options,JSON.stringify(payload),function(){
		console.log('Successfully stopped environment')
		callback();
	});
	
}

//deploy app
function deployApp(headers,appId,packageId,environment,callback){

	const payload = {		
		PackageId : packageId
	};
	
	const options = {
		hostname: 'deploy.mendix.com',
		path: encodeURI('/api/1/apps/' + appId + '/environments/' + environment + '/transport'),
		method: 'POST',
		headers: headers
	};

	httpPostRequest(options,JSON.stringify(payload),function(){
		console.log('Successfully deployed package');
		callback();
	});	
}

//combined stop and deploy
function stopAndDeployApp(headers,appId,packageId,environment,callback){
	
	getEnvironmentStatus(headers,appId,environment,function(environmentStatus){
		
		if(environmentStatus.Status != "Stopped"){
			stopApp(headers,appId,environment,function(){
				console.log('Deploying package');
				deployApp(headers,appId,packageId,environment,function(){
					callback()
				})	
			});
		} else {
			console.log('Deploying package');
			deployApp(headers,appId,packageId,environment,function(){
				callback()
			});			
		}
	});
}


function getEnvironmentStatus(headers,appId,environment,callback){

	const options = {
		hostname: 'deploy.mendix.com',
		path: encodeURI('/api/1/apps/' + appId + '/environments/' + environment),
		method: 'GET',
		headers: headers
	};
	
	httpGetRequest(options,function(json){
		callback(JSON.parse(json));
	});
}

//Get environment start status
function getEnvironmentStartStatus(headers,appId,environment,jobId,callback){
	
	const options = {
		hostname: 'deploy.mendix.com',
		path: encodeURI('/api/1/apps/' + appId + '/environments/' + environment + '/start/' + jobId),
		method: 'GET',
		headers: headers
	};

	httpGetRequest(options,function(json){
		if(JSON.parse(json).Status == 'Started'){
			console.log('Successfully started ' + environment + ' environment')
			callback(true);
		} else {
			console.log('Still starting');
		}
	});
	
	
}


//Retrieve environment package
function getEnvironmentPackage(headers,appId,environment,callback){
	
	const options = {
		hostname: 'deploy.mendix.com',
		path: encodeURI('/api/1/apps/' + appId + '/environments/' + environment + '/package'),
		method: 'GET',
		headers: headers
	};

	httpGetRequest(options,function(json){
		callback(JSON.parse(json)); // the version attribute in this json string contains the revision number!!
	});
	
	
}


//Script start
console.log('Starting execution of script');
getApps(headers, function(appObjs){

	//find appObj in array appObjs that corresponds the the app that needs to be deployed
	const appObj = appObjs.find(x => x.Name === appToDeploy);		//find Appobj in array appObjs based on name
	const appId = appObj.AppId; //extract appId from AppObj
	
	console.log('Found the following App ID for the ' + appToDeploy + ' app to deploy: ' + appId);

	//get the details of the branch to deploy
	getBranch(headers,appId,branchToDeploy,function(branch){
		
		console.log('Latest revision of the ' + branchToDeploy + ' branch: ' + branch.LatestRevisionNumber);
		
		
		getEnvironmentPackage(headers,appId,environment,function(environmentStatus){
			
			if(branch.LatestRevisionNumber > environmentStatus.Version.substring(environmentStatus.Version.lastIndexOf('.')+1)){
				//build the latest revision of the branch
				startBuild(headers,appId,branch.Name,branch.LatestRevisionNumber,function(packageId){
					console.log('Started building package for revision ' + branch.LatestRevisionNumber)

					
					const IntervalId = setInterval(function(headers,appId,packageId){checkBuild(headers,appId,packageId, function(buildReady){
						
						if(buildReady == true){
							
							clearInterval(IntervalId);
							stopAndDeployApp(headers,appId,packageId,environment,function(){
								startApp(headers,appId,environment,function(jobId){
								
									
									//add headers to interval!!!!!! TODO 2x
									const IntervalId2 = setInterval(function(headers,appId,environment,jobId){getEnvironmentStartStatus(headers,appId,environment,jobId, function(appStarted){
										
										clearInterval(IntervalId2);
										console.log('Finished execution of script');
										
									})},startingCheckingInterval,headers,appId,environment,jobId);
								
								
								});
							});
						}
						
					})},packageCheckingInterval,headers,appId,packageId); 
				});
			} else {
				console.log('Latest revision already deployed on ' + environment);
				//if latest version already deployed, but app not started yet, then we are stuck...
			}
		});
	});	
});




