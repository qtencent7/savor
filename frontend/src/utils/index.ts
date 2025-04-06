/**
 * Format date to yyyy-mm-dd format
 * @param dateString Date string
 * @returns Formatted date string
 */
export const formatDate = (dateString: string): string => {
  if (!dateString) return '';

  try {
    const date = new Date(dateString);

    // Check if date is valid
    if (isNaN(date.getTime())) {
      return dateString; // If date is invalid, return original string
    }

    const year = date.getFullYear();
    // Month starts from 0, need to +1, and ensure it's two digits
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  } catch (error) {
    console.error('Date formatting error:', error);
    return dateString; // Return original string on error
  }
};

/**
 * Convert search suggestions to Markdown format
 * @param suggestion Search suggestion text
 * @returns Markdown formatted search suggestion
 */
export const formatSuggestionToMarkdown = (suggestion: string): string => {
  if (!suggestion) return '';

  // Split suggestion text into paragraphs
  const paragraphs = suggestion.split('\n\n').filter(p => p.trim());

  // Process each paragraph
  const formattedParagraphs = paragraphs.map(paragraph => {
    // Check if it's a list item
    if (paragraph.includes('- ') || /^\d+\./.test(paragraph)) {
      return paragraph; // Keep original list format
    }

    // Check if it contains keywords, can add emphasis
    const highlightedParagraph = paragraph
      .replace(/search term|keyword|query/g, '**$&**')
      .replace(/suggestion|recommend|try/g, '*$&*');

    return highlightedParagraph;
  });

  // Add Markdown title and formatted content
  return `### Search Suggestions\n\n${formattedParagraphs.join('\n\n')}`;
};

/**
 * Generate unique ID
 * @returns Unique ID string
 */
export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

/**
 * Convert links to clickable HTML links
 * @param text Text containing links
 * @returns Processed HTML
 */
export const linkify = (text: string): string => {
  // Match Markdown link format [text](url)
  const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  return text.replace(markdownLinkRegex, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
};

/**
 * Process assistant message Markdown content
 * @param content Assistant message content
 * @returns Processed HTML content
 */
export const processAssistantMessage = (content: string): string => {
  if (!content) return '';

  // Process Markdown format
  let processed = content
    // Process headings
    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
    .replace(/^# (.*$)/gm, '<h1>$1</h1>')

    // Process bold and italic
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')

    // Process lists
    .replace(/^\s*\d+\.\s+(.*$)/gm, '<li>$1</li>')
    .replace(/^\s*[-*]\s+(.*$)/gm, '<li>$1</li>')

    // Process line breaks
    .replace(/\n\n/g, '<br/><br/>');

  // Process links
  processed = linkify(processed);

  return processed;
};