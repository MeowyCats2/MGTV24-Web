import express from "express";
import "express-async-errors";
import { parse } from 'discord-markdown-parser';

// Require the necessary discord.js classes
import { Client, Events, GatewayIntentBits, TextChannel, Message } from "discord.js";

// Create a new client instance
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// When the client is ready, run this code (only once).
// The distinction between `client: Client<boolean>` and `readyClient: Client<true>` is important for TypeScript developers.
// It makes some properties non-nullable.
client.once(Events.ClientReady, readyClient => {
	console.log(`Ready! Logged in as ${readyClient.user.tag}`);
});

// Log in to Discord with your client's token
await client.login(process.env.token);

const mgtvChannel: TextChannel = (await client.channels.fetch("1217494766397296771") as TextChannel)
const messages: Message[] = [];
let before = null;
while (1) {
    const newMessages = await mgtvChannel.messages.fetch({
        limit: 100,
        before
    })
    if (newMessages.size === 0) break;
    messages.unshift(...[...newMessages.values()]);
    console.log("before: " + before)
    before = ([...newMessages.values()] as Message[]).at(-1)!.id;
}
const sortedMessages = messages.sort((a, b) => b.createdTimestamp - a.createdTimestamp)
console.log("done!")

const MessageASTNodes = async (nodes) => {
    if (Array.isArray(nodes)) {
      const parsedNodes = []
      for (const node of nodes) {
        parsedNodes.push(await MessageSingleASTNode(node))
      }
      return parsedNodes.join("\n")
    } else {
      return await MessageSingleASTNode(nodes)
    }
}
  
