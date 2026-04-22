function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/å/g, "a")
    .replace(/ä/g, "a")
    .replace(/ö/g, "o");
}
 
function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isNaN(value) ? null : value;
 
  const cleaned = String(value).trim().replace(/\s/g, "").replace(",", ".");
  const num = Number(cleaned);
  return Number.isNaN(num) ? null : num;
}
 
function getPartyAliases(selectedParty) {
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
  return getPartyAliases(selectedParty).includes(normalizeText(dbParty));
}
 
function average(values) {
  const valid = values.filter(v => typeof v === "number" && !Number.isNaN(v));
  if (!valid.length) return null;
  return valid.reduce((sum, v) => sum + v, 0) / valid.length;
}
 
function onlyValidRows(rows, fieldName) {
  return rows.filter(row => typeof row[fieldName] === "number" && !Number.isNaN(row[fieldName]));
}
 
addMdToPage(`
# Var är partiet starkast och svagast?
 
Den sista delen av vår berättelse handlar om **partiets egna geografiska profil**.  
Här undersöker vi var partiet har sina starkaste fästen, var det står svagast och var det har förändrats mest mellan 2018 och 2022.
 
På så sätt knyter den här sidan ihop de tidigare frågorna:
- ekonomiska skillnader
- geografiska skillnader
- förändring över tid
- regionala mönster
 
Nu tittar vi direkt på partiets **starkaste och svagaste områden**.
`);
 
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
  "Moderaterna"
);
 
