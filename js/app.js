const IMAGE_BASE_URL = "https://img.eve.npaso.com";
const DATA_URL = "./data/images.json";
const ORNAMENT_IMAGE_URL = "./images/eve-loss-ornament.webp";
const HIDDEN_TAGS = ["soft"];

const GRID_COLUMNS = 5;
const PAGE_ROWS = 12;
const DESKTOP_ITEMS_PER_PAGE = PAGE_ROWS * GRID_COLUMNS;

const MOBILE_BREAKPOINT = 640;
const MOBILE_ITEMS_PER_PAGE = 20;
const MOBILE_GROUP_SIZE = 5;

const state = {
    allImages: [],
    filteredImages: [],
    activeFilter: "すべて",
    searchText: "",
    sortOrder: "left-new",
    selectedId: null,
    currentPage: 1,
    lastLayoutKey: null
};

const elements = {
    gallery: document.querySelector("[data-gallery]"),
    galleryEmpty: document.querySelector("[data-gallery-empty]"),
    paginations: Array.from(document.querySelectorAll("[data-pagination-top], [data-pagination-bottom]")),
    pageInfos: Array.from(document.querySelectorAll("[data-page-info]")),
    pagePrevs: Array.from(document.querySelectorAll("[data-page-prev]")),
    pageNexts: Array.from(document.querySelectorAll("[data-page-next]")),
    currentCount: document.querySelector("[data-current-count]"),
    search: document.querySelector("[data-search]"),
    sort: document.querySelector("[data-sort]"),
    chips: Array.from(document.querySelectorAll(".chip")),
    viewerImage: document.querySelector("[data-viewer-image]"),
    viewerTitle: document.querySelector("[data-viewer-title]"),
    viewerDescription: document.querySelector("[data-viewer-description]"),
    viewerTags: document.querySelector("[data-viewer-tags]"),
    viewerPrev: document.querySelector("[data-viewer-prev]"),
    viewerNext: document.querySelector("[data-viewer-next]"),
    viewerPosition: document.querySelector("[data-viewer-position]")
};

