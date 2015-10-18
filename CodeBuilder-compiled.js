"use strict";

var DEBUG_SHOW_COMPILATION = false;

var ALLOW_ALIASING_OF_FIELDS = true;
var ALLOW_ALIASING_OF_EXPRESSIONS = true;

Object.defineProperties(exports, {
	"createConstructor": { value: CodeBuilder },
	"compile": { value: compile }
});

function CodeBuilder() {
	this.tempCounter = 0;
	this.phiCounter = 0;
	this.assignments = [];
	this.identities = [];
	this.temporariesPool = [];
	this.taken = [];
}
Object.defineProperties(CodeBuilder.prototype, {
	// variables
	"scalar": { value: scalar },
	"vector": { value: vector },
	"matrix": { value: matrix },

	// state
	"assign": { value: assign },

	// transformation
	"map": { value: map },
	"reduce": { value: reduce },
	"apply": { value: apply },

	// execution flow
	"phi": { value: phi },
	"output": { value: output },

	// generating sourceode
	"write": { value: write }
});

function compile(name, args, sourceBody, context, environment) {
	if (DEBUG_SHOW_COMPILATION) {
		console.group(name);
		console.log(source);
		console.groupEnd(name);
	}

	context = context || "unknown";
	environment = environment || {};

	var source = "\"use strict\";\n// this is auto-generated code\n\tvar sqrt = Math.sqrt;\n\texports[\"" + name + "\"] = function " + name + "(" + args.join(", ") + ") {\n\t\t" + sourceBody + "}";

	var functionExports = {};
	Object.adopt(environment, { exports: functionExports });

	metaEval(source, environment, "CodeBuilder:" + context + ":" + name, "codeBuilder/" + context + "/" + name, sourceUrlBase + "generated/");

	return functionExports[name];
}

function register(builder, variable) {
	variable.id = builder.identities.length;
	variable.references = 0;
	builder.identities.push(variable);
	return variable;
}

function lookup(builder, type, operation, variables) {
	function compare(x) {
		if (type != x.type || operation != x.operation || variables.length != x.variables.length) return false;
		for (var _i = 0; _i < variables.length; _i++) {
			if (variables[_i].id !== x.variables[_i].id) return false;
		}return true;
	}

	for (var i = 0; i < builder.identities.length; i++) if (compare(builder.identities[i])) return builder.identities[i];

	return null;
}

function nameit(builder, variable) {
	var istaken = function istaken(name) {
		return builder.taken.indexOf(name) != -1;
	};
	if (variable.type == "field" && variable.parent.type == "vector") {
		if (!variable.parent.isMatrix) {
			// try to name the variables ax, ay, az, etc...
			if (variable.index >= 0 && variable.index <= 4) {
				var _name2 = variable.parent.name + ["x", "y", "z", "w"][variable.index];
				if (!istaken(_name2)) return _name2;
			}
			// try to name the variables a0, a1, a2, etc...
			var _name = variable.parent.name + variable.index;
			if (!istaken(_name)) return _name;
		} else {
			// try to name the variables m{row}{column}, eg m01, m02, m10, etc...
			var dimensions = Math.sqrt(variable.parent.length),
			    row = Math.floor(variable.index / dimensions),
			    column = variable.index - row * dimensions,
			    _name3 = variable.parent.name + row + column;
			if (!istaken(_name3)) return _name3;
		}
	}
	if (builder.temporariesPool.length > 0) {
		var _name4 = builder.temporariesPool[0];
		builder.temporariesPool = builder.temporariesPool.slice(1);
		return _name4;
	} else {
		return "temp" + builder.tempCounter++;
	}
}

