# BTAA-GIN Website Editor user guide

Use the custom CMS (content management system) to create and update website pages. You can write, format text, add images, and save your work in the editor. When the page is ready, submit it for publication.

## Workflow at a glance

1. **Open a page and edit.** Use Text blocks for most writing. Your changes stay in the editor until you save them.
2. **Preview your work.** Toggle the editor **Preview** to see the current content, including unsaved changes.
3. **Save Draft.** This keeps your changes without changing the website. It may take some time for the draft to save, as the changes are synced to GitHub.
4. **Publish.** Click **Publish**, then confirm. Once **Publishing…** appears, the saved version will go online automatically, but it will take several minutes.

To take a page off the website, use **Unpublish** and confirm.


## Sign in and find a page

You need a GitHub account with permission to edit the website.

1. Open the editor link.
2. Click **Sign in with GitHub**.
3. Sign in to your GitHub account. If GitHub asks you to authorize the editor, follow the prompts.
4. On the editor dashboard, choose a content area, such as **Projects**, **Blog Posts**, or **Program Updates**.
5. Click an existing file name to open it, or click the **New** button to create one.

The list of pages may show **New draft**, **Unpublished changes**, or **Needs review**. 


## Create or edit a page

### Page details

This is the frontmatter or metadata for the page. The available fields depend on the content area or type of page.

| Field | What to enter |
| --- | --- |
| Title | The page's main title. |
| Filename | For new pages where this field appears, you can leave it blank to use a name based on the title. It helps determine the page's web address. |
| Description | A short summary of the page. |
| Publication date or Date | The date associated with the content. This does not schedule automatic publication. |
| Excerpt | A short introduction or summary for an article. |
| Authors | Click **Add author** and enter each author's name. |
| Tags | Short topic labels, separated by commas. |
| Cover image | An optional article image, with required alt text and an optional caption. |
| Year | The year associated with the item, where offered. |
| Working group fields | Committee, lead, active dates, and members, where offered. |

Note: After a page is created, changing its title does not change its filename or web address. 

### Page settings

 This controls the page navigation and visibility. is You can usually leave **Page settings** as they are by default.

| Setting | What it controls |
| --- | --- |
| Page layout | **Document** is the normal page layout. **Splash** is for landing pages with a different layout. |
| Page heading | Shows or hides the main title on the page. |
| Table of contents | Shows or hides the list of section headings. You can also choose which heading levels appear. |
| Site search | Includes the page in the website's search or leaves it out. |
| Navigation label | The name used for the page in website navigation. |
| Navigation order | The page's order in navigation where that order is used. Lower numbers appear first. |
| Navigation visibility | Shows or hides the navigation entry. Hiding an entry does not make the page private or remove it from the website. |
| Announcement banner | Adds a message to the page, where offered. Ask a maintainer for help with HTML formatting. |
| Social sharing images | Sets image web addresses used when sharing the page, where offered. |

## Page setup

Some pages have Page setup panel(s). These show what code needs to be imported for customized layouts. These are for reference only and are not changeable in the Editor.

## Blocks

A block is a section of page content.

### Block types

Choose **Add block** to insert one of these blocks. Each has fields or controls for its content.

| Block | What it does | When to use it |
| --- | --- | --- |
| Text | Holds formatted writing, headings, links, images, lists, and tables. | Use this for most content. |
| Link Card | A clickable box with a title, an optional description, and a destination address. | Highlight a related page or resource. |
| Link Button | A link displayed as a button. Enter the button text and address, then choose Primary, Secondary, or Minimal appearance. | Highlight an action, such as opening a registration page. |
| Badge | A short label with a choice of color style and size. | Mark a brief status, such as “New.” |
| Callout | A separate message box. Choose Note, Tip, Caution, or Danger, with an optional title. | Draw attention to a short note or instruction. |
| Card | A box containing a title and a plain text message. | Separate a short piece of information from surrounding text. |
| Chip List | A group of short text labels. Add, remove, or reorder the labels. | Display a small set of terms or categories. |
| Card Grid | A group of cards, each with a title and editable content. Add, remove, or reorder cards. | Present several related items together. |
| Metrics | A group of labels and values that you enter yourself. | Display figures such as “New records” and “1,250.” These values do not update automatically. |

### Text blocks

