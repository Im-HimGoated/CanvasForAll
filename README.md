# Canvas For All

An r/place-style 100 × 100 shared pixel board built with React, Vite, and Appwrite.

## Appwrite setup

1. Create an Appwrite project and add a Web platform for your site origin.
2. Create a database and a collection (the default IDs used by this app are `canvas` and `main-board`).
3. Add string attributes: `cells` (large enough for 10000 hex colors), `updatedAt`; and an integer attribute: `pixels`.
4. Create a document with ID `main-board`, or let the app create it on first load. Give the collection document permissions of read: Any and update: Users.
5. Copy `.env.example` to `.env`, fill in the Appwrite IDs, then run `npm install && npm run dev`.

The app uses Appwrite Account for email/password auth, Databases for persistence, and the document Realtime channel for live updates in every open tab.
