# codelijst-producten_en_diensten

De producten- en dienstencatalogus (PDC) van het Departement Omgeving, afgeleid uit
`src/source/250804_PDC_DOMG.xlsx` (tabblad `PDI OMG`). Eén dataset bevat de catalogus in twee vormen:

- **SKOS-codelijst**: de diensten van niveau 1, 2 en 3 als concepten, gegroepeerd in collecties
  (type dienst, fase beleidscyclus, afdeling, intern/extern gericht, trigger).
- **CPSV-AP**: elke dienst van niveau 3 als publieke dienst, met de producten als output en het
  departement en de afdelingen als organisaties.

## Genereren

```bash
pnpm run create_csv       # Excel -> source/codelijst-source.csv en source/cpsv-source.csv
pnpm run create_skos      # dataset -> src/main/resources/.../id/conceptscheme/producten_en_diensten/
pnpm run create_metadata  # DCAT-metadata en ODCS-contract -> temp/
```

`create_skos` leest `codelijst-source.csv`, `cpsv-source.csv` en `organisaties.csv` samen
(`source.codelijst_csv` in `config.yml`) met de context `context.json`, en schrijft één set bestanden
(`producten_en_diensten.{ttl,nt,jsonld,json,csv,parquet}`) met de codelijst en de CPSV-AP-data samen.
Het valideert met beide profielen (`ap.types` in `config.yml`) en schrijft niets weg als de data niet
conform is. Omdat alles in één dataset zit, beschrijft de DCAT-metadata van mmg ook de CPSV-AP-data.

In `context.json` heet de CPSV-identifier `dct_identifier` (een literal): de term `identifier` is er een
IRI, en mmg gebruikt dezelfde context voor de DCAT-metadata.

De Maven-build (`generate-resources`) draait `create_skos` en `create_metadata` opnieuw, en Jenkins
faalt als het resultaat afwijkt van wat in `src/main/resources` gecommit is. `create_csv` draait niet
in de build: de csv-bestanden in `src/source` zijn de gecommitte bron.

## CPSV-AP-model

Basis is CPSV-AP 3.2.0. Het IPDC-LPDC-profiel (`ipdc:InstancePublicService`) volgen we (nog) niet:
de PDC is grotendeels intern en heeft geen beschrijvingen, aanmaakdata of geografisch
toepassingsgebied per dienst. Uitwisseling met IPDC/LPDC kan later met een extra type in een aparte
export, zodra die gegevens er zijn.

De PDC is een momentopname (bronversie 4 augustus 2025) die tweejaarlijks wordt bijgewerkt. De
organisaties zijn daarom geïdentificeerd met het OVO-nummer dat geldig was op de datum van de bron.

| Bron (PDI OMG) | RDF |
|---|---|
| dienst 3 | `cpsv:PublicService` `publicservice:D3-nnnn` met `dct:identifier` en `dct:title` |
| dienst 3 in de codelijst | `cv:isClassifiedBy pd:D3-nnnn`; via de SKOS-codelijst ook niveau 2/1 en de collecties |
| product (`key product`) | `cv:Output` `output:P-nnnn`, via `cpsv:produces` |
| Departement Omgeving | `cv:hasCompetentAuthority ovo:OVO003323` |
| betrokken afdeling | `cv:hasParticipation` → `cv:Participation` `participatie:D3-nnnn-AFK` met `cv:role participatierol:betrokken_afdeling` en `cv:hasParticipant ovo:OVO…` |

Namespaces onder `https://data.omgeving.vlaanderen.be/id/`: `publicservice/producten_en_diensten/`,
`output/producten_en_diensten/`, `participation/producten_en_diensten/` en
`concept/participatierol/` (de rol, met conceptschema `conceptscheme:participatierol`).

Het gebied wordt getypeerd, zodat de range van CPSV-AP geldt:
`<https://sws.geonames.org/3337388/> a dct:Location`. De concepten `pd:D3-nnnn` achter
`cv:isClassifiedBy` staan in dezelfde dataset.

