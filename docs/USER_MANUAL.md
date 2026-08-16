# AxonBox Web User Manual

English UI. Desktop web. Demo login: `admin@axon.demo` / `demo1234`.

This is a **tutorial** for the live app. Read chapters 1–2 for the working picture, chapter 4 for how the screens fit together, then open each screen chapter when you need the clicks. Chapter 17 walks a normal day end to end.

---

## 1. Why AxonBox exists

Figures in this chapter are from the AXONCASE pitch. They explain the idea. From chapter 3 onward, screenshots are the **live web app**.

### 1.1 Too much information, too little time

Site teams already capture plenty: WhatsApp, photos, voice notes, Excel, paper forms. The problem is not “more recording.” It is that information is scattered, so follow-up and reporting take the evening.

![Too much information, too little time](/help-media/ppt-02-too-much-info.jpg)

### 1.2 Scattered site admin today

Typical day: issues live in a group chat, photos stay in the camera roll, verbal instructions leave no file, spreadsheets fork into versions, paper is hard to search, and someone rebuilds a daily report at night.

The pitch names six sources of chaos: WhatsApp floods, photos in albums, voice with no record, Excel versions, paper forms, and late-night report packing.

### 1.3 Time, missed instructions, weak evidence, delayed decisions

That pattern wastes hours, buries instructions, leaves photos that cannot be used as evidence, and delays decisions that cost money.

![Four costs of the old way](/help-media/ppt-03-four-costs.jpg)

### 1.4 From chaos to structured control

AxonBox is meant to turn a site photo or message into a **Case** with an owner, a due date, after-proof, and a close-out file — then roll the day up for the PM/owner.

![From WhatsApp chaos to structured project control](/help-media/ppt-04-from-chaos.jpg)

### 1.5 What this product is not

It is **not** a DWSS / RISC / ITP compliance system. It is a private-site supervision loop: record → assign → prove after → close.

---

## 2. What the app is for

### 2.1 Record the site so it can become a Case

The pitch: one site photo starts construction admin. In the app, use **Site capture** (photo) or **Inbox** (email / WhatsApp / paste). AI proposes category, severity, and location. You save evidence and/or create a Case.

![AI camera interface — one photo starts the admin chain](/help-media/ppt-01-ai-camera.jpg)

![A digital assistant, not more paperwork](/help-media/ppt-05-digital-assistant.jpg)

### 2.2 Assign, prove after, close with a pack

On **Cases**, the loop is **Open → Assign → After proof → Close**. You cannot close without an after photo (or a written waive). Then download a close-out pack PDF.

The pitch shows the same journey as seven steps: chat/photo/voice → AI extract → Case → assign → due date → verify close → keep evidence.

![Case journey: extract, assign, verify, keep evidence](/help-media/ppt-06-case-journey.jpg)

### 2.3 Dashboard, daily rollup, and reports for PM / owner

**Overview** is the dashboard. **Daily reports** is the day’s rollup (copy to WhatsApp, Word/PDF). **Reports** generates period packs.

![One day of site activity → one daily report](/help-media/ppt-07-daily-report.jpg)

![Every photo can become commercial evidence](/help-media/ppt-08-evidence.jpg)

### 2.4 Who uses which area

| Role | Typical screens |
|---|---|
| Site supervisor | Capture, Inbox, Cases, Checklist, Daily reports |
| PM / owner | Overview, Cases (overdue), Reports, digest |
| Admin | People & companies, Settings |

### 2.5 Pitch idea vs actual screen

| Pitch phrase | Click this |
|---|---|
| AI camera / issue log | Site capture |
| Chat / WhatsApp | Inbox |
| Assign + due + verify | Cases (loop) |
| Dashboard | Overview |
| Daily report | Daily reports |
| Commercial evidence | Evidence + close-out pack |
| Reporting | Reports |
| (not in the pitch) | Tasks, meeting minutes, Checklist, Ask engineering |

In practice: one photo or a forwarded chat becomes a **Case** — that Case is the file you chase. Overview, Daily reports, and Reports show the PM what happened without rebuilding an Excel pack from chat and albums. Chapter 4 spells out which door to use when.

---

## 3. Open the web app

AxonBox is a website, not a store app. Open it in the browser, bookmark it, or install it to the Home Screen if you work from a phone. Switch the interface to English first so the rest of this tutorial matches the buttons you see.

