# AxonBox Web User Manual

English UI. Desktop web. Demo login: `admin@axon.demo` / `demo1234`.

This guide matches the **live app**. The AXONCASE pitch explains *why*; the steps below are *what you click*.

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

---

## 3. Open the web app

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

### 3.3 Switch English / 繁中

1. In the left sidebar, under **Setup**, click **Settings**.
2. Find **Interface language**.
3. Click **English** or **繁體中文**.
4. The menu and buttons change immediately. Case *titles you typed* stay as they are.

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
| **Evidence** | Photo library |
| **Daily reports** | One day’s rollup |
| **Reports** | Word / PDF packs |
| **Ask engineering** | Q&A with sources |

### 4.3 Setup

| Menu | What it is for |
|---|---|
| **People & companies** | Users, forward address, subcontractors |
| **Settings** | Project, language, AI |
| **Install app** | PWA |
| **How to open** | Share URL |
| **Help** | This manual |

### 4.4 Typical path through the app

Capture or Inbox → **Cases** → Assign → mark after proof → Close → Daily reports / Overview.

```
Capture / Inbox / Checklist Fail
        → Cases (Open → Assign → After proof → Close)
        → Evidence + close-out pack
        → Overview + Daily reports + Reports
```

---

## 5. Overview

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

### 11.1 Bring photos in

1. Sidebar → **Evidence**.
2. Use **Import / upload**, or choose WhatsApp / email import and paste if you are not using Inbox.
3. EXIF (time, location, device) is read when the file has it.

![Fig 11.1 Evidence](/help-media/fig-11-1-evidence.png)

### 11.2 Filter and browse

1. Keyword, category, status → **Filter**.
2. Click a thumbnail.

### 11.3 Detail, AI, process log

1. Right-hand **Evidence detail** shows time, location, source.
2. **AI analysis** shows category, severity, recommendation (content is not translated).
3. **Activity log** is the Case process if linked.

![Fig 11.3 Evidence detail](/help-media/fig-11-3-detail.png)

---

## 12. Daily reports

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

### 16.1 Project

1. Sidebar → **Settings**.
2. Edit **Project name**, **Site code**, address, weather if shown.
3. Click **Save**.

![Fig 16.1 Settings](/help-media/fig-16-1-settings.png)

### 16.2 Language and AI status

1. **Interface language** — see 3.3.
2. **AI status** shows Connected or Not configured (Mock). Mock still lets you walk the screens.

---

## 17. A normal day

### 17.1 On site

Morning: **Site capture** and **Inbox**; run **Checklist** if you are inspecting.

### 17.2 Close-out

Assign Cases the same day. Before close: after photos → **Verify & close** → close-out pack.

### 17.3 End of day and week

End of day: **Daily reports** copy or PDF. End of week: **Overview** digest and **Reports** for the owner.

---

## 18. Troubleshooting

### 18.1 Photos and close gate

- Prefer **JPG/PNG**. HEIC may not preview.
- Close is blocked until **Mark as after proof**, unless you **Close without photos** with a reason.

### 18.2 Login and language

- Session expired: sign in again.
- Menu still Chinese: **Settings** → **English**, then refresh.
- Titles and AI text stay in the language they were saved.

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
