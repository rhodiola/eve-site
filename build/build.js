const fs = require("fs");
const path = require("path");
const https = require("https");

const ROOT = process.cwd();
const DATA_FILE = path.join(ROOT, "data", "images.json");

const INDEX_TEMPLATE_FILE = path.join(ROOT, "build", "templates", "index.template.html");
const CUT_TEMPLATE_FILE = path.join(ROOT, "build", "templates", "cut.template.html");
const FULL_TEMPLATE_FILE = path.join(ROOT, "build", "templates", "full.template.html");

const INDEX_EN_TEMPLATE_FILE = path.join(ROOT, "build", "templates", "index.en.template.html");
const CUT_EN_TEMPLATE_FILE = path.join(ROOT, "build", "templates", "cut.en.template.html");

const OUTPUT_INDEX_FILE = path.join(ROOT, "index.html");
const OUTPUT_CUTS_DIR = path.join(ROOT, "cuts");

const OUTPUT_EN_DIR = path.join(ROOT, "en");
const OUTPUT_EN_INDEX_FILE = path.join(OUTPUT_EN_DIR, "index.html");
const OUTPUT_EN_CUTS_DIR = path.join(OUTPUT_EN_DIR, "cuts");

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

function toCrlf(text = "") {
    return String(text).replace(/\r?\n/g, "\r\n");
}

function writeText(filePath, content) {
    ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, toCrlf(content), "utf8");
}

function checkRemoteFileExists(url, redirectCount = 0) {
    return new Promise((resolve) => {
        const request = https.request(url, { method: "GET" }, (response) => {
            const statusCode = response.statusCode || 0;

            if (
                statusCode >= 300 &&
                statusCode < 400 &&
                response.headers.location &&
                redirectCount < 5
            ) {
                response.resume();
                const redirectedUrl = new URL(response.headers.location, url).toString();
                resolve(checkRemoteFileExists(redirectedUrl, redirectCount + 1));
                return;
            }

            response.destroy();
            resolve(statusCode >= 200 && statusCode < 300);
        });

        request.on("error", () => resolve(false));
        request.end();
    });
}

function getRemoteDownloadUrl(id) {
    return `${IMAGE_BASE_URL}/download/${id}.webp`;
}

function getRemoteDownload2Url(id) {
    return `${IMAGE_BASE_URL}/download2/${id}.webp`;
}

