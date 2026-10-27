#!/usr/bin/env bash
#
# Builds the documentation site into target/site:
#
#   target/site/index.html   the landing page (docs/site)
#   target/site/assets/      the shared styles, scripts and icon (docs/assets)
#   target/site/book/        the manual (mdBook, docs/src)
#
# .github/workflows/docs.yml runs it and publishes target/site on GitHub
# Pages (https://www.onlabs.org/stilo/).
#
# Requires mdBook 0.4 (https://rust-lang.github.io/mdBook/). Set MDBOOK to
# the path of the mdbook binary if it is not on the PATH.
#
# To preview the site:  python3 -m http.server -d target/site

set -euo pipefail

cd "$(dirname "$0")/.."
site=target/site
mdbook=${MDBOOK:-mdbook}

rm -rf "$site"
mkdir -p "$site"
# Landing page and shared assets
cp docs/site/index.html "$site/"
cp -r docs/assets "$site/assets"

# Manual
"$mdbook" build docs
cp -r target/book "$site/book"

echo "Site built in $site"
