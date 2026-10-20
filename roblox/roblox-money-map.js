// The Roblox money map: one arrow in (Robux, nearly all of Roblox's money) holding four short articles, pointing into
// Roblox, with arrows out to where the money goes. This file is the map itself: its content, its layout, its drawing
// and its hit-testing. It draws into whatever canvas it is given, through the view it is given
// (screen = world x s + offset, y down), so a page can show it on its own or a card on another map can hold it.
// It reads its colours from the page's CSS custom properties, falling back to its own where the page has none.
//
// For a card on another map:
//   MoneyMap.size()                          -> { w, h }: the map's extent in its own units
//   MoneyMap.drawAt(ctx, x, y, s, W, H, a)   draws it with its top-left at screen px (x, y), s px per unit; W x H is the
//                                            canvas's CSS size, for culling; a fades all of it. ctx state is restored.
//   MoneyMap.hit(px, py)                     -> what a click there goes to, measured from the last drawAt:
//                                            { id, x0, y0, w, h } in the map's units from its top-left, or { href } for
//                                            a story's web address, or null
//   MoneyMap.hover(id)                       rings that node on the next draw (null for none)
// Colours are read from the page on every drawAt, so a theme change shows on the next frame.
window.MoneyMap = (() => {
'use strict';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// ---------- Content ----------
// The arrow holds four articles, one above the other. Each leads with a statement, then says its piece in paragraphs;
// [[words|id]] in a paragraph links those words to the smaller node `id`, which sits beside them. In any text, **…** is
// set in bold. A card's `links`: nodes it has doors to, drawn as small copies along its foot.
const PAPER = 'Carter, Vekhande & Fifita 2026';
// Screenshots from that report (published under CC BY 4.0), in the folder next to the page
const PICS_DIR = 'money-images/', CC = ', CC BY 4.0';
const TEN_K = 'Roblox 2025 annual report (10-K)';
const RBA = 'in A$ at the Reserve Bank rate on 16 Oct 2026';
const USD_PER_AUD = 0.6947; // Reserve Bank of Australia, 16 Oct 2026
const GAMES = {
  fisch: 'Fisch', ps99: 'Pet Simulator 99', sab: 'Steal a Brainrot', adopt: 'Adopt Me!', anime: 'Anime Simulator',
  war: 'War Tycoon', blade: 'Blade Ball', dti: 'Dress to Impress', gag: 'Grow a Garden', rivals: 'Rivals',
  nights: '99 Nights in the Forest', blox: 'Blox Fruits', jail: 'Jailbreak', asylum: 'Asylum Life', brook: 'Brookhaven',
};

const ARROW = {
  id: 'robux',
  say: 'Robux: about A$9.8 billion bought by players in 2025.',
  rows: [['s1'], ['s2'], ['s3'], ['s4']],
  kids: [
    { id: 's1', article: true, say: 'Roblox makes (almost) all of its money through Robux.',
      text: [
        'Robux is Roblox’s in-game currency. Players buy it with real money and can spend it on the Roblox platform in a variety of ways. In Australia, [[1,000 Robux costs A$16.99|buying]]. Selling Robux is Roblox’s only meaningful revenue stream: it brought in nearly A$10 billion in 2025.',
        'Robux can be used to buy a wide range of things. Researchers group what players buy by what it does for them: how it looks, what it lets you do, and how it makes you look to other players ([[Lehdonvirta 2009|lehdonvirta]]). Some of it is for looks, like clothes for your character; some unlocks things, like VIP areas or special powers; and much of it is a chance at something rare. Some of it saves you from losing: a study of 30 child-friendly Roblox games found paid respawns after death ([[Song et al. 2025|song]]), and in 99 Nights in the Forest, listed for ages 5 and up, dying wipes your progress unless you pay [[45 Robux to bring yourself back|revive]], with 25 seconds to decide. Under much of it is status. Roblox’s own guide for game makers says limited-time items give [[“prestige”|prestige]] to whoever gets them, and researchers find rare avatar items work as status symbols among children, much as luxury goods do offline ([[Kusmawan et al. 2026|kusmawan]]).',
        'Robux is also the currency in which Roblox [[pays its creators|paycreators]].',
      ],
      kids: [
        // how Roblox pays its creators: a node of its own, budding off the text, with its own notes budding off it
        { id: 'paycreators', article: true, scale: 0.4, say: 'Roblox pays its creators in Robux.',
          text: [
            'Once a creator has earned at least 30,000 Robux, they can [[exchange them for real money|cashout]] at about A$5.47 per 1,000, the same 1,000 a player pays A$16.99 for. Roblox says it has millions of creators, but only about 35,500 had qualified to cash out by the end of 2025, and 23,500 actually did. They were paid about A$2.16 billion between them, nearly nine-tenths of it to [[the top 1,000|top1000]], who averaged about A$1.9 million each. Over the year to June 2026, the median creator cashing out got about A$2,200.',
          ],
          kids: [
            { id: 'cashout', say: 'Creators can cash out only Robux they earned, and only once they have 30,000.',
              body: 'Creators must be at least 13, with a verified email and a tax form. 30,000 earned Robux cash out for about **A$164**. Robux that were bought, gifted or traded don’t count. Some sales to age-checked US adults earn more, about A$7.77 per 1,000. The rate rose 8.5% in September 2025.',
              src: 'Roblox Developer Exchange docs, ' + RBA },
            { id: 'top1000', say: 'A few creators earn most of what Roblox pays out.',
              body: '35,500 creators had qualified to cash out by the end of 2025, and 23,500 did. The top 1,000 averaged about **A$1.9 million** each, up over 50% on 2024: nearly nine-tenths of the A$2.16 billion paid out. Over the year to June 2026, the median creator cashing out got about **A$2,200**.',
              src: TEN_K + '; Roblox Q4 2025 shareholder letter; Roblox newsroom, 3 Sep 2026, ' + RBA },
          ] },
        { id: 'buying', say: 'In Australia, 1,000 Robux cost A$16.99.',
          body: 'On the website or with a gift card, 1,000 Robux cost **A$16.99** and 500 cost **A$8.49**. In the app, Roblox Premium costs **A$7.99 a month** for 450 Robux. A A$25 gift card buys a 1,000 pack and a 500 pack, leaving 48 cents that can’t be spent.',
          src: PAPER + ', p. 28; Apple App Store, Australia, Oct 2026' },
        { id: 'lehdonvirta', say: 'People buy virtual items for what they do, how they look, and what they say about them.',
          body: 'Vili Lehdonvirta sorts what makes people buy virtual items into three kinds of attributes: functional, like making a character faster or stronger; hedonic, like how an item looks; and social, above all the status of owning something rare.',
          link: 'https://doi.org/10.1007/s10660-009-9028-2', linkText: 'Read the paper ↗',
          src: 'Lehdonvirta, V. (2009). Virtual item sales as a revenue model: Identifying attributes that drive purchase decisions. Electronic Commerce Research, 9(1–2), 97–113' },
        { id: 'song', say: 'In Roblox games made for children, losing is often something you can pay to undo.',
          body: 'Researchers played 30 child-friendly Roblox games and found paid respawns after death, loot boxes, prize wheels, and leaderboards that tie spending to standing. In Rainbow Friends, a respawn costs more the further you get; in Break In (Story), a paid “Lucky Respawn” comes with a countdown.',
          link: 'https://www.usenix.org/conference/soups2025/presentation/song', linkText: 'Read the paper ↗',
          src: 'Song, Q., Zhang, Z., Hernandez, R. H., Gui, X., & Kou, Y. (2025). How predatory monetization designs manifest in child-friendly video games. Proceedings of SOUPS 2025, 515–534' },
        // quotes from the paper, not a summary of it (Parker, 2026-10-20)
        { id: 'kusmawan', say: '“In the virtual world of Roblox, the ownership of digital items has become a status symbol”',
          body: '“When children are able to show their digital identity through rare or exclusive items, they feel recognized by the community, so the intention to continue buying is very high.”',
          src: 'Kusmawan, J. A., Arifah, D., & Chitra, B. P. (2026). Tales more than just a game: Dissecting Roblox as a popular culture and digital social transformation. LingPoet: Journal of Linguistics and Literary Research, 7(1), 17–22, p. 20' },
        { id: 'revive', say: 'In 99 Nights in the Forest, a paid revive appears the moment you lose.',
          pics: [{ src: PICS_DIR + '99-nights-dead-self-revive.jpg', w: 900, h: 512 }, { src: PICS_DIR + '99-nights-self-revive-prompt.jpg', w: 504, h: 494 }],
          body: 'In 99 Nights in the Forest, dying sends you back to day 0. A 25-second countdown appears with a green Self-Revive button, and pressing it asks for **45 Robux**. Nothing makes clear it is a purchase rather than part of the game.',
          src: PAPER + ', pp. 12–13; screenshots from its Figure 11' + CC },
        { id: 'prestige', say: 'Roblox tells game makers that scarcity sells status.',
          pics: [{ src: PICS_DIR + '99-nights-days-survived.jpg', w: 900, h: 499 }, { src: PICS_DIR + '99-nights-top-days.jpg', w: 656, h: 758 }],
          body: 'Its guide says limited-time items “impart prestige” to whoever gets them. Games put status on show: 99 Nights displays days survived above each character and on a leaderboard, and in Steal a Brainrot status comes from owning rare characters.',
          src: PAPER + ', pp. 5, 9, 13; screenshots from its Figure 10' + CC },
      ] },

    { id: 's2', article: true, say: 'Roblox is mostly a game for children.',
      text: [
        'Roblox’s players are young. The last time Roblox published their ages, at the end of 2024, [[40% were under 13 and more than half were under 17|ages]]. In Australia, about [[1.7 million children aged 6 to 13|auskids]] play it, 61% of that age group, and the eSafety Commissioner calls it the second-most-popular game with Australian children. Those ages were the ones players typed in themselves. Roblox stopped publishing them at the end of 2025, while it moved to [[checking ages|agechecks]] with face scans and ID.',
        'Its older players are mostly young adults, and Roblox describes its audience as [[ageing up|ageingup]]. In 2022, 38% of its daily players were 17 or older, and 17-to-24-year-olds were its fastest-growing group. In 2023 it began allowing games for over-17s, behind an ID check.',
        'Adults matter to Roblox’s money. In the US, [[players over 18 spend more than 50% more each|adults]] than those under 18, and from June 2026 Roblox pays game makers more for what adults spend. But its shops are open to everyone. Apple’s Australian store now rates the Roblox app 16+ and lists loot boxes among its contents, yet many games inside it are listed for ages 5 and up.',
      ],
      kids: [
        { id: 'ages', fig: 'ages', say: 'Over half of Roblox players are under 17, and 40% are under 13.',
          bands: [['Under 9', 20], ['9–12', 20], ['13–16', 16], ['17–24', 25], ['25 and over', 19]], young: 3,
          body: 'These are the ages players gave themselves.',
          src: 'Statista, Roblox players by age, December 2024, also cited in ' + PAPER + ', p. 2' },
        { id: 'auskids', say: 'About 1.7 million Australian children aged 6 to 13 play Roblox.',
          body: 'That is 61% of the age group, from Roy Morgan’s survey of young Australians, April to December 2025. The eSafety Commissioner cited it in August 2026, calling Roblox “the second most popular game with children in Australia”, when Roblox agreed to change how adults could contact children on it.',
          src: 'Roy Morgan, 3 Mar 2026; eSafety Commissioner media release, 20 Aug 2026' },
        { id: 'agechecks', say: 'Roblox now checks ages before players can chat.',
          body: 'Checks by face scan or ID started in Australia, New Zealand and the Netherlands in December 2025 and went worldwide in January 2026.',
          src: 'Roblox Q4 2025 investor slides, p. 7' },
        { id: 'ageingup', say: 'Roblox has been chasing older players.',
          body: 'In 2022, 38% of daily players were 17 or older, and 17-to-24-year-olds were the fastest-growing group. In June 2023 Roblox began allowing games for over-17s, checked with ID and a selfie.',
          src: 'Roblox newsroom, June 2023' },
        { id: 'adults', say: 'Adults spend more each, so Roblox pays more for them.',
          body: 'In the US, over-18s spend over 50% more each than under-18s. From June 2026, creators get 37.8% instead of 26.6% of what age-checked US adults spend in their games.',
          src: 'Roblox Q1 2026 shareholder letter', links: ['steer'] },
      ] },

    { id: 's3', article: true, say: 'Roblox games use deceptive tactics.',
      text: [
        'In May 2026, researchers at the University of Sydney’s Games and Play Lab published [[a study of how Roblox games sell to children|study]]. They played 15 of Roblox’s top-earning games and recorded every purchase prompt.',
        'They found 14 kinds of misleading or deceptive design, and [[14 of the 15 games used at least one|grid]]. Some examples include:',
        '• Countdowns that pressure players to buy right now',
        '• Sales that never end',
        '• Prize wheels and loot boxes that [[show rare prizes far more often than they are won|odds]]',
        'Additionally, Roblox games hide prices behind in-game currencies, so a child can’t easily tell what anything costs in real money. Many of these tactics represent a kind of selling that consumer law, in Australia or overseas, already treats as misleading or aggressive.',
        'Worst of all, Roblox is not an innocent bystander. In fact, [[its own guides for game makers|guides]] recommend several of these manipulative tactics, such as showing a starter pack right after a player loses.',
      ],
      kids: [
        { id: 'study', say: 'Misleading and Deceptive Monetisation in Roblox',
          link: 'https://hdl.handle.net/2123/35033', linkText: 'Read the report ↗',
          src: 'Carter, M., Vekhande, S., & Fifita, A.-J. (2026). Misleading and deceptive monetisation in Roblox: Evidence of false pricing, manipulative design, and consumer harm in a children’s digital platform. Sydney Games and Play Lab, The University of Sydney' },
        { id: 'odds', say: 'Prize animations in Roblox games make rare prizes look likely.',
          body: 'Adopt Me!’s rarest owl comes 1 time in 40, but its rolling animation shows it as often as 1 in 8. Steal a Brainrot’s Mythic Box shows a 3% prize as often as a 37% one. Blade Ball’s prize wheel gives a 1% prize the same size slice as a 29% one.',
          src: PAPER + ', pp. 18–21' },
        { id: 'guides', say: 'Roblox’s own guides for game makers recommend deceptive tactics.',
          body: 'They tell game makers to pop up a starter pack when a player “lose[s] a match”, to sell limited-time items because they bring “prestige”, to sell chances at prizes, and to treat the share of players who pay as “one of the most important metrics”.',
          src: PAPER + ', pp. 4, 9, 12, 15' },
        { id: 'grid', fig: 'grid', say: 'Fourteen of the 15 top-earning Roblox games studied use at least one deceptive tactic.',
          games: ['fisch', 'ps99', 'sab', 'adopt', 'anime', 'war', 'blade', 'dti', 'gag', 'rivals', 'nights', 'blox', 'jail', 'asylum', 'brook'],
          rows: [
            { group: 'Pressure to buy now' },
            { t: 'Countdowns and “only so many left”', g: ['dti', 'gag', 'nights', 'sab', 'blox', 'fisch', 'adopt', 'rivals', 'war', 'jail', 'anime', 'ps99', 'blade'], guide: true },
            { t: 'Countdowns that aren’t real', g: ['gag'] },
            { t: 'Offers timed to a loss, like paying to revive', g: ['dti', 'nights', 'fisch', 'war', 'ps99'], guide: true },
            { t: 'Telling players outright to buy', g: ['adopt', 'war', 'jail', 'ps99'] },
            { group: 'Paying for a chance' },
            { t: 'Paid chances at a prize: eggs, crates, spins', g: ['dti', 'gag', 'nights', 'sab', 'blox', 'fisch', 'asylum', 'adopt', 'rivals', 'war', 'jail', 'anime', 'ps99', 'blade'], guide: true },
            { t: 'Animations that fake the odds', g: ['sab', 'adopt', 'war', 'ps99', 'blade'] },
            { t: 'Odds no one can work out', g: ['sab', 'fisch', 'anime', 'ps99'] },
            { t: 'Only the winners get announced', g: ['fisch', 'ps99'] },
            { group: 'Prices that hide the cost' },
            { t: 'Sales that never end', g: ['sab', 'anime', 'blade'] },
            { t: 'Made-up “worth” prices', g: ['sab', 'fisch', 'rivals', 'ps99', 'blade'] },
            { t: 'Three or more currencies', g: ['dti', 'nights', 'fisch', 'adopt', 'rivals', 'war', 'anime', 'ps99'], guide: true },
            { group: 'Left out' },
            { t: 'What it does shown only after paying', g: ['dti', 'gag', 'sab', 'fisch', 'adopt', 'rivals', 'anime'] },
            { t: 'Rewards promised that are only a chance', g: ['blox', 'fisch', 'adopt', 'ps99'] },
          ],
          src: 'Dots follow the table in ' + PAPER + ' (p. 32), plus tactics its text describes in a game (pp. 4–28). Roblox’s guides: pp. 4, 9, 11–12, 15, 25.' },
      ] },

    { id: 's4', article: true, say: 'Regulators aren’t keeping up with Roblox games.',
      text: [
        'Laws against most of these tactics [[already exist|laws]]. Australian Consumer Law bans false claims about price, like a “sale” that never ends. But the researchers say Roblox games have had little attention. [[The ACCC has taken Coles and Woolworths to court|accc]] over misleading discounts, while the same kind of pricing in Roblox games happens, in the study lead’s words, “with far less oversight”.',
        'Australia even has legislation aimed at the in-game purchase practices of contemporary video games. Since September 2024, games that sell loot boxes for real money are meant to be rated M for 15 and over. Yet [[half the games in the study that had them still sold them to Australian players|lootaus]], in games listed for ages as young as 5.',
        'Australians are also entitled to a refund for things that aren’t as described. When the researchers bought a loot box on an account set to age 12 and [[asked for their money back|refund]], Apple, Roblox and the game’s makers all separately turned them away.',
        'Families and reporters have [[been raising the alarm for years|timeline]]. But [[regulators are only just beginning to act|goodwill]]. In Australia, the researchers are urging the ACCC to look into Roblox games.',
      ],
      kids: [
        // Gorwa's line on leaving it to the platforms (Parker, 2026-10-20)
        { id: 'goodwill', say: '“Voluntary arrangements rely on goodwill and provide limited recourse in the case of non-compliance.”',
          src: 'Gorwa, R. (2019). What is platform governance? Information, Communication & Society, 22(6), 854–871, p. 863' },
        { id: 'laws', say: 'Laws against deceptive selling are already on the books.',
          body: 'Australian Consumer Law section 29 bans false or misleading claims about price, and its consumer guarantees promise a refund for things not as described. The EU banned telling children directly to buy in 2005 and set principles for game currencies in 2025. Canada’s Competition Act bans fake deadlines and misleading claims.',
          src: PAPER + ', pp. 6, 10–11, 23–24, 26, 29' },
        { id: 'accc', say: 'The ACCC has acted on fake discounts, in supermarkets.',
          body: 'It took Coles and Woolworths to court over discounts that weren’t real. The study’s lead author, Professor Marcus Carter, says the same kind of pricing in Roblox games happens with far less oversight.',
          src: 'University of Sydney news, 17 May 2026; ACS Information Age, 19 May 2026' },
        { id: 'lootaus', say: 'Australian researchers have identified an abundance of games on Roblox evading the rating system.',
          body: 'Since September 2024, games with paid loot boxes are meant to be rated M for 15 and over. Of the 14 games with loot boxes in the USYD study, six had worked around the rule and seven blatantly ignored it. One of the games, Adopt Me!, is listed for ages 5 and up.',
          src: PAPER + ', pp. 16, 30' },
        { id: 'refund', fig: 'steps', say: 'Once bought, Robux can’t be got back.',
          body: 'Researchers bought Adopt Me!’s starter pack, **89 Robux (A$1.87)**, on an account set to age 12. It held a random-pet egg, which Australian rules say is for 15 and over. Then they asked for a refund.',
          steps: ['Apple said no.', 'Roblox said to ask the game’s makers, and wait 15 days.', 'The makers’ support needed a parent’s face scan and passport, then was only a chatbot.', 'Roblox stopped replying.'],
          src: PAPER + ', pp. 29–30' },
        { id: 'timeline', fig: 'timeline', say:'Families and reporters have raised the alarm since 2018. Regulators are only now moving.',
          law: 'Already law: the EU bans telling children to buy (2005), Australia bans false price claims (2010), and Canada bans fake deadlines.',
          from: 2018, to: 2027,
          alarm: [
            { t: 2018.45, when: 'Jun 2018 · 6abc (US)', say: 'A fake free-Robux offer puts US$89.99 on a grandmother’s phone bill.', link: 'https://6abc.com/video-games-roblox-robux-fortnight/3603994/' },
            { t: 2021.34, au: true, when: 'May 2021 · ABC Four Corners', say: '“Are you being played?” Roblox steers a 13-year-old toward buying Robux.', link: 'https://www.abc.net.au/news/2021-05-03/are-you-being-played/13327478' },
            { t: 2021.63, when: 'Aug 2021 · NME', say: 'Roblox pays its young creators in hard-to-cash currency, says People Make Games.', link: 'https://www.nme.com/news/gaming-news/roblox-is-allegedly-exploiting-young-game-developers-3024548' },
            { t: 2023.64, when: 'Aug 2023 · Tubefilter', say: 'Parents sue, saying Roblox profits from sites where children gamble Robux.', link: 'https://www.tubefilter.com/2023/08/21/roblox-lawsuit-gambling-sites/' },
            { t: 2024.96, when: 'Dec 2024 · Sky News', say: 'Unlicensed casinos let children gamble Robux with a Roblox login.', link: 'https://news.sky.com/story/illegal-casinos-are-using-roblox-to-draw-children-into-online-gambling-13273519' },
            { t: 2025.22, au: true, when: 'Mar 2025 · The Conversation', say: 'Children call Roblox loot boxes “literally just child gambling”.', link: 'https://theconversation.com/literally-just-child-gambling-what-kids-say-about-roblox-lootboxes-and-money-in-online-games-250387' },
            { t: 2025.29, au: true, when: 'Apr 2025 · ABC News', say: 'A 17-year-old complains about gambling-like games; Roblox says it can do nothing.', link: 'https://www.abc.net.au/news/2025-04-17/childrens-video-games-addictive-features-gaming-report/105136744' },
            { t: 2026.37, au: true, when: 'May 2026 · University of Sydney', say: 'Researchers find deceptive selling in 14 of 15 top games.', link: 'https://www.sydney.edu.au/news-opinion/news/2026/05/17/inside-the-pay-to-play-world-of-roblox-targeting-children-.html' },
          ],
          regs: [
            { t: 2022.97, when: 'Dec 2022 · United States', say: 'Fortnite’s maker must refund about A$350 million over confusing purchase buttons.' },
            { t: 2024.72, au: true, when: 'Sep 2024 · Australia', say: 'Games with paid loot boxes are rated M, for 15 and over.' },
            { t: 2025.22, when: 'Mar 2025 · European Union', say: 'Consumer authorities set principles for game currencies: show the real price.' },
            { t: 2026.37, au: true, when: 'May 2026 · Australia', say: 'The University of Sydney study asks the consumer watchdog, the ACCC, to look at Roblox games.' },
          ],
          src: 'News as dated; US Federal Trade Commission, Dec 2022 (US$245 million, ' + RBA + '); ' + PAPER + ', pp. 8, 10–11, 16, 23–24, 30' },
      ] },
  ],
};

// Out: where the money goes. Values are Roblox's 2025 figures in US$ millions, shown in Australian dollars. Costs
// are the 10-K's lines with the pay in shares taken out; app store fees are cost of revenue plus the fees paid in
// 2025 but held over to be counted later.
const TOTAL = 6788;
const OUT = [
  { id: 'fees', key: 'fees', v: 1404, say: 'Apple, Google and other payment companies take 21¢ of every dollar.',
    src: TEN_K + ', ' + RBA },
  { id: 'creators', key: 'creators', v: 1503, say: 'Creators get 22¢ of every dollar.',
    about: 'Paid out as real money through the Developer Exchange, to creators who have earned at least 30,000 Robux.', src: TEN_K + ', ' + RBA,
    kids: [
      { id: 'top', v: 1300, approx: true, say: 'The top 1,000 creators get most of the creators’ share, about A$1.9 million each.',
        src: 'Roblox Q4 2025 shareholder letter, ' + RBA },
      { id: 'others', v: 203, approx: true, say: 'About 22,500 creators outside the top 1,000 share the rest.',
        src: TEN_K + ', ' + RBA },
    ] },
  { id: 'running', key: 'running', v: 2418, say: 'Running Roblox takes 36¢.',
    src: TEN_K + ', ' + RBA,
    kids: [
      { id: 'servers', v: 1011, say: 'Servers, safety and support take 15¢.',
        src: TEN_K + ', ' + RBA },
      { id: 'eng', v: 804, say: 'Engineers and designers take 12¢.',
        src: TEN_K + ', ' + RBA },
      { id: 'admin', v: 408, say: 'Legal, finance and HR take 6¢.',
        src: TEN_K + ', ' + RBA },
      { id: 'mkt', v: 196, say: 'Marketing and advertising take 3¢.',
        src: TEN_K + ', ' + RBA },
    ] },
  { id: 'kept', key: 'kept', v: 1463, say: '21¢ of every dollar is left over.',
    src: TEN_K + ', ' + RBA },
];
// Beside the creators' arrows
const STEER = { id: 'steer', say: 'Roblox steers what gets built by choosing what it pays creators for.',
  body: 'In 2025 Roblox raised what it pays per earned Robux by 8.5%. It also stopped paying creators for the time Premium subscribers spent in their games, and began paying for numbers it says drive engagement and spending, like bringing in new or returning players who buy Robux. However, from June 2026, it began paying more for Robux spent by age-checked US adults: 37.8% of each dollar instead of 26.6%.',
  src: TEN_K + '; Roblox Developer Forum, Jul 2025; Roblox Q1 2026 shareholder letter', links: ['creators', 'adults'] };

// Doors run both ways: a card a door leads to gets a door back
{
  const all = new Map();
  const walk = n => { all.set(n.id, n); (n.kids || []).forEach(walk); };
  walk(ARROW); walk(STEER);
  for (const n of [...all.values()]) for (const id of n.links || []) {
    const t = all.get(id);
    if (t && !t.kids && !t.fig) { t.links = t.links || []; if (!t.links.includes(n.id)) t.links.push(n.id); }
  }
}

// Colours the page may not define, as on the standalone page in light mode
const FALLBACK = { ground: '#F2E9DD', card: '#FFF8F0', ink: '#1B263F', 'ink-soft': '#55627A', rule: '#C7B8A3', line: '#3F6FA3',
  local: '#2E7A57', fees: '#6D4FC0', creators: '#D0602A', running: '#00927F', kept: '#B58300' };
// ---------- Theme + type ----------
const T = {};
function readTheme() {
  const cs = getComputedStyle(document.documentElement);
  for (const k of ['ground', 'card', 'ink', 'ink-soft', 'rule', 'line', 'local', 'fees', 'creators', 'running', 'kept']) T[k] = cs.getPropertyValue('--' + k).trim() || FALLBACK[k];
  T.flowA = parseFloat(cs.getPropertyValue('--flow-a')) || 0.32;
  T.arrowA = parseFloat(cs.getPropertyValue('--arrow-a')) || 0.16;
  T.title = cs.getPropertyValue('--font-title').trim() || 'serif';
  T.body = cs.getPropertyValue('--font-body').trim() || 'sans-serif';
}
readTheme();
const mctx = document.createElement('canvas').getContext('2d');
const font = (wt, px, fam, it) => `${it ? 'italic ' : ''}${wt} ${px}px ${fam}`;
const unitCache = new Map();
function unitW(text, wt, fam, it) {
  const key = wt + '|' + fam + '|' + (it ? 1 : 0) + '|' + text;
  let v = unitCache.get(key);
  if (v == null) {
    if (window.PathText) v = window.PathText.width(text, wt, fam, it);
    else { mctx.font = font(wt, 100, fam, it); v = mctx.measureText(text).width / 100; }
    unitCache.set(key, v);
  }
  return v;
}
// Text as words, each a list of runs. **…** marks bold; [[…|id]] marks a link (bold, in the link colour) to node id.
// In an article, a paragraph starting '• ' is a point in a list: indented, its bullet hanging before it, and closer to
// the point before it.
// Punctuation straight after a marked run stays joined to it.
function segments(text) {
  const out = [], re = /\[\[([^|\]]+)\|([^|\]]+)(?:\|([^\]]+))?\]\]/g;
  const plain = s => s.split('**').forEach((p, i) => out.push({ s: p, b: i % 2 === 1 }));
  let last = 0, m;
  while ((m = re.exec(text))) { plain(text.slice(last, m.index)); out.push({ s: m[1], b: true, ln: m[2], num: m[3] }); last = re.lastIndex; }
  plain(text.slice(last));
  return out;
}
function words(text) {
  const out = [];
  let open = true; // whether the text so far ends in a space
  for (const seg of segments(text)) {
    if (!seg.s) continue;
    const glue = !open && !/^\s/.test(seg.s) && out.length;
    seg.s.split(/\s+/).filter(Boolean).forEach((w, j) => {
      const r = { s: w, b: seg.b, ln: seg.ln };
      if (j === 0 && glue) out[out.length - 1].push(r); else out.push([r]);
    });
    // a link's number rides, small and raised, on its last word
    if (seg.num) out[out.length - 1].push({ s: seg.num, b: true, ln: seg.ln, sup: true });
    open = /\s$/.test(seg.s);
  }
  return out;
}
// A text block: lines of runs laid out in world units, offsets from its node's top-left.
// align: 'left' (default), 'center' or 'right' within maxW.
function block(text, o) {
  const wt = o.wt, fam = o.fam, it = o.it, size = o.size;
  const runW = r => unitW(r.s, r.b ? 700 : wt, fam, it) * size * (r.sup ? 0.62 : 1) + (r.sup ? size * 0.08 : 0);
  const space = unitW(' ', wt, fam, it) * size;
  const lines = [];
  let cur = null;
  const add = (w, x) => { for (const r of w) { const rw = runW(r); cur.runs.push({ s: r.s, b: r.b, ln: r.ln, sup: r.sup, x, w: rw }); x += rw; } cur.w = x; };
  for (const w of words(text)) {
    const ww = w.reduce((a, r) => a + runW(r), 0);
    if (cur && cur.w + space + ww <= o.maxW) add(w, cur.w + space);
    else { if (cur) lines.push(cur); cur = { runs: [], w: 0 }; add(w, 0); }
  }
  if (cur) lines.push(cur);
  return { lines, size, lh: size * (o.lh || 1.3), wt, fam, it, color: o.color, dx: 0, dy: 0, maxW: o.maxW, align: o.align || 'left' };
}
const heightOf = b => b.lines.length * b.lh;
const widthOf = b => Math.max(0, ...b.lines.map(l => l.w));
const SANS = (size, o = {}) => ({ wt: 400, fam: T.body, size, color: 'ink', lh: 1.36, ...o });
const SERIF = (size, o = {}) => ({ wt: 700, fam: T.title, size, color: 'ink', lh: 1.12, ...o });
// A statement as big as it can be: the largest size up to `max` that fits the width in `maxLines` lines
function fitHead(text, maxW, max, min, maxLines) {
  for (let s = max; s >= min; s *= 0.97) {
    const b = block(text, SERIF(s, { maxW, lh: 1.1 }));
    if (b.lines.length <= maxLines && b.lines.every(l => l.w <= maxW + 0.01)) return b;
  }
  return block(text, SERIF(min, { maxW, lh: 1.1 }));
}

