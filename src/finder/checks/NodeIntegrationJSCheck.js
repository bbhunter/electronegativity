import { sourceTypes } from "../../parser/types";

export default class NodeIntegrationJSCheck {
  constructor() {
    this.id = 'NODE_INTEGRATION_JS_CHECK';
    this.description = `Disable nodeIntegration for untrusted origins`;
    this.type = sourceTypes.JAVASCRIPT;
  }

  //nodeIntegration Boolean (optional) - Whether node integration is enabled. Default is true.
  //nodeIntegrationInWorker Boolean (optional) - Whether node integration is enabled in web workers. Default is false

  match(astNode, astHelper){
    if (astNode.type !== 'NewExpression') return null;
    if (astNode.callee.name !== 'BrowserWindow') return null;

    let nodeIntegrationFound = false;
    let locations = [];
    if (astNode.arguments.length > 0) {
      let loc = [];
      nodeIntegrationFound = this.findNode(astHelper, astNode.arguments[0], 'nodeIntegration', value => value === false, loc);
      // nodeIntegrationInWorker default value is safe
      // so no check for return value (don't care if it was found)
      this.findNode(astHelper, astNode.arguments[0], 'nodeIntegrationInWorker', value => value !== true, loc);

      let sandboxLoc = [];
      let sandboxFound = this.findNode(astHelper, astNode.arguments[0], 'sandbox', value => value !== true, sandboxLoc);
      if (!sandboxFound || sandboxLoc.length <= 0) // sandbox disables node integration
        locations = locations.concat(loc);
    }

    if (!nodeIntegrationFound) {
      let manualReview = false;
      if (astNode.arguments.length > 0 && astNode.arguments[0].type !== "ObjectExpression") {
        manualReview = true;
      }
      locations.push({ line: astNode.loc.start.line, column: astNode.loc.start.column, id: this.id, description: this.description, manualReview });
    }

    return locations;
  }

  findNode(ast, startNode, name, skipCondition, locations) {
    let found = false;

    const nodes = ast.findNodeByType(startNode, ast.PropertyName, ast.PropertyDepth, false, node => {
      return node.key.value === name || node.key.name === name;
    });

    for (const node of nodes) {
      // in practice if there are two keys with the same name, the value of the last one wins
      // but technically it is an invalid json
      // just to be on the safe side show a warning if any value is insecure
      found = true;
      let isIdentifier = (node.value.type === "Identifier")? true : false;
      if (skipCondition(node.value.value)){
        if ((node.key.value === "sandbox" || node.key.name === "sandbox") && isIdentifier) continue;
        if ((node.key.value === "nodeIntegration" || node.key.name === "nodeIntegration" || node.key.value === "nodeIntegrationInWorker" || node.key.name === "nodeIntegrationInWorker") && !isIdentifier) continue;
      }
        
      locations.push({
        line: node.key.loc.start.line,
        column: node.key.loc.start.column,
        id: this.id,
        description: this.description,
        manualReview: isIdentifier
      });
    }

    return found;
  }
}
