# SimPhase — Upgrade "Monte Carlo" (Juin 2026)

## Ce qui a changé et pourquoi

### 1. Le moteur est maintenant une vraie simulation Monte Carlo
`lib/simphase/engine.ts` réécrit. L'ancien moteur était une formule de scoring
(score de base + pénalités calibrées à la main, borné 5–90%). Le nouveau simule
des milliers de tentatives complètes, trade par trade, sous les règles exactes :
daily loss, max loss statique / trailing EOD / trailing intraday, phases avec
reset des limites, Best Day FTMO (retarde, ne breach pas), consistency Topstep.

Deux ingrédients d'honnêteté :
- **Incertitude d'échantillonnage** : chaque tentative tire un "vrai" win rate /
  payoff dans l'intervalle de confiance de l'historique. 120 trades ne prouvent
  pas un edge exact — la simulation le reflète.
- **Modèle comportemental** : les modes calm/realistic/pressure pilotent un
  kill-switch, une probabilité de tilt et du slippage (avant : décalage cosmétique).

Sorties nouvelles : répartition empirique des modes d'échec (`failureBreakdown`,
`failureModeShare`), jours P25/P75, part des passes retardées par les règles de
distribution (`delayedShare`), nombre de runs (`simRuns`). Déterministe (seedé).

### 2. Catalogue des firms corrigé (vérifié juin 2026)
`lib/simphase/firms.ts` :
- **Topstep restructuré** : les produits fictifs "Standard Combine" / "TopstepX"
  remplacés par le vrai Trading Combine. Coût modélisé en **abonnement mensuel**
  + $149 d'activation (reset credits inclus). Drawdown = trailing **intraday**
  gelé au break-even. Daily Loss = soft (verrouille la journée), non modélisé en échec.
- **FTMO 1-Step** : Best Day = délai, pas breach. Min days corrigés (4/phase en 2-Step).
- **FundedNext** : taille $6K ajoutée, prix 1-Step alignés sur 2-Step.
- `rulesVerified: 'June 2026'` partout, affiché dans l'UI.

### 3. UI / copy orientés conversion (`app/page.tsx`)
- Bandeau Beta supprimé du haut de page (le CTA feedback post-résultats reste).
- Hero : promesse Monte Carlo ("thousands of rule-accurate simulations…").
- Ligne de preuve sous le verdict : "Based on 9,000 simulated attempts… Rules verified June 2026".
- Mode d'échec affiché avec sa part empirique ("67% of simulated failures").
- Bloc méthodologie réécrit.
- Chip "Rules verified June 2026" dans le header.

### 4. Divers
- CSV : expectancy normalisée en R-multiples (cohérence manual/CSV).
- Démo : 60 trades datés (confiance crédible) au lieu de 20.
- Bug TS préexistant corrigé dans `execution.ts` ; `ignoreBuildErrors` retiré
  (le projet typecheck à 0 erreur) ; smoke tests dans `scripts/`.

## Calibration (profil 47% WR / 2.0 RR / 2.1 t/j, mode realistic, $50k)
- FTMO 2-Step : ~77% pass, risque reco ~0.9%, 14–31 jours, échec dominant = max loss (67%)
- Pressure mode : ~54% (Playable) · Calm : ~84%
- Edge négatif : ~0% (Fragile) · Edge marginal 45%/1.3 : ~23% (Borderline)
- Topstep : 70% des échecs = trailing intraday ; coût en mois d'abonnement

### 5. Monétisation intégrée (paywall $19, zéro backend)
- Verdict, mode d'échec, coût attendu : **gratuits** (le hook).
- Risque recommandé, variantes, plan d'exécution, alternatives, PDF : **$19 one-time**.
- S'active uniquement si `NEXT_PUBLIC_STRIPE_PAYMENT_LINK` est défini (sinon tout reste gratuit).
- Flux : Stripe Payment Link → redirect `?unlocked=sp19` → localStorage. Voir `LAUNCH.md`.
- SEO : title/description orientés "prop firm challenge simulator".

## Déploiement
Remplacer les fichiers modifiés (ou pousser le repo) :
`lib/simphase/{engine,firms,types,edge,execution}.ts`, `lib/store.tsx`,
`app/page.tsx`, `next.config.mjs`, `README.md`, `scripts/*`.
`npm install && npx next build` → vert. Vercel redéploie au push.