// ---------- Layout ----------
const CW = 460;
const BUD = { w: 72, h: 50, g: 10 };
// Boxes by depth: the arrow, then each step in smaller. pad, the statement's largest size, the gap between members.
// The arrow's statement and its articles' statements are big enough to read with the whole map on screen.
const BOX = [
  { pad: 220, head: 640, min: 300, gap: 110 },
  { pad: 170, head: 470, min: 280, gap: 110 },
  { pad: 46, head: 96, min: 60, gap: 46 },
  { pad: 34, head: 56, min: 40, gap: 28 },
];
const BYID = new Map();
const mark = (n, m) => (n.marks.push(m), m);
// Pictures (screenshots), each loaded once, with a 64-pixel-wide copy for drawing small. When one arrives, the page is
// told to redraw with a 'moneymap-change' event.
const PICS = new Map();
function pic(src) {
  let p = PICS.get(src);
  if (!p) {
    p = new Image(); p.decoding = 'async';
    p.onload = () => {
      const c = document.createElement('canvas');
      c.width = 64; c.height = Math.max(1, Math.round(64 * p.naturalHeight / p.naturalWidth));
      c.getContext('2d').drawImage(p, 0, 0, c.width, c.height); p.thumb = c;
      window.dispatchEvent(new Event('moneymap-change'));
    };
    p.src = src; PICS.set(src, p);
  }
  return p;
}
// A card: a statement, its pictures if it has any (side by side at one height, filling the width), a few lines under
// them, and its doors along its foot. k scales its type.
function layoutCard(n, w, k = 1) {
  n.kind = 'card'; n.w = w; n.blocks = []; n.marks = [];
  const pad = 24 * k, iw = w - pad * 2;
  let y = pad;
  const put = (b, after) => { b.dx = pad; b.dy = y; n.blocks.push(b); y += heightOf(b) + after; return b; };
  const bx = badge(n, pad, pad, 30 * k);
  n.attachY = pad + 30 * k * 0.55; // the middle of its number, where a line from linked words ends
  const say = put(block(n.say, SERIF(30 * k, { maxW: iw - bx, lh: 1.14 })), 12 * k);
  say.dx += bx;
  if (n.pics) {
    const gap = 10 * k, ph = (iw - gap * (n.pics.length - 1)) / n.pics.reduce((a, p) => a + p.w / p.h, 0);
    let x = pad;
    for (const p of n.pics) { const pw = ph * p.w / p.h; mark(n, { t: 'img', src: p.src, x, y, w: pw, h: ph, r: 6 * k }); pic(p.src); x += pw + gap; }
    y += ph + 14 * k;
  }
  if (n.body) put(block(n.body, SANS(21 * k, { maxW: iw, lh: 1.4 })), 10 * k);
  if (n.link) put(block(n.linkText || 'Read the story ↗', SANS(19 * k, { wt: 700, maxW: iw, color: 'line', lh: 1.3 })), 8 * k).href = n.link;
  if (n.src) put(block(n.src, SANS(16 * k, { it: true, maxW: iw, color: 'ink-soft', lh: 1.25 })), 10 * k);
  // drawn small, the card's words become two blocks: one where its statement is, one over all its other lines
  say.role = 'say';
  const rest = n.blocks.filter(b => !b.role);
  n.low = { say: [say.dx, say.dy, widthOf(say), heightOf(say)] };
  if (rest.length) {
    const y0 = Math.min(...rest.map(b => b.dy)), y1 = Math.max(...rest.map(b => b.dy + heightOf(b)));
    n.low.rest = [pad, y0, Math.max(...rest.map(widthOf)), y1 - y0];
  }
  n.slots = [];
  const links = n.links || [];
  if (links.length) {
    const per = Math.max(1, Math.floor((iw + BUD.g * k) / ((BUD.w + BUD.g) * k)));
    links.forEach((id, i) => n.slots.push({ id, x: pad + (i % per) * (BUD.w + BUD.g) * k, y: y + Math.floor(i / per) * (BUD.h + BUD.g) * k, w: BUD.w * k, h: BUD.h * k }));
    y += Math.ceil(links.length / per) * (BUD.h + BUD.g) * k;
  }
  n.h = y + pad - 10 * k;
}

