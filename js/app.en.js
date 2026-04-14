const IMAGE_BASE_URL = "https://img.eve.npaso.com";
const ORNAMENT_IMAGE_URL = "../images/eve-loss-ornament.webp";
const HIDDEN_TAGS = ["soft"];

const GRID_COLUMNS = 5;
const PAGE_ROWS = 12;
const DESKTOP_ITEMS_PER_PAGE = PAGE_ROWS * GRID_COLUMNS;

const MOBILE_BREAKPOINT = 640;
const MOBILE_ITEMS_PER_PAGE = 20;
const MOBILE_GROUP_SIZE = 5;

const GALLERY_STATE_KEY = "eve-gallery-state-en";

const state = {
    allImages: [],
    filteredImages: [],
    activeFilter: "All",
    searchText: "",
    sortOrder: "left-new",
    currentPage: 1,
    lastLayoutKey: null,
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
            timestamp: 0,
        };
    }

    const [, y, m, d, hh, mm, ss] = match;
    return {
        isoDate: `${y}-${m}-${d}`,
        displayDate: `${y}.${m}.${d}`,
        compact: `${y}${m}${d}`,
        timestamp: Number(`${y}${m}${d}${hh}${mm}${ss}`),
    };
}

function normalizeImage(image) {
    const baseTitle = image.en?.title || image.title || image.id;
    const baseDescription = image.en?.description || image.description || "";
    const baseSeoDescription = image.en?.seoDescription || image.seoDescription || "";
    const baseAlt = image.en?.alt || image.alt || baseTitle;
    const baseTags = Array.isArray(image.en?.tags) && image.en.tags.length ? image.en.tags : image.tags || [];

    const dateInfo = extractDateFromId(image.id);
    return {
        ...image,
        title: baseTitle,
        description: baseDescription,
        seoDescription: baseSeoDescription,
        alt: baseAlt,
        tags: baseTags,
        date: image.date || dateInfo.isoDate,
        displayDate: image.displayDate || dateInfo.displayDate,
        compactDate: image.compactDate || dateInfo.compact,
        timestamp: image.timestamp || dateInfo.timestamp,
    };
}

function getImageAlt(image) {
    return (image.alt || image.title || image.id || "").trim();
}

function getImageUrls(id) {
    return {
        thumb: `${IMAGE_BASE_URL}/thumb/${id}.webp`,
        medium: `${IMAGE_BASE_URL}/medium/${id}.webp`,
        original: `${IMAGE_BASE_URL}/original/${id}.webp`,
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
        ...(image.tags || []),
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
            state.activeFilter === "All" ||
            (image.tags || []).includes(state.activeFilter);

        const matchesSearch = !search || getSearchTarget(image).includes(search);
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
      <a href="../en/cuts/${encodeURIComponent(image.id)}/" class="card__link" aria-label="Open ${escapeHtml(image.title || image.id)}">
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
            return buildDefaultGalleryHtml(images);
        }
        return buildDesktopFixedGalleryHtml(images);
    }
    if (state.sortOrder === "old") {
        return buildOldGalleryHtml(images);
    }
    return buildDefaultGalleryHtml(images);
}

function syncMobileSortOptions() {
    if (!elements.sort) return;

    const fixedOption = elements.sort.querySelector('option[value="left-new"]');
    const isMobile = isMobileLayout();

    if (fixedOption) {
        fixedOption.hidden = isMobile;
    }

    if (isMobile && state.sortOrder === "left-new") {
        state.sortOrder = "new";
        state.currentPage = 1;
        elements.sort.value = "new";
    }
}
function updateGallery() {
    filterImages();
    clampCurrentPage();

    const currentImages = getCurrentPageImages();
    const pageCount = getPageCount();
    const galleryHtml = buildGalleryPageHtml(currentImages);

    elements.gallery.innerHTML = galleryHtml;
    elements.galleryEmpty.hidden = state.filteredImages.length > 0;

    elements.paginations.forEach((pagination) => {
        pagination.hidden = pageCount <= 1;
    });

    elements.pageInfos.forEach((el) => {
        el.textContent = `${state.currentPage} / ${pageCount}`;
    });

    elements.pagePrevs.forEach((button) => {
        button.disabled = state.currentPage <= 1;
    });

    elements.pageNexts.forEach((button) => {
        button.disabled = state.currentPage >= pageCount;
    });

    if (elements.currentCount) {
        elements.currentCount.textContent = `${state.filteredImages.length.toLocaleString("en-US")} images`;
    }

    elements.chips.forEach((chip) => {
        chip.classList.toggle("is-active", chip.dataset.filter === state.activeFilter);
    });

    try {
        localStorage.setItem(
            GALLERY_STATE_KEY,
            JSON.stringify({
                activeFilter: state.activeFilter,
                searchText: state.searchText,
                sortOrder: state.sortOrder,
                currentPage: state.currentPage,
            })
        );
    } catch {
        // noop
    }
}

function restoreState() {
    try {
        const raw = localStorage.getItem(GALLERY_STATE_KEY);
        if (!raw) return;
        const saved = JSON.parse(raw);
        if (typeof saved.activeFilter === "string") state.activeFilter = saved.activeFilter;
        if (typeof saved.searchText === "string") state.searchText = saved.searchText;
        if (typeof saved.sortOrder === "string") state.sortOrder = saved.sortOrder;
        if (typeof saved.currentPage === "number") state.currentPage = saved.currentPage;
    } catch {
        // noop
    }
}

function attachEvents() {
    elements.search?.addEventListener("input", (event) => {
        state.searchText = event.target.value || "";
        state.currentPage = 1;
        updateGallery();
    });

    elements.sort?.addEventListener("change", (event) => {
        state.sortOrder = event.target.value;
        state.currentPage = 1;
        updateGallery();
    });

    elements.chips.forEach((chip) => {
        chip.addEventListener("click", () => {
            state.activeFilter = chip.dataset.filter || "All";
            state.currentPage = 1;
            updateGallery();
        });
    });

    elements.pagePrevs.forEach((button) => {
        button.addEventListener("click", () => {
            state.currentPage = Math.max(1, state.currentPage - 1);
            updateGallery();
            window.scrollTo({ top: 0, behavior: "smooth" });
        });
    });

    elements.pageNexts.forEach((button) => {
        button.addEventListener("click", () => {
            state.currentPage = Math.min(getPageCount(), state.currentPage + 1);
            updateGallery();
            window.scrollTo({ top: 0, behavior: "smooth" });
        });
    });

    window.addEventListener("resize", () => {
        const layoutKey = getLayoutKey();
        if (state.lastLayoutKey === layoutKey) return;
        state.lastLayoutKey = layoutKey;
        syncMobileSortOptions();
        state.currentPage = 1;
        updateGallery();
    });
}

async function boot() {
    const response = await fetch("../data/images.json");
    const rawImages = await response.json();

    state.allImages = rawImages
        .filter((image) => image && image.id && image.en)
        .map(normalizeImage);

    restoreState();

    if (elements.search) elements.search.value = state.searchText;
    if (elements.sort) elements.sort.value = state.sortOrder;

    syncMobileSortOptions();

    state.lastLayoutKey = getLayoutKey();
    attachEvents();
    updateGallery();
}

boot().catch((error) => {
    console.error(error);
    if (elements.galleryEmpty) {
        elements.galleryEmpty.hidden = false;
        elements.galleryEmpty.textContent = "Failed to load the gallery.";
    }
});