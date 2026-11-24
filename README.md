# Apartment Decision Maker

A student project for an apartment decision support system (ApartmentWise).

## What it does

The prototype guides users through the whole decision in three steps:

1. **Apartments**: add listings by hand, import a JSON file or load the 50-listing test dataset. Unknown values stay unknown (`null`) and are never guessed.
2. **Preferences**: hard limits (budget, move-in date, rental period, step-free access), furnishing preference, reference values and the AHP pairwise comparisons (5-option scale or the full 1–9 scale). The consistency ratio is checked; above 0.10 the ranking is withheld and the most contradictory comparison is suggested for review.
3. **Results**: ranking with scores, points per criterion, strengths and weaknesses; excluded apartments with every failed hard criterion; incomplete apartments with the missing fields.

The decision process has two stages: knockout filter (5 hard criteria) → AHP weights for 7 soft criteria → normalisation with fixed reference values → weighted sum (SAW) → ranking. Details: [`docs/decision-engine.md`](docs/decision-engine.md).

Further pages: **All Apartments** (search and status filter), **Favorites** (side-by-side comparison) and **Good to Know**.

## Run locally

Open `index.html` in a web browser, or serve the folder with VS Code Live Server. No dependencies or build step are required. Data is saved in the browser's local storage only.

To try the full flow quickly: *Load test dataset* in step 1, then *For testing: load a reference profile* in step 2.

## Tests

Open `tests/engine.test.html` in a browser. It checks the engine against the reference values of the Task 4 specification (weights, consistency ratio, the 30/2/4/14 partition, the worked example and the top five for both profiles) and the edge cases from Task 5.

## Design template

`design/template.html` shows the UI components for the Decision Maker workflow (apartments → preferences → results), filled with placeholder data. The component styles live in `components.css`, which the app loads after `style.css`. Field names, criteria and the result states follow `docs/data-model.md`. The template page is not linked from the app. Open it directly in a browser or through VS Code Live Server.

## Project structure

```
index.html            App shell (home page + workspace)
style.css             Brand palette and layout
components.css        Shared UI components (see design/template.html)
app.css               App-specific layout
js/engine/            Decision engine (no DOM access)
js/data/              Test dataset and test profiles (fixtures)
js/app/               Store, router and views
tests/                Browser test runner
docs/                 Data model and engine documentation
design/               Design template
```

## Collaboration and security

Use separate Git branches and pull requests. Do not commit credentials, personal information, or unapproved datasets. The included dataset is synthetic.