// Figures: a card whose body is a chart, a list, a grid or a timeline, drawn with marks (shapes, in the figure's own
// units) and text blocks, so it zooms like everything else. Each takes the width it is given.
const FIG = {};
// The number a node wears when a link leads to it: a small disc at (x, y), sized to the type beside it; returns the
// room it takes, so the statement can start after it
function badge(n, x, y, size) {
  if (!n.badge) return 0;
  const r = size * 0.62;
  mark(n, { t: 'circle', x: x + r, y: y + size * 0.55, r, fill: 'line', role: 'badge' });
  const b = block(String(n.badge), SANS(size * 0.78, { wt: 700, maxW: r * 2, color: 'ground', align: 'center', lh: 1 }));
  b.dx = x; b.dy = y + size * 0.55 - size * 0.39; b.role = 'badge'; n.blocks.push(b);
  return r * 2 + size * 0.4;
}
function figStart(n, w, sayK = 1) {
  n.kind = 'fig'; n.w = w; n.blocks = []; n.marks = []; n.slots = [];
  const pad = 28 * sayK, iw = w - pad * 2;
  const put = (b, x, y) => { b.dx = x; b.dy = y; n.blocks.push(b); return b; };
  const bx = badge(n, pad, pad, 30 * sayK);
  n.attachX = pad + 30 * sayK * 0.62; n.attachY = pad + 30 * sayK * 0.55; // the middle of its number
  const say = put(block(n.say, SERIF(30 * sayK, { maxW: iw - bx, lh: 1.14 })), pad + bx, pad);
  return { pad, iw, put, k: sayK, y: pad + heightOf(say) + 24 * sayK };
}
function figEnd(n, f, y) {
  if (n.src) { const b = f.put(block(n.src, SANS(16 * f.k, { it: true, maxW: f.iw, color: 'ink-soft', lh: 1.25 })), f.pad, y + 18 * f.k); y += 18 * f.k + heightOf(b); }
  n.h = y + f.pad;
}
// Numbered steps
FIG.steps = (n, W) => {
  const f = figStart(n, W || 720);
  let y = f.y;
  const intro = f.put(block(n.body, SANS(20, { maxW: f.iw, color: 'ink-soft' })), f.pad, y); y += heightOf(intro) + 22;
  n.steps.forEach((s, i) => {
    const r = 22, tx = f.pad + r * 2 + 18;
    const b = block(s, SANS(22, { maxW: f.iw - (tx - f.pad), lh: 1.3 }));
    const h = Math.max(r * 2, heightOf(b));
    mark(n, { t: 'circle', x: f.pad + r, y: y + r, r, fill: 'ink' });
    f.put(block(String(i + 1), SANS(22, { wt: 700, maxW: r * 2, color: 'ground', align: 'center', lh: 1 })), f.pad, y + r - 11);
    f.put(b, tx, y + (h - heightOf(b)) / 2);
    y += h + 16;
  });
  figEnd(n, f, y - 16);
};
// The section graphics sit a step below the text in size: their statements and labels are set by MID.
const MID = 1.8;
// A column per age group; the young ones dark, the rest light, with the young ones' total above them
FIG.ages = (n, W) => {
  const f = figStart(n, W || 3200, MID), cols = n.bands.length, cw = f.iw / cols, bw = cw * 0.58, maxV = 25, hMax = 620;
  const top = f.y + 170, base = top + hMax;
  const young = n.bands.slice(0, n.young).reduce((a, b) => a + b[1], 0);
  n.bands.forEach(([label, v], i) => {
    const x = f.pad + i * cw + (cw - bw) / 2, h = v / maxV * hMax, isYoung = i < n.young;
    mark(n, { t: 'rect', x, y: base - h, w: bw, h, r: 12, fill: isYoung ? 'ink' : 'rule', a: 1, flatBottom: true });
    f.put(block(v + '%', SANS(52, { wt: 700, maxW: cw, align: 'center', lh: 1.1 })), f.pad + i * cw, base - h - 70);
    f.put(block(label, SANS(42, { maxW: cw, align: 'center', color: 'ink-soft', lh: 1.2 })), f.pad + i * cw, base + 20);
  });
  mark(n, { t: 'line', x0: f.pad, y0: base, x1: f.pad + f.iw, y1: base, lw: 4, color: 'ink-soft' });
  // the bracket over the young groups
  const bx0 = f.pad + (cw - bw) / 2, bx1 = f.pad + (n.young - 1) * cw + (cw + bw) / 2, byT = top - 60;
  mark(n, { t: 'line', x0: bx0, y0: byT + 26, x1: bx0, y1: byT, lw: 5, color: 'ink' });
  mark(n, { t: 'line', x0: bx0, y0: byT, x1: bx1, y1: byT, lw: 5, color: 'ink' });
  mark(n, { t: 'line', x0: bx1, y0: byT, x1: bx1, y1: byT + 26, lw: 5, color: 'ink' });
  f.put(block('Under 17: ' + young + '%', SERIF(56, { maxW: bx1 - bx0, align: 'center', lh: 1 })), bx0, byT - 76);
  let y = base + 100;
  const b = f.put(block(n.body, SANS(38, { maxW: f.iw, color: 'ink-soft' })), f.pad, y); y += heightOf(b);
  figEnd(n, f, y);
};
// The checklist grid: a row per tactic, a column per game, a dot where the game uses it; a last column marks the
// tactics Roblox's own guides recommend, and the foot counts each game's tactics
FIG.grid = (n, W) => {
  const guideW = 320, rowH = 92, groupH = 124, headH = 560, natural = 2 * 28 * MID + 950 + 122 * n.games.length + guideW;
  const f = figStart(n, Math.max(natural, W || 0), MID);
  let y = f.y + headH;
  // spare width widens the columns up to a point, then the tactic names
  const colW = Math.min(150, 122 + (f.iw - (natural - 56 * MID)) / n.games.length), labelW = f.iw - colW * n.games.length - guideW;
  const gx = i => f.pad + labelW + i * colW + colW / 2, guideX = f.pad + labelW + colW * n.games.length + guideW / 2;
  // game names, slanted, standing on the top of the grid
  n.games.forEach((g, i) => mark(n, { t: 'rtext', s: GAMES[g], x: gx(i) - 8, y: y - 24, ang: -Math.PI * 0.36, size: 44, wt: 600, color: 'ink' }));
  mark(n, { t: 'rtext', s: 'Roblox’s guide recommends', x: guideX - 8, y: y - 24, ang: -Math.PI * 0.36, size: 42, wt: 700, color: 'line' });
  const used = Object.fromEntries(n.games.map(g => [g, 0]));
  let stripe = 0;
  for (const r of n.rows) {
    if (r.group) {
      y += 20;
      f.put(block(r.group, SERIF(54, { maxW: labelW, lh: 1 })), f.pad, y + groupH - 78);
      mark(n, { t: 'line', x0: f.pad, y0: y + groupH, x1: f.pad + f.iw, y1: y + groupH, lw: 4, color: 'ink-soft' });
      y += groupH; stripe = 0;
      continue;
    }
    if (stripe++ % 2) mark(n, { t: 'rect', x: f.pad, y, w: f.iw, h: rowH, r: 0, fill: 'rule', a: 0.22 });
    f.put(block(r.t, SANS(42, { maxW: labelW - 30, lh: 1.15 })), f.pad + 16, y + (rowH - 42 * 1.15) / 2);
    n.games.forEach((g, i) => {
      if (r.g.includes(g)) { used[g]++; mark(n, { t: 'circle', x: gx(i), y: y + rowH / 2, r: 25, fill: 'ink' }); }
      else mark(n, { t: 'circle', x: gx(i), y: y + rowH / 2, r: 7, fill: 'rule' });
    });
    if (r.guide) mark(n, { t: 'circle', x: guideX, y: y + rowH / 2, r: 27, fill: 'line' });
    y += rowH;
  }
  mark(n, { t: 'line', x0: f.pad, y0: y, x1: f.pad + f.iw, y1: y, lw: 4, color: 'ink-soft' });
  y += 24;
  f.put(block('Tactics each game uses', SANS(38, { wt: 700, maxW: labelW - 30, color: 'ink-soft', lh: 1.15 })), f.pad + 16, y + 8);
  n.games.forEach((g, i) => f.put(block(String(used[g]), SANS(46, { wt: 700, maxW: colW, align: 'center', lh: 1.1 })), gx(i) - colW / 2, y + 2));
  y += 84;
  figEnd(n, f, y);
};
// The timeline: years along a line; the alarm above it, regulators below, each event a dot with its words beside it.
// Each event's words take the first free row on their side of the line, going outward; near the right end they sit
// to the left of their dot.
FIG.timeline = (n, W) => {
  const f = figStart(n, Math.max(3200, W || 0), MID), stubW = 520;
  let y0 = f.y;
  const law = f.put(block(n.law, SANS(38, { maxW: f.iw, color: 'ink-soft' })), f.pad, y0); y0 += heightOf(law) + 60;
  const ax0 = f.pad + stubW + 60, ax1 = f.pad + f.iw - 30, tx = t => ax0 + (t - n.from) / (n.to - n.from) * (ax1 - ax0);
  const labW = 560, levelGap = 34;
  function lane(events) {
    const rows = [];
    const placed = events.map(e => {
      const lb = [block(e.when, SANS(32, { wt: 700, maxW: labW, color: e.au ? 'local' : 'ink-soft', lh: 1.25 })), block(e.say, SANS(40, { maxW: labW, lh: 1.3 }))];
      if (e.link) lb.push(block('Read the story ↗', SANS(32, { wt: 700, maxW: labW, color: 'line', lh: 1.3 })));
      const h = lb.reduce((a, b) => a + heightOf(b), 0) + 10 * (lb.length - 1);
      const d = tx(e.t), x = d + 18 + labW > ax1 + 80 ? d - 18 - labW : d + 18;
      let row = 0;
      while ((rows[row] || []).some(([a, b]) => x < b + 40 && x + labW > a - 40)) row++;
      (rows[row] = rows[row] || []).push([x, x + labW]);
      return { e, lb, h, x, row };
    });
    const rowH = Math.max(...placed.map(p => p.h)) + levelGap;
    return { placed, rowH, rows: rows.length };
  }
  const A = lane(n.alarm), R = lane(n.regs);
  const axisY = y0 + 40 + A.rows * A.rowH;
  f.put(block('Families and reporters', SERIF(50, { maxW: stubW, lh: 1.1 })), f.pad, axisY - 150);
  f.put(block('Regulators', SERIF(50, { maxW: stubW, lh: 1.1 })), f.pad, axisY + 60);
  // the line and its years
  mark(n, { t: 'line', x0: ax0, y0: axisY, x1: ax1, y1: axisY, lw: 5, color: 'ink-soft' });
  for (let yr = n.from; yr < n.to; yr++) {
    mark(n, { t: 'line', x0: tx(yr), y0: axisY - 18, x1: tx(yr), y1: axisY + 18, lw: 4, color: 'ink-soft' });
    f.put(block(String(yr), SANS(40, { wt: 700, maxW: 160, color: 'ink-soft', align: 'center', lh: 1 })), (tx(yr) + tx(yr + 1)) / 2 - 80, axisY + 24);
  }
  const topOf = (L, p, dir) => dir < 0 ? axisY - 70 - (p.row + 1) * L.rowH + levelGap : axisY + 100 + p.row * L.rowH;
  // stems first, so each event's words sit on a plate over any stem that passes behind them
  for (const [L, dir] of [[A, -1], [R, 1]]) for (const p of L.placed) {
    const x = tx(p.e.t), top = topOf(L, p, dir);
    mark(n, { t: 'line', x0: x, y0: axisY, x1: x, y1: dir < 0 ? top + p.h : top, lw: 3, color: 'rule' });
    mark(n, { t: 'circle', x, y: axisY, r: 18, fill: dir < 0 ? 'ink' : 'line' });
  }
  for (const [L, dir] of [[A, -1], [R, 1]]) for (const p of L.placed) {
    const top = topOf(L, p, dir);
    mark(n, { t: 'rect', x: p.x - 14, y: top - 12, w: labW + 28, h: p.h + 24, r: 10, fill: 'self' });
    let yy = top;
    p.lb.forEach((b, i) => { const pb = f.put(b, p.x, yy); if (i === 2) pb.href = p.e.link; yy += heightOf(b) + 10; });
  }
  figEnd(n, f, axisY + 100 + R.rows * R.rowH);
};
function layoutFig(n, width) { FIG[n.fig](n, width); }
// A figure shrunk by z: every size and position in it, its type and strokes too, so it keeps its look at a smaller size
function scaleFig(n, z) {
  n.w *= z; n.h *= z; n.attachX *= z; n.attachY *= z;
  for (const b of n.blocks) {
    b.dx *= z; b.dy *= z; b.size *= z; b.lh *= z; b.maxW *= z;
    for (const l of b.lines) { l.w *= z; for (const r of l.runs) { r.x *= z; r.w *= z; } }
  }
  for (const m of n.marks) for (const k of ['x', 'y', 'w', 'h', 'r', 'x0', 'y0', 'x1', 'y1', 'lw', 'size']) if (m[k] != null) m[k] *= z;
}

