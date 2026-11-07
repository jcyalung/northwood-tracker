# User Guide

How to sign in and use each page of Northwood Tracker. Written for the
senseis and the center manager.

Open the app in a browser on any device on the center's network:
**http://northwood.local** (if that doesn't load, ask whoever looks after the
Pi for its IP address and use `http://<that address>` instead).

- [Signing in](#signing-in)
- [Menu](#menu)
- [Students Today](#students-today)
- [Schedule Students Today](#schedule-students-today)
- [All Students](#all-students)
- [Star Store](#star-store)
- [Dashboard](#dashboard)
- [Debrief Helper](#debrief-helper)
- [Quick answers](#quick-answers)

---

## Signing in

There are only two accounts. Their emails are set by whoever runs the server
(in the app's `.env` file):

| Account | Who uses it | What's different |
|---|---|---|
| **Center account** | All the senseis, shared | After signing in, you pick which sensei you are. Your edits are labeled with your name. |
| **Manager account** | The center manager | No sensei picker. Can add and remove senseis and export the whole database. Edits are labeled "Manager". |

### Signing in

1. Go to http://northwood.local. You'll land on **Sign in**.
2. Type the account email and click **Continue**.
3. Type the password and click **Sign in**.

A wrong email or password says "Wrong email or password." and pauses for a
second before you can try again (this slows down password guessing). Failed
attempts are recorded in Dashboard → Logs.

### The first sign-in (creating the password)

The first time an account signs in, there is no password yet. After you click
**Continue**, the page says *"First time signing in? Create a password"*:

1. Type a new password (at least **8 characters**) in **New password**.
2. Type it again in **Confirm password**.
3. Click **Create password and sign in**.

This only works once per account. After that, the account always asks for its
password. (If a password is forgotten, whoever runs the server has to remove
that account's saved password from the database so it can be created again.)

### Picking your name (center account)

After the center account signs in, the page asks **"Which sensei are you?"**.
Click your name. Everything you then change (notes, check-ins, debriefs,
belt ups) says it was done by you, and the Logs show your name.

- The choice lasts until the browser is closed or someone signs out.
- If your name isn't listed, the manager needs to add you on
  **Dashboard → Senseis**.

### Switching sensei and signing out

At the bottom of the **Menu**:

- **Signed in as \<name\>** shows who is picked.
- **Switch sensei** (center account only) goes back to the name picker without
  signing out. Use this when handing a device to another sensei.
- **Sign out** signs the account out of this browser and clears the picked
  sensei.

---

## Menu

The home page after signing in. Each tile opens a page:

| Tile | Page |
|---|---|
| **Students Today** (highlighted) | Today's checked-in students and their notes |
| **Schedule Students Today** | Check students in to today's hours |
| **All Students** | The full roster, history, editing, new students, CSV export |
| **Star Store** | Spend students' stars on prizes |
| **Dashboard** | Charts, curriculum, senseis, database, logs |
| **Debrief Helper** | Talking points for parent debriefs |
| **Outlook** | Opens Outlook web mail in a new tab |

Every page has **← Menu** at the top left to come back here.

---

## Students Today

The main page during sessions. It shows today's date (Pacific time), a tip
that **Ctrl/Cmd + Enter** saves ninja data, and one card per checked-in
student, grouped by hour.

Session hours are **2, 3, 4 and 5 PM on weekdays** and **1, 2, 3 and 4 PM on
weekends**.

### The top of the page

- **Add Student**: check a student in. Search by name, pick them, pick the
  hour they arrived (**Hour Checked In**), and click **Add**. A student can
  only be checked in once per day. Their card starts with the
  "What are they working on?" text copied from their last session's
  "What will they work on next time?".
- **Day summary**: how many students are **Checked in** and how many
  **Debriefs completed** (e.g. 3/12).
- **Save Day**: see [Save Day](#save-day) below.

### Hour sections

Each hour is a section with a count of who has been debriefed in that hour.
Click the hour's header to open or close it.

### A student's card

Click the top of a card (the name area) to open or minimize it. Cards for
students who are already debriefed start minimized. The header shows:

- The belt badge and the student's name (birthdays get confetti and a party
  hat).
- Their current activity.
- Their tags.
- The **Debriefed** switch (see below).

Junior (JR) students have a purple card, and their card doesn't have the
"What did they accomplish today?" box.

Inside an open card:

1. **Activity**: a dropdown of the activities on the student's current level.
   Choosing one saves immediately. The bottom of the list has:
   - **Level Up → \<Belt\> \<next level\>** on any level but a belt's last, or
   - **Belt Up → \<next belt\> Belt** on the last level (or for Juniors).
     Moving up to Bronze asks for the type (**Godot** or **Unity**).

   Level and belt ups ask *"Level up \<name\> to …?"* first. Click
   **Confirm** to do it or **Cancel** to back out. On confirm, the student
   gets the stars for that level or belt (shown in the message, e.g.
   "+10 ★"), starts the first activity of the new level, and a line like
   `LEVEL UP -> Yellow 3` is added to today's accomplishments.
2. **Three note boxes**:
   - *What are they working on?*
   - *What did they accomplish today?* (not on Junior cards)
   - *What will they work on next time?* (this becomes next session's
     "working on")
3. **Last edited by \<name\> at \<time\>**: who saved this card last.
4. **Parent email button**: click it to copy the email. The button changes to
   **Copied!** with a checkmark for 2 seconds and a message pops up. If the
   student has no email it says "No parent email".
5. **Save status and Save button**: the status reads **Saved**, **Unsaved**,
   **Saving…** or **Not saved**.

### How notes save

- **Automatically**, 3 seconds after you stop typing.
- **Right away** with the card's **Save** button, or by pressing
  **Ctrl + Enter** (**⌘ + Enter** on a Mac) while typing in any box on the
  card. Plain Enter adds a new line.

If notes haven't saved yet, a yellow **Unsaved notes** banner lists whose
cards still need saving, and the browser warns you ("Leave site?") if you try
to close or reload the page.

### Debriefed switch

Flip **Debriefed** on after talking to the student's parent. It saves right
away (if saving fails it flips back and shows a message). The card grays out
and the day summary and hour counts update.

### Live updates and editing at the same time

The page checks for other senseis' changes every 5 seconds while it's open
and on screen, so check-ins, notes, debriefs, activities and belt changes
from other devices appear on their own.

If someone else saves a note box **while you are typing in that same box**,
the box shows *"Updated by \<name\>: …"* with two choices:

- **Use theirs**: replace your text with theirs.
- **Keep mine**: keep your text (it will save over theirs).

Nobody's text is overwritten without a choice.

### Save Day

Click **Save Day** at the end of the day. It saves every card's unsaved notes,
then records today as each checked-in student's **last session** (what All
Students shows and sorts by). The message says how many were checked in and
debriefed, or which cards couldn't save.

The Pi also runs Save Day automatically at **7 PM** every day, so a forgotten
click isn't a problem.

---

## Schedule Students Today

For checking students in to hours before sessions start, or fixing who is in
which hour.

- Each hour is a section listing its students as small cards.
- **+ Add Student to \<hour\>**: search for a student and add them to that
  hour.
- The **×** on a student's card removes them from that hour (it asks to
  confirm). Removing a check-in also deletes any notes written for it today.
- To move a student to another hour, remove them from one and add them to
  the other.

Changes here are a **draft until you save**. The top button shows how many
changes are waiting, e.g. **Save Schedule (3)**, and a banner says
*"Unsaved changes: 2 added, 1 removed"*. Click **Save Schedule** to keep them;
the browser warns you if you leave first. If some changes can't be saved
(for example, someone else already checked that student in), those students
stay where they were and a message explains why.

---

## All Students

The whole roster.

### Finding students

- **Search**: first or last name.
- **Program**, **Belt Color**, **Type** (Godot/Unity), **Attendance**
  (*Attended before* / *Never attended*) filters.
- **Sort by**: *A–Z (last name)*, *Most recent session*, *Least recent
  session*.
- **Clear filters** resets everything.
- The list is paged; use the page buttons at the bottom.

### A student's details

Click a student to open their window. It shows their parent email, birthday,
debrief method, belt, program, tags, stars, notes, their **session history**
(newest first, with what they worked on, accomplished and will do next time),
and their **Star Store purchases**. Close it with the close button, Esc, or by clicking
outside it.

### Editing a student

Click **Edit** in the student's window. You can change the parent email, belt
color, level and type, program, tags, stars, and notes. Click **Save**.

- Changing the belt or level starts the student on that level's first
  activity.
- **Changing stars needs the stars password** (a separate password set by
  whoever runs the server). A field **Password to change stars** appears
  when you change the number. A wrong password is rejected.
- If a student has 0 stars and has never bought anything, the window offers
  to work out their stars from their belt and level (**Use**), or you can
  **Enter manually**.

### Adding a student

Click **New Student**, fill in first and last name, parent email, birthday,
program, belt (color, level, type), debrief method, tags and notes, and save.

### Export CSV

**Export CSV** downloads every student as a spreadsheet (last name, first
name, program, belt, level, type, current activity, last session, parent
email, birthday, debrief method, tags, stars, notes), sorted by last name.
In Chrome and Edge a **Save as** window lets you choose where to save it;
other browsers download it normally.

---

## Star Store

For spending stars on prizes.

1. **In session today** shows today's checked-in students with their star
   balances. To find anyone else, use **Other students** and search by name.
2. Click the student who is buying.
3. Pick the **Item to purchase**. Catalog items (Snacks, Wearables,
   Knick-knacks, …) have a fixed price. Choose **Other…** to type an item
   name and set the star cost yourself.
4. Click **Confirm**.

The balance updates right away and the purchase is recorded (it shows in the
student's window in All Students). A student can't spend more stars than they
have; the store says *"Not enough stars: they have N."*

---

## Dashboard

Tabs across the top: **Overview**, **Curriculum**, **Senseis**, **Database**,
**Logs**.

### Overview

Today's date and:

- **Total students**, **Checked in today**, **Avg sessions per week**,
  **Sessions, last 30 days**.
- Charts: **Students by program**, **Students by belt**, **Attendance this
  week** (Monday to Sunday) and **Sessions per week**.

Every chart has a **Table** button to see the numbers as a table (and
**Chart** to go back).

### Curriculum

The belt journey from White to Gold. Click a belt to see its levels; click a
level to see its activities (builds, quests, adventures, prove-yourselves,
mastery missions).

### Senseis

The list of senseis (names and emails). These are the names offered on the
"Which sensei are you?" screen.

- **Manager account only:** add a sensei (first name, last name, email, role:
  Sensei, Center Director, Assistant Center Director or Lead Sensei) with
  **Add sensei**, or remove one with **Remove** (it asks *Remove?* to
  confirm).

### Database

A read-only browser of everything stored in the database, styled like
MongoDB Compass.

- Pick a collection on the left (with its document count).
- Search, and use the filter dropdowns that appear for fields with a few
  values.
- Switch between **MongoDB** (one card per document) and **SQL** (a table)
  views.
- Long text is cut with **See more**.
- Password hashes and internal IDs are never shown.

**Export database (manager account only):** downloads the whole database as
one JSON file (every collection except `accounts`, which holds password
hashes). This file can be loaded back into the database; see
[Backups](backups.md#restoring).

### Logs

A live activity log, visible to both accounts. It updates every 3 seconds.

**Status tiles:** **App uptime**, **Pi uptime**, **Database**
(Connected/Unreachable), **Errors since start**, **Warnings since start**.
Tiles turn amber or red when something needs attention.

**Activity log**, newest first. Each entry has a time, a level, a type, the
message and who did it:

| Level | Color | Examples |
|---|---|---|
| Info | none | Sign-ins and sign-outs, sensei picked or switched, check-ins and removals, debriefs, Save Day, server started |
| Warning | amber | Failed sign-in attempts (with the reason and device address), failed saves (notes, activity, level/belt up, purchases, student edits), check-ins that couldn't be saved |
| Error | red | Server errors, database errors, lost database connection |

Filter by **All / Warnings & errors / Errors**, by **Type**, and click
**Live** to pause or resume updates.

The log only holds entries since the app last started (newest 1,000). The
full history is kept on the Pi; see [Raspberry Pi → Logs](raspberry-pi.md#logs).

---

## Debrief Helper

Talking points for debriefing a ninja's parent.

1. **Debrief checklist** at the top: the six steps of a good debrief.
2. **Belt timeline**: click a belt to see its focus summary and **Concepts by
   level** (each level's focus and what the ninja learns).
3. Click a level bubble (or a level's name in the list) to see that level's
   activities.
4. Click an activity to see what kind of activity it is (Build, Quest,
   Adventure, Prove Yourself, Mastery) and **What they practice**: the
   level's concepts to talk about.

The text comes from `northwood-tracker/content/debrief-help.md`. To change
it, edit that file and redeploy (see
[Raspberry Pi → Deploying changes](raspberry-pi.md#deploying-changes)).

---

## Quick answers

**I can't sign in.** Check the email is the center (or manager) email, not
your own. Passwords are case-sensitive.

**My name isn't on the sensei list.** Ask the manager to add you on
Dashboard → Senseis.

**A student is in the wrong hour.** Fix it on Schedule Students Today
(remove, add to the right hour, Save Schedule).

**I forgot to click Save Day.** It runs by itself at 7 PM.

**Notes say "Not saved".** Check the device is still on the center's
network, then click the card's **Save** again.

**The page looks out of date after an update.** Reload the page.
