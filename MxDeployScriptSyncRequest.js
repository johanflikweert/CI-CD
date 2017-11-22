const appToDeploy = process.argv[2]; 
const branchToDeploy = process.argv[3];
const environment = process.argv[4]; 
const MxUsername = process.argv[5];
const MxAPIKey = process.argv[6];


console.log(appToDeploy)
console.log(branchToDeploy)
console.log(environment)
console.log(MxUsername)
console.log(MxAPIKey)

//input
const headers = {
	"mendix-UserName": MxUsername,
	"mendix-APIKey": MxAPIKey
};

//fixed values for now
const packageCheckingInterval = 10000; //in ms
const startingCheckingInterval = 5000; //in ms

//unused (but required/helpful in future to avoid script running eternally)
const maxWaitMinsForPackageBuilding = 10;
const maxWaitMinsForAppStarting = 10;

//global variables


//constants
const https = require('sync-request');


function syncRequest(method,url,options){
	//console.log('starting https request' + method+ ' '+ url+ ' '+ options)
	req = https(method,url,options);
	//console.log(req.body.toString())
	
	//for some calls mendix returns json for others text.
	if (req.headers["content-type"].indexOf('json') != -1) {
		return JSON.parse(req.body.toString());
	} else {

		return req.body.toString();
	}
}

function getApps(headers){
	
	const url = 'https://deploy.mendix.com/api/1/apps/';
	const method = 'GET';
	const options = {
		headers: headers
	};
	
	return syncRequest(method,url,options);
}

function getBranch(headers,appId,branch){

	const url = 'https://deploy.mendix.com' + encodeURI('/api/1/apps/' + appId + '/branches/' + branch);
	const method = 'GET';
	const options = {
		headers: headers
	};
	
	return syncRequest(method,url,options)

}


function getEnvironmentPackage(headers,appId,environment){

	const url = 'https://deploy.mendix.com' + encodeURI('/api/1/apps/' + appId + '/environments/' + environment + '/package');
	const method = 'GET';
	const options = {
		headers: headers
	};
	
	return syncRequest(method,url,options)

}


//start building package
function startBuild(headers,appId,branchName,revisionNumber){
	
	const payload = {
		Revision : revisionNumber,
		Version : '1.0.0', //for now version hardcoded...
		Branch : branchName
	};

	const url = 'https://deploy.mendix.com' + encodeURI('/api/1/apps/' + appId + '/packages/');
	const method = 'POST';
	const options = {
		json: payload,
		headers: headers
	};
	
	return syncRequest(method,url,options);
}


//check build status of package
function checkBuild(headers,appId,packageId){
	

	const url = 'https://deploy.mendix.com' + encodeURI('/api/1/apps/' + appId + '/packages/' + packageId);
	const method = 'GET';
	const options = {
		headers: headers
	};
	
	return syncRequest(method,url,options);
}


//get environment status
function getEnvironmentStatus(headers,appId,environment){
	
	const url = 'https://deploy.mendix.com' + encodeURI('/api/1/apps/' + appId + '/environments/' + environment);
	const method = 'GET';
	const options = {
		headers: headers
	};
	
	return syncRequest(method,url,options);
}

//stop environment
function stopApp(headers,appId,environment){
	const payload = {dummy: 'test'};

	const url = 'https://deploy.mendix.com' + encodeURI('/api/1/apps/' + appId + '/environments/' + environment + '/stop');
	const method = 'POST';
	const options = {
		json: payload,
		headers: headers
	};
	return syncRequest(method,url,options);
}

//deploy app
function deployApp(headers,appId,packageId,environment){

	const payload = {		
		PackageId : packageId
	};
	
	const url = 'https://deploy.mendix.com' + encodeURI('/api/1/apps/' + appId + '/environments/' + environment + '/transport');
	const method = 'POST';
	const options = {
		json: payload,
		headers: headers
	};
	return syncRequest(method,url,options);
}