function escapeHtml(value = "") {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function getImageAlt(image) {
    return (image.alt || image.title || image.id || "").trim();
}

function getImageUrls(id) {
    return {
        thumb: `${IMAGE_BASE_URL}/thumb/${id}.webp`,
        medium: `${IMAGE_BASE_URL}/medium/${id}.webp`,
        original: `${IMAGE_BASE_URL}/original/${id}.webp`
    };
}

function formatDate(dateString) {
    if (!dateString) return "";
    return dateString.replace(/-/g, ".");
}

function getVisibleTags(tags = []) {
    return tags.filter((tag) => !HIDDEN_TAGS.includes(tag));
}

function getSearchTarget(image) {
    return [
        image.id,
        image.title,
        image.date,
        image.description,
        ...(image.tags || [])
    ]
        .join(" ")
        .toLowerCase();
}

function isMobileLayout() {
    return window.innerWidth <= MOBILE_BREAKPOINT;
}

function getLayoutKey() {
    return isMobileLayout() ? "mobile" : "desktop";
}

function getItemsPerPage() {
    return isMobileLayout() ? MOBILE_ITEMS_PER_PAGE : DESKTOP_ITEMS_PER_PAGE;
}

function chunkArray(items, size) {
    const chunks = [];

    for (let i = 0; i < items.length; i += size) {
        chunks.push(items.slice(i, i + size));
    }

    return chunks;
}

function sortImages(images) {
    const items = [...images];

    items.sort((a, b) => {
        const aFeatured = a.featured ? 1 : 0;
        const bFeatured = b.featured ? 1 : 0;

        if (aFeatured !== bFeatured) {
            return bFeatured - aFeatured;
        }

        if (state.sortOrder === "old") {
            return String(a.date).localeCompare(String(b.date)) || String(a.id).localeCompare(String(b.id));
        }

        if (state.sortOrder === "popular") {
            return (b.popularity || 0) - (a.popularity || 0) || String(b.date).localeCompare(String(a.date));
        }

        return String(b.date).localeCompare(String(a.date)) || String(b.id).localeCompare(String(a.id));
    });

    return items;
}

function filterImages() {
    const search = state.searchText.trim().toLowerCase();

    let items = state.allImages.filter((image) => {
        const matchesFilter =
            state.activeFilter === "すべて" ||
            (image.tags || []).includes(state.activeFilter);

        const matchesSearch =
            !search || getSearchTarget(image).includes(search);

        return matchesFilter && matchesSearch;
    });

    items = sortImages(items);
    state.filteredImages = items;
}

function createCardHtml(image) {
    const urls = getImageUrls(image.id);
    const tagsHtml = getVisibleTags(image.tags || [])
        .map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`)
        .join("");

    return `
        <article class="card">
            <a href="#viewer" class="card__link" aria-label="詳細を見る" data-image-id="${escapeHtml(image.id)}">
                <div class="card__thumb">
                    <img src="${urls.thumb}" alt="${escapeHtml(getImageAlt(image))}" loading="lazy" />
                </div>
                <div class="card__body">
                    <h3 class="card__title">${escapeHtml(image.title || image.id)}</h3>
                    <div class="card__date">${escapeHtml(formatDate(image.date))}</div>
                    <div class="tags">${tagsHtml}</div>
                </div>
            </a>
        </article>
    `;
}

function createSpacerHtml() {
    return `
        <article class="card ornament-card" aria-hidden="true">
            <div class="card__media ornament-slot">
                <img src="${ORNAMENT_IMAGE_URL}" alt="" class="ornament-slot__image" />
            </div>
            <div class="ornament-card__body"></div>
        </article>
    `;
}

function getPageCount() {
    if (isMobileLayout() && state.sortOrder === "left-new") {
        const mobileGroups = chunkArray(state.filteredImages, MOBILE_GROUP_SIZE);
        const groupsPerPage = MOBILE_ITEMS_PER_PAGE / MOBILE_GROUP_SIZE;
        return Math.max(1, Math.ceil(mobileGroups.length / groupsPerPage));
    }

    return Math.max(1, Math.ceil(state.filteredImages.length / getItemsPerPage()));
}

function clampCurrentPage() {
    state.currentPage = Math.min(Math.max(1, state.currentPage), getPageCount());
}

function getCurrentPageImages() {
    const itemsPerPage = getItemsPerPage();
    const start = (state.currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return state.filteredImages.slice(start, end);
}

function getCurrentPageMobileGroups() {
    const chronological = [...state.filteredImages].reverse();
    const allGroupsOldestFirst = chunkArray(chronological, MOBILE_GROUP_SIZE);
    const allGroupsTopDown = allGroupsOldestFirst.reverse();

    const groupsPerPage = MOBILE_ITEMS_PER_PAGE / MOBILE_GROUP_SIZE;
    const start = (state.currentPage - 1) * groupsPerPage;
    const end = start + groupsPerPage;

    return allGroupsTopDown.slice(start, end);
}

/**
 * left-new 用の共通 5枚行を作る
 * 入力: newest -> oldest
 * 出力: top -> bottom の 5枚行
 *
 * 例:
 * 8枚 -> [[6,7,8], [1,2,3,4,5]]
 * 10枚 -> [[6,7,8,9,10], [1,2,3,4,5]]
 */
function buildFixedRowsTopDown(imagesNewestFirst) {
    const chronological = [...imagesNewestFirst].reverse();
    const rowsBottomUp = chunkArray(chronological, GRID_COLUMNS);
    return rowsBottomUp.reverse();
}

/**
 * PCの left-new:
 * - 上の行ほど新しい
 * - 同じ行の中では右ほど新しい
 * - 空白は最上段の右側
 */
function buildDesktopFixedGalleryHtml(imagesNewestFirst) {
    const rowsTopDown = buildFixedRowsTopDown(imagesNewestFirst);

    return rowsTopDown
        .map((row) => {
            const slots = [...row];

            while (slots.length < GRID_COLUMNS) {
                slots.push(null);
            }

            return slots
                .map((item) => (item ? createCardHtml(item) : createSpacerHtml()))
                .join("");
        })
        .join("");
}

/**
 * スマホの left-new:
 * - 5枚を1ブロックとして扱う
 * - 2列 row-major
 *
 * 1枚: 1 _
 * 2枚: 1 2
 * 3枚: 1 2 / 3 _
 * 4枚: 1 2 / 3 4
 * 5枚: 1 2 / 3 4 / 5 _
 */
function buildMobileFixedGroupHtml(rowImages, groupIndex) {
    const slots = rowImages.map(createCardHtml);

    if (slots.length % 2 !== 0) {
        slots.push(createSpacerHtml());
    }

    const sectionStyle = groupIndex === 0
        ? "margin-top:0;padding-top:0;border-top:none;"
        : "margin-top:28px;padding-top:22px;border-top:2px solid rgba(180,195,215,0.7);";

    return `
        <section class="gallery-group" style="${sectionStyle}">
            <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;">
                ${slots.join("")}
            </div>
        </section>
    `;
}

function buildMobileFixedGalleryHtml(groups) {
    return groups
        .map((group, index) => buildMobileFixedGroupHtml(group, index))
        .join("");
}

function buildDefaultGalleryHtml(images) {
    return images.map(createCardHtml).join("");
}

function buildOldGalleryHtml(images) {
    const slots = [...images];

    while (slots.length % GRID_COLUMNS !== 0) {
        slots.push(null);
    }

    return slots
        .map((item) => (item ? createCardHtml(item) : createSpacerHtml()))
        .join("");
}

function buildGalleryPageHtml(images) {
    if (state.sortOrder === "left-new") {
        if (isMobileLayout()) {
            return buildMobileFixedGalleryHtml(chunkArray(images, MOBILE_GROUP_SIZE));
        }
        return buildDesktopFixedGalleryHtml(images);
    }

    if (state.sortOrder === "old") {
        return buildOldGalleryHtml(images);
    }

    return buildDefaultGalleryHtml(images);
}

function applyGalleryContainerMode() {
    const isMobileLeftNew = isMobileLayout() && state.sortOrder === "left-new";

    if (isMobileLeftNew) {
        elements.gallery.style.display = "block";
        elements.gallery.style.gridTemplateColumns = "none";
        elements.gallery.style.gap = "0";
    } else {
        elements.gallery.style.display = "";
        elements.gallery.style.gridTemplateColumns = "";
        elements.gallery.style.gap = "";
    }
}

function renderPagination() {
    const pageCount = getPageCount();
    const hasItems = state.filteredImages.length > 0;
    const hidden = !hasItems || pageCount <= 1;

    elements.paginations.forEach((nav) => {
        nav.hidden = hidden;
    });

    elements.pageInfos.forEach((info) => {
        info.textContent = `${state.currentPage} / ${pageCount}`;
    });

    elements.pagePrevs.forEach((button) => {
        button.disabled = state.currentPage <= 1;
    });

    elements.pageNexts.forEach((button) => {
        button.disabled = state.currentPage >= pageCount;
    });
}

function renderGallery() {
    clampCurrentPage();

    const isMobileFixed = isMobileLayout() && state.sortOrder === "left-new";
    const items = isMobileFixed ? [] : getCurrentPageImages();
    const mobileGroups = isMobileFixed ? getCurrentPageMobileGroups() : [];

    applyGalleryContainerMode();

    if (isMobileFixed) {
        elements.gallery.innerHTML = buildMobileFixedGalleryHtml(mobileGroups);
    } else {
        elements.gallery.innerHTML = buildGalleryPageHtml(items);
    }

    elements.galleryEmpty.hidden = state.filteredImages.length > 0;
    state.lastLayoutKey = getLayoutKey();

    renderPagination();
}

function renderViewer(image) {
    if (!image) return;

    const urls = getImageUrls(image.id);

    elements.viewerImage.src = urls.medium;
    elements.viewerImage.alt = getImageAlt(image);
    elements.viewerTitle.textContent = image.title || image.id;
    elements.viewerDescription.innerHTML = escapeHtml(image.description || "").replace(/\n/g, "<br>");

    elements.viewerTags.innerHTML = getVisibleTags(image.tags || [])
        .map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`)
        .join("");
    updateViewerCutNav();
}