try {
  dbQuery.use("riksdagsval-neo4j");
 
  const rows = await dbQuery(`
    MATCH (n:Partiresultat)
    RETURN n.kommun AS kommun,
           n.parti AS parti,
           n.roster2018 AS roster2018,
           n.roster2022 AS roster2022
  `);
 
  const data = rows
    .map(row => {
      const roster2018 = toNumber(row.roster2018);
      const roster2022 = toNumber(row.roster2022);
 
      return {
        kommun: String(row.kommun || "").trim(),
        parti: String(row.parti || "").trim(),
        roster2018,
        roster2022,
        skillnad:
          roster2018 !== null && roster2022 !== null
            ? roster2022 - roster2018
            : null
      };
    })
    .filter(row => row.kommun)
    .filter(row => sameParty(row.parti, parti))
    .filter(row => row.roster2018 !== null && row.roster2022 !== null);
 
  const strongest = [...data].sort((a, b) => b.roster2022 - a.roster2022).slice(0, 10);
  const weakest = [...data].sort((a, b) => a.roster2022 - b.roster2022).slice(0, 10);
  const biggestIncrease = [...data].sort((a, b) => b.skillnad - a.skillnad).slice(0, 10);
  const biggestDecrease = [...data].sort((a, b) => a.skillnad - b.skillnad).slice(0, 10);
 
  const average2018 = average(data.map(r => r.roster2018));
  const average2022 = average(data.map(r => r.roster2022));
  const averageChange = average(data.map(r => r.skillnad));
  const increasedCount = data.filter(r => r.skillnad > 0).length;
  const decreasedCount = data.filter(r => r.skillnad < 0).length;
 
  addMdToPage(`
## Översikt
 
- Kommuner i analysen: **${data.length}**
- Genomsnittliga röster 2018: **${average2018 !== null ? average2018.toFixed(1) : "saknas"}**
- Genomsnittliga röster 2022: **${average2022 !== null ? average2022.toFixed(1) : "saknas"}**
- Genomsnittlig förändring: **${averageChange !== null ? averageChange.toFixed(1) : "saknas"}**
- Kommuner där partiet ökade: **${increasedCount}**
- Kommuner där partiet minskade: **${decreasedCount}**
`);
 
  addMdToPage(`
## Tolkning
 
Den här sidan visar om partiet har ett **brett nationellt stöd** eller om stödet är mer **koncentrerat till särskilda kommuner**.  
Samtidigt ser vi var partiet växer och var det tappar mest.
 
Det gör att vi kan avsluta hela projektet med en tydlig bild av partiets **politiska geografi**.
`);
 
  if (!data.length) {
    addMdToPage(`**Ingen data hittades för det valda partiet.**`);
  } else {
    addMdToPage(`## Starkast stöd 2022`);
    tableFromData({
      data: strongest,
      columnNames: ["Kommun", "Parti", "Röster 2018", "Röster 2022", "Skillnad"]
    });
 
    drawGoogleChart({
      type: "ColumnChart",
      data: makeChartFriendly(
        onlyValidRows(strongest.map(r => ({ namn: r.kommun, varde: Number(r.roster2022) })), "varde"),
        "namn",
        "varde"
      ),
      options: {
        title: `${parti} – starkast stöd 2022`,
        height: 550,
        legend: { position: "none" },
        hAxis: { title: "Kommun", slantedText: true, slantedTextAngle: 45 },
        vAxis: { title: "Röster 2022" }
      }
    });
 
    addMdToPage(`## Svagast stöd 2022`);
    tableFromData({
      data: weakest,
      columnNames: ["Kommun", "Parti", "Röster 2018", "Röster 2022", "Skillnad"]
    });
 
    drawGoogleChart({
      type: "ColumnChart",
      data: makeChartFriendly(
        onlyValidRows(weakest.map(r => ({ namn: r.kommun, varde: Number(r.roster2022) })), "varde"),
        "namn",
        "varde"
      ),
      options: {
        title: `${parti} – svagast stöd 2022`,
        height: 550,
        legend: { position: "none" },
        hAxis: { title: "Kommun", slantedText: true, slantedTextAngle: 45 },
        vAxis: { title: "Röster 2022" }
      }
    });
 
    addMdToPage(`## Största ökningar mellan 2018 och 2022`);
    tableFromData({
      data: biggestIncrease,
      columnNames: ["Kommun", "Parti", "Röster 2018", "Röster 2022", "Skillnad"]
    });
 
    drawGoogleChart({
      type: "ColumnChart",
      data: makeChartFriendly(
        onlyValidRows(biggestIncrease.map(r => ({ namn: r.kommun, varde: Number(r.skillnad) })), "varde"),
        "namn",
        "varde"
      ),
      options: {
        title: `${parti} – största ökningar`,
        height: 550,
        legend: { position: "none" },
        hAxis: { title: "Kommun", slantedText: true, slantedTextAngle: 45 },
        vAxis: { title: "Skillnad i röster" }
      }
    });
 
    addMdToPage(`## Största minskningar mellan 2018 och 2022`);
    tableFromData({
      data: biggestDecrease,
      columnNames: ["Kommun", "Parti", "Röster 2018", "Röster 2022", "Skillnad"]
    });
 
    drawGoogleChart({
      type: "ColumnChart",
      data: makeChartFriendly(
        onlyValidRows(biggestDecrease.map(r => ({ namn: r.kommun, varde: Number(r.skillnad) })), "varde"),
        "namn",
        "varde"
      ),
      options: {
        title: `${parti} – största minskningar`,
        height: 550,
        legend: { position: "none" },
        hAxis: { title: "Kommun", slantedText: true, slantedTextAngle: 45 },
        vAxis: { title: "Skillnad i röster" }
      }
    });
 
    addMdToPage(`
## Sammanfattning av hela projektet
 
Tillsammans visar de fem sidorna att valresultat i Sverige inte bara handlar om vilka partier som får flest röster.  
De handlar också om **ekonomiska skillnader**, **geografiska skillnader**, **regionala mönster** och **förändringar över tid**.
 
Det gör att berättelsen om Sverige mellan 2018 och 2022 blir en berättelse om ett land där politik, plats och samhällsstruktur hänger tätt ihop.
    `);
  }
} catch (error) {
  addMdToPage(`## Fel\n**Fel på sidan 5:** ${error.message}`);
}
