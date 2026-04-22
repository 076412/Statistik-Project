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

   const incomeData = incomeRows
    .map(row => {
      const kommun = getKommun(row);
      return {
        kommun,
        inkomst2018: getIncome2018(row),
        inkomst2022: getIncome2022(row),
        key: normalizeText(kommun)
      };
    })
    .filter(row => row.kommun && row.inkomst2022 !== null);

  const voteData = electionRows
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
        key: normalizeText(row.kommun)
      };
    })
    .filter(row => sameParty(row.parti, parti) && row.roster2022 !== null);

  const joined = voteData
    .map(voteRow => {
      const incomeRow = incomeData.find(inc => inc.key === voteRow.key);
      if (!incomeRow) return null;

      return {
        kommun: voteRow.kommun,
        inkomst2018: incomeRow.inkomst2018,
        inkomst2022: incomeRow.inkomst2022,
        roster2018: voteRow.roster2018,
        roster2022: voteRow.roster2022,
        skillnad: voteRow.skillnad
      };
    })
    .filter(Boolean);

  const strongest = [...joined]
    .sort((a, b) => b.roster2022 - a.roster2022)
    .slice(0, 10);

  const weakest = [...joined]
    .sort((a, b) => a.roster2022 - b.roster2022)
    .slice(0, 10);

  const strongestByIncome = [...joined]
    .sort((a, b) => b.inkomst2022 - a.inkomst2022)
    .slice(0, 15);

  const medianIncomeStrongest = median(strongest.map(r => r.inkomst2022));
  const medianIncomeWeakest = median(weakest.map(r => r.inkomst2022));
  const averageChangeStrongest = average(strongest.map(r => r.skillnad));
  const averageChangeWeakest = average(weakest.map(r => r.skillnad));

  addMdToPage(`
## Tolkning

I stället för att bara räkna på alla kommuner samtidigt jämför vi här partiets **starkaste** och **svagaste** kommuner.

Det gör analysen mer meningsfull, eftersom vi då ser om partiet faktiskt verkar ha sina främsta fästen i kommuner med högre eller lägre inkomster.

Om medianinkomsten är tydligt högre i partiets starkaste kommuner än i dess svagaste kommuner, då stärker det hypotesen att ekonomi och röstning hänger ihop.
`);

  addMdToPage(`
**Översikt**
- Matchade kommuner: **${joined.length}**
- Medianinkomst 2022 i partiets 10 starkaste kommuner: **${medianIncomeStrongest !== null ? medianIncomeStrongest.toFixed(1) : "saknas"}**
- Medianinkomst 2022 i partiets 10 svagaste kommuner: **${medianIncomeWeakest !== null ? medianIncomeWeakest.toFixed(1) : "saknas"}**
- Genomsnittlig röstförändring i starkaste kommunerna: **${averageChangeStrongest !== null ? averageChangeStrongest.toFixed(1) : "saknas"}**
- Genomsnittlig röstförändring i svagaste kommunerna: **${averageChangeWeakest !== null ? averageChangeWeakest.toFixed(1) : "saknas"}**
`);

  if (!joined.length) {
    addMdToPage(`
**Ingen sammanslagen data hittades.**

Kontrollera att kommunnamnen matchar mellan MongoDB och Neo4j.
    `);
  } else {
    addMdToPage(`
## Kommuner med högst inkomst 2022

Här ser vi kommuner med hög inkomstnivå tillsammans med partiets röster 2018 och 2022.
    `);

    tableFromData({
      data: strongestByIncome,
      columnNames: [
        "Kommun",
        "Inkomst 2018",
        "Inkomst 2022",
        "Röster 2018",
        "Röster 2022",
        "Skillnad"
      ]
    });

    const scatterRows = joined
      .filter(r => r.inkomst2022 !== null && r.roster2022 !== null)
      .map(r => ({
        inkomst2022: Number(r.inkomst2022),
        roster2022: Number(r.roster2022)
      }));

    drawGoogleChart({
      type: "ScatterChart",
      data: makeChartFriendly(scatterRows, "inkomst2022", "roster2022"),
      options: {
        title: `${parti}: inkomst och röster 2022`,
        height: 550,
        legend: "none",
        hAxis: { title: "Inkomst 2022" },
        vAxis: { title: `Röster på ${parti} 2022` },
        trendlines: { 0: {} }
      }
    });

    const compareRows = [
      {
        grupp: "10 starkaste kommuner",
        medianinkomst: medianIncomeStrongest !== null ? Number(medianIncomeStrongest) : 0
      },
      {
        grupp: "10 svagaste kommuner",
        medianinkomst: medianIncomeWeakest !== null ? Number(medianIncomeWeakest) : 0
      }
    ];

    drawGoogleChart({
      type: "ColumnChart",
      data: makeChartFriendly(compareRows, "grupp", "medianinkomst"),
      options: {
        title: `${parti}: medianinkomst i starkaste och svagaste kommunerna`,
        height: 500,
        legend: { position: "none" },
        hAxis: { title: "Grupp" },
        vAxis: { title: "Medianinkomst 2022" }
      }
    });

    const changeRows = strongest
      .filter(r => r.skillnad !== null)
      .map(r => ({
        kommun: r.kommun,
        skillnad: Number(r.skillnad)
      }));

    drawGoogleChart({
      type: "ColumnChart",
      data: makeChartFriendly(changeRows, "kommun", "skillnad"),
      options: {
        title: `${parti}: förändring mellan 2018 och 2022 i partiets starkaste kommuner`,
        height: 600,
        legend: { position: "none" },
        hAxis: { title: "Kommun", slantedText: true, slantedTextAngle: 45 },
        vAxis: { title: "Skillnad i röster" }
      }
    });
  }
} catch (error) {
  addMdToPage(`## Fel\n**Fel på sidan:** ${error.message}`);
}