function getViewerSequence() {
    const source = state.filteredImages.length > 0 ? state.filteredImages : state.allImages;
    return [...source].reverse();
}

function getSelectedImageIndex() {
    const sequence = getViewerSequence();
    return sequence.findIndex((image) => image.id === state.selectedId);
}

function updateViewerCutNav() {
    const sequence = getViewerSequence();
    const currentIndex = getSelectedImageIndex();
    const hasItems = sequence.length > 0;
    const safeIndex = currentIndex >= 0 ? currentIndex : 0;

    if (elements.viewerPosition) {
        elements.viewerPosition.textContent = hasItems
            ? `${safeIndex + 1} / ${sequence.length}`
            : "0 / 0";
    }

    if (elements.viewerPrev) {
        elements.viewerPrev.disabled = !hasItems || safeIndex <= 0;
    }

    if (elements.viewerNext) {
        elements.viewerNext.disabled = !hasItems || safeIndex >= sequence.length - 1;
    }
}

function moveViewerCut(direction) {
    const sequence = getViewerSequence();
    const currentIndex = getSelectedImageIndex();

    if (currentIndex < 0) return;

    const nextIndex = currentIndex + direction;
    if (nextIndex < 0 || nextIndex >= sequence.length) return;

    const nextImage = sequence[nextIndex];
    state.selectedId = nextImage.id;
    renderViewer(nextImage);
}

