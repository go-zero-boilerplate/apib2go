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
} 

module.exports = {
  helpers: new Helpers()
}
