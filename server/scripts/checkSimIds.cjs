// @ts-check

const fs = require("fs");
const path = require("path");

const folder = `${process.argv[2]}/Simulations`;

const missingSims = new Set();
const knownSims = new Set();
for (const item of fs.readdirSync(`${__dirname}/../simulations`)) {
	if (path.extname(item) !== ".json") {
		console.error(`Skipping unexpected ${item}`);
		continue;
	}
	knownSims.add(path.basename(item, ".json").toLowerCase());
}

for (const name of fs.readdirSync(folder)) {
	const item = path.join(folder, name);
	if (fs.statSync(item).isFile() && path.extname(item) === ".sim") {
		const simName = path.basename(item, ".sim").toLowerCase();
		if (!knownSims.delete(simName)) {
			missingSims.add(simName);
		}
	}
}

for (const sim of knownSims) {
	console.error(`Found sim info for unknown sim: ${sim}`);
}
for (const sim of missingSims) {
	console.error(`Missing sim info for sim: ${sim}`);
}
