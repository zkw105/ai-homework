import type { NextApiRequest, NextApiResponse } from 'next';

interface StoryPage {
  text: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { characterDescription } = req.body;

    // 调用DeepSeek API生成故事
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: '你是一个专业的儿童故事作家，擅长创作生动有趣的儿童绘本故事。请根据提供的角色信息，创作一个15页的儿童绘本故事。每页内容要简短有趣，适合儿童阅读。'
          },
          {
            role: 'user',
            content: `请根据以下角色信息创作一个15页的儿童绘本故事：${characterDescription}`
          }
        ],
        temperature: 0.7,
        max_tokens: 2000
      }),
    });

    if (!response.ok) {
      throw new Error('DeepSeek API请求失败');
    }

    const data = await response.json();
    const storyContent = data.choices[0].message.content;

    // 将故事内容分割成15页
    const pages = storyContent.split('\n\n').map((text: string) => ({
      text: text.trim()
    }));

    res.status(200).json({ pages });
  } catch (error: any) {
    console.error('生成故事失败:', error);
    res.status(500).json({ error: error.message || '生成故事失败' });
  }
} 