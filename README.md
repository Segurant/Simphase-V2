# SimPhase — Prop Challenge Readiness Tool

## Quick Start

```bash
npm install
npm run dev
```

Ouvre http://localhost:3000

## Architecture

```
simphase/
├── app/                    ← Next.js App Router
│   ├── layout.tsx          ← Root layout
│   ├── page.tsx            ← Page d'entrée (starter)
│   └── globals.css         ← Design tokens
├── lib/
│   └── simphase/           ← LE MOTEUR (zéro DOM)
│       ├── engine.ts       ← Scoring, optimisation, verdicts
│       ├── edge.ts         ← Dérivation edge (manual + CSV)
│       ├── firms.ts        ← Catalogue firms & challenges
│       ├── types.ts        ← Tous les types TypeScript
│       └── index.ts        ← Barrel export
│   └── validation/
│       └── schemas.ts      ← Schémas Zod pour inputs
└── components/             ← Composants UI (Phase 2)
```

## Moteur (Monte Carlo)

Le moteur (`lib/simphase/engine.ts`) simule des **milliers de tentatives complètes de challenge, trade par trade**, sous les mécaniques exactes de chaque firm :
- Daily loss (reset quotidien), max loss statique / trailing EOD / trailing intraday (avec gel au break-even)
- Phases séquentielles avec reset des limites entre phases
- FTMO Best Day rule (retarde le pass, ne breach pas) et Topstep consistency rule
- Modèle comportemental : kill-switch, tilt, slippage sur les pertes (modes calm / realistic / pressure)
- **Incertitude d'échantillonnage** : chaque tentative tire un "vrai" edge dans l'intervalle de confiance de l'historique (taille d'échantillon = largeur)
- Horizon pratique de 60 jours de trading (abandon réaliste)

Déterministe (PRNG seedé) : mêmes entrées → mêmes résultats. Zéro DOM, testable (`scripts/engine-smoke.ts`).

1. **`evaluateChallenge()`** — scan grossier + raffinement du risque, objectif = pass prob avec pénalité de lenteur
2. **`verdictFor()`** — Strong / Playable / Borderline / Fragile, calibré sur les sorties Monte Carlo
3. **`buildDisplayStats()`** — bandes reflétant la qualité des inputs
4. Coût Topstep modélisé en **abonnement mensuel** (reset credits), pas en fee par tentative

### Plafond de sécurité

`maxConsecLosses × risk ≤ ~90% du budget de perte quotidien`

## Prochaines étapes

- [ ] Phase 2 : Reconstruire les composants UI complets
- [ ] Phase 3 : Auth Supabase + persistance
- [ ] Phase 4 : Stripe + paywall