// An article: its statement across the top, its paragraphs in one column, and each node a link leads to beside the
// line that links to it. An article with a graphic (a figure wider than two columns of notes) puts its notes and text
// against the left edge and gives the graphic the rest of the width, top-aligned with the text and never taller than
// it; one without a graphic has its text in the middle and notes on both sides. Each side holds as many columns of notes as fit; a node goes in the slot that lets it sit
// nearest its line, preferring the column next to the text and the side of the line its link is on. A node too wide
// for a side goes under the text. A line joins each node to the words that link to it. n.scale shrinks the whole
// article, for one that buds off another.
const ART = { text: 2600, size: 64, paraGap: 56, note: 760, noteK: 1.15, gapX: 160, gapY: 50, colGap: 50, outer: 400 };
function layoutArticle(n, depth, width) {
  const L = BOX[Math.min(depth, 3)], z = n.scale || 1;
  n.kind = 'box'; n.depth = depth; n.blocks = []; n.marks = []; n.cx = 0; n.cy = 0;
  // number the links in the order they first appear
  const nums = new Map();
  const text = n.text.map(p => p.replace(/\[\[([^|\]]+)\|([^|\]]+)\]\]/g, (m, words, id) => {
    if (!nums.has(id)) nums.set(id, nums.size + 1);
    return '[[' + words + '|' + id + '|' + nums.get(id) + ']]';
  }));
  n.kids.forEach(k => { k.badge = nums.get(k.id); });
  let T = ART.text * z;
  const gapX = ART.gapX * z, gapY = ART.gapY * z, colGap = ART.colGap * z, noteW = ART.note * z;
  n.kids.forEach(k => k.article || k.fig ? layoutMember(k, depth + 1) : layoutCard(k, noteW, ART.noteK * z));
  const twoCols = 2 * noteW + colGap;
  const gfx = n.kids.find(k => k.fig && k.w > twoCols) || null, buds = n.kids.filter(k => k !== gfx);
  // a side of notes is as wide as the widest node that fits two columns of notes, and never narrower than one note
  const sideW = Math.max(noteW, ...buds.filter(k => k.w <= twoCols * 1.25).map(k => k.w));
  const iw = Math.max(width ? width - 2 * L.pad : 0, gfx ? sideW + 2 * gapX + T + twoCols : T + 2 * (gapX + sideW));
  const colsIn = room => Math.max(1, Math.floor((room + colGap) / (noteW + colGap)));
  const BULLET = /^•\s+/, ind = ART.size * z * 1.1;
  const para = (p, w) => BULLET.test(p) ? block(p.replace(BULLET, ''), SANS(ART.size * z, { maxW: w - ind, lh: 1.5 }))
    : block(p, SANS(ART.size * z, { maxW: w, lh: 1.5 }));
  const gapAt = i => i === 0 ? 0 : BULLET.test(text[i]) && BULLET.test(text[i - 1]) ? ART.paraGap * z * 0.25 : ART.paraGap * z;
  const tallAt = w => text.reduce((a, p, i) => a + gapAt(i) + heightOf(para(p, w)), 0);
  let tx, sideRoom, cols, gfxRoom = 0;
  if (gfx) {
    // The graphic is as large as the width left after the notes and the text, and the text's height, allow, up to its
    // full size. A few text widths and graphic widths are tried (a wider timeline needs fewer rows, so it is shorter),
    // keeping the pair that gives the largest graphic, and the wider text unless a narrower one makes it clearly larger.
    const sizes = new Map(), natural = gfx.w;
    const sizeAt = W => { if (!sizes.has(W)) { layoutFig(gfx, W); sizes.set(W, { w: gfx.w, h: gfx.h }); } return sizes.get(W); };
    let best = null;
    for (const t of [1, 0.92, 0.85, 0.77, 0.7].map(f => ART.text * z * f)) {
      const textH = tallAt(t), room = iw - sideW - 2 * gapX - t;
      for (const W of [1, 1.3, 1.7, 2.2].map(f => natural * f)) {
        const s = sizeAt(W), k = Math.min(1, room / s.w, textH / s.h);
        if (!best || k > best.k * 1.03) best = { t, W, k, room };
      }
    }
    T = best.t; gfxRoom = best.room;
    layoutFig(gfx, best.W);
    if (best.k < 1) scaleFig(gfx, best.k);
    sideRoom = sideW; cols = colsIn(sideW); tx = L.pad + sideW + gapX;
  } else {
    sideRoom = (iw - T) / 2 - gapX; cols = colsIn(sideRoom); tx = L.pad + (iw - T) / 2;
  }
  const R = n.badge ? L.head * 1.7 : 0;
  const head = fitHead(n.say, iw - R, L.head, L.min, 2);
  const bx = n.badge ? badge(n, L.pad, L.pad, head.size) : 0;
  head.dx = L.pad + bx; head.dy = L.pad; n.blocks.push(head);
  const y0 = L.pad + heightOf(head) + L.head * 0.3;
  // the paragraphs, and where each link first appears: the line it starts on, its extent along that line, and which
  // half of the line it is in
  const anchors = new Map();
  let y = y0;
  text.forEach((p, i) => {
    y += gapAt(i);
    const pt = BULLET.test(p), b = para(p, T), off = pt ? ind : 0;
    b.dx = tx + off; b.dy = y; n.blocks.push(b);
    if (pt) { const d = block('•', SANS(ART.size * z, { maxW: ind, lh: 1.5 })); d.dx = tx + ind * 0.3; d.dy = y; n.blocks.push(d); }
    b.lines.forEach((l, li) => l.runs.forEach(r => {
      if (!r.ln) return;
      const a = anchors.get(r.ln);
      if (!a) anchors.set(r.ln, { y: y + li * b.lh, b, li, x0: off + r.x, x1: off + r.x + r.w });
      else if (a.b === b && a.li === li) { a.x0 = Math.min(a.x0, off + r.x); a.x1 = Math.max(a.x1, off + r.x + r.w); }
    }));
    y += heightOf(b);
  });
  for (const a of anchors.values()) a.side = (a.x0 + a.x1) / 2 < T / 2 ? 0 : 1;
  const textBottom = y;
  // the line from linked words to a node beside the text: the words' underline drops into the gap under their line,
  // runs out to the edge of the text, and bends into the node's number
  const join = (k, a, right) => {
    if (!a || !a.b) return;
    const fs = a.b.size, base = a.y + (a.b.lh - fs) / 2 + fs * 0.8;
    mark(n, { t: 'conn', id: k.id, x0: tx + (right ? a.x1 : a.x0), y0: base + fs * 0.12, yg: base + fs * 0.45,
      xe: right ? tx + T + gapX * 0.3 : tx - gapX * 0.3, x2: right ? k.lx : k.lx + k.w, y2: k.ly + (k.attachY || 0), lw: 7 * z, fs });
  };
  // the notes, in the order their links appear, each in the slot nearest its line
  const bottoms = [Array(cols).fill(y0), Array(cols).fill(y0)], under = [];
  const order = buds.map(k => ({ k, a: anchors.get(k.id) || { y: textBottom, side: 1 } })).sort((p, q) => p.a.y - q.a.y);
  for (const { k, a } of order) {
    if (k.w > sideRoom + 0.5) { under.push(k); continue; }
    const span = Math.min(cols, Math.ceil((k.w + colGap) / (noteW + colGap) - 1e-6));
    let best = null;
    for (const side of gfx ? [0] : [a.side, 1 - a.side]) for (let c = 0; c + span <= cols; c++) {
      const top = Math.max(a.y, ...bottoms[side].slice(c, c + span));
      const cost = top - a.y + c * ART.outer * z + (side === a.side ? 0 : 1);
      if (!best || cost < best.cost) best = { side, c, top, cost };
    }
    const step = c => c * (noteW + colGap);
    k.ly = best.top;
    k.lx = best.side === 0 ? tx - gapX - step(best.c) - k.w : tx + T + gapX + step(best.c);
    for (let c = best.c; c < best.c + span; c++) bottoms[best.side][c] = best.top + k.h + gapY;
    join(k, a, best.side === 1);
  }
  let bottom = Math.max(textBottom, ...bottoms[0].map(b => b - gapY), ...bottoms[1].map(b => b - gapY));
  if (gfx) {
    gfx.lx = tx + T + gapX + (gfxRoom - gfx.w) / 2; gfx.ly = y0;
    join(gfx, anchors.get(gfx.id), true); bottom = Math.max(bottom, gfx.ly + gfx.h);
  }
  for (const k of under) {
    k.lx = L.pad + (iw - k.w) / 2; k.ly = bottom + gapY * 2; bottom = k.ly + k.h;
    // its line runs out to the gap beside the text on the side of the linked words, down that gap, and along above
    // the node to its number
    const a = anchors.get(k.id);
    if (!a) continue;
    const fs = a.b.size, base = a.y + (a.b.lh - fs) / 2 + fs * 0.8, right = a.side === 1, yg = base + fs * 0.45;
    const x0 = tx + (right ? a.x1 : a.x0), xc = right ? tx + T + gapX * 0.5 : tx - gapX * 0.5;
    const x2 = k.lx + (k.attachX || 0), yt = k.ly - gapY;
    mark(n, { t: 'conn', id: k.id, lw: 7 * z, r: fs * 0.5, fs,
      pts: [[x0, base + fs * 0.12], [x0, yg], [xc, yg], [xc, yt], [x2, yt], [x2, k.ly]] });
  }
  n.attachY = L.pad + head.size * 0.55;
  n.w = iw + 2 * L.pad; n.h = bottom + L.pad;
}

