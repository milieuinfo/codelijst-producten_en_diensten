# AGENTS.md

Instructies voor coding agents in deze repo. Taal van code-commentaar, documentatie en RDF-labels: Nederlands.

## Wat deze repo doet

De producten- en dienstencatalogus (PDC) van het Departement Omgeving, als één linked-data-dataset met
twee modellen:

- **SKOS-codelijst:** diensten van niveau 1, 2 en 3 (`pd:D1-nnnn`, `pd:D2-nnnn`, `pd:D3-nnnn`) en
  collecties (type dienst, fase beleidscyclus, afdeling, intern/extern gericht, trigger).
- **CPSV-AP 3.2.0:** elke dienst van niveau 3 als `cpsv:PublicService`, producten als `cv:Output`, het
  departement als bevoegde overheid, betrokken afdelingen als `cv:Participation`.

De bron is `src/source/250804_PDC_DOMG.xlsx`, tabblad `PDI OMG`. Uitleg van het model staat in
`README.md`; wat nog open staat in `src/documentation/cpsv-open-punten.md`.

## Pipeline

Draai alles vanuit de repo-root met pnpm (Node ≥ 22):

```bash
pnpm install
pnpm run create_csv       # Excel -> src/source/codelijst-source.csv en src/source/cpsv-source.csv
pnpm run create_skos      # dataset -> src/main/resources/.../id/conceptscheme/producten_en_diensten/
pnpm run create_metadata  # DCAT-metadata en ODCS-contract -> temp/ (haalt versies op uit Artifactory)
```

- `create_skos` valideert met SHACL (beide profielen) en schrijft niets weg als de data niet conform is.
- De gegenereerde bestanden in `src/main/resources` worden **gecommit**. Jenkins genereert ze opnieuw
  (`mvn generate-resources`) en faalt als ze afwijken. Na een wijziging aan bron, context, profielen of
  `src/utils/variables.js`: altijd `create_skos` draaien en het resultaat mee committen.
- `create_csv` draait niet in de build: de csv-bestanden in `src/source` zijn de gecommitte bron.
- Een volledige controle zoals in CI: `mvn -B generate-resources`.

## Belangrijke bestanden

| Pad | Inhoud |
|---|---|
| `src/00_xls_to_csv.js` | Excel → csv (SKOS en CPSV-AP) |
| `src/01_codelijst_skos_from_csv.js` | csv → RDF via `generate_skos` van `@milieuinfo/maven-metadata-generator-npm` (mmg) |
| `src/utils/variables.js` | frames, uitvoerpaden, shapes, bronnen |
| `src/source/config.yml` | prefixen, bronbestanden, profielen (`ap.types`), DCAT-metadata |
| `src/source/context.json` | JSON-LD-context voor de csv-kolommen (ook gebruikt door mmg voor DCAT) |
| `src/source/organisaties.csv` | handmatig: organisaties met OVO-nummer (Wegwijs) |
| `src/main/resources/.../id/ontology/` | de twee SHACL-profielen (SKOS en CPSV-AP) |
| `src/main/vocab/` | lokale kopieën van gebruikte vocabularia, op hun namespace-pad |
| `src/main/shapes/` | officiële SHACL van CPSV-AP 3.2.0 |
| `src/main/rules/` | Jena-regels voor ld-mcp (domein, range, subproperty, subklasse, inverse) |

`src/main/vocab`, `src/main/shapes` en `src/main/rules` staan bewust buiten `src/main/resources`, zodat
ze niet in de jar terechtkomen.

## Regels

- **Schrijf de bron-Excel nooit weg met ExcelJS, openpyxl of een vergelijkbare bibliotheek.** Daarbij
  verdwijnen de draaitabellen, opmerkingen, externe koppelingen, tekeningen en het gevoeligheidslabel.
  Lezen mag. Moet de Excel toch aangepast worden, wijzig dan enkel de XML van het tabblad
  (`xl/worksheets/sheet5.xml` = `PDI OMG`) en kopieer alle andere zip-onderdelen ongewijzigd.
- **Sleutels zijn vast.** IRI's komen uit sleutels in de Excel: `D3-nnnn` (kolom E) en `P-nnnn`
  (kolom W, `key product`). Een productsleutel wordt nooit hergebruikt of hernummerd; een nieuw
  product krijgt het volgende vrije nummer.
- **OVO-nummers volgen de datum van de bron** (nu 2025-08-04), niet de actuele toestand in Wegwijs.
- **`identifier` in `context.json` is een IRI** (voor de DCAT-metadata van mmg). Gebruik voor een
  literal `dct:identifier` de kolom `dct_identifier`.
- **Verzin geen inhoud.** Beschrijvingen van diensten zijn plaatshouders `"TODO"@nl` tot de
  PDC-eigenaar ze aanlevert. Genereer geen template-teksten om verplichte velden te vullen.
- **Hergebruik bestaande termen.** Controleer een term in `src/main/vocab` voor je hem gebruikt; munt
  geen termen in andermans namespace.
- **Lokale vocabularia** worden gedownload via content negotiation op de namespace-URI en als Turtle
  opgeslagen; noteer bron en datum in de README.
- **Git:** commit of push niet zonder expliciete vraag. Een commitboodschap opstellen is geen
  toestemming om te committen.

## Validatie met ld-mcp

`.mcp.json` configureert de MCP-server `ld-vocab` uit https://github.com/milieuinfo/ld-mcp. Hij valideert tegen de vocabularia, beide profielen, de officiële CPSV-AP-SHACL, de
uit OWL gegenereerde shapes en de regels. De jar staat niet in git (`tools/` is genegeerd). Download hem van de releases van
https://github.com/milieuinfo/ld-mcp en controleer de checksum:

```bash
V=v0.4.2
curl -L --create-dirs -o tools/ld-mcp-vocab.jar https://github.com/milieuinfo/ld-mcp/releases/download/$V/ld-mcp-vocab.jar
curl -L -o tools/ld-mcp-vocab.jar.sha256 https://github.com/milieuinfo/ld-mcp/releases/download/$V/ld-mcp-vocab.jar.sha256
(cd tools && sha256sum -c ld-mcp-vocab.jar.sha256)
```

Een eigen build (`mvn package` in een clone van ld-mcp) kan ook: zet dan `LD_MCP_JAR` op het volledige
pad van `ld-mcp-vocab/target/ld-mcp-vocab.jar`. `.mcp.json` gebruikt `${LD_MCP_JAR:-tools/ld-mcp-vocab.jar}`.
Java 21 of hoger is nodig. Na een wijziging aan `.mcp.json` moet de MCP-client herstart worden.

Zonder MCP-client werkt hetzelfde via de command line:

```bash
java -jar "${LD_MCP_JAR:-tools/ld-mcp-vocab.jar}" validate $(jq -r '.mcpServers["ld-vocab"].args[2:]|join(" ")' .mcp.json) \
  src/main/resources/be/vlaanderen/omgeving/data/id/conceptscheme/producten_en_diensten/producten_en_diensten.ttl
```

Verwacht resultaat: 0 fouten, 0 verdacht.
