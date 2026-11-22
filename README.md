# Apartment Decision Maker

A student project for an apartment decision support system.

## Current stage

This is a visual navigation prototype in **English** using the Evergreen & Sage color palette. The homepage has a horizontal menu; subpages have a left sidebar in this order:

1. Decision Maker
2. All Apartments
3. Favorites
4. Good to Know

Subpages intentionally have no working apartment data, filters, ranking logic, or informational articles yet.

## Design template

`design/template.html` shows the UI components for the Decision Maker workflow (apartments → preferences → results), filled with placeholder data. The component styles live in `components.css`, which the app will load after `style.css`. Field names, criteria and the four result states follow `docs/data-model.md`. The template page is not linked from the app. Open it directly in a browser or through VS Code Live Server.

## Run locally

Open `index.html` in a web browser, or serve the folder with VS Code Live Server. No dependencies or build step are required.

## Collaboration and security

Use separate Git branches and pull requests. Do not commit credentials, personal information, or unapproved datasets.
