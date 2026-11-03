#!/bin/bash
# Genereert een diagram van het datamodel (klassen en eigenschappen) van de codelijst.
# Vereist: Apache Jena (sparql), rdf2dot (rdflib) en Graphviz (dot).
set -euo pipefail
cd "$(dirname "$0")"
DATA=../main/resources/be/vlaanderen/omgeving/data/id/conceptscheme/producten_en_diensten/producten_en_diensten.ttl
sparql --results=TTL --data="$DATA" --query model.rq > model.ttl
rdf2dot model.ttl > model.dot
dot -Tpng model.dot > model.png