// A box: its statement on top, as big as it fits, then its members in rows.
function layoutBox(n, depth, width) {
  const L = BOX[Math.min(depth, 3)];
  n.kind = 'box'; n.depth = depth; n.marks = [];
  const content = layoutRows(n, depth, width ? width - 2 * L.pad : null);
  const iw = width ? width - 2 * L.pad : content.w;
  n.blocks = [];
  const head = fitHead(n.say, iw, L.head, L.min, 2);
  head.dx = L.pad; head.dy = L.pad; n.blocks.push(head);
  const y = L.pad + heightOf(head) + L.head * 0.35;
  n.cx = L.pad; n.cy = y;
  n.w = iw + 2 * L.pad; n.h = y + content.h + L.pad;
}
const kidById = (n, id) => n.kids.find(k => k.id === id);
function layoutMember(k, depth, width) {
  if (k.article) layoutArticle(k, depth, width);
  else if (k.kids) layoutBox(k, depth, width);
  else if (k.fig) layoutFig(k, width);
  else layoutCard(k, width || CW, 1);
}
// Members in rows, each row side by side, tops aligned; spare width goes to a row's boxes, in proportion to size
function layoutRows(n, depth, innerW) {
  const gap = BOX[Math.min(depth, 3)].gap;
  const rows = n.rows.map(r => r.map(id => kidById(n, id)));
  rows.forEach(r => r.forEach(k => layoutMember(k, depth + 1)));
  const natural = r => r.reduce((a, k) => a + k.w, 0) + gap * (r.length - 1);
  const W0 = innerW || Math.max(...rows.map(natural));
  let y = 0;
  for (const r of rows) {
    const extra = W0 - natural(r);
    if (extra > 0.5) {
      const growers = r.filter(k => k.kids), total = growers.reduce((a, k) => a + k.w, 0);
      growers.forEach(k => layoutMember(k, depth + 1, k.w + extra * k.w / total));
    }
    let x = 0;
    for (const k of r) { k.lx = x; k.ly = y; x += k.w + gap; }
    y += Math.max(...r.map(k => k.h)) + gap;
  }
  return { w: W0, h: y - gap };
}
function place(n, x, y) {
  n.x0 = x; n.y0 = y; BYID.set(n.id, n);
  if (n.kind === 'box') for (const k of n.kids) place(k, x + n.cx + k.lx, y + n.cy + k.ly);
}

