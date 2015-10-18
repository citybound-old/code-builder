var DEBUG_SHOW_COMPILATION = false;

var ALLOW_ALIASING_OF_FIELDS = true;
var ALLOW_ALIASING_OF_EXPRESSIONS = true;

Object.defineProperties(exports, {
	"createConstructor": {value: CodeBuilder},
	"compile": {value: compile},
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
	"scalar": 		{value: scalar},
	"vector": 		{value: vector},
	"matrix": 		{value: matrix},

	// state
	"assign": 		{value: assign},

	// transformation
	"map": 			{value: map},
	"reduce": 		{value: reduce},
	"apply": 		{value: apply},

	// execution flow
	"phi": 			{value: phi},
	"output": 		{value: output},

	// generating sourceode
	"write": 		{value: write}
});

function compile(name, args, sourceBody, context, environment) {
	if (DEBUG_SHOW_COMPILATION) {
		console.group(name);
		console.log(source);
		console.groupEnd(name);
	}

	context = context || "unknown";
	environment = environment || {};

	let source =
`"use strict";
// this is auto-generated code
	var sqrt = Math.sqrt;
	exports["${name}"] = function ${name}(${args.join(", ")}) {
		${sourceBody}}`;

	let functionExports = {};
	Object.adopt(environment, {exports: functionExports});

	metaEval(
		source,
		environment,
		"CodeBuilder:" + context + ":" + name,
		"codeBuilder/" + context + "/" + name,
		sourceUrlBase + "generated/"
	);

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
		if (type != x.type || operation != x.operation || variables.length != x.variables.length)
			return false;
		for (let i = 0; i < variables.length; i++)
			if (variables[i].id !== x.variables[i].id)
				return false;
		return true;
	}

	for (var i = 0; i < builder.identities.length; i++)
		if (compare(builder.identities[i]))
			return builder.identities[i];

	return null;
}

function nameit(builder, variable) {
	var istaken = (name) => builder.taken.indexOf(name) != -1;
	if (variable.type == "field" && variable.parent.type == "vector") {
		if (!variable.parent.isMatrix) {
			// try to name the variables ax, ay, az, etc...
			if (variable.index >= 0 && variable.index <= 4) {
				let name = variable.parent.name + ["x", "y", "z", "w"][variable.index];
				if (!istaken(name))
					return name;
			}
			// try to name the variables a0, a1, a2, etc...
			let name = variable.parent.name + variable.index;
			if (!istaken(name))
				return name;
		} else {
			// try to name the variables m{row}{column}, eg m01, m02, m10, etc...
			let dimensions = Math.sqrt(variable.parent.length),
				row = Math.floor(variable.index / dimensions),
				column = variable.index - row * dimensions,
				name = variable.parent.name + row + column;
			if (!istaken(name))
				return name;
		}
	}
	if (builder.temporariesPool.length > 0) {
		let name = builder.temporariesPool[0];
		builder.temporariesPool = builder.temporariesPool.slice(1);
		return name;
	} else {
		return "temp" + builder.tempCounter++;
	}
}

function reference(builder, variables) {
	for (let variable of variables) {
		if (!variable.canAlias) continue;

		variable.references++;
		if (variable.references == 2) {
			let name = nameit(builder, variable);
			let position = builder.assignments.length;
			let expression;
			if (variable.assignment) {
				position = builder.assignments.indexOf(variable.assignment.before);
				expression = variable.assignment.expression;
			} else {
				if (!ALLOW_ALIASING_OF_EXPRESSIONS)
					continue;

				expression = variable.toString(false);
			}
			var assignment = {
				"name": name,
				"expression": expression,
				"declare": true
			};
			builder.assignments.splice(position, 0, assignment);

			builder.taken.push(name);
			variable.name = name;
			variable.canAlias = false;
		}
	}
}

let MAX_ELEMENTS_SIZE = 16;
function accessors(prototype) {
	function *foreach() {
		for (let i = 0; i < this.length; i++)
			yield this.get(i);
	}
	function toString(bracketsMode) {
		if (this.name) return this.name;
		if (this.needsBrackets && bracketsMode !== false)
			return `(${this.source()})`;
		return this.source();
	}
	Object.defineProperty(prototype, Symbol.iterator, {value: foreach});
	Object.defineProperty(prototype, "map", {value: Array.prototype.map});
	Object.defineProperty(prototype, "toString", {value: toString});
	for (let i = 0; i < MAX_ELEMENTS_SIZE; i++)
		Object.defineProperty(prototype, i, {get: function() {return this.get(i);}});
}