### 3.1 Open the URL

1. On a computer, open **Chrome** or **Edge**.
2. Go to **https://axonbox-production.up.railway.app**.
3. If you land on login, you are in the right place.

![Fig 3.1 Login](/help-media/fig-03-1-login.png)

*Click **Enter platform** after email and password (next section).*

### 3.2 Sign in

1. Email is filled with the demo account (`admin@axon.demo`). Change it if you have your own login.
2. Password: `demo1234` (demo) or your password.
3. Click **Enter platform**.
4. You should see **Overview**.

![Fig 3.2 Overview after sign-in](/help-media/fig-03-2-overview.png)

### 3.3 Switch English / 繁中 and appearance

1. In the left sidebar, under **Setup**, click **Settings**.
2. Find **Interface language**.
3. Click **English** or **繁體中文**.
4. The menu and buttons change immediately. Case *titles you typed* stay as they are.
5. Under **Appearance**, choose **Light** (white background), **Dark**, or **System**. You can also tap the moon / sun icon in the sidebar (or on the login screen).

![Fig 3.3 Settings language](/help-media/fig-16-2-language.png)

This manual uses **English** labels.

### 3.4 Desktop sidebar and phone tabs

**Desktop:** left sidebar — Daily work, Records & output, Setup.

**Phone:** five tabs at the bottom — Overview, Inbox, Capture, Cases, Tasks. Other items: tap the menu (top left).

![Fig 3.4 Sidebar](/help-media/fig-04-sidebar.png)

### 3.5 Add to Home Screen

1. Sidebar → **Setup** → **Install app**.
2. Follow on-screen steps for iPhone (Share → Add to Home Screen) or Android Chrome (Install).

![Fig 3.5 Install](/help-media/fig-03-5-install.png)

### 3.6 Sign out

1. Scroll to the bottom of the sidebar.
2. Click **Sign out**.
3. You return to the login page.

---

## 4. Screen map

Use this chapter as the map. Every later chapter is a room on this map. You do not need every screen every day — you need the right door for the situation.

### 4.1 Daily work

| Menu | What it is for |
|---|---|
| **Overview** | Dashboard and weekly digest |
| **Inbox** | Email / WhatsApp / paste → Case; minutes upload |
| **Site capture** | Photo → evidence or Case |
| **Cases** | Supervision loop |
| **Tasks** | Board and meeting actions |
| **Checklist** | Pass / Fail (Fail opens a Case) |

### 4.2 Records and output

| Menu | What it is for |
|---|---|
| **Evidence** | Photo library — create / link Case, replace, delete |
| **Daily reports** | One day’s rollup |
| **Reports** | Word / PDF packs |
| **Ask engineering** | Q&A with sources |

### 4.3 Setup

| Menu | What it is for |
|---|---|
| **People & companies** | Users, forward address, subcontractors |
| **Settings** | Project, language, appearance, AI |
| **Install app** | PWA |
| **How to open** | Share URL |
| **Help** | This manual |

### 4.4 Typical path through the app

Three doors put work into AxonBox. Pick the one that matches how the issue arrived:

- **Site capture** when you are at the work face and can take the photo yourself.
- **Inbox** when the issue already arrived as email or WhatsApp — forward or paste it; do not re-photograph a chat.
- **Checklist Fail** when an inspection finds a defect and you want a Case opened from that fail.

All three feed **Cases**. Cases are the spine of the day: an owner, a due date, an after photo when the work is done, then a close-out pack. That is how a scattered photo or message becomes a file you can chase and hand over.

**Tasks** are different. Use them for meeting actions and follow-ups from minutes — not as a second Case list. Approving an Inbox item can create both a Case (the site issue) and a Task (the follow-up reminder).

**Evidence**, **Daily reports**, and **Reports** sit after the loop. Evidence is the photo library behind the Cases. Daily reports and Reports roll the day or the period into something you can paste or send — so you are not hunting the camera roll and rebuilding Excel at night.

```
Capture / Inbox / Checklist Fail
        → Cases (Open → Assign → After proof → Close)
        → Evidence + close-out pack
        → Overview + Daily reports + Reports
```

When you are unsure which screen to open, come back here. Chapter 17 shows the same path as a normal working day.

---

## 5. Overview

