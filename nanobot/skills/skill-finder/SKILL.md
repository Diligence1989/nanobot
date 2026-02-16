---
name: skill-finder
description: 自主搜索、下载和安装 nanobot 技能包。支持从 GitHub、HuggingFace、官方仓库等来源查找技能，自动处理依赖安装和配置。
version: 1.0.0
author: nanobot
tags: [skill, installer, search, automation]
dependencies:
  - requests
  - git
environment:
  - SKILL_FINDER_GITHUB_TOKEN: 可选，GitHub API Token（提高搜索限额）
---

# Skill Finder - 技能搜索器

## 功能概述

自主搜索、下载和安装 nanobot 技能包，让 AI 助手能够动态扩展能力。

## 核心能力

1. **搜索技能**：从多个来源查找技能（GitHub、HuggingFace、官方仓库）
2. **预览技能**：显示技能详情、依赖和配置要求
3. **下载技能**：自动下载 .skill 包或 Git 仓库
4. **安装技能**：解压、复制、安装依赖、配置环境变量
5. **验证技能**：测试技能是否正确加载

## 使用方法

```bash
# 搜索技能
python3 /root/.nanobot/workspace/skills/skill-finder/skill_finder.py search "youtube"

# 安装技能
python3 /root/.nanobot/workspace/skills/skill-finder/skill_finder.py install <skill-name>

# 列出已安装技能
python3 /root/.nanobot/workspace/skills/skill-finder/skill_finder.py list

# 卸载技能
python3 /root/.nanobot/workspace/skills/skill-finder/skill_finder.py uninstall <skill-name>
```

## 支持的技能来源

| 来源 | 说明 |
|------|------|
| GitHub | 搜索 nanobot-skill 相关的仓库 |
| HuggingFace | 搜索 Spaces 和 Datasets 中的技能 |
| 官方仓库 | nanobot 官方技能市场 |
| 本地文件 | 安装本地 .skill 包 |

## 输出格式

所有命令返回 JSON 格式结果，便于 AI 助手解析和处理。
