/**
 * Briefing RSS Dashboard - Main Application
 */

// ==================== State Management ====================
let articles = [];
let lastUpdated = null;
let autoRefreshInterval = null;
let selectedCategory = 'all';
let categories = new Map();
let calendarEvents = [];
let lastCalendarUpdate = null;
let packages = [];
let lastPackageUpdate = null;
let readArticles = new Set(); // Store read article URLs
let showReadArticles = false; // Toggle for showing/hiding read articles

// ==================== DOM Elements ====================
const elements = {
    loadingState: document.getElementById('loadingState'),
    errorState: document.getElementById('errorState'),
    emptyState: document.getElementById('emptyState'),
    feedErrors: document.getElementById('feedErrors'),
    feedErrorList: document.getElementById('feedErrorList'),
    cardsGrid: document.getElementById('cardsGrid'),
    refreshBtn: document.getElementById('refreshBtn'),
    markOldReadBtn: document.getElementById('markOldReadBtn'),
    themeToggle: document.getElementById('themeToggle'),
    lastUpdated: document.getElementById('lastUpdated'),
    articleCount: document.getElementById('articleCount'),
    errorMessage: document.getElementById('errorMessage'),
    readToggle: document.getElementById('readToggle')
};

// ==================== Theme Management ====================
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';

    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
    const icon = elements.themeToggle.querySelector('.theme-icon');
    icon.textContent = theme === 'light' ? '🌙' : '☀️';
}

// ==================== Read Articles Management ====================
function loadReadArticles() {
    const saved = localStorage.getItem('readArticles');
    if (saved) {
        readArticles = new Set(JSON.parse(saved));
    }
}

function saveReadArticles() {
    localStorage.setItem('readArticles', JSON.stringify([...readArticles]));
}

function markArticleAsRead(url) {
    readArticles.add(url);
    saveReadArticles();
}

function isArticleRead(url) {
    return readArticles.has(url);
}

function toggleReadArticlesVisibility() {
    showReadArticles = !showReadArticles;
    updateReadToggleButton();

    // Re-render cards with current filter
    const filteredArticles = filterArticlesByCategory(articles, selectedCategory);
    renderCards(filteredArticles);

    // Update footer with correct counts
    updateFooter(filteredArticles);
}

function updateReadToggleButton() {
    if (!elements.readToggle) return;

    const icon = elements.readToggle.querySelector('.btn-icon');
    if (showReadArticles) {
        elements.readToggle.classList.add('active');
        icon.textContent = '👁️';
        elements.readToggle.title = 'Hide read articles';
    } else {
        elements.readToggle.classList.remove('active');
        icon.textContent = '👁️‍🗨️';
        elements.readToggle.title = 'Show read articles';
    }
}

// ==================== API Functions ====================
async function fetchFeeds() {
    try {
        showLoading();

        const response = await fetch('/api/feeds');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        articles = data.articles || [];
        lastUpdated = data.lastUpdated;

        // Extract and update categories
        categories = getCategories(articles);
        updateCategoryFilter(categories);

        // Display feed errors if any
        if (data.errors && data.errors.length > 0) {
            displayFeedErrors(data.errors);
        } else {
            elements.feedErrors.classList.add('hidden');
        }

        if (articles.length === 0) {
            showEmptyState();
        } else {
            // Apply current category filter
            const filteredArticles = filterArticlesByCategory(articles, selectedCategory);
            renderCards(filteredArticles);
            updateFooter(filteredArticles);
        }
    } catch (error) {
        console.error('Error fetching feeds:', error);
        showError(error.message);
    }
}

async function refreshFeeds() {
    try {
        // Disable refresh button
        elements.refreshBtn.disabled = true;
        elements.refreshBtn.innerHTML = '<span class="btn-icon">⏳</span> Refreshing...';

        // Clear cache
        await fetch('/api/refresh', { method: 'POST' });

        // Fetch new data
        await fetchFeeds();
        await fetchCalendar();
        await fetchPackages();

        // Re-enable button
        elements.refreshBtn.disabled = false;
        elements.refreshBtn.innerHTML = '<span class="btn-icon">🔄</span> Refresh';
    } catch (error) {
        console.error('Error refreshing feeds:', error);
        elements.refreshBtn.disabled = false;
        elements.refreshBtn.innerHTML = '<span class="btn-icon">🔄</span> Refresh';
    }
}

