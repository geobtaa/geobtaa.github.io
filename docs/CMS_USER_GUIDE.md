# BTAA-GIN Website Editor user guide

Use the custom CMS (content management system) to create and update website pages. You can write, format text, add images, and save your work in the editor. When the page is ready, submit it for publication.

**Use Text blocks for most of your content. Choose Save Draft while you are working. Choose Publish only when your saved version is ready to go online. You will review and confirm that version before publishing starts.**

Saving, submitting, and publishing are separate steps:

| Step | What happens | Does the public website change? |
| --- | --- | --- |
| Save Draft | Saves the page and its attached new images in GitHub. Other authorized editors can open and edit this draft. | No. |
| Publish | Asks you to confirm the saved version, then completes publication automatically after validation and deployment. | Yes, after the website update succeeds. |
| Unpublish | Asks you to confirm removal from the public website. Saved work stays in the editor. | Yes, after the website update succeeds. |

Jump to [blocks](#work-with-blocks), [images](#add-and-edit-images),
[saving drafts](#save-a-draft-and-return-later),
[publication](#publish-a-page), or
[troubleshooting](#troubleshooting-and-common-errors).

## Sign in and find a page

The application header includes **Visit website**, which opens the public BTAA-GIN homepage in a new tab. On a document, **View live page** appears beside Edit/Preview only when the editor has confirmed that the page is published. It opens the deployed version at its resolved public address, including any custom slug; it does not show your working draft. If publication cannot be verified, the link is hidden.

You need a GitHub account with permission to edit the website. GitHub is the service that stores the website's files and saved changes. You do not need to install software or use computer commands.

1. Open the editor link supplied by the website maintainer.
2. Click **Sign in with GitHub**.
3. Sign in to your GitHub account. If GitHub asks you to authorize the editor, follow the prompts.
4. On the editor dashboard, choose a content area, such as **Projects**, **Blog Posts**, or **Program Updates**.
5. Click an existing entry to open it, or click the **New** button to create one. The button name depends on the area, such as **New Blog Post**.

The list may show filenames with hyphens instead of page titles. Open an entry to see its title and current editing status.

The list can show **New draft**, **Unpublished changes**, or **Needs review**. **Unpublished changes** means saved editorial content differs from the current main document; an old saved branch alone does not trigger the label. This does not confirm deployment status. Other pages have no status label. Open an entry to check its current editing and publication status.

Saved drafts are shared with other authorized editors. Ask other editors before working on the same page at the same time.

## Create or edit a page

1. Open an existing page or create a new one.
2. Enter a **Title**. Every page needs one.
3. Fill in the other fields that apply to the page.
4. Write the main content under **Body**, mostly using Text blocks.
5. Click **Preview** to review your work. Click **Edit** to continue writing.
6. Click **Save Draft**. Wait for **All changes saved** before leaving.

The Save Draft buttons at the top and bottom of the editor do the same thing.

### Page details

The available fields depend on the content area and the page you opened.

| Field | What to enter |
| --- | --- |
| Title | The page's main title. |
| Filename | For new pages where this field appears, you can leave it blank to use a name based on the title. It helps determine the page's web address. |
| Description | A short summary of the page. |
| Publication date or Date | The date associated with the content. This does not schedule automatic publication. |
| Excerpt | A short introduction or summary for an article. |
| Authors | Click **Add author** and enter each author's name. |
| Tags | Short topic labels, separated by commas. |
| Cover image | An optional article image, with a description for people who cannot see it and an optional caption. |
| Year | The year associated with the item, where offered. |
| Working group fields | Committee, lead, active dates, and members, where offered. |

New Blog Posts and Program Updates get a filename based on the title when first saved. After a page is created, changing its title does not change its filename or web address. Ask a maintainer if you need to change an existing address.

### Page settings

You can usually leave **Page settings** as they are. Open this section only when you need to change how the page appears or is found.

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

An option marked **site default** follows the website's settings. Leave that option selected unless the page needs a specific setting.

## Work with blocks

A block is a section of page content. A Text block can contain many paragraphs, headings, lists, images, and tables. You do not need a separate block for each paragraph or heading.

### Use Text blocks most of the time

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

### Other block types

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

New Card and Callout messages use plain text. Some existing callouts have a formatting toolbar for editing their paragraphs, links, and lists. Info callouts appear as Note; Warning callouts appear as Caution. These names are standardized when you edit that callout. Use a Text block when you need images or tables. Card Grid has its own content editor inside each card.

Some older pages use the `.md` file format. On these pages, Text is available but the special block types are disabled. Images and tables still work inside Text blocks. Ask a maintainer if the page needs a special block.

Existing Markdown tables can be edited directly in Text blocks, including tables with times, ratios, and map scales. Tables containing custom styling, embedded components, or other unsupported content may remain read-only.

Some older Chip Lists now have the same item controls as new lists. You can edit, add, remove, and reorder their labels while their existing layout stays in place. These older blocks cannot be moved or removed as a whole. Lists with formatted labels or other unsupported content remain read-only.

Some simpler older Card Grids now expose title and formatted-content fields. You can edit or reorder their cards while keeping the existing layout. Adding or removing cards, moving the whole grid, and creating headings are unavailable for these older grids. More complex cards and grids remain read-only.

### Add, move, or remove blocks

- Click **Add block** beside a block to insert another block after it. This adds a whole block; it does not insert one at the typing cursor inside your text.
- Use **Move up** or **Move down** to change a block's position. Blocks cannot move across protected content.
- Use **Remove Text block**, or the matching Remove button for another block, to remove the whole block. Removing a Text block also removes the images and tables inside it.
- **Undo removal** restores the most recently removed block. Use it before adding, moving, or removing another block, since those actions clear or replace this undo option.
- Click **Save Draft** to save block changes.

Text blocks next to each other may appear as one Text block when you reopen the page. Their content stays in the same order. Empty Text blocks are not saved as separate sections.

### Protected blocks on existing pages

Some existing pages contain layouts, embedded items, or code that the visual editor cannot edit. These appear as protected, read-only blocks, sometimes labeled **MDX** or **Astro**. These are file and component names; you do not need to learn them to edit the surrounding text.

Leave protected blocks in place. The editor keeps their original content when you save. Ask a maintainer to change anything inside them. In Preview, these blocks appear as placeholders rather than a finished layout.

Some Link Cards inside older layouts show editable title, description, and URL fields. You can edit those fields while the surrounding layout stays read-only. These layouts cannot be moved or removed. Preview shows the cards without reproducing the complete surrounding layout.

## Add and edit images

For a new page, click **Save Draft** once before uploading an image.

1. Place the cursor in a Text block where the image should go.
2. Click **Image** in that block's toolbar.
3. Choose an existing image from the library, or use **Upload a new image**. Use PNG, JPEG, GIF, or WebP, up to 5 MB per image. You can filter the library by filename.
4. Enter **Alt text**: a short description of what the image shows. This helps people who use screen readers. Select **This image is decorative** only if the image adds no information.
5. Add a caption if needed.
6. Click **Insert image**.
7. Click **Save Draft** to save the page and its attached new image together.

Uploading alone does not save the image to GitHub. Until you save the draft, new uploads stay in the browser. Keep the tab open if you see a backup or storage error.

Select an image in the editor to access its controls. Use **Edit image** to change its source, alt text, or caption, then click **Apply Changes**. You can also choose **Left**, **Center**, or **Right**, and choose **Small**, **Medium**, or **Large**. **Reset formatting** returns it to the normal image format. Save the draft afterward.

For a cover image, use **Add cover image**, then **Choose or upload image** in the page details. Save the draft afterward.

## Preview your work

Click **Preview** near the top of the page. It shows the current content, including changes you have not saved yet. Click **Edit** to return to writing.

Preview does not save, submit, or publish anything. It is a check of the content and an approximation of the page's appearance. It does not show the full website navigation, every page setting, cover images, or excerpts. Protected blocks appear as placeholders. Preview links open in a new tab.

Before submitting, check the title, headings, spelling, links, images, captions, and tables. Check the public page again after publication.

## Save a draft and return later

Choose **Save Draft** whenever you want to keep your progress without publishing it.

1. Click **Save Draft**.
2. Wait for **All changes saved** beneath the document title. The saved time uses your local timezone.
3. You can now return to the content list or sign out.
4. To continue later, sign in, choose the same content area, and open the same entry.

Saved drafts can be reopened from another browser or computer. Other authorized editors can also open and continue them. Saving changes to an existing page leaves its public version in place until the changes are published.

There is no Draft/Published switch to set. Use Save Draft to keep work and Publish to authorize publication.

### Browser backups and downloaded backups

The editor also tries to keep unsaved work in the current browser. This is separate from Save Draft.

| Option or message | What it means |
| --- | --- |
| Unsaved changes kept in this browser only | The browser has a recovery copy. The changes have not been confirmed saved to GitHub. |
| Save backup file or Download unsaved edits | Downloads a copy to your computer. It does not save a draft or publish the page. |
| Restore changes or Resume editing | Brings a stored browser copy back into the editor for review. You still need to click Save Draft. |
| Discard unsaved changes | Permanently removes the selected browser copy. It does not change the saved draft or public page. |

Browser copies are tied to the account, editor address, and browser where you were working. They do not travel to another computer. Clearing browser data can remove them.

If you see **Unsaved changes available**, choose **Restore changes** to review the work. If several versions are offered, read their dates and previews and choose the version you need. The newest copy may not include changes from the others.

A downloaded backup is a `.json` file. Keep it for recovery or give it to a maintainer for help. The editor has no backup-file upload button.

If you try to leave with unsaved changes, choose **Keep editing** to return and save. **Leave editor** leaves without saving to GitHub; recovery depends on the browser copy being available.

## Publish a page

1. Review the page in **Preview**.
2. Click **Save Draft** and wait for **All changes saved**. Unsaved changes must be saved before you can open the confirmation.
3. Click **Publish**. The confirmation identifies the saved version by its version code, with its saved time and editor when available. Check that it is the version you want online. If an earlier saved version is selected, the dialog explains that newer saved changes are not included.
4. Choose **Cancel** to leave without publishing, or **Publish** to authorize the action.
5. Follow the progress notice below the title or beside the page in the content list. Validation and the website update complete automatically. Wait for **Update deployed** before assuming your selected changes are online.

For a new or unpublished page, the confirmation says **Publish this page?** For an already published page, it says **Publish these changes?** Both publish the identified saved version. A **Published** badge may still describe the previous website version while an update is in progress.

You can close the editor after publication has been authorized. When you return, open the page to check progress. Visible pending actions are checked about every 20 seconds. Checks pause in hidden tabs and stop after a limited period or when attention is needed. Open the page and use **Check again** to resume.

### Cancel a pending action

While **Cancel publishing** or **Cancel unpublishing** is available, you can stop automatic completion. Your saved work stays available. Cancellation cannot undo changes already accepted for deployment. If the action completes while you are cancelling, the editor will explain that it was too late and continue checking the website update.

### If an action needs attention

If the website changed while an action was waiting, use **Update and publish** or **Update and unpublish** when offered. Review the saved version in the confirmation, then confirm. If this page's content changed on the website, keep your saved work and ask a maintainer to reconcile it.

For failed checks or other blocked actions, your saved work stays available. Follow the notice and ask a maintainer for help if needed. **View details** contains optional technical information and links for inspection. You do not need to open GitHub to determine whether a normal publication succeeded.

If Publish or Unpublish is disabled because the service is unavailable, ask a maintainer. The normal editor does not switch to a manual publishing process.

### Changes made after submission

A publication action uses the saved version selected in its confirmation. Edits made afterward, including later draft saves, do not update that request.

If you need to correct a submitted version before it goes online, tell the person handling publication to wait and ask a maintainer to help replace the request with the correct version. Do not assume clicking Publish again will replace an earlier selected version.

After the earlier action completes, reopen the page from the content list to make the next update. If you saved newer edits while the request was open, the editor keeps them and shows a notice. Review them, click **Save Draft**, and submit again when ready.

## Unpublish a page

The status below the page title describes the public website. **Published** means the page is included in a verified website deployment. **Unpublished** means it is excluded from that deployment. **Publication status unavailable** means the editor could not confirm the result; it does not mean the page is offline.

Working drafts and pending requests are shown as smaller details beneath that status. Saving a draft does not change the website status.

1. If you have unsaved changes, keep them with **Save Draft**. An unchanged page does not need a manual save.
2. Click **Unpublish**, then read the confirmation. Choose **Cancel** to leave the page online, or **Unpublish** to authorize removal after the required checks finish.
3. Follow the progress notice. Removal completes automatically after validation and the website update.
4. Return to the editor and click **Check again**. The page remains Published until the website update has been confirmed. A merged request alone does not mean it is offline.

While an automatic unpublish request is pending, **Cancel unpublishing** stops its automatic merge without removing the saved work. A completed merge cannot be cancelled.

After confirmation, the editor prepares any required internal working copy automatically. Cancelling does not create one. If preparation succeeds but submission fails, the copy remains available and is reused when you retry.

Unpublishing changes only the visibility of the current main version. It keeps the page file, its images, and your separate saved editorial work. It also keeps your Site search and Navigation visibility settings. After unpublishing, reopen the page normally to continue editing. Save your draft and use **Publish** to republish it.

If an explicit navigation entry prevents unpublishing, ask a maintainer to update that entry. Ordinary links from other pages produce warnings so they can be fixed later; the editor does not change them automatically. If another website change makes a request out of date, use **Update and publish** or **Update and unpublish** in the editor. Review the latest page first if its content changed. Do not use GitHub's Update branch button on CMS publication requests.

If the website update fails, the editor explains that deployment is not confirmed and keeps your work. Open **View details** for information to share with a maintainer. If Unpublish is unavailable, save outstanding edits or contact the maintainer; the feature may not yet be enabled.

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

If **All changes saved** appeared but the content list then failed to refresh, the confirmed save still stands. Return to the list and open the entry to check it.

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

Click **Check again** before submitting again. A request may already exist even if the browser did not receive its confirmation. Your saved draft remains available.

If the status says the request is reserved, closed, or in conflict, the editor may offer **Update and publish** or **Update and unpublish**. This retries the version selected for that request, not newer edits. Use it only when that is still the version you want. It can replace an out-of-date request when other pages changed. Changes to this same page may require maintainer help.

For repeated errors, failed checks, or messages about limits or uncertain request identity, give the maintainer the exact message and any request link. Do not use **Update branch** or remove CMS records to bypass the problem.

### I saved or submitted, but the public page has not changed

Check which step is complete. Save Draft keeps working content. Publish authorizes the saved version after confirmation. Validation and the website update must succeed before the changes are confirmed online. Follow the publication steps above, then refresh the public page.

### An image will not upload or save

Save a new page once before uploading. Check the file type and 5 MB limit. Add alt text or mark a purely decorative image as decorative. Make sure you inserted the image into the body or selected it as a cover, then save the draft.

If the error says there are too many pending uploads or the save is too large, save smaller groups of images. If it concerns retained images or a publication limit, ask a maintainer for help.

### Browser backup is unavailable or storage is full

Keep the tab open. Use **Download unsaved edits** if offered, or copy the text into a separate document. Try Save Draft to keep the work in GitHub. Do not clear browser data until you have a confirmed save or a separate copy. New article creation may wait until the browser can store its safe-retry information.

### Restoring an older browser copy is blocked

The saved page may have changed since the copy was made, or you may already have unsaved edits open. Download the older copy with **Save backup file** and compare it with the current page. Ask a maintainer to help recover text from the backup if needed. The editor does not combine different versions automatically.

### A block cannot be edited or looks missing in Preview

Check whether it is labeled protected or read-only. The editor keeps that content, but cannot display or edit every older layout. Ask a maintainer to change it or check its finished appearance. For disabled special blocks in a `.md` page, continue using Text blocks.

### Getting help

Send the website maintainer the content area, page title or filename, exact error message, and what you were trying to do. Include the publication request or deployment run link if there is one. Keep any backup file and the original editing tab until your work is safe.
