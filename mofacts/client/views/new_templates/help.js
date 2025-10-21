import DOMPurify from 'dompurify';
import {Meteor} from 'meteor/meteor';

// Simple markdown to HTML converter for wiki content
function convertMarkdownToHTML(markdown) {
  let html = markdown;

  // Headers
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

  // Bold
  html = html.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');

  // Italic
  html = html.replace(/\*(.*?)\*/gim, '<em>$1</em>');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^\)]+)\)/gim, '<a href="$2" target="_blank">$1</a>');

  // Lists
  html = html.replace(/^\* (.+)$/gim, '<li>$1</li>');
  html = html.replace(/^- (.+)$/gim, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');

  // Line breaks
  html = html.replace(/\n\n/gim, '</p><p>');
  html = '<p>' + html + '</p>';

  // Sanitize the HTML to prevent XSS
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'u', 'br', 'p', 'span', 'div',
                   'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
                   'table', 'tr', 'td', 'th', 'thead', 'tbody',
                   'ul', 'ol', 'li', 'center', 'a'],
    ALLOWED_ATTR: ['style', 'class', 'id', 'href', 'target'],
    ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur']
  });
}

Template.help.helpers({
  ownerContact() {
    return Meteor.settings.public?.admin || null;
  }
});

Template.help.rendered = async function() {
  // Fetch and render the wiki content
  try {
    const response = await fetch('https://raw.githubusercontent.com/wiki/memphis-iis/mofacts/Student-Overview.md');
    if (!response.ok) {
      throw new Error('Failed to load help content');
    }
    const markdown = await response.text();

    // Convert markdown to HTML
    const html = convertMarkdownToHTML(markdown);

    // Update page content
    document.getElementById('helpContent').innerHTML = html;

    // Ensure body styles from offcanvas are cleared before fade-in
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';

    // Trigger fade-in with stable layout (page-container prevents reflow)
    const container = document.getElementById('helpContainer');
    if (container) {
      container.classList.remove('page-loading');
      container.classList.add('page-loaded');
    }
  } catch (error) {
    document.getElementById('helpContent').innerHTML = `
      <div class="alert alert-warning">
        <p>Unable to load help content. Please try again later or visit our
        <a href="https://github.com/memphis-iis/mofacts/wiki/Student-Overview" target="_blank">online help guide</a>.</p>
      </div>
    `;
    // Ensure body styles from offcanvas are cleared before fade-in
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';

    // Trigger fade-in with stable layout (page-container prevents reflow)
    const container = document.getElementById('helpContainer');
    if (container) {
      container.classList.remove('page-loading');
      container.classList.add('page-loaded');
    }
    console.error('Error loading wiki content:', error);
  }
};
