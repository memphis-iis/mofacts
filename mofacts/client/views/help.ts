import DOMPurify from 'dompurify';
import {marked} from 'marked';
import {Meteor} from 'meteor/meteor';
import { clientConsole } from '../lib/clientLogger';
import { getActiveUiLocale } from '../lib/interfaceLocaleState';
import { translatePlatformString } from '../lib/interfaceI18n';
import { getLocalizedBrandContent, readPublishedDeploymentBrandProfile } from '../lib/deploymentBrandProfileRuntime';
import './help.html';
import './help.css';

declare const Template: {
  help: {
    helpers(map: Record<string, () => unknown>): void;
    rendered: () => Promise<void>;
  };
};

type MeteorWithCallAsync = typeof Meteor & {
  callAsync<T = unknown>(name: string, ...args: unknown[]): Promise<T>;
};

function helpText(key: Parameters<typeof translatePlatformString>[1], values?: Parameters<typeof translatePlatformString>[2]) {
  return translatePlatformString(getActiveUiLocale(), key, values);
}

// Configure marked for secure rendering
marked.setOptions({
  breaks: true,        // Convert \n to <br>
  gfm: true,          // GitHub Flavored Markdown
});

// Convert markdown to sanitized HTML
function convertMarkdownToHTML(markdown: string): string {
  // Parse markdown with marked
  const html = marked.parse(markdown) as string;

  // Sanitize the HTML to prevent XSS
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'u', 'br', 'p', 'span', 'div',
                   'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
                   'table', 'tr', 'td', 'th', 'thead', 'tbody',
                   'ul', 'ol', 'li', 'center', 'a', 'code', 'pre', 'blockquote', 'hr',
                   'img'],
    ALLOWED_ATTR: ['style', 'class', 'id', 'href', 'target', 'src', 'alt', 'title'],
    ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i,
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur']
  });
}

function normalizeHelpLink(href: string): string {
  if (!href || href.startsWith('#')) {
    return href;
  }

  if (/^(?:https?:|mailto:|tel:)/i.test(href)) {
    return href;
  }

  return href.startsWith('/') ? href : `/${href.replace(/^\.\//, '')}`;
}

function normalizeHelpImage(src: string): string {
  if (!src) {
    return src;
  }

  if (/^(?:https?:|data:)/i.test(src)) {
    return src;
  }

  return src.startsWith('/') ? src : `/${src.replace(/^\.\//, '')}`;
}

function normalizeRenderedHelpContent(helpContent: HTMLElement) {
  helpContent.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((anchor) => {
    const href = (anchor.getAttribute('href') || '').trim();
    if (!href) {
      return;
    }

    const normalizedHref = normalizeHelpLink(href);
    anchor.setAttribute('href', normalizedHref);

    if (!normalizedHref.startsWith('#')) {
      anchor.setAttribute('target', '_blank');
      anchor.setAttribute('rel', 'noopener noreferrer');
    }
  });

  helpContent.querySelectorAll<HTMLImageElement>('img[src]').forEach((image) => {
    const src = (image.getAttribute('src') || '').trim();
    if (!src) {
      return;
    }

    image.setAttribute('src', normalizeHelpImage(src));
  });
}

Template.help.helpers({
  ownerContact() {
    return Meteor.settings.public?.admin || null;
  }
});

Template.help.rendered = async function() {
  // Fetch and render the help content
  try {
    const customHelp = await (Meteor as MeteorWithCallAsync).callAsync<string | null>('getCustomHelpPage');
    if (customHelp) {
      const html = convertMarkdownToHTML(customHelp);
      const helpContent = document.getElementById('helpContent');
      if (helpContent) {
        helpContent.innerHTML = html;
        normalizeRenderedHelpContent(helpContent);
      }
    } else {
      const profile = readPublishedDeploymentBrandProfile();
      const localized = getLocalizedBrandContent(getActiveUiLocale());
      if (!profile || !localized) throw new Error('Brand Profile is not ready');
      const helpContent = document.getElementById('helpContent');
      if (helpContent) {
        helpContent.textContent = '';
        const link = document.createElement('a');
        link.href = profile.legal.supportUrl;
        link.textContent = localized.supportLinkLabel;
        link.rel = 'noopener noreferrer';
        helpContent.appendChild(link);
      }
    }

    // Ensure body styles from offcanvas are cleared before fade-in
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';

    // Trigger fade-in with stable layout (page-container prevents reflow)
    const container = document.getElementById('helpContainer');
    if (container) {
      container.classList.remove('page-loading');
      container.classList.add('page-loaded');
    }
  } catch (error: unknown) {
    const helpContent = document.getElementById('helpContent');
    if (helpContent) {
      helpContent.textContent = helpText('help.loadFailedPrefix');
    }
    // Ensure body styles from offcanvas are cleared before fade-in
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';

    // Trigger fade-in with stable layout (page-container prevents reflow)
    const container = document.getElementById('helpContainer');
    if (container) {
      container.classList.remove('page-loading');
      container.classList.add('page-loaded');
    }
    clientConsole(1, '[Help] Error loading help content:', error);
  }
};

