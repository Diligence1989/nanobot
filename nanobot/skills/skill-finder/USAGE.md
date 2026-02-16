# Skill Finder 使用指南

## 🚀 快速开始

### 1. 安装技能

```bash
bash /root/.nanobot/workspace/skills/skill-finder/install.sh
```

### 2. （可选）配置 GitHub Token

为了提高 GitHub API 搜索限额，建议设置 Token：

```bash
export SKILL_FINDER_GITHUB_TOKEN="your_github_token"
```

获取 Token：https://github.com/settings/tokens

---

## 📖 命令详解

### 🔍 搜索技能

```bash
# 搜索所有来源的技能
python3 /root/.nanobot/workspace/skills/skill-finder/skill_finder.py search youtube

# 搜索结果示例
{
  "success": true,
  "message": "搜索完成：youtube",
  "data": {
    "github": [
      {
        "source": "github",
        "name": "nanobot-youtube-skill",
        "full_name": "user/nanobot-youtube-skill",
        "description": "YouTube 视频转录技能",
        "url": "https://github.com/user/nanobot-youtube-skill",
        "stars": 42,
        "clone_url": "https://github.com/user/nanobot-youtube-skill.git",
        "has_skill_file": true
      }
    ],
    "system": [
      {
        "source": "system",
        "name": "summarize",
        "description": "Summarize or extract text/transcripts from URLs",
        "path": "/home/nanobot-main/nanobot/skills/summarize",
        "available": false
      }
    ]
  }
}
```

### 📥 安装技能

```bash
# 自动选择来源（优先系统技能，其次 GitHub）
python3 /root/.nanobot/workspace/skills/skill-finder/skill_finder.py install weather

# 强制从系统技能安装
python3 /root/.nanobot/workspace/skills/skill-finder/skill_finder.py install weather system

# 从 GitHub 安装
python3 /root/.nanobot/workspace/skills/skill-finder/skill_finder.py install user/nanobot-youtube-skill github
```

### 📋 列出已安装技能

```bash
python3 /root/.nanobot/workspace/skills/skill-finder/skill_finder.py list
```

输出示例：
```json
{
  "success": true,
  "message": "已安装 3 个技能",
  "data": [
    {
      "name": "tavily-search",
      "description": "使用 Tavily 搜索引擎执行高级网络搜索",
      "version": "1.0.0",
      "path": "/root/.nanobot/workspace/skills/tavily-search"
    },
    {
      "name": "skill-finder",
      "description": "自主搜索、下载和安装 nanobot 技能包",
      "version": "1.0.0",
      "path": "/root/.nanobot/workspace/skills/skill-finder"
    }
  ]
}
```

### 🗑️ 卸载技能

```bash
python3 /root/.nanobot/workspace/skills/skill-finder/skill_finder.py uninstall skill-name
```

---

## 🤖 AI 助手集成示例

在 nanobot 对话中，现在可以这样使用：

**用户**: "帮我找一个 YouTube 转录技能"

**nanobot**: 
```
正在搜索技能...
找到以下相关技能：
1. nanobot-youtube-transcript (GitHub, 42⭐)
2. summarize (系统技能，需要安装 summarize CLI)

你想安装哪一个？
```

**用户**: "安装第一个"

**nanobot**: 
```
正在从 GitHub 安装 nanobot-youtube-transcript...
✅ 安装成功！技能已就绪。
```

---

## 🔧 高级用法

### 搜索特定类型的技能

```bash
# 搜索视频相关技能
python3 .../skill_finder.py search video

# 搜索 AI/ML 相关技能
python3 .../skill_finder.py search ai machine-learning

# 搜索集成类技能
python3 .../skill_finder.py search integration api
```

### 批量安装技能

```bash
# 创建安装脚本
cat > install_skills.sh << 'EOF'
#!/bin/bash
skills=("weather" "cron" "tmux")
for skill in "${skills[@]}"; do
    python3 /root/.nanobot/workspace/skills/skill-finder/skill_finder.py install $skill
done
EOF

bash install_skills.sh
```

---

## 📁 技能包结构规范

一个标准的技能包应包含：

```
skill-name/
├── SKILL.md          # 必需：技能描述（YAML frontmatter + Markdown）
├── skill_name.py     # 推荐：核心代码
├── install.sh        # 可选：依赖安装脚本
├── USAGE.md          # 可选：详细使用说明
├── scripts/          # 可选：辅助脚本
└── references/       # 可选：参考文档
```

### SKILL.md 模板

```markdown
---
name: skill-name
description: 技能的简短描述
version: 1.0.0
author: 作者名
tags: [tag1, tag2]
dependencies:
  - package1
  - package2
environment:
  - API_KEY: 说明
---

# 技能详细说明

## 功能
...

## 使用方法
...
```

---

## ⚠️ 注意事项

1. **权限问题**：确保对 skills 目录有写入权限
2. **依赖冲突**：安装前检查技能的依赖要求
3. **API Key**：某些技能需要配置环境变量
4. **网络访问**：GitHub 搜索需要网络连接
5. **备份**：卸载技能前建议备份重要数据

---

## 🐛 故障排除

### 问题：搜索返回空结果

```bash
# 检查网络连接
curl -I https://api.github.com

# 检查 GitHub Token（如果设置了）
echo $SKILL_FINDER_GITHUB_TOKEN
```

### 问题：安装失败

```bash
# 查看详细错误
python3 .../skill_finder.py install skill-name 2>&1 | tee install.log

# 检查目标目录权限
ls -la /root/.nanobot/workspace/skills/
```

### 问题：技能安装后不可用

```bash
# 检查 SKILL.md 是否存在
cat /root/.nanobot/workspace/skills/skill-name/SKILL.md

# 检查依赖是否安装
bash /root/.nanobot/workspace/skills/skill-name/install.sh
```

---

## 📞 支持

遇到问题？可以：
1. 查看技能仓库的 Issues
2. 检查 nanobot 文档
3. 联系技能作者
