# agent-scrapping-CodeurCom
Schedule (1h)
  ├─ RSS Dev  → Set (source: Dev)
  ├─ RSS IA   → Set (source: IA)
  └─ RSS Web  → Set (source: Web)
        ↓
      Merge (append)
        ↓
      Code (normalisation)
        ↓
      Remove Duplicates (sur guid)
        ↓
      Slack
