#!/usr/bin/env node

process.title = 'apib2go';

require('./gen.js').run(function(err){
	if(err){
		process.exit(1);
	}
});
