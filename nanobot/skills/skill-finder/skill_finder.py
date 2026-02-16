#!/usr/bin/env python3
"""
Skill Finder - 自主搜索和安装 nanobot 技能包
支持从 GitHub、HuggingFace、官方仓库等来源查找和安装技能
"""

import os
import sys
import json
import subprocess
import shutil
import zipfile
import tempfile
from pathlib import Path
from typing import Optional, List, Dict, Any

# 尝试导入 requests，如果不存在则提示安装
try:
    import requests
except ImportError:
    print(json.dumps({
        "success": False,
        "message": "缺少依赖：requests。请运行：pip install requests",
        "data": None
    }, ensure_ascii=False))
    sys.exit(1)

# 配置
SKILLS_DIR = Path("/root/.nanobot/workspace/skills")
SYSTEM_SKILLS_DIR = Path("/home/nanobot-main/nanobot/skills")
GITHUB_API_BASE = "https://api.github.com"
NANOBOT_SKILLS_TOPIC = "nanobot-skill"

class SkillFinder:
    """技能搜索器主类"""
    
    def __init__(self):
        self.skills_dir = SKILLS_DIR
        self.system_skills_dir = SYSTEM_SKILLS_DIR
        self.github_token = os.getenv("SKILL_FINDER_GITHUB_TOKEN", "")
        self.headers = {
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "nanobot-skill-finder"
        }
        if self.github_token:
            self.headers["Authorization"] = f"token {self.github_token}"
    
    def search_github(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        """从 GitHub 搜索技能"""
        try:
            search_query = f"{query}+nanobot-skill+in:name,description,topics"
            url = f"{GITHUB_API_BASE}/search/repositories"
            params = {
                "q": search_query,
                "sort": "stars",
                "order": "desc",
                "per_page": limit
            }
            
            response = requests.get(url, headers=self.headers, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            results = []
            for repo in data.get("items", []):
                results.append({
                    "source": "github",
                    "name": repo["name"],
                    "full_name": repo["full_name"],
                    "description": repo.get("description", ""),
                    "url": repo["html_url"],
                    "stars": repo["stargazers_count"],
                    "clone_url": repo["clone_url"],
                    "has_skill_file": self._check_has_skill_file(repo)
                })
            
            return results
        except Exception as e:
            return [{"error": f"GitHub 搜索失败：{str(e)}"}]
    
    def _check_has_skill_file(self, repo: Dict) -> bool:
        """检查仓库是否包含 SKILL.md 文件"""
        try:
            url = f"{GITHUB_API_BASE}/repos/{repo['full_name']}/contents"
            response = requests.get(url, headers=self.headers, timeout=5)
            if response.status_code == 200:
                contents = response.json()
                return any(item.get("name") == "SKILL.md" for item in contents)
        except:
            pass
        return False
    
    def search_local_system(self, query: str) -> List[Dict[str, Any]]:
        """搜索系统内置技能"""
        results = []
        if not self.system_skills_dir.exists():
            return results
        
        for skill_dir in self.system_skills_dir.iterdir():
            if skill_dir.is_dir() and query.lower() in skill_dir.name.lower():
                skill_md = skill_dir / "SKILL.md"
                description = ""
                if skill_md.exists():
                    content = skill_md.read_text()
                    # 简单提取 description
                    for line in content.split("\n"):
                        if line.startswith("description:"):
                            description = line.split(":", 1)[1].strip()
                            break
                
                results.append({
                    "source": "system",
                    "name": skill_dir.name,
                    "description": description,
                    "path": str(skill_dir),
                    "available": self._check_skill_available(skill_dir)
                })
        
        return results
    
    def _check_skill_available(self, skill_dir: Path) -> bool:
        """检查技能是否可用（检查 requires）"""
        skill_md = skill_dir / "SKILL.md"
        if not skill_md.exists():
            return False
        
        content = skill_md.read_text()
        # 简单检查是否有 requires 且未满足
        if "requires:" in content:
            # 这里可以扩展为实际检查依赖
            return "available=\"true\"" in content or "available: true" in content
        return True
    
    def list_installed(self) -> List[Dict[str, Any]]:
        """列出已安装的技能"""
        results = []
        if not self.skills_dir.exists():
            return results
        
        for skill_dir in self.skills_dir.iterdir():
            if skill_dir.is_dir():
                skill_md = skill_dir / "SKILL.md"
                description = ""
                version = ""
                if skill_md.exists():
                    content = skill_md.read_text()
                    for line in content.split("\n"):
                        if line.startswith("description:"):
                            description = line.split(":", 1)[1].strip()
                        elif line.startswith("version:"):
                            version = line.split(":", 1)[1].strip()
                
                results.append({
                    "name": skill_dir.name,
                    "description": description,
                    "version": version,
                    "path": str(skill_dir)
                })
        
        return results
    
    def install_from_github(self, repo_name: str, branch: str = "main") -> Dict[str, Any]:
        """从 GitHub 安装技能"""
        try:
            clone_url = f"https://github.com/{repo_name}.git"
            temp_dir = tempfile.mkdtemp()
            target_dir = self.skills_dir / repo_name.split("/")[-1]
            
            # 如果已存在，先备份
            if target_dir.exists():
                backup_dir = target_dir.with_name(f"{target_dir.name}.backup")
                shutil.move(str(target_dir), str(backup_dir))
            
            # Git clone
            subprocess.run(
                ["git", "clone", "-b", branch, "--depth", "1", clone_url, temp_dir],
                check=True,
                capture_output=True,
                timeout=60
            )
            
            # 移动到 skills 目录
            shutil.move(temp_dir, str(target_dir))
            
            # 检查并运行 install.sh
            install_script = target_dir / "install.sh"
            if install_script.exists():
                subprocess.run(
                    ["bash", str(install_script)],
                    check=True,
                    capture_output=True,
                    timeout=120
                )
            
            return {
                "success": True,
                "message": f"技能 {repo_name} 安装成功",
                "data": {"path": str(target_dir)}
            }
        except subprocess.CalledProcessError as e:
            return {
                "success": False,
                "message": f"安装失败：{e.stderr.decode() if e.stderr else str(e)}",
                "data": None
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"安装失败：{str(e)}",
                "data": None
            }
    
    def install_from_system(self, skill_name: str) -> Dict[str, Any]:
        """从系统技能复制安装"""
        try:
            source_dir = self.system_skills_dir / skill_name
            target_dir = self.skills_dir / skill_name
            
            if not source_dir.exists():
                return {
                    "success": False,
                    "message": f"系统技能 {skill_name} 不存在",
                    "data": None
                }
            
            if target_dir.exists():
                shutil.rmtree(target_dir)
            
            shutil.copytree(source_dir, target_dir)
            
            return {
                "success": True,
                "message": f"技能 {skill_name} 安装成功",
                "data": {"path": str(target_dir)}
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"安装失败：{str(e)}",
                "data": None
            }
    
    def uninstall(self, skill_name: str) -> Dict[str, Any]:
        """卸载技能"""
        try:
            target_dir = self.skills_dir / skill_name
            
            if not target_dir.exists():
                return {
                    "success": False,
                    "message": f"技能 {skill_name} 未安装",
                    "data": None
                }
            
            shutil.rmtree(target_dir)
            
            return {
                "success": True,
                "message": f"技能 {skill_name} 已卸载",
                "data": None
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"卸载失败：{str(e)}",
                "data": None
            }


def main():
    """命令行入口"""
    if len(sys.argv) < 2:
        print(json.dumps({
            "success": False,
            "message": "用法：skill_finder.py <command> [args]",
            "commands": {
                "search": "search <query> - 搜索技能",
                "install": "install <skill-name> [source] - 安装技能",
                "list": "list - 列出已安装技能",
                "uninstall": "uninstall <skill-name> - 卸载技能"
            }
        }, ensure_ascii=False))
        sys.exit(1)
    
    finder = SkillFinder()
    command = sys.argv[1]
    
    if command == "search":
        query = sys.argv[2] if len(sys.argv) > 2 else ""
        results = {
            "github": finder.search_github(query),
            "system": finder.search_local_system(query)
        }
        print(json.dumps({
            "success": True,
            "message": f"搜索完成：{query}",
            "data": results
        }, ensure_ascii=False, indent=2))
    
    elif command == "install":
        if len(sys.argv) < 3:
            print(json.dumps({
                "success": False,
                "message": "请指定技能名称",
                "data": None
            }, ensure_ascii=False))
            sys.exit(1)
        
        skill_name = sys.argv[2]
        source = sys.argv[3] if len(sys.argv) > 3 else "auto"
        
        if source == "system":
            result = finder.install_from_system(skill_name)
        elif source == "github":
            result = finder.install_from_github(skill_name)
        else:  # auto
            # 先尝试系统技能
            result = finder.install_from_system(skill_name)
            if not result["success"]:
                # 再尝试 GitHub
                result = finder.install_from_github(skill_name)
        
        print(json.dumps(result, ensure_ascii=False, indent=2))
    
    elif command == "list":
        skills = finder.list_installed()
        print(json.dumps({
            "success": True,
            "message": f"已安装 {len(skills)} 个技能",
            "data": skills
        }, ensure_ascii=False, indent=2))
    
    elif command == "uninstall":
        if len(sys.argv) < 3:
            print(json.dumps({
                "success": False,
                "message": "请指定技能名称",
                "data": None
            }, ensure_ascii=False))
            sys.exit(1)
        
        skill_name = sys.argv[2]
        result = finder.uninstall(skill_name)
        print(json.dumps(result, ensure_ascii=False, indent=2))
    
    else:
        print(json.dumps({
            "success": False,
            "message": f"未知命令：{command}",
            "data": None
        }, ensure_ascii=False))
        sys.exit(1)


if __name__ == "__main__":
    main()
