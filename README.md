# Easy Budget Tracker

Month-by-month budgeting made easy. Plan your income, bills, spending and savings for each month, keep tabs on groceries and collectibles, get due-date reminders for bills, credit cards and loans, and save everything to your own Google Drive.

**Live app:** [ezbudgettracker.app](https://ezbudgettracker.app)
**Current version:** 9.39.1

## Features

- **Monthly budget**: income, bills, spending, savings, credit cards and loans, planned month by month. Leftover money can carry over to the next month.
- **Sorting**: every item section on the Budget page (once it has 2 or more items) can be sorted by date added, name or, for bills, cards and loans, due date, ascending or descending. The choice is saved on the device only and never changes your data or totals.
- **Mark as paid and due dates**: bills, credit cards and loans have a due date and a *Mark paid* button. An unpaid item is not deducted from your balance until you mark it paid. A banner reminds you when something is due soon, due today or overdue, and you can export due dates to your calendar (.ics).
- **Collectibles**: track money people owe you. The amount comes out of your remaining balance while it is uncollected and comes back when you tick it as collected. Money collected back is not counted as income.
- **Transactions**: a full history of what you added, changed and removed, with a monthly ledger.
- **Reports**: spending and income breakdowns, a 12-month trend, a yearly summary and highlights.
- **Grocery list**: a shopping list grouped by aisle with an optional shopping limit. Ticked items can be added to a Spending category, or choose *Don't link* to keep the list only (nothing is added to your budget).
- **Budget notebooks**: separate pages for trips and projects, with categories, items and a page budget.
- **Export**: download your budget as Excel or CSV. Totals match the app.
- **Google Drive sync (optional)**: back up and sync your budget to your own Google Drive.
- **Themes**: light and dark, with several accent colours.
- **Works offline**: an installable web app (PWA) that keeps working without a connection.

## Privacy

Your budget is stored in your own browser. Nothing is sent anywhere unless you choose to sign in with Google, in which case the data is saved to your Google Drive's private app folder. See the [Privacy Policy](privacy.html) and [Terms](terms.html).

## Project structure

```
index.html            App shell and page markup
styles.css            All styles and themes
sw.js                 Service worker (offline support and caching)
manifest.json         Web app manifest
js/                   App scripts, loaded in this order by index.html:
  storage.js            State, saving and loading, data checks
  calc.js               Budget maths (balances, paid items, collectibles)
  budget.js             Budget page
  google-sync.js        Google Drive sync
  import-export.js      Excel, CSV and file import
  routing.js            Page routing and data cleanup
  transactions.js       Transactions and history log
  reports.js            Reports and insights
  navigation.js         Navigation and settings
  collectibles.js       Collectibles page
  help.js               How-to page
  groceries.js          Grocery list
  notebook.js           Budget notebooks
  boot.js               Start-up
guides/               Budgeting guides (static pages)
icons/                App icons
```

The app is plain HTML, CSS and JavaScript with no build step. The scripts share global variables, so the load order in `index.html` matters.

## License

All rights reserved unless stated otherwise.