function updateCurrentCount() {
    const count = state.allImages.length;
    elements.currentCount.textContent = `${count.toLocaleString("ja-JP")} images`;
}

function ensureSelectedImage() {
    const exists = state.filteredImages.some((image) => image.id === state.selectedId);

    if (exists) {
        const selected = state.filteredImages.find((image) => image.id === state.selectedId);
        renderViewer(selected);
        return;
    }

    if (state.filteredImages.length > 0) {
        state.selectedId = state.filteredImages[0].id;
        renderViewer(state.filteredImages[0]);
    }
}

function refresh() {
    filterImages();
    clampCurrentPage();
    renderGallery();
    ensureSelectedImage();
}

function bindEvents() {
    elements.chips.forEach((chip) => {
        chip.addEventListener("click", () => {
            elements.chips.forEach((item) => item.classList.remove("is-active"));
            chip.classList.add("is-active");
            state.activeFilter = chip.dataset.filter || chip.textContent.trim();
            state.currentPage = 1;
            refresh();
        });
    });

    elements.search.addEventListener("input", (event) => {
        state.searchText = event.target.value || "";
        state.currentPage = 1;
        refresh();
    });

    elements.sort.addEventListener("change", (event) => {
        state.sortOrder = event.target.value;
        state.currentPage = 1;
        refresh();
    });

    document.addEventListener("click", (event) => {
        const trigger = event.target.closest("[data-image-id]");
        if (!trigger) return;

        const id = trigger.dataset.imageId;
        const image =
            state.filteredImages.find((item) => item.id === id) ||
            state.allImages.find((item) => item.id === id);

        if (!image) return;

        state.selectedId = image.id;
        renderViewer(image);
    });

    elements.pagePrevs.forEach((button) => {
        button.addEventListener("click", () => {
            if (state.currentPage <= 1) return;
            state.currentPage -= 1;
            renderGallery();
            window.scrollTo({ top: 0, behavior: "smooth" });
        });
    });

    elements.pageNexts.forEach((button) => {
        button.addEventListener("click", () => {
            if (state.currentPage >= getPageCount()) return;
            state.currentPage += 1;
            renderGallery();
            window.scrollTo({ top: 0, behavior: "smooth" });
        });
    });

    window.addEventListener("resize", () => {
        const nextLayoutKey = getLayoutKey();

        if (nextLayoutKey !== state.lastLayoutKey) {
            renderGallery();
        }
    });

    elements.viewerPrev?.addEventListener("click", () => {
        moveViewerCut(-1);
    });

    elements.viewerNext?.addEventListener("click", () => {
        moveViewerCut(1);
    });
}

async function loadImages() {
    const response = await fetch(DATA_URL, { cache: "no-store" });
    if (!response.ok) {
        throw new Error("images.json の読み込みに失敗しました。");
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
        throw new Error("images.json の形式が正しくありません。");
    }

    return data;
}

async function init() {
    try {
        state.allImages = await loadImages();
        updateCurrentCount();
        bindEvents();
        refresh();
    } catch (error) {
        console.error(error);
        elements.gallery.innerHTML = "";
        elements.paginations.forEach((nav) => {
            nav.hidden = true;
        });
        elements.galleryEmpty.hidden = false;
        elements.galleryEmpty.textContent = "画像データの読み込みに失敗しました。";
        elements.viewerTitle.textContent = "読み込みエラー";
        elements.viewerDescription.textContent = "images.json または画像URLを確認してください。";
    }
}

document.addEventListener("DOMContentLoaded", init);