De organisaties en hun OVO-nummers (uit Wegwijs) staan in `src/source/organisaties.csv`. Dat
bestand wordt met de hand bijgehouden; de kolom `altLabel` is de afkorting in de PDC.

Het profiel staat in
`src/main/resources/be/vlaanderen/omgeving/data/id/ontology/producten_en_diensten-cpsv-ap-constraints/`.
Het SKOS-profiel (`producten_en_diensten-ap-constraints/`) geldt enkel voor de concepten met een
`skos:notation`, de PDC-concepten; de rol `participatierol:betrokken_afdeling` valt er niet onder.

### Sleutels en IRI's

Diensten en producten krijgen hun IRI uit een sleutel in de bron-Excel (tabblad `PDI OMG`):

| Sleutel | Kolom | IRI |
|---|---|---|
| `D3-nnnn` | E, `key dienst 3 / product` | `publicservice:D3-nnnn` en `pd:D3-nnnn` |
| `P-nnnn` | W, `key product` | `output:P-nnnn` |

Een productsleutel is vast: ze blijft bij hetzelfde product, ook als de volgorde in de Excel verandert
of het product naar een andere dienst verhuist, en ze wordt nooit hergebruikt. Een nieuw product
krijgt het volgende vrije nummer; een geschrapt product laat een gat. Staat hetzelfde product twee keer
bij dezelfde dienst (zoals D3-0053), dan krijgen beide rijen dezelfde sleutel.

`create_csv` stopt met een foutmelding als een rij met een product geen geldige sleutel heeft, als een
sleutel voor twee verschillende producten gebruikt wordt, of als een product van een dienst twee
sleutels heeft.

Kolom W is toegevoegd in de XML van het tabblad, niet via Excel of ExcelJS: ExcelJS laat bij het
wegschrijven de draaitabellen, opmerkingen, koppelingen en het gevoeligheidslabel vallen.

### Conformiteit met CPSV-AP 3.2.0

Het profiel verklaart `dct:conformsTo <http://data.europa.eu/m8g/cpsvap/3.2.0>`. De data voldoet aan
de officiële SHACL van CPSV-AP 3.2.0 (`src/main/shapes/...`), gevalideerd met ld-mcp samen met de
klassenhiërarchie uit `src/main/vocab`.

Die conformiteit is formeel. CPSV-AP eist een beschrijving (`dct:description`) per dienst, en de
bron bevat er geen. Elke dienst heeft daarom de plaatshouder `"TODO"@nl`. Een afnemer die op
`dct:conformsTo` vertrouwt, krijgt dus wel geldige data, maar geen bruikbare beschrijvingen. Zodra
de PDC-eigenaar beschrijvingen aanlevert, komen die in de plaats van de plaatshouder. Wie de
plaatshouders wil herkennen, filtert op `dct:description "TODO"@nl`.

### Open punten

- **Beschrijving**: `dct:description` is verplicht in CPSV-AP, maar ontbreekt in de bron. Elke dienst
  krijgt voorlopig de plaatshouder `"TODO"@nl` (in `src/00_xls_to_csv.js`), tot de PDC-eigenaar
  beschrijvingen aanlevert.
- **BJO** is afgeleid uit de afkorting als `OVO049712` (Beleidsontwikkeling en juridische
  ondersteuning, in Wegwijs onder DAB BRV-fonds); na te kijken.
- **STAF** is `OVO003749` (Afdeling Organisatieondersteuning), de stafafdeling op de datum van de bron;
  sinds 2026-01-01 is dat Staf (`OVO056537`). **PBM en VPO** zijn in Wegwijs afgesloten op 2025-12-31.
  Bij een nieuwe versie van de PDC moeten de OVO-nummers opnieuw nagekeken worden.
- **Uitvoerende overheid**: `ipdc:hasExecutingAuthority` (IPDC-LPDC-implementatiemodel, niet in het
  vocabularium gedefinieerd) is enkel zinvol voor afdelingen waarvan bevestigd is dat ze uitvoeren.
  De bron zegt alleen dat een afdeling betrokken is.
- **Facetten**: type dienst, fase, intern/extern en trigger zijn SKOS-collecties en dus vanuit CPSV
  enkel via de codelijst bereikbaar.
