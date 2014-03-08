/**
 * Created by azu on 2014/03/06.
 * LICENSE : MIT
 */
"use strict";
var esprima = require('esprima');
var estraverse = require('estraverse');
var clone = require("clone");
function mechamocha(code, options) {
    var ast = esprima.parse(code, {
        range: true
    });
    var defaultsOption = {
        indent: "  ",
        spacer: " ",
        rootMark: ""
    };

    function getOptions(options) {
        return require("lodash.merge")(defaultsOption, (options || {}));
    }

    var definedOptions = getOptions(options);

    function createHelper(code, options) {
        return {
            contextIdentifierNames: ["describe", "context", "it"],
            isContext: function (node) {
                return node.type === estraverse.Syntax.ExpressionStatement &&
                    node.expression.type === estraverse.Syntax.CallExpression &&
                    this.contextIdentifierNames.indexOf(node.expression.callee.name) !== -1;

            },
            getContextName: function (node) {
                return node.expression.callee.name;
            },
            getContextMessage: function (node) {
                var firstArgument = node.expression["arguments"][0];
                var literal = clone(firstArgument, false);// shallow copy
                literal["name"] = this.getContextName(node);
                return literal;
            },
            isSingleAssertion: function (node) {
                /*
              "type": "ExpressionStatement",
              "expression": {
                  "type": "CallExpression",
                  "callee": {
                      "type": "Identifier",
                      "name": "assert"
                  },
                  "arguments": [
                      {
                          "type": "Literal",
                          "value": 1,
                          "raw": "1"
                      }
                  ]
              }
             */
                var expression = node.expression;
                return expression.type === estraverse.Syntax.CallExpression &&
                    expression.callee.type === estraverse.Syntax.Identifier &&
                    expression.callee.name === "assert";
            },
            isAssertion: function (node) {
                /*
                            "expression": {
                                "type": "CallExpression",
                                "callee": {
                                    "type": "MemberExpression",
                                    "computed": false,
                                    "object": {
                                        "type": "Identifier",
                                        "name": "assert"
                                    },
                                    "property": {
                                        "type": "Identifier",
                                        "name": "equal"
                                    }
                                },
                 */
                var expression = node.expression;
                if (expression.type === estraverse.Syntax.CallExpression &&
                    typeof expression.callee.object !== "undefined" &&
                    expression.callee.object.type === estraverse.Syntax.Identifier &&
                    expression.callee.object.name === "assert") {
                    return true;
                }
                return this.isSingleAssertion(node);

            },
            // case: assert()
            getSingleAssertion: function (node) {
                var assertionNode = node.expression["arguments"][0];
                var object = {};
                if (assertionNode.type == estraverse.Syntax.BinaryExpression) {
                    // assert(1 == 1);
                    object.name = assertionNode.operator;
                    object.actual = this.getCodeFromRange(assertionNode.left.range);
                    object.expected = this.getCodeFromRange(assertionNode.right.range);
                } else {
                    // assert(true)
                    object.name = this.getAssertionName(node);
                    object.actual = this.getCodeFromRange(assertionNode.range);
                }
                return object;
            },
            getAssertionName: function (node) {
                if (node.expression.callee.property) {
                    return node.expression.callee.property.name;
                } else {
                    return node.expression.callee.name
                }
            },
            getAssertion: function (node) {
                if (!node.expression.callee.property) {
                    return this.getSingleAssertion(node);
                }
                var args = node.expression["arguments"];
                var actual = args[0] ? clone(args[0], false) : null,
                    expected = args[1] ? clone(args[1], false) : null;
                var result = {};
                result["actual"] = this.getCodeFromRange(actual.range);
                result["expected"] = this.getCodeFromRange(expected.range);
                result["name"] = this.getAssertionName(node);
                return result;
            },
            getCodeFromRange: function (range) {
                if (!range) {
                    return null;
                }
                return code.substring(range[0], range[1]);
            }
        }
    }

    var helper = createHelper(code, options);

    function pushExpressionStatement(node, parent, context) {
        if (helper.isContext(node)) {
            var description = helper.getContextMessage(node).value;
            context.print(description);
            context.indent();
        }
        if (helper.isAssertion(node)) {
            var assertion = helper.getAssertion(node);
            context.printAssertion(assertion);
            context.indent();
        }
    }

    function popExpressionStatement(node, parent, context) {
        if (helper.isContext(node) || helper.isAssertion(node)) {
            context.deIndent();
        }
    }

    // print structure
    var context = Object.create({});
    context.level = 0;
    context.print = function (value) {
        console.log(new Array(context.level + 1).join(definedOptions.indent)
            + ((context.level !== 0) ? definedOptions.spacer : definedOptions.rootMark)
            + value);
    };
    context.printAssertion = function (node) {
        if (node.expected) {
            this.print(node.actual + " " + node.name + " " + node.expected);
        } else {
            this.print(node.name + " " + node.actual);
        }
    };
    context.indent = function () {
        context.level += 1;
    };
    context.deIndent = function () {
        context.level -= 1;
    };
    estraverse.traverse(ast, {
        enter: function enter(node, parent) {
            var fn = {
                "ExpressionStatement": pushExpressionStatement
            }[node.type];
            if (fn) {
                fn(node, parent, context);
            }
        },
        leave: function (node, parent) {
            var fn = {
                "ExpressionStatement": popExpressionStatement
            }[node.type];
            if (fn) {
                fn(node, parent, context);
            }
        }

    });
}

module.exports = mechamocha;