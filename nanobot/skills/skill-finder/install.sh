#!/bin/bash
# Skill Finder 安装脚本

echo "🔧 正在安装 Skill Finder 技能..."

# 检查 Python 版本
python3 --version || {
    echo "❌ 错误：需要 Python 3"
    exit 1
}

# 安装依赖
echo "📦 安装 Python 依赖..."
pip3 install requests --quiet

# 设置执行权限
chmod +x /root/.nanobot/workspace/skills/skill-finder/skill_finder.py

# 验证安装
echo "✅ 验证安装..."
python3 /root/.nanobot/workspace/skills/skill-finder/skill_finder.py list > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo "🎉 Skill Finder 安装成功！"
    echo ""
    echo "使用方法："
    echo "  python3 /root/.nanobot/workspace/skills/skill-finder/skill_finder.py search <关键词>"
    echo "  python3 /root/.nanobot/workspace/skills/skill-finder/skill_finder.py install <技能名>"
    echo "  python3 /root/.nanobot/workspace/skills/skill-finder/skill_finder.py list"
    echo ""
    echo "可选：设置 GitHub Token 提高搜索限额"
    echo "  export SKILL_FINDER_GITHUB_TOKEN=your_token"
else
    echo "⚠️  安装完成，但验证失败。请手动测试。"
fi