async function attachRemoteAssetFlags(images) {
    return Promise.all(
        images.map(async (image) => {
            const [hasFull, hasDownload2] = await Promise.all([
                checkRemoteFileExists(getRemoteDownloadUrl(image.id)),
                checkRemoteFileExists(getRemoteDownload2Url(image.id))
            ]);

            return {
                ...image,
                hasFull,
                hasDownload2
            };
        })
    );
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
        download: `${IMAGE_BASE_URL}/download/${id}.webp`,
        download2: `${IMAGE_BASE_URL}/download2/${id}.webp`
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

function buildSeoDescriptionEn(image) {
    if (image.seoDescription && image.seoDescription.trim()) {
        return image.seoDescription.trim();
    }

    const title = image.title || image.id;
    const alt = getImageAlt(image);
    return `${title}. An AI-generated gallery page featuring ${alt}.`;
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

function hasEnglishVersion(image) {
    return Boolean(
        image &&
        image.en &&
        typeof image.en === "object" &&
        Object.keys(image.en).length > 0
    );
}

function normalizeEnglishImage(image) {
    const en = image.en || {};
    const tags = Array.isArray(en.tags) && en.tags.length > 0 ? en.tags : image.tags || [];

    const normalized = {
        ...image,
        title: en.title || image.title || image.id,
        seoDescription: en.seoDescription || image.seoDescription || "",
        description: en.description || image.description || "",
        alt: en.alt || image.alt || image.title || image.id,
        tags,
        featured: Boolean(image.featured),
        hasFull: Boolean(image.hasFull),
        hasDownload2: Boolean(image.hasDownload2)
    };

    normalized.seoDescription = buildSeoDescriptionEn(normalized);
    return normalized;
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

function createCardHtmlEn(image, relativePrefix = "./") {
    const urls = getImageUrls(image.id);
    const tagsHtml = getVisibleTags(image.tags || [])
        .map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`)
        .join("");

    return `
        <article class="card">
            <a href="${relativePrefix}cuts/${encodeURIComponent(image.id)}/" class="card__link" aria-label="Open ${escapeAttribute(image.title || image.id)}">
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

function buildDesktopFixedGalleryHtmlEn(imagesNewestFirst) {
    const rowsTopDown = buildFixedRowsTopDown(imagesNewestFirst);

    return rowsTopDown
        .map((row) => {
            const slots = [...row];

            while (slots.length < GRID_COLUMNS) {
                slots.push(null);
            }

            return slots
                .map((item) => (item ? createCardHtmlEn(item, "./") : createSpacerHtml("../")))
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
        "url": `${SITE_ORIGIN}/cuts/${encodeURIComponent(image.id)}/`,
        "datePublished": image.date || undefined,
        "inLanguage": "ja",
        "caption": getImageAlt(image)
    }));
}

function buildCutStructuredDataEn(image) {
    const urls = getImageUrls(image.id);

    return escapeScriptJson(JSON.stringify({
        "@context": "https://schema.org",
        "@type": "ImageObject",
        "name": image.title || image.id,
        "description": image.seoDescription || "",
        "contentUrl": urls.original,
        "thumbnailUrl": urls.thumb,
        "url": `${SITE_ORIGIN}/en/cuts/${encodeURIComponent(image.id)}/`,
        "datePublished": image.date || undefined,
        "inLanguage": "en",
        "caption": getImageAlt(image)
    }));
}

function replaceToken(template, token, value) {
    return template.replace(new RegExp(`__${token}__`, "g"), value);
}

function buildJaLangSwitchHtml(image) {
    if (!hasEnglishVersion(image)) {
        return "";
    }

    return `<a href="../../en/cuts/${encodeURIComponent(image.id)}/" lang="en">EN</a>`;
}

function buildEnLangSwitchHtml(image) {
    return `<a href="../../../cuts/${encodeURIComponent(image.id)}/" lang="ja">JP</a>`;
}

function buildTopInitialGalleryHtml(images) {
    const firstPageImages = sortImagesForTop(images, "left-new").slice(0, DESKTOP_ITEMS_PER_PAGE);
    return buildDesktopFixedGalleryHtml(firstPageImages, "./");
}

function buildTopInitialGalleryHtmlEn(images) {
    const firstPageImages = sortImagesForTop(images, "left-new").slice(0, DESKTOP_ITEMS_PER_PAGE);
    return buildDesktopFixedGalleryHtmlEn(firstPageImages);
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

function buildIndexEnHtml(images) {
    let template = readText(INDEX_EN_TEMPLATE_FILE);
    const total = images.length;
    const normalized = sortImagesForTop(images, "left-new");
    const initialGalleryHtml = buildTopInitialGalleryHtmlEn(images);
    const initialJson = escapeScriptJson(JSON.stringify(normalized));

    template = replaceToken(template, "PAGE_TITLE", escapeHtml("The Absence of Eve"));
    template = replaceToken(
        template,
        "META_DESCRIPTION",
        escapeAttribute("An AI image and poetry gallery following Eve, a humanoid android, through silence, ruins, doors, and space.")
    );
    template = replaceToken(template, "CURRENT_COUNT", escapeHtml(`${total.toLocaleString("en-US")} images`));
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

    const fullHtml = image.hasFull
        ? `<a class="button detail-full-link detail-full-link--desktop" href="./full/" aria-label="${escapeAttribute(image.title || image.id)} の高画質ページを開く">高画質表示</a>`
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
    template = replaceToken(template, "FULL_LINK", fullHtml);
    template = replaceToken(template, "ORIGINAL_URL", escapeAttribute(urls.original));
    template = replaceToken(template, "THUMB_URL", escapeAttribute(urls.thumb));
    template = replaceToken(template, "LANG_SWITCH_HTML", buildJaLangSwitchHtml(image));

    return template;
}

function buildCutEnHtml({ image, previousImage, nextImage, position, total }) {
    let template = readText(CUT_EN_TEMPLATE_FILE);
    const urls = getImageUrls(image.id);
    const tagsHtml = getVisibleTags(image.tags || [])
        .map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`)
        .join("");

    const prevHtml = previousImage
        ? `<a class="button" href="../${encodeURIComponent(previousImage.id)}/">← Prev</a>`
        : `<span class="button is-disabled" aria-disabled="true">← Prev</span>`;

    const nextHtml = nextImage
        ? `<a class="button" href="../${encodeURIComponent(nextImage.id)}/">Next →</a>`
        : `<span class="button is-disabled" aria-disabled="true">Next →</span>`;

    const fullHtml = image.hasFull
        ? `<a class="button detail-full-link detail-full-link--desktop" href="../../../cuts/${encodeURIComponent(image.id)}/full/" aria-label="Open the full image view for ${escapeAttribute(image.title || image.id)}">Full image</a>`
        : "";

    template = replaceToken(template, "PAGE_TITLE", escapeHtml(`${image.title || image.id} | The Absence of Eve`));
    template = replaceToken(template, "META_DESCRIPTION", escapeAttribute(image.seoDescription));
    template = replaceToken(template, "CANONICAL_PATH", escapeAttribute(`/en/cuts/${image.id}/`));
    template = replaceToken(template, "STRUCTURED_DATA", buildCutStructuredDataEn(image));
    template = replaceToken(template, "IMAGE_ALT", escapeAttribute(getImageAlt(image)));
    template = replaceToken(template, "IMAGE_MEDIUM_URL", escapeAttribute(urls.medium));
    template = replaceToken(template, "TITLE", escapeHtml(image.title || image.id));
    template = replaceToken(template, "DESCRIPTION_HTML", nl2br(image.description || ""));
    template = replaceToken(template, "DISPLAY_DATE", escapeHtml(image.displayDate || ""));
    template = replaceToken(template, "POSITION", escapeHtml(`${position} / ${total}`));
    template = replaceToken(template, "TAGS", tagsHtml);
    template = replaceToken(template, "PREV_LINK", prevHtml);
    template = replaceToken(template, "NEXT_LINK", nextHtml);
    template = replaceToken(template, "FULL_LINK", fullHtml);
    template = replaceToken(template, "LANG_SWITCH_HTML", buildEnLangSwitchHtml(image));

    return template;
}

function buildFullHtml({ image }) {
    let template = readText(FULL_TEMPLATE_FILE);
    const urls = getImageUrls(image.id);

    template = replaceToken(template, "PAGE_TITLE", escapeHtml(`${image.title || image.id} | Full image | The Absence of Eve`));
    template = replaceToken(
        template,
        "META_DESCRIPTION",
        escapeAttribute(`${image.title || image.id} full image viewer.`)
    );
    template = replaceToken(template, "IMAGE_ALT", escapeAttribute(getImageAlt(image)));
    template = replaceToken(template, "FULL_IMAGE_URL", escapeAttribute(urls.download));
    template = replaceToken(template, "DOWNLOAD_IMAGE_URL", escapeAttribute(urls.download));
    template = replaceToken(template, "DOWNLOAD2_IMAGE_URL", escapeAttribute(urls.download2));
    template = replaceToken(template, "DOWNLOAD_IMAGE_FILENAME", escapeAttribute(`${image.id}.webp`));
    template = replaceToken(template, "DOWNLOAD2_IMAGE_FILENAME", escapeAttribute(`${image.id}-2.webp`));

    return template;
}

function buildSitemapXml(images, englishImages) {
    const latestImageDate = images.reduce((latest, image) => {
        if (!image.date) {
            return latest;
        }

        return !latest || image.date > latest ? image.date : latest;
    }, "");

    const latestEnglishImageDate = englishImages.reduce((latest, image) => {
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
        {
            loc: `${SITE_ORIGIN}/en/`,
            lastmod: latestEnglishImageDate || latestImageDate
        },
        ...images.map((image) => ({
            loc: `${SITE_ORIGIN}/cuts/${encodeURIComponent(image.id)}/`,
            lastmod: image.date || ""
        })),
        ...englishImages.map((image) => ({
            loc: `${SITE_ORIGIN}/en/cuts/${encodeURIComponent(image.id)}/`,
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

async function main() {
    if (!fs.existsSync(DATA_FILE)) {
        throw new Error(`images.json が見つかりません: ${DATA_FILE}`);
    }

    if (!fs.existsSync(INDEX_TEMPLATE_FILE)) {
        throw new Error(`日本語トップテンプレートが見つかりません: ${INDEX_TEMPLATE_FILE}`);
    }

    if (!fs.existsSync(CUT_TEMPLATE_FILE)) {
        throw new Error(`日本語cutテンプレートが見つかりません: ${CUT_TEMPLATE_FILE}`);
    }

    if (!fs.existsSync(FULL_TEMPLATE_FILE)) {
        throw new Error(`fullテンプレートが見つかりません: ${FULL_TEMPLATE_FILE}`);
    }

    if (!fs.existsSync(INDEX_EN_TEMPLATE_FILE)) {
        throw new Error(`英語トップテンプレートが見つかりません: ${INDEX_EN_TEMPLATE_FILE}`);
    }

    if (!fs.existsSync(CUT_EN_TEMPLATE_FILE)) {
        throw new Error(`英語cutテンプレートが見つかりません: ${CUT_EN_TEMPLATE_FILE}`);
    }

    const raw = readText(DATA_FILE);
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
        throw new Error("images.json の形式が正しくありません。配列が必要です。");
    }

    const normalizedImages = parsed.map(normalizeImage);
    const images = await attachRemoteAssetFlags(normalizedImages);
    const englishImages = images.filter(hasEnglishVersion).map(normalizeEnglishImage);

    const episodeImages = [...images].sort(
        (a, b) => a.timestamp - b.timestamp || String(a.id).localeCompare(String(b.id))
    );

    const episodeEnglishImages = [...englishImages].sort(
        (a, b) => a.timestamp - b.timestamp || String(a.id).localeCompare(String(b.id))
    );

    writeText(OUTPUT_INDEX_FILE, buildIndexHtml(images));
    writeText(OUTPUT_EN_INDEX_FILE, buildIndexEnHtml(englishImages));
    writeText(OUTPUT_SITEMAP_FILE, buildSitemapXml(images, englishImages));
    writeText(OUTPUT_ROBOTS_FILE, buildRobotsTxt());

    fs.rmSync(OUTPUT_CUTS_DIR, { recursive: true, force: true });
    ensureDir(OUTPUT_CUTS_DIR);

    fs.rmSync(OUTPUT_EN_CUTS_DIR, { recursive: true, force: true });
    ensureDir(OUTPUT_EN_CUTS_DIR);

    let fullPageCount = 0;

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

        if (image.hasFull) {
            const fullHtml = buildFullHtml({ image });
            writeText(path.join(dir, "full", "index.html"), fullHtml);
            fullPageCount += 1;
        }
    });

    episodeEnglishImages.forEach((image, index) => {
        const dir = path.join(OUTPUT_EN_CUTS_DIR, image.id);
        const previousImage = index > 0 ? episodeEnglishImages[index - 1] : null;
        const nextImage = index < episodeEnglishImages.length - 1 ? episodeEnglishImages[index + 1] : null;
        const html = buildCutEnHtml({
            image,
            previousImage,
            nextImage,
            position: index + 1,
            total: episodeEnglishImages.length
        });

        writeText(path.join(dir, "index.html"), html);
    });

    console.log(
        `Generated: index.html + en/index.html + ${episodeImages.length} ja cut pages + ${episodeEnglishImages.length} en cut pages + ${fullPageCount} full pages`
    );
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
