/* ==========================================================================
   Slides Chat — faux chat avec une IA, façon terminal d'agent CLI.

   Dérivé de l'extension chat-bubbles d'Emil Hvitfeldt
   (https://github.com/EmilHvitfeldt/quarto-revealjs-chat-bubbles), réduite
   à un seul thème : un transcript sombre où les réponses de l'assistant
   s'écrivent mot à mot pendant que son logo clignote.

   Balisage :
     :::: {.slides-chat}
     ::: {.user}        ... :::
     ::: {.assistant .fragment .typing} ... :::
     ::::

   Configuration (YAML du document, surchargeable par attribut sur .slides-chat) :
     slides-chat:
       user: "Lino"            # nom affiché pour la personne
       assistant: "parquetGPT" # nom de l'IA
       logo: "logo.svg"        # avatar clignotant de l'IA
       color: "#50abf1"        # couleur de l'IA (nom, bannière, points)
       welcome: "..."          # bannière d'accueil (false pour la masquer)
       background: "#1a1b26"   # fond des slides de chat (false pour garder)
   ========================================================================== */

window.RevealSlidesChat = function () {
  return {
    id: "RevealSlidesChat",
    init: function (deck) {

      const config = deck.getConfig().slidesChat || {};

      // Quarto rewrites non-standard attributes on a div to a data- prefix,
      // so `user="Lino"` reaches the DOM as data-user. Accept both spellings.
      function attr(el, name) {
        const value = el.getAttribute(name);
        return value !== null ? value : el.getAttribute('data-' + name);
      }

      // Per-chat attribute first, then the deck-wide YAML value.
      function option(chat, name) {
        const value = attr(chat, name);
        return value !== null ? value : config[name];
      }

      function isOff(value) {
        return value === false || value === 'false';
      }

      function roleOf(el) {
        if (el.classList.contains('user')) return 'user';
        if (el.classList.contains('assistant')) return 'assistant';
        return null;
      }

      // Every message gets the same scaffolding, so styling is CSS-only.
      function scaffold(el, name) {
        const text = document.createElement('div');
        text.className = 'bubble-text';
        while (el.firstChild) text.appendChild(el.firstChild);

        const avatar = document.createElement('span');
        avatar.className = 'bubble-avatar';
        avatar.setAttribute('aria-hidden', 'true');

        const label = document.createElement('span');
        label.className = 'bubble-name';
        if (name) label.textContent = name;

        el.append(avatar, label, text);
      }

      // Normalize authoring markup into the attributes the CSS targets.
      // Runs synchronously from init() rather than on 'ready': Reveal keeps
      // slides hidden until it is ready, so doing this early avoids a flash of
      // unstyled messages, and lets Reveal build the slide background from the
      // data-background-color set here.
      function normalizeChat(chat) {
        const names = {
          user: option(chat, 'user') || '',
          assistant: option(chat, 'assistant') || ''
        };

        // A relative url() inside a custom property resolves against the
        // stylesheet that uses it (this extension's CSS), not the document,
        // so make it absolute first.
        const logo = option(chat, 'logo');
        if (logo) {
          const href = new URL(logo, document.baseURI).href;
          chat.style.setProperty('--slides-chat-logo', `url("${href}")`);
        }

        const color = option(chat, 'color');
        if (color) chat.style.setProperty('--slides-chat-assistant', color);

        // CLI-style welcome banner, defaulting to the assistant's name. Kept in
        // its own attribute: Quarto already turns `welcome=` into data-welcome.
        const welcome = option(chat, 'welcome');
        if (!isOff(welcome)) {
          const banner = welcome || (names.assistant ? '✱  ' + names.assistant : '');
          if (banner) chat.dataset.banner = banner;
        }

        const background = option(chat, 'background');
        const slide = chat.closest('section');
        if (slide && background && !isOff(background) &&
            !slide.hasAttribute('data-background-color') &&
            !slide.hasAttribute('data-background-image')) {
          slide.setAttribute('data-background-color', background);
        }
        if (slide) slide.classList.add('slides-chat-slide');

        // A per-message name= can put two people on the same role, so a turn
        // only "continues" when both the role and the name are unchanged.
        let previousSpeaker = null;
        Array.from(chat.children).forEach(el => {
          const role = roleOf(el);
          if (role === null) return;
          el.dataset.role = role;

          const name = attr(el, 'name') || names[role];
          if (name) el.dataset.speaker = name;

          const speaker = role + '|' + name;
          if (speaker === previousSpeaker) el.dataset.continues = '';
          previousSpeaker = speaker;

          scaffold(el, name);
        });
      }

      function isMessage(el) {
        return el.dataset.role !== undefined;
      }

      function isTypingReveal(el) {
        return el.classList.contains('typing-reveal');
      }

      // Animate a typing message between its two states (dots ↔ text).
      // Text stays invisible (opacity:0) during the size animation and fades in
      // only after the message reaches full size.
      // Returns the end height (useful for scroll calculations); `onSettled` runs
      // once the message has actually reached that height, which is when the
      // container's scrollHeight finally reflects it.
      function animateBubble(bubble, toTextRevealed, onSettled) {
        if (bubble._animCancel) bubble._animCancel();

        const textEl = bubble.querySelector('.bubble-text');

        // getBoundingClientRect gives sub-pixel dimensions; offsetWidth rounds,
        // which causes a visible snap when the inline style is cleared.
        let r = bubble.getBoundingClientRect();
        const from = { w: r.width, h: r.height };

        toTextRevealed
          ? bubble.classList.add('text-revealed')
          : bubble.classList.remove('text-revealed');

        if (toTextRevealed && textEl) {
          textEl.style.transition = 'none';
          textEl.style.opacity = '0';
        }

        r = bubble.getBoundingClientRect();
        const to = { w: r.width, h: r.height };

        if (from.w === to.w && from.h === to.h) {
          if (toTextRevealed && textEl) fadeInText(textEl);
          if (onSettled) onSettled();
          return to.h;
        }

        // max-width/max-height rather than width/height: once cleared they
        // revert to values producing the same rendered size, so no snap.
        bubble.style.maxWidth = from.w + 'px';
        bubble.style.maxHeight = from.h + 'px';
        bubble.style.transition = 'none';
        void bubble.offsetWidth; // force reflow

        bubble.style.transition = 'max-width 0.25s ease, max-height 0.25s ease';
        bubble.style.maxWidth = to.w + 'px';
        bubble.style.maxHeight = to.h + 'px';

        const expectedCount = (from.w !== to.w ? 1 : 0) + (from.h !== to.h ? 1 : 0);
        let doneCount = 0;

        function onEnd(e) {
          if (e.propertyName !== 'max-width' && e.propertyName !== 'max-height') return;
          if (++doneCount < expectedCount) return;
          bubble.removeEventListener('transitionend', onEnd);
          bubble._animCancel = null;
          bubble.style.maxWidth = '';
          bubble.style.maxHeight = '';
          bubble.style.transition = '';
          if (toTextRevealed && textEl) fadeInText(textEl);
          if (onSettled) onSettled();
        }

        bubble.addEventListener('transitionend', onEnd);

        bubble._animCancel = () => {
          bubble.removeEventListener('transitionend', onEnd);
          bubble._animCancel = null;
          bubble.style.maxWidth = '';
          bubble.style.maxHeight = '';
          bubble.style.transition = '';
          if (textEl) {
            textEl.style.opacity = '';
            textEl.style.transition = '';
          }
        };

        return to.h;
      }

      function fadeInText(textEl) {
        void textEl.offsetWidth; // force reflow so transition fires
        textEl.style.transition = 'opacity 0.15s ease';
        textEl.style.opacity = '';
        textEl.addEventListener('transitionend', () => {
          textEl.style.transition = '';
        }, { once: true });
      }

      const buffer = 150;

      // Single source of truth for "keep this message in view". `knownHeight`
      // exists for callers that are mid-animation, where the measured height
      // is the *start* of a transition rather than where it will end up.
      function scrollBubbleIntoView(chat, bubble, knownHeight, smooth) {
        const height = knownHeight === undefined ? bubble.offsetHeight : knownHeight;
        const bubbleBottom = bubble.offsetTop + height;
        const visibleBottom = chat.scrollTop + chat.clientHeight - buffer;
        if (bubbleBottom > visibleBottom) {
          chat.scrollTo({
            top: bubbleBottom - chat.clientHeight + buffer,
            behavior: smooth === false ? 'auto' : 'smooth'
          });
        }
      }

      function scrollBubbleOutOfView(chat, bubble) {
        const targetTop = Math.max(0, bubble.offsetTop - chat.clientHeight);
        if (chat.scrollTop > targetTop) {
          chat.scrollTo({ top: targetTop, behavior: 'smooth' });
        }
      }

      // Images inside a message carry no intrinsic size in this layout, so a
      // message revealed before its image has decoded measures short. Re-run
      // the scroll once each outstanding image settles.
      function rescrollOnImageLoad(chat, bubble) {
        bubble.querySelectorAll('img').forEach(img => {
          if (img.complete) return;
          const again = () => scrollBubbleIntoView(chat, bubble);
          img.addEventListener('load', again, { once: true });
          img.addEventListener('error', again, { once: true });
        });
      }

      // ----------------------------------------------------------------------
      // Typewriter reveal (assistant turns only)
      //
      // Stream the prose in word by word — the way a chat model's output
      // lands — while block elements (code, images) fade in whole. Fully
      // reversible: stepping the fragment back re-hides every unit and the
      // dots return.
      // ----------------------------------------------------------------------

      function buildTypewriter(bubble) {
        if (bubble._tw) return bubble._tw;
        const textEl = bubble.querySelector('.bubble-text');
        const units = [];

        function walk(node) {
          Array.from(node.childNodes).forEach(child => {
            if (child.nodeType === 3) {
              if (!child.textContent.trim()) return;
              // Split into words, keeping the whitespace runs as bare text
              // nodes so spacing survives while neighbouring words are hidden.
              const pieces = child.textContent.split(/(\s+)/);
              const frag = document.createDocumentFragment();
              pieces.forEach(piece => {
                if (piece === '') return;
                if (/^\s+$/.test(piece)) {
                  frag.appendChild(document.createTextNode(piece));
                  return;
                }
                const span = document.createElement('span');
                span.className = 'tw-word tw-pending';
                span.textContent = piece;
                frag.appendChild(span);
                units.push(span);
              });
              child.replaceWith(frag);
            } else if (child.nodeType === 1) {
              const tag = child.tagName;
              const block = tag === 'PRE' || tag === 'IMG' || tag === 'TABLE' ||
                tag === 'IFRAME' || tag === 'VIDEO' ||
                child.classList.contains('sourceCode') ||
                child.classList.contains('cell') ||
                child.classList.contains('quarto-video') ||
                child.classList.contains('code-copy-outer-scaffold');
              // Inline code and bare icons are revealed whole: splitting their
              // text would strand the inner spans under the Quarto theme's
              // `code span` colour, and streaming a one-token span looks like
              // a glitch anyway.
              const atomic = tag === 'CODE' || tag === 'ICONIFY-ICON' ||
                tag === 'svg' || child.classList.contains('iconify') ||
                child.classList.contains('fa') || child.classList.contains('fab') ||
                child.classList.contains('fas');
              if (block) {
                child.classList.add('tw-block', 'tw-pending');
                units.push(child);
              } else if (atomic) {
                child.classList.add('tw-word', 'tw-pending');
                units.push(child);
              } else {
                walk(child);
              }
            }
          });
        }
        walk(textEl);

        bubble._tw = { units };
        return bubble._tw;
      }

      function stepDelay(unit, count) {
        if (unit.classList.contains('tw-block')) return 260;
        // Keep the whole message under ~2.2s however long it is.
        const base = Math.max(12, Math.min(42, 2200 / Math.max(count, 1)));
        const tail = unit.textContent.slice(-1);
        if (/[.!?:]/.test(tail)) return base + 170;
        if (/[,;]/.test(tail)) return base + 70;
        return base + Math.random() * 24;
      }

      const prefersReducedMotion =
        window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      function playTypewriter(bubble, chat) {
        const tw = buildTypewriter(bubble);
        if (bubble._twCancel) bubble._twCancel(true);

        bubble.classList.add('text-revealed');

        if (prefersReducedMotion) {
          tw.units.forEach(u => u.classList.remove('tw-pending'));
          scrollBubbleIntoView(chat, bubble);
          rescrollOnImageLoad(chat, bubble);
          return;
        }

        bubble._twRunning = true;
        bubble.classList.add('is-streaming'); // keeps the logo blinking

        let i = 0;
        const total = tw.units.length;

        const done = () => {
          bubble._twRunning = false;
          bubble._twCancel = null;
          bubble.classList.remove('is-streaming');
        };

        const tick = () => {
          if (i >= total) {
            done();
            scrollBubbleIntoView(chat, bubble);
            rescrollOnImageLoad(chat, bubble);
            return;
          }
          const unit = tw.units[i++];
          unit.classList.remove('tw-pending');
          scrollBubbleIntoView(chat, bubble, undefined, false);
          bubble._twTimer = setTimeout(tick, stepDelay(unit, total));
        };

        bubble._twCancel = (complete) => {
          clearTimeout(bubble._twTimer);
          done();
          if (complete) {
            tw.units.forEach(u => u.classList.remove('tw-pending'));
            scrollBubbleIntoView(chat, bubble);
          }
        };

        tick();
      }

      function resetTypewriter(bubble, chat) {
        clearTimeout(bubble._twTimer);
        bubble._twRunning = false;
        bubble._twCancel = null;
        bubble.classList.remove('text-revealed', 'is-streaming');
        if (bubble._tw) bubble._tw.units.forEach(u => u.classList.add('tw-pending'));
        scrollBubbleIntoView(chat, bubble);
      }

      // Any message mid-stream in this chat jumps to its final state. Used
      // when the next reveal fires before the current one has finished.
      function finishRunningTypewriters(chat, except) {
        chat.querySelectorAll('.is-typing').forEach(b => {
          if (b !== except && b._twRunning && b._twCancel) b._twCancel(true);
        });
      }

      document.querySelectorAll('.slides-chat').forEach(normalizeChat);

      deck.on('ready', () => {
        let hasTypingBubbles = false;

        document.querySelectorAll('.slides-chat').forEach(chat => {
          chat.addEventListener('scroll', () => {
            chat.classList.toggle('is-scrolled', chat.scrollTop > 0);
          });

          let bubbleCounter = 0;
          Array.from(chat.children).forEach(el => {
            if (isMessage(el)) el.dataset.bubbleId = `ci-${bubbleCounter++}`;
          });

          // Typing messages: insert an invisible reveal-trigger fragment after
          // each, so one step shows the dots and the next shows the text.
          const slide = chat.closest('section');
          if (!slide) return;

          const typingBubbles = Array.from(chat.querySelectorAll('.typing.fragment'))
            .sort((a, b) => parseInt(a.dataset.fragmentIndex) - parseInt(b.dataset.fragmentIndex));

          typingBubbles.forEach(bubble => {
            const currentIdx = parseInt(bubble.dataset.fragmentIndex);
            if (isNaN(currentIdx)) return;
            hasTypingBubbles = true;

            slide.querySelectorAll('.fragment[data-fragment-index]').forEach(frag => {
              if (frag === bubble) return;
              const idx = parseInt(frag.dataset.fragmentIndex);
              if (idx > currentIdx) frag.dataset.fragmentIndex = idx + 1;
            });

            const indicator = document.createElement('span');
            indicator.className = 'typing-indicator';
            indicator.append(
              document.createElement('span'),
              document.createElement('span'),
              document.createElement('span')
            );
            bubble.querySelector('.bubble-text').insertAdjacentElement('afterend', indicator);
            bubble.classList.add('is-typing');

            const revealFrag = document.createElement('div');
            revealFrag.className = 'fragment typing-reveal';
            revealFrag.dataset.fragmentIndex = currentIdx + 1;
            revealFrag.dataset.targetTypingBubble = bubble.dataset.bubbleId;
            revealFrag.style.cssText = 'height:0;overflow:hidden;margin:0!important;padding:0!important;';
            bubble.insertAdjacentElement('afterend', revealFrag);
          });
        });

        // Re-sync Reveal.js fragment state after DOM modifications
        if (hasTypingBubbles) deck.sync();
      });

      deck.on('fragmentshown', (event) => {
        const fragment = event.fragment;
        const chat = fragment.closest('.slides-chat');
        if (!chat) return;

        if (isTypingReveal(fragment)) {
          const bubble = chat.querySelector(`[data-bubble-id="${fragment.dataset.targetTypingBubble}"]`);
          if (!bubble) return;

          if (bubble.dataset.role === 'assistant') {
            finishRunningTypewriters(chat, bubble);
            playTypewriter(bubble, chat);
            return;
          }

          // Scroll twice: once optimistically with the known end height so the
          // motion runs alongside the expansion, and once after it settles.
          const endHeight = animateBubble(bubble, true, () => {
            scrollBubbleIntoView(chat, bubble);
            rescrollOnImageLoad(chat, bubble);
          });
          scrollBubbleIntoView(chat, bubble, endHeight);
          return;
        }

        // Advancing past a message that is still streaming snaps it to its
        // final state.
        finishRunningTypewriters(chat);

        if (!isMessage(fragment)) return;
        scrollBubbleIntoView(chat, fragment);
        rescrollOnImageLoad(chat, fragment);
      });

      deck.on('fragmenthidden', (event) => {
        const fragment = event.fragment;
        const chat = fragment.closest('.slides-chat');
        if (!chat) return;

        if (isTypingReveal(fragment)) {
          const bubble = chat.querySelector(`[data-bubble-id="${fragment.dataset.targetTypingBubble}"]`);
          if (!bubble) return;

          if (bubble.dataset.role === 'assistant') {
            resetTypewriter(bubble, chat);
            return;
          }

          animateBubble(bubble, false, () => scrollBubbleIntoView(chat, bubble));
          return;
        }

        if (!isMessage(fragment)) return;
        scrollBubbleOutOfView(chat, fragment);
      });

    }
  };
};