let LABELS = [], BANDS = [], ROBLOX = null, ARROWSHAPE = null;
const WORLD = {};
const aud = v => Math.round(v / USD_PER_AUD);
function build() {
  BYID.clear(); unitCache.clear();
  // The arrow's body: a box holding the articles, its statement across the top
  layoutBox(ARROW, 0);
  place(ARROW, 0, 0);
  const bodyH = ARROW.h, bodyW = ARROW.w;
  // the head is as long as a third of its height, but never much longer than the body is wide
  const flare = bodyH * 0.12, Hb = bodyH + flare * 2, cy = bodyH / 2, L = Math.min(Hb * 0.36, bodyW * 0.7);
  const apex = bodyW + L;
  ARROWSHAPE = { x0: 0, y0: 0, x1: bodyW, y1: bodyH, flare, apex, cy };
  // everything outside the arrow is sized to it, so the two sides keep their proportion as the arrow grows
  const OF = bodyH / 5470;
  // Roblox, where the arrow points
  ROBLOX = { id: 'roblox', kind: 'roblox', x0: apex + 60 * OF, y0: cy - Hb / 2, w: 760 * OF, h: Hb };
  {
    const fs = Math.min(Hb * 0.62 / unitW('Roblox', 700, T.title), ROBLOX.w * 0.95);
    ROBLOX.text = { size: fs, w: unitW('Roblox', 700, T.title) * fs };
  }
  // Out: the money leaves Roblox's right side as one thickness, the same as the arrow's body. The four bands bend
  // apart, then run straight with their words on them, clear of every other band; then each ends in an arrowhead or
  // splits at a bar, its splits fanning out to arrowheads with their words beside them.
  const K = bodyH / TOTAL, x0 = ROBLOX.x0 + ROBLOX.w, HEAD = 360 * OF;
  const BEND = x0 + 800 * OF, LX = BEND + 90 * OF, LW = 1900 * OF;
  const NODE_W = 60 * OF, COL2 = LX + LW + 100 * OF + HEAD - NODE_W, COL3 = COL2 + NODE_W + 1400 * OF, GAP2 = 300 * OF;
  BANDS = []; LABELS = [];
  const headLen = h => clamp(h * 0.5, 120 * OF, HEAD), headFlare = h => clamp(h * 0.2, 50 * OF, 140 * OF);
  // the words for a band: on it for the four, beside its arrowhead for a split
  function labelFor(o, x, w) {
    const l = { id: 'out-' + o.id, kind: 'label', blocks: [], marks: [], x0: x, w };
    const big = (o.kids ? 150 : 124) * OF;
    let y = 0;
    const put = (b, after) => { b.dx = 0; b.dy = y; l.blocks.push(b); y += heightOf(b) + after * OF; };
    put(block(o.say, SERIF(big, { maxW: w, lh: 1.08 })), 22);
    // the amount, bigger than the statement over it, on one line
    const amount = (o.approx ? 'About ' : '') + 'A$' + aud(o.v).toLocaleString('en-US') + 'M in 2025';
    put(block(amount, SANS(Math.min(big * 1.3, w * 0.99 / unitW(amount, 700, T.body)), { wt: 700, maxW: w, lh: 1.15 })), 34);
    if (o.about) put(block(o.about, SANS(56 * OF, { maxW: w })), 16);
    if (o.how) put(block(o.how, SANS(48 * OF, { maxW: w, color: 'ink-soft', lh: 1.32 })), 14);
    put(block(o.src, SANS(42 * OF, { it: true, maxW: w, color: 'ink-soft', lh: 1.25 })), 0);
    l.h = y; l.w = Math.max(...l.blocks.map(widthOf));
    return l;
  }
  // the four places, stacked with gaps and centred on the arrow
  OUT.forEach(o => { o.h = o.v * K; });
  { let y = cy - bodyH / 2; for (const o of OUT) { o.yOut = y; y += o.h; } }
  {
    const span = OUT.reduce((a, o) => a + o.h, 0) + GAP2 * (OUT.length - 1);
    let y = cy - span / 2;
    for (const o of OUT) { o.y = y; y += o.h + GAP2; }
  }
  // the splits beside their parents, each taking the room its arrowhead or its words need, whichever is more, pushed
  // down to clear the set above
  let floor = -Infinity;
  for (const o of OUT) {
    if (!o.kids) continue;
    o.kids.forEach(k => { k.h = k.v * K; k.key = o.key; k.label = labelFor(k, COL3 + 70 * OF, 2400 * OF); k.slot = Math.max(k.h + 2 * headFlare(k.h) + 80 * OF, k.label.h + 140 * OF); });
    const span = o.kids.reduce((a, k) => a + k.slot, 0);
    let y = Math.max(o.y + o.h / 2 - span / 2, floor);
    for (const k of o.kids) { k.y = y + (k.slot - k.h) / 2; y += k.slot; }
    floor = y;
    let yy = o.y; for (const k of o.kids) { k.yOut = yy; yy += k.h; }
  }
  for (const o of OUT) {
    const tipX = o.kids ? COL2 : COL2 + NODE_W;
    BANDS.push({ o, x0, xc: BEND, y0: o.yOut, x1: tipX, y1: o.y, h: o.h, head: !o.kids, len: headLen(o.h), flare: headFlare(o.h) });
    if (o.kids) {
      BANDS.push({ o, bar: true, x: COL2, y: o.y, w: NODE_W, h: o.h });
      for (const k of o.kids) BANDS.push({ o: k, x0: COL2 + NODE_W, y0: k.yOut, x1: COL3, y1: k.y, h: k.h, head: true, len: headLen(k.h), flare: headFlare(k.h) });
    }
    // on the straight stretch, in the middle of the band's thickness
    o.label = labelFor(o, LX, LW);
    o.label.y0 = o.y + o.h / 2 - o.label.h / 2;
    LABELS.push(o.label);
    for (const k of o.kids || []) { k.label.y0 = k.y + k.h / 2 - k.label.h / 2; LABELS.push(k.label); }
  }
  // Beside the creators' arrows, where nothing else runs: the card about how Roblox steers creators
  {
    const cr = OUT.find(o => o.id === 'creators');
    layoutCard(STEER, 1500 * OF, 3.2 * OF);
    place(STEER, COL3 + 70 * OF, cr.kids[0].label.y0 - 200 * OF - STEER.h);
  }
  // Doors: each link becomes a small copy of the node it leads to, fitted into its slot
  const leaves = [];
  const collect = n => { if (n.kind === 'box') n.kids.forEach(collect); else leaves.push(n); };
  collect(ARROW); leaves.push(STEER);
  OUT.forEach(o => BYID.set(o.id, o.label));
  LABELS.forEach(l => BYID.set(l.id, l));
  BYID.set('roblox', ROBLOX);
  for (const c of leaves) {
    c.buds = (c.slots || []).map(sl => {
      const t = BYID.get(sl.id);
      if (!t) return null;
      const k = Math.min(sl.w / t.w, sl.h / t.h), w = t.w * k, h = t.h * k;
      return { host: c, node: t, k, x0: c.x0 + sl.x + (sl.w - w) / 2, y0: c.y0 + sl.y + (sl.h - h) / 2, w, h };
    }).filter(Boolean);
  }
  const yTop = Math.min(0, ROBLOX.y0, STEER.y0, ...LABELS.map(l => l.y0));
  const xR = Math.max(...LABELS.map(l => l.x0 + l.w), STEER.x0 + STEER.w);
  const yB = Math.max(ROBLOX.y0 + ROBLOX.h, ...LABELS.map(l => l.y0 + l.h), ...BANDS.map(b => (b.y1 || b.y) + b.h + (b.flare || 0)));
  Object.assign(WORLD, { x0: -160 * OF, y0: yTop - 140 * OF, w: xR + 320 * OF, h: yB - yTop + 280 * OF });
}

// ---------- View (computed sizes: screen = world x s + offset), set by the caller for each drawing or hit-test ----------
let ctx = null, W = 0, H = 0, A0 = 1;
const view = { s: 1, ox: 0, oy: 0 };
const use = (v, w, h) => { Object.assign(view, v); W = w; H = h; };
const sx = x => x * view.s + view.ox;
const sy = y => y * view.s + view.oy;
const rectOf = n => ({ x: sx(n.x0), y: sy(n.y0), w: n.w * view.s, h: n.h * view.s });
function fitView(x0, y0, w, h, pad) {
  const s = Math.min((W * (1 - 2 * pad)) / w, (H * (1 - 2 * pad)) / h);
  return { s, ox: W / 2 - (x0 + w / 2) * s, oy: H / 2 - (y0 + h / 2) * s };
}

