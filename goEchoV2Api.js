'use strict';

var changeCase = require('change-case');
var helpers = require('./helpers').helpers;

module.exports = class GoEchoV2Api {
  constructor(api) {
    this.api = api;
    this.goImports = [];
    this.goLines = [];
  }

  generateApiCode() {
    this.goImports = this.goImports.concat([
      'net/http',
      'strings',
      'fmt',
      'github.com/labstack/echo',
    ]);

    this.api.resourceGroups.forEach(group => {
      group.resources.forEach(resource => {
        this.handleResource(resource);
      });
    });
  }

  handleResource(resource) {
    let resourceGoStructName = changeCase.camelCase(resource.title);
    let resourceGoInterfaceName = changeCase.pascalCase(resource.title);

    this.goLines.push(``);
    this.goLines.push(`func New${resourceGoInterfaceName}Resource(resource ${resourceGoInterfaceName}Resource) *${resourceGoStructName}Resource {`);
    this.goLines.push(`  return &${resourceGoStructName}Resource {`);
    this.goLines.push(`    resource: resource,`);
    this.goLines.push(`  }`);
    this.goLines.push(`}`);


    this.goLines.push(`// ${resourceGoStructName}Resource from APIBlueprint Resource  '${resource.title}'`);
    this.goLines.push(`type ${resourceGoStructName}Resource struct {`);
    this.goLines.push(`  resource ${resourceGoInterfaceName}Resource`);
    this.goLines.push(`}`);

    resource.transitions.forEach(transition => {
      this.handleTransition(transition, resourceGoStructName, resource.members);
    });
  }

  handleTransition(transition, resourceGoStructName, resourceMembers) {
    if (transition.httpTransactions.length !== 1) {
      throw new Error(`Transition '${transition.title}' does not have exactly 1 httpTransaction, this is not currently supported`);
    }
    var firstHttpTx = transition.httpTransactions[0];
    var methodUpper = firstHttpTx.request.method.toUpperCase();
    let transitionMethodName = changeCase.pascalCase(transition.title);

    var firstLetter = resourceGoStructName[0];
    this.goLines.push(`// ${methodUpper} from APIBlueprint Transition '${transition.title}'`);
    this.goLines.push(`func (${firstLetter} *${resourceGoStructName}Resource) ${methodUpper}(echoCtx echo.Context) error {`);

    let methodCallParams = [];
    resourceMembers.forEach(member => {
      this.handleMemberGetFromQuery(member, methodCallParams);
    });

    if (firstHttpTx.request.requestContent) {
      this.goLines.push(`var postData *${transitionMethodName}Input`);
      this.goLines.push(`if err := echoCtx.Bind(postData); err != nil {`);
		  this.goLines.push(`  return fmt.Errorf("Cannot parse body, error: %s", err.Error())`);
	    this.goLines.push(`}`);
      methodCallParams.push(`postData`);
    }

    let joinedMethodParams = methodCallParams.join(', ');
    this.goLines.push(`  result, err := ${firstLetter}.resource.${transitionMethodName}(${joinedMethodParams})`);
    this.goLines.push(`  if err != nil {`);
    this.goLines.push(`    return err`);
    this.goLines.push(`  }`);
    this.goLines.push(`  return echoCtx.JSON(http.StatusOK, result)`);
    this.goLines.push(`}`);
  }

  handleMemberGetFromQuery(member, methodCallParams) {
    let goVar = `${changeCase.camelCase(member.key)}`;
    let goVarStr = `${goVar}Str`;
    this.goLines.push(`  ${goVarStr} := strings.TrimSpace(echoCtx.QueryParam("${member.key}"))`);

    let goType = helpers.goFieldTypeFromJsType(member.valueType);
    switch (goType) {
      case "string":
        this.goLines.push(`if ${goVarStr} == "" {`);
        this.goLines.push(`  return fmt.Errorf("Query param '${member.key}' is required")`);
        this.goLines.push(`}`);
        this.goLines.push(``);
        methodCallParams.push(goVarStr);
        break;
      case "int64":
        if (this.goImports.indexOf('strconv') === -1) {
          this.goImports.push('strconv');
        }
        this.goLines.push(`${goVar}, err := strconv.ParseInt(${goVarStr}, 10, 64)`);
        this.goLines.push(`if err != nil {`);
        this.goLines.push(`  return err`);
        this.goLines.push(`}`);
        methodCallParams.push(goVar);
        break;
      default:
        throw new Error(`Query param for go type '${goType}' is not yet implemented.`);
    }
  }
}
