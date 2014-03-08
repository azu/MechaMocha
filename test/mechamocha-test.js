"use strict";
var assert = require("power-assert");
var fs = require("fs");
var mecha = require("../lib/mechamocha");
describe("mecha", function () {
    var code = fs.readFileSync(__dirname + "/fixtures/fixture-test.js", "utf-8");
    it("should", function () {
        mecha(code);
    });
});

