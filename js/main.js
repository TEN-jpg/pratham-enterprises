(function () {
    const CONTACT_PHONE = "+917208153358";
    const rawProperties = Array.isArray(window.PROPERTY_CATALOG) ? window.PROPERTY_CATALOG : [];
    const categories = Array.isArray(window.PROPERTY_CATEGORIES) ? window.PROPERTY_CATEGORIES : [];

    const properties = rawProperties.map((item, index) => ({
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

    const pageState = {
        category: "all",
        query: "",
        sort: "featured"
    };

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

    function createPropertyCard(property, index) {
        return `
            <article class="card card-clickable" style="animation-delay: ${index * 0.08}s">
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
                        <a href="${property.detailUrl}" class="card-link">View Details</a>
                        <button class="card-btn" data-enquire="${property.title}" type="button">Enquire Now</button>
                    </div>
                </div>
            </article>
        `;
    }

    function createEmptyState() {
        return `
            <div class="empty-state">
                <h3>No properties matched your search</h3>
                <p>Try another keyword, choose a different category, or reset the filters.</p>
            </div>
        `;
    }

    function renderPropertyGrid(containerId, options = {}) {
        const container = document.getElementById(containerId);
        if (!container) {
            return;
        }

        const { limit = null, featuredOnly = false } = options;
        let items = getProperties({ featuredOnly, ignorePageFilters: featuredOnly });

        if (typeof limit === "number") {
            items = items.slice(0, limit);
        }

        container.innerHTML = items.length
            ? items.map((property, index) => createPropertyCard(property, index)).join("")
            : createEmptyState();

        const counter = document.getElementById("property-results-count");
        if (counter && !featuredOnly) {
            counter.textContent = `${items.length} propert${items.length === 1 ? "y" : "ies"} found`;
        }
    }

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

    function updateCategoryCards() {
        const cards = document.querySelectorAll(".info-card[data-category]");
        cards.forEach((card) => {
            const matches = pageState.category === "all" || card.dataset.category === pageState.category;
            card.classList.toggle("active", matches);
            card.setAttribute("aria-pressed", matches ? "true" : "false");
        });
    }

    function applyFilters() {
        renderCategoryButtons();
        updateCategoryCards();
        renderPropertyGrid("all-properties");
    }

    function attachPropertyActions() {
        document.addEventListener("click", (event) => {
            const enquireButton = event.target.closest("[data-enquire]");
            if (enquireButton) {
                const propertyName = enquireButton.getAttribute("data-enquire");
                window.location.href = `enquiry.html?property=${encodeURIComponent(propertyName)}`;
                return;
            }

            const categoryButton = event.target.closest("[data-category]");
            if (!categoryButton) {
                return;
            }

            const category = categoryButton.getAttribute("data-category");
            if (!category || category === pageState.category) {
                return;
            }

            pageState.category = category;
            applyFilters();
            document.getElementById("all-properties")?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
    }

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

    function renderPropertyDetail() {
        const root = document.getElementById("property-detail-root");
        if (!root) {
            return;
        }

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
    }

    function initPropertyGallery() {
        const slides = Array.from(document.querySelectorAll("[data-slide]"));
        const navButtons = Array.from(document.querySelectorAll("[data-gallery-nav]"));

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
            pauseVideos();
        };

        navButtons.forEach((button) => {
            button.addEventListener("click", () => {
                showSlide(currentIndex + (button.dataset.galleryNav === "next" ? 1 : -1));
            });
        });

        showSlide(0);
    }

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

    document.addEventListener("DOMContentLoaded", () => {
        initMobileNav();
        renderPropertyGrid("featured-properties", { limit: 3, featuredOnly: true });
        renderCategoryButtons();
        updateCategoryCards();
        renderPropertyGrid("all-properties");
        renderPropertyDetail();
        initMobileActionBarVisibility();
        attachPropertyActions();
        attachPropertyToolbar();
        initStatsObserver();
    });
})();