async function fetchCalendar() {
    try {
        const response = await fetch('/api/calendar');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        calendarEvents = data.events || [];
        lastCalendarUpdate = data.lastUpdated;

        renderCalendarWidget(calendarEvents);

        if (data.errors && data.errors.length > 0) {
            console.warn('Calendar errors:', data.errors);
        }
    } catch (error) {
        console.error('Error fetching calendar:', error);
        // Fail silently - calendar is optional
        renderCalendarWidget([]);
    }
}

async function fetchPackages() {
    try {
        // Show loading state
        const widget = document.getElementById('packagesWidget');
        if (widget) {
            widget.innerHTML = '<div class="package-loading">Checking for packages...</div>';
        }

        const response = await fetch('/api/packages');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        packages = data.packages || [];
        lastPackageUpdate = data.lastUpdated;

        renderPackagesWidget(packages);

        if (data.errors && data.errors.length > 0) {
            console.warn('Package tracking errors:', data.errors);
        }
    } catch (error) {
        console.error('Error fetching packages:', error);
        // Fail silently - package tracking is optional
        renderPackagesWidget([]);
    }
}

// ==================== Display Functions ====================
function showLoading() {
    elements.loadingState.classList.remove('hidden');
    elements.errorState.classList.add('hidden');
    elements.emptyState.classList.add('hidden');
    elements.cardsGrid.classList.add('hidden');
}

function showError(message) {
    elements.errorState.classList.remove('hidden');
    elements.loadingState.classList.add('hidden');
    elements.emptyState.classList.add('hidden');
    elements.cardsGrid.classList.add('hidden');
    elements.errorMessage.textContent = message;
}

function showEmptyState() {
    elements.emptyState.classList.remove('hidden');
    elements.loadingState.classList.add('hidden');
    elements.errorState.classList.add('hidden');
    elements.cardsGrid.classList.add('hidden');
}

function displayFeedErrors(errors) {
    elements.feedErrorList.innerHTML = '';
    errors.forEach(error => {
        const li = document.createElement('li');
        li.textContent = `${error.feed}: ${error.error}`;
        elements.feedErrorList.appendChild(li);
    });
    elements.feedErrors.classList.remove('hidden');
}

// ==================== Card Rendering ====================
function renderCards(articles) {
    elements.cardsGrid.innerHTML = '';

    // Filter out read articles if toggle is off
    let displayArticles = articles;
    if (!showReadArticles) {
        displayArticles = articles.filter(article => !isArticleRead(article.link));
    }

    // Sort by publication date - oldest first
    displayArticles.sort((a, b) => {
        const dateA = new Date(a.pubDate);
        const dateB = new Date(b.pubDate);
        return dateA - dateB; // Ascending order (oldest first)
    });

    // Group articles by category
    const articlesByCategory = new Map();
    displayArticles.forEach(article => {
        const category = article.category || 'Uncategorized';
        if (!articlesByCategory.has(category)) {
            articlesByCategory.set(category, []);
        }
        articlesByCategory.get(category).push(article);
    });

    // Render each category section
    articlesByCategory.forEach((categoryArticles, category) => {
        // Create category header with "Mark All Read" button
        const categorySection = document.createElement('div');
        categorySection.className = 'category-section';

        const categoryHeader = document.createElement('div');
        categoryHeader.className = 'category-header';

        const categoryTitle = document.createElement('h2');
        categoryTitle.className = 'category-title';
        categoryTitle.textContent = category;

        const markAllReadBtn = document.createElement('button');
        markAllReadBtn.className = 'btn btn-secondary btn-mark-all-read';
        markAllReadBtn.innerHTML = '<span class="btn-icon">✓</span> Mark All Read';
        markAllReadBtn.title = `Mark all articles in ${category} as read`;
        markAllReadBtn.addEventListener('click', () => markCategoryAsRead(category, categoryArticles));

        categoryHeader.appendChild(categoryTitle);
        categoryHeader.appendChild(markAllReadBtn);
        categorySection.appendChild(categoryHeader);

        elements.cardsGrid.appendChild(categorySection);

        // Render cards for this category
        categoryArticles.forEach(article => {
            const card = createCard(article);
            elements.cardsGrid.appendChild(card);
        });
    });

    // Show empty state if no articles to display
    if (displayArticles.length === 0) {
        elements.emptyState.classList.remove('hidden');
        elements.cardsGrid.classList.add('hidden');
    } else {
        elements.cardsGrid.classList.remove('hidden');
        elements.emptyState.classList.add('hidden');
    }

    elements.loadingState.classList.add('hidden');
    elements.errorState.classList.add('hidden');
}