Open **Overview** first thing, or whenever the PM asks “what is open / what is overdue?” It is the morning glance: open safety and overdue Cases first, then click through instead of asking the group chat.

### 5.1 KPI cards and alerts

1. Click **Overview** at the top of the sidebar (or the house tab on phone).
2. Read the top cards: **Open safety**, **Open quality**, **Overdue cases**, **Overdue meeting actions**.
3. Click a card to jump to the filtered list (for example **Overdue cases** opens Cases with overdue on).
4. If a red alert bar appears, click **View safety cases** or **Checklist**.

![Fig 5.1 Overview KPIs](/help-media/fig-05-1-overview.png)

### 5.2 Latest cases and charts

1. Stay on Overview.
2. **By category** is a donut of case types.
3. **Latest cases** — click a row to open that Case.
4. **Last 7 days** shows opened vs closed.

![Fig 5.2 Charts](/help-media/fig-05-2-charts.png)

### 5.3 Copy weekly digest

1. Top right of Overview, click **Copy weekly digest**.
2. Paste into email or WhatsApp for the owner.
3. You should see **Digest copied**.

---

## 6. Site capture

Use **Site capture** when you are looking at the work. Choose **Log status** for a progress record, or **Find issues** when you want the AI to look for a defect. Save to evidence if you only need the photo on file; create a Case if someone must fix it.

### 6.1 Photo, message, or voice

1. Sidebar → **Site capture**.
2. Choose **Photo**, **Message**, or **Voice**.
3. **Photo:** click the large area **Tap to capture or upload**, then take a picture or pick JPG/PNG from the album. HEIC may not preview — use JPG/PNG.

![Fig 6.1 Site capture](/help-media/fig-06-1-capture.png)

### 6.2 Log status vs find issues

1. With a photo selected, choose:
   - **Log status** — record progress, do not force a defect.
   - **Find issues** — look for safety / quality / progress risks.
2. Click **Start analysis** (or **Find issues** / **Log status** as shown on the buttons).
3. Wait until **AI analysing…** finishes.

### 6.3 Review AI result

1. Check category, severity, tags, summary, and findings.
2. Edit tags if needed (add tag, press Enter; remove a tag with the control on the chip).
3. Optionally pick **Assignee** and **Subcontractor**.

![Fig 6.3 AI result](/help-media/fig-06-3-result.png)

### 6.4 Save evidence or create a Case

1. **Save to evidence** (wording may be **Save evidence only**) — stores the photo without opening a Case.
2. Or click **Create Case** / confirm create — opens a trackable Case.
3. Sidebar → **Cases** to confirm the new row.

---

## 7. Inbox

**Inbox** is the same destination as Site capture, through a different door. Use it when the issue already arrived as email or WhatsApp. **Approve** means “this is a real Case”; **Dismiss** means noise you do not want to chase.

### 7.1 Forward address and WhatsApp inbox

1. Sidebar → **Inbox**.
2. Under **Your forward address**, click copy (or **Copy to email To**).
3. Put that address in the To field when you forward site mail.
4. If **Site WhatsApp inbox** shows a number, save it on the phone and forward chats there.

![Fig 7.1 Inbox](/help-media/fig-07-1-inbox.png)

### 7.2 Paste or fetch mail

1. **Quick import:** paste the email body or chat text. Optional sender and subject.
2. Click the import / ingest button on that panel.
3. Or click **Fetch new mail** if IMAP is configured.

### 7.3 Analyse and approve to Case

1. In **Inbox list**, click a row with status **Pending analysis** or **Pending approval**.
2. Click **Analyse** if it is not analysed yet.
3. Read location and suggested actions.
4. Click **Approve**. The app creates a **Case** and a follow-up **Task**.
5. Open the linked Case from the success message or from **Cases**.

![Fig 7.3 Approve](/help-media/fig-07-3-approve.png)

### 7.4 Dismiss, restore, delete

1. If it is not a real issue, click **Dismiss**.
2. Filter to dismissed items, select, **Restore** (back to pending approval) or **Delete** permanently (confirm).

### 7.5 Upload meeting minutes

1. On Inbox (or Tasks), use the **Meeting minutes** control.
2. Set output language: **Original**, **中文**, or **EN**.
3. Click **Upload file** and pick the document.
4. Wait for **Read → upload → AI analyse**.
5. You are taken to **Tasks** to confirm action items (Chapter 9).

