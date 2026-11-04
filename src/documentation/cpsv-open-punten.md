# CPSV-AP-model producten en diensten: open punten

Stand van zaken op 2026-11-04, branch `andere-ontologie`. Enkel de punten die nog niet zijn opgelost.
Wat al gebeurd is, staat in de README.

## Aan te leveren of te bevestigen door de PDC-eigenaar

1. **Beschrijvingen van de diensten.**
   - *Probleem:* `dct:description` is verplicht in CPSV-AP, maar ontbreekt in de bron. Elke dienst heeft voorlopig de plaatshouder `"TODO"@nl`. De conformiteit met CPSV-AP is daardoor enkel formeel (zie "Conformiteit met CPSV-AP 3.2.0" in de README).
   - *Oplossing:* de PDC-eigenaar levert beschrijvingen aan. Een template ("Dienst X onder Y") vult het verplichte veld wel, maar voegt geen informatie toe.
2. **OVO-koppelingen van twee afdelingen.**
   - **BJO → `OVO049712`** (Beleidsontwikkeling en juridische ondersteuning). Die koppeling is afgeleid uit de afkorting. In Wegwijs hangt deze eenheid onder DAB BRV-fonds.
   - **GOP → `OVO003754`.** In Wegwijs heet die afdeling "Afdeling Instrumenten en Programmatie", met korte naam GOP.
3. **Dubbele titel.** D3-0279 en D3-0329 hebben dezelfde titel ("vertalen en communiceren van VO-kaders en instrumenten").
4. **Doorstreepte woorden.** In de Excel zijn bij D3-0157, D3-0164 en D3-0169 woorden doorstreept. Die worden nu weggelaten; de PDC-eigenaar moet bevestigen dat dat de bedoeling is.
5. **Productsleutels bij de volgende versie.** De kolom `key product` (W) is nieuw in de bron-Excel. Bij een nieuwe versie van de PDC moet de PDC-eigenaar de bestaande sleutels behouden en een nieuw product het volgende vrije nummer geven (zie "Sleutels en IRI's" in de README). Ook de OVO-nummers in `src/source/organisaties.csv` moeten dan opnieuw nagekeken worden.

## Model

6. **Facetten als classificatie.**
   - *Probleem:* type dienst, fase beleidscyclus, intern/extern gericht en trigger zijn SKOS-collecties. Een collectie kan geen waarde van `cv:isClassifiedBy` zijn. Vanuit CPSV zijn de facetten daardoor enkel via de codelijst bereikbaar.
   - *Voorstel:* per facet een klein conceptschema, toegekend met extra `cv:isClassifiedBy`-waarden of met een subproperty in de eigen namespace.
   - *Gevolg voor het profiel:* `ps:isClassifiedBy` laat nu precies 1 waarde toe (`sh:maxCount 1`). Dat moet een gekwalificeerde constraint worden: precies 1 D3-concept, en daarnaast andere concepten toegelaten.
7. **Organisaties vollediger modelleren.**
   - *Hiërarchie:* er is geen relatie tussen afdeling en departement. Voorstel: `org:unitOf ovo:OVO003323`, eventueel met `org:OrganizationalUnit` als extra type.
   - *Spatial:* CPSV-AP raadt eerst ATU- en dan NUTS-codes aan, eerder dan GeoNames. De keuze moet consistent zijn met `config.yml`.
   - *Herkomst:* een verwijzing naar Wegwijs met de peildatum, via `dct:source` of `prov:wasDerivedFrom`.
8. **Terminologie gelijktrekken.**
   - De SKOS-collecties heten "Afdeling STAF" en "Afdeling GOP", de organisaties "Afdeling Organisatieondersteuning" en "Afdeling Instrumenten en Programmatie". Tussen `collectie:afdeling_x` en `ovo:OVO…` bestaat geen link.
   - Producten staan twee keer in het model: als `skos:note "Product: …"` op het D3-concept en als `cv:Output`. We moeten kiezen welke de bron is, of documenteren dat de note afgeleid is.
   - Het conceptschema noemt D3 "dienst 3/product", maar het CPSV-model splitst het in een dienst en een output. Dat verschil moet uitgelegd worden.
