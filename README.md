# Printer Badge

![versie](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fapi.github.com%2Frepos%2FLeonCB%2FPrinter-Badge%2Freleases%2Flatest&query=%24.tag_name&label=versie&color=blue)

Eén Home Assistant-badge voor je printer: status, pagina-teller en
inktniveaus, met alle details in een pop-up als je erop tikt. Vervangt een
rij losse badges.

- Printericoon: stand-by in je primaire kleur, **pulserend geel** tijdens
  printen, **rood** bij een fout of als de printer niet bereikbaar is
- Pagina-teller
- Per inktkleur een gekleurde druppel met het percentage; onder de grens
  (standaard 20%) wordt het percentage **rood**
- Tik: pop-up met status, inktniveaus met balkjes, pagina-teller en
  eventuele extra sensoren

## Installatie

1. Instellingen → Marketplace → ⋮ → **Add from link** →
   `https://github.com/LeonCB/Printer-Badge`, categorie **Dashboard**
2. Installeer **Printer Badge**
3. Dashboard bewerken → **Badge toevoegen** → zoek "Printer"

## Configuratie

Alles is in te stellen in de visuele editor.

```yaml
type: custom:printer-badge
entity: sensor.epson_et_2870
pages: sensor.epson_et_2870_totaal_paginas
details:
  - sensor.epson_ecotank_et_2870_afgedrukte_pagina_s_kleur
  - sensor.epson_ecotank_et_2870_afgedrukte_pagina_s_zwart_wit
```

| Optie | Standaard | Omschrijving |
|---|---|---|
| `entity` | — | **Verplicht.** Statussensor van de printer (bijv. van de IPP-integratie) |
| `inks` | automatisch | Inktsensoren. Leeg: de %-sensoren van hetzelfde apparaat met cyaan/magenta/geel/zwart in de naam |
| `pages` | automatisch | Pagina-teller. Leeg: een sensor op hetzelfde apparaat met "totaal" en "pagina's" in de naam. `false` = geen teller |
| `details` | — | Extra sensoren die alleen in de pop-up staan |
| `low_threshold` | `20` | Onder dit percentage wordt een inktniveau rood |
| `name` | apparaatnaam | Titel in de pop-up |
| `icon` | `mdi:printer` | Printericoon |

De kleur van een inkt volgt uit de naam (cyaan/cyan, magenta, geel/yellow,
zwart/black, ook Duits en Frans). Een eigen kleur zet je in YAML:

```yaml
inks:
  - sensor.printer_cyaan
  - entity: sensor.printer_foto_zwart
    color: "#555"
```

Status- en inktsensoren komen meestal van de IPP-integratie. Komt de
pagina-teller van een andere integratie (bijvoorbeeld SNMP), dan staat die
op een ander apparaat en kies je hem zelf bij **Pagina-teller**.

## Thema-variabelen

Allemaal optioneel; zonder variabelen volgt de badge je Home
Assistant-thema.

| Thema-variabele | Standaard |
|---|---|
| `printer-badge-icon-color` | `var(--primary-color)` |
| `printer-badge-printing-color` | `var(--yellow-color)` |
| `printer-badge-error-color` | `var(--red-color)` |
| `printer-badge-low-color` | `var(--red-color)` |
| `printer-badge-ink-outline` | dun wit randje om de druppels; `none` om uit te zetten |

## Toegankelijkheid

De badge heeft een beschrijvend label voor schermlezers (naam, status,
pagina's en inktniveaus) en is met het toetsenbord te openen. De
pulserende animatie staat uit bij "minder beweging" in je systeem.

## Licentie

MIT — zie [LICENSE](LICENSE).
