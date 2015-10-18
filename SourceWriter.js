/* SourceWriter, by Michael Lucas-Smith (c) 2014

 Very simple tool for writing out lines of source code
 while keeping track of tabbing depth and auto-tabbing
 based on trailing { and } bracketing.

 */

function SourceWriter() {
	this.depth = 0;
	this.string = "";
	this.last = null;
	this.storemode = " = ";
	this.newlinemode = ";";
}
SourceWriter.prototype.write = function(line) {
	if (!line) {
		console.trace();
		console.error("Expected a line");
	}

	this.last = line[line.length - 1];
	this.string += line;
}
SourceWriter.prototype.writeln = function(line) {
	line = line || "";
	if (line.length > 0) {
		this.last = line[line.length - 1];
	}
	if (this.last == "{") {
		this.writeTabs();
		this.string += line;
		this.tab();
	} else if (this.last == "}") {
		this.untab();
		this.writeTabs();
		this.string += line;
	} else if (this.last == "," || this.last == ";") {
		this.writeTabs();
		this.string += line;
	} else {
		this.writeTabs();
		this.string += line + this.newlinemode;
	}
	this.string += "\n";
	this.last = null;
}
SourceWriter.prototype.forloop = function(indexVariable, lengthVariable) {
	this.writeln(
		"for (var " + indexVariable + " = 0; " +
		indexVariable + " < " + lengthVariable + "; " +
		indexVariable + "++) {");
}
SourceWriter.prototype.store = function(destination, source) {
	this.writeln(destination + this.storemode + source);
}
SourceWriter.prototype.tab = function() {
	this.depth++;
}
SourceWriter.prototype.untab = function() {
	this.depth--;
	if (this.depth < 0) {
		console.trace();
		console.error("Unbalanced tabs in source writer");
	}
}
SourceWriter.prototype.writeTabs = function() {
	for (var i = 0; i < this.depth; i++) {
		this.string += "\t";
	}
}
SourceWriter.prototype.assertBalance = function() {
	if (this.depth != 0) { console.error("Unbalanced tabs"); }
}

module.exports = SourceWriter;