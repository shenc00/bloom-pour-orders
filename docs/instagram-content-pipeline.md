# Instagram content pipeline – plan

Status: plan only, nothing built yet.

Goal: run the Bloom Pour Instagram page from Claude Code. Claude pulls the live sale from the order app, renders the images, drafts the caption, and publishes through an Instagram MCP server once the owner approves.

## Assumptions

- The MCP server can publish images and carousels, and ideally stories, Reels and insights. Which MCP is used is still open (see "Open question").
- The account is an Instagram Business or Creator account.

## Pipeline

```
sale published (admin) -> 1 pull data -> 2 render slides -> 3 draft caption -> 4 owner approves -> 5 publish (MCP) -> 6 insights -+
        ^                                                                                                                         |
        +------------------- what worked feeds the next batch's hooks and timing -----------------------------------------------+
```

1. **Pull data.** Read the live sale and the coffee library from the order app: name, origin, process, roast, taste notes, price, cups left, sale date, hours and the delivery rule.
   - Use customer-facing fields only. Brew ratio, brew temperature, grinder, grind size and cost price are private (see the main README) and must never reach a caption or image. The pull step whitelists fields so a private one cannot leak.
2. **Render slides.** Each slide is an HTML template in the brand palette, rendered to a 1080x1350 JPEG with headless Chrome. This is deterministic and needs no AI image generation. Real cup and bag photos go in a folder and the templates place them.
   - The announcement carousel has a hook slide, one slide per coffee, and a last slide with how to order and the bio link.
3. **Draft caption.** Claude writes the caption, hashtags and first-comment text from a short voice guide the owner approves once. Output goes to `social/queue/<date>-<slug>/` as the slides, `caption.md` and `meta.json` with `status: draft`.
4. **Approval gate.** The owner reviews the folder and sets `status: approved`. Nothing publishes without that. Posting is public and hard to undo, so this is a hard rule.
5. **Publish.** Claude calls the MCP's publish tools for approved items only, then records the post ID and URL in `meta.json`.
6. **Insights.** About 48 hours after posting, pull reach, saves, shares and profile visits into `social/metrics.csv`. Claude reads it before drafting the next batch.

## Content types

| Type | When | Source |
|---|---|---|
| Sale announcement carousel | sale opens | live sale data |
| Story: last cups left | sale close | stock count |
| Coffee spotlight (single post or Reel) | mid-week | one library coffee |
| Thank-you / collection day | after the sale | owner photos |

Proposed weekly rhythm: teaser story, announcement carousel, spotlight, last-cups story, thank-you. Scale down as needed.

## What the MCP choice decides

- **Image hosting.** The Instagram Graph API normally needs a public image URL, and feed images are JPEG only (unconfirmed for the chosen MCP). If the MCP cannot take a local file, the pipeline commits finished images to `public/social/` and publishes after Netlify deploys them.
- **Scheduling.** The Graph API has no native scheduled publish, as far as known. If the MCP does not schedule either, Claude Code triggers the approved post at the set time with `/schedule` or a cron job.

## Other constraints

- Long-lived access tokens expire after about 60 days. Add a reminder to refresh them.
- Meta caps API publishing at about 100 posts per day, which this page will not reach.
- To measure orders from Instagram, the bio link can be `/?src=ig`. The order app would need a small change to log it. Deferred.

## Build phases

0. Account setup: Business account, linked Facebook Page, token, connect the MCP, make one test post.
1. Templates and the announcement carousel generated from live sale data.
2. Caption drafting, the approval queue, and publishing.
3. Stories and scheduling.
4. Insights log and the feedback step.
5. Reels, with optional video from the OpenMontage setup.

## File layout

A new `social/` folder in this repo, separate from the app code:

```
social/
  templates/   HTML slide templates
  queue/       one folder per post: slides, caption.md, meta.json
  metrics.csv  insights log
```

## Open question

Which Instagram MCP server will be used? It decides whether the pipeline uploads local files or goes through public URLs on Netlify.