// ---------- Drawing ----------
const ramp = (v, a, b) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function col(key, a) { ctx.globalAlpha = clamp(a * A0, 0, 1); return T[key] || key; }
// Type has three rungs by its own on-screen size: a block per paragraph, then a bar per row, then words.
// Linked words are bold in the link colour, underlined.
function drawBlock(b, nx, ny, a, s) {
  const fs = b.size * s;
  if (a <= 0.004 || fs < 0.35) return;
  const lh = b.lh * s, top0 = ny + b.dy * s, x0 = nx + b.dx * s;
  if (top0 > H || top0 + lh * b.lines.length < 0 || x0 > W || x0 + b.maxW * s < 0) return;
  const lx = l => x0 + (b.align === 'center' ? (b.maxW - l.w) / 2 : b.align === 'right' ? b.maxW - l.w : 0) * s;
  const words = ramp(fs, 5.5, 8.5), barsIn = ramp(fs, 2.2, 3.6);
  const blockA = 1 - barsIn, barsA = barsIn * clamp(1 - words / 0.35, 0, 1);
  if (blockA > 0.01) {
    ctx.fillStyle = col(b.color, a * blockA * 0.16);
    ctx.beginPath(); b.lines.forEach((l, i) => ctx.rect(lx(l), top0 + i * lh, l.w * s, lh)); ctx.fill();
  }
  if (barsA > 0.01) {
    ctx.fillStyle = col(b.color, a * barsA * 0.38);
    ctx.beginPath(); b.lines.forEach((l, i) => ctx.rect(lx(l), top0 + i * lh + lh * 0.3, l.w * s, lh * 0.42)); ctx.fill();
  }
  if (words > 0.01) {
    const base = (b.lh - b.size) / 2 * s + fs * 0.8;
    let lastC = null;
    b.lines.forEach((l, i) => {
      const y = top0 + i * lh + base;
      if (y - fs > H || y + fs < 0) return;
      const x = lx(l);
      for (const r of l.runs) {
        const c = r.ln ? 'line' : b.color, wt = r.b ? 700 : b.wt;
        if (c !== lastC) { ctx.fillStyle = col(c, a * words); lastC = c; }
        if (r.sup) { drawText(r.s, x + (r.x + b.size * 0.08) * s, y - fs * 0.4, fs * 0.62, wt, b.fam, b.it, (r.w - b.size * 0.08) * s); continue; }
        drawText(r.s, x + r.x * s, y, fs, wt, b.fam, b.it, r.w * s);
        if (r.ln) ctx.fillRect(x + r.x * s, y + fs * 0.12, r.w * s, Math.max(0.6, fs * 0.06));
      }
    });
  }
}
// A string with its baseline's left end at (x, y), size fs px, turned by ang about that point. As outlines when the
// page offers them (window.PathText), so text glides with the shapes while zooming instead of snapping to whole pixels;
// otherwise as canvas text, held to its measured width w (small canvas type renders a little wider than it measures).
function drawText(str, x, y, fs, wt, fam, it, w, ang = 0) {
  const P = window.PathText;
  if (P && (!ang || P.rotates)) { P.fill(ctx, str, x, y, fs, wt, fam, it, undefined, ang); return; }
  ctx.font = font(wt, fs, fam, it); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  if (!ang) { ctx.fillText(str, x, y, w + 0.5); return; }
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.fillText(str, 0, 0, w + 0.5); ctx.restore();
}
// A node's shapes, drawn at scale s from its top-left (nx, ny). detail (1 = full) fades a small card's number. Shapes
// too small to see fade out rather than being held at a pixel: dots under about a pixel across, hairlines, and the
// lines from linked words once those words are only bars.
function drawMarks(n, nx, ny, a, s, detail = 1) {
  for (const m of n.marks) {
    if (m.t === 'rect') {
      const r = { x: nx + m.x * s, y: ny + m.y * s, w: m.w * s, h: m.h * s };
      if (m.flatBottom) { const k = Math.min(m.r * s, r.w / 2, r.h); ctx.beginPath(); ctx.moveTo(r.x, r.y + r.h); ctx.lineTo(r.x, r.y + k); ctx.arcTo(r.x, r.y, r.x + k, r.y, k); ctx.lineTo(r.x + r.w - k, r.y); ctx.arcTo(r.x + r.w, r.y, r.x + r.w, r.y + k, k); ctx.lineTo(r.x + r.w, r.y + r.h); ctx.closePath(); }
      else roundRect(r, (m.r || 0) * s);
      ctx.fillStyle = col(m.fill === 'self' ? fillOf(n) : m.fill, a * (m.a == null ? 1 : m.a)); ctx.fill();
    } else if (m.t === 'circle') {
      const rr = m.r * s, f = ramp(rr, 0.3, 0.9) * (m.role === 'badge' ? detail : 1);
      if (f < 0.01) continue;
      ctx.beginPath(); ctx.arc(nx + m.x * s, ny + m.y * s, rr, 0, Math.PI * 2);
      ctx.fillStyle = col(m.fill, a * f); ctx.fill();
    } else if (m.t === 'line') {
      // a line thinner than half a pixel is drawn at half a pixel, paler in proportion, and dropped when much thinner
      const w = Math.min(m.lw * s, m.lw), f = clamp(w / 0.5, 0, 1);
      if (w < 0.08) continue;
      ctx.beginPath(); ctx.moveTo(nx + m.x0 * s, ny + m.y0 * s); ctx.lineTo(nx + m.x1 * s, ny + m.y1 * s);
      ctx.strokeStyle = col(m.color, a * f * (m.a == null ? 1 : m.a)); ctx.lineWidth = Math.max(0.5, w); ctx.lineCap = 'round'; ctx.stroke();
    } else if (m.t === 'conn') {
      // a line from linked words to their node, fading out as the words shrink to bars; the one for the hovered node is
      // drawn darker and thicker at any size
      const on = !!hover && (hover.id === m.id || (hover.node && hover.node.id === m.id));
      const f = on ? 1 : ramp(m.fs * s, 1.5, 4);
      if (f < 0.01) continue;
      const X = v => nx + v * s, Y = v => ny + v * s;
      ctx.beginPath();
      if (m.pts) {
        // a run of straight lines with rounded corners
        const P = m.pts.map(([x, y]) => [X(x), Y(y)]);
        ctx.moveTo(...P[0]);
        for (let i = 1; i < P.length - 1; i++) ctx.arcTo(P[i][0], P[i][1], P[i + 1][0], P[i + 1][1], m.r * s);
        ctx.lineTo(...P[P.length - 1]);
      } else {
        const xm = X((m.xe + m.x2) / 2);
        ctx.moveTo(X(m.x0), Y(m.y0)); ctx.lineTo(X(m.x0), Y(m.yg)); ctx.lineTo(X(m.xe), Y(m.yg));
        ctx.bezierCurveTo(xm, Y(m.yg), xm, Y(m.y2), X(m.x2), Y(m.y2));
      }
      ctx.strokeStyle = col('line', a * f * (on ? 1 : 0.8)); ctx.lineWidth = clamp(m.lw * s * (on ? 1.8 : 1), on ? 2 : 0.75, on ? 4 : 2.5);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
    } else if (m.t === 'img') {
      // a picture in its rounded frame, from its small copy when it is drawn small; until it has loaded, the frame is
      // filled in the rule colour
      const r = { x: nx + m.x * s, y: ny + m.y * s, w: m.w * s, h: m.h * s }, im = pic(m.src);
      if (r.w < 1.5) continue;
      ctx.save(); roundRect(r, m.r * s); ctx.clip();
      if (im.complete && im.naturalWidth) {
        ctx.globalAlpha = clamp(a * A0, 0, 1); ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(r.w < 128 && im.thumb ? im.thumb : im, r.x, r.y, r.w, r.h);
      }
      else { ctx.fillStyle = col('rule', a * 0.5); ctx.fill(); }
      ctx.restore();
    } else if (m.t === 'rtext') {
      const fs = m.size * s;
      if (fs < 1) continue;
      const len = unitW(m.s, m.wt, T.body) * fs, words = ramp(fs, 5.5, 8.5), x0 = nx + m.x * s, y0 = ny + m.y * s;
      if (words < 1) { ctx.save(); ctx.translate(x0, y0); ctx.rotate(m.ang); ctx.fillStyle = col(m.color, a * (1 - words) * 0.38); ctx.fillRect(0, -fs * 0.62, len, fs * 0.5); ctx.restore(); }
      if (words > 0.01) { ctx.fillStyle = col(m.color, a * words); drawText(m.s, x0, y0, fs, m.wt, T.body, false, len, m.ang); }
    }
  }
}
const presence = r => ramp(Math.min(r.w, r.h), 3, 14);
const onScreen = r => !(r.x > W || r.y > H || r.x + r.w < 0 || r.y + r.h < 0);
function roundRect(r, rad) {
  const k = Math.max(0, Math.min(rad, r.w / 2, r.h / 2));
  ctx.beginPath();
  ctx.moveTo(r.x + k, r.y); ctx.arcTo(r.x + r.w, r.y, r.x + r.w, r.y + r.h, k); ctx.arcTo(r.x + r.w, r.y + r.h, r.x, r.y + r.h, k);
  ctx.arcTo(r.x, r.y + r.h, r.x, r.y, k); ctx.arcTo(r.x, r.y, r.x + r.w, r.y, k); ctx.closePath();
}
// Boxes alternate between the two paper tones by depth so each sits clear of what holds it
const isLeaf = n => n.kind === 'card' || n.kind === 'fig';
const fillOf = n => ((isLeaf(n) ? n.inDepth : n.depth) % 2 === 1 ? 'card' : 'ground');
const radiusOf = n => isLeaf(n) ? 16 : [0, 70, 46, 30][Math.min(n.depth, 3)];
const strokeOf = n => isLeaf(n) ? ['rule', 1] : n.depth === 1 ? ['ink', 3] : n.depth === 2 ? ['ink-soft', 2] : ['ink-soft', 1.4];

