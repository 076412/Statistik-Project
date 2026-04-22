function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/å/g, "a")
    .replace(/ä/g, "a")
    .replace(/ö/g, "o");
}
 
function normalizeCountyName(value) {
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
 
addMdToPage(`
# Regionala skillnader
 
Den fjärde delen av vår berättelse zoomar ut från kommunnivå till **regional nivå**.  
Här tittar vi på Sverige som ett land med olika politiska landskap, där partier kan vara starka i vissa delar men svagare i andra.
 
När vi summerar kommunresultaten till länsnivå blir det lättare att se större geografiska mönster.  
Det hjälper oss att förstå om ett parti har en tydlig regional profil.
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
  dbQuery.use("counties-sqlite");
  const countyRows = await dbQuery(`
    SELECT lan, folkmangd2024, residensstad, kommuner
    FROM countyInfo
  `);
 
  dbQuery.use("geo-mysql");
  const geoRows = await dbQuery(`
    SELECT municipality, county
    FROM geoData
  `);
 
  dbQuery.use("riksdagsval-neo4j");
  const electionRows = await dbQuery(`
    MATCH (n:Partiresultat)
    RETURN n.kommun AS kommun,
           n.parti AS parti,
           n.roster2018 AS roster2018,
           n.roster2022 AS roster2022
  `);
 
  const voteRows = electionRows
    .map(row => ({
      kommunKey: normalizeText(row.kommun),
      parti: row.parti,
      roster2018: toNumber(row.roster2018),
      roster2022: toNumber(row.roster2022)
    }))
    .filter(row => sameParty(row.parti, parti) && row.roster2022 !== null);
 
  const geoMap = geoRows.map(row => ({
    municipalityKey: normalizeText(row.municipality),
    countyKey: normalizeCountyName(row.county)
  }));
 
  const countyVoteSums2018 = {};
  const countyVoteSums2022 = {};
 
  for (const voteRow of voteRows) {
    const geoRow = geoMap.find(g => g.municipalityKey === voteRow.kommunKey);
    if (!geoRow) continue;
 
    if (!countyVoteSums2018[geoRow.countyKey]) countyVoteSums2018[geoRow.countyKey] = 0;
    if (!countyVoteSums2022[geoRow.countyKey]) countyVoteSums2022[geoRow.countyKey] = 0;
 
    countyVoteSums2018[geoRow.countyKey] += voteRow.roster2018 || 0;
    countyVoteSums2022[geoRow.countyKey] += voteRow.roster2022 || 0;
  }
 
  const result = countyRows
    .map(row => {
      const countyKey = normalizeCountyName(row.lan);
      const roster2018 = countyVoteSums2018[countyKey] || 0;
      const roster2022 = countyVoteSums2022[countyKey] || 0;
 
      return {
        lan: row.lan,
        folkmangd2024: toNumber(row.folkmangd2024),
        residensstad: row.residensstad,
        kommuner: toNumber(row.kommuner),
        roster2018,
        roster2022,
        skillnad: roster2022 - roster2018
      };
    })
    .sort((a, b) => b.roster2022 - a.roster2022);
 
  addMdToPage(`
## Tolkning
 
Om ett parti är starkt i vissa län men svagt i andra kan det tyda på att partiet har en tydlig regional bas.  
Skillnaden mellan 2018 och 2022 visar också om partiet håller på att stärka sin regionala ställning eller tappa mark i vissa delar av landet.
`);
 
  tableFromData({
    data: result,
    columnNames: [
      "Län",
      "Folkmängd 2024",
      "Residensstad",
      "Antal kommuner",
      "Röster 2018",
      "Röster 2022",
      "Skillnad"
    ]
  });
 
  const chartRows2022 = result.map(r => ({
    lan: r.lan,
    roster2022: Number(r.roster2022)
  }));
 
  drawGoogleChart({
    type: "ColumnChart",
    data: makeChartFriendly(chartRows2022, "lan", "roster2022"),
    options: {
      title: `${parti} per län 2022`,
      height: 550,
      legend: { position: "none" },
      hAxis: { title: "Län", slantedText: true, slantedTextAngle: 45 },
      vAxis: { title: "Röster 2022" }
    }
  });
 
  const chartRowsChange = result.map(r => ({
    lan: r.lan,
    skillnad: Number(r.skillnad)
  }));
 
  drawGoogleChart({
    type: "ColumnChart",
    data: makeChartFriendly(chartRowsChange, "lan", "skillnad"),
    options: {
      title: `${parti}: förändring mellan 2018 och 2022 per län`,
      height: 650,
      legend: { position: "none" },
      hAxis: { title: "Län", slantedText: true, slantedTextAngle: 45 },
      vAxis: { title: "Skillnad i röster" }
    }
  });
} catch (error) {
  addMdToPage(`## Fel\n**Fel på sidan:** ${error.message}`);
}