Text blocks are the main writing tool. Use them for ordinary page content, including links, images, and tables. Use the other block types only when their specific layout helps the reader.

Click inside a Text block to write. Select text, then use the toolbar to format it. Hover over an icon to see its name.

- **Paragraph and headings:** Use the text style menu. Normally, use **Heading 2** for main sections and **Heading 3** for sections within them. The Title field supplies the page's main heading.
- **Text formatting:** Apply bold, italic, underline, or strikethrough to selected text.
- **Links:** Select the words to link, click **Link**, enter the address, and confirm. Use the full address for another website, such as `https://example.org/`. A link within this website can use a path such as `/projects/`.
- **Lists:** Use **Bullets** for an unordered list or **Numbered** for steps.
- **Images:** Click **Image** to select or upload an image. See the image instructions below.
- **Tables:** Click **Table** to insert a table. Click inside it to show tools for adding or deleting rows and columns, or deleting the table.
- **Other tools:** Quote, Divider, Line break, Code, and Code block are available when needed.
- **Undo and Redo:** Use these to reverse or repeat recent edits within the Text block.


### Add, move, or remove blocks

- Click **Add block** beside a block to insert another block after it. This adds a whole block; it does not insert one at the typing cursor inside your text.
- Use **Move up** or **Move down** to change a block's position. Blocks cannot move across protected content.
- Use **Remove Text block**, or the matching Remove button for another block, to remove the whole block. Removing a Text block also removes the images and tables inside it.
- **Undo removal** restores the most recently removed block. Use it before adding, moving, or removing another block, since those actions clear or replace this undo option.
- Click **Save Draft** to save block changes.

Text blocks next to each other may appear as one Text block when you reopen the page. Their content stays in the same order. Empty Text blocks are not saved as separate sections. **Remove Text block** refers to the whole Text block above that control; it does not indicate an extra empty block.

### Protected blocks on existing pages

Some existing pages contain older legacy layouts, embedded items, or code that the Editor is not configured to edit. These appear as separate protected, read-only blocks labelled with their component or syntax type.

You can delete these blocks.


## Images

### Add images

For a new page, you need to click Save Draft once **before** uploading an image.

1. Place the cursor in a Text block where the image should go.
2. Click **Image** in that block's toolbar.
3. Choose an existing image from the library, or use **Upload a new image**. Use PNG, JPEG, GIF, or WebP, up to 5 MB per image. You can filter the library by filename.
4. Enter **Alt text**: a short description of what the image shows. This helps people who use screen readers. Select **This image is decorative** only if the image adds no information.
5. Add a caption if needed.
6. Click **Insert image**.
7. Click **Save Draft** to save the page and its attached new image together.

Uploading alone does not save the image to GitHub. Until you save the draft, new uploads stay in the browser. Keep the tab open if you see a backup or storage error.

### Styling images

Select an image in the editor to access its controls. Use **Edit image** to change its source, alt text, or caption, then click **Apply Changes**. You can also choose **Left**, **Center**, or **Right**, and choose **Small**, **Medium**, or **Large**. **Reset formatting** returns it to the normal image format. Save the draft afterward.


## Preview your work

Preview does not save, submit, or publish anything. It is a check of the content and an approximation of the page's appearance. Protected blocks appear as placeholders.


## Save a draft and return later

Choose **Save Draft** whenever you want to keep your progress without publishing it.

1. Click **Save Draft**.
2. Wait for **Saving…** to finish. The status normally becomes **Draft saved**, and Save Draft becomes unavailable until you make another change. During publication, the status may remain **Publishing…** while explaining that newer saved changes are not included. The saved time is shown as secondary information in your local timezone.
3. You can now return to the content list or sign out.
4. To continue later, sign in, choose the same content area, and open the same entry.

Saved drafts can be reopened from another browser or computer. Other authorized editors can also open and continue them. Saving changes to an existing page leaves its public version in place until the changes are published.

There is no Draft/Published switch to set. Use Save Draft to keep work and Publish to authorize publication.

### Understand the status

The compact status area below the title describes your current work and any publication in progress. Brief text explains when the editor and website have different versions.

