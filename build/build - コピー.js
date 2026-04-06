const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const DATA_FILE = path.join(ROOT, "data", "images.json");
const INDEX_TEMPLATE_FILE = path.join(ROOT, "build", "templates", "index.template.html");
const CUT_TEMPLATE_FILE = path.join(ROOT, "build", "templates", "cut.template.html");
const WIDE_TEMPLATE_FILE = path.join(ROOT, "build", "templates", "wide.template.html");
const OUTPUT_INDEX_FILE = path.join(ROOT, "index.html");
const OUTPUT_CUTS_DIR = path.join(ROOT, "cuts");

const SITE_ORIGIN = "https://eve.npaso.com";
const OUTPUT_SITEMAP_FILE = path.join(ROOT, "sitemap.xml");
const OUTPUT_ROBOTS_FILE = path.join(ROOT, "robots.txt");

const IMAGE_BASE_URL = "https://img.eve.npaso.com";
const HIDDEN_TAGS = ["soft"];
const GRID_COLUMNS = 5;
const DESKTOP_ITEMS_PER_PAGE = 60;

function escapeHtml(value = "") {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function escapeAttribute(value = "") {
    return escapeHtml(value).replace(/`/g, "&#096;");
}

function escapeScriptJson(value = "") {
    return String(value)
        .replace(/</g, "\\u003c")
        .replace(/>/g, "\\u003e")
        .replace(/&/g, "\\u0026")
        .replace(/\u2028/g, "\\u2028")
        .replace(/\u2029/g, "\\u2029");
}

function nl2br(value = "") {
    return escapeHtml(value).replace(/\n/g, "<br>");
}

function ensureDir(dirPath) {
    fs.mkdirSync(dirPath, { recursive: true });
}

function readText(filePath) {
    return fs.readFileSync(filePath, "utf8");
}

function writeText(filePath, content) {
    ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, content, "utf8");
}

function extractDateFromId(id = "") {
    const match = String(id).match(/(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})/);

    if (!match) {
        return {
            isoDate: "",
            displayDate: "",
            compact: "",
            timestamp: 0
        };
    }

    const [, y, m, d, hh, mm, ss] = match;

    return {
        isoDate: `${y}-${m}-${d}`,
        displayDate: `${y}.${m}.${d}`,
        compact: `${y}${m}${d}`,
        timestamp: Number(`${y}${m}${d}${hh}${mm}${ss}`)
    };
}

function getImageUrls(id) {
    return {
        thumb: `${IMAGE_BASE_URL}/thumb/${id}.webp`,
        medium: `${IMAGE_BASE_URL}/medium/${id}.webp`,
        original: `${IMAGE_BASE_URL}/original/${id}.webp`,
        wide: `${IMAGE_BASE_URL}/wide/${id}.webp`
    };
}

function getVisibleTags(tags = []) {
    return tags.filter((tag) => !HIDDEN_TAGS.includes(tag));
}

function getImageAlt(image) {
    return (image.alt || image.title || image.id || "").trim();
}

function buildSeoDescription(image) {
    if (image.seoDescription && image.seoDescription.trim()) {
        return image.seoDescription.trim();
    }

    const title = image.title || image.id;
    const alt = getImageAlt(image);
    return `${title}。${alt}を描く生成AIギャラリーページ。`;
}

function normalizeImage(image) {
    const dateInfo = extractDateFromId(image.id);

    return {
        ...image,
        date: image.date || dateInfo.isoDate,
        displayDate: dateInfo.displayDate,
        compactDate: dateInfo.compact,
        timestamp: dateInfo.timestamp,
        seoDescription: buildSeoDescription(image)
    };
}

function sortImagesForTop(images, sortOrder = "left-new") {
    const items = [...images];

    items.sort((a, b) => {
        const aFeatured = a.featured ? 1 : 0;
        const bFeatured = b.featured ? 1 : 0;

        if (aFeatured !== bFeatured) {
            return bFeatured - aFeatured;
        }

        if (sortOrder === "old") {
            return a.timestamp - b.timestamp || String(a.id).localeCompare(String(b.id));
        }

        return b.timestamp - a.timestamp || String(b.id).localeCompare(String(a.id));
    });

    return items;
}

function chunkArray(items, size) {
    const chunks = [];

    for (let i = 0; i < items.length; i += size) {
        chunks.push(items.slice(i, i + size));
    }

    return chunks;
}

function createCardHtml(image, relativePrefix = "./") {
    const urls = getImageUrls(image.id);
    const tagsHtml = getVisibleTags(image.tags || [])
        .map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`)
        .join("");

    return `
        <article class="card">
            <a href="${relativePrefix}cuts/${encodeURIComponent(image.id)}/" class="card__link" aria-label="${escapeAttribute(image.title || image.id)} の詳細ページへ">
                <div class="card__thumb">
                    <img src="${escapeAttribute(urls.thumb)}" alt="${escapeAttribute(getImageAlt(image))}" loading="lazy" />
                </div>
                <div class="card__body">
                    <h3 class="card__title">${escapeHtml(image.title || image.id)}</h3>
                    <div class="card__date">${escapeHtml(image.displayDate || "")}</div>
                    <div class="tags">${tagsHtml}</div>
                </div>
            </a>
        </article>
    `;
}

function createSpacerHtml(relativePrefix = "./") {
    return `
        <article class="card ornament-card" aria-hidden="true">
            <div class="card__media ornament-slot">
                <img src="${escapeAttribute(relativePrefix + "images/eve-loss-ornament.webp")}" alt="" class="ornament-slot__image" />
            </div>
            <div class="ornament-card__body"></div>
        </article>
    `;
}

function buildFixedRowsTopDown(imagesNewestFirst) {
    const chronological = [...imagesNewestFirst].reverse();
    const rowsBottomUp = chunkArray(chronological, GRID_COLUMNS);
    return rowsBottomUp.reverse();
}

function buildDesktopFixedGalleryHtml(imagesNewestFirst, relativePrefix = "./") {
    const rowsTopDown = buildFixedRowsTopDown(imagesNewestFirst);

    return rowsTopDown
        .map((row) => {
            const slots = [...row];

            while (slots.length < GRID_COLUMNS) {
                slots.push(null);
            }

            return slots
                .map((item) => (item ? createCardHtml(item, relativePrefix) : createSpacerHtml(relativePrefix)))
                .join("");
        })
        .join("");
}

function buildCutStructuredData(image) {
    const urls = getImageUrls(image.id);

    return escapeScriptJson(JSON.stringify({
        "@context": "https://schema.org",
        "@type": "ImageObject",
        "name": image.title || image.id,
        "description": image.seoDescription || "",
        "contentUrl": urls.original,
        "thumbnailUrl": urls.thumb,
        "url": `https://eve.npaso.com/cuts/${encodeURIComponent(image.id)}/`,
        "datePublished": image.date || undefined,
        "inLanguage": "ja",
        "caption": getImageAlt(image)
    }));
}

function replaceToken(template, token, value) {
    return template.replace(new RegExp(`__${token}__`, "g"), value);
}

function buildTopInitialGalleryHtml(images) {
    const firstPageImages = sortImagesForTop(images, "left-new").slice(0, DESKTOP_ITEMS_PER_PAGE);
    return buildDesktopFixedGalleryHtml(firstPageImages, "./");
}

function buildIndexHtml(images) {
    let template = readText(INDEX_TEMPLATE_FILE);
    const total = images.length;
    const normalized = sortImagesForTop(images, "left-new");
    const initialGalleryHtml = buildTopInitialGalleryHtml(images);
    const initialJson = escapeScriptJson(JSON.stringify(normalized));

    template = replaceToken(template, "PAGE_TITLE", escapeHtml("イブの喪失 | The Absence of Eve"));
    template = replaceToken(
        template,
        "META_DESCRIPTION",
        escapeAttribute("アンドロイド『イブ』の記録を辿る生成AI画像ギャラリー。各cutごとの個別ページと物語本文を収録。")
    );
    template = replaceToken(template, "CURRENT_COUNT", escapeHtml(`${total.toLocaleString("ja-JP")} images`));
    template = replaceToken(template, "INITIAL_GALLERY", initialGalleryHtml);
    template = replaceToken(template, "INITIAL_IMAGES_JSON", initialJson);

    return template;
}

function buildCutHtml({ image, previousImage, nextImage, position, total }) {
    let template = readText(CUT_TEMPLATE_FILE);
    const urls = getImageUrls(image.id);
    const tagsHtml = getVisibleTags(image.tags || [])
        .map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`)
        .join("");

    const prevHtml = previousImage
        ? `<a class="button" href="../${encodeURIComponent(previousImage.id)}/">← 前のcut</a>`
        : `<span class="button is-disabled" aria-disabled="true">← 前のcut</span>`;

    const nextHtml = nextImage
        ? `<a class="button" href="../${encodeURIComponent(nextImage.id)}/">次のcut →</a>`
        : `<span class="button is-disabled" aria-disabled="true">次のcut →</span>`;

    const wideHtml = image.hasWide
        ? `<a class="button detail-wide-link detail-wide-link--desktop" href="./wide/" aria-label="${escapeAttribute(image.title || image.id)} の高画質ページを開く">高画質</a>`
        : "";

    template = replaceToken(template, "PAGE_TITLE", escapeHtml(`${image.title || image.id} | イブの喪失`));
    template = replaceToken(template, "META_DESCRIPTION", escapeAttribute(image.seoDescription));
    template = replaceToken(template, "CANONICAL_PATH", escapeAttribute(`/cuts/${image.id}/`));
    template = replaceToken(template, "STRUCTURED_DATA", buildCutStructuredData(image));
    template = replaceToken(template, "IMAGE_ALT", escapeAttribute(getImageAlt(image)));
    template = replaceToken(template, "IMAGE_MEDIUM_URL", escapeAttribute(urls.medium));
    template = replaceToken(template, "TITLE", escapeHtml(image.title || image.id));
    template = replaceToken(template, "DESCRIPTION_HTML", nl2br(image.description || ""));
    template = replaceToken(template, "DISPLAY_DATE", escapeHtml(image.displayDate || ""));
    template = replaceToken(template, "POSITION", escapeHtml(`${position} / ${total}`));
    template = replaceToken(template, "TAGS", tagsHtml);
    template = replaceToken(template, "PREV_LINK", prevHtml);
    template = replaceToken(template, "NEXT_LINK", nextHtml);
    template = replaceToken(template, "WIDE_LINK", wideHtml);
    template = replaceToken(template, "ORIGINAL_URL", escapeAttribute(urls.original));
    template = replaceToken(template, "THUMB_URL", escapeAttribute(urls.thumb));

    return template;
}

function buildWideHtml({ image }) {
    let template = readText(WIDE_TEMPLATE_FILE);
    const urls = getImageUrls(image.id);

    template = replaceToken(template, "PAGE_TITLE", escapeHtml(`${image.title || image.id} | 横画像 | イブの喪失`));
    template = replaceToken(
        template,
        "META_DESCRIPTION",
        escapeAttribute(`${image.title || image.id} の横画像表示ページです。`)
    );
    template = replaceToken(template, "CANONICAL_PATH", escapeAttribute(`/cuts/${image.id}/wide/`));
    template = replaceToken(template, "TITLE", escapeHtml(image.title || image.id));
    template = replaceToken(template, "DISPLAY_DATE", escapeHtml(image.displayDate || ""));
    template = replaceToken(template, "IMAGE_ALT", escapeAttribute(getImageAlt(image)));
    template = replaceToken(template, "WIDE_IMAGE_URL", escapeAttribute(urls.wide));

    return template;
}

function buildSitemapXml(images) {
    const latestImageDate = images.reduce((latest, image) => {
        if (!image.date) {
            return latest;
        }

        return !latest || image.date > latest ? image.date : latest;
    }, "");

    const urls = [
        {
            loc: `${SITE_ORIGIN}/`,
            lastmod: latestImageDate
        },
        ...images.map((image) => ({
            loc: `${SITE_ORIGIN}/cuts/${encodeURIComponent(image.id)}/`,
            lastmod: image.date || ""
        }))
    ];

    const body = urls
        .map(({ loc, lastmod }) => {
            const lastmodTag = lastmod ? `\n    <lastmod>${escapeHtml(lastmod)}</lastmod>` : "";
            return `  <url>\n    <loc>${escapeHtml(loc)}</loc>${lastmodTag}\n  </url>`;
        })
        .join("\n");

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;
}

function buildRobotsTxt() {
    return `User-agent: *
Allow: /

Sitemap: ${SITE_ORIGIN}/sitemap.xml
`;
}

function main() {
    if (!fs.existsSync(DATA_FILE)) {
        throw new Error(`images.json が見つかりません: ${DATA_FILE}`);
    }

    const raw = readText(DATA_FILE);
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
        throw new Error("images.json の形式が正しくありません。配列が必要です。");
    }

    const images = parsed.map(normalizeImage);
    const episodeImages = [...images].sort(
        (a, b) => a.timestamp - b.timestamp || String(a.id).localeCompare(String(b.id))
    );

    writeText(OUTPUT_INDEX_FILE, buildIndexHtml(images));
    writeText(OUTPUT_SITEMAP_FILE, buildSitemapXml(images));
    writeText(OUTPUT_ROBOTS_FILE, buildRobotsTxt());

    fs.rmSync(OUTPUT_CUTS_DIR, { recursive: true, force: true });
    ensureDir(OUTPUT_CUTS_DIR);

    let widePageCount = 0;

    episodeImages.forEach((image, index) => {
        const dir = path.join(OUTPUT_CUTS_DIR, image.id);
        const previousImage = index > 0 ? episodeImages[index - 1] : null;
        const nextImage = index < episodeImages.length - 1 ? episodeImages[index + 1] : null;
        const html = buildCutHtml({
            image,
            previousImage,
            nextImage,
            position: index + 1,
            total: episodeImages.length
        });

        writeText(path.join(dir, "index.html"), html);

        if (image.hasWide) {
            const wideHtml = buildWideHtml({ image });
            writeText(path.join(dir, "wide", "index.html"), wideHtml);
            widePageCount += 1;
        }
    });

    console.log(`Generated: index.html + ${episodeImages.length} cut pages + ${widePageCount} wide pages`);
}

main();