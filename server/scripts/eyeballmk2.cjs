// @ts-check

const fs = require("fs");
const path = require("path");

const simulations = {};

for (const item of fs.readdirSync(`${__dirname}/../simulations`)) {
	if (path.extname(item) !== ".json") {
		console.error(`Skipping unexpected ${item}`);
		continue;
	}
	simulations[path.basename(item, ".json")] = require(`${__dirname}/../simulations/${item}`);
}

function findPanel(sim, panel) {
	return simulations[sim]?.panels.find((p) => p.id === panel);
}

function countLinks(neighbour, sim, panel) {
	let i = 0;
	for (const link of neighbour.neighbours) {
		if (link.simId === sim && link.panelId === panel) {
			i++;
		}
	}
	return i;
}

const seenNames = new Map();
for (const [id, sim] of Object.entries(simulations)) {
	if (seenNames.has(sim.name)) {
		console.error(`Duplicated name for ${id}: already used by ${seenNames.get(sim.name)}`);
	} else {
		seenNames.set(id, sim.name);
	}
}

for (const [id, sim] of Object.entries(simulations)) {
	for (const panel of sim.panels) {
		for (const neighbour of panel.neighbours) {
			const neighbourPanel = findPanel(neighbour.simId, neighbour.panelId);
			if (!neighbourPanel) {
				console.error(`${id}.${panel.id} refers to non-existent panel ${neighbour.simId}.${neighbour.panelId}`);
				continue;
			}
			const linkCount = countLinks(neighbourPanel, id, panel.id);
			if (linkCount === 0) {
				console.error(`${neighbour.simId}.${neighbour.panelId} does not link back to ${id}.${panel.id}`);
			} else if (linkCount > 1) {
				console.error(`${neighbour.simId}.${neighbour.panelId} has a double link to ${id}.${panel.id}`);
			}
		}
	}
}