9. **Uitwisseling met IPDC/LPDC.**
    - *Mogelijkheid:* dubbele typering (`cpsv:PublicService` en `ipdc:InstancePublicService`) kan.
    - *Voorwaarde:* het IPDC-type brengt de verplichte velden van IPDC mee: beschrijving, aanmaak- en wijzigingsdatum, `isArchived` en geografisch toepassingsgebied. Dat is pas zinvol in een aparte export, als die gegevens er zijn.
    - *Uitvoerende overheid:* `ipdc:hasExecutingAuthority` is enkel zinvol voor afdelingen waarvan bevestigd is dat ze de dienst uitvoeren. De term staat wel in het IPDC-LPDC-implementatiemodel, maar is niet gedefinieerd in het IPDC-LPDC-vocabularium.

## Inhoud uit de bron die nog niet is opgenomen

10. **Doelgroep.**
    - *Bron:* de kolom ontvanger is vrije tekst, met 56 verschillende waarden; 237 rijen zijn leeg. "Intern/extern gericht" is daar een grovere vorm van.
    - *Voorstel:* beide samen mappen naar `dct:audience` of `ipdc:targetAudience`, met een eigen kleine codelijst die naar de IPDC-codelijst doelgroep verwijst (`skos:closeMatch`/`broadMatch`). Ondertussen de ruwe tekst bewaren als `skos:scopeNote` op het D3-concept.
11. **KPI-kolommen** (aantal, tijdigheid).
    - *Probleem:* het zijn definities van indicatoren, geen waarden, en CPSV-AP heeft er geen term voor. `cv:processingTime` is niet geschikt: dat is een geschatte doorlooptijd, geen norm.
    - *Voorstel:* voorlopig als `skos:scopeNote` bewaren. Is er later echt KPI-beheer nodig, dan worden het aparte resources (bv. RDF Data Cube).
12. **Intern gerichte diensten publiceren?**
    - *Probleem:* diensten die alleen intern gericht zijn (gericht = I, of ontvanger = management/entiteiten) kunnen in geaggregeerde dienstencatalogi opduiken als iets wat burgers kunnen aanvragen.
    - *Te beslissen:* alleen E en E/I publiceren, of de doelgroep altijd expliciet maken (punt 10).

## Suggesties

13. **Profiel aanscherpen.**
    - `sh:uniqueLang true` in plaats van `sh:maxCount 1` voor `dct:title` en `skos:prefLabel`, zodat een Engelse naam mogelijk wordt.
    - `sh:hasValue ovo:OVO003323` voor de bevoegde overheid.
    - Een controle dat elke `cv:Output` door een dienst wordt opgeleverd.
    - Een controle dat `dct:identifier` gelijk is aan de `skos:notation` van het geclassificeerde concept.
14. **Data.**
    - Overweeg `@nl` op `skos:altLabel`.
    - De Turtle declareert ongeveer 60 ongebruikte prefixen.
    - `concept:` en `pd:` zijn twee prefixen voor dezelfde namespace.
    - De CSV-export bevat de letterlijke string `null` voor lege velden.
15. **Inferentie.** In CPSV 1.01 heeft `cpsv:produces` als range `cpsv:Output`. Een RDFS-reasoner leidt dus ook `cpsv:Output` af naast `cv:Output`. Dat is onschadelijk.
16. **Vocabularia.** Het CPSV-namespacebestand (`cpsv_101.ttl`) is ongeldige Turtle. De lokale kopie in `src/main/vocab/org/purl/vocab/cpsv/cpsv.ttl` is op één teken hersteld; het probleem melden bij SEMIC.
