/**
 * 格式化日期为 yyyy-mm-dd 格式
 * @param dateString 日期字符串
 * @returns 格式化后的日期字符串
 */
export const formatDate = (dateString: string): string => {
  if (!dateString) return '';

  try {
    const date = new Date(dateString);

    // 检查日期是否有效
    if (isNaN(date.getTime())) {
      return dateString; // 如果日期无效，返回原始字符串
    }

    const year = date.getFullYear();
    // 月份从0开始，需要+1，并且确保是两位数
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  } catch (error) {
    console.error('日期格式化错误:', error);
    return dateString; // 出错时返回原始字符串
  }
};

/**
 * 将搜索建议转换为Markdown格式
 * @param suggestion 搜索建议文本
 * @returns Markdown格式的搜索建议
 */
export const formatSuggestionToMarkdown = (suggestion: string): string => {
  if (!suggestion) return '';

  // 将建议文本分段处理
  const paragraphs = suggestion.split('\n\n').filter(p => p.trim());

  // 处理每个段落
  const formattedParagraphs = paragraphs.map(paragraph => {
    // 检查是否是列表项
    if (paragraph.includes('- ') || /^\d+\./.test(paragraph)) {
      return paragraph; // 保留原始列表格式
    }

    // 检查是否包含关键词，可以添加强调
    const highlightedParagraph = paragraph
      .replace(/搜索词|关键词|查询/g, '**$&**')
      .replace(/建议|推荐|尝试/g, '*$&*');

    return highlightedParagraph;
  });

  // 添加Markdown标题和格式化内容
  return `### 搜索建议\n\n${formattedParagraphs.join('\n\n')}`;
};

/**
 * 生成唯一ID
 * @returns 唯一ID字符串
 */
export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

/**
 * 将链接转换为可点击的HTML链接
 * @param text 包含链接的文本
 * @returns 处理后的HTML
 */
export const linkify = (text: string): string => {
  // 匹配Markdown链接格式 [text](url)
  const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  return text.replace(markdownLinkRegex, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
};

/**
 * 处理助手消息的Markdown内容
 * @param content 助手消息内容
 * @returns 处理后的HTML内容
 */
export const processAssistantMessage = (content: string): string => {
  if (!content) return '';

  // 处理Markdown格式
  let processed = content
    // 处理标题
    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
    .replace(/^# (.*$)/gm, '<h1>$1</h1>')

    // 处理粗体和斜体
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')

    // 处理列表
    .replace(/^\s*\d+\.\s+(.*$)/gm, '<li>$1</li>')
    .replace(/^\s*[-*]\s+(.*$)/gm, '<li>$1</li>')

    // 处理换行
    .replace(/\n\n/g, '<br/><br/>');

  // 处理链接
  processed = linkify(processed);

  return processed;
};