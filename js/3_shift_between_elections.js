function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isNaN(value) ? null : value;
 
  const cleaned = String(value).trim().replace(/\s/g, "").replace(",", ".");
  const num = Number(cleaned);
  return Number.isNaN(num) ? null : num;
}
 
function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/å/g, "a")
    .replace(/ä/g, "a")
    .replace(/ö/g, "o");
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
 
addMdToPage(`
# Förändringar mellan valen
 
Den tredje delen av berättelsen fokuserar på **rörelse**.  
Här lämnar vi nivåerna och tittar i stället på det som ofta är mest intressant i valstatistik: **förändringen**.
 
Var ökade ett parti mest? Var tappade det stöd?  
Genom att jämföra 2018 och 2022 kan vi se vilka kommuner som blivit partiets nya styrkeområden – och vilka som rört sig åt ett annat håll.
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
  "Sverigedemokraterna"
);
 
const sortering = addDropdown(
  "Sortera:",
  ["Störst ökning", "Störst minskning"],
  "Störst ökning"
);
 
try {
  dbQuery.use("riksdagsval-neo4j");
  const electionRows = await dbQuery(`
    MATCH (n:Partiresultat)
    RETURN n.kommun AS kommun,
           n.parti AS parti,
           n.roster2018 AS roster2018,
           n.roster2022 AS roster2022
  `);
 
  const selectedParty = electionRows
    .map(row => {
      const roster2018 = toNumber(row.roster2018);
      const roster2022 = toNumber(row.roster2022);
 
      return {
        kommun: row.kommun,
        parti: row.parti,
        roster2018,
        roster2022,
        skillnad: roster2018 !== null && roster2022 !== null ? roster2022 - roster2018 : null
      };
    })
    .filter(row => sameParty(row.parti, parti) && row.skillnad !== null);
 
  selectedParty.sort((a, b) =>
    sortering === "Störst ökning"
      ? b.skillnad - a.skillnad
      : a.skillnad - b.skillnad
  );
 
  const avgChange = average(selectedParty.map(r => r.skillnad));
  const positiveCount = selectedParty.filter(r => r.skillnad > 0).length;
  const negativeCount = selectedParty.filter(r => r.skillnad < 0).length;
 
  addMdToPage(`
## Tolkning
 
Om ett parti ökar i många kommuner samtidigt kan det tyda på en bred nationell trend.  
Om förändringen däremot bara sker i vissa få kommuner är det snarare ett lokalt mönster.
 
Därför hjälper den här sidan oss att se om partiets rörelse mellan 2018 och 2022 är **bred**, **ojämn** eller **koncentrerad**.
`);
 
  addMdToPage(`
**Översikt**
- Kommuner i analysen: **${selectedParty.length}**
- Genomsnittlig förändring: **${avgChange !== null ? avgChange.toFixed(1) : "saknas"}**
- Kommuner med ökning: **${positiveCount}**
- Kommuner med minskning: **${negativeCount}**
`);
 
  if (!selectedParty.length) {
    addMdToPage(`**Ingen valdata hittades för ${parti}.**`);
  } else {
    tableFromData({
      data: selectedParty.slice(0, 20),
      columnNames: ["Kommun", "Parti", "Röster 2018", "Röster 2022", "Skillnad"]
    });
 
    const chartData = selectedParty.slice(0, 15).map(r => ({
      kommun: r.kommun,
      skillnad: Number(r.skillnad)
    }));
 
    drawGoogleChart({
      type: "ColumnChart",
      data: makeChartFriendly(chartData, "kommun", "skillnad"),
      options: {
        title: `${parti} – ${sortering.toLowerCase()}`,
        height: 650,
        legend: { position: "none" },
        hAxis: { title: "Kommun", slantedText: true, slantedTextAngle: 45 },
        vAxis: { title: "Skillnad i röster" }
      }
    });
  }
} catch (error) {
  addMdToPage(`## Fel\n**Fel på sidan:** ${error.message}`);
}
