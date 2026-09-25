# Slides Chat: a fake AI chat for Quarto revealjs

[![Quarto extension](https://img.shields.io/badge/Quarto-%E2%89%A5%201.4-75AADB?logo=quarto&logoColor=white&labelColor=1a1b26)](https://quarto.org/docs/extensions/)
[![revealjs plugin](https://img.shields.io/badge/revealjs-plugin-d97757?logo=revealdotjs&logoColor=white&labelColor=1a1b26)](https://quarto.org/docs/presentations/revealjs/)
[![Version](https://img.shields.io/badge/dynamic/yaml?url=https%3A%2F%2Fraw.githubusercontent.com%2Flinogaliana%2Fquarto-extension-slides-chat%2Fmain%2F_extensions%2Fslides-chat%2F_extension.yml&query=%24.version&label=version&color=50abf1&labelColor=1a1b26)](_extensions/slides-chat/_extension.yml)
[![Publish example slides](https://github.com/linogaliana/quarto-extension-slides-chat/actions/workflows/publish.yml/badge.svg)](https://github.com/linogaliana/quarto-extension-slides-chat/actions/workflows/publish.yml)
[![Live demo](https://img.shields.io/badge/%E2%96%B6%20demo-live%20slides-50abf1?labelColor=1a1b26)](https://linogaliana.github.io/quarto-extension-slides-chat/)
[![License: MIT](https://img.shields.io/badge/license-MIT-9ece6a?labelColor=1a1b26)](LICENSE)

This Quarto extension shows a conversation with an AI inside a `revealjs` presentation,
styled like a command-line agent:

- a dark terminal with a monospace font;
- the person's messages are `>` prompt lines inside an input box;
- the AI "thinks" (typing dots, blinking logo), then its answer streams in word by word, while code blocks and images fade in;
- every message is a fragment, so you step forward and back with the arrow keys.

![Demo of slides-chat](media/demo.gif)

<details>
<summary>▶ Full walkthrough of every example slide (1 min 40)</summary>

![Full walkthrough of the example slides](media/demo-full.gif)

Also available as a [video](media/demo.mp4).

</details>

## Installation

```bash
quarto add linogaliana/quarto-extension-slides-chat
```

This installs the extension under `_extensions/slides-chat/`. Commit that folder along with your project.

## Usage

```yaml
---
format: revealjs
revealjs-plugins:
  - slides-chat
slides-chat:
  user: Lino
  assistant: CodeBot
  logo: assets/logo.svg
  color: "#50abf1"
---
```

````markdown
## A conversation

:::: {.slides-chat}

::: {.user}
Can you help me write my first program?
:::

::: {.assistant .fragment .typing}
Sure! Here is an example:

```python
print("Hello!")
```
:::

::::
````

| Class | Role |
|---|---|
| `.slides-chat` | Container for the conversation |
| `.user` | Message from the person |
| `.assistant` | Message from the AI |
| `.fragment` | The message appears on the next step (otherwise it is visible right away) |
| `.typing` | Typing dots first, then the text on the next step (word by word for the AI) |

See [example.qmd](example.qmd) for a full example, and the
[rendered slides](https://linogaliana.github.io/quarto-extension-slides-chat/) to see it in action.

## Options

Set options for the whole presentation in the `slides-chat:` YAML block, or for a single chat
with an attribute of the same name: `:::: {.slides-chat assistant="Bot" welcome="false"}`.

| Option | Default | Description |
|---|---|---|
| `user` | *(none)* | Name shown above the person's messages |
| `assistant` | `Assistant` | Name of the AI |
| `logo` | orange asterisk | Image for the AI's blinking avatar (path relative to the document, or URL) |
| `color` | `#d97757` | AI colour: name, banner, typing dots |
| `welcome` | `✱  <assistant>` | Welcome banner text. `false` hides it |
| `background` | `#1a1b26` | Background of slides that contain a chat. `false` keeps the theme's background. A `background-color` or `background-image` set on the slide takes precedence |

A single message can also take its own name, for example to show several people talking to the
AI: `::: {.user name="Alice"}`.

Every colour is a `--slides-chat-*` CSS variable (see
[slides-chat.css](_extensions/slides-chat/slides-chat.css)), which you can redefine in the
presentation's stylesheet:

```css
.slides-chat {
  --slides-chat-bg: #000;
  --slides-chat-prompt: #9ece6a;
}
```

## Credits

The initial inspiration for this extension is
[chat-bubbles](https://github.com/EmilHvitfeldt/quarto-revealjs-chat-bubbles) by Emil Hvitfeldt,
which fakes iMessage, Slack, Discord and Teams conversations in revealjs slides.
`slides-chat` builds on its foundations (message layout, typing dots, auto-scroll) and
specialises them for conversations with an AI: word-by-word streaming, blinking avatar,
welcome banner and YAML options.
