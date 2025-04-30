import os
from dotenv import load_dotenv
import json
import requests
from PIL import Image
import io
from openai import OpenAI
import re
import time
import base64

class StoryGenerator:
    def __init__(self):
        load_dotenv()
        self.client = OpenAI(
            api_key=os.getenv("DEEPSEEK_API_KEY"),
            base_url="https://api.deepseek.com"
        )
        self.comfy_url = "http://127.0.0.1:8188"  # ComfyUI的默认地址
        
    def _extract_json_from_response(self, text):
        """
        从响应文本中提取JSON内容
        """
        # 使用正则表达式匹配```json和```之间的内容
        match = re.search(r'```json\n(.*?)\n```', text, re.DOTALL)
        if match:
            return match.group(1)
        return text

    def generate_image_with_comfy(self, prompt, negative_prompt="", seed=None):
        """
        使用ComfyUI生成图片
        """
        try:
            # 加载工作流程
            with open("workflow.json", "r") as f:
                workflow = json.load(f)
            
            # 更新提示词
            workflow["3"]["inputs"]["text"] = prompt
            workflow["4"]["inputs"]["text"] = negative_prompt
            if seed is not None:
                workflow["6"]["inputs"]["seed"] = seed

            # 发送工作流到ComfyUI
            response = requests.post(f"{self.comfy_url}/prompt", json=workflow)
            if response.status_code != 200:
                raise Exception(f"发送工作流失败: {response.text}")

            prompt_id = response.json()["prompt_id"]
            
            # 等待图片生成完成
            while True:
                response = requests.get(f"{self.comfy_url}/history")
                if response.status_code == 200:
                    history = response.json()
                    if prompt_id in history and len(history[prompt_id]["outputs"]) > 0:
                        # 获取生成的图片
                        image_data = history[prompt_id]["outputs"]["output_image"][0]
                        image_url = f"{self.comfy_url}/view?filename={image_data['filename']}"
                        
                        # 下载图片
                        response = requests.get(image_url)
                        if response.status_code == 200:
                            return Image.open(io.BytesIO(response.content))
                        break
                time.sleep(1)
            
            raise Exception("图片生成失败")
        except Exception as e:
            print(f"生成图片时出错: {str(e)}")
            raise
        
    def generate_story(self, character_info):
        """
        根据人物信息生成儿童故事
        """
        prompt = f"""请根据以下人物信息创作一个适合3-8岁儿童的绘本故事：
        人物信息：{character_info}
        
        要求：
        1. 故事要简单有趣，适合儿童阅读
        2. 故事长度在300-500字之间
        3. 故事要包含3-5个关键场景
        4. 语言要生动活泼，富有童趣
        
        请以JSON格式返回，包含以下字段：
        - title: 故事标题
        - story: 完整故事内容
        - scenes: 关键场景描述列表
        """
        
        try:
            response = self.client.chat.completions.create(
                model="deepseek-chat",
                messages=[
                    {"role": "system", "content": "你是一个专业的儿童故事作家"},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=2000,
                stream=False
            )
            
            # 打印响应内容以便调试
            print(f"API Response: {response}")
            
            # 从响应中提取JSON字符串
            json_str = self._extract_json_from_response(response.choices[0].message.content)
            return json.loads(json_str)
        except Exception as e:
            print(f"生成故事时出错: {str(e)}")
            raise
    
    def save_story(self, story_data, output_dir="output"):
        """
        保存故事和图片
        """
        try:
            os.makedirs(output_dir, exist_ok=True)
            
            # 保存故事文本
            with open(os.path.join(output_dir, "story.json"), "w", encoding="utf-8") as f:
                json.dump(story_data, f, ensure_ascii=False, indent=2)
            
            print(f"故事已保存到 {output_dir}/story.json")
            print("\n生成的故事：")
            print(f"标题：{story_data['title']}")
            print("\n故事内容：")
            print(story_data['story'])
            print("\n关键场景：")
            
            # 为每个场景生成并保存图片
            print("\n开始生成场景图片...")
            for i, scene in enumerate(story_data['scenes'], 1):
                print(f"\n场景 {i}: {scene}")
                prompt = f"儿童绘本风格，温馨可爱的插图。{scene}"
                negative_prompt = "nsfw, 低质量, 模糊, 扭曲"
                
                print(f"正在生成第 {i} 个场景的图片...")
                image = self.generate_image_with_comfy(prompt, negative_prompt)
                image_path = os.path.join(output_dir, f"scene_{i}.png")
                image.save(image_path)
                print(f"图片已保存到 {image_path}")
                
        except Exception as e:
            print(f"保存故事和图片时出错: {str(e)}")
            raise

def main():
    try:
        # 示例使用
        character_info = {
            "name": "小明",
            "age": 5,
            "characteristics": "活泼好动，喜欢小动物",
            "favorite_things": "画画和吃冰淇淋"
        }
        
        generator = StoryGenerator()
        story_data = generator.generate_story(character_info)
        generator.save_story(story_data)
        
        print("\n故事和图片生成完成！")
    except Exception as e:
        print(f"程序运行出错: {str(e)}")

if __name__ == "__main__":
    main() 