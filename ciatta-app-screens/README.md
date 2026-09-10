# Ciatta app screens

The seven product screens from the landing page showcase, exported one per file.
They are captured in carousel order, which starts on Today.

| File | Screen | Tab |
|---|---|---|
| `01-today.png` | Personalized insight — the intelligence layer | Today |
| `02-symptoms.png` | Symptoms — timeline against cycle starts | My Health |
| `03-medications-supplements.png` | Medications & Supplements — current, timeline, changes | My Health |
| `04-what-you-told-ciatta.png` | What you told Ciatta — her own context | My Health |
| `05-health-records.png` | Health Records — Results, Documents, Add to Ciatta | My Health |
| `06-cycle.png` | Cycle — current, 29d to 26d, history | My Health |
| `07-sleep.png` | Sleep — duration, lowest weeks | My Health |

**1206 × 2622 px** each: iPhone 17 Pro (402 × 874 pt) at 3×, device bezel included.

## Regenerating

These are rendered from the live components, not drawn by hand, so they go stale
the moment a screen changes. To refresh:

```bash
cd ciatta-landing
npm run dev            # in one terminal
node scripts/capture-screens.mjs ../ciatta-app-screens
```

The script drives the Chrome already installed on the machine over the DevTools
Protocol. Nothing to install.

Each screen is moved to the centre slot before it is captured: the six screens
behind the centre carry a brightness filter, and centre is the only slot at full
size. The script emulates Reduce Motion so the carousel stops auto-advancing and
each step lands where it is asked to.
