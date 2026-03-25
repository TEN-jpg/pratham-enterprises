(function () {
    const CONTACT_PHONE = "+917208153358";
    const VIEWER_PHONE_KEY = "pe_viewer_phone";
    let properties = [];
    let categories = [];

    const pageState = {
        category: "all",
        query: "",
        sort: "featured"
    };

    let phoneGateModal = null;
    let phoneGateSubmitHandler = null;
    const PROPERTY_LIST_STATE_KEY = "pe_property_list_state";

    // Normalizes raw property records so rendering always has fallback media, details, and URLs.
    function normalizeProperties(rawProperties) {
        return rawProperties.map((item, index) => ({
            ...item,
            index,
            detailUrl: `property-details.html?property=${index}`,
            media: Array.isArray(item.media) && item.media.length
                ? item.media
                : [{ type: "image", src: item.image, alt: item.title }],
            details: {
                area: item.details?.area || "Custom area available on request",
                status: item.details?.status || "Ready to move",
                furnishing: item.details?.furnishing || "Details on request",
                facing: item.details?.facing || "Best suited frontage",
                overview: item.details?.overview || item.description,
                highlights: Array.isArray(item.details?.highlights) && item.details.highlights.length
                    ? item.details.highlights
                    : ["Prime location", "Verified listing", "Enquiry support available"]
            }
        }));
    }

    // Fetches the property catalog and category list from properties.json.
    async function loadPropertyData() {
        const response = await fetch("properties.json", {
            headers: {
                Accept: "application/json"
            }
        });

        if (!response.ok) {
            throw new Error("Failed to load property data.");
        }

        const data = await response.json();
        properties = normalizeProperties(Array.isArray(data.properties) ? data.properties : []);
        categories = Array.isArray(data.categories) ? data.categories : [];
    }

    // Checks whether a property matches the current free-text search query.
    function matchesSearch(item) {
        const query = pageState.query.trim().toLowerCase();
        if (!query) {
            return true;
        }

        const haystack = [
            item.title,
            item.location,
            item.description,
            item.categoryLabel,
            item.listingLabel,
            item.details.overview
        ].join(" ").toLowerCase();

        return haystack.includes(query);
    }

    // Reads the visitor phone number saved after the one-time access gate.
    function getStoredViewerPhone() {
        return window.localStorage.getItem(VIEWER_PHONE_KEY) || "";
    }

    // Tells us if the current layout is the mobile version where horizontal card scrolling is used.
    function isMobilePropertyListView() {
        return window.matchMedia("(max-width: 768px)").matches;
    }

    // Normalizes a property detail URL so saved state matches the card data-detail-url value.
    function normalizeDetailUrl(url) {
        if (!url) {
            return "";
        }

        try {
            const resolvedUrl = new URL(url, window.location.href);
            return `${resolvedUrl.pathname.split("/").pop() || ""}${resolvedUrl.search}`;
        } catch (error) {
            return String(url);
        }
    }

    // Saves the current mobile property list state so returning visitors land back near the last opened card.
    function savePropertyListState(lastDetailUrl = "") {
        if (!isMobilePropertyListView()) {
            return;
        }

        const state = {
            category: pageState.category,
            query: pageState.query,
            sort: pageState.sort,
            lastDetailUrl: normalizeDetailUrl(lastDetailUrl)
        };

        window.sessionStorage.setItem(PROPERTY_LIST_STATE_KEY, JSON.stringify(state));
    }

    // Restores the saved property page filters and target card after returning from details on mobile.
    function restorePropertyListState() {
        if (!isMobilePropertyListView()) {
            window.sessionStorage.removeItem(PROPERTY_LIST_STATE_KEY);
            return null;
        }

        const saved = window.sessionStorage.getItem(PROPERTY_LIST_STATE_KEY);
        if (!saved) {
            return null;
        }

        try {
            const state = JSON.parse(saved);
            pageState.category = typeof state.category === "string" ? state.category : pageState.category;
            pageState.query = typeof state.query === "string" ? state.query : pageState.query;
            pageState.sort = typeof state.sort === "string" ? state.sort : pageState.sort;

            const searchInput = document.getElementById("property-search");
            const sortSelect = document.getElementById("property-sort");
            if (searchInput) {
                searchInput.value = pageState.query;
            }
            if (sortSelect) {
                sortSelect.value = pageState.sort;
            }

            return {
                lastDetailUrl: typeof state.lastDetailUrl === "string" ? state.lastDetailUrl : ""
            };
        } catch (error) {
            window.sessionStorage.removeItem(PROPERTY_LIST_STATE_KEY);
            return null;
        }
    }

    // Scrolls the mobile property list back to the last opened card after the grid has been rendered.
    function focusRestoredPropertyCard(restoredState) {
        if (!restoredState?.lastDetailUrl || !isMobilePropertyListView()) {
            return;
        }

        requestAnimationFrame(() => {
            document.getElementById("all-properties")?.scrollIntoView({ block: "start" });
            const targetCard = document.querySelector(`.card-clickable[data-detail-url="${restoredState.lastDetailUrl}"]`);
            if (targetCard) {
                targetCard.scrollIntoView({
                    behavior: "auto",
                    block: "nearest",
                    inline: "center"
                });
            }
        });
    }

    // Re-applies the last-opened card position when the properties page is restored from browser history.
    function initPropertyListRestoreOnPageShow() {
        window.addEventListener("pageshow", () => {
            if (!document.getElementById("all-properties")) {
                return;
            }

            const restoredPropertyListState = restorePropertyListState();
            renderCategoryButtons();
            renderPropertyGrid("all-properties");
            focusRestoredPropertyCard(restoredPropertyListState);
        });
    }

    // Tells us whether the saved viewer phone number is valid enough to skip the gate.
    function hasViewerPhone() {
        return /^[0-9]{10}$/.test(getStoredViewerPhone());
    }

    // Stores the viewer phone number so they can open other properties without re-entering it.
    function saveViewerPhone(phone) {
        window.localStorage.setItem(VIEWER_PHONE_KEY, phone);
    }

    // Sends a one-time property-view notification for the current browser session.
    function notifyPropertyView(property) {
        const viewerPhone = getStoredViewerPhone();
        if (!property || !/^[0-9]{10}$/.test(viewerPhone)) {
            return;
        }

        const trackingKey = `pe_view_notified_${property.id}`;
        if (window.sessionStorage.getItem(trackingKey)) {
            return;
        }

        fetch("track-property-view.php", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                propertyName: property.title,
                viewerPhone: viewerPhone
            })
        })
            .then((response) => {
                if (!response.ok) {
                    throw new Error("Tracking failed");
                }
                window.sessionStorage.setItem(trackingKey, "1");
            })
            .catch(() => {
                // Property view tracking should not block the user from seeing the page.
            });
    }

    // Returns the sort function that matches the selected property sorting option.
    function getSortFunction(sortBy) {
        switch (sortBy) {
            case "price-low":
                return (first, second) => first.priceValue - second.priceValue;
            case "price-high":
                return (first, second) => second.priceValue - first.priceValue;
            case "title":
                return (first, second) => first.title.localeCompare(second.title);
            case "location":
                return (first, second) => first.location.localeCompare(second.location);
            case "featured":
            default:
                return (first, second) => Number(second.featured) - Number(first.featured);
        }
    }

    // Builds the current property list after applying featured mode, filters, search, and sorting.
    function getProperties(options = {}) {
        const { featuredOnly = false, ignorePageFilters = false } = options;
        const source = featuredOnly ? properties.filter((item) => item.featured) : properties.slice();

        if (ignorePageFilters) {
            return source.sort(getSortFunction("featured"));
        }

        return source
            .filter((item) => pageState.category === "all" || item.category === pageState.category)
            .filter((item) => matchesSearch(item))
            .sort(getSortFunction(pageState.sort));
    }

    // Creates the HTML markup for a single property card in the listing grid.
    function createPropertyCard(property, index) {
        return `
            <article class="card card-clickable" data-detail-url="${property.detailUrl}">
                <span class="card-badge">${property.listingLabel}</span>
                <a href="${property.detailUrl}" class="card-media-link" aria-label="View details for ${property.title}">
                    <img src="${property.image}" alt="${property.title}" class="card-img">
                </a>
                <div class="card-body">
                    <div class="card-meta">
                        <span class="card-category">${property.categoryLabel}</span>
                        <span class="card-location"><i class="fas fa-map-marker-alt"></i> ${property.location}</span>
                    </div>
                    <a href="${property.detailUrl}" class="card-title-link">
                        <h3 class="card-title">${property.title}</h3>
                    </a>
                    <div class="card-price">${property.price}</div>
                    <p class="card-desc">${property.description}</p>
                    <div class="card-actions">
                        <button class="card-btn" data-enquire="${property.title}" type="button">Enquire Now</button>
                    </div>
                </div>
            </article>
        `;
    }

    // Creates the fallback empty-state UI when no properties match the current filters.
    function createEmptyState() {
        return `
            <div class="empty-state">
                <h3>No properties matched your search</h3>
                <p>Try another keyword, choose a different category, or reset the filters.</p>
            </div>
        `;
    }

    // Renders a property grid for the homepage or the full properties page.
    function renderPropertyGrid(containerId, options = {}) {
        const container = document.getElementById(containerId);
        if (!container) {
            return;
        }

        const { limit = null, featuredOnly = false } = options;
        const items = getProperties({ featuredOnly, ignorePageFilters: featuredOnly });
        const totalItems = items.length;

        const visibleItems = typeof limit === "number" ? items.slice(0, limit) : items;

        container.innerHTML = visibleItems.length
            ? visibleItems.map((property, index) => createPropertyCard(property, index)).join("")
            : createEmptyState();

        const counter = document.getElementById("property-results-count");
        if (counter && !featuredOnly) {
            counter.textContent = `${totalItems} propert${totalItems === 1 ? "y" : "ies"} found`;
        }
    }

    // Renders the category filter buttons using the category data from properties.json.
    function renderCategoryButtons() {
        const container = document.getElementById("property-category-buttons");
        if (!container || !categories.length) {
            return;
        }

        container.innerHTML = categories
            .map((category) => `
                <button
                    class="category-filter${category.id === pageState.category ? " active" : ""}"
                    type="button"
                    data-category="${category.id}"
                >
                    ${category.label}
                </button>
            `)
            .join("");
    }

    // Re-renders the filtered property list after a category change.
    function applyFilters() {
        renderCategoryButtons();
        renderPropertyGrid("all-properties");
    }

    // Handles delegated clicks for property links, enquiry buttons, and category filters.
    function attachPropertyActions() {
        document.addEventListener("click", (event) => {
            const propertyCard = event.target.closest(".card-clickable[data-detail-url]");
            const clickedInteractiveElement = event.target.closest("a, button, input, select, textarea, label");
            if (propertyCard && !clickedInteractiveElement) {
                const detailUrl = propertyCard.getAttribute("data-detail-url");
                if (!detailUrl) {
                    return;
                }

                if (!hasViewerPhone()) {
                    openPhoneGate(() => {
                        savePropertyListState(detailUrl);
                        window.location.href = detailUrl;
                    });
                    return;
                }

                savePropertyListState(detailUrl);
                window.location.href = detailUrl;
                return;
            }

            const propertyLink = event.target.closest('a[href*="property-details.html"]');
            if (propertyLink) {
                if (!hasViewerPhone()) {
                    event.preventDefault();
                    openPhoneGate(() => {
                        savePropertyListState(propertyLink.getAttribute("href") || propertyLink.href);
                        window.location.href = propertyLink.href;
                    });
                    return;
                }

                savePropertyListState(propertyLink.getAttribute("href") || propertyLink.href);
                return;
            }

            const enquireButton = event.target.closest("[data-enquire]");
            if (enquireButton) {
                const propertyName = enquireButton.getAttribute("data-enquire");
                window.location.href = `enquiry.html?property=${encodeURIComponent(propertyName)}`;
                return;
            }

            const categoryButton = event.target.closest("[data-category]");
            if (categoryButton) {
                const category = categoryButton.getAttribute("data-category");
                if (!category || category === pageState.category) {
                    return;
                }

                pageState.category = category;
                applyFilters();
                document.getElementById("all-properties")?.scrollIntoView({ behavior: "smooth", block: "start" });
                return;
            }
        });
    }

    // Connects the search input and sort dropdown to the property grid.
    function attachPropertyToolbar() {
        const searchInput = document.getElementById("property-search");
        const sortSelect = document.getElementById("property-sort");

        if (searchInput) {
            searchInput.addEventListener("input", (event) => {
                pageState.query = event.target.value;
                renderPropertyGrid("all-properties");
            });
        }

        if (sortSelect) {
            sortSelect.addEventListener("change", (event) => {
                pageState.sort = event.target.value;
                renderPropertyGrid("all-properties");
            });
        }
    }

    // Animates the statistics counters when the stats section becomes visible.
    function animateStats() {
        const counters = document.querySelectorAll(".stat-number");
        counters.forEach((counter) => {
            const target = Number(counter.getAttribute("data-target"));
            const duration = 2000;
            const increment = target / (duration / 16);
            let current = 0;

            const updateCounter = () => {
                current += increment;
                if (current < target) {
                    counter.textContent = String(Math.ceil(current));
                    requestAnimationFrame(updateCounter);
                } else {
                    counter.textContent = String(target);
                }
            };

            updateCounter();
        });
    }

    // Starts the stats animation only when the stats bar scrolls into view.
    function initStatsObserver() {
        const statsSection = document.querySelector(".stats-bar");
        if (!statsSection || typeof IntersectionObserver !== "function") {
            return;
        }

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) {
                    return;
                }

                animateStats();
                observer.unobserve(entry.target);
            });
        }, { threshold: 0.5 });

        observer.observe(statsSection);
    }

    // Controls the mobile navigation toggle and closes the menu when needed.
    function initMobileNav() {
        const toggle = document.querySelector(".menu-toggle");
        const navLinks = document.querySelector(".nav-links");

        if (!toggle || !navLinks) {
            return;
        }

        const closeMenu = () => {
            toggle.classList.remove("active");
            toggle.setAttribute("aria-expanded", "false");
            navLinks.classList.remove("open");
        };

        toggle.addEventListener("click", () => {
            const isOpen = navLinks.classList.toggle("open");
            toggle.classList.toggle("active", isOpen);
            toggle.setAttribute("aria-expanded", String(isOpen));
        });

        navLinks.querySelectorAll("a").forEach((link) => {
            link.addEventListener("click", closeMenu);
        });

        window.addEventListener("resize", () => {
            if (window.innerWidth > 768) {
                closeMenu();
            }
        });
    }

    // Reads the property index from the URL and returns the matching property record.
    function getPropertyFromUrl() {
        const root = document.getElementById("property-detail-root");
        if (!root) {
            return null;
        }

        const params = new URLSearchParams(window.location.search);
        const propertyIndex = Number(params.get("property"));

        if (Number.isNaN(propertyIndex) || !properties[propertyIndex]) {
            return null;
        }

        return properties[propertyIndex];
    }

    // Creates one slide for the property media gallery, supporting both images and videos.
    function createMediaSlide(item, isActive) {
        if (item.type === "video") {
            return `
                <div class="media-slide${isActive ? " active" : ""}" data-slide>
                    <video class="detail-media" controls preload="metadata" ${item.poster ? `poster="${item.poster}"` : ""}>
                        <source src="${item.src}" type="${item.mimeType || "video/mp4"}">
                    </video>
                </div>
            `;
        }

        return `
            <div class="media-slide${isActive ? " active" : ""}" data-slide>
                <img class="detail-media" src="${item.src}" alt="${item.alt || "Property media"}">
            </div>
        `;
    }

    // Renders the full property details page for the selected property.
    function renderPropertyDetail() {
        const root = document.getElementById("property-detail-root");
        if (!root) {
            return;
        }

        document.body.classList.add("property-detail-view");

        const property = getPropertyFromUrl();

        if (!property) {
            root.innerHTML = `
                <section class="container property-detail-page">
                    <div class="empty-state">
                        <h3>Property not found</h3>
                        <p>The property you requested does not exist or the link is invalid.</p>
                    </div>
                </section>
            `;
            return;
        }

        root.innerHTML = `
            <section class="container property-detail-page">
                <a href="properties.html" class="back-link"><i class="fas fa-arrow-left"></i> Back to properties</a>
                <div class="property-detail-layout">
                    <div class="property-gallery">
                        <div class="gallery-stage">
                            ${property.media.map((item, index) => createMediaSlide(item, index === 0)).join("")}
                            <button class="gallery-arrow gallery-arrow-left" type="button" data-gallery-nav="prev" aria-label="Previous media">
                                <i class="fas fa-chevron-left"></i>
                            </button>
                            <button class="gallery-arrow gallery-arrow-right" type="button" data-gallery-nav="next" aria-label="Next media">
                                <i class="fas fa-chevron-right"></i>
                            </button>
                        </div>
                        <div class="gallery-dots" aria-label="Property media pagination">
                            ${property.media.map((_, index) => `
                                <button
                                    class="gallery-dot${index === 0 ? " active" : ""}"
                                    type="button"
                                    data-gallery-dot="${index}"
                                    aria-label="Go to media ${index + 1}"
                                ></button>
                            `).join("")}
                        </div>
                        <div class="contact-action-bar">
                            <a
                                class="contact-action-btn contact-action-whatsapp"
                                href="https://wa.me/${CONTACT_PHONE.replace(/\D/g, "")}?text=${encodeURIComponent(`Hi, I want details about ${property.title}`)}"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <i class="fab fa-whatsapp"></i>
                                <span>WhatsApp</span>
                            </a>
                            <a
                                class="contact-action-btn contact-action-message"
                                href="sms:${CONTACT_PHONE}?body=${encodeURIComponent(`Hi, please share more details about ${property.title}`)}"
                            >
                                <i class="fas fa-message"></i>
                                <span class="contact-action-text">
                                    <span class="desktop-label">Message</span>
                                    <span class="mobile-label">Message</span>
                                </span>
                            </a>
                            <a
                                class="contact-action-btn contact-action-call"
                                href="tel:${CONTACT_PHONE}"
                            >
                                <i class="fas fa-phone"></i>
                                <span>Call</span>
                            </a>
                        </div>
                    </div>
                    <div class="property-detail-panel">
                        <span class="detail-chip">${property.categoryLabel}</span>
                        <h1 class="property-detail-title">${property.title}</h1>
                        <p class="property-detail-location"><i class="fas fa-map-marker-alt"></i> ${property.location}</p>
                        <div class="property-detail-price">${property.price}</div>
                        <p class="property-detail-overview">${property.details.overview}</p>
                        <div class="detail-spec-grid">
                            <div class="detail-spec-card">
                                <span class="detail-spec-label">Listing Type</span>
                                <strong>${property.listingLabel}</strong>
                            </div>
                            <div class="detail-spec-card">
                                <span class="detail-spec-label">Area</span>
                                <strong>${property.details.area}</strong>
                            </div>
                            <div class="detail-spec-card">
                                <span class="detail-spec-label">Status</span>
                                <strong>${property.details.status}</strong>
                            </div>
                            <div class="detail-spec-card">
                                <span class="detail-spec-label">Furnishing</span>
                                <strong>${property.details.furnishing}</strong>
                            </div>
                        </div>
                        <div class="detail-highlights">
                            <h2>Highlights</h2>
                            <ul>
                                ${property.details.highlights.map((item) => `<li>${item}</li>`).join("")}
                            </ul>
                        </div>
                        <div class="detail-actions">
                            <a href="enquiry.html?property=${encodeURIComponent(property.title)}" class="btn">Enquire Now</a>
                            <a href="properties.html" class="btn btn-outline detail-secondary-btn">Browse More</a>
                        </div>
                    </div>
                </div>
            </section>
        `;

        initPropertyGallery();
        notifyPropertyView(property);
    }

    // Builds the one-time phone gate modal and wires its submit behavior.
    function ensurePhoneGateModal() {
        if (phoneGateModal) {
            return phoneGateModal;
        }

        const wrapper = document.createElement("div");
        wrapper.className = "phone-gate-overlay hidden";
        wrapper.innerHTML = `
            <div class="phone-gate-dialog">
                <button class="phone-gate-close" type="button" aria-label="Close phone number popup">&times;</button>
                <h2>View Property Details</h2>
                <p>Enter your phone number</p>
                <form id="phoneGateForm" class="phone-gate-form">
                    <label for="phoneGateInput">Phone Number</label>
                    <input id="phoneGateInput" type="tel" inputmode="numeric" maxlength="10" placeholder="Enter 10-digit phone number" required>
                    <p id="phoneGateError" class="phone-gate-error hidden">Please enter a valid 10-digit phone number.</p>
                    <button class="btn" type="submit">Continue</button>
                </form>
            </div>
        `;

        document.body.appendChild(wrapper);
        phoneGateModal = wrapper;

        const form = wrapper.querySelector("#phoneGateForm");
        const input = wrapper.querySelector("#phoneGateInput");
        const error = wrapper.querySelector("#phoneGateError");
        const closeButton = wrapper.querySelector(".phone-gate-close");

        form.addEventListener("submit", (event) => {
            event.preventDefault();
            const value = input.value.trim();

            if (!/^[0-9]{10}$/.test(value)) {
                error.classList.remove("hidden");
                return;
            }

            error.classList.add("hidden");
            saveViewerPhone(value);
            closePhoneGate();

            if (typeof phoneGateSubmitHandler === "function") {
                const callback = phoneGateSubmitHandler;
                phoneGateSubmitHandler = null;
                callback(value);
            }
        });

        closeButton?.addEventListener("click", () => {
            closePhoneGate();
        });

        wrapper.addEventListener("click", (event) => {
            if (event.target === wrapper) {
                closePhoneGate();
            }
        });

        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape" && phoneGateModal && !phoneGateModal.classList.contains("hidden")) {
                closePhoneGate();
            }
        });

        return wrapper;
    }

    // Opens the phone gate and runs a callback after the visitor submits a valid number.
    function openPhoneGate(onSuccess) {
        const modal = ensurePhoneGateModal();
        phoneGateSubmitHandler = onSuccess || null;
        modal.classList.remove("hidden");
        document.body.classList.add("phone-gate-open");
        modal.querySelector("#phoneGateInput")?.focus();
    }

    // Closes the phone gate modal and restores page scrolling.
    function closePhoneGate() {
        if (!phoneGateModal) {
            return;
        }

        phoneGateModal.classList.add("hidden");
        document.body.classList.remove("phone-gate-open");
    }

    // Blocks direct access to property details until the visitor provides their phone number once.
    function initPropertyAccessGate() {
        const detailRoot = document.getElementById("property-detail-root");
        if (!detailRoot) {
            return true;
        }

        if (hasViewerPhone()) {
            return true;
        }

        openPhoneGate(() => {
            renderPropertyDetail();
        });

        return false;
    }

    // Wires the next/previous controls for the property image and video gallery.
    function initPropertyGallery() {
        const slides = Array.from(document.querySelectorAll("[data-slide]"));
        const navButtons = Array.from(document.querySelectorAll("[data-gallery-nav]"));
        const dotButtons = Array.from(document.querySelectorAll("[data-gallery-dot]"));
        const galleryStage = document.querySelector(".gallery-stage");

        if (!slides.length) {
            return;
        }

        let currentIndex = 0;

        const pauseVideos = () => {
            slides.forEach((slide) => {
                const video = slide.querySelector("video");
                if (video) {
                    video.pause();
                }
            });
        };

        const showSlide = (index) => {
            currentIndex = (index + slides.length) % slides.length;
            slides.forEach((slide, slideIndex) => {
                slide.classList.toggle("active", slideIndex === currentIndex);
            });
            dotButtons.forEach((dot, dotIndex) => {
                dot.classList.toggle("active", dotIndex === currentIndex);
            });
            pauseVideos();
        };

        navButtons.forEach((button) => {
            button.addEventListener("click", () => {
                showSlide(currentIndex + (button.dataset.galleryNav === "next" ? 1 : -1));
            });
        });

        dotButtons.forEach((button) => {
            button.addEventListener("click", () => {
                const slideIndex = Number(button.dataset.galleryDot);
                if (!Number.isNaN(slideIndex)) {
                    showSlide(slideIndex);
                }
            });
        });

        if (galleryStage && window.matchMedia("(max-width: 480px)").matches) {
            let touchStartX = 0;

            galleryStage.addEventListener("touchstart", (event) => {
                touchStartX = event.touches[0]?.clientX || 0;
            }, { passive: true });

            galleryStage.addEventListener("touchend", (event) => {
                const touchEndX = event.changedTouches[0]?.clientX || 0;
                const deltaX = touchStartX - touchEndX;

                if (Math.abs(deltaX) < 40) {
                    return;
                }

                showSlide(currentIndex + (deltaX > 0 ? 1 : -1));
            }, { passive: true });
        }

        showSlide(0);
    }

    // Hides the mobile action bar when the footer comes into view so it does not overlap it.
    function initMobileActionBarVisibility() {
        const actionBar = document.querySelector(".contact-action-bar");
        const footer = document.querySelector("footer");

        if (!actionBar || !footer || typeof IntersectionObserver !== "function") {
            return;
        }

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                actionBar.classList.toggle("is-hidden", entry.isIntersecting);
            });
        }, {
            threshold: 0.05
        });

        observer.observe(footer);
    }

    // Initializes shared page behavior and loads property data only on pages that need it.
    document.addEventListener("DOMContentLoaded", async () => {
        initMobileNav();
        attachPropertyActions();
        attachPropertyToolbar();
        initStatsObserver();
        initPropertyListRestoreOnPageShow();

        const needsPropertyData = Boolean(
            document.getElementById("featured-properties")
            || document.getElementById("all-properties")
            || document.getElementById("property-detail-root")
            || document.getElementById("property-category-buttons")
        );

        if (!needsPropertyData) {
            return;
        }

        try {
            await loadPropertyData();
            const restoredPropertyListState = restorePropertyListState();
            renderPropertyGrid("featured-properties", { limit: 3, featuredOnly: true });
            renderCategoryButtons();
            renderPropertyGrid("all-properties");
            focusRestoredPropertyCard(restoredPropertyListState);
            if (initPropertyAccessGate()) {
                renderPropertyDetail();
            }
            initMobileActionBarVisibility();
        } catch (error) {
            console.error("Failed to initialize property catalog:", error);
            const targets = ["featured-properties", "all-properties", "property-detail-root"];
            targets.forEach((id) => {
                const container = document.getElementById(id);
                if (!container) {
                    return;
                }

                container.innerHTML = `
                    <div class="empty-state">
                        <h3>Properties are unavailable right now</h3>
                        <p>Please refresh the page and try again.</p>
                    </div>
                `;
            });
        }
    });
})();
