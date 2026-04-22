// Analys: Samband mellan befolkningstäthet och röstresultat
// Hämtar data från tre databaser (SQLite, MySQL, Neo4j)
// och kopplar ihop dem via kommun och län

function normalizeText(value) {
  // Gör text jämförbar: små bokstäver, tar bort extra mellanslag och specialtecken
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/å/g, "a")
    .replace(/ä/g, "a")
    .replace(/ö/g, "o");
}

function normalizeCountyName(value) {
  // Rensar länsnamn så de matchar mellan olika databaser
  let text = normalizeText(value).replace(/\slan$/, "").trim();

  const manualMap = {
    "stockholms": "stockholm",
    "uppsalas": "uppsala",
    "sodermanlands": "sodermanland",
    "ostergotlands": "ostergotland",
    "jonkopings": "jonkoping",
    "kronobergs": "kronoberg",
    "gotlands": "gotland",
    "hallands": "halland",
    "vastra gotalands": "vastra gotaland",
    "varmlands": "varmland",
    "vastmanlands": "vastmanland",
    "dalarnas": "dalarna",
    "gavleborgs": "gavleborg",
    "vasternorrlands": "vasternorrland",
    "jamtlands": "jamtland",
    "vasterbottens": "vasterbotten",
    "norrbottens": "norrbotten"
  };

  return manualMap[text] || text;
}

function toNumber(value) {
  // Omvandlar text till nummer (hanterar t.ex. "1 234,5")
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isNaN(value) ? null : value;

  const cleaned = String(value).trim().replace(/\s/g, "").replace(",", ".");
  const num = Number(cleaned);
  return Number.isNaN(num) ? null : num;
}

function getPartyAliases(selectedParty) {
  // Hanterar olika namn på samma parti
  const aliases = {
    "Moderaterna": ["Moderaterna"],
    "Socialdemokraterna": ["Socialdemokraterna", "Arbetarepartiet-Socialdemokraterna"],
    "Sverigedemokraterna": ["Sverigedemokraterna"],
    "Centerpartiet": ["Centerpartiet"],
    "Vänsterpartiet": ["Vänsterpartiet"],
    "Kristdemokraterna": ["Kristdemokraterna"],
    "Liberalerna": ["Liberalerna"],
    "Miljöpartiet de gröna": ["Miljöpartiet de gröna"]
  };

  return (aliases[selectedParty] || [selectedParty]).map(normalizeText);
}

function sameParty(dbParty, selectedParty) {
  // Jämför partinamn mellan databasen och användarens val
  return getPartyAliases(selectedParty).includes(normalizeText(dbParty));
}

function average(values) {
  // Räknar ut medelvärde
  const valid = values.filter(v => typeof v === "number" && !Number.isNaN(v));
  if (!valid.length) return null;
  return valid.reduce((sum, v) => sum + v, 0) / valid.length;
}

function median(values) {
  // Räknar ut median (bra för att undvika extrema värden)
  const valid = values
    .filter(v => typeof v === "number" && !Number.isNaN(v))
    .sort((a, b) => a - b);

  if (!valid.length) return null;

  const mid = Math.floor(valid.length / 2);
  return valid.length % 2 === 0
    ? (valid[mid - 1] + valid[mid]) / 2
    : valid[mid];
}

// Introduktionstext på sidan
addMdToPage(`
# Befolkningstäthet och röster

Den här sidan undersöker om **befolkningstäthet** hänger ihop med hur människor röstar.

I många politiska analyser beskrivs skillnaden mellan **stad och landsbygd** som en viktig skiljelinje.  
Därför tittar vi här på om partiets starkaste kommuner också är kommuner med hög eller låg befolkningstäthet.

Vi jämför dessutom partiets starkaste och svagaste kommuner för att få en tydligare bild av om det finns ett geografiskt mönster.
`);

// Dropdown för att välja parti
const parti = addDropdown(
  "Välj parti:",
  [
    "Moderaterna",
    "Socialdemokraterna",
    "Sverigedemokraterna",
    "Centerpartiet",
    "Vänsterpartiet",
    "Kristdemokraterna",
    "Liberalerna",
    "Miljöpartiet de gröna"
  ],
  "Socialdemokraterna"
);