function markCategoryAsRead(category, categoryArticles) {
    // Mark all articles in this category as read
    categoryArticles.forEach(article => {
        markArticleAsRead(article.link);
    });

    // Re-render to update UI
    const filteredArticles = filterArticlesByCategory(articles, selectedCategory);
    renderCards(filteredArticles);
    updateFooter(filteredArticles);

    // Update category counts in sidebar
    const categories = getCategories(articles);
    updateCategoryFilter(categories);
}

function markOlderThanTodayAsRead() {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset to start of today

    let markedCount = 0;

    // Filter articles that are older than today
    articles.forEach(article => {
        const articleDate = new Date(article.pubDate);
        articleDate.setHours(0, 0, 0, 0);

        if (articleDate < today && !isArticleRead(article.link)) {
            markArticleAsRead(article.link);
            markedCount++;
        }
    });

    // Re-render to update UI
    const filteredArticles = filterArticlesByCategory(articles, selectedCategory);
    renderCards(filteredArticles);
    updateFooter(filteredArticles);

    // Update category counts in sidebar
    const categories = getCategories(articles);
    updateCategoryFilter(categories);

    // Show feedback
    console.log(`Marked ${markedCount} old articles as read`);
}

function createCard(article) {
    const card = document.createElement('div');
    card.className = 'card';

    // Mark as read if already read
    if (isArticleRead(article.link)) {
        card.classList.add('read');
    }

    // Handle click to open article
    card.addEventListener('click', () => {
        markArticleAsRead(article.link);

        // If we're not showing read articles, remove the card with animation
        if (!showReadArticles) {
            card.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
            card.style.opacity = '0';
            card.style.transform = 'scale(0.95)';

            setTimeout(() => {
                card.remove();
                updateArticleCount();
                updateCategoryFilter(categories);

                // Check if grid is empty
                if (elements.cardsGrid.children.length === 0) {
                    elements.emptyState.classList.remove('hidden');
                    elements.cardsGrid.classList.add('hidden');
                }
            }, 300);
        } else {
            // If showing read articles, just update the visual state
            card.classList.add('read');
            updateArticleCount();
            updateCategoryFilter(categories);
        }

        window.open(article.link, '_blank', 'noopener,noreferrer');
    });

    // Image container
    const imageContainer = document.createElement('div');
    imageContainer.className = 'card-image-container';

    if (article.image) {
        const img = document.createElement('img');
        img.className = 'card-image';
        img.src = article.image;
        img.alt = article.title;
        img.loading = 'lazy';

        // Fallback for broken images
        img.onerror = () => {
            img.style.display = 'none';
            const placeholder = document.createElement('div');
            placeholder.className = 'card-placeholder';
            placeholder.textContent = '📰';
            imageContainer.appendChild(placeholder);
        };

        imageContainer.appendChild(img);
    } else {
        const placeholder = document.createElement('div');
        placeholder.className = 'card-placeholder';
        placeholder.textContent = '📰';
        imageContainer.appendChild(placeholder);
    }

    // Source badge
    const sourceBadge = document.createElement('div');
    sourceBadge.className = 'card-source-badge';
    sourceBadge.textContent = article.source;
    imageContainer.appendChild(sourceBadge);

    // Category badge (if not Uncategorized)
    if (article.category && article.category !== 'Uncategorized') {
        const categoryBadge = document.createElement('div');
        categoryBadge.className = 'card-category-badge';
        categoryBadge.textContent = article.category;
        imageContainer.appendChild(categoryBadge);
    }

    card.appendChild(imageContainer);

    // Content
    const content = document.createElement('div');
    content.className = 'card-content';

    // Title
    const title = document.createElement('h2');
    title.className = 'card-title';
    title.textContent = article.title;
    content.appendChild(title);

    // Description
    if (article.description) {
        const description = document.createElement('p');
        description.className = 'card-description';
        description.textContent = article.description;
        content.appendChild(description);
    }

    // Footer
    const footer = document.createElement('div');
    footer.className = 'card-footer';

    const date = document.createElement('span');
    date.className = 'card-date';
    date.textContent = formatRelativeTime(article.pubDate);
    footer.appendChild(date);

    const readMore = document.createElement('span');
    readMore.className = 'card-read-more';
    readMore.textContent = 'Read more →';
    footer.appendChild(readMore);

    content.appendChild(footer);
    card.appendChild(content);

    return card;
}

// ==================== Utility Functions ====================
function formatRelativeTime(dateString) {
    if (!dateString) return 'Recently';

    try {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
        if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
        if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;

        // Format as date
        return date.toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
        });
    } catch (error) {
        return 'Recently';
    }
}

