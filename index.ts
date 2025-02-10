import express from "express";
import "express-async-errors";
import { parse } from 'discord-markdown-parser';
import type { ASTNode, SingleASTNode  } from 'simple-markdown';
import { minify } from "html-minifier";
import Parser from "rss-parser";

// Require the necessary discord.js classes
import { Client, Events, GatewayIntentBits, TextChannel, Message, CDN, WebhookType } from "discord.js";
import type { GuildChannel, Role, Collection, Snowflake } from "discord.js";

// Create a new client instance
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

// When the client is ready, run this code (only once).
// The distinction between `client: Client<boolean>` and `readyClient: Client<true>` is important for TypeScript developers.
// It makes some properties non-nullable.
client.once(Events.ClientReady, readyClient => {
	console.log(`Ready! Logged in as ${readyClient.user.tag}`);
});

// Log in to Discord with your client's token
await client.login(process.env.token);

const MessageASTNodes = async (nodes: ASTNode[]) => {
    if (Array.isArray(nodes)) {
      const parsedNodes = []
      for (const node of nodes) {
        parsedNodes.push(await MessageSingleASTNode(node as SingleASTNode))
      }
      return parsedNodes.join("<!-- split -->")
    } else {
      return await MessageSingleASTNode(nodes)
    }
}
  
const MessageSingleASTNode = async (node: SingleASTNode ): Promise<string | null> => {
    if (!node) return null;
    const type = node.type;
  
    switch (type) {
      case 'text':
        return node.content.replaceAll("&", "&amp;");
  
      case 'link':
        return `
          <a href="${node.target.replaceAll("&", "&amp;")}">
            ${await MessageASTNodes(node.content)}
          </a>
        `;
  
      case 'url':
      case 'autolink':
        return `
          <a href="${node.target.replaceAll("&", "&amp;")}" target="_blank" rel="noreferrer">
            ${await MessageASTNodes(node.content)}
          </a>
        `;
  
      case 'blockQuote':
        return `
          <blockquote>
            ${typeof node.content === "string" ? node.content : await MessageASTNodes(node.content)}
          </blockquote>
        `;
  
      case 'br':
      case 'newline':
        return "<br />";
  
      case 'channel': {
        const id = node.id as string;
        try {
          return "#" + escapeHtml(((await client.channels.fetch(id)) as GuildChannel)?.name ?? "Unknown");
        } catch (e) {
          return "&lt;#" + id + "&rt;"
        }
      }
  
      case 'role': {
        const id = node.id as string;
        try {
          return "@" + escapeHtml((await mgtvChannel.guild.roles.fetch(id))?.name ?? "Unknown");
        } catch (e) {
          return "<@" + id + ">"
        }
      }
  
      case 'user': {
        const id = node.id as string;
        const user = await client.users.fetch(id);
        return "@" + escapeHtml(user.displayName ?? user.username);
      }
  
      case 'here':
      case 'everyone':
        return "@" + node.type
  
      case 'codeBlock':
        return `
          <code>${node.lang}</code>
          <blockquote>
            ${typeof node.content === "string" ? node.content : await MessageASTNodes(node.content)}
          </blockquote>
        `;
  
      case 'inlineCode':
        return `
          <code>${typeof node.content === "string" ? node.content : await MessageASTNodes(node.content)}</code>
        `;
  
      case 'em':
        return `
          <i>${typeof node.content === "string" ? node.content : await MessageASTNodes(node.content)}</i>
        `;
  
      case 'strong':
        return `
          <b>${typeof node.content === "string" ? node.content : await MessageASTNodes(node.content)}</b>
        `;
  
      case 'underline':
        return `
          <u>${typeof node.content === "string" ? node.content : await MessageASTNodes(node.content)}</u>
        `;
  
      case 'strikethrough':
        return `
          <s>${typeof node.content === "string" ? node.content : await MessageASTNodes(node.content)}</s>
        `;
  
      case 'emoticon':
        return typeof node.content === 'string' ? (
          node.content
        ) : (
          await MessageASTNodes(node.content)
        );
  
      case 'spoiler':
        return `
          <span class="spoiler">${typeof node.content === "string" ? node.content : await MessageASTNodes(node.content)}</span>
        `;
  
      case 'emoji':
      case 'twemoji':
        if (!node.id) return node.name;
        const emoji = await client.emojis.resolve(node.id)
        return emoji ? `<img class="emoji" alt="${emoji.name} emoji" src="${emoji.imageURL()}">` : `<img class="emoji" alt="${node.name} emoji" src="${(new CDN()).emoji(node.id)}">`;
  
      case 'timestamp':
        let text = "";
        switch (node.format) {
          case "R":
            text = (new Date(node.timestamp * 1000)).toLocaleString('en-US', { timeZone: "ETC/UTC", dateStyle: "medium", timeStyle: "short" }) + " UTC"
            break;
          case "D":
            text = (new Date(node.timestamp * 1000)).toLocaleString('en-US', { timeZone: "ETC/UTC", dateStyle: "medium" }) + " UTC"
            break;
          case "d":
            text = (new Date(node.timestamp * 1000)).toLocaleString('en-US', { timeZone: "ETC/UTC", dateStyle: "short" }) + " UTC"
            break;
          case "T":
            text = (new Date(node.timestamp * 1000)).toLocaleString('en-US', { timeZone: "ETC/UTC", timeStyle: "medium" }) + " UTC"
            break;
          case "t":
            text = (new Date(node.timestamp * 1000)).toLocaleString('en-US', { timeZone: "ETC/UTC", timeStyle: "short" }) + " UTC"
            break;
          case "F":
            text = (new Date(node.timestamp * 1000)).toLocaleString('en-US', { timeZone: "ETC/UTC", dateStyle: "long", timeStyle: "medium" }) + " UTC"
            break;
          case "f":
            text = (new Date(node.timestamp * 1000)).toLocaleString('en-US', { timeZone: "ETC/UTC", dateStyle: "medium", timeStyle: "short" }) + " UTC"
            break;
          default:
            return node.timestamp + " (" + node.format + ")"    
        }
        return `<time datetime="${(new Date(node.timestamp * 1000)).toISOString()}" data-format="${node.format}">${text}</time>`
      default: {
        return type + ": " + (typeof node.content === 'string' ? (
          node.content
        ) : (
          await MessageASTNodes(node.content)
        ));
      }
    }
  }
  

  const MessageASTNodesPlaintext = async (nodes: ASTNode): Promise<string | null | undefined> => {
    if (Array.isArray(nodes)) {
      const parsedNodes = []
      for (const node of nodes) {
        parsedNodes.push(await MessageSingleASTNodePlaintext(node))
      }
      return parsedNodes.join(" ")
    } else {
      return await MessageSingleASTNodePlaintext(nodes)
    }
}
  