let hover = null; // a node, or a bud
// A node and everything inside it, drawn at scale s and offset (ox, oy). A copy (a door) leaves out its own doors.
// A card or figure drawn small loses detail as it shrinks (from about 110 pixels wide down to 40): its outline and its
// number fade, and a card's words give way to two plain blocks, one for its statement and one for the rest, while its
// pictures stay, from their small copies.
function drawNode(n, s, ox, oy, copy) {
  const r = { x: n.x0 * s + ox, y: n.y0 * s + oy, w: n.w * s, h: n.h * s };
  if (!onScreen(r)) return;
  const a = presence(r);
  if (a <= 0.004) return;
  const detail = isLeaf(n) ? ramp(r.w, 40, 110) : 1;
  if (n.kind !== 'label') {
    roundRect(r, radiusOf(n) * s);
    ctx.fillStyle = col(fillOf(n), a); ctx.fill();
    const [sk, lw] = strokeOf(n);
    if (detail > 0.01) { ctx.strokeStyle = col(sk, a * 0.9 * detail); ctx.lineWidth = clamp(lw * Math.sqrt(Math.min(1, s * 4)), 0.5, lw); ctx.stroke(); }
  }
  if (n.marks && n.marks.length) drawMarks(n, r.x, r.y, a, s, detail);
  for (const b of n.blocks) {
    const f = b.role === 'badge' || n.low ? detail : 1;
    if (f > 0.01) drawBlock(b, r.x, r.y, a * f, s);
  }
  if (n.low && detail < 0.99) {
    const lowA = a * (1 - detail), box = ([x, y, w, h]) => roundRect({ x: r.x + x * s, y: r.y + y * s, w: w * s, h: h * s }, Math.min(4, h * s * 0.2));
    box(n.low.say); ctx.fillStyle = col('ink', lowA * 0.3); ctx.fill();
    if (n.low.rest) { box(n.low.rest); ctx.fillStyle = col('ink', lowA * 0.13); ctx.fill(); }
  }
  if (n.kind === 'box') for (const k of n.kids) drawNode(k, s, ox, oy, copy);
  if (!copy && n.buds) for (const b of n.buds) {
    const s2 = s * b.k, br = { x: b.x0 * s + ox, y: b.y0 * s + oy, w: b.w * s, h: b.h * s };
    if (!onScreen(br) || presence(br) <= 0.004) continue;
    drawNode(b.node, s2, br.x - b.node.x0 * s2, br.y - b.node.y0 * s2, true);
    if (b.node.kind === 'label') { roundRect(br, 6 * s); ctx.strokeStyle = col('rule', presence(br)); ctx.lineWidth = 1; ctx.stroke(); }
  }
}
function drawArrow() {
  const A = ARROWSHAPE, s = view.s;
  ctx.beginPath();
  ctx.moveTo(sx(A.x0), sy(A.y0)); ctx.lineTo(sx(A.x1), sy(A.y0)); ctx.lineTo(sx(A.x1), sy(A.y0 - A.flare));
  ctx.lineTo(sx(A.apex), sy(A.cy)); ctx.lineTo(sx(A.x1), sy(A.y1 + A.flare)); ctx.lineTo(sx(A.x1), sy(A.y1));
  ctx.lineTo(sx(A.x0), sy(A.y1)); ctx.closePath();
  ctx.fillStyle = col('line', T.arrowA); ctx.fill();
  ctx.strokeStyle = col('line', 1); ctx.lineJoin = 'round'; ctx.lineWidth = clamp(40 * s, 1.5, 6); ctx.stroke();
  for (const b of ARROW.blocks) drawBlock(b, sx(ARROW.x0), sy(ARROW.y0), 1, s);
}
// A band of thickness h from (x0, y0) to (x1, y1): it bends between x0 and xc, and runs straight from xc to x1
function bandPath(x0, y0, x1, y1, h, xc = x1) {
  const xm = (x0 + xc) / 2;
  ctx.beginPath();
  ctx.moveTo(sx(x0), sy(y0)); ctx.bezierCurveTo(sx(xm), sy(y0), sx(xm), sy(y1), sx(xc), sy(y1)); ctx.lineTo(sx(x1), sy(y1));
  ctx.lineTo(sx(x1), sy(y1 + h)); ctx.lineTo(sx(xc), sy(y1 + h));
  ctx.bezierCurveTo(sx(xm), sy(y1 + h), sx(xm), sy(y0 + h), sx(x0), sy(y0 + h)); ctx.closePath();
}
function drawOut() {
  for (const b of BANDS) {
    const hue = b.o.key;
    if (b.bar) { ctx.fillStyle = col(hue, 1); roundRect({ x: sx(b.x), y: sy(b.y), w: b.w * view.s, h: b.h * view.s }, 16 * view.s); ctx.fill(); continue; }
    const xb = b.head ? b.x1 - b.len : b.x1;
    bandPath(b.x0, b.y0, xb + 1, b.y1, b.h, b.xc);
    ctx.fillStyle = col(hue, T.flowA); ctx.fill();
    if (b.head) {
      ctx.beginPath(); ctx.moveTo(sx(xb), sy(b.y1 - b.flare)); ctx.lineTo(sx(b.x1), sy(b.y1 + b.h / 2)); ctx.lineTo(sx(xb), sy(b.y1 + b.h + b.flare)); ctx.closePath();
      ctx.fillStyle = col(hue, 1); ctx.fill();
    }
  }
  // Roblox, its name running up it as big as it fits
  const r = rectOf(ROBLOX);
  if (onScreen(r)) {
    roundRect(r, 90 * view.s); ctx.fillStyle = col('ink', 1); ctx.fill();
    const fs = ROBLOX.text.size * view.s;
    if (fs > 1.5) {
      const x0 = r.x + r.w / 2 + fs * 0.33, y0 = r.y + r.h / 2 + ROBLOX.text.w * view.s / 2, words = ramp(fs, 5.5, 8.5);
      if (words < 1) { ctx.save(); ctx.translate(x0, y0); ctx.rotate(-Math.PI / 2); ctx.fillStyle = col('ground', (1 - words) * 0.4); ctx.fillRect(0, -fs * 0.62, ROBLOX.text.w * view.s, fs * 0.5); ctx.restore(); }
      if (words > 0.01) { ctx.fillStyle = col('ground', words); drawText('Roblox', x0, y0, fs, 700, T.title, false, ROBLOX.text.w * view.s, -Math.PI / 2); }
    }
  }
  for (const l of LABELS) drawNode(l, view.s, view.ox, view.oy, false);
}
function drawHover() {
  if (!hover || hover.kind === 'label') return;
  const r = hover.host ? { x: sx(hover.x0), y: sy(hover.y0), w: hover.w * view.s, h: hover.h * view.s } : rectOf(hover);
  roundRect(r, (hover.host ? 8 : radiusOf(hover)) * view.s);
  ctx.strokeStyle = col('line', 1); ctx.lineWidth = 2.5; ctx.stroke();
}
// Where going to a node puts the view: a node much taller than the screen opens fitted to its width at its top, like
// a page; anything else fits whole. A pillar (over four times as tall as it is wide, like Roblox) also fits whole:
// fitted to its width it would fill the screen with its fill and nothing else.
function viewFor(n) {
  const tall = n.h / n.w;
  if (tall > (H / W) * 1.25 && tall <= 4) { const s = W * 0.9 / n.w; return { s, ox: W / 2 - (n.x0 + n.w / 2) * s, oy: H * 0.05 - n.y0 * s }; }
  return fitView(n.x0, n.y0, n.w, n.h, 0.05);
}
const inRect = (r, px, py) => px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
// The nodes under a point, outermost first
function chainAt(px, py) {
  const chain = [];
  const walk = list => { for (const n of list) { if (inRect(rectOf(n), px, py)) { chain.push(n); if (n.kind === 'box') walk(n.kids); return; } } };
  walk([...ARROW.kids, STEER]);
  return chain;
}
function hitBud(px, py) {
  const chain = chainAt(px, py), c = chain[chain.length - 1];
  if (!c || !c.buds) return null;
  for (const b of c.buds) {
    const r = { x: sx(b.x0), y: sy(b.y0), w: b.w * view.s, h: b.h * view.s };
    if (presence(r) >= 0.5 && inRect(r, px, py)) return b;
  }
  return null;
}
// What a click there goes to: the deepest node big enough to aim at; if the view is already on it, the one inside it
function hit(px, py) {
  const b = hitBud(px, py);
  if (b) return b;
  for (const l of LABELS) if (inRect(rectOf(l), px, py)) return l;
  if (inRect(rectOf(ROBLOX), px, py)) return ROBLOX;
  const chain = chainAt(px, py);
  if (!chain.length) return null;
  const big = Math.min(W, H) * 0.12;
  let i = -1;
  chain.forEach((n, j) => { const r = rectOf(n); if (Math.min(r.w, r.h) >= big) i = j; });
  if (i < 0) i = 0;
  if (view.s >= viewFor(chain[i]).s * 0.85 && i + 1 < chain.length) i++;
  return chain[i];
}
// Words under a point that lead somewhere, once they can be read: a link to a node, or a story's web address
function wordLinkAt(px, py) {
  const chain = chainAt(px, py);
  for (let i = chain.length - 1; i >= 0; i--) {
    const c = chain[i], r = rectOf(c);
    for (const b of c.blocks) {
      if (b.size * view.s < 7) continue;
      const lh = b.lh * view.s;
      for (let li = 0; li < b.lines.length; li++) {
        const l = b.lines[li], y = r.y + b.dy * view.s + li * lh;
        if (py < y || py > y + lh) continue;
        if (b.href) { const x = r.x + b.dx * view.s; if (px >= x && px <= x + l.w * view.s) return { href: b.href }; }
        for (const run of l.runs) if (run.ln) {
          const x = r.x + (b.dx + run.x) * view.s;
          if (px >= x - 2 && px <= x + run.w * view.s + 2) { const t = BYID.get(run.ln); if (t) return { node: t }; }
        }
      }
    }
  }
  return null;
}

// Leaves inside a box take the other paper tone from it
function markDepths(n, d) { if (n.kind === 'box') n.kids.forEach(k => { if (isLeaf(k)) k.inDepth = d + 1; else markDepths(k, k.depth); }); }

let lastDraw = null, hoverNode = null; // for a card: the view of the last drawAt, and the node it rings
return {
  // read the page's colours and lay the map out again (after fonts load or the theme changes)
  build() { readTheme(); build(); markDepths(ARROW, 0); STEER.inDepth = 1; },
  // the map's extent, in its own units
  get world() { return WORLD; },
  get theme() { return T; },
  // draw the map into ctx at view v on a w x h screen; o.alpha fades all of it, o.hover rings a node or door
  render(c, v, w, h, o = {}) {
    ctx = c; use(v, w, h); A0 = o.alpha == null ? 1 : o.alpha; hover = o.hover || null;
    drawArrow(); drawOut();
    for (const k of ARROW.kids) drawNode(k, view.s, view.ox, view.oy, false);
    drawNode(STEER, view.s, view.ox, view.oy, false);
    drawHover();
    A0 = 1;
  },
  // what a click at (px, py) goes to, at view v on a w x h screen
  hitAt(px, py, v, w, h) { use(v, w, h); return hit(px, py); },
  hitBud(px, py, v, w, h) { use(v, w, h); return hitBud(px, py); },
  wordLinkAt(px, py, v, w, h) { use(v, w, h); return wordLinkAt(px, py); },
  // the view that going to node n puts on a w x h screen
  viewFor(n, w, h) { W = w; H = h; return viewFor(n); },
  fitView(x0, y0, wd, ht, pad, w, h) { W = w; H = h; return fitView(x0, y0, wd, ht, pad); },
  byId: id => BYID.get(id),
  // ---- for a card on another map; a copy of it drawn elsewhere passes remember = false, so hit() keeps going by
  // the card itself
  size() { return { w: WORLD.w, h: WORLD.h }; },
  drawAt(c, x, y, s, w, h, alpha = 1, remember = true) {
    readTheme();
    const v = { s, ox: x - WORLD.x0 * s, oy: y - WORLD.y0 * s };
    if (remember) lastDraw = { v, w, h };
    c.save();
    ctx = c; use(v, w, h); A0 = alpha; hover = hoverNode;
    drawArrow(); drawOut();
    for (const k of ARROW.kids) drawNode(k, view.s, view.ox, view.oy, false);
    drawNode(STEER, view.s, view.ox, view.oy, false);
    drawHover();
    A0 = 1;
    c.restore();
  },
  hit(px, py) {
    if (!lastDraw) return null;
    use(lastDraw.v, lastDraw.w, lastDraw.h);
    const rel = n => ({ id: n.id, x0: n.x0 - WORLD.x0, y0: n.y0 - WORLD.y0, w: n.w, h: n.h });
    const wl = wordLinkAt(px, py);
    if (wl) return wl.href ? { href: wl.href } : rel(wl.node);
    const b = hitBud(px, py);
    if (b) return rel(b.node);
    const n = hit(px, py);
    return n ? rel(n) : null;
  },
  hover(id) { hoverNode = id ? BYID.get(id) || null : null; },
  ARROW, STEER, OUT, get ROBLOX() { return ROBLOX; },
};
})();
