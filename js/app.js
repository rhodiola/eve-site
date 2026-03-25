const IMAGE_BASE_URL = "https://img.eve.npaso.com";
const DATA_URL = "./data/images.json";
const HIDDEN_TAGS = ["#sexy", "#soft"];

const state = {
    allImages: [],
    filteredImages: [],
    activeFilter: "すべて",
    searchText: "",
    sortOrder: "new",
    selectedId: null
};

const elements = {
    galleryBefore: document.querySelector("[data-gallery-before]"),
    galleryAfter: document.querySelector("[data-gallery-after]"),
    galleryEmpty: document.querySelector("[data-gallery-empty]"),
    currentCount: document.querySelector("[data-current-count]"),
    search: document.querySelector("[data-search]"),
    sort: document.querySelector("[data-sort]"),
    chips: Array.from(document.querySelectorAll(".chip")),
    viewerImage: document.querySelector("[data-viewer-image]"),
    viewerTitle: document.querySelector("[data-viewer-title]"),
    viewerDescription: document.querySelector("[data-viewer-description]"),
    viewerTags: document.querySelector("[data-viewer-tags]"),
    viewerOriginal: document.querySelector("[data-viewer-original]")
};

function escapeHtml(value = "") {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
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
                    <img src="${urls.thumb}" alt="${escapeHtml(image.title || image.id)}" loading="lazy" />
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

function renderGallery() {
    const items = state.filteredImages;
    const beforeAd = items.slice(0, 2);
    const afterAd = items.slice(2);

    elements.galleryBefore.innerHTML = beforeAd.map(createCardHtml).join("");
    elements.galleryAfter.innerHTML = afterAd.map(createCardHtml).join("");
    elements.galleryEmpty.hidden = items.length > 0;
}

function renderViewer(image) {
    if (!image) return;

    const urls = getImageUrls(image.id);

    elements.viewerImage.src = urls.medium;
    elements.viewerImage.alt = image.title || image.id;
    elements.viewerTitle.textContent = image.title || image.id;
    elements.viewerDescription.textContent = image.description || "";
    elements.viewerOriginal.href = urls.original;

    elements.viewerTags.innerHTML = getVisibleTags(image.tags || [])
        .map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`)
        .join("");
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
    renderGallery();
    ensureSelectedImage();
}

function bindEvents() {
    elements.chips.forEach((chip) => {
        chip.addEventListener("click", () => {
            elements.chips.forEach((item) => item.classList.remove("is-active"));
            chip.classList.add("is-active");
            state.activeFilter = chip.dataset.filter || chip.textContent.trim();
            refresh();
        });
    });

    elements.search.addEventListener("input", (event) => {
        state.searchText = event.target.value || "";
        refresh();
    });

    elements.sort.addEventListener("change", (event) => {
        state.sortOrder = event.target.value;
        refresh();
    });

    document.addEventListener("click", (event) => {
        const trigger = event.target.closest("[data-image-id]");
        if (!trigger) return;

        const id = trigger.dataset.imageId;
        const image = state.filteredImages.find((item) => item.id === id) || state.allImages.find((item) => item.id === id);
        if (!image) return;

        state.selectedId = image.id;
        renderViewer(image);
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
        elements.galleryBefore.innerHTML = "";
        elements.galleryAfter.innerHTML = "";
        elements.galleryEmpty.hidden = false;
        elements.galleryEmpty.textContent = "画像データの読み込みに失敗しました。";
        elements.viewerTitle.textContent = "読み込みエラー";
        elements.viewerDescription.textContent = "images.json または画像URLを確認してください。";
    }
}

document.addEventListener("DOMContentLoaded", init);