| Status | What it means |
| --- | --- |
| Unsaved changes | You have edits that still need Save Draft. An earlier version may already be online. |
| Draft saved | Your changes are kept, but they have not been confirmed as published. An earlier version may still be online. |
| Publishing… | The submitted saved version is being published automatically. Newer edits are separate. You can leave the editor. |
| Published | The latest saved version has been verified online. |
| Unpublishing… | Removal is in progress. You can leave the editor. |
| Unpublished | The page has been verified as removed from the website. |
| Needs attention | The saved draft is safe, but an action needs review or maintainer help. Read the short explanation. |

The editor and content list use the same publication terms. A temporary verification problem does not mean publication failed. The editor keeps checking automatically; **Checking publication status…** may appear while it obtains a result.

### Browser backups and downloaded backups

The editor tries to keep a recovery copy of unsaved edits in your browser. This helps you return to unfinished work, but it does not replace **Save Draft**. Use Save Draft to keep work that you or another authorized editor can reopen from another browser or computer.

**Unsaved changes kept in this browser only** means a local recovery copy is available. It has not been confirmed saved as a draft. Browser copies belong to the account, editor address, and browser where you were working. Clearing browser data can remove them.

#### Recover earlier work

Look for an **Unsaved edits** label beside a page in the content list. Open that page in the same browser and account where you were working. If an earlier browser copy is available, an **Unsaved changes available** notice appears above the editing controls.

That notice has two buttons:

- **Restore changes** loads the earlier copy into the editor when it can be restored safely. Review the restored content, then choose **Save Draft**. Restoring alone does not save or publish it.
- **Discard** asks you to confirm deletion of that browser copy. It does not change a saved draft or the website. Discarded browser copies cannot be recovered unless you kept a separate backup.

You may instead see a **Find unsaved work** dialog if versions differ, the saved page changed, or you already have unsaved edits open. That dialog offers **Resume editing**, **Save backup file**, and **Discard unsaved changes** for stored copies. **View earlier versions** and **Resume this version** appear when several versions are available. These stored-version controls appear only in that dialog. The separate **Recovery options** panel described below works with backup files.

If restoring is unavailable, save a backup of the stored version and ask a maintainer to help compare it with the latest page. Copies are not combined automatically. The latest timestamp does not mean that version includes every earlier edit.

#### Recovery options

On an open page, expand **Recovery options** at the upper right, just below the application header. This small panel is for problems with saving or publishing; you do not need to download backups during ordinary editing. It also links to this guide's [troubleshooting section](#troubleshooting-and-common-errors).

- **Save backup file** downloads the content currently in the editor, including unsaved edits, as a `.json` file. It does not save a draft, publish, or change the page. It works even if the browser cannot store its automatic recovery copy.
- **Restore backup file** lets you choose a previously downloaded editor backup. The file is read locally, then checked against the open page before anything is restored.

A download from **Find unsaved work** contains the particular stored version shown in that dialog, which may differ from your current edits. **Download unsaved edits**, offered during a sign-in or storage problem, downloads your current work. Keep the original `.json` file; do not paste its contents into a Text block.

#### Recover from a downloaded file

1. Sign in and open the page the backup came from. For a backup of a page that was never saved, start a blank new page in the same content area.
2. Expand **Recovery options** below the header.
3. Choose **Restore backup file** and select the editor's `.json` backup.
4. Check the title, page, and backup date in the confirmation. Choose **Cancel** to leave the editor unchanged, or **Restore backup** to load that version.
5. Review the restored work in **Edit** or **Preview**, then choose **Save Draft**. Restoring does not save or publish anything automatically.

Restoration is unavailable while you have current unsaved edits or need to check your sign-in. Save your current edits first. If saving is not working, download a separate backup of those edits before reopening the page to restore another version.

If the saved page changed since the backup was made, the editor leaves the open page unchanged and refuses automatic restoration. Keep the file and ask a maintainer to help compare the versions. A file from a different page, a malformed file, or an unsupported backup version is also rejected without replacing your work. The editor does not combine different versions automatically.

If you try to leave with unsaved changes, choose **Keep editing** to return and save. **Leave editor** leaves without saving a draft; later recovery depends on a browser copy or downloaded backup being available.

## Publish a page

