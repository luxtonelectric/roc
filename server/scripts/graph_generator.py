#!/usr/bin/env python3

"""Script to assist with generation of a simulation graph.

This script currently generates a Graphviz DOT file (https://graphviz.org/documentation/),
that can be loaded into a Graphviz viewer like this: https://dreampuf.github.io/GraphvizOnline/
"""

import json
import os
import pathlib
import ssl

import geopy


# TODO: Add generation of final graph rather than relying on online service
# TODO: Improve geopy usage (poss store latitudes for reuse)
# TODO: Add way to generate graph for subset of simulations (e.g. ones in use for a game).


def geo_order(sims):
    """Use GeoPy to look up rough latitudes and use to sort a list of sims.

    This helps when generating a graph to make it more geographic.
    Uses the Nominatim geocoder for OpenStreetMap data.
    """
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    geopy.geocoders.options.default_ssl_context = ctx
    geolocator = geopy.Nominatim(user_agent="MyApp", timeout=3)
    lats = []
    for sim in sims:
        name = sim["name"]
        if name.endswith("ASC") or name.endswith("PSB"):
            name = name[:-3]
        elif name.endswith("IECC"):
            name = name[:-4]
        elif "Rugby SCC" in name:
            name = "Rugby"
        elif "Cardiff Valleys" in name:
            name = "Abercynon"
        elif "Victoria South Eastern" in name:
            name = "London"
        elif "&" in name:
            name = name.split(" & ")[0]
        loc = geolocator.geocode(name + ", United Kingdom")
        if loc is not None:
            lats.append(loc.longitude)
            #print(sim["name"], loc.latitude)
        else:
            print(sim["name"], loc)
    print(len(sims), len(lats))
    #print(lats)
    #print(tuple(sorted(zip(lats, sims), key=itemgetter('id'), reverse=True)))
    sims = [x for _, x in sorted(zip(lats, sims), key=lambda x:x[0], reverse=False)]
    #print(sims)
    return sims


def generate_graph_dot(sims, path):
    """Write a Graphviz DOT file from a structured sim object."""
    graph = []
    graph.append('digraph Simulations {')
    graph.append('rankdir=LR')
    graph.append('overlap=false')
    graph.append('splines=true')
    graph.append('newrank=true')
    graph.append('concentrate=true')
    graph.append('edge [dir=forward]')
    graph.append("node [style=filled]")
    graph.append("node [shape=box]")

    for sim in sims:
        graph.append("subgraph cluster_%s {" % sim["id"])
        graph.append('label = "%s"' % sim["name"])
        graph.append('tooltip = "%s"' % sim["id"])
        for panel in sim["panels"]:
            graph.append('%s_%s [label="%s" tooltip="%s"]' % (sim["id"], panel["id"], panel["name"], panel["id"]))
        graph.append("}")

    for sim in sims:
        for panel in sim["panels"]:
            for neighbour in panel["neighbours"]:
                graph.append("%s_%s -> %s_%s" % (sim['id'], panel['id'], neighbour['simId'], neighbour['panelId']))

    graph.append('}')

    with open(path, 'w') as f:
        f.write("\n".join(graph))
        print("Graphviz DOT file written to", path)


def parse_sim_jsons(dir_path):
    """Convert a dir of sim fringing JSON data into a Python object."""
    # Get list of all the files in the directory.
    filenames = os.listdir(dir_path)

    sim_data = []
    for sim in filenames:
        # Check that file ends in .json as we strip the last 5 chars later.
        if sim[-5:] != '.json':
            raise ValueError("File does not end in .json: %s" % sim)
        with open(dir_path / sim) as fp:
            py_obj = json.load(fp)
            # Add the id to the object based on the filename without extension.
            py_obj['id'] = sim[:-5]
            sim_data.append(py_obj)
    print("JSON files parsed:", len(sim_data))

    return sim_data


def main():

    SIMS_PATH = pathlib.Path(__file__).parent.parent / 'simulations'

    sims = parse_sim_jsons(SIMS_PATH)

    # Sloooooow sorting of sims into latitude order
    sims = geo_order(sims)

    DOT_PATH = pathlib.Path(__file__).parent / 'sim_graph.dot'

    generate_graph_dot(sims, DOT_PATH)


if __name__ == '__main__':
    main()
