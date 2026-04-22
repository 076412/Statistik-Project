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

function getKommun(row) {
  return (
    row.kommun ||
    row.Kommun ||
    row.kommunnamn ||
    row.municipality ||
    row.locality ||
    row.name ||
    null
  );
}

function getIncome2018(row) {
  return (
    toNumber(row.medianInkomst2018) ??
    toNumber(row.medelInkomst2018) ??
    toNumber(row.medianinkomst2018) ??
    toNumber(row.medelinkomst2018) ??
    toNumber(row.medianIncome2018) ??
    toNumber(row.meanIncome2018) ??
    null
  );
}

function getIncome2022(row) {
  return (
    toNumber(row.medianInkomst2022) ??
    toNumber(row.medelInkomst2022) ??
    toNumber(row.medianinkomst2022) ??
    toNumber(row.medelinkomst2022) ??
    toNumber(row.medianIncome2022) ??
    toNumber(row.meanIncome2022) ??
    null
  );
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

function median(values) {
  const valid = values
    .filter(v => typeof v === "number" && !Number.isNaN(v))
    .sort((a, b) => a - b);

  if (!valid.length) return null;

  const mid = Math.floor(valid.length / 2);
  return valid.length % 2 === 0
    ? (valid[mid - 1] + valid[mid]) / 2
    : valid[mid];
}

addMdToPage(`
# Inkomst och röster

Den här sidan undersöker om det finns ett samband mellan **inkomstnivåer i kommunerna** och **hur människor röstar**.

Det är en vanlig tanke i svensk politik att ekonomi påverkar partival.  
Men i stället för att bara titta på hela landet i stort, fokuserar vi här på **partiets starkaste och svagaste kommuner**.

Det gör att vi kan svara på mer intressanta frågor:

- Är partiet starkare i kommuner med högre eller lägre inkomster?
- Ser vi samma mönster i de kommuner där partiet tappat eller vuxit?
- Är skillnaden mellan 2018 och 2022 tydlig i vissa typer av kommuner?

På så sätt blir sidan inte bara en tabell, utan en berättelse om **ekonomi och politiskt stöd**.
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
  dbQuery.use("kommun-info-mongodb");
  const incomeRows = await dbQuery.collection("incomeByKommun").find({}).limit(500);

  dbQuery.use("riksdagsval-neo4j");
  const electionRows = await dbQuery(`
    MATCH (n:Partiresultat)
    RETURN n.kommun AS kommun,
           n.parti AS parti,
           n.roster2018 AS roster2018,
           n.roster2022 AS roster2022
  `);