function stopAndDeployApp(headers,appId,packageId,environment){
	
	const environmentStatus = getEnvironmentStatus(headers,appId,environment);
		
	if(environmentStatus.Status != "Stopped"){
		stopApp(headers,appId,environment);
		console.log('Environment stopped');
		deployApp(headers,appId,packageId,environment);
		console.log('App deployed');
	} else {
		console.log('Environment already stopped');
		deployApp(headers,appId,packageId,environment);
		console.log('App deployed');
	}
}


//start app
function startApp(headers,appId,environment){
		
	const payload = {
		AutoSyncDb : true
	};

	const url = 'https://deploy.mendix.com' + encodeURI('/api/1/apps/' + appId + '/environments/' + environment + '/start');
	const method = 'POST';
	const options = {
		json: payload,
		headers: headers
	};
	
	return syncRequest(method,url,options);
}



//Get environment start status
function getEnvironmentStartStatus(headers,appId,environment,jobId){
	
	const url = 'https://deploy.mendix.com' + encodeURI('/api/1/apps/' + appId + '/environments/' + environment + '/start/' + jobId);
	const method = 'GET';
	const options = {
		headers: headers
	};
		
	return syncRequest(method,url,options);	
}



//Script start
console.log('Starting execution of script');


//Get all apps for provided Mendix Username	
const appObjs = getApps(headers);

// extract correct App Id based on provided AppToDeploy
const appObj = appObjs.find(x => x.Name === appToDeploy);		//find Appobj in array appObjs based on name
const appId = appObj.AppId; //extract appId from AppOb
console.log('Found the following App ID for the ' + appToDeploy + ' app to deploy: ' + appId);

//Get branch information based on provided branch to deploy
const branch = getBranch(headers,appId,branchToDeploy);
console.log('Latest revision of the ' + branchToDeploy + ' branch: ' + branch.LatestRevisionNumber);

//Get package currently deployed on environment
const environmentPackage = getEnvironmentPackage(headers,appId,environment);

// if the branch contains a later version than deployed on environment, then start a new deployment, else there is nothing to do 
if(branch.LatestRevisionNumber > environmentPackage.Version.substring(environmentPackage.Version.lastIndexOf('.')+1)){
	
	//build a new package
	const buildResponse = startBuild(headers,appId,branch.Name,branch.LatestRevisionNumber);
	console.log('Started building package for revision ' + branch.LatestRevisionNumber);
	const packageId = buildResponse.PackageId;
	
	//check package building every x seconds
	const intervalIdPackageBuilding = setInterval(function(headers,appId,packageId){
		packageInfo = checkBuild(headers,appId,packageId)
		
		//once package building succeeded, stop package checking and proceed with deploying
		if(packageInfo.Status == "Succeeded"){
			clearInterval(intervalIdPackageBuilding);
			console.log('Successfully built package');
			
			//stop app, deploy package and start app
			stopAndDeployApp(headers,appId,packageId,environment);
			const startStatus = startApp(headers,appId,environment);
			
			//check app starting every x seconds
			const intervalIdEnvironmentStart = setInterval(function(headers,appId,environment,jobId){
				
				environmentStartStatus = getEnvironmentStartStatus(headers,appId,environment,jobId);
				console.log(environmentStartStatus);				
				//once app starting succeeded finish script
				if (environmentStartStatus.Status == 'Started'){
					clearInterval(intervalIdEnvironmentStart);
					console.log('Finished execution of script');
					
				} else {
					console.log('Still starting');			
				}				

											
			},startingCheckingInterval,headers,appId,environment,startStatus.JobId);
			
		} else {
			console.log('Still building');		
		}
		
	},packageCheckingInterval,headers,appId,packageId);
	
} else {
	console.log('Latest revision already deployed on ' + environment);
	//if latest version already deployed, but app not started yet, then we are stuck...
}






