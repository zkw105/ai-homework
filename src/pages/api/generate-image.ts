import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { text } = req.body;

    // 调用ComfyUI API生成图像
    const response = await fetch('http://localhost:8188/prompt', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: {
          "3": {
            "inputs": {
              "text": text,
              "clip": ["4", 0]
            },
            "class_type": "CLIPTextEncode"
          },
          "4": {
            "inputs": {
              "text": "low quality, blurry, distorted, ugly",
              "clip": ["7", 0]
            },
            "class_type": "CLIPTextEncode"
          },
          "6": {
            "inputs": {
              "seed": Math.floor(Math.random() * 1000000),
              "steps": 20,
              "cfg": 7,
              "sampler_name": "euler",
              "scheduler": "normal",
              "denoise": 1,
              "model": ["7", 0],
              "positive": ["3", 0],
              "negative": ["4", 0],
              "latent_image": ["8", 0]
            },
            "class_type": "KSampler"
          },
          "7": {
            "inputs": {
              "ckpt_name": "v1-5-pruned-emaonly.ckpt"
            },
            "class_type": "CheckpointLoaderSimple"
          },
          "8": {
            "inputs": {
              "width": 512,
              "height": 512,
              "batch_size": 1
            },
            "class_type": "EmptyLatentImage"
          },
          "9": {
            "inputs": {
              "samples": ["6", 0],
              "vae": ["7", 2]
            },
            "class_type": "VAEDecode"
          },
          "10": {
            "inputs": {
              "filename_prefix": "ComfyUI",
              "images": ["9", 0]
            },
            "class_type": "SaveImage"
          }
        }
      }),
    });

    if (!response.ok) {
      throw new Error('ComfyUI API请求失败');
    }

    const data = await response.json();
    const imageUrl = data.output.images[0];

    res.status(200).json({ imageUrl });
  } catch (error: any) {
    console.error('生成图像失败:', error);
    res.status(500).json({ error: error.message || '生成图像失败' });
  }
} 