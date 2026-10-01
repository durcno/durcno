sync-logo:
    @echo "✅ Syncing logo"
    dprint fmt ./logo.svg
    cp logo.svg website/static/img/logo.svg
    rsvg-convert -f png -o website/static/img/logo.png --width 512 --height 512 logo.svg
    convert website/static/img/logo.png -resize 32x32 website/static/favicon.ico
    @echo "✅ Synced logo"