---

## 8. Cases

**Cases** is the file you chase. Open it after Capture, Inbox, or Checklist Fail. The after-proof step exists so close-out is photo evidence, not a verbal “already fixed.” Assign the same day when you can — that is what keeps the Overview clean.

### 8.1 List, filters, overdue, loop

1. Sidebar → **Cases**.
2. Use keyword, category, status, severity, **Overdue only**, then **Filter**.
3. **Loop** column: four dots — Open, Assign, After proof, Close.
4. Click a **title** to open the Case.

![Fig 8.1 Cases list](/help-media/fig-08-1-list.png)

### 8.2 Edit a Case

1. On the Case page, click **Edit**.
2. Change title, category, severity, location, people, due date, description.
3. Click **Save** (or **Save changes**).
4. **Cancel** discards edits.

![Fig 8.2 Case detail](/help-media/fig-08-2-detail.png)

### 8.3 Assign people, due date, instructions

1. If the blue **Next** bar says **Go to assign**, click it — or scroll to **Step 2: Assign**.
2. Choose **Subcontractor** and **Assignee**.
3. Set the due date. Type instructions.
4. Click **Send / assign**.
5. The loop should move to **After proof**.

![Fig 8.3 Assign](/help-media/fig-08-3-assign.png)

You can also click **Mark in progress** or **Submit for review** under **Step 4**.

### 8.4 Mark after proof

1. Click **Go to files** on the Next bar, or the **Files** tab.
2. Find the after-remediation photo.
3. Click **Mark as after proof**.
4. The chip **After proof** appears. Loop moves to **Close**.

![Fig 8.4 After proof](/help-media/fig-08-4-files.png)

### 8.5 Close, waive, close-out pack

1. Click **Verify & close** on the Next bar, or **Verify & close** under Step 4.
2. If there is no after proof, a panel asks for a reason. Fill it and click **Close without photos**, or go mark a file.
3. After close, click **Download close-out pack**.
4. **Download all evidence** zips attachments.

![Fig 8.5 Close-out](/help-media/fig-08-5-close.png)

### 8.6 Delete a Case

1. On the Case page, click **Delete case**.
2. Confirm. Tasks and log are removed; files stay unlinked.

---

## 9. Tasks

**Tasks** are meeting follow-ups and action items — not a second Case list. Use the board for day-to-day chasing; upload minutes so actions do not die inside a PDF.

### 9.1 Board and list

1. Sidebar → **Tasks**.
2. Switch **Board** / **List** if both are shown.
3. Meeting lists are columns; site tasks may sit in other columns.

![Fig 9.1 Tasks](/help-media/fig-09-1-tasks.png)

### 9.2 Work a card

1. Click a card.
2. Edit description, checklist, tags, due date, assignee, status (**Pending** / **In progress** / **Done**).
3. **Archive** hides it; restore from archived if needed.

### 9.3 Minutes to action items

1. Click **Upload** next to meeting minutes (choose **Original** / **中文** / **EN** first).
2. Wait for the progress overlay.
3. In the preview, check each action. Create a person if the name is unmatched.
4. Click **Create list**.
5. Work the new column like any board.

![Fig 9.3 Minutes preview](/help-media/fig-09-3-minutes.png)

---

## 10. Checklist

Run a **Checklist** when you are inspecting against a template. **Pass** logs a clean run. **Fail** is the shortcut into the same Case loop as Capture and Inbox — then continue in Chapter 8.

### 10.1 Run a template

1. Sidebar → **Checklist**.
2. Click a template on the left.
3. Tick items. Add **Notes (optional)** if needed.

![Fig 10.1 Checklist](/help-media/fig-10-1-checklist.png)

### 10.2 Pass

1. Click **Pass**.
2. The run is logged under **Recent runs**.

### 10.3 Fail opens a Case

1. Click **Fail**.
2. A Case is created from the failed inspection.
3. Open **Cases** and continue Chapter 8 (assign → after proof → close).

---

## 11. Evidence

**Evidence** is the photo gallery behind Cases — browse and filter like a photo library, then **act** on a photo: create or open a Case, link more shots to the same issue, replace a wrong file, download, or delete. Capture and Inbox already put files here when you save them; use Evidence when you need to find a photo later or turn an unlinked photo into work.

### 11.1 Bring photos in

