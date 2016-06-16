'use strict';

var stripJsonComments = require('strip-json-comments');

class Api {
    constructor(title) {
        this.title = title;
        this.resourceGroups = [];
    }
}

class ResGroup {
    constructor(title) {
        this.title = title;
        this.resources = [];
    }
}

class Resource {
    constructor(title, href, members) {
        this.title = title;
        this.href = href;
        this.members = members;
        this.transitions = [];
    }
}

class ResourceMember {
    constructor(description, keyType, key, valueType, value) {
        this.description = description;
        this.keyType = keyType;
        this.key = key;
        this.valueType = valueType;
        this.value = value;
    }
}

class Transition {
    constructor(title) {
        this.title = title;
        this.httpTransactions = [];
    }
}

class HttpTransaction {
    constructor() { }
    setRequest(req) {
        this.request = req;
    }
    setResponse(resp) {
        this.response = resp;
    }
}

class HttpRequest {
    constructor(method, requestContent) {
        this.method = method;
        this.requestContent = requestContent;
    }
}

class HttpResponse {
    constructor(statusCode, contentType, messageBody) {
        this.statusCode = statusCode;
        this.contentType = contentType;
        this.messageBody = messageBody;
    }
}

module.exports = class Accumulator {
    constructor() {
        this.currentApi = null;
        this.currentResGroup = null;
        this.currentResource = null;
        this.currentTransition = null;
        this.currentHttpTx = null;
        this.currentHttpReq = null;
        this.currentHttpResp = null;

        this.apis = [];
    }

    handleNode(node) {
        if (node.element === 'parseResult') {
            this.handleParseResultNode(node);
        } else if (node.element === 'category') {
            if (node.meta.classes.findIndex(c => c === 'api') !== -1) {
                this.handleApiNode(node);
            } else if (node.meta.classes.findIndex(c => c === 'resourceGroup') !== -1) {
                this.handleResourceGroupNode(node);
            }
        } else if (node.element === 'resource') {
            this.handleResourceNode(node);
        } else if (node.element === 'transition') {
            this.handleTransitionNode(node);
        } else if (node.element === 'httpTransaction') {
            this.handleHttpTransactionNode(node);
        } else if (node.element === 'httpRequest') {
            this.handleHttpRequestNode(node);
        } else if (node.element === 'httpResponse') {
            this.handleHttpResponseNode(node);
        }
    }

    handleParseResultNode(node) {
        node.content.forEach(contentNode => {
            this.handleNode(contentNode);
        })
    }

    handleApiNode(node) {
        let prevApi = this.currentApi;
        this.currentApi = new Api(node.meta.title);
        this.apis.push(this.currentApi);

        node.content.forEach(contentNode => {
            this.handleNode(contentNode);
        });

        this.currentApi = prevApi;
    }

    handleResourceGroupNode(node) {
        let prevResGroup = this.currentResGroup;
        this.currentResGroup = new ResGroup(node.meta.title);
        this.currentApi.resourceGroups.push(this.currentResGroup);

        node.content.forEach(contentNode => {
            this.handleNode(contentNode);
        });

        this.currentResGroup = prevResGroup;
    }

    handleResourceNode(node) {
        let prevResource = this.currentResource;

        var members = [];
        if (node.attributes.hrefVariables) {
            node.attributes.hrefVariables.content.forEach(contentNode => {
                members.push(new ResourceMember(
                    contentNode.meta.description,
                    contentNode.content.key.element,
                    contentNode.content.key.content,
                    contentNode.content.value.element,
                    contentNode.content.value.content))
            });
        }

        this.currentResource = new Resource(node.meta.title, node.attributes.href, members);
        this.currentResGroup.resources.push(this.currentResource);

        node.content.forEach(contentNode => {
            this.handleNode(contentNode);
        });

        this.currentResource = prevResource;
    }

    handleTransitionNode(node) {
        let prevTransition = this.currentTransition;
        this.currentTransition = new Transition(node.meta.title);
        this.currentResource.transitions.push(this.currentTransition);

        node.content.forEach(contentNode => {
            this.handleNode(contentNode);
        });

        this.currentTransition = prevTransition;
    }

    handleHttpTransactionNode(node) {
        let prevHttpTx = this.currentHttpTx;
        this.currentHttpTx = new HttpTransaction();
        this.currentTransition.httpTransactions.push(this.currentHttpTx);

        node.content.forEach(contentNode => {
            this.handleNode(contentNode);
        });

        this.currentHttpTx = prevHttpTx;
    }

    handleHttpRequestNode(node) {
        let prevHttpReq = this.currentHttpReq;
        
        let requestContent = null;
        if (node.content && node.content.length > 0) {
          if (node.content.length > 1) {
            throw new Error("Multiple content nodes for httpRequest is not supported.")
          }
          let firstContentNode = node.content[0];
          requestContent = JSON.parse(stripJsonComments(firstContentNode.content));
        }

        this.currentHttpReq = new HttpRequest(node.attributes.method, requestContent);
        this.currentHttpTx.setRequest(this.currentHttpReq);

        this.currentHttpReq = prevHttpReq;
    }

    handleHttpResponseNode(node) {
        let prevHttpResp = this.currentHttpResp;

        let contentType = null;
        if (node.attributes && node.attributes.headers) {
            node.attributes.headers.content.forEach(contentNode => {
                if (contentNode.content.key.content == 'Content-Type') {
                    contentType = contentNode.content.value.content;
                }
            });
        }

        let messageBody = null;
        if (node.content) {
            node.content.forEach(contentNode => {
                if (contentNode.element == 'asset' && contentNode.meta && contentNode.meta.classes && contentNode.meta.classes.findIndex(c => c === 'messageBody') !== -1) {
                    var contentType = contentNode.attributes.contentType;
                    if (contentType === 'application/json') {
                        messageBody = JSON.parse(stripJsonComments(contentNode.content));
                    } else {
                        throw new Error(`Http Response ContentType of '${contentType}' is not yet supported`)
                    }
                }
            });
        }

        this.currentHttpResp = new HttpResponse(node.attributes.statusCode, contentType, messageBody);
        this.currentHttpTx.setResponse(this.currentHttpResp);

        this.currentHttpResp = prevHttpResp;
    }
}