function ScalarVariable(builder, name) {
	register(builder, this);
	builder.taken.push(name);
	this.name = name;
}
Object.defineProperties(ScalarVariable.prototype, {
	"type": {value: "scalar"},
	"canAlias": {value: false},
	"length": {value: 1},
	"get": {value: function() {return this;}},
	"isVector": {value: false},
	"needsBrackets": {value: false}
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
		for (var i = 0; i < this.length; i++)
			this.fields[i] = new FieldVariable(builder, this, i);
	}
}
Object.defineProperties(VectorVariable.prototype, {
	"type": {value: "vector"},
	"canAlias": {value: false},
	"get": {value: function(i) {return this.fields[i];}},
	"isVector": {value: true},
	"needsBrackets": {value: false}
});

function FieldVariable(builder, parent, index) {
	register(builder, this);
	this.parent = parent;
	this.index = index;
	this.canAlias = ALLOW_ALIASING_OF_FIELDS;
}
Object.defineProperties(FieldVariable.prototype, {
	"type": {value: "field"},
	"length": {value: 1},
	"get": {value: function() {return this;}},
	"source": {value: function() {return this.parent.toString() + "[" + this.index + "]";}},
	"isVector": {value: false},
	"needsBrackets": {value: false},
	"_name": {get: function() {return this.toString();}}
});

function Apply(builder, operation, variables) {
	register(builder, this);
	this.operation = operation;
	this.variables = variables;
	this.canAlias = true;
	this.needsBrackets = false;

	reference(builder, variables);

	let isNegative = (variable) => variable.toString()[0] == "-";

	if (operation[0] == "." && operation[1] == ".") {
		if (variables.length > 1) throw "Use map, not apply";
		this.transform = () => variables[0].toString() + operation.slice(1);
	}
	else if (operation == "[[negate]]") {
		if (variables.length > 1) throw "Use map, not apply";
		if (isNegative(variables[0]))
			this.transform = () => variables[0].toString();
	else
		this.transform = () => "-" + variables[0].toString();
	}
	else if (operation.length > 2 && operation[operation.length - 1] == "/") {
		if (variables.length > 1) throw "Use map, not apply";
		this.transform = () => operation + " " + variables[0].toString();
	}
	else if (operation[0] == ".")
		this.transform = () => variables[0].toString() + operation + "(" + variables.slice(1).map(each => each.toString(false)).join(", ") + ")";
else if (operation == "+" || operation == "-") {
		/* Reorder the variables so that positive operations come first */
		let vars = [];
		for (let variable of variables) {
			let negative = isNegative(variable);
			vars.push({
				"isNegative": ((variable !== variables[0] && operation == "-") ? !negative : negative),
				"toString": function(needsBrackets) {
					let string = variable.toString(false);
					if (negative) string = string.slice(1);
					if (this.needsBrackets && bracketsMode !== false)
						string = `(${string})`;
					return string;
				}
			});
		}
		function positivefirst(a, b) {
			return a.isNegative
				? b.isNegative ? 0 : 1
				: b.isNegative ? -1 : 0;
		}
		vars.sort(positivefirst);

		let negateAtEnd = vars.length > 1 && vars[0].isNegative;
		if (negateAtEnd)
			for (let each of vars)
		each.isNegative = !each.isNegative;

		/*console.log(vars);
		 console.log("negateAtEnd", negateAtEnd);
		 console.log("variables", variables.map(e => e.toString(false)).join(" " + operation + " "));
		 console.log("sort vars", vars.map(e => (e.isNegative ? "-" : "") + e.toString(false)));*/

		this.transform = function() {
			let string = "",
				first = vars[0];
			for (let variable of vars) {
				if (variable !== first) {
					string += ` ${variable.isNegative ? "-" : "+"} `;
				}
				string += variable.toString(false);
			}
			if (negateAtEnd)
				string = `-(${string})`;
			return string;
		};
		this.needsBrackets = !negateAtEnd;
	}
	else if (operation == "*" || operation == "/" || operation == "&&" || operation == "||") {
		this.transform = () => variables.map(each => each.toString()).join(` ${operation} `);
		this.needsBrackets = true;
	}
	else if (operation == "[]") {
		this.transform = () => "[" + variables.map(each => each.toString(false)).join(", ") + "]";
	}
	else
		this.transform = () => operation + "(" + variables.map(each => each.toString(false)).join(", ") + ")";
}
Object.defineProperties(Apply.prototype, {
	"type": {value: "apply"},
	"length": {value: 1},
	"get": {value: function() {return this;}},
	"source": {value: function() {return this.transform();}},
	"isVector": {value: false}
});

