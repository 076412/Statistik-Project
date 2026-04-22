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
 
 
