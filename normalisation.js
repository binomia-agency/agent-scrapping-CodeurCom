const out = [];

for (const item of $input.all()) {
  const j = item.json;

  const lignes = (j.contentSnippet || '')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);

  // Ligne 0 : "Budget : 500 € à 1 000 € - Catégories : Python, ChatGPT"
  const morceaux = (lignes[0] || '').split(' - Catégories : ');

  const budget = (morceaux[0] || '').replace('Budget : ', '').trim();
  const mots_cles = (morceaux[1] || '').trim();

  // Les lignes du milieu = la description
  const description = lignes.slice(1, -1).join(' ');

  const publieLeFr = new Date(j.isoDate).toLocaleString('fr-FR', {
    timeZone: 'Europe/Paris',
    dateStyle: 'short',
    timeStyle: 'short',
  });

  out.push({
    json: {
      id: j.guid,
      type: j.categorie_mission,
      titre: j.title,
      url: j.link,
      budget,
      mots_cles,
      description,
      publie_le: j.isoDate,
      publie_le_fr: publieLeFr,
      
    }
  });
}

return out;