1. Sidebar → **Evidence**.
2. Open **Import / upload** at the top if you need to add files or paste WhatsApp / email text.
3. Use **Import / upload**, or choose WhatsApp / email import and paste if you are not using Inbox.
4. EXIF (time, location, device) is read when the file has it.

![Fig 11.1 Evidence](/help-media/fig-11-1-evidence.png)

### 11.2 Filter, sort, and browse

1. Use the toolbar: keyword, category, evidence status, **source**, **Case link** (all / linked / unlinked), and **sort** (captured or added, newest or oldest).
2. Click **Filter**.
3. Browse the dense photo grid. Badges on each thumb show evidence status and, if linked, the Case number and Case status.

### 11.3 Open a photo and use the action bar

1. Click a thumbnail to open the fullscreen viewer.
2. Zoom with the buttons, mouse wheel, or double-click; drag when zoomed. Use arrow keys or on-screen arrows for prev / next. Esc closes.
3. Use the **action bar** under the title (always visible):

| Action | When to use it |
|---|---|
| **Create Case** | Photo is not linked and someone must fix the issue — opens a Case and takes you there (same idea as Capture). |
| **Open Case** | Photo is already linked — jump to assign, after-proof, and close. |
| **Link to Case** | Attach this shot to an existing Case (one Case can hold many photos). Search by case number or title. |
| **Unlink** | Remove the Case connection without deleting the photo. |
| **Replace photo** | Swap the file (wrong shot, clearer after photo) while keeping the same evidence record and Case link. |
| **Download** | Save the file to your device. |
| **Delete** | Remove the evidence permanently (confirm first). |

4. The side panel still shows metadata, AI notes, and Case status. From a Case’s **Files** tab you can also use **Open in Evidence**.

![Fig 11.3 Evidence detail](/help-media/fig-11-3-detail.png)

---

## 12. Daily reports

**Daily reports** is the end-of-day rollup. The opened / closed / overdue numbers come from the Cases you already worked — you fill weather, manpower, and notes, then copy or export instead of writing the diary from scratch.

### 12.1 Day numbers and notes

1. Sidebar → **Daily reports**.
2. Pick the date.
3. Read **Opened today**, **Closed today**, **Overdue now**, **Open safety**.
4. Fill **Weather**, **Manpower**, **Notes**. Click save if a save button is shown.

![Fig 12.1 Daily reports](/help-media/fig-12-1-diary.png)

### 12.2 Photos and issues

1. Scroll to today’s photos and **Issues & follow-up**.
2. **Tomorrow’s plan** lists planned items when the draft has them.

### 12.3 Copy and export

1. Click the WhatsApp / copy control to copy the diary text.
2. Click one-click **Word + PDF** (or **Generate**) to export.

---

## 13. Reports

**Reports** builds a period pack (day, week, month, safety, quality, and so on) from the same Case and evidence trail. Generate when the owner or client needs a document — you are not retyping the week into Word.

### 13.1 Choose type and date

1. Sidebar → **Reports**.
2. Set **Base date**.
3. Pick a card: Daily, Weekly, Monthly, Acceptance, Safety pack, Quality pack.

![Fig 13.1 Reports](/help-media/fig-13-1-reports.png)

### 13.2 Download Word or PDF

1. Click **Generate**.
2. Wait until **Generating…** finishes.
3. Open the Word or PDF link under **Recently generated**.

---

## 14. Ask engineering

**Ask engineering** is side help for site practice questions (for example HyD / XPMS style answers with sources). It is not part of the Case loop — use Capture, Inbox, and Cases for issues you must chase.

### 14.1 Knowledge page

1. Sidebar → **Ask engineering**.
2. Type a question or click a suggestion chip.
3. Read **Answer**. Open **Sources** links if shown.

![Fig 14.1 Knowledge](/help-media/fig-14-1-knowledge.png)

### 14.2 Ask dock

1. Bottom-right, click **Ask**.
2. Type a question, send.
3. **Collapse** or **Close** when done.

---

## 15. People and companies

Set up **People & companies** before you rely on assign or Inbox forwarding. Names and subcontractors must exist so Case assign has someone to choose; the forward address is the Inbox mailbox from Chapter 7.

### 15.1 People and forward address

1. Sidebar → **People & companies**.
2. **Add person** (or **Edit** on a row).
3. Fill name, email, role. Save.
4. Copy **Forward address** — this is the Inbox address in Chapter 7.