const MessageSingleASTNodePlaintext = async (node: SingleASTNode): Promise<string | null | undefined> => {
    if (!node) return null;
    if (typeof node === "string") return node;
  
    const type = node.type;
  
    switch (type) {
      case 'text':
      case 'link':
      case 'url':
      case 'autolink':
      case 'blockQuote':
      case 'codeBlock':
      case 'inlineCode':
      case 'em':
      case 'strong':
      case 'underline':
      case 'strikethrough':
      case 'spoiler':
        return typeof node.content === "string" ? node.content : await MessageASTNodesPlaintext(node.content);

      case 'br':
      case 'newline':
        return "\n"
  
      case 'channel': {
        const id = node.id as string;
        try {
          return "#" + ((await client.channels.fetch(id)) as GuildChannel)?.name;
        } catch (e) {
          return "&lt;#" + id + "&rt;"
        }
      }
  
      case 'role': {
        const id = node.id as string;
        try {
          return "@" + ((await mgtvChannel.guild.roles.fetch(id)) as Role)?.name;
        } catch (e) {
          return "<@" + id + ">"
        }
      }
  
      case 'user': {
        const id = node.id as string;
        const user = await client.users.fetch(id);
        return "@" + (user.displayName ?? user.username);
      }
  
      case 'here':
      case 'everyone':
        return "@" + node.type

      case 'emoticon':
        return typeof node.content === 'string' ? (
          node.content
        ) : (
          await MessageASTNodesPlaintext(node.content)
        );
  
      case 'emoji':
      case 'twemoji':
        return node.id ? "" : node.name;
  
      case 'timestamp':
        return node.timestamp + " (" + node.format + ")"
  
      default: {
        return type + ": " + (typeof node.content === 'string' ? (
          node.content
        ) : (
          await MessageASTNodesPlaintext(node.content)
        ));
      }
    }
  }
  
