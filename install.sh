#!/usr/bin/env bash
#
# Mui简历 Skills 安装脚本
#
# 把仓库里 skills/* 下每个 skill 目录软链到 ~/.claude/skills/，
# 让 Claude Code 启动时能自动发现它们。
#
# 用法：
#   ./install.sh                     # 默认装到 ~/.claude/skills/
#   CLAUDE_SKILLS_DIR=/custom ./install.sh   # 指定目录
#
# 卸载：直接删除 ~/.claude/skills/muicv-* 对应软链即可。

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILLS_SRC="$REPO_ROOT/skills"
SKILLS_DST="${CLAUDE_SKILLS_DIR:-$HOME/.claude/skills}"

if [[ ! -d "$SKILLS_SRC" ]]; then
  echo "✗ 找不到源目录: $SKILLS_SRC" >&2
  exit 1
fi

mkdir -p "$SKILLS_DST"

installed=0
skipped=0

for skill_dir in "$SKILLS_SRC"/*/; do
  [[ -d "$skill_dir" ]] || continue

  skill_name="$(basename "$skill_dir")"
  target="$SKILLS_DST/$skill_name"

  if [[ -L "$target" ]]; then
    existing="$(readlink "$target")"
    if [[ "$existing" == "${skill_dir%/}" ]]; then
      echo "= $skill_name 已指向本仓库，跳过"
      skipped=$((skipped + 1))
      continue
    fi
    echo "⚠ $skill_name 已软链到其他位置: $existing" >&2
    echo "  如需替换，请先 rm \"$target\"" >&2
    skipped=$((skipped + 1))
    continue
  fi

  if [[ -e "$target" ]]; then
    echo "⚠ $skill_name 已存在于 $target 但不是软链，跳过" >&2
    skipped=$((skipped + 1))
    continue
  fi

  ln -s "${skill_dir%/}" "$target"
  echo "✓ $skill_name → $target"
  installed=$((installed + 1))
done

echo ""
echo "完成：新装 $installed 个，跳过 $skipped 个。"
echo ""
echo "下一步："
echo "  1. 启动 Claude Code：在任意项目目录下运行 \`claude\`"
echo "  2. 跟 Claude 说：「帮我准备简历」或「我想管理一下我的工作经历」"
echo "  3. 首次触发时 muicv-core 会自动引导在当前项目下初始化 .claude/muicv/"
