import { useState, useRef } from 'react';
import { ComfyUIClient } from '../utils/comfyuiClient';

interface StoryPage {
  text: string;
  imageUrl?: string;
}

export default function Home() {
  const [characterInfo, setCharacterInfo] = useState({
    name: '',
    age: '',
    personality: '',
    interests: ''
  });
  const [storyPages, setStoryPages] = useState<StoryPage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [imageProgress, setImageProgress] = useState({ progress: 0, status: '' });
  const [storyTitle, setStoryTitle] = useState('');
  
  // 创建图像引用的正确方式
  const imageRefs = useRef<{ [key: number]: HTMLImageElement | null }>({});

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setCharacterInfo(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const generateStory = async () => {
    setIsGenerating(true);
    setError(null);
    
    try {
      // 构建角色描述
      const characterDescription = `主角${characterInfo.name}是一个${characterInfo.age}岁的${characterInfo.personality}，${characterInfo.interests}`;
      
      // 生成标题
      setStoryTitle(`${characterInfo.name}的故事`);
      
      // 调用DeepSeek API生成故事
      const response = await fetch('/api/generate-story', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ characterDescription }),
      });

      if (!response.ok) {
        throw new Error('故事生成失败');
      }

      const data = await response.json();
      setStoryPages(data.pages);
      setCurrentPage(0);
      
      // 为第一页生成图像
      if (data.pages.length > 0) {
        generateImageForPage(data.pages[0].text, 0, data.pages);
      }
    } catch (error: any) {
      setError(error.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const generateImageForPage = async (pageText: string, pageIndex: number, pages: StoryPage[]) => {
    setGeneratingImage(true);
    setImageProgress({ progress: 0, status: '开始生成图像...' });
    
    try {
      const client = ComfyUIClient.getInstance();
      const prompt = `儿童绘本风格，${pageText}`;
      const negativePrompt = 'low quality, blurry, distorted, ugly';
      
      const imageUrl = await client.generateImage(
        prompt,
        negativePrompt,
        (progress, status) => {
          setImageProgress({ progress, status });
        }
      );
      
      if (imageUrl) {
        // 更新当前页面的图像URL
        const updatedPages = [...(pages || storyPages)];
        updatedPages[pageIndex] = {
          ...updatedPages[pageIndex],
          imageUrl
        };
        setStoryPages(updatedPages);
      } else {
        throw new Error('图像生成失败');
      }
    } catch (error: any) {
      console.error('生成图片失败:', error);
      setError(`图像生成失败: ${error.message}`);
    } finally {
      setGeneratingImage(false);
    }
  };

  const handleNextPage = async () => {
    if (currentPage < storyPages.length - 1) {
      setCurrentPage(prev => prev + 1);
      
      // 如果下一页没有图像，生成一个
      if (!storyPages[currentPage + 1].imageUrl) {
        generateImageForPage(storyPages[currentPage + 1].text, currentPage + 1, storyPages);
      }
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 0) {
      setCurrentPage(prev => prev - 1);
    }
  };
  
  const downloadStory = async () => {
    try {
      // 确保所有页面都有图像
      const allPagesHaveImages = storyPages.every(page => page.imageUrl);
      if (!allPagesHaveImages) {
        setError('请等待所有图像生成完成后再下载');
        return;
      }
      
      // 创建一个新的窗口并构建HTML内容
      const newWindow = window.open('', '_blank');
      if (!newWindow) {
        setError('无法创建新窗口，请检查您的浏览器设置是否允许弹出窗口');
        return;
      }
      
      // 构建HTML内容
      const htmlContent = `
        <!DOCTYPE html>
        <html lang="zh">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${storyTitle}</title>
          <style>
            body {
              font-family: 'Arial', sans-serif;
              max-width: 800px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f5f5f5;
            }
            h1 {
              text-align: center;
              color: #2c3e50;
              margin-bottom: 30px;
            }
            .page {
              background-color: white;
              border-radius: 10px;
              padding: 20px;
              margin-bottom: 30px;
              box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            }
            .page-image {
              width: 100%;
              border-radius: 8px;
              margin-bottom: 15px;
            }
            .page-text {
              font-size: 16px;
              line-height: 1.6;
              color: #333;
            }
            .page-number {
              text-align: right;
              color: #7f8c8d;
              font-size: 14px;
              margin-top: 10px;
            }
            @media print {
              body {
                background-color: white;
              }
              .page {
                break-inside: avoid;
                box-shadow: none;
                border: 1px solid #eee;
              }
              .no-print {
                display: none;
              }
            }
            .print-button {
              display: block;
              margin: 20px auto;
              padding: 10px 20px;
              background-color: #3498db;
              color: white;
              border: none;
              border-radius: 5px;
              cursor: pointer;
              font-size: 16px;
            }
          </style>
        </head>
        <body>
          <h1>${storyTitle}</h1>
          <button class="print-button no-print" onclick="window.print()">打印或保存为PDF</button>
          ${storyPages.map((page, index) => `
            <div class="page">
              <img class="page-image" src="${page.imageUrl}" alt="第${index + 1}页插图">
              <div class="page-text">${page.text}</div>
              <div class="page-number">第 ${index + 1} 页</div>
            </div>
          `).join('')}
          <button class="print-button no-print" onclick="window.print()">打印或保存为PDF</button>
        </body>
        </html>
      `;
      
      // 写入HTML内容到新窗口
      newWindow.document.write(htmlContent);
      newWindow.document.close();
      
    } catch (error: any) {
      console.error('下载故事时出错:', error);
      setError(`下载故事失败: ${error.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8">AI儿童绘本生成器</h1>
        
        {!storyPages.length ? (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <form className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">角色姓名</label>
                <input
                  type="text"
                  name="name"
                  value={characterInfo.name}
                  onChange={handleInputChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  placeholder="例如：小狐狸"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">年龄</label>
                <input
                  type="text"
                  name="age"
                  value={characterInfo.age}
                  onChange={handleInputChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  placeholder="例如：5岁"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">性格特点</label>
                <input
                  type="text"
                  name="personality"
                  value={characterInfo.personality}
                  onChange={handleInputChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  placeholder="例如：活泼开朗"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">兴趣爱好</label>
                <textarea
                  name="interests"
                  value={characterInfo.interests}
                  onChange={handleInputChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  rows={3}
                  placeholder="例如：喜欢冒险，对世界充满好奇"
                />
              </div>

              <button
                type="button"
                onClick={generateStory}
                disabled={isGenerating}
                className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                  isGenerating ? 'bg-gray-400' : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                {isGenerating ? '生成中...' : '开始生成故事'}
              </button>
            </form>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-800">{storyTitle}</h2>
              <button
                onClick={downloadStory}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
              >
                下载绘本
              </button>
            </div>
            
            <div className="mb-4">
              {storyPages[currentPage].imageUrl ? (
                <img
                  ref={(el) => {
                    imageRefs.current[currentPage] = el;
                  }}
                  src={storyPages[currentPage].imageUrl}
                  alt={`第${currentPage + 1}页插图`}
                  className="w-full h-auto rounded-lg mb-4"
                />
              ) : generatingImage ? (
                <div className="flex flex-col items-center justify-center h-64 bg-gray-100 rounded-lg mb-4">
                  <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                  <p className="text-gray-600">{imageProgress.status} ({Math.round(imageProgress.progress)}%)</p>
                </div>
              ) : (
                <div className="flex items-center justify-center h-64 bg-gray-100 rounded-lg mb-4">
                  <p className="text-gray-600">图像生成中...</p>
                </div>
              )}
              <p className="text-lg text-gray-800">{storyPages[currentPage].text}</p>
            </div>
            
            <div className="flex justify-between mt-4">
              <button
                onClick={handlePrevPage}
                disabled={currentPage === 0}
                className="px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300 disabled:opacity-50"
              >
                上一页
              </button>
              <span className="text-gray-600">
                第 {currentPage + 1} 页 / 共 {storyPages.length} 页
              </span>
              <button
                onClick={handleNextPage}
                disabled={currentPage === storyPages.length - 1}
                className="px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300 disabled:opacity-50"
              >
                下一页
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 p-4 bg-red-100 text-red-700 rounded-md">
            {error}
          </div>
        )}
      </div>
    </div>
  );
} 