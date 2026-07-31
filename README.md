# Codeur Watcher

Agent de veille automatisée qui surveille les nouvelles missions freelance publiées sur [codeur.com](https://www.codeur.com) et envoie une notification Slack pour chaque nouvelle opportunité.

<img width="1375" height="567" alt="Capture d&#39;écran 2026-08-01 005955" src="https://github.com/user-attachments/assets/d1313eef-3f13-47a7-b8e9-350bee88903f" />
.png)

---

## Le problème

Sur une marketplace freelance, la réactivité est déterminante : les missions les plus intéressantes reçoivent des dizaines d'offres en quelques heures. Consulter le site manuellement plusieurs fois par jour est chronophage et peu fiable — on rate forcément des annonces.

L'objectif était donc de construire un agent qui surveille trois catégories (Développement, IA, Web) et pousse chaque nouvelle mission dans un canal Slack dédié, sans doublon et sans intervention humaine.

---

## Fonctionnement

Le workflow tourne toutes les heures sur n8n Cloud.

```
Schedule Trigger (1h)
  │
  ├─ RSS Développement  →  Set (categorie: Dev)
  ├─ RSS IA             →  Set (categorie: IA)
  └─ RSS Web            →  Set (categorie: Web)
                              │
                          Merge (append)
                              │
                          Code (normalisation)
                              │
                          Remove Duplicates (sur guid)
                              │
                          Slack (notification)
```

**Étape par étape :**

1. **Schedule Trigger** — déclenche le workflow toutes les heures.
2. **RSS Read × 3** — interroge les flux RSS des trois catégories surveillées.
3. **Set × 3** — marque l'origine de chaque mission avant la fusion des flux.
4. **Merge** — empile les trois listes en un flux unique (~100 items).
5. **Code** — normalise les données brutes en champs exploitables.
6. **Remove Duplicates** — ne laisse passer que les missions jamais vues.
7. **Slack** — envoie une notification formatée par nouvelle mission.

---

## Choix techniques

### RSS plutôt que scraping HTML

La première approche envisagée était le scraping de la page HTML. Une inspection de l'interface a révélé que codeur.com expose un flux RSS par catégorie, filtrable via les mêmes paramètres d'URL que l'interface web.

Ce choix apporte trois avantages décisifs :

- **Stabilité** — un flux RSS suit une norme, contrairement à des classes CSS qui peuvent changer à n'importe quelle mise à jour du site.
- **Données pré-structurées** — le node RSS de n8n expose directement `title`, `link`, `guid`, `pubDate` et un champ `contentSnippet` déjà débarrassé de ses balises HTML.
- **Conformité** — un flux RSS est explicitement conçu pour la consommation automatisée, là où du scraping agressif expose à un blocage du compte.

Aucun navigateur headless n'a donc été nécessaire.

### Dédoublonnage sur `guid`, pas sur la date

Le réflexe intuitif serait de ne retenir que les missions publiées depuis moins d'une heure. **L'analyse du flux a montré que c'était une fausse piste.**

Le flux contient des projets « relancés » par leur auteur : ils remontent en tête de liste mais conservent leur `pubDate` d'origine. Un échantillon de 35 items pris en juillet 2026 contenait ainsi des annonces datées de mai 2025 et septembre 2025, intercalées entre des missions du jour. Un filtre temporel les aurait toutes ignorées — alors qu'une mission relancée est précisément une mission dont le client n'a pas trouvé son prestataire, donc une opportunité.

Le flux présente par ailleurs une incohérence de fuseau horaire (`lastBuildDate` en décalage de 3 heures avec les items les plus récents), ce qui rendrait tout filtre temporel hasardeux.

Le champ `guid` contient l'identifiant numérique unique du projet. C'est une clé immuable et fiable, utilisée ici via le node **Remove Duplicates** en mode « items déjà vus lors des exécutions précédentes ».

**Effet de bord bénéfique :** une mission taguée à la fois « Développement » et « Web » apparaît dans deux flux. Le dédoublonnage sur `guid` l'élimine automatiquement — une seule notification est envoyée.

