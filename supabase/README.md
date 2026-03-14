# How to change your Supabase database (simple version)

---

## What’s the idea?

- Your database (tables, columns) is defined by **SQL files** in this repo.
- You run those files **once** and Supabase updates. Same files = same database everywhere.

---

## First time only: connect your computer to Supabase

1. Open a terminal in your project folder (same place as `package.json`).

2. Install the Supabase CLI **inside this project** (global install is not supported on Windows):
   ```bash
   npm install
   ```
   The project already lists `supabase` as a dev dependency, so this installs it.

3. Log in (a browser window will open):
   ```bash
   npx supabase login
   ```

4. Tell Supabase “this folder is for this project”:
   - In the browser, go to [supabase.com/dashboard](https://supabase.com/dashboard) and open your project.
   - In the address bar you’ll see something like:  
     `https://supabase.com/dashboard/project/abcdefghijklmnop`
   - The **project ref** is the last part: `abcdefghijklmnop`.
   - In the terminal run (use your real project ref):
     ```bash
     npx supabase link --project-ref abcdefghijklmnop
     ```
   - When it asks for the database password, use the one from your Supabase project (Project Settings → Database).

After this you don’t need to do it again unless you use a new computer or a new project.

---

## When you need to add or change something in the database

**Step 1 – Create a new “migration” file**

In the terminal (project folder):

```bash
npx supabase migration new what_you_are_doing
```

Example: `npx supabase migration new add_favorites_table`  
That creates a new empty file in `supabase/migrations/` with a timestamp in the name.

**Step 2 – Put your SQL in that file**

Open the new file in your editor and write the SQL that does what you want (e.g. add a column, create a table).  
If you’re not sure what to write, you can get help (e.g. from docs or an AI) and paste it in.

**Step 3 – Send it to Supabase**

In the terminal:

```bash
npx supabase db push
```

Supabase will run the new migration and update your database.

**Step 4 – Save the file in Git**

Commit and push the new migration file like any other code so everyone (and every environment) uses the same database shape.

---

## If someone gave you new migration files (e.g. from Git)

Just run:

```bash
npx supabase db push
```

That applies any migrations that haven’t been run yet.

---

## If you don’t want to use the terminal

You can still put SQL in files under `supabase/migrations/` and then:

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project.
2. Go to **SQL Editor**.
3. Copy the contents of the migration file and paste there.
4. Click **Run**.

Same result; the terminal just does that step for you.
