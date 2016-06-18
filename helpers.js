'use strict';

var changeCase = require('change-case');

class Helpers {
  goFieldTypeFromJsType(jsType) {
    switch (jsType.toLowerCase()) {
      case "string": return "string";
      case "boolean": return "bool";
      case "number": return "int64";
      case "object": return "interface{}";
    }
    throw new Error(`Unsupported type '${jsType}' to convert to golang type.`)
  }

  getGoStructDefinitionFieldsFromMap(map, addGoTagComments) {
    let goLines = [];
    for (var key in map) {
      let fieldName = changeCase.pascalCase(key);
      let fieldValue = map[key];
      let fieldType = typeof fieldValue;
      let goFieldType = this.goFieldTypeFromJsType(fieldType);

      let tagComments = "";
      if (addGoTagComments) {
        tagComments = ' `json:"' + `${key}` + '"`';
      }

      goLines.push(`  ${fieldName} ${goFieldType}${tagComments}`);
    }
    return goLines;
  }
  
  getGoStructInitFieldsFromMap(map) {
    let goLines = [];
    for (var key in map) {
      let fieldName = changeCase.pascalCase(key);
      let paramName = changeCase.camelCase(key);
      let fieldValue = map[key];
      let fieldType = typeof fieldValue;
      let goFieldType = this.goFieldTypeFromJsType(fieldType);

      goLines.push(`${fieldName}: ${paramName},`);
    }
    return goLines;
  }

  getGoStructMethodParamsFromMap(map) {
    let params = [];
    for (var key in map) {
      let paramName = changeCase.camelCase(key);
      let fieldValue = map[key];
      let fieldType = typeof fieldValue;
      let goFieldType = this.goFieldTypeFromJsType(fieldType);
      params.push(`${paramName} ${goFieldType}`);
    }
    return params;
  }

  getGoNewMethodForStructFromMap(map, structName) {
    let goLines = [];
    let methodParams = this.getGoStructMethodParamsFromMap(map);
    goLines.push(`func New${structName}(${methodParams.join(', ')}) *${structName} {`);
    goLines.push(`  return &${structName} {`)
    let tmpGoLines2 = this.getGoStructInitFieldsFromMap(map);
    goLines = goLines.concat(tmpGoLines2);
    goLines.push(`  }`)
    goLines.push(`}`);
    return goLines;
  }
} 

module.exports = {
  helpers: new Helpers()
}
