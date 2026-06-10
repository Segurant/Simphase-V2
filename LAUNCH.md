# SimPhase — Kit de lancement (objectif : premières ventes)

## 1. Activer le paiement (5 minutes, une seule fois)

1. https://dashboard.stripe.com → **Payment Links** → *New*
2. Produit : `SimPhase — Full Challenge Plan` · Prix : **$19** · One-time
3. Dans *After payment* → **Redirect to your website** :
   `https://simphase.vercel.app/?unlocked=sp19`
4. Copie le lien du Payment Link → Vercel → ton projet → *Settings → Environment Variables* :
   `NEXT_PUBLIC_STRIPE_PAYMENT_LINK` = `https://buy.stripe.com/...` → **Redeploy**
5. Teste en navigation privée : lance une analyse → le paywall apparaît →
   paie avec la carte test `4242 4242 4242 4242` (mode test) → retour sur le site → tout est déverrouillé.

Tant que la variable n'est pas posée, le paywall est invisible et le site reste 100% gratuit.
Le déverrouillage est par navigateur (localStorage) — assumé pour une v1 sans comptes.

## 2. Ce qui est gratuit vs payant (logique de conversion)

| Gratuit (le hook) | $19 (le plan) |
|---|---|
| Verdict Strong/Playable/Borderline/Fragile | % de risque recommandé + bande robuste |
| Pass outlook (bande de %) | 3 variantes d'exécution (safe/reco/agressive) |
| Mode d'échec principal + % empirique | Plan d'exécution jour 1 (kill-switch) |
| Jours / coût / tentatives attendues | Alternatives même taille classées |
| Analyse de ton CSV (Execution Reality) | Rapport PDF |

Le moment d'achat : le trader voit son verdict et son mode d'échec — il sait QUE ça va mal
tourner mais pas COMMENT l'éviter. Le $19 est ancré contre le fee du challenge ($89–$1 080)
affiché juste au-dessus.

## 3. Lancement Reddit — 3 posts prêts à publier (1/semaine)

Règles : poste la valeur, jamais le lien dans le corps. Lien en commentaire
("I built a free tool for this") seulement si quelqu'un demande ou si les règles du sub le permettent.
Réponds à chaque commentaire pendant 48h. Subs : r/propfirms, r/Daytrading, r/Forex.

---

### POST 1 — r/propfirms
**Titre :** I ran 9,000 simulated attempts of the FTMO 2-Step with a realistic edge. Here's what actually kills attempts.

**Corps :**
I got tired of guessing whether my edge could survive a challenge, so I built a Monte Carlo
simulator that replays the exact FTMO rules (5% daily, 10% static max loss, both phases,
limits resetting between phases) trade by trade.

Profile tested: 47% win rate, 2.0 RR, ~2 trades/day, 120-trade sample. Realistic execution
(slippage on losses, discipline degrading after red days).

Results that surprised me:
- Pass probability at the *optimal* risk (~0.9%/trade): about 77%. At 1.5% risk it drops hard.
- The daily loss limit is NOT the main killer if you use a kill-switch (stop after 2-3 losses).
  What kills disciplined traders is the slow bleed into the 10% max loss — ~67% of simulated failures.
- Under pressure (slightly degraded win rate, tilt, worse fills), 77% becomes 54%.
  The edge doesn't change. The execution does.
- A 120-trade sample only pins your true win rate to roughly ±5 points. That uncertainty
  alone is the difference between "Strong" and "coin flip".

Happy to run other profiles if you drop your WR/RR/frequency in the comments.

---

### POST 2 — r/Daytrading
**Titre :** Your 120-trade backtest doesn't prove what you think it proves (I did the math)

**Corps :**
Quick stats reality check before you pay for another prop challenge.

If you measured a 47% win rate over 120 trades, your TRUE win rate is somewhere around
42–52% (standard error ≈ 4.6 points). That sounds like a detail. It isn't:

- True WR 52% with 2RR → you pass FTMO-style challenges most of the time.
- True WR 42% with 2RR → expectancy is barely positive and most attempts die on drawdown.

Same backtest. Both compatible with your data. When I run Monte Carlo simulations of
challenge attempts where each attempt draws a plausible "true" edge from that confidence
interval, sample size moves the pass probability MORE than switching firms does.

Practical takeaways:
1. Below ~80 trades, you don't have an edge estimate, you have a hint.
2. Risk small enough that the bad tail of your confidence interval survives.
3. Spend on more screen time before spending on more challenge fees.

---

### POST 3 — r/propfirms
**Titre :** Simulated the Topstep Combine: the intraday trailing drawdown causes ~70% of failures. Here's why it's nastier than EOD trailing.

**Corps :**
Modeled the current Topstep Trading Combine ($50K: $3k target, $2k trailing MLL that
follows your LIVE equity peak and freezes at breakeven, 50% consistency rule,
monthly subscription economics).

What the simulation shows:
- ~70% of failed attempts die on the trailing MLL — usually right AFTER a green run.
  The floor follows your intraday peak, so a normal pullback after a strong morning
  is what ends accounts. EOD trailing (FTMO 1-Step style) is materially more forgiving
  because intraday spikes don't move the floor.
- The consistency rule rarely fails you outright — it taxes you in TIME. Big-day traders
  get forced into extra trading days, which means extra rule exposure and possibly an
  extra month of subscription.
- Because it's a subscription, slow passes cost more than failed-but-fast attempts.
  Optimal play is smaller risk + more trading days per week, not bigger swings.

Run your own numbers before paying for a reset — the math is brutal but knowable.

---

## 4. KPI des 14 premiers jours
- 3 posts publiés, réponses à 100% des commentaires
- Objectif : 5 ventes ($95) = validation du pricing
- Si >300 visiteurs et 0 vente → le problème est le paywall (montre-moi les données, on ajuste)
- Si <100 visiteurs → le problème est la distribution (on double Reddit, on ajoute X/Twitter)
