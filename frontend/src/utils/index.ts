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