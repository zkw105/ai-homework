import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const workflowPath = path.join(process.cwd(), 'src', 'workflow.json');
    const workflowData = fs.readFileSync(workflowPath, 'utf8');
    const workflow = JSON.parse(workflowData);
    res.status(200).json(workflow);
  } catch (error) {
    console.error('读取工作流失败:', error);
    res.status(500).json({ error: '无法读取工作流配置' });
  }
} 