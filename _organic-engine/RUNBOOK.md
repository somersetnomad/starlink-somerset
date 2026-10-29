# Rural Signal weekly run

The scheduled task follows this file. `profile.md` holds the site facts, voice and owner facts; if the two ever disagree, profile.md wins on facts and this file wins on process. If the `organic-engine-pages` skill is installed, load it too; this file takes priority.

## Mode
AUTO: publish directly to `main` when every quality-gate item passes. If anything fails or needs the owner, push a branch `organic-engine/<slug>` instead, publish nothing live, and say what's needed in the summary.

One new post per run, never more than one per week.

## Referral link rule (owner decision)
- The referral link (`site.referral_url`) appears in **at most 2 posts per calendar month** (Europe/London).
- Count this month's referral posts: files in `_posts/` dated this month with `referral: true` in front matter.
- If fewer than 2 so far: this post may carry the link, but only if it is a decision-stage topic (buyer is choosing or ready to order). Set `referral: true`, include the two `cta-module` sections exactly as in the planning-permission post, with the disclosure line inside each.
- Otherwise: set `referral: false`, include **no** referral link anywhere in the post. Use one `interactive-module` near the end pointing to the most relevant existing guide (or to the RSS feed if there is none). No "affiliate"/"referral" language in that post apart from what the site footer already shows.
- Never add the link to old posts to make up the count, and never exceed 2 in a month.
- Starlink's referral terms discourage spamming links and running referrals as a business: no paid ads, bulk social posts or mass emails with the link, and never present the site as Starlink's or the owner as an agent, installer or reseller.

## Steps
1. Attach `somersetnomad/starlink-somerset` with push access (add_repo), clone it, and read every file in `_organic-engine/`.
2. **Refresh first:** if a published post has a broken link, an outdated price/rule/date, or a clear weakness, fix one at most, update its `last_modified_at`, and log it.
3. **Pick the topic:** highest-priority `queued` item in `queue.csv` that does not need owner facts missing from profile.md (`needs_owner` items stay put until the owner answers). Buyer-intent topics only: decision or consideration stage, where Starlink is an honest answer. If fewer than 6 usable items remain, research buyer demand (rural UK and Somerset Starlink searches, forums, competitor gaps) and add more.
4. **Research and brief** with web search. Search before stating any current price, plan, rule or statistic, and cite primary sources (Starlink, Ofcom, legislation.gov.uk, gov.uk, councils, Opensignal and similar).
5. **Write** in Bala's plain, candid first-person voice. Never invent experience, speeds, prices paid or details of Bala's setup: use only owner facts in profile.md. Answer first in an `answer` box, then format per the axiom-post skill (see profile.md "Theme and post format"): 2-6 H2 sections, H3 sub-parts, footnotes for asides/sources/technical detail (about one per 150-300 words), a "Questions people ask" H2 with H3 questions plus matching `faq` front matter, a "Sources" H2. `description` is the one-sentence excerpt (<160 chars). 1-3 tags, primary first. `template: default` unless the piece is a long reflective essay.
6. **Images:** one hero plus 1-2 in-body Unsplash photos. Find them with WebSearch on unsplash.com, WebFetch each photo page for the photographer, `@username`, the images.unsplash.com URL and the licence line. Free Unsplash License only (skip Unsplash+ and plus.unsplash.com), not already in `images.csv`, no identifiable public figures or other brands' products. Look at each image before using it (curl images.unsplash.com works from the shell). Hotlink with sizing params, credit each with UTM links (`utm_source=rural_signal&utm_medium=referral`), write specific alt text, log in `images.csv`. Hero front matter: `image` (fm=jpg, for the feed and social cards), `image_base`, `image_width`, `image_height`, `image_alt`, `image_credit`.
7. **Quality gate** (all must pass): answer-first opening; information gain the top results lack; every factual claim sourced; every outbound link and image URL resolves (WebFetch); referral rule above obeyed; title <=60 chars, description <=160; valid FAQ front matter; links to and from at least one existing post (edit an older post to link in); no AI filler ("delve", "unlock", "game-changer", "in today's fast-paced world").
8. **Publish:** save `_posts/YYYY-MM-DD-<slug>.md`, commit to `main` with `organic-engine: publish <slug>` and push. Wait for the "pages build and deployment" run on the commit to finish (GitHub API: `repos/somersetnomad/starlink-somerset/actions/runs?branch=main&per_page=1`, public, no auth needed) and confirm `success`. If it fails, fix and push again; if it still fails, revert the commit and report. RubyGems is blocked in the sandbox, so don't try to build Jekyll locally.
9. **Log:** update `queue.csv` (status `live`, url, date), `changelog.md` (one dated line, including whether the post carried the referral link), and `tracking.csv` (spot checks labelled `spot_check` or `ai_spot_check`; never claim rankings you didn't observe).

## Hard rules
No fabricated facts, reviews, testimonials, statistics or experiences. No link schemes. No structural changes (deleting pages, redirects, robots rules, theme files under `assets/axiom/`) without asking.

## Summary to the owner (SendUserMessage)
What went live (title and link) and whether it carried the referral link (and how many referral posts this month), anything refreshed, tracking notes with their source, anything waiting on Bala, and the next two topics.
