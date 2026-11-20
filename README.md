# Easy Budget Tracker

Month-by-month budgeting made easy. Plan your income, bills, spending and savings for each month, keep tabs on groceries and collectibles, get due-date reminders for bills, credit cards and loans, and save everything to your own Google Drive.

**Live app:** [ezbudgettracker.app](https://ezbudgettracker.app)
**Current version:** 9.45

## Features

- **Monthly budget**: income, bills, spending, savings, credit cards and loans, planned month by month. Leftover money can carry over to the next month.
- **Spending limits**: one overall monthly limit shown above the 12-month overview, with a progress bar and warnings at 80% and 100%. Per-category limits are set on the Insights page, which shares the same overall limit.
- **Currency**: new users are asked to choose a currency the first time they open the app (the best guess from the browser language is pre-selected). It can be changed any time from the banknote icon beside Settings. It changes the symbol only and does not convert amounts.
- **Spending calendar**: the calendar icon in the Spending card opens a month view with each day's total. Tap a day to see its items. Each spending item has a date (today by default, editable for past days; a date in another month moves the item there). Items added before this feature have no date and show a "set date" button. Spending no longer repeats monthly; use Bills for that.
- **What's new**: after an update, existing users see a short pop-up once on their first open. It can be read again from Settings. New users do not see it. The last version seen is stored on the device only (a few bytes). To add notes for a release, edit `WN_NOTES` and `APP_VER` in `js/whatsnew.js`.
- **Design (v9.44)**: Inter fonts bundled in `fonts/` (no Google Fonts requests, works offline), floating cards, category cards outlined in their own color, springy buttons and a tab bar fixed to the bottom of the screen with a sliding highlight. All of it lives in the last block of `styles.css` ("v9.44 design layer"), so it can be removed to return to the older look.
- **Default theme**: new people start on the light black/white theme. Anyone who already has a saved theme keeps it. The default is `themeDefault()` in `js/storage.js` (also set in the small script in `index.html`, `manifest.json` and the `theme-color` meta tag).
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
  spendcal.js           Spending calendar
  whatsnew.js           "What's new" pop-up
  boot.js               Start-up
guides/               Budgeting guides (static pages)
icons/                App icons
fonts/                Inter fonts, plus Nunito ExtraBold for the remaining balance (SIL Open Font License, see fonts/LICENSE.txt and fonts/OFL-Nunito.txt)
```

The app is plain HTML, CSS and JavaScript with no build step. The scripts share global variables, so the load order in `index.html` matters.

## License

All rights reserved unless stated otherwise.