![Fig 15.1 Directory](/help-media/fig-15-1-directory.png)

### 15.2 Subcontractors

1. Switch to companies (or **Add company**).
2. Fill name, trade, contact. Optionally link a login.
3. Save. These names appear on Case assign.

### 15.3 Roles

Owner → Admin → Supervisor → Viewer / Subcontractor. Managing people needs Admin or above.

---

## 16. Settings

**Settings** holds project identity, interface language, and appearance. Set the project name and site code so reports and packs read correctly; use language and theme so the UI matches how you work.

### 16.1 Project

1. Sidebar → **Settings**.
2. Edit **Project name**, **Site code**, address, weather if shown.
3. Click **Save**.

![Fig 16.1 Settings](/help-media/fig-16-1-settings.png)

### 16.2 Language, appearance, and AI status

1. **Interface language** — see 3.3.
2. **Appearance** — **Light** (white), **Dark**, or **System**. The sidebar moon / sun icon toggles light and dark quickly.
3. **AI status** shows Connected or Not configured (Mock). Mock still lets you walk the screens.

---

## 17. A normal day

This chapter is the tutorial put in order. Use the screen chapters above when you need the exact clicks.

### 17.1 Morning glance

Start on **Overview**. Read open safety and overdue Cases. Click a card if something needs attention today. That replaces asking the WhatsApp group “what is still open?”

### 17.2 Bring work in

Through the morning, use the door that matches the situation:

- At the work face → **Site capture** (log status or find issues).
- Issue already in email or chat → **Inbox** (forward, paste, or fetch; approve real ones, dismiss noise).
- Formal inspection → **Checklist**; Fail opens a Case for you.

You are not collecting a second pile of photos. You are feeding **Cases**.

### 17.3 Chase and close the same day

On **Cases**, assign an owner and due date while the issue is still fresh. When remediation is done, upload or find the after photo, **Mark as after proof**, then **Verify & close**. Download the close-out pack when someone needs a handover file.

If a photo landed in **Evidence** without a Case, open it and use **Create Case** (or **Link to Case** if the issue already exists). Use **Replace photo** when the after shot should overwrite a wrong file on the same record.

If a meeting produced actions, put those on **Tasks** (upload minutes if you have a PDF). Keep meeting actions on the board; keep site defects on Cases.

### 17.4 End of day and week

At the end of the day, open **Daily reports**. The counts and issues are already there from the Cases you closed and left open — fill weather and notes, then copy to WhatsApp or export Word/PDF instead of writing the diary from memory.

At the end of the week, **Copy weekly digest** on Overview for a quick owner update, or generate a period pack under **Reports**. The pack is the trail of Cases and evidence you already kept — not a weekend rebuild from chat and albums.

That is the full loop: capture once → chase in Cases → prove after → roll up. Chapter 4 is the map if you get lost; Chapters 5–16 are the rooms.

---

## 18. Troubleshooting

### 18.1 Photos and close gate

- Prefer **JPG/PNG**. HEIC may not preview.
- Close is blocked until **Mark as after proof**, unless you **Close without photos** with a reason.

### 18.2 Login, language, and appearance

- Session expired: sign in again.
- Menu still Chinese: **Settings** → **English**, then refresh.
- Titles and AI text stay in the language they were saved.
- Screen too bright / too dark: **Settings** → **Appearance**, or the moon / sun icon in the sidebar.

---

## 19. Appendix

### 19.1 Glossary

| Term | Meaning |
|---|---|
| Case | A tracked site issue |
| Task | A follow-up or meeting action |
| Evidence | Photo or file with time/context |
| After proof | Photo tagged after remediation |
| Close-out pack | PDF of the Case for handover |
| Digest | Weekly text for the owner |
| Inbox | Incoming mail/chat to approve |

### 19.2 Status and category labels

**Case status:** Open, Assigned, In progress, Pending review, Closed.  
**Category:** Safety, Quality, Progress, Environment, Other.  
**Severity:** High, Medium, Low.

### 19.3 Pitch phrase to app screen

See [2.5 Pitch idea vs actual screen](/help/2-what-the-app-is-for#2-5-pitch-idea-vs-actual-screen).

### 19.4 Screenshot index

Figures are stored as `/help-media/fig-….png` and listed next to each step above.
