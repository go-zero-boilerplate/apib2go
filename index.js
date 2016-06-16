'use strict';

var accumulatorClass = require('./accumulator');

var fs = require('fs');
var changeCase = require('change-case');
var protagonist = require('protagonist');
var child_process = require('child_process');
var util = require("util");
var helpers = require('./helpers').helpers;
var GoEchoV2Api = require('./goEchoV2Api');

var examplePath = "example.apib";
var fileContent = fs.readFileSync(examplePath);
var json = protagonist.parseSync(fileContent.toString());

var accumulator = new accumulatorClass();

if (json.element !== 'parseResult') {
  throw new Error("Root element should be parseResult");
}

accumulator.handleNode(json);

var goLines = [
  'package main',
  '',
];

var echoApiFiles = {};

accumulator.apis.forEach(api => {
  api.resourceGroups.forEach(group => {
    group.resources.forEach(resource => {
      resource.transitions.forEach(transition => {
        let transitionMethodName = changeCase.pascalCase(transition.title);
        
        if (transition.httpTransactions.length !== 1) {
          throw new Error(`Transition '${transition.title}' does not have exactly 1 httpTransaction, this is not currently supported`);
        }
        
        var firstHttpTx = transition.httpTransactions[0];

        if (firstHttpTx.request.requestContent) {
          goLines.push(`type ${transitionMethodName}Input struct {`);
          let tmpGoLines = helpers.getGoStructDefinitionFieldsFromMap(firstHttpTx.request.requestContent, true);
          goLines = goLines.concat(tmpGoLines);
          goLines.push(`}`);
        }

        goLines.push(`// ${transitionMethodName} from APIBlueprint Transition '${transition.title}'`);
        goLines.push(`type ${transitionMethodName}Result struct {`);

        var messageBody = firstHttpTx.response.messageBody;
        let tmpGoLines = helpers.getGoStructDefinitionFieldsFromMap(messageBody, true);
        goLines = goLines.concat(tmpGoLines);

        goLines.push(`}`);
      });

      let resourceGoInterfaceName = changeCase.pascalCase(resource.title);
      goLines.push(`// ${resourceGoInterfaceName}Resource from APIBlueprint Resource '${resource.title}'`);
      goLines.push(`type ${resourceGoInterfaceName}Resource interface {`);

      resource.transitions.forEach(transition => {
        let transitionMethodName = changeCase.pascalCase(transition.title);

        let methodParams = [];
        resource.members.forEach(member => {
          var goParamName = changeCase.camelCase(member.key);
          let memberGoValueType = helpers.goFieldTypeFromJsType(member.valueType);
          methodParams.push(`${goParamName} ${memberGoValueType}`);
        });

        if (transition.httpTransactions.length !== 1) {
          throw new Error(`Transition '${transition.title}' does not have exactly 1 httpTransaction, this is not currently supported`);
        }
        var firstHttpTx = transition.httpTransactions[0];
        if (firstHttpTx.request.requestContent) {
          methodParams.push(`postData *${transitionMethodName}Input`);
        }

        let joinedMethodParams = methodParams.join(', ');
        goLines.push(`  ${transitionMethodName}(${joinedMethodParams}) (*${transitionMethodName}Result, error)`);
      });

      goLines.push(`}`);
    });

    let groupGoTypeName = changeCase.pascalCase(group.title);
    goLines.push(`// ${groupGoTypeName}Group from APIBlueprint Group '${group.title}'`);
    goLines.push(`type ${groupGoTypeName}Group struct {`);

    group.resources.forEach(resource => {
      let resourceGoInterfaceName = changeCase.pascalCase(resource.title);
      goLines.push(`  ${resourceGoInterfaceName} *${resourceGoInterfaceName}Resource`);
    });

    goLines.push(`}`);
  });

  let apiGoTypeName = changeCase.pascalCase(api.title);
  goLines.push(`// ${apiGoTypeName}API from APIBlueprint API '${api.title}'`);
  goLines.push(`type ${apiGoTypeName}API struct {`);

  let apiFileName = changeCase.snakeCase(apiGoTypeName) + ".go";
  let goEcho = new GoEchoV2Api(api);
  goEcho.generateApiCode();

  let allLines = [
    'package main',
  ];
  allLines.push('import (');
  goEcho.goImports.forEach(importLine => allLines.push(`"${importLine}"`));
  allLines.push(')');
  allLines = allLines.concat(goEcho.goLines);
  echoApiFiles[apiFileName] = allLines;

  api.resourceGroups.forEach(group => {
    let groupGoTypeName = changeCase.pascalCase(group.title);
    goLines.push(`  ${groupGoTypeName} *${groupGoTypeName}Group`);
  });
  goLines.push(`}`)
});

var outDir = 'out_go';

for (var fileName in echoApiFiles) {
  var tmpLines = echoApiFiles[fileName];
  var tmpFilePath = `${outDir}/${fileName}`;
  fs.writeFileSync(tmpFilePath, tmpLines.join("\n"));
  console.log(`\nWritten file ${tmpFilePath}`);
  console.log('Output of go fmt: ' + child_process.execFileSync('go', ['fmt', tmpFilePath]).toString());
}
// console.log("ECHO API FILES: ", echoApiFiles);
// console.log(util.inspect(accumulator.apis, { showHidden: false, depth: null }));
// console.log("GO CODE:");
// console.log(goLines.join("\n"));

var outFile = `${outDir}/tmp.go`;
fs.writeFileSync(outFile, goLines.join("\n"));
console.log(`\nWritten file ${outFile}`);
console.log('Output of go fmt: ' + child_process.execFileSync('go', ['fmt', outFile]).toString());