function updateFooter(displayedArticles = articles) {
    // Update last updated time
    if (lastUpdated) {
        const date = new Date(lastUpdated);
        elements.lastUpdated.textContent = `Updated ${formatRelativeTime(lastUpdated)}`;
    }

    updateArticleCount(displayedArticles);
}

function updateArticleCount(displayedArticles = articles) {
    // Calculate unread count
    const unreadCount = articles.filter(a => !isArticleRead(a.link)).length;
    const totalCount = articles.length;

    // Show unread count
    elements.articleCount.textContent = `${unreadCount} unread of ${totalCount} articles`;
}

// ==================== Category Functions ====================
function getCategories(articles) {
    const categoryMap = new Map();
    articles.forEach(article => {
        const cat = article.category || 'Uncategorized';
        categoryMap.set(cat, (categoryMap.get(cat) || 0) + 1);
    });
    return categoryMap;
}

function updateCategoryFilter(categoryMap) {
    const categoryChips = document.getElementById('categoryChips');
    categoryChips.innerHTML = '';

    // Calculate unread count for "All Articles"
    const unreadArticles = articles.filter(a => !isArticleRead(a.link));
    const unreadCount = unreadArticles.length;
    const allCountEl = document.getElementById('allCount');
    if (allCountEl) {
        allCountEl.textContent = unreadCount;
    }

    // Calculate unread counts per category
    const unreadCategoryMap = new Map();
    unreadArticles.forEach(article => {
        const cat = article.category || 'Uncategorized';
        unreadCategoryMap.set(cat, (unreadCategoryMap.get(cat) || 0) + 1);
    });

    // Alphabetical categories (excluding Uncategorized)
    const sortedCategories = Array.from(categoryMap.keys())
        .filter(cat => cat !== 'Uncategorized')
        .sort();

    sortedCategories.forEach(category => {
        const unreadInCategory = unreadCategoryMap.get(category) || 0;
        const item = document.createElement('button');
        item.className = 'category-item';
        item.dataset.category = category;
        item.innerHTML = `
            <span class="category-name">${category}</span>
            <span class="category-count">${unreadInCategory}</span>
        `;
        item.addEventListener('click', () => selectCategory(category));
        categoryChips.appendChild(item);
    });

    // Add Uncategorized at end if exists
    if (categoryMap.has('Uncategorized')) {
        const unreadInUncategorized = unreadCategoryMap.get('Uncategorized') || 0;
        const item = document.createElement('button');
        item.className = 'category-item';
        item.dataset.category = 'Uncategorized';
        item.innerHTML = `
            <span class="category-name">Uncategorized</span>
            <span class="category-count">${unreadInUncategorized}</span>
        `;
        item.addEventListener('click', () => selectCategory('Uncategorized'));
        categoryChips.appendChild(item);
    }
}

