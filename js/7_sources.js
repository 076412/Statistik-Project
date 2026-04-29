addMdToPage(`
## Samlad bedömning
 
Projektet undersöker hur valresultat i Sverige mellan 2018 och 2022 hänger ihop med olika samhällsfaktorer.
 
Genom att kombinera flera datakällor kan vi analysera:
 
- hur röster på partier ser ut i olika kommuner (valdata)
- hur ekonomi påverkar röstning (inkomstdata)
- hur skillnader mellan stad och landsbygd ser ut (befolkningstäthet)
- hur politiska mönster varierar mellan olika delar av landet (länsdata)
- hur utbildningsnivå hänger ihop med röstning (utbildningsdata)
 
### Hur datakällorna hänger ihop
 
De fem datakällorna kompletterar varandra:
 
- **Valdata (Neo4j)** är grunden och visar hur människor faktiskt röstade.
- **Inkomstdata (MongoDB)** gör det möjligt att koppla ekonomi till politiskt stöd.
- **Läns- och befolkningstäthet (SQLite)** visar geografiska och strukturella skillnader.
- **Geodata (MySQL)** binder ihop kommuner och län så att analyserna fungerar.
- **Utbildningsdata (SCB via Folkhälsomyndigheten)** visar antal personer per utbildningsnivå efter ålder, kön och region.
 
### Källor
 
- Utbildningsnivå efter ålder, kön, region och år (antal och andel) — Källa: Statistiska centralbyrån (SCB), hämtad via [Folkhälsomyndighetens Folkhälsodata](https://fohm-app.folkhalsomyndigheten.se/Folkhalsodata/pxweb/en/A_Folkhalsodata/A_Folkhalsodata__Z_ovrigdata__Demografi/Utbild.px/)
 
### Styrkor
 
- Flera olika typer av data används → ger en bred och djup analys  
- Data på kommunnivå → relativt detaljerad nivå  
- Kombination av ekonomi, geografi, utbildning och valresultat → ger tydliga samband  
 
### Svagheter
 
- Data kommer från flera databaser → risk för fel vid matchning  
- Skillnader i namn (kommuner, partier) → kräver normalisering i koden  
- Viss data (t.ex. befolkningstäthet) är på länsnivå → mindre exakt än kommunnivå  
 
### Slutsats
 
Datakällorna är relevanta och tillräckligt tillförlitliga för att analysera sambandet mellan **valresultat, ekonomi, utbildning och geografi i Sverige**.
 
Samtidigt måste resultaten tolkas med viss försiktighet, eftersom datan kommer från olika källor och ibland behöver anpassas för att fungera tillsammans.
`);