1. Review the page in **Preview**.
2. Click **Save Draft** if there are unsaved changes and wait for saving to finish.
3. Click **Publish**. The short confirmation asks **Publish this page?** or **Publish these changes?**
4. Choose **Cancel** to keep working, or **Publish** to authorize publication of the saved version.
5. Once **Publishing…** appears, you can return to the content list or close the editor. Publication continues automatically, usually taking about 5 minutes.

Ordinary confirmations omit filenames, timestamps, and version codes. If recovery selects an earlier saved version, the confirmation identifies it and explains that newer saved changes are not included.

The editor confirms completion only after the submitted version is verified on the website. When there are no newer edits, the status becomes **Published**. Use **View published page** to review the result.

### Continue editing during publication

You can keep editing after publication has been authorized. You can also save newer edits without changing the version already submitted. The status explains whether newer unsaved or saved changes are excluded from that publication.

Only one publication request can be active for a page. Wait for the earlier request to finish before publishing the next saved version. Completion of an earlier request does not mark newer changes as published.

If an earlier publication finishes at the same moment you save, the editor may reject that save to protect both versions. Your unsaved edits remain in the editor. Try **Save Draft** again. If the error persists or another editor changed the page, keep your work and ask a maintainer for help.

### Automatic progress and Technical details

You do not need to check progress manually. The editor refreshes unresolved requests automatically while the tab is visible. It checks less often during a long wait or temporary connection problem. Checks pause when the tab is hidden and resume when you return. Reopening the page restores the request's status.

**Technical details** is a secondary troubleshooting area. It contains diagnostic information, a GitHub request link when available, cancellation, and relevant recovery controls. Most editors will not need it.

**Refresh status** makes an immediate manual check. It shows **Refreshing…** while working, then **Status check complete. The latest result is shown above.** A successful check shows that message even if nothing changed. If verification fails, it says so and automatic checks continue. Refreshing does not save, submit, or restart publication.

### Cancel a pending action

Open **Technical details** and choose **Cancel publishing** or **Cancel unpublishing**, when available. Your saved work stays available. Cancellation stops an action that is still waiting; it cannot undo an update already accepted for the website. If cancellation cannot be confirmed, the action may still complete.

### If an action needs attention

Read the explanation beside **Needs attention**. Your saved draft is safe. Ask a maintainer for help with failed checks, changed website content, or repeated errors.

For an incomplete or outdated publish request, **Publish** may offer a confirmation for the previously selected version. For unpublishing, **Resume unpublishing** may appear under **Technical details**. Review any earlier-version warning before confirming. These actions do not silently substitute newer edits.

If publishing is unavailable, keep your draft saved and contact the maintainer. You do not need to manage GitHub requests or website deployments yourself.

## Unpublish a page

1. Save any unsaved changes. An unchanged page does not need another save.
2. Click **Unpublish** at the top and read the short confirmation.
3. Choose **Cancel** to leave the page online, or **Unpublish** to authorize removal.
4. Once **Unpublishing…** appears, you can leave the editor. Removal completes automatically after the required checks and website update.

**Unpublished** confirms removal from the website. A temporary verification problem does not mean the page is offline; the editor continues checking automatically.

Unpublishing acts on the version currently on the website. It keeps the page, its images, and any separate saved editorial work in the editor. Site search and Navigation visibility settings are also kept. To put the page online again, open it, save any changes, and use **Publish**.

If navigation settings prevent removal or Unpublish is unavailable, ask a maintainer for help. Cancellation and any relevant recovery controls are under **Technical details**.

## Work with Program Updates

For a new Program Update, choose **Start with monthly outline** to begin with suggested headings, or **Start blank** to write your own. You can change, remove, or reorder the headings. Use Text blocks and include only the sections you need.

Some older updates use a layout that is partly read-only. To make supported content editable:

1. Save any current text changes.
2. Click **Preview editable version**.
3. Review the proposed single-column version. Some complex items may remain protected.
4. Choose **Cancel preview** to keep the original, or **Use editable version** to put the proposed content in the editor.
5. Make any further edits, then click **Save Draft** to save the conversion.

**Use editable version** changes the open editor; Save Draft saves it. Publication still follows the normal submission process. If the conversion asks for manual review, keep the original layout and ask a maintainer for help.

## Troubleshooting and common errors

### The editor will not let me sign in

Check that you are using the editor link supplied by the maintainer and the correct GitHub account. A GitHub account alone is not enough; it needs permission to edit this website. If you see an access or sign-in configuration error, contact the maintainer with the exact message.

