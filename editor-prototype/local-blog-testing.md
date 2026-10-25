# Test blog posts with the editor locally

The editor and the local website use two different copies of the content:

```text
Save in the local editor
        ↓
Post is saved on GitHub, in the custom-cms branch
        ↓
Download that post into your computer's project folder
        ↓
View the post on the local website
```

You need to download the post again after each editor save if you want to see that change on the local website. You do not need to deploy the editor to Cloudflare for these tests.

1. **Start the editor.**

   Open a terminal and run:

   ```sh
   cd /Users/majew030/GitHub/geobtaa.github.io
   npm run editor
   ```

   Leave this terminal running. It handles the editor's connection to GitHub. Since you have already saved a test post, your GitHub token setup should already be working.

2. **Start the local website in a second terminal tab.**

   Open another terminal tab and run:

   ```sh
   cd /Users/majew030/GitHub/geobtaa.github.io
   npm run dev
   ```

   Leave this tab running too. It serves the website from the files on your computer. The steps below assume its address is `http://localhost:4321/`. If Astro reports a different port, stop any older development server using port 4321 and restart this command; the editor's default local connection expects port 4321.

3. **Create a simple test post in your browser.**

   Open <http://localhost:4321/editor/>. You should see the dashboard with no content area selected. Choose the **Blog Posts** card, then **New Blog Post**.

   For this walkthrough, enter the title **Editor Practice Post** and a short paragraph in the body. Leave the other optional fields empty. Confirm that the publication date shows today's date and the toggle reads **Draft**.

   Click **Save changes**. You should see a staging save confirmation and a saved URL such as `/posts/editor-practice-post/`.

   You can use **Save changes** in the top navigation or at the bottom of the form; both do the same thing. The **Draft / Published** toggle is in the compact banner above the form. The content list shows an amber row and **Draft** badge only for saved drafts.

   If that URL already exists, the editor will suggest an alternative such as `editor-practice-post-2`. Accept it, then use that actual name in the commands and addresses below.

   You can also use the test post you already created. In that case, open it in the editor and use the name in its **Saved URL** instead of `editor-practice-post` throughout this guide.

4. **Check that the editor saved your work.**

   Click **Back to Blog Posts**, reopen the test post, and confirm the title, date, draft checkbox, and body are still correct. Use the editor's large back buttons to move between views. **Back to dashboard** on the list returns to the home view, and **Dashboard** in an editing view takes you there directly.

   This checks the GitHub copy. The local website does not have the new file yet.

5. **Download only the saved test post into your local project.**

   Open a third terminal tab. Keep the first two tabs running. In the third tab, run:

   ```sh
   cd /Users/majew030/GitHub/geobtaa.github.io
   git fetch origin
   git restore --source=origin/custom-cms --worktree -- src/content/docs/posts/editor-practice-post.mdx
   ```

   Use your actual post filename in the last command if it differs from the example.

   `git fetch` gets the latest information from GitHub. `git restore` copies just the named post from GitHub into your project folder. These commands do not switch branches or replace your editor code. The restore command does replace the named local post file, so make your test edits through the editor rather than editing that same file locally.

   Successful commands may show little or no output. You should now see the file in `src/content/docs/posts/` in your code editor.

   If Git reports that the path does not match a known file, check the filename against the editor's saved URL and confirm that the save succeeded. Do not reset the repository or switch branches to fix this.

6. **Open the rendered post.**

   Open this address in a new browser tab:

   ```text
   http://localhost:4321/posts/editor-practice-post/
   ```

   Use the actual saved URL if yours differs. You should see your title and formatted body. Astro normally picks up the downloaded file automatically; refresh the page if needed.

   Keep the toggle set to **Draft** for this first test. Local development allows you to visit a draft's direct address, but the draft will not appear at <http://localhost:4321/blog/>. Cloudflare production builds omit draft pages entirely.

7. **Test editing and the permanent URL.**

   Return to the editor tab. Change the title to **Editor Practice Post — Revised**, select a different publication date, and add another paragraph. Save again.

   Confirm that **Saved URL** still shows the original address. In the third terminal tab, repeat:

   ```sh
   git fetch origin
   git restore --source=origin/custom-cms --worktree -- src/content/docs/posts/editor-practice-post.mdx
   ```

   Refresh the rendered post at its original address. You should see the revised title, date, and body. Its filename and URL should stay unchanged.

8. **Test the optional fields and images.**

   Add an excerpt, an author, a tag, and a cover image. For the first image test, choose an existing repository image rather than uploading a new one. You can also insert an existing image into the body with **Image**. Enter alt text and a **Caption (optional)**, then insert another image without a caption. Click a body image and choose the **Edit image** button that appears on it to replace it or change its source, alt text, or caption. **Apply Changes** updates the unsaved post; **Cancel** leaves the image unchanged. Captions appear below images in the editor and are stored as ordinary Markdown image titles.

   Save, return to the post list, and reopen the post to check the fields. Repeat the download commands from step 7 and refresh the rendered post to check its appearance. Body images should be centered with any captions beneath them. Check the same post on Cloudflare staging after deployment; drafts are omitted from staging builds. Existing MDX components such as `CenterLayout` remain protected and read-only.

   Newly uploaded images need to be downloaded separately before the local website can display them. For example, if the selected image path is `@images/my-test-image.png`, run:

   ```sh
   git fetch origin
   git restore --source=origin/custom-cms --worktree -- src/assets/images/my-test-image.png
   ```

   Replace the example with the exact image filename shown in the picker or cover field. Uploads are saved to GitHub immediately, separately from saving the post.

   For links, cards, and buttons, enter a website address such as `example.com/maps`; the editor adds `https://` automatically. Use a path such as `/guides/help/` for another page on this site. Existing links stay unchanged unless you edit their address.

   For a call-to-action button, choose **Add block → Link Button** from the menu beside the relevant block (below it on small screens). Enter button text and a URL, then select Primary, Secondary, or Minimal appearance. Cards and buttons appear as standalone property forms without a formatting toolbar. After insertion, use the button's property form to edit those fields. Use **Add block → Text** to continue with ordinary content after a component, or its **Remove** action to delete it. Save and reopen to verify they persist. Buttons containing rich content or unsupported attributes remain protected MDX.

   You can also choose **Add block → Badge**, **Add block → Callout**, or **Add block → Card**. Badges have text, style, and size controls. Callouts have a type, optional title, and message; cards have a title and message. Messages are plain text with line breaks. These insertions create standalone property forms without a blank text editor. Edit the fields, save, and reopen to check that they persist. Existing badges, callouts, and cards remain protected and read-only. Use **Add block → Text** when you want ordinary Markdown after a component.

9. **Optionally check the blog listing.**

   Switch the toggle to **Published**, save the post, and repeat the download commands from step 7. Open <http://localhost:4321/blog/> and look for the revised title.

   This also makes the saved post eligible to appear on Cloudflare staging after its next deployment. It does not publish it to the live site, which requires a merge into `main`.

   When finished, switch the toggle back to **Draft** and save. Download the file again to keep the local copy consistent. Keep test posts out of any production publishing merge.

10. **Check duplicate titles and unsaved changes.**

    Create another post with the original title **Editor Practice Post**. On save, the editor should offer a unique alternative rather than replace the first post. You can leave this second post unsaved if you only want to check the suggestion.

    Make an unsaved edit and click **Back to Blog Posts** or **Dashboard**. The editor should ask before discarding it. Choose **Cancel** to return to the editor and save your work. If saving fails and you need to reload, first copy any unsaved text and field changes into a separate document.

When finished, press **Control+C** in each of the two server terminal tabs to stop them.
