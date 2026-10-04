#!/bin/sh
# Wraps src/game.html (artifact body) into a standalone index.html.
cd "$(dirname "$0")"
{ printf '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<style>[hidden]{display:none!important}body{margin:0}</style>\n</head>\n<body>\n'; cat src/game.html; printf '\n</body>\n</html>\n'; } > index.html
