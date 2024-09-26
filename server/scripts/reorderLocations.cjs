const fs = require("fs");

const file = `${__dirname}/../simulations/${process.argv[2]}.json`;
const sim = require(file);

for (const panel of sim.panels) {
	panel.reportingLocations = []
}

for (const loc in sim.locations) {
	const panel = sim.panels.find((panel) => panel.id === sim.locations[loc]);
	if (!panel) throw `${loc}'s assigned panel is invalid`;
	panel.reportingLocations.push(loc);
}

delete sim.locations;

fs.writeFileSync(file, JSON.stringify(sim, undefined, "\t"));
