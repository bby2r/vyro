#!/bin/bash

SHARED=".ai/shared-skills/skills"
LOCAL=".ai/skills"
CLAUDE=".claude/skills"

cd .ai/shared-skills && git checkout -- . && cd ../..
git submodule update --remote .ai/shared-skills

# 1) shared-skills → .ai/skills (симлинки)
for skill in "$SHARED"/*/; do
    name=$(basename "$skill")
    if [ ! -L "$LOCAL/$name" ] && [ ! -d "$LOCAL/$name" ]; then
        ln -s "../shared-skills/skills/$name" "$LOCAL/$name"
        echo "linked (shared→local): $name"
    fi
done

# 2) «беспризорные» папки из .claude/skills → перенести в .ai/skills
for skill in "$CLAUDE"/*/; do
    name=$(basename "$skill")
    src="$CLAUDE/$name"
    dst="$LOCAL/$name"
    if [ -d "$src" ] && [ ! -L "$src" ] && [ ! -e "$dst" ]; then
        mv "$src" "$dst"
        echo "moved (claude→local): $name"
    fi
done

# 3) .ai/skills → .claude/skills (симлинки; обычные папки в .claude заменяем)
for skill in "$LOCAL"/*/; do
    name=$(basename "$skill")
    target="$CLAUDE/$name"
    if [ -e "$target" ] && [ ! -L "$target" ]; then
        rm -rf "$target"
        echo "removed non-link: $CLAUDE/$name"
    fi
    if [ ! -L "$target" ]; then
        ln -s "../../.ai/skills/$name" "$target"
        echo "linked (local→claude): $name"
    fi
done

echo "done"