try {
  // Hämtar befolkningstäthet per län från SQLite
  dbQuery.use("counties-sqlite");
  const countyRows = await dbQuery(`
    SELECT lan, invanarePerKm2
    FROM countyInfo
  `);

  // Hämtar koppling mellan kommun och län från MySQL
  dbQuery.use("geo-mysql");
  const geoRows = await dbQuery(`
    SELECT municipality, county
    FROM geoData
  `);

  // Hämtar valresultat från Neo4j
  dbQuery.use("riksdagsval-neo4j");
  const electionRows = await dbQuery(`
    MATCH (n:Partiresultat)
    RETURN n.kommun AS kommun,
           n.parti AS parti,
           n.roster2018 AS roster2018,
           n.roster2022 AS roster2022
  `);

  // Förbereder befolkningstäthet-data
  const densityByCounty = countyRows
    .map(row => ({
      lan: row.lan,
      countyKey: normalizeCountyName(row.lan),
      invanarePerKm2: toNumber(row.invanarePerKm2)
    }))
    .filter(row => row.countyKey && row.invanarePerKm2 !== null);

  // Kopplar kommun till län
  const municipalityToCounty = geoRows
    .map(row => ({
      municipalityKey: normalizeText(row.municipality),
      countyKey: normalizeCountyName(row.county)
    }))
    .filter(row => row.municipalityKey && row.countyKey);

  // Filtrerar fram rätt parti och beräknar skillnad mellan val
  const partyVotes = electionRows
    .map(row => {
      const roster2018 = toNumber(row.roster2018);
      const roster2022 = toNumber(row.roster2022);

      return {
        kommun: row.kommun,
        parti: row.parti,
        roster2018,
        roster2022,
        skillnad:
          roster2018 !== null && roster2022 !== null
            ? roster2022 - roster2018
            : null,
        kommunKey: normalizeText(row.kommun)
      };
    })
    .filter(row => sameParty(row.parti, parti) && row.roster2022 !== null);

  // Kopplar ihop kommun → län → befolkningstäthet
  const joined = partyVotes
    .map(voteRow => {
      const geoRow = municipalityToCounty.find(g => g.municipalityKey === voteRow.kommunKey);
      if (!geoRow) return null;

      const densityRow = densityByCounty.find(c => c.countyKey === geoRow.countyKey);
      if (!densityRow) return null;

      return {
        kommun: voteRow.kommun,
        lan: densityRow.lan,
        befolkningstathet: densityRow.invanarePerKm2,
        roster2018: voteRow.roster2018,
        roster2022: voteRow.roster2022,
        skillnad: voteRow.skillnad
      };
    })
    .filter(Boolean);

  // Tar fram starkaste och svagaste kommuner
  const strongest = [...joined]
    .sort((a, b) => b.roster2022 - a.roster2022)
    .slice(0, 10);

  const weakest = [...joined]
    .sort((a, b) => a.roster2022 - b.roster2022)
    .slice(0, 10);

  // Kommuner med högst befolkningstäthet
  const denseTop = [...joined]
    .sort((a, b) => b.befolkningstathet - a.befolkningstathet)
    .slice(0, 15);

  // Statistik
  const medianDensityStrongest = median(strongest.map(r => r.befolkningstathet));
  const medianDensityWeakest = median(weakest.map(r => r.befolkningstathet));
  const averageChangeStrongest = average(strongest.map(r => r.skillnad));
  const averageChangeWeakest = average(weakest.map(r => r.skillnad));

  addMdToPage(`
## Tolkning

Genom att jämföra partiets starkaste och svagaste kommuner kan vi se om stödet verkar vara starkare i tätare eller glesare delar av landet.
`);

  // Översikt
  addMdToPage(`
**Översikt**

- Matchade kommuner: **${joined.length}**
- Median befolkningstäthet i starkaste: **${medianDensityStrongest?.toFixed(1) ?? "saknas"}**
- Median befolkningstäthet i svagaste: **${medianDensityWeakest?.toFixed(1) ?? "saknas"}**
`);

  if (!joined.length) {
    addMdToPage(`**Ingen sammanslagen data hittades.**`);
  } else {

    // Scatterplot: samband mellan täthet och röster
    drawGoogleChart({
      type: "ScatterChart",
      data: makeChartFriendly(
        joined.map(r => ({
          befolkningstathet: Number(r.befolkningstathet),
          roster2022: Number(r.roster2022)
        })),
        "befolkningstathet",
        "roster2022"
      ),
      options: {
        title: `${parti}: befolkningstäthet och röster 2022`
      }
    });

  }
} catch (error) {
  addMdToPage(`## Fel\n**Fel på sidan:** ${error.message}`);
}