const MessageSingleASTNode = async (node) => {
    if (!node) return null;
  
    const type = node.type;
  
    switch (type) {
      case 'text':
        return node.content;
  
      case 'link':
        return `
          <a href=${node.target}>
            ${await MessageASTNodes(node.content)}
          </a>
        `;
  
      case 'url':
      case 'autolink':
        return `
          <a href="${node.target}" target="_blank" rel="noreferrer">
            ${await MessageASTNodes(node.content)}
          </a>
        `;
  
      case 'blockQuote':
        return `
          <blockquote>
            ${await MessageASTNodes(node.content)}
          </blockquote>
        `;
  
      case 'br':
      case 'newline':
        return "<br />";
  
      case 'channel': {
        const id = node.id as string;
        return "#" + (await client.channels.fetch(id))?.name;
      }
  
      case 'role': {
        const id = node.id as string;
        return "@" + (await mgtvChannel.guild.roles.fetch(id))?.name;
      }
  
      case 'user': {
        const id = node.id as string;
        const user = await client.users.fetch(id);
        return "#" + (user.displayName ?? user.username);
      }
  
      case 'here':
      case 'everyone':
        return "@" + node.type
  
      case 'codeBlock':
        return `
          <code>${node.lang}</code>
          <blockquote>
            ${await MessageASTNodes(node.content)}
          </blockquote>
        `;
  
      case 'inlineCode':
        return `
          <code>${await MessageASTNodes(node.content)}</code>
        `;
  
      case 'em':
        return `
          <i>${await MessageASTNodes(node.content)}</i>
        `;
  
      case 'strong':
        return `
          <b>${await MessageASTNodes(node.content)}</b>
        `;
  
      case 'underline':
        return `
          <u>${await MessageASTNodes(node.content)}</u>
        `;
  
      case 'strikethrough':
        return `
          <s>${await MessageASTNodes(node.content)}</s>
        `;
  
      case 'emoticon':
        return typeof node.content === 'string' ? (
          node.content
        ) : (
          await MessageASTNodes(node.content)
        );
  
      case 'spoiler':
        return `
          <span class="spoiler">${await MessageASTNodes(node.content)}</span>
        `;
  
      case 'emoji':
      case 'twemoji':
        const emoji = await client.emojis.resolve(node.id)
        return emoji ? `<image class="emoji" src="${emoji.imageURL()}">` : node.name;
  
      case 'timestamp':
        return node.timestamp + " (" + node.format + ")"
  
      default: {
        return type + ": " + (typeof node.content === 'string' ? (
          node.content
        ) : (
          await MessageASTNodes(node.content)
        ));
      }
    }
  }
  

  const MessageASTNodesPlaintext = async (nodes) => {
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
  
const MessageSingleASTNodePlaintext = async (node) => {
    if (!node) return null;
  
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
        return "#" + (await client.channels.fetch(id))?.name;
      }
  
      case 'role': {
        const id = node.id as string;
        return "@" + (await mgtvChannel.guild.roles.fetch(id))?.name;
      }
  
      case 'user': {
        const id = node.id as string;
        const user = await client.users.fetch(id);
        return "#" + (user.displayName ?? user.username);
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
        return;
  
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
  
const generatePage = (title: string, content: string, meta: string) => `<!DOCTYPE html>
<html>
    <head>
        <title>${title} - MGTV24 News</title>
        <link rel="stylesheet" href="/static/styles.css">
        ${meta}
    </head>
    <body>
        <header>
            <image src="/static/MGTV24-News.webp" class="emoji"> MGTV24 News <image src="/static/MGTV24-News.webp" class="emoji">
            <form action="/search">
                <input type="text" name="query" placeholder="Search...">
                <input type="submit" value="Search">
            </form>
        </header>
        <main>
            ${content}
        </main>
    </body>
</html>`
const parseHeadings = (content: String) => content.replaceAll(/(\n|^)\s*#\s(.+?)(<br \/>|$)/gs, "<h1>$2</h1>")
const getHeading = (content: String) => content.match(/^#\s(.+?)$/m)?.[1]
const app = express()
app.use("/static", express.static("static"))
const generatePostList = async () => {
  const parsedMessages = []
  for (const message of sortedMessages) {
    parsedMessages.push(`<div class="newsPost">
      <i>Written by <b>${message.author.displayName}</b> on <b>${message.createdAt.toLocaleString('en-US', { timeZone: "Europe/Berlin", dateStyle: "medium" })}</b></i><br />
      ${parseHeadings(await MessageASTNodes(parse(message.content, "extended")))}<br/><br/>
      ${message.attachments.size ? message.attachments.size + " attachments<br />" : ""}
      <a href="/post/${message.id}">Link to post for sharing</a>
    </div>`)
  }
  return parsedMessages
}
const parsedMessages = await generatePostList()
const port = 3000
app.get('/', async (req, res) => {
  res.send(generatePage("News List", parsedMessages.slice(+(req.query.page ?? 1) * 50 - 50, +(req.query.page ?? 1) * 50).join("") + `<br />${+req.query.page! > 1 ? `<a href="/?page=${+req.query.page! - 1}">Previous Page</a> ` : ""}<a href="/?page=${+(req.query.page ?? 1) + 1}">Next Page</a>`, `<meta property="og:title" content="News List">
<meta property="og:description" content="Start reading MGTV24 news articles online today.">
<meta property="og:site_name" content="MGTV24 Web &bull; ${parsedMessages.length} articles">`))
})
app.get('/search', async (req, res) => {
  if (!req.query.query) return res.redirect("/")
  const results = parsedMessages.filter(data => data.replaceAll(/(<br \/>|^)\s*<i>.+?<\/i>/gs, "").toLowerCase().replaceAll(/\s/g, "").includes(req.query.query!.toLowerCase().replaceAll(/\s/g, "")))
  res.send(generatePage(`Search - ${req.query.query}`, `<span>${results.length} results</span>` + results.slice(+(req.query.page ?? 1) * 50 - 50, +(req.query.page ?? 1) * 50).join("") + `<br />${+req.query.page! > 1 ? `<a href="/search?query=${req.query.query}&page=${+req.query.page! - 1}">Previous Page</a> ` : ""}<a href="/?query=${req.query.query}&page=${+(req.query.page ?? 1) + 1}">Next Page</a>`, `<meta property="og:title" content="${req.query.query} - Search">
  <meta property="og:description" content="Find out the search results for ${req.query.query} today here at MGTV24 Web.">
  <meta property="og:site_name" content="MGTV24 Web &bull; ${parsedMessages.length} articles">`))
})
const escapeHtml = (unsafe) => {
  return unsafe.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}
app.get('/post/:post', async (req, res) => {
  const message = await mgtvChannel.messages.fetch(req.params.post)
  const postData = await MessageASTNodes(parse(message.content, "extended"))
  res.send(generatePage(escapeHtml(await MessageASTNodesPlaintext(parse(getHeading(message.content) ?? "Post"))) ?? "Post", `<div><i>Written by <b>${message.author.displayName}</b> on <b>${message.createdAt.toLocaleString('en-US', { timeZone: "Europe/Berlin", dateStyle: "medium" })}</b></i><br />
    ${parseHeadings(postData)}
    ${message.attachments.size > 0 ? `
      <div class="attachmentList">
      ${[...message.attachments.values()].map(attachment => `<img src="${attachment.proxyURL}" class="attachment">`).join("")}
      </div>
    ` : ""}</div>
  <h2>Other Recent Posts</h2>
    ${parsedMessages.slice(0, 50).join("")}<br/><a href="/?page=2">See more</a>`, `<meta property="og:title" content="${escapeHtml(await MessageASTNodesPlaintext(parse(getHeading(message.content) ?? "Post"))) ?? "Post"}">
    <meta property="og:description" content="${escapeHtml(await MessageASTNodesPlaintext(parse(message.content)))}">
    <meta property="og:site_name" content="MGTV24 Web &bull; ${parsedMessages.length} articles">
    <link type="application/json+oembed" href="/post/${req.params.post}/oembed.json" />`))
})
app.get('/post/:post/oembed.json', async (req, res) => {
  const message = await mgtvChannel.messages.fetch(req.params.post)
  res.send({
    "author_name": message.author.displayName + " \u2022 " + message.createdAt.toLocaleString('en-US', { timeZone: "Europe/Berlin", dateStyle: "medium" })
  })
})
app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