### Filtrage à la source via `states[]=published`

Le flux RSS ne contient ni le statut de la mission, ni son nombre d'offres. Or une mission déjà attribuée (statut « En travail ») est inutile à notifier.

En appliquant le filtre « Projets ouverts » dans l'interface puis en régénérant l'URL RSS, on constate que le paramètre `states[]=published` survit au passage en `format=rss`. Le filtrage est donc effectué **côté serveur**, ce qui supprime un node de filtrage et réduit le volume traité.

### Pas de base de données externe

Une première architecture prévoyait Google Sheets comme mémoire des missions déjà vues. Le node **Remove Duplicates** de n8n gère nativement la persistance entre exécutions, ce qui a permis de supprimer entièrement cette dépendance.

Le calcul de volumétrie confirme que c'est suffisant : seul l'identifiant est stocké (6 caractères), pour environ 30 à 60 nouvelles missions par jour. Une base externe serait du surdimensionnement.

### Normalisation isolée dans un node dédié

Le node Code convertit le texte brut du flux en champs structurés (`budget`, `categories`, `description`, `url`…).

Cette séparation entre *récupération* et *utilisation* de la donnée permet de faire évoluer le format du message Slack, d'ajouter un filtre sur le budget ou de brancher un scoring IA sans jamais toucher aux nodes RSS. Si codeur.com modifie son format, un seul node est à corriger.

---

## Installation

**Prérequis :** une instance n8n (cloud ou self-hosted) et un espace de travail Slack.

1. Importer `workflow.json` dans n8n : menu `...` → **Import from File**
2. Configurer les credentials Slack sur le node de notification (OAuth)
3. Sélectionner le canal Slack de destination
4. Régler le fuseau horaire du workflow sur `Europe/Paris` (Settings → Timezone)

### Amorçage — étape à ne pas sauter

À la première exécution, les flux remontent une centaine de missions existantes. Sans précaution, elles partent toutes dans Slack d'un coup.

**Procédure :**

1. Désactiver le node Slack (clic droit → *Deactivate*)
2. Exécuter le workflow une fois — le Remove Duplicates mémorise les identifiants sans rien envoyer
3. Réactiver le node Slack
4. Activer le workflow

Seules les nouveautés réelles déclencheront ensuite une notification.

---

## Flux surveillés

| Catégorie | URL |
|---|---|
| Développement | `https://www.codeur.com/projects?c=developpement&format=rss&order=most_recent&states%5B%5D=published` |
| IA | `https://www.codeur.com/projects?c=ia&format=rss&order=most_recent&states%5B%5D=published` |
| Web | `https://www.codeur.com/projects?c=web&format=rss&order=most_recent&states%5B%5D=published` |

Ajouter une catégorie revient à dupliquer le couple RSS + Set, changer le paramètre `c=` et brancher une entrée supplémentaire sur le Merge.

---

## Limites connues

- **Descriptions tronquées** — le flux RSS limite la description à environ 200 caractères. Récupérer le texte complet exigerait une requête HTTP par mission.
- **Nombre d'offres indisponible** — l'information n'est pas exposée dans le flux, alors qu'elle indique le niveau de concurrence sur une mission.
- **Projets confidentiels** — certaines annonces masquent leur description, réservée aux abonnés payants. Elles sont notifiées avec un contenu vide.
- **Granularité des budgets** — codeur.com ne publie que des tranches (`500 € à 1 000 €`, `1 000 € à 10 000 €`…), sans montant précis.
- **Fenêtre de détection** — le flux ne contient que les ~35 dernières annonces par catégorie. En cas d'arrêt prolongé du workflow, des missions peuvent être manquées.

---

## Pistes d'évolution

- Scoring des missions par LLM selon un profil de compétences, pour ne notifier que les plus pertinentes
- Enrichissement par requête HTTP sur les missions retenues (description complète, nombre d'offres)
- Filtrage sur le budget minimum
- Génération assistée d'une première proposition commerciale

---

## Stack

n8n · RSS · JavaScript · Slack API
