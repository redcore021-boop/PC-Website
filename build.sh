#!/bin/sh
# Wraps index.html (the artifact page fragment) into a standalone document for GitHub Pages: docs/index.html
set -e
cd "$(dirname "$0")"
{
  printf '%s\n' '<!doctype html>' '<html lang="he" dir="rtl">' '<head>' \
    '<meta charset="utf-8">' \
    '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">' \
    '<meta name="apple-mobile-web-app-capable" content="yes">' \
    '<meta name="mobile-web-app-capable" content="yes">' \
    '<meta name="apple-mobile-web-app-status-bar-style" content="default">' \
    '<meta name="apple-mobile-web-app-title" content="מאזן">' \
    '<meta name="theme-color" content="#F2F5F1">' \
    '<link rel="apple-touch-icon" href="icon-180.png">' \
    '<link rel="manifest" href="manifest.json">' \
    '<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,-apple-system,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style>' \
    '</head>' '<body>'
  cat index.html
  printf '%s\n' '</body>' '</html>'
} > docs/index.html
echo "built docs/index.html"
