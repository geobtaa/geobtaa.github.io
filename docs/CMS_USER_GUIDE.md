# Custom CMS user guide

Use the custom CMS (content management system) to create and update website pages. You can write, format text, add images, and save your work in the editor. When the page is ready, submit it for publication.

**Use Text blocks for most of your content. Choose Save Draft while you are working. Choose Submit for publishing when your saved page is ready for review.**

Saving, submitting, and publishing are separate steps:

| Step | What happens | Does the public website change? |
| --- | --- | --- |
| Save Draft | Saves the page and its attached new images in GitHub. Other authorized editors can open and edit this draft. | No. |
| Submit for publishing | Creates a publication request in GitHub for the saved version. | No. |
| Merge the publication request | Accepts the changes into the website's main set of files. This starts the website update. | The changes appear after the website update succeeds. |

Jump to [blocks](#work-with-blocks), [images](#add-and-edit-images),
[saving drafts](#save-a-draft-and-return-later),
[publication](#submit-a-page-for-publication), or
[troubleshooting](#troubleshooting-and-common-errors).

## Sign in and find a page

You need a GitHub account with permission to edit the website. GitHub is the service that stores the website's files and saved changes. You do not need to install software or use computer commands.

1. Open the editor link supplied by the website maintainer.
2. Click **Sign in with GitHub**.
3. Sign in to your GitHub account. If GitHub asks you to authorize the editor, follow the prompts.
4. On the editor dashboard, choose a content area, such as **Projects**, **Blog Posts**, or **Program Updates**.
5. Click an existing entry to open it, or click the **New** button to create one. The button name depends on the area, such as **New Blog Post**.

The list may show filenames with hyphens instead of page titles. Open an entry to see its title and current editing status.

The list can show **Saved page**, **New draft**, **Editing history**, or **Needs review**. These labels help you find content. Open the entry to check its current state. A **Saved page** label means the file is available to edit; it does not confirm that the page is online.

Saved drafts are shared with other authorized editors. Ask other editors before working on the same page at the same time.

## Create or edit a page

1. Open an existing page or create a new one.
2. Enter a **Title**. Every page needs one.
3. Fill in the other fields that apply to the page.
4. Write the main content under **Body**, mostly using Text blocks.
5. Click **Preview** to review your work. Click **Edit** to continue writing.
6. Click **Save Draft**. Wait for **Draft saved** and **No unsaved changes** before leaving.

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

Card and Callout messages use plain text. Use a Text block when you need general formatting, links, images, or tables. Card Grid has its own content editor inside each card.

Some older pages use the `.md` file format. On these pages, Text is available but the special block types are disabled. Images and tables still work inside Text blocks. Ask a maintainer if the page needs a special block.

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
2. Wait for **Draft saved**. The short code after “commit” identifies that saved version; you do not need to do anything with it.
3. Confirm that the editor says **No unsaved changes**.
4. You can now return to the content list or sign out.
5. To continue later, sign in, choose the same content area, and open the same entry.

Saved drafts can be reopened from another browser or computer. Other authorized editors can also open and continue them. Saving changes to an existing page leaves its public version in place until the changes are published.

There is no Draft/Published switch to set. Use Save Draft and Submit for publishing for those tasks.

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

## Submit a page for publication

Submit when your saved page is ready for review. Submission uses the saved version, so save any final changes first.

1. Review the page in **Preview**.
2. Click **Save Draft** and wait for **No unsaved changes**.
3. Click **Submit for publishing** at the top of the editor.
4. Wait for **Submitted for publishing** and the **Review publication request #…** link.
5. Open that link to review the request in GitHub, or copy the link and send it to the person who handles website publication.

GitHub calls this request a **pull request**, often shortened to **PR**. It is a proposal to include your saved changes in the website. The number identifies that request.

Submitting does not finish publication. The request must pass automated checks and be merged in GitHub. Merging means accepting the proposed changes. The website then builds and deploys, meaning it prepares and puts the updated pages online.

If submission is disabled or reports that publishing is unavailable, keep the saved draft and ask the website maintainer for help.

### Review and merge in GitHub

If someone else handles publication, give them the request link. If you are handling it yourself:

1. Open **Review publication request #…** and sign in to GitHub if asked.
2. Open the **Files changed** tab. Review the proposed changes. The request should contain your page and any new images it needs. Ask a maintainer about unfamiliar changes. GitHub explains this view in its [guide to reviewing proposed changes](https://docs.github.com/en/get-started/start-your-journey/reviewing-your-proposed-changes).
3. Return to the **Conversation** tab. Near the bottom, find the automated checks. Wait for both **validate** and **cms-publication-scope** to pass. If checks fail or GitHub says changes are required, ask a maintainer for help.
4. When the checks and any required review are complete, click **Merge pull request**, then **Confirm merge**. The button wording can vary with the available merge method. If you cannot merge, send the request link to a maintainer. See [GitHub's merge instructions](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/merging-a-pull-request).
5. Return to the CMS and click **Check status** to refresh the request's status.

Do not use GitHub's **Update branch** button on a CMS publication request. If GitHub says the request is out of date, follow the troubleshooting instructions below. If GitHub offers **Delete branch** after merging, leave it alone. The CMS uses those saved records to keep track of drafts and publication.

### Confirm the page is online

A **Merged** message means GitHub accepted the changes. It does not confirm that the public website has finished updating.

1. In the CMS, click **Check status**. After it reports the merge, click **View GitHub Pages deployment**.
2. This opens the website's **Deploy Astro site to Pages** process in GitHub. Open the run for your merged changes, or a newer run that includes them. A run is one attempt to update the website; check its time and change details.
3. Wait for both **Build** and **Deploy** to succeed. If you need to find this screen again, open the [website deployment history](https://github.com/geobtaa/geobtaa.github.io/actions/workflows/astro.yml). GitHub's [workflow history instructions](https://docs.github.com/en/actions/how-tos/monitor-workflows/view-workflow-run-history?tool=webui) explain how to open a run and see its details.
4. Open the public page and refresh it. Check that the expected text and images appear.

If the update fails, send the deployment run link and publication request link to a maintainer. Use **Check status** to check the request and the deployed website. The editor checks when you open a page or request a refresh; it does not keep checking in the background.

### Changes made after submission

A publication request contains the saved version selected when it was created. Edits made afterward, including later draft saves, do not update that request.

If you need to correct a submitted version before it goes online, tell the person handling publication to wait and ask a maintainer to help replace the request with the correct version. Do not assume clicking Submit again will replace it.

After the earlier request merges, reopen the page from the content list to make the next update. If you saved newer edits while the request was open, the editor keeps them and shows a notice. Review them, click **Save Draft**, and submit again when ready.

## Unpublish a page

The status below the page title describes the public website. **Published** means the page is included in a verified website deployment. **Unpublished** means it is excluded from that deployment. **Publication status unavailable** means the editor could not confirm the result; it does not mean the page is offline.

Working drafts and pending requests are shown as smaller details beneath that status. Saving a draft does not change the website status.

1. Save any work you want to keep with **Save Draft**.
2. Click **Unpublish page**, then read the confirmation. Choose **Cancel** to leave the page online, or **Submit unpublish request** to continue.
3. Open the publication request in GitHub. Review it and wait for the required checks, then merge it or send its link to the person handling publication.
4. Return to the editor and click **Check status**. The page remains Published until the website update has been confirmed. A merged request alone does not mean it is offline.

Unpublishing changes only the visibility of the current main version. It keeps the page file, its images, and your separate saved editorial work. It also keeps your Site search and Navigation visibility settings. After unpublishing, reopen the page normally to continue editing. Save your draft and use **Submit for publishing** to republish it.

If an explicit navigation entry prevents unpublishing, ask a maintainer to update that entry. Ordinary links from other pages produce warnings so they can be fixed later; the editor does not change them automatically. If another website change makes a request out of date, use **Refresh request** in the editor. Review the latest page first if its content changed. Do not use GitHub's Update branch button on CMS publication requests.

If the website update fails, the editor explains that deployment is not confirmed and keeps your work. Open the deployment link for help from a maintainer. If Unpublish page is unavailable, save outstanding edits or contact the maintainer; the feature may not yet be enabled.

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

If **Draft saved** appeared but the content list then failed to refresh, the confirmed save still stands. Return to the list and open the entry to check it.

### The page changed in GitHub or the draft uses an earlier published version

Someone may have saved another version or changed the published page since you opened it. The editor stops the save to avoid overwriting their work.

1. Keep or download a backup of your unsaved edits before reloading. If no download control is available, copy your text into a separate document and keep the tab open.
2. Reopen the entry to load its latest saved version.
3. Compare the versions and copy in the changes you still need. Coordinate with the other editor.
4. Ask a maintainer for help if the editor says the draft is based on an earlier published version or will not let you continue.

Do not delete drafts or other CMS records to get around the error.

### A filename or web address is already in use

For a new page with a Filename field, choose a different filename and save again. For a new Blog Post or Program Update, the editor may offer **Create as …** with an alternative name. Choose it if that address works for your page. If creation is unconfirmed, use **Retry creation safely** instead of making a duplicate.

### Submit for publishing is greyed out or unavailable

Save the draft first and wait for the save to finish. Submission requires a saved draft with no unsaved changes and a valid sign-in. If submission reports that publishing is disabled, contact the maintainer; your draft can remain saved.

### Submission failed or PR status is unavailable

Click **Check status** before submitting again. A request may already exist even if the browser did not receive its confirmation. Your saved draft remains available.

If the status says the request is reserved, closed, or in conflict, the editor may offer **Recreate PR for this saved revision**. This retries the version selected for that request, not newer edits. Use it only when that is still the version you want. It can replace an out-of-date request when other pages changed. Changes to this same page may require maintainer help.

For repeated errors, failed checks, or messages about limits or uncertain request identity, give the maintainer the exact message and any request link. Do not use **Update branch** or remove CMS records to bypass the problem.

### I saved or submitted, but the public page has not changed

Check which step is complete. Save Draft keeps working content. Submit for publishing opens a request. The request must then merge and the website's Build and Deploy must succeed. Follow the publication steps above, then refresh the public page.

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
