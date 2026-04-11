const IMAGE_BASE_URL = "https://img.eve.npaso.com";
const ORNAMENT_IMAGE_URL = "./images/eve-loss-ornament.webp";
const HIDDEN_TAGS = ["soft"];

const GRID_COLUMNS = 5;
const PAGE_ROWS = 12;
const DESKTOP_ITEMS_PER_PAGE = PAGE_ROWS * GRID_COLUMNS;

const MOBILE_BREAKPOINT = 640;
const MOBILE_ITEMS_PER_PAGE = 20;
const MOBILE_GROUP_SIZE = 5;

const GALLERY_STATE_KEY = "eve-gallery-state";

const state = {
    allImages: [],
    filteredImages: [],
    activeFilter: "すべて",
    searchText: "",
    sortOrder: "left-new",
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
    chips: Array.from(document.querySelectorAll(".chip"))
};

function escapeHtml(value = "") {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
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

function normalizeImage(image) {
    const dateInfo = extractDateFromId(image.id);
    return {
        ...image,
        date: image.date || dateInfo.isoDate,
        displayDate: image.displayDate || dateInfo.displayDate,
        compactDate: image.compactDate || dateInfo.compact,
        timestamp: image.timestamp || dateInfo.timestamp
    };
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

function getVisibleTags(tags = []) {
    return tags.filter((tag) => !HIDDEN_TAGS.includes(tag));
}

function getSearchTarget(image) {
    return [
        image.id,
        image.title,
        image.date,
        image.compactDate,
        image.description,
        image.seoDescription,
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
            return a.timestamp - b.timestamp || String(a.id).localeCompare(String(b.id));
        }

        return b.timestamp - a.timestamp || String(b.id).localeCompare(String(a.id));
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
            <a href="./cuts/${encodeURIComponent(image.id)}/" class="card__link" aria-label="${escapeHtml(image.title || image.id)} の詳細ページへ">
                <div class="card__thumb">
                    <img src="${urls.thumb}" alt="${escapeHtml(getImageAlt(image))}" loading="lazy" />
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

function buildFixedRowsTopDown(imagesNewestFirst) {
    const chronological = [...imagesNewestFirst].reverse();
    const rowsBottomUp = chunkArray(chronological, GRID_COLUMNS);
    return rowsBottomUp.reverse();
}

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

function updateCurrentCount() {
    const count = state.allImages.length;
    if (elements.currentCount) {
        elements.currentCount.textContent = `${count.toLocaleString("ja-JP")} images`;
    }
}

function refresh() {
    filterImages();
    clampCurrentPage();
    renderGallery();
}

function bindEvents() {
    elements.chips.forEach((chip) => {
        chip.addEventListener("click", () => {
            elements.chips.forEach((item) => item.classList.remove("is-active"));
            chip.classList.add("is-active");
            state.activeFilter = chip.dataset.filter || chip.textContent.trim();
            state.currentPage = 1;
            refresh();
            saveGalleryState();
        });
    });

    elements.search?.addEventListener("input", (event) => {
        state.searchText = event.target.value || "";
        state.currentPage = 1;
        refresh();
        saveGalleryState();
    });

    elements.sort?.addEventListener("change", (event) => {
        state.sortOrder = event.target.value;
        state.currentPage = 1;
        refresh();
        saveGalleryState();
    });

    elements.pagePrevs.forEach((button) => {
        button.addEventListener("click", () => {
            if (state.currentPage <= 1) return;
            state.currentPage -= 1;
            renderGallery();
            saveGalleryState();
            document.getElementById("gallery")?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
    });

    elements.pageNexts.forEach((button) => {
        button.addEventListener("click", () => {
            if (state.currentPage >= getPageCount()) return;
            state.currentPage += 1;
            renderGallery();
            saveGalleryState();
            document.getElementById("gallery")?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
    });

    elements.gallery?.addEventListener("click", (event) => {
        const link = event.target.closest(".card__link");
        if (!link) return;
        saveGalleryState();
    });

    window.addEventListener("resize", () => {
        const nextLayoutKey = getLayoutKey();

        if (nextLayoutKey !== state.lastLayoutKey) {
            renderGallery();
            saveGalleryState();
        }
    });
}

function loadInitialImages() {
    const element = document.getElementById("initial-images");
    if (!element) return [];

    try {
        const parsed = JSON.parse(element.textContent || "[]");
        return Array.isArray(parsed) ? parsed.map(normalizeImage) : [];
    } catch (error) {
        console.error("initial-images parse failed:", error);
        return [];
    }
}

function init() {
    state.allImages = loadInitialImages();

    const savedState = loadGalleryState();
    applyGalleryState(savedState);

    updateCurrentCount();
    syncControlsWithState();
    bindEvents();
    refresh();
}

function getGalleryStateSnapshot() {
    return {
        activeFilter: state.activeFilter,
        searchText: state.searchText,
        sortOrder: state.sortOrder,
        currentPage: state.currentPage
    };
}

function saveGalleryState() {
    try {
        sessionStorage.setItem(GALLERY_STATE_KEY, JSON.stringify(getGalleryStateSnapshot()));
    } catch (error) {
        console.warn("gallery state save failed:", error);
    }
}

function loadGalleryState() {
    try {
        const raw = sessionStorage.getItem(GALLERY_STATE_KEY);
        if (!raw) return null;

        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object") return null;

        return {
            activeFilter: typeof parsed.activeFilter === "string" ? parsed.activeFilter : "すべて",
            searchText: typeof parsed.searchText === "string" ? parsed.searchText : "",
            sortOrder: typeof parsed.sortOrder === "string" ? parsed.sortOrder : "left-new",
            currentPage: Number.isInteger(parsed.currentPage) ? parsed.currentPage : 1
        };
    } catch (error) {
        console.warn("gallery state load failed:", error);
        return null;
    }
}

function applyGalleryState(saved) {
    if (!saved) return;

    state.activeFilter = saved.activeFilter || "すべて";
    state.searchText = saved.searchText || "";
    state.sortOrder = saved.sortOrder || "left-new";
    state.currentPage = saved.currentPage || 1;
}

function syncControlsWithState() {
    if (elements.search) {
        elements.search.value = state.searchText;
    }

    if (elements.sort) {
        elements.sort.value = state.sortOrder;
    }

    elements.chips.forEach((chip) => {
        const filterName = chip.dataset.filter || chip.textContent.trim();
        chip.classList.toggle("is-active", filterName === state.activeFilter);
    });
}

document.addEventListener("DOMContentLoaded", init);