function reference(builder, variables) {
	var _iteratorNormalCompletion = true;
	var _didIteratorError = false;
	var _iteratorError = undefined;

	try {
		for (var _iterator = variables[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
			var variable = _step.value;

			if (!variable.canAlias) continue;

			variable.references++;
			if (variable.references == 2) {
				var _name5 = nameit(builder, variable);
				var position = builder.assignments.length;
				var expression = undefined;
				if (variable.assignment) {
					position = builder.assignments.indexOf(variable.assignment.before);
					expression = variable.assignment.expression;
				} else {
					if (!ALLOW_ALIASING_OF_EXPRESSIONS) continue;

					expression = variable.toString(false);
				}
				var assignment = {
					"name": _name5,
					"expression": expression,
					"declare": true
				};
				builder.assignments.splice(position, 0, assignment);

				builder.taken.push(_name5);
				variable.name = _name5;
				variable.canAlias = false;
			}
		}
	} catch (err) {
		_didIteratorError = true;
		_iteratorError = err;
	} finally {
		try {
			if (!_iteratorNormalCompletion && _iterator["return"]) {
				_iterator["return"]();
			}
		} finally {
			if (_didIteratorError) {
				throw _iteratorError;
			}
		}
	}
}

var MAX_ELEMENTS_SIZE = 16;
function accessors(prototype) {
	var marked1$0 = [foreach].map(regeneratorRuntime.mark);

	function foreach() {
		var i;
		return regeneratorRuntime.wrap(function foreach$(context$2$0) {
			while (1) switch (context$2$0.prev = context$2$0.next) {
				case 0:
					i = 0;

				case 1:
					if (!(i < this.length)) {
						context$2$0.next = 7;
						break;
					}

					context$2$0.next = 4;
					return this.get(i);

				case 4:
					i++;
					context$2$0.next = 1;
					break;

				case 7:
				case "end":
					return context$2$0.stop();
			}
		}, marked1$0[0], this);
	}
	function toString(bracketsMode) {
		if (this.name) return this.name;
		if (this.needsBrackets && bracketsMode !== false) return "(" + this.source() + ")";
		return this.source();
	}
	Object.defineProperty(prototype, Symbol.iterator, { value: foreach });
	Object.defineProperty(prototype, "map", { value: Array.prototype.map });
	Object.defineProperty(prototype, "toString", { value: toString });

	var _loop = function (i) {
		Object.defineProperty(prototype, i, { get: function get() {
				return this.get(i);
			} });
	};

	for (var i = 0; i < MAX_ELEMENTS_SIZE; i++) {
		_loop(i);
	}
}

function ScalarVariable(builder, name) {
	register(builder, this);
	builder.taken.push(name);
	this.name = name;
}
Object.defineProperties(ScalarVariable.prototype, {
	"type": { value: "scalar" },
	"canAlias": { value: false },
	"length": { value: 1 },
	"get": { value: function value() {
			return this;
		} },
	"isVector": { value: false },
	"needsBrackets": { value: false }
});

function VectorVariable(builder, lengthOrFields, name) {
	register(builder, this);
	builder.taken.push(name);
	this.name = name;
	if (lengthOrFields instanceof Array) {
		this.length = lengthOrFields.length;
		this.fields = lengthOrFields.slice();
	} else {
		this.length = lengthOrFields;
		this.fields = new Array(this.length);
		for (var i = 0; i < this.length; i++) this.fields[i] = new FieldVariable(builder, this, i);
	}
}
Object.defineProperties(VectorVariable.prototype, {
	"type": { value: "vector" },
	"canAlias": { value: false },
	"get": { value: function value(i) {
			return this.fields[i];
		} },
	"isVector": { value: true },
	"needsBrackets": { value: false }
});

function FieldVariable(builder, parent, index) {
	register(builder, this);
	this.parent = parent;
	this.index = index;
	this.canAlias = ALLOW_ALIASING_OF_FIELDS;
}
Object.defineProperties(FieldVariable.prototype, {
	"type": { value: "field" },
	"length": { value: 1 },
	"get": { value: function value() {
			return this;
		} },
	"source": { value: function value() {
			return this.parent.toString() + "[" + this.index + "]";
		} },
	"isVector": { value: false },
	"needsBrackets": { value: false },
	"_name": { get: function get() {
			return this.toString();
		} }
});

function Apply(builder, operation, variables) {
	var _this = this;

	register(builder, this);
	this.operation = operation;
	this.variables = variables;
	this.canAlias = true;
	this.needsBrackets = false;

	reference(builder, variables);

	var isNegative = function isNegative(variable) {
		return variable.toString()[0] == "-";
	};

	if (operation[0] == "." && operation[1] == ".") {
		if (variables.length > 1) throw "Use map, not apply";
		this.transform = function () {
			return variables[0].toString() + operation.slice(1);
		};
	} else if (operation == "[[negate]]") {
		if (variables.length > 1) throw "Use map, not apply";
		if (isNegative(variables[0])) this.transform = function () {
			return variables[0].toString();
		};else this.transform = function () {
			return "-" + variables[0].toString();
		};
	} else if (operation.length > 2 && operation[operation.length - 1] == "/") {
		if (variables.length > 1) throw "Use map, not apply";
		this.transform = function () {
			return operation + " " + variables[0].toString();
		};
	} else if (operation[0] == ".") this.transform = function () {
		return variables[0].toString() + operation + "(" + variables.slice(1).map(function (each) {
			return each.toString(false);
		}).join(", ") + ")";
	};else if (operation == "+" || operation == "-") {
		var _iteratorNormalCompletion2;

		var _didIteratorError2;

		var _iteratorError2;

		var _iterator2, _step2;

		var _iteratorNormalCompletion3;

		var _didIteratorError3;

		var _iteratorError3;

		var _iterator3, _step3;

		(function () {
			var positivefirst = function positivefirst(a, b) {
				return a.isNegative ? b.isNegative ? 0 : 1 : b.isNegative ? -1 : 0;
			};

			/* Reorder the variables so that positive operations come first */
			var vars = [];
			_iteratorNormalCompletion2 = true;
			_didIteratorError2 = false;
			_iteratorError2 = undefined;

			try {
				var _loop2 = function () {
					var variable = _step2.value;

					var negative = isNegative(variable);
					vars.push({
						"isNegative": variable !== variables[0] && operation == "-" ? !negative : negative,
						"toString": function toString(needsBrackets) {
							var string = variable.toString(false);
							if (negative) string = string.slice(1);
							if (this.needsBrackets && bracketsMode !== false) string = "(" + string + ")";
							return string;
						}
					});
				};

				for (_iterator2 = variables[Symbol.iterator](); !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
					_loop2();
				}
			} catch (err) {
				_didIteratorError2 = true;
				_iteratorError2 = err;
			} finally {
				try {
					if (!_iteratorNormalCompletion2 && _iterator2["return"]) {
						_iterator2["return"]();
					}
				} finally {
					if (_didIteratorError2) {
						throw _iteratorError2;
					}
				}
			}

			vars.sort(positivefirst);

			var negateAtEnd = vars.length > 1 && vars[0].isNegative;
			if (negateAtEnd) {
				_iteratorNormalCompletion3 = true;
				_didIteratorError3 = false;
				_iteratorError3 = undefined;

				try {
					for (_iterator3 = vars[Symbol.iterator](); !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
						var each = _step3.value;

						each.isNegative = !each.isNegative;
					}
				} catch (err) {
					_didIteratorError3 = true;
					_iteratorError3 = err;
				} finally {
					try {
						if (!_iteratorNormalCompletion3 && _iterator3["return"]) {
							_iterator3["return"]();
						}
					} finally {
						if (_didIteratorError3) {
							throw _iteratorError3;
						}
					}
				}
			} /*console.log(vars);
      console.log("negateAtEnd", negateAtEnd);
      console.log("variables", variables.map(e => e.toString(false)).join(" " + operation + " "));
      console.log("sort vars", vars.map(e => (e.isNegative ? "-" : "") + e.toString(false)));*/

			_this.transform = function () {
				var string = "",
				    first = vars[0];
				var _iteratorNormalCompletion4 = true;
				var _didIteratorError4 = false;
				var _iteratorError4 = undefined;

				try {
					for (var _iterator4 = vars[Symbol.iterator](), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
						var variable = _step4.value;

						if (variable !== first) {
							string += " " + (variable.isNegative ? "-" : "+") + " ";
						}
						string += variable.toString(false);
					}
				} catch (err) {
					_didIteratorError4 = true;
					_iteratorError4 = err;
				} finally {
					try {
						if (!_iteratorNormalCompletion4 && _iterator4["return"]) {
							_iterator4["return"]();
						}
					} finally {
						if (_didIteratorError4) {
							throw _iteratorError4;
						}
					}
				}

				if (negateAtEnd) string = "-(" + string + ")";
				return string;
			};
			_this.needsBrackets = !negateAtEnd;
		})();
	} else if (operation == "*" || operation == "/" || operation == "&&" || operation == "||") {
		this.transform = function () {
			return variables.map(function (each) {
				return each.toString();
			}).join(" " + operation + " ");
		};
		this.needsBrackets = true;
	} else if (operation == "[]") {
		this.transform = function () {
			return "[" + variables.map(function (each) {
				return each.toString(false);
			}).join(", ") + "]";
		};
	} else this.transform = function () {
		return operation + "(" + variables.map(function (each) {
			return each.toString(false);
		}).join(", ") + ")";
	};
}
Object.defineProperties(Apply.prototype, {
	"type": { value: "apply" },
	"length": { value: 1 },
	"get": { value: function value() {
			return this;
		} },
	"source": { value: function value() {
			return this.transform();
		} },
	"isVector": { value: false }
});

function Reduction(builder, operation, variables) {
	register(builder, this);
	this.operation = operation;
	this.variables = variables;
	this.fields = variables.map(function (each) {
		return new Apply(builder, operation, each);
	});
	this.length = variables.length;
	this.canAlias = true;
}
Object.defineProperties(Reduction.prototype, {
	"type": { value: "reduce" },
	"get": { value: function value(i) {
			return this.fields[i];
		} },
	"source": { value: function value() {
			return "[" + this.fields.map(function (each) {
				return each.toString(false);
			}).join(", ") + "]";
		} },
	"isVector": { value: true },
	"needsBrackets": { value: false }
});

function Mapping(builder, operation, variables) {
	register(builder, this);
	this.operation = operation;
	this.variables = variables;
	this.canAlias = true;
	this.length = 0;
	var _iteratorNormalCompletion5 = true;
	var _didIteratorError5 = false;
	var _iteratorError5 = undefined;

	try {
		for (var _iterator5 = variables[Symbol.iterator](), _step5; !(_iteratorNormalCompletion5 = (_step5 = _iterator5.next()).done); _iteratorNormalCompletion5 = true) {
			var variable = _step5.value;

			this.length = Math.max(this.length, variable.length);
		}
	} catch (err) {
		_didIteratorError5 = true;
		_iteratorError5 = err;
	} finally {
		try {
			if (!_iteratorNormalCompletion5 && _iterator5["return"]) {
				_iterator5["return"]();
			}
		} finally {
			if (_didIteratorError5) {
				throw _iteratorError5;
			}
		}
	}

	this.fields = new Array(this.length);
	for (var i = 0; i < this.length; i++) {
		var column = new Array(variables.length);
		for (var j = 0; j < variables.length; j++) {
			column[j] = variables[j].length === 1 ? variables[j][0] : variables[j][i];
		}this.fields[i] = new Apply(builder, operation, column);
	}
}
Object.defineProperties(Mapping.prototype, {
	"type": { value: "map" },
	"get": { value: function value(i) {
			return this.fields[i];
		} },
	"source": { value: function value() {
			return "[" + this.fields.map(function (each) {
				return each.toString(false);
			}).join(", ") + "]";
		} },
	"isVector": { value: true },
	"needsBrackets": { value: false }
});

function Output(variable) {
	this.toString = function () {
		return "return " + variable.toString(false);
	};
}
Object.defineProperties(Output.prototype, {
	"type": { value: "output" },
	"canAlias": { value: false },
	"source": { value: function value() {
			throw "Inapplicable";
		} }
});

accessors(ScalarVariable.prototype);
accessors(VectorVariable.prototype);
accessors(FieldVariable.prototype);
accessors(Apply.prototype);
accessors(Reduction.prototype);
accessors(Mapping.prototype);

function scalar(name) {
	return new ScalarVariable(this, name);
}

function vector(lengthOrFields, name) {
	return new VectorVariable(this, lengthOrFields, name);
}

function matrix(dimensionsOrFields, name) {
	var m = dimensionsOrFields instanceof Array ? this.vector(dimensionsOrFields, name) : this.vector(dimensionsOrFields * dimensionsOrFields, name);
	m.isMatrix = true;
	return m;
}

// apply: with an operation, apply things and return a same-sized mapping
// apply("+", a, b)
// ->	a + b
function apply(operation) {
	var variables = Array.prototype.slice.call(arguments, 1);
	if (!variables.length) throw "Nothing to apply";

	var existing = lookup(this, Apply.prototype.type, operation, variables);
	if (existing) {
		reference(this, variables);
		return existing;
	}

	return new Apply(this, operation, variables);
}

// reduce: with an operation, reduce variables of 'n' dimensions down to 1 dimension
// reduce("+", a, b)
// ->	[a[0] + a[1] + a[2] + a[3],
//		 b[0] + b[1] + b[2] + b[3]...]
function reduce(operation) {
	var variables = Array.prototype.slice.call(arguments, 1);
	if (!variables.length) throw "Nothing to reduce";

	return lookup(this, Reduction.prototype.type, operation, variables) || new Reduction(this, operation, variables);
}

// map: with an operation, apply variables of 'n' dimensions and return same-sized mapping
// map("+", a, b)
// -> 	[a[0] + b[0],
//		 a[1] + b[1],
//		 a[2] + b[2],
//		 a[3] + b[3]...]
function map(operation) {
	var variables = Array.prototype.slice.call(arguments, 1);
	if (!variables.length) throw "Nothing to map";

	return lookup(this, Mapping.prototype.type, operation, variables) || new Mapping(this, operation, variables);
}

function assign(output, input) {
	if (output.type != "vector") throw "Cannot assign to anything but a vector";

	for (var i = 0; i < output.length; i++) {
		var out_ = output[i],
		    in_ = input[i];
		if (out_ !== in_) {
			// whatever it is we're accessing, make sure we note that
			reference(this, [in_]);

			var _name6 = out_.toString(),
			    assignment = {
				"name": _name6,
				"expression": in_.toString(false),
				"declare": false };

			// at least on reference so the next access actualises the assignment
			if (out_.canAlias) {
				out_.references = 1;
				out_.assignment = {
					"before": assignment,
					"expression": _name6
				};
			}

			this.assignments.push(assignment);
		}
	}
	return output;
}

function output(variable) {
	return new Output(variable);
}

function phi(test, success, failure, name) {
	if (!name) name = "phi" + (this.phiCounter ? this.phiCounter + 1 : "");
	if (this.taken.indexOf(name) != -1) {
		for (var i = 0; i < 9; i++) if (this.taken.indexOf(name) == -1) {
			name = name + i;
			break;
		}
		name = "phi" + (this.phiCounter ? this.phiCounter + 1 : "");
	}

	reference(this, [test[0], test[2]]);
	if (success.isVector !== failure.isVector) throw "Base types must be the same";

	this.taken.push(name);
	this.phiCounter++;
	this.assignments.push({
		"name": name,
		"expression": test[0].toString() + " " + test[1] + " " + test[2].toString() + " ? " + success.toString(false) + " : " + failure.toString(false),
		"declare": true
	});

	return success.isVector ? this.vector(Math.max(success.length, failure.length), name) : this.scalar(name);
}

function write(source, statements) {
	var isDeclaring = false,
	    last = this.assignments[this.assignments.length - 1];

	for (var i = 0; i < this.assignments.length; i++) {
		var assignment = this.assignments[i],
		    declare = assignment.declare,
		    isLast = assignment === last,
		    isDeclarationStart = !isDeclaring && declare,
		    isDeclarationStop = declare && (isLast || !this.assignments[i + 1].declare),
		    prefix = declare && isDeclarationStart ? "let " : "",
		    suffix = !declare || isDeclarationStop ? ";" : ",";

		source.writeln("" + prefix + assignment.name + " = " + assignment.expression + suffix);
		if (isDeclarationStart) {
			isDeclaring = true;
			isDeclarationStop || source.tab();
		}
		if (isDeclarationStop) {
			isDeclaring = false;
			isDeclarationStart || source.untab();
		}
	}
	isDeclaring && source.untab();

	var _iteratorNormalCompletion6 = true;
	var _didIteratorError6 = false;
	var _iteratorError6 = undefined;

	try {
		for (var _iterator6 = statements[Symbol.iterator](), _step6; !(_iteratorNormalCompletion6 = (_step6 = _iterator6.next()).done); _iteratorNormalCompletion6 = true) {
			var statement = _step6.value;

			source.writeln(statement.toString());
		}
	} catch (err) {
		_didIteratorError6 = true;
		_iteratorError6 = err;
	} finally {
		try {
			if (!_iteratorNormalCompletion6 && _iterator6["return"]) {
				_iterator6["return"]();
			}
		} finally {
			if (_didIteratorError6) {
				throw _iteratorError6;
			}
		}
	}
}

//# sourceMappingURL=CodeBuilder-compiled.js.map