- **Doelgroep**: de kolom ontvanger is vrije tekst. Om `dct:audience` of `ipdc:targetAudience` te
  gebruiken is eerst een mapping naar een codelijst nodig.
- **KPI-kolommen** (aantal, tijdigheid) hebben geen term in CPSV-AP en zijn niet opgenomen.

## Gebruikte vocabularia

Lokale kopieën onder `src/main/vocab` (buiten `src/main/resources`, zodat ze niet in de jar
terechtkomen), op een pad volgens hun namespace-URI, gedownload op 2026-11-04:

| Vocabularium | Bron | Lokaal pad |
|---|---|---|
| CPSV 1.01 | `http://purl.org/vocab/cpsv` | `org/purl/vocab/cpsv/cpsv.ttl` |
| CPSV-AP 3.2.0 | github.com/SEMICeu/CPSV-AP, `releases/3.2.0/rdf/cpsv-ap.ttl` | `eu/europa/data/m8g/cpsvap/cpsvap.ttl` |
| Core Vocabularies | `http://data.europa.eu/m8g/` | `eu/europa/data/m8g/m8g.ttl` |
| IPDC-LPDC | `https://productencatalogus.data.vlaanderen.be/ns/ipdc-lpdc.ttl` | `be/vlaanderen/data/productencatalogus/ns/ipdc-lpdc/ipdc-lpdc.ttl` |
| SKOS | `http://www.w3.org/2004/02/skos/core` | `org/w3/www/2004/02/skos/core/core.ttl` |
| DCMI Terms | `http://purl.org/dc/terms/` | `org/purl/dc/terms/terms.ttl` |
| SHACL | `http://www.w3.org/ns/shacl` | `org/w3/www/ns/shacl/shacl.ttl` |
| ORG | `http://www.w3.org/ns/org` | `org/w3/www/ns/org/org.ttl` |
| XKOS | `http://rdf-vocabulary.ddialliance.org/xkos` | `org/ddialliance/rdf-vocabulary/xkos/xkos.ttl` |
| FOAF | `http://xmlns.com/foaf/0.1/` | `com/xmlns/foaf/0.1/foaf.ttl` |
| XHTML Vocabulary | `http://www.w3.org/1999/xhtml/vocab` | `org/w3/www/1999/xhtml/vocab/vocab.ttl` |

De officiële SHACL van CPSV-AP 3.2.0 (github.com/SEMICeu/CPSV-AP, `releases/3.2.0/shacl/cpsv-ap-SHACL.ttl`)
staat apart in `src/main/shapes/io/github/semiceu/CPSV-AP/releases/3.2.0/shacl/`.

- **CPSV**: het bestand van de namespace (`cpsv_101.ttl`) is ongeldige Turtle. Enkel een overtollige
  `.` binnen een blank node (regel 22) is verwijderd.
- **SKOS** en **FOAF**: omgezet van RDF/XML naar Turtle.
- **XHTML Vocabulary**: W3C publiceert het enkel als XHTML met RDFa. De Turtle is daaruit afgeleid
  (`about`, `typeof` en `property` per term).

## ld-mcp

`.mcp.json` configureert de MCP-server `ld-vocab` uit [ld-mcp](https://github.com/milieuinfo/ld-mcp)
voor Claude Code: termen opzoeken en data valideren tegen de vocabularia in `src/main/vocab`.

- **Shapes:** het SKOS-profiel, het eigen CPSV-AP-profiel en de officiële CPSV-AP-SHACL, plus shapes
  die uit de OWL-restricties van de vocabularia gegenereerd worden (`--generate-shapes`).
- **Inferentie:** de Jena-regels in `src/main/rules/be/vlaanderen/omgeving/data/id/rule/domain-range-subproperty.rules`
  (domein, range, subproperty, subklasse en inverse).

Vocabularia, officiële shapes en regels staan buiten `src/main/resources`, zodat ze niet in de jar
terechtkomen.

De jar staat niet in git (`tools/` is genegeerd). Download hem van de releases van
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