function Reduction(builder, operation, variables) {
	register(builder, this);
	this.operation = operation;
	this.variables = variables;
	this.fields = variables.map(each => new Apply(builder, operation, each));
	this.length = variables.length;
	this.canAlias = true;
}
Object.defineProperties(Reduction.prototype, {
	"type": {value: "reduce"},
	"get": {value: function(i) {return this.fields[i];}},
	"source": {value: function() {return "[" + this.fields.map(each => each.toString(false)).join(", ") + "]";}},
	"isVector": {value: true},
	"needsBrackets": {value: false}
});

function Mapping(builder, operation, variables) {
	register(builder, this);
	this.operation = operation;
	this.variables = variables;
	this.canAlias = true;
	this.length = 0;
	for (let variable of variables)
	this.length = Math.max(this.length, variable.length);

	this.fields = new Array(this.length);
	for (let i = 0; i < this.length; i++) {
		let column = new Array(variables.length);
		for (let j = 0; j < variables.length; j++)
			column[j] = variables[j].length === 1
				? variables[j][0]
				: variables[j][i];
		this.fields[i] = new Apply(builder, operation, column);
	}
}
Object.defineProperties(Mapping.prototype, {
	"type": {value: "map"},
	"get": {value: function(i) {return this.fields[i]}},
	"source": {value: function() {return "[" + this.fields.map(each => each.toString(false)).join(", ") + "]";}},
	"isVector": {value: true},
	"needsBrackets": {value: false}
});

function Output(variable) {
	this.toString = () => `return ${variable.toString(false)}`;
}
Object.defineProperties(Output.prototype, {
	"type": {value: "output"},
	"canAlias": {value: false},
	"source": {value: function() { throw "Inapplicable" }}
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
	var m = (dimensionsOrFields instanceof Array)
		? this.vector(dimensionsOrFields, name)
		: this.vector(dimensionsOrFields * dimensionsOrFields, name);
	m.isMatrix = true;
	return m;
}

// apply: with an operation, apply things and return a same-sized mapping
// apply("+", a, b)
// ->	a + b
function apply(operation) {
	var variables = Array.prototype.slice.call(arguments, 1);
	if (!variables.length)
		throw "Nothing to apply";

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
	if (!variables.length)
		throw "Nothing to reduce";

	return lookup(this, Reduction.prototype.type, operation, variables)
		|| new Reduction(this, operation, variables);
}

// map: with an operation, apply variables of 'n' dimensions and return same-sized mapping
// map("+", a, b)
// -> 	[a[0] + b[0],
//		 a[1] + b[1],
//		 a[2] + b[2],
//		 a[3] + b[3]...]
function map(operation) {
	var variables = Array.prototype.slice.call(arguments, 1);
	if (!variables.length)
		throw "Nothing to map";

	return lookup(this, Mapping.prototype.type, operation, variables)
		|| new Mapping(this, operation, variables);
}

function assign(output, input) {
	if (output.type != "vector")
		throw "Cannot assign to anything but a vector";

	for (let i = 0; i < output.length; i++) {
		let out_ = output[i], in_ = input[i];
		if (out_ !== in_) {
			// whatever it is we're accessing, make sure we note that
			reference(this, [in_]);

			let name = out_.toString(),
				assignment = {
					"name": name,
					"expression": in_.toString(false),
					"declare": false};

			// at least on reference so the next access actualises the assignment
			if (out_.canAlias) {
				out_.references = 1;
				out_.assignment = {
					"before": assignment,
					"expression": name
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
		for (var i = 0; i < 9; i++)
			if (this.taken.indexOf(name) == -1) {
				name = name + i;
				break;
			}
		name = "phi" + (this.phiCounter ? this.phiCounter + 1 : "");
	}

	reference(this, [test[0], test[2]]);
	if (success.isVector !== failure.isVector)
		throw "Base types must be the same";

	this.taken.push(name);
	this.phiCounter++;
	this.assignments.push({
		"name": name,
		"expression": `${test[0].toString()} ${test[1]} ${test[2].toString()} ? ${success.toString(false)} : ${failure.toString(false)}`,
	"declare": true
});

return success.isVector
	? this.vector(Math.max(success.length, failure.length), name)
	: this.scalar(name);
}

function write(source, statements) {
	var isDeclaring = false,
		last = this.assignments[this.assignments.length - 1];

	for (var i = 0; i < this.assignments.length; i++) {
		let assignment = this.assignments[i],
			declare = assignment.declare,
			isLast = assignment === last,
			isDeclarationStart = !isDeclaring && declare,
			isDeclarationStop = declare && (isLast || !this.assignments[i+1].declare),
			prefix = (declare && isDeclarationStart) ? "let " : "",
			suffix = (!declare || isDeclarationStop) ? ";" : ",";

		source.writeln(`${prefix}${assignment.name} = ${assignment.expression}${suffix}`);
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

	for (let statement of statements)
	source.writeln(statement.toString());
}