function selectCategory(category) {
    selectedCategory = category;

    // Update active state
    document.querySelectorAll('.category-item').forEach(item => {
        if (item.dataset.category === category) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    // Re-render with filter
    const filteredArticles = filterArticlesByCategory(articles, selectedCategory);
    renderCards(filteredArticles);
    updateFooter(filteredArticles);
}

function filterArticlesByCategory(articles, category) {
    if (category === 'all') {
        return articles;
    }
    return articles.filter(article => {
        const articleCat = article.category || 'Uncategorized';
        return articleCat === category;
    });
}

// ==================== Calendar Functions ====================
function renderCalendarWidget(events) {
    const widget = document.getElementById('calendarWidget');
    const countEl = document.getElementById('todayEventCount');

    if (!widget) return;

    // Sort by start time
    const sortedEvents = events.sort((a, b) =>
        new Date(a.startTime) - new Date(b.startTime)
    );

    // Update count
    if (countEl) {
        countEl.textContent = sortedEvents.length;
    }

    // Clear and render
    widget.innerHTML = '';

    if (sortedEvents.length === 0) {
        widget.innerHTML = '<div class="no-events">No events today</div>';
        return;
    }

    sortedEvents.forEach(event => {
        const eventEl = createEventElement(event);
        widget.appendChild(eventEl);
    });
}

function createEventElement(event) {
    const el = document.createElement('div');
    el.className = 'event-item';

    const timeStr = formatEventTime(event.startTime, event.endTime, event.isAllDay);
    const description = event.description || '';
    const truncatedDesc = description.length > 100
        ? description.substring(0, 100) + '...'
        : description;

    const timeDiv = document.createElement('div');
    timeDiv.className = 'event-time';
    timeDiv.textContent = timeStr;

    const detailsDiv = document.createElement('div');
    detailsDiv.className = 'event-details';

    const titleDiv = document.createElement('div');
    titleDiv.className = 'event-title';
    titleDiv.textContent = event.title;

    detailsDiv.appendChild(titleDiv);

    if (truncatedDesc) {
        const descDiv = document.createElement('div');
        descDiv.className = 'event-description';
        descDiv.textContent = truncatedDesc;
        detailsDiv.appendChild(descDiv);
    }

    el.appendChild(timeDiv);
    el.appendChild(detailsDiv);

    return el;
}

function formatEventTime(start, end, isAllDay) {
    if (isAllDay) return 'All day';

    try {
        const startDate = new Date(start);
        const timeStr = startDate.toLocaleTimeString(undefined, {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });

        return timeStr;
    } catch (error) {
        return 'Time TBD';
    }
}

function renderPackagesWidget(packages) {
    const widget = document.getElementById('packagesWidget');
    const countEl = document.getElementById('todayPackageCount');

    if (!widget) return;

    // Update count
    if (countEl) {
        countEl.textContent = packages.length;
    }

    // Clear and render
    widget.innerHTML = '';

    if (packages.length === 0) {
        widget.innerHTML = '<div class="no-packages">No packages this week</div>';
        return;
    }

    packages.forEach(pkg => {
        const packageEl = createPackageElement(pkg);
        widget.appendChild(packageEl);
    });
}

function createPackageElement(pkg) {
    const el = document.createElement('div');
    el.className = 'package-item';

    const courierDiv = document.createElement('div');
    courierDiv.className = 'package-courier';
    courierDiv.textContent = pkg.courier || 'Unknown';

    const detailsDiv = document.createElement('div');
    detailsDiv.className = 'package-details';

    const titleDiv = document.createElement('div');
    titleDiv.className = 'package-title';
    titleDiv.textContent = pkg.subject || 'Package';

    detailsDiv.appendChild(titleDiv);

    // Add tracking number if available
    if (pkg.tracking_numbers && pkg.tracking_numbers.length > 0) {
        const trackingDiv = document.createElement('div');
        trackingDiv.className = 'package-tracking';
        trackingDiv.textContent = `Tracking: ${pkg.tracking_numbers[0]}`;
        detailsDiv.appendChild(trackingDiv);
    }

    // Add delivery date/time
    if (pkg.delivery_date) {
        const deliveryDiv = document.createElement('div');
        deliveryDiv.className = 'package-delivery';
        deliveryDiv.textContent = `Arriving ${pkg.delivery_date}`;
        detailsDiv.appendChild(deliveryDiv);
    }

    el.appendChild(courierDiv);
    el.appendChild(detailsDiv);

    return el;
}

function setupAutoRefresh() {
    // Load config to get refresh interval
    fetch('/api/config')
        .then(res => res.json())
        .then(config => {
            const intervalSeconds = config.settings?.autoRefreshInterval || 300; // Default 5 minutes

            // Clear existing interval
            if (autoRefreshInterval) {
                clearInterval(autoRefreshInterval);
            }

            // Set up new interval
            autoRefreshInterval = setInterval(() => {
                console.log('Auto-refreshing feeds, calendar, and packages...');
                fetchFeeds();
                fetchCalendar();
                fetchPackages();
            }, intervalSeconds * 1000);
        })
        .catch(err => {
            console.error('Error loading config:', err);
        });
}

// ==================== Event Listeners ====================
function setupEventListeners() {
    elements.refreshBtn.addEventListener('click', refreshFeeds);
    elements.themeToggle.addEventListener('click', toggleTheme);

    // Mark older than today read button
    if (elements.markOldReadBtn) {
        elements.markOldReadBtn.addEventListener('click', markOlderThanTodayAsRead);
    }

    // Read toggle button
    if (elements.readToggle) {
        elements.readToggle.addEventListener('click', toggleReadArticlesVisibility);
    }

    // Add event listener for "All Articles" button
    const allArticlesBtn = document.querySelector('[data-category="all"]');
    if (allArticlesBtn) {
        allArticlesBtn.addEventListener('click', () => selectCategory('all'));
    }
}

// ==================== Initialization ====================
function init() {
    initTheme();
    loadReadArticles();
    updateReadToggleButton();
    setupEventListeners();
    fetchFeeds();
    fetchCalendar();
    fetchPackages();
    setupAutoRefresh();
}

// Start the application when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