const generatePage = (title: string, content: string, meta: string, req: express.Request) => `<!DOCTYPE html>
<html lang="en">
    <head>
        <title>${title} - MGTV24 News</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0"> 
        <link rel="stylesheet" href="/static/styles.css">
        <link rel="alternate" type="application/rss+xml" title="MGTV24 RSS Feed" href="https://${req.get("host")}/feed.rss">
        <script src="/static/main.js" defer></script>
        ${meta}
    </head>
    <body>
        <header>
            <a href="/"><img src="/static/MGTV24-News.webp" alt="MGTV24 news logo" class="emoji"> MGTV24 News <img src="/static/MGTV24-News.webp" alt="MGTV24 news logo" class="emoji"></a>
            <form role="search" action="${req.path.startsWith("/all") ? "/all/search" : (req.params.feed ? "/feeds/" + req.params.feed + "/search" : "/search")}">
                <input type="search" name="query" placeholder="${req.path.startsWith("/all") ? "Search all stations" : (req.params.feed ? "Search this radio station" : "Search...")}">
                <input type="submit" value="Search">
            </form>
            <nav>
            <ul id="feeds">
            <li>
              <a href="/"${(req.params.feed || req.path.startsWith("/all") || req.path.startsWith("/archives")) ? "" : ` class="current" aria-current="page"`}>MGTV</a>
            </li>
            ${Object.entries(feeds).filter(([feedId, data]) => !data.archived).map(([feedId, data]) => {
              return `<li><a href="/feeds/${feedId}"${req.params.feed == feedId ? ` class="current" aria-current="page"`: ""}>${data.name}</a></li>`
            }).join("")}
            <li>
              <a href="/all"${req.path.startsWith("/all") ? ` class="current" aria-current="page"` : ""}>All</a>
            </li>
            <li>
              <a href="/archives"${req.path.startsWith("/archives") ? ` class="current" aria-current="page"` : ""}>Archives</a>
            </li>
            </ul>
            </nav>
        </header>
        <main>
            ${content}
        </main>
        <footer>
          <a href="/feed.rss">RSS Feed</a>
        </footer>
    </body>
</html>`
const parseHeadings = (content: String) => content
  .replaceAll(/(<!-- split -->|^)\s*-(<!-- split -->|\s)*#\s(.+?)(<br \/>|$)/gs, `<p class="sub">$3</p>`)
  .replaceAll(/(<!-- split -->|^)\s*#(<!-- split -->|\s)*#\s(.+?)(<br \/>|$)/gs, "<h2>$3</h2>")
  .replaceAll(/(<!-- split -->|^)\s*#\s(.+?)(<br \/>|$)/gs, "<h1>$2</h1>")
const getHeading = (content: String) => content.match(/^#\s(.+?)$/m)?.[1]
const getSecondaryHeading = (content: String) => content.match(/^##\s(.+?)$/m)?.[1]
const app = express()
app.use("/static", express.static("static"))

const escapeHtml = (unsafe: string) => {
  return unsafe.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

const blacklistedString = "<@&1216817149335703572>"
const generateRSSList = (req: express.Request, messages: Message[], prerendered: Record<string, {title: string, description: string}>) => {
  const handledMessages = []
  for (const message of messages) {
    if (message.content === blacklistedString || message.content === "[Original Message Deleted]") continue;
    handledMessages.push(`<item>
      <title>${prerendered[message.id].title}</title>
      <link>https://${req.get("host")}/post/${message.id}</link>
      <description><![CDATA[${prerendered[message.id].description}
      ${[...message.attachments.values()].map(attachment => `<img src="${attachment.proxyURL}" alt="${attachment.description ?? attachment.name + " attachment"}" class="attachment">`).join("")}]]></description>
      <pubDate>${message.createdAt.toUTCString()}</pubDate>
      <guid isPermaLink="false">${message.id}</guid>
    </item>`)
  }
  return handledMessages
}
const preRenderRSS = async (sortedMessages: Message[], useEmbeds: boolean) => {
  const handledMessages: Record<string, {
    title: string,
    description: string
  }> = {}
  for (const message of sortedMessages) {
    const date = message.createdAt.toLocaleString('en-US', { timeZone: "Europe/Berlin", dateStyle: "medium" })
    handledMessages[message.id] = {
      "title": escapeHtml(await MessageASTNodesPlaintext(parse(getHeading(message.content) ?? date)) ?? "")?.trim() ?? date,
      "description": minify(parseHeadings(await MessageASTNodes(parse(useEmbeds && message.embeds.length > 0 && message.embeds[0].description ? (message.embeds[0].title ? "# " + message.embeds[0].title + "\n\n" : "") + message.embeds[0].description : message.content, "extended")) ?? ""), {
        "collapseWhitespace": true
      }).replaceAll("<!-- split -->", "")
    };
  }
  return handledMessages;
}
const generatePostList = async (messages: Message[], linkPrefix: string, useEmbeds: boolean) => {
  const handledMessages = []
  for (const message of messages) {
    if (message.content === blacklistedString || message.content === "[Original Message Deleted]") continue;
    handledMessages.push({
      createdTimestamp: message.createdTimestamp,
      content: `<div class="newsPost">
        <i>Written by <b>${escapeHtml(message.author.displayName)}</b> on <b>${message.createdAt.toLocaleString('en-US', { timeZone: "Europe/Berlin", dateStyle: "medium" })}</b></i><br />
        ${minify(parseHeadings(await MessageASTNodes(parse(useEmbeds && message.embeds.length > 0 && message.embeds[0].description ? (message.embeds[0].title ? "# " + message.embeds[0].title + "\n\n" : "") + message.embeds[0].description : message.content, "extended")) ?? ""), {
          "collapseWhitespace": true
        }).replaceAll("<!-- split -->", "")}<br/><br/>
        ${message.attachments.size ? message.attachments.size + " attachments<br />" : ""}
        <a href="${linkPrefix}${message.id}">Link to post for sharing</a>
      </div>`
    })
  }
  return handledMessages
}
const mgtvChannel: TextChannel = (await client.channels.fetch("1217494766397296771") as TextChannel)
//let messages: Message[] = [];
let parsedMessages: {createdTimestamp: number, content: string}[] = []
let sortedMessages: Message[] = []
let preRenderedRSS: Record<string, {
  title: string,
  description: string
}> = {};
const fetchMessages = async (channel: TextChannel) => {
  const pendingMessages = [];
  let before;
  while (1) {
    const newMessages: Collection<string, Message> = await channel.messages.fetch({
        limit: 100,
        before
    })
    if (newMessages.size === 0) break;
    pendingMessages.unshift(...[...newMessages.values()]);
    console.log("before: " + before)
    before = ([...newMessages.values()] as Message[]).at(-1)!.id;
  }
  return pendingMessages.sort((a, b) => b.createdTimestamp - a.createdTimestamp)
}
const setupMessages = async () => {
  sortedMessages = await fetchMessages(mgtvChannel)
  parsedMessages = await generatePostList(sortedMessages, "/post/", false)
  preRenderedRSS = await preRenderRSS(sortedMessages, false);
  console.log("done!")
}
await setupMessages()

type FeedData = {
  id: Snowflake,
  name: string,
  icon?: string,
  aliases: string[],
  messages: Message[],
  parsed: {createdTimestamp: number, content: string, guid?: string, contentSnippet?: string, title?: string, raw?: string, url?: string}[],
  rss: Record<string, {title: string, description: string}>,
  useEmbeds?: boolean,
  archived?: boolean,
  source?: string,
  url?: string
}
const feeds: Record<string, FeedData> = {
  "uatv": {
    "id": "1275492633870991380",
    "name": "UATV"
  },
  "rgf": {
    "id": "1295401168297787442",
    "name": "RGF"
  },
  "ctv": {
    "id": "1295401970567217302",
    "name": "CTV"
  },
  "viztv": {
    "id": "1295407859411976286",
    "name": "VIZTV",
    "icon": "https://cdn.discordapp.com/emojis/1292588813302104124.webp",
    "archived": true
  },
  "icn": {
    "id": "1303766708884082761",
    "name": "ICN",
    "icon": "https://cdn.discordapp.com/emojis/1304605035841454100.webp",
    "archived": true
  },
  "FINUTRIA": {
    "id": "1315364496268591255",
    "name": "FINUTRIA"
  },
  "aztv": {
    "id": "1316575386133467207",
    "name": "AZTV"
  },
  "logy": {
    "id": "1316517709219106856",
    "name": "LOGY"
  },
  "balls": {
    "id": "1318542642761699338",
    "name": "BALLS"
  },
  "eupraxia": {
    "id": "1061312488395780106",
    "name": "Eupraxia",
    "useEmbeds": true
  },
  "1-channel": {
    "name": "1 Channel",
    "source": "rss",
    "url": "https://1channelnews.weebly.com/2/feed"
  }
} as unknown as Record<string, FeedData>
const setupFeed = async (feedId: string, data: FeedData) => {
  if (data.source === "rss") {
    const parser = new Parser();
    const items = (await parser.parseURL(data.url!)).items;
    const parsed = [];
    for (const item of items) {
      parsed.push({
        createdTimestamp: (new Date(item.pubDate!)).getTime(),
        content: `<div class="newsPost">
        <i>Written on <b>${item.pubDate}</b></i><br />
        ${item["content:encoded"]}
        <a href="/feeds/${feedId}/post/${item.guid?.split("/").at(-1)}">Link to post for sharing</a><br />
        <a href="${item.link}">View original post</a>
      </div>`,
        guid: item.guid,
        contentSnippet: item.contentSnippet,
        title: item.title,
        raw: item["content:encoded"],
        url: item.link
      })
    }
    data.parsed = parsed;
    return;
  }
  const channel = await client.channels.fetch(data.id) as TextChannel
  const messages = await fetchMessages(channel)
  data.messages = messages;
  data.parsed = await generatePostList(messages, "/feeds/" + feedId + "/post/", data.useEmbeds ?? false);
  data.rss = await preRenderRSS(messages, data.useEmbeds ?? false);
}

for (const [feedId, data] of Object.entries(feeds)) {
  await setupFeed(feedId, data)
}
const port = 3000
app.get('/', async (req, res) => {
  res.send(generatePage("News List", parsedMessages.slice(+(req.query.page ?? 1) * 50 - 50, +(req.query.page ?? 1) * 50).map(post => post.content).join("") + `<br />${+req.query.page! > 1 ? `<a href="/?page=${+req.query.page! - 1}">Previous Page</a> ` : ""}<a href="/?page=${+(req.query.page ?? 1) + 1}">Next Page</a>`, `<meta property="og:title" content="News List">
<meta property="og:description" content="Start reading MGTV24 news articles online today.">
<meta property="og:site_name" content="MGTV24 Web &bull; ${parsedMessages.length} articles">
<script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "NewsMediaOrganization",
    "url": "https://mgtv24-web.onrender.com/",
    "logo": "https://mgtv24-web.onrender.com/static/MGTV24-News.webp",
    "name": "MGTV24 Web",
    "description": "MGTV24 Web is a service offering online access to GVW community news outlets.",
    "foundingDate": "2024-09-08",
    "alternateName": "MGTV Web"
  }
</script>
<meta name="google-site-verification" content="CS2R1mgmbqua1COlvWpTespoQ9_UugLwysgSEsU4buw" />`, req))
})
app.get('/search', async (req, res) => {
  if (!req.query.query) return res.redirect("/")
  const results = parsedMessages.filter(data => data.content.replaceAll(/(<br \/>|^)\s*<i>.+?<\/i>/gs, "").toLowerCase().replaceAll(/\s/g, "").includes((req.query.query as string).toLowerCase().replaceAll(/\s/g, ""))).map(post => post.content)
  res.send(generatePage(`Search - ${req.query.query}`, `<span>${results.length} results</span>` + results.slice(+(req.query.page ?? 1) * 50 - 50, +(req.query.page ?? 1) * 50).join("") + `<br />${+req.query.page! > 1 ? `<a href="/search?query=${req.query.query}&page=${+req.query.page! - 1}">Previous Page</a> ` : ""}<a href="/search?query=${req.query.query}&page=${+(req.query.page ?? 1) + 1}">Next Page</a>`, `<meta property="og:title" content="${req.query.query} - Search">
  <meta property="og:description" content="Find out the search results for ${req.query.query} today here at MGTV24 Web.">
  <meta property="og:site_name" content="MGTV24 Web &bull; ${parsedMessages.length} articles">`, req))
})
app.get('/post/:post', async (req, res) => {
  const message = await mgtvChannel.messages.fetch(req.params.post)
  const postData = await MessageASTNodes(parse(message.content, "extended"))
  res.send(generatePage(escapeHtml(await MessageASTNodesPlaintext(parse(getHeading(message.content) ?? "Post")) ?? "") ?? "Post", `<div><i>Written by <b>${message.author.displayName}</b> on <b>${message.createdAt.toLocaleString('en-US', { timeZone: "Europe/Berlin", dateStyle: "medium" })}</b></i><br />
    ${minify(parseHeadings(postData ?? ""), {
      "collapseWhitespace": true
    }).replaceAll("<!-- split -->", "")}
    ${message.attachments.size > 0 ? `
      <div class="attachmentList">
      ${[...message.attachments.values()].map(attachment => `<img src="${attachment.proxyURL}" alt="${attachment.description ?? attachment.name + " attachment"}" class="attachment">`).join("")}
      </div>
    ` : ""}</div>
  <h2>Other Recent Posts</h2>
    ${parsedMessages.slice(0, 50).map(post => post.content).join("")}<br/><a href="/?page=2">See more</a>`, `<meta property="og:title" content="${escapeHtml(await MessageASTNodesPlaintext(parse(getHeading(message.content) ?? "Post")) ?? "") ?? "Post"}">
    <meta property="og:description" content="${escapeHtml(await MessageASTNodesPlaintext(parse(message.content)) ?? "")}">
    <meta property="og:site_name" content="MGTV24 Web &bull; ${parsedMessages.length} articles">
    <link type="application/json+oembed" href="https://${req.get("host")}/post/${req.params.post}/oembed.json" />
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "NewsArticle",
      "headline": "${escapeHtml(await MessageASTNodesPlaintext(parse(getHeading(message.content) ?? "MGTV " + await message.createdAt.toLocaleString('en-US', { timeZone: "Europe/Berlin", dateStyle: "short" }))) ?? "")?.trim() ?? "Post"}",
      "datePublished": "${message.createdAt.toISOString()}",${message.editedAt ? `
      "dateModified": "${message.editedAt.toISOString()}",` : ""}
      "author": [
        {
          "@type": "${message.webhookId ? ((await (message.channel as TextChannel).fetchWebhooks()).get(message.webhookId)?.type === WebhookType.ChannelFollower ? "Organization" : "Person") : "Person"}",
          "name": "${message.author.displayName}"
        }
      ]
    }
    </script>`, req))
})
app.get('/post/:post/oembed.json', async (req, res) => {
  const message = await mgtvChannel.messages.fetch(req.params.post)
  res.send({
    "author_name": message.author.displayName + " \u2022 " + message.createdAt.toLocaleString('en-US', { timeZone: "Europe/Berlin", dateStyle: "medium" }),
    "author_url": "https://discord.com/channels/" + message.guild.id + "/" + message.channel.id + "/" + message.id
  })
})
app.get('/feed.rss', async (req, res) => {
  res.set("Content-Type", "application/rss+xml").send(`<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
 <title>MGTV24</title>
 <description>Bringing you news from the community.</description>
 <link>https://${req.get("host")}</link>
 <docs>https://www.rssboard.org/rss-specification</docs>
 <atom:link href="https://${req.get("host")}/feed.rss" rel="self" type="application/rss+xml" />
 ${req.query.max ? (await generateRSSList(req, sortedMessages, preRenderedRSS)).slice(+(req.query.page ?? 0) * +req.query.max, +(req.query.page ?? 0) * +req.query.max + +req.query.max).join("\n") : (await generateRSSList(req, sortedMessages, preRenderedRSS)).join("\n")}
</channel>
</rss>`)
})

const getFeed = (req: express.Request, res: express.Response) => {
  const feed = feeds[req.params.feed];
  if (!feed) {
    const alias = Object.entries(feeds).find(feed => feed[1].aliases?.includes(req.params.feed))?.[0];
    if (alias) {
      res.redirect(308, req.path.replace(req.params.feed, alias))
    } else {
      res.status(404).send(generatePage("Feed Not Found", "Feed not found.", "", req));
    }
    return null;
  };
  return feed;
}
app.get('/feeds/:feed', async (req, res) => {
  const feed = getFeed(req, res);
  if (!feed) return;
  res.send(generatePage(feed.name + " News", feed.parsed.slice(+(req.query.page ?? 1) * 50 - 50, +(req.query.page ?? 1) * 50).map(post => post.content).join("") + `<br />${+req.query.page! > 1 ? `<a href="/feeds/${req.params.feed}?page=${+req.query.page! - 1}">Previous Page</a> ` : ""}<a href="/feeds/${req.params.feed}?page=${+(req.query.page ?? 1) + 1}">Next Page</a>`, `<meta property="og:title" content="News List">
<meta property="og:description" content="Start reading MGTV24 news articles online today.">
<meta property="og:site_name" content="MGTV24 Web &bull; ${feed.parsed.length} ${feed.name} articles">`, req))
})

app.get('/feeds/:feed/post/:post', async (req, res) => {
  const feed = getFeed(req, res);
  if (!feed) return;
  if (feed.source === "rss") {
    await setupFeed(req.params.feed, feed);
    const post = feed.parsed.find(item => item.guid?.split("/").at(-1) === req.params.post);
    if (!post) {
      return void res.status(404).send(generatePage("Post not found", "Post not found.", "", req))
    }
    res.send(generatePage(post.title!, `<div>
        <i>Written on <b>${(new Date(post.createdTimestamp)).toLocaleString('en-US', { timeZone: "Europe/Berlin", dateStyle: "medium" })}</b></i><br />
        <a href="${post.url}">View original post</a>
        ${post.raw}
      </div>
      <h2>Other Recent Posts</h2>
      ${feed.parsed.slice(0, 50).map(post => post.content).join("")}<br/><a href="/feeds/${req.params.feed}/?page=2">See more</a>`, `<meta property="og:title" content="${post.title}">
    <meta property="og:description" content="${post.contentSnippet}">
    <meta property="og:site_name" content="MGTV24 Web &bull; ${parsedMessages.length} articles">
    <link type="application/json+oembed" href="https://${req.get("host")}/post/${req.params.post}/oembed.json" />`, req))
    return;
  }
  const message = await (await client.channels.fetch(feed.id) as TextChannel).messages.fetch(req.params.post)
  const content = feed.useEmbeds && message.embeds.length > 0 && message.embeds[0].description ? (message.embeds[0].title ? "# " + message.embeds[0].title + "\n\n" : "") + message.embeds[0].description : message.content;
  const postData = await MessageASTNodes(parse(content, "extended"))
  const heading = getHeading(content) ?? getSecondaryHeading(content)
  res.send(generatePage(escapeHtml(await MessageASTNodesPlaintext(parse(heading ?? "Post")) ?? "") ?? "Post", `<div><i>Written by <b>${message.author.displayName}</b> on <b>${message.createdAt.toLocaleString('en-US', { timeZone: "Europe/Berlin", dateStyle: "medium" })}</b></i><br />
    ${minify(parseHeadings(postData ?? ""), {
      "collapseWhitespace": true
    }).replaceAll("<!-- split -->", "")}
    ${message.attachments.size > 0 || (feed.useEmbeds && message.embeds.length > 0 && message.embeds[0].image) ? `
      <div class="attachmentList">
      ${[...message.attachments.values(), ...(feed.useEmbeds && message.embeds.length > 0 && message.embeds[0].image ? [{...message.embeds[0].image, name: null, description: "Feed image"}] : [])].map(attachment => `<img src="${attachment.proxyURL}" alt="${attachment.description ?? attachment.name + " attachment"}" class="attachment">`).join("")}
      </div>
    ` : ""}</div>
  <h2>Other Recent Posts</h2>
    ${feed.parsed.slice(0, 50).map(post => post.content).join("")}<br/><a href="/feeds/${req.params.feed}/?page=2">See more</a>`, `<meta property="og:title" content="${escapeHtml(await MessageASTNodesPlaintext(parse(heading ?? "Post")) ?? "") ?? "Post"}">
    <meta property="og:description" content="${escapeHtml(await MessageASTNodesPlaintext(parse(content)) ?? "")}">
    <meta property="og:site_name" content="MGTV24 Web &bull; ${parsedMessages.length} articles">
    <link type="application/json+oembed" href="https://${req.get("host")}/post/${req.params.post}/oembed.json" />
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "NewsArticle",
      "headline": "${escapeHtml(await MessageASTNodesPlaintext(parse(getHeading(message.content) ?? feed.name + " " + await message.createdAt.toLocaleString('en-US', { timeZone: "Europe/Berlin", dateStyle: "short" }))) ?? "")?.trim() ?? "Post"}",
      "datePublished": "${message.createdAt.toISOString()}",${message.editedAt ? `
      "dateModified": "${message.editedAt.toISOString()}",` : ""}
      "author": [
        {
          "@type": "${message.webhookId ? ((await (message.channel as TextChannel).fetchWebhooks()).get(message.webhookId)?.type === WebhookType.ChannelFollower ? "Organization" : "Person") : "Person"}",
          "name": "${message.author.displayName}"
        }
      ]
    }
    </script>`, req))
})
app.get('/feeds/:feed/feed.rss', async (req, res) => {
  const feed = getFeed(req, res);
  if (!feed) return;
  if (feed.source === "rss") {
    const rssList = feed.parsed.map(item => `<item>
      <title>${item.title}</title>
      <link>https://${req.get("host")}/post/${item.guid?.split("/").at(-1)}</link>
      <description><![CDATA[${item.raw}]]></description>
      <pubDate>${(new Date(item.createdTimestamp)).toUTCString()}</pubDate>
      <guid isPermaLink="false">${item.guid?.split("/").at(-1)}</guid>
    </item>`);
    return void res.set("Content-Type", "application/rss+xml").send(`<?xml version="1.0" encoding="UTF-8" ?>
  <rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
   <title>${feed.name}</title>
   <description>MGTV24-Web news feed</description>
   <link>https://${req.get("host")}</link>
   <docs>https://www.rssboard.org/rss-specification</docs>
   <atom:link href="https://${req.get("host")}/feeds/${req.params.feed}/feed.rss" rel="self" type="application/rss+xml" />
   ${(req.query.max ? rssList.slice(+(req.query.page ?? 0) * +req.query.max, +(req.query.page ?? 0) * +req.query.max + +req.query.max) : rssList).join("\n")}
  </channel>
  </rss>`)
  }
  res.set("Content-Type", "application/rss+xml").send(`<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
 <title>${feed.name}</title>
 <description>MGTV24-Web news feed</description>
 <link>https://${req.get("host")}</link>
 <docs>https://www.rssboard.org/rss-specification</docs>
 <atom:link href="https://${req.get("host")}/feeds/${req.params.feed}/feed.rss" rel="self" type="application/rss+xml" />
 ${req.query.max ? (await generateRSSList(req, feed.messages, feed.rss)).slice(+(req.query.page ?? 0) * +req.query.max, +(req.query.page ?? 0) * +req.query.max + +req.query.max).join("\n") : (await generateRSSList(req, feed.messages, feed.rss)).join("\n")}
</channel>
</rss>`)
})
app.get('/feeds/:feed/search', async (req, res) => {
  const feed = getFeed(req, res);
  if (!feed) return;
  if (!req.query.query) return res.redirect("/feeds/" + req.query.feed)
  const results = feed.parsed.filter(data => data.content.replaceAll(/(<br \/>|^)\s*<i>.+?<\/i>/gs, "").toLowerCase().replaceAll(/\s/g, "").includes((req.query.query as string).toLowerCase().replaceAll(/\s/g, ""))).map(post => post.content)
  res.send(generatePage(`Search - ${req.query.query}`, `<span>${results.length} results</span>` + results.slice(+(req.query.page ?? 1) * 50 - 50, +(req.query.page ?? 1) * 50).join("") + `<br />${+req.query.page! > 1 ? `<a href="/feeds/${req.params.feed}/search?query=${req.query.query}&page=${+req.query.page! - 1}">Previous Page</a> ` : ""}<a href="/feeds/${req.params.feed}/search?query=${req.query.query}&page=${+(req.query.page ?? 1) + 1}">Next Page</a>`, `<meta property="og:title" content="${req.query.query} - Search">
  <meta property="og:description" content="Find out the search results for ${req.query.query} today here at MGTV24 Web.">
  <meta property="og:site_name" content="MGTV24 Web &bull; ${feed.parsed.length} ${feed.name} articles">`, req))
})

app.get('/all', async (req, res) => {
  const allMessages = [...parsedMessages];
  for (const feed of Object.values(feeds)) {
    allMessages.push(...feed.parsed)
  }
  const sortedMessages = allMessages.sort((a, b) => b.createdTimestamp - a.createdTimestamp)
  res.send(generatePage("All News", sortedMessages.slice(+(req.query.page ?? 1) * 50 - 50, +(req.query.page ?? 1) * 50).map(post => post.content).join("") + `<br />${+req.query.page! > 1 ? `<a href="/all?page=${+req.query.page! - 1}">Previous Page</a> ` : ""}<a href="/all?page=${+(req.query.page ?? 1) + 1}">Next Page</a>`, `<meta property="og:title" content="News List">
<meta property="og:description" content="Start reading MGTV24 news articles online today.">
<meta property="og:site_name" content="MGTV24 Web &bull; ${parsedMessages.length} articles">`, req))
})

app.get('/all/search', async (req, res) => {
  const allMessages = [...parsedMessages];
  for (const feed of Object.values(feeds)) {
    allMessages.push(...feed.parsed)
  }
  const sortedMessages = allMessages.sort((a, b) => b.createdTimestamp - a.createdTimestamp)
  if (!req.query.query) return res.redirect("/all")
  const results = sortedMessages.filter(data => data.content.replaceAll(/(<br \/>|^)\s*<i>.+?<\/i>/gs, "").toLowerCase().replaceAll(/\s/g, "").includes((req.query.query as string).toLowerCase().replaceAll(/\s/g, ""))).map(post => post.content)
  res.send(generatePage(`Search - ${req.query.query}`, `<span>${results.length} results</span>` + results.slice(+(req.query.page ?? 1) * 50 - 50, +(req.query.page ?? 1) * 50).join("") + `<br />${+req.query.page! > 1 ? `<a href="/all/search?query=${req.query.query}&page=${+req.query.page! - 1}">Previous Page</a> ` : ""}<a href="/all/search?query=${req.query.query}&page=${+(req.query.page ?? 1) + 1}">Next Page</a>`, `<meta property="og:title" content="${req.query.query} - Search">
  <meta property="og:description" content="Find out the search results for ${req.query.query} today here at MGTV24 Web.">
  <meta property="og:site_name" content="MGTV24 Web &bull; ${sortedMessages.length} articles in total">`, req))
})
app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})

app.get('/all/feed.rss', async (req, res) => {
  let allRSS = {...preRenderedRSS};
  for (const feed of Object.values(feeds)) {
    allRSS = {...allRSS, ...feed.rss}
  }
  let allMessages = [...sortedMessages];
  for (const feed of Object.values(feeds)) {
    allMessages.push(...feed.messages)
  }
  allMessages = allMessages.sort((a, b) => b.createdTimestamp - a.createdTimestamp)
  res.set("Content-Type", "application/rss+xml").send(`<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
 <title>Mijovia All Stations</title>
 <description>Relayed from Mijovia.</description>
 <link>https://${req.get("host")}</link>
 <docs>https://www.rssboard.org/rss-specification</docs>
 <atom:link href="https://${req.get("host")}/all/feed.rss" rel="self" type="application/rss+xml" />
 ${req.query.max ? (await generateRSSList(req, allMessages, allRSS)).slice(+(req.query.page ?? 0) * +req.query.max, +(req.query.page ?? 0) * +req.query.max + +req.query.max).join("\n") : (await generateRSSList(req, allMessages, allRSS)).join("\n")}
</channel>
</rss>`)
})

app.get('/archives', async (req, res) => {
  res.send(generatePage("Archives", `<div id="archives">
${Object.entries(feeds).filter(feed => feed[1].archived).map(feed => `
<a href="/feeds/${feed[0]}">${feed[1].icon ? `<img src="${feed[1].icon}">` : ""}${feed[1].name}</a>
`).join("\n")}
</div>`, `<meta property="og:title" content="News List">
<meta property="og:description" content="Start reading MGTV24 news articles online today.">
<meta property="og:site_name" content="MGTV24 Web &bull; ${parsedMessages.length} articles">
<link rel="stylesheet" href="/static/archives.css">`, req))
})

app.get('/robots.txt', async (req, res) => {
  await res.set("Content-Type", "text/plain").send(`User-agent: *
Allow: /

Sitemap: ${req.get("host")}/sitemap-index.xml`);
});
app.get('/sitemap-index.xml', async (req, res) => {
  await res.set("Content-Type", "application/xml").send(`<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://${req.get("host")}/sitemap-0.xml</loc>
  </sitemap>
</sitemapindex>`);
});
app.get('/sitemap-0.xml', async (req, res) => {
  const allMessages = sortedMessages.map(message => `<url>
  <loc>https://${req.get("host")}/post/${message.id}</loc>
  <lastmod>${message.createdAt.toISOString()}</lastmod>
</url>`);
  for (const [id, feed] of Object.entries(feeds)) {
    if (feed.messages) {
      allMessages.push(...feed.messages.map(message => `<url>
  <loc>https://${req.get("host")}/feeds/${id}/post/${message.id}</loc>
  <lastmod>${message.createdAt.toISOString()}</lastmod>
</url>`))
    } else {
      allMessages.push(...feed.parsed.map(post => `<url>
  <loc>https://${req.get("host")}/feeds/${id}/post/${post.guid?.split("/").at(-1)}</loc>
  <lastmod>${(new Date(post.createdTimestamp)).toISOString()}</lastmod>
</url>`))
    }
  }
  await res.set("Content-Type", "text/plain").send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${Object.keys(feeds).map(id => `<url>
https://mgtv24-web.onrender.com/feed/${id}
</url>`).join("\n")}
  ${allMessages.join("\n")}
</urlset>`);
});

client.on(Events.MessageCreate, async message => {
  if (message.channel.id === mgtvChannel.id) return await setupMessages()
  for (const [feedId, data] of Object.entries(feeds)) {
    if (data.id === message.channel.id) await setupFeed(feedId, data);
  };
});

client.on(Events.MessageUpdate, async message => {
  if (message.channel.id === mgtvChannel.id) return await setupMessages()
  for (const [feedId, data] of Object.entries(feeds)) {
    if (data.id === message.channel.id) await setupFeed(feedId, data);
  };
})
client.on(Events.MessageDelete, async message => {
  if (message.channel.id === mgtvChannel.id) return await setupMessages()
  for (const [feedId, data] of Object.entries(feeds)) {
    if (data.id === message.channel.id) await setupFeed(feedId, data);
  };
})