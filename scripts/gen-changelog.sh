#!/bin/bash
# Generate a structured prompt for AI to update CHANGELOG.md
# Usage: ./scripts/gen-changelog.sh [-a] [-p project_dir]

set -euo pipefail
PROJECT_DIR="${2:-$(cd "$(dirname "$0")/.." && pwd)}"
CHANGELOG="$PROJECT_DIR/docs/CHANGELOG.md"
OUTPUT_FILE="$PROJECT_DIR/.claude/changelog-prompt.txt"

# Extract the date of the most recent CHANGELOG entry
LAST_DATE=$(head -50 "$CHANGELOG" | sed -n 's/^## \([0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}\).*/\1/p' | head -1)
if [ -z "$LAST_DATE" ]; then
  echo "Error: Could not find date in CHANGELOG.md" >&2
  exit 1
fi

# Get commits since last changelog date (exclusive), with detailed info
COMMITS=$(git -C "$PROJECT_DIR" log --since="$LAST_DATE 23:59:59" \
  --format="%h | %ad | %an | %s" --date=short 2>/dev/null || true)

if [ -z "$COMMITS" ]; then
  echo "No new commits since $LAST_DATE" >&2
  exit 0
fi

COMMIT_COUNT=$(echo "$COMMITS" | wc -l | tr -d ' ')

# Get the shortstat for each commit to understand scope
COMMIT_DETAILS=$(git -C "$PROJECT_DIR" log --since="$LAST_DATE 23:59:59" \
  --format="---COMMIT---%n%h %ad %s%nFiles:" --date=short --shortstat 2>/dev/null || true)

cat > "$OUTPUT_FILE" << 'PROMPT_HEADER'
你是一个技术文档撰写者。请根据以下 git 提交记录，用中文生成 CHANGELOG 条目，追加到 docs/CHANGELOG.md 文件顶部。

要求：
1. 按功能主题对提交进行分组（如：AI 功能、认证系统、Bug 修复、代码重构、文档等）
2. 每个分组下用一句话描述每个变更，使用中文
3. 忽略纯 debug/chore 类提交（如 "debug: add console.log"、"chore: remove..."）
4. 保持与现有 CHANGELOG 一致的格式：## YYYY-MM-DD - 简短主题标题，然后 ### 分组的格式
5. 日期使用今天的日期 (YYYY-MM-DD)

现有 CHANGELOG 格式参考：
```
## 2026-05-13 - AI 深度整合与系统重构

### AI 解释增强
- 文本选中解释增加**问题输入框**，用户可附带问题一起提交给 AI
- 支持**多轮追问**：同一段选中文本可连续提问，保持对话上下文
...
```

以下是自上次 CHANGELOG 更新（LAST_DATE_PLACEHOLDER）以来的所有提交（共 COMMIT_COUNT_PLACEHOLDER 个）：

PROMPT_HEADER

# Replace placeholders
sed -i '' "s/LAST_DATE_PLACEHOLDER/$LAST_DATE/g" "$OUTPUT_FILE"
sed -i '' "s/COMMIT_COUNT_PLACEHOLDER/$COMMIT_COUNT/g" "$OUTPUT_FILE"

echo "$COMMITS" >> "$OUTPUT_FILE"

echo "" >> "$OUTPUT_FILE"
echo "请将生成的 CHANGELOG 条目插入到 docs/CHANGELOG.md 文件顶部（在 '# Changelog' 标题行之后），然后提交并推送。" >> "$OUTPUT_FILE"

if [ "${1:-}" = "-a" ]; then
  cat "$OUTPUT_FILE"
  echo ""
  echo "---"
  echo "Prompt saved to: $OUTPUT_FILE"
  echo "To auto-apply, copy this prompt to Claude Code."
else
  echo "Found $COMMIT_COUNT commits since $LAST_DATE"
  echo "Prompt saved to: $OUTPUT_FILE"
  echo ""
  echo "To generate changelog, run:"
  echo "  cat $OUTPUT_FILE"
fi