### My sign-in expired while I was writing

Keep the original editing tab open. Click **Sign in again with GitHub**, which opens a separate tab. Sign in with the same account, return to your original tab, and click **Check sign-in**. Then save your draft. Use **Download unsaved edits** if you need an extra copy.

### Save Draft reports an error

Read the message and keep the editing tab open. Fix a missing title or other field named in the message, then try again. If the error concerns a changed page, use the next instructions before reloading.

If a new Blog Post or Program Update shows **Retry creation safely**, use that button to check and retry the original save. Do not start a second article. A lost response can leave the first save's result unconfirmed even when the page was created.

If saving finished successfully but the content list then failed to refresh, the confirmed save still stands. Return to the list and open the entry to check it.

### The page changed in GitHub or the draft uses an earlier published version

Someone may have saved another version or changed the published page since you opened it. The editor stops the save to avoid overwriting their work.

1. Keep or download a backup of your unsaved edits before reloading. If no download control is available, copy your text into a separate document and keep the tab open.
2. Reopen the entry to load its latest saved version.
3. Compare the versions and copy in the changes you still need. Coordinate with the other editor.
4. Ask a maintainer for help if the editor says the draft is based on an earlier published version or will not let you continue.

Do not delete drafts or other CMS records to get around the error.

### A filename or web address is already in use

For a new page with a Filename field, choose a different filename and save again. For a new Blog Post or Program Update, the editor may offer **Create as …** with an alternative name. Choose it if that address works for your page. If creation is unconfirmed, use **Retry creation safely** instead of making a duplicate.

### Publishing is greyed out or unavailable

Save the draft first and wait for the save to finish. Submission requires a saved draft with no unsaved changes and a valid sign-in. If submission reports that publishing is disabled, contact the maintainer; your draft can remain saved.

### Progress could not be confirmed

The editor keeps checking automatically. A temporary verification problem does not mean the action failed, and it does not require another submission. Your saved draft remains available.

For an immediate check, open **Technical details** and choose **Refresh status**. The confirmation message means the check finished, even if the displayed result stayed the same. If the status remains uncertain or becomes **Needs attention**, give the maintainer the exact message and any request link.

Do not start a replacement request or remove CMS records to bypass an uncertain result. Any earlier saved version offered for recovery must be reviewed and confirmed before it can be published.

### I saved or submitted, but the public page has not changed

Check which step is complete. Save Draft keeps working content. Publish authorizes the saved version after confirmation. Validation and the website update must succeed before the changes are confirmed online. Follow the publication steps above, then refresh the public page.

### An image will not upload or save

Save a new page once before uploading. Check the file type and 5 MB limit. Add alt text or mark a purely decorative image as decorative. Make sure you inserted the image into the body or selected it as a cover, then save the draft.

If the error says there are too many pending uploads or the save is too large, save smaller groups of images. If it concerns retained images or a publication limit, ask a maintainer for help.

### Browser backup is unavailable or storage is full

Keep the tab open. Use **Download unsaved edits** if offered, or copy the text into a separate document. Try Save Draft to keep the work in GitHub. Do not clear browser data until you have a confirmed save or a separate copy. New article creation may wait until the browser can store its safe-retry information.

### Restoring an older browser copy is blocked

The saved page may have changed since the copy was made, or you may already have unsaved edits open. Download the older copy with **Save backup file** and compare it with the current page. Ask a maintainer to help recover text from the backup if needed. The editor does not combine different versions automatically.

### Saving reports that read-only content changed

Eligible protected content can be replaced: add a supported replacement block, then choose **Remove original block**. The editor records that deletion. Page setup and blocks without that removal control must remain unchanged.

If saving rejects the result, keep the tab open and preserve your unsaved work. Send the maintainer the exact message and page address. Numeric ratios such as `4:3` and `16:9` are ordinary text in the updated editor. If an older editor still rejects them, writing “4 to 3” and “16 to 9” is a temporary workaround.

### A block cannot be edited or looks missing in Preview

Check whether it is labeled protected or read-only. The editor keeps that content, but cannot display or edit every older layout. Ask a maintainer to change it or check its finished appearance. For disabled special blocks in a `.md` page, continue using Text blocks.

