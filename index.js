'use strict';

require('./gen.js').run(function(err){
  if(err){
		process.exit(1);
	}
});
