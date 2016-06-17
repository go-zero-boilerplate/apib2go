'use strict';

var accumulatorClass = require('./accumulator');

var path = require('path');
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

var goPackageName = 'main';

var goLines = [
  `package ${goPackageName}`,
  '',
];

var echoApiFiles = {};
var allEchoRouterLines = [];

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

  let apiFileName = 'api_' + changeCase.snakeCase(apiGoTypeName) + ".go";
  let goEcho = new GoEchoV2Api(api);
  goEcho.generateApiCode();

  allEchoRouterLines = allEchoRouterLines.concat(goEcho.echoRouterLines);

  let allLines = [
    `package ${goPackageName}`,
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

class GoFileWriter {
  constructor(baseDir) {
    this.baseDir = baseDir;
  }

  writeGoFile(relPath, content) {
    let combinedPath = path.join(this.baseDir, relPath);
    fs.writeFileSync(combinedPath, content);
    console.log(`\nWritten file ${combinedPath}`);
    console.log('Output of go fmt: ' + child_process.execFileSync('go', ['fmt', combinedPath]).toString());
  }
}

var baseDir = 'out_go';
var goFileWriter = new GoFileWriter(baseDir);

for (var fileName in echoApiFiles) {
  var tmpLines = echoApiFiles[fileName];
  goFileWriter.writeGoFile(fileName, tmpLines.join("\n"));
}
// console.log("ECHO API FILES: ", echoApiFiles);
// console.log(util.inspect(accumulator.apis, { showHidden: false, depth: null }));
// console.log("GO CODE:");
// console.log(goLines.join("\n"));
// console.log(allEchoRouterLines);

let allRouterLines = [
  `package ${goPackageName}`,
  '',
  'import (',
  '  "fmt"',
  '  "log"',
  '',
  '  "github.com/labstack/echo"',
  ')',
  '',
  `type localLogger interface {`,
  `  WithField(key string, value interface{}) localLogger`,
  `}`,
  '',
  `type controllerAdder struct {`,
  `  logger localLogger`,
  `  ctx    *Context`,
  `}`,
  '',
  `type cGet interface {`,
  `  GET(c echo.Context) error`,
  `}`,
  `type cPost interface {`,
  `  POST(c echo.Context) error`,
  `}`,
  `type cPut interface {`,
  `  PUT(c echo.Context) error`,
  `}`,
  `type cDelete interface {`,
  `  DELETE(c echo.Context) error`,
  `}`,
  '',
  `type controller interface {`,
  `  SetBaseCtrl(base *BaseController)`,
  `}`,
  '',
  `type EchoOrGroup interface {`,
  `  GET(path string, h echo.HandlerFunc, m ...echo.MiddlewareFunc)`,
  `  POST(path string, h echo.HandlerFunc, m ...echo.MiddlewareFunc)`,
  `  PUT(path string, h echo.HandlerFunc, m ...echo.MiddlewareFunc)`,
  `  DELETE(path string, h echo.HandlerFunc, m ...echo.MiddlewareFunc)`,
  `}`,
  ``,
  `func (c *controllerAdder) AddPaths(paths []string, e EchoOrGroup, ctrl controller, mware ...echo.MiddlewareFunc) {`,
  `    baseCtrl := getNewBaseController(c.ctx, c.logger.WithField("controller", fmt.Sprintf("%T", c)))`,
  `    ctrl.SetBaseCtrl(baseCtrl)`,
  ``,
  `    cnt := 0`,
  `    for _, path := range paths {`,
  `      if get, ok := ctrl.(cGet); ok {`,
  `        cnt++`,
  `        e.GET(path, get.GET, mware...)`,
  `      }`,
  `      if post, ok := ctrl.(cPost); ok {`,
  `        cnt++`,
  `        e.POST(path, post.POST, mware...)`,
  `      }`,
  `      if put, ok := ctrl.(cPut); ok {`,
  `        cnt++`,
  `        e.PUT(path, put.PUT, mware...)`,
  `      }`,
  `      if del, ok := ctrl.(cDelete); ok {`,
  `        cnt++`,
  `        e.DELETE(path, del.DELETE, mware...)`,
  `      }`,
  `    }`,
  `    if cnt == 0 {`,
  `      log.Fatalf("No controller methods found to register for controller %T", c)`,
  `    }`,
  `  }`,
];
allRouterLines.push(`func Router(ctrlAdder *controllerAdder, e EchoOrGroup) {`);
allRouterLines = allRouterLines.concat(allEchoRouterLines);
allRouterLines.push(`}`);
goFileWriter.writeGoFile('apib_router.go', allRouterLines.join("\n"));

goFileWriter.writeGoFile('apib_definitions.go', goLines.join("\n"));
