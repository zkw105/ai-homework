interface ProgressCallback {
  (progress: number, status: string): void;
}

export class ComfyUIClient {
  private static instance: ComfyUIClient;
  private apiUrl: string;
  private pollInterval: number = 1000; // 轮询间隔，单位毫秒

  private constructor() {
    this.apiUrl = process.env.NEXT_PUBLIC_COMFYUI_URL || 'http://localhost:8188';
  }

  public static getInstance(): ComfyUIClient {
    if (!ComfyUIClient.instance) {
      ComfyUIClient.instance = new ComfyUIClient();
    }
    return ComfyUIClient.instance;
  }

  public async generateImage(
    prompt: string,
    negativePrompt: string,
    progressCallback?: (progress: number, status: string) => void
  ): Promise<string | null> {
    try {
      // 准备工作流参数
      const seed = Math.floor(Math.random() * 1000000);
      
      if (progressCallback) {
        progressCallback(0, '准备生成图像...');
      }
      
      // 检查可用模型
      try {
        const modelsResponse = await fetch(`${this.apiUrl}/object_info`);
        if (!modelsResponse.ok) {
          console.error('无法获取ComfyUI模型信息');
        }
      } catch (error) {
        console.error('获取模型信息出错:', error);
      }
      
      // 使用v1-5模型
      const modelName = "v1-5-pruned-emaonly.ckpt";
      
      if (progressCallback) {
        progressCallback(10, '发送生成请求...');
      }
      
      // 发送生成请求
      const promptResponse = await fetch(`${this.apiUrl}/prompt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: {
            "3": {
              "inputs": {
                "text": prompt,
                "clip": ["7", 0]
              },
              "class_type": "CLIPTextEncode"
            },
            "4": {
              "inputs": {
                "text": negativePrompt,
                "clip": ["7", 0]
              },
              "class_type": "CLIPTextEncode"
            },
            "6": {
              "inputs": {
                "seed": seed,
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
                "ckpt_name": modelName
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
                "filename_prefix": "children_book",
                "images": ["9", 0]
              },
              "class_type": "SaveImage"
            }
          }
        }),
      });

      if (!promptResponse.ok) {
        throw new Error('ComfyUI API请求失败');
      }

      const promptData = await promptResponse.json();
      
      if (!promptData.prompt_id) {
        throw new Error('ComfyUI没有返回有效的prompt_id');
      }
      
      const promptId = promptData.prompt_id;
      
      if (progressCallback) {
        progressCallback(20, '请求已发送，等待处理...');
      }

      // 轮询检查生成进度
      return await this.pollUntilComplete(promptId, progressCallback);
    } catch (error: any) {
      console.error('生成图片失败:', error);
      if (progressCallback) {
        progressCallback(0, `错误: ${error.message}`);
      }
      return null;
    }
  }

  private async pollUntilComplete(
    promptId: string,
    progressCallback?: (progress: number, status: string) => void
  ): Promise<string | null> {
    let isComplete = false;
    let imageUrl: string | null = null;
    let retries = 0;
    const maxRetries = 60; // 最多轮询60次，约一分钟

    // 先等待一秒，让ComfyUI有时间开始处理
    await this.sleep(1000);

    while (!isComplete && retries < maxRetries) {
      retries++;
      
      try {
        // 检查进度
        const progressResponse = await fetch(`${this.apiUrl}/prompt`);
        if (progressResponse.ok) {
          const progressData = await progressResponse.json();
          
          if (progressCallback) {
            if (progressData.executing) {
              // 有节点正在执行
              const nodeType = progressData.executing.node || '未知节点';
              let nodeProgress = 0;
              
              if (typeof progressData.executing.progress === 'number') {
                nodeProgress = progressData.executing.progress;
              }
              
              let status = `正在执行: ${nodeType}`;
              let displayProgress = 20 + nodeProgress * 60; // 总进度20%~80%
              
              if (nodeType === 'CheckpointLoaderSimple') {
                status = '正在加载模型...';
              } else if (nodeType === 'CLIPTextEncode') {
                status = '正在处理文本提示...';
              } else if (nodeType === 'KSampler') {
                status = `正在采样图像...`;
                if (progressData.executing.step && progressData.executing.total_steps) {
                  status = `正在采样图像 (${progressData.executing.step}/${progressData.executing.total_steps})`;
                }
              } else if (nodeType === 'VAEDecode') {
                status = '正在解码图像...';
                displayProgress = 80;
              } else if (nodeType === 'SaveImage') {
                status = '正在保存图像...';
                displayProgress = 90;
              }
              
              progressCallback(displayProgress, status);
            } else {
              // 没有节点正在执行，可能在队列中或已完成
              progressCallback(20, '等待处理...');
            }
          }
        }

        // 检查是否完成
        const historyResponse = await fetch(`${this.apiUrl}/history/${promptId}`);
        
        if (historyResponse.ok) {
          const historyData = await historyResponse.json();
          
          if (historyData && historyData[promptId] && historyData[promptId].outputs) {
            const outputs = historyData[promptId].outputs;
            
            // 查找SaveImage节点的输出
            for (const nodeId in outputs) {
              const node = outputs[nodeId];
              if (node.images && node.images.length > 0) {
                const imageName = node.images[0].filename;
                imageUrl = `${this.apiUrl}/view?filename=${imageName}`;
                isComplete = true;
                if (progressCallback) {
                  progressCallback(100, '图像生成完成');
                }
                break;
              }
            }
          }
        }
      } catch (error) {
        console.error('轮询过程中出错:', error);
      }

      if (!isComplete) {
        await this.sleep(this.pollInterval);
      }
    }

    if (!isComplete && progressCallback) {
      progressCallback(0, '图像生成超时');
    }

    return imageUrl;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
} 