/**
 * Briefing RSS Dashboard - Main Application
 */

// ==================== State Management ====================
let articles = [];
let lastUpdated = null;
let autoRefreshInterval = null;
let selectedCategory = 'all';
let categories = new Map();

// ==================== DOM Elements ====================
const elements = {
    loadingState: document.getElementById('loadingState'),
    errorState: document.getElementById('errorState'),
    emptyState: document.getElementById('emptyState'),
    feedErrors: document.getElementById('feedErrors'),
    feedErrorList: document.getElementById('feedErrorList'),
    cardsGrid: document.getElementById('cardsGrid'),
    refreshBtn: document.getElementById('refreshBtn'),
    themeToggle: document.getElementById('themeToggle'),
    lastUpdated: document.getElementById('lastUpdated'),
    articleCount: document.getElementById('articleCount'),
    errorMessage: document.getElementById('errorMessage')
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

        // Re-enable button
        elements.refreshBtn.disabled = false;
        elements.refreshBtn.innerHTML = '<span class="btn-icon">🔄</span> Refresh';
    } catch (error) {
        console.error('Error refreshing feeds:', error);
        elements.refreshBtn.disabled = false;
        elements.refreshBtn.innerHTML = '<span class="btn-icon">🔄</span> Refresh';
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

    articles.forEach(article => {
        const card = createCard(article);
        elements.cardsGrid.appendChild(card);
    });

    elements.cardsGrid.classList.remove('hidden');
    elements.loadingState.classList.add('hidden');
    elements.errorState.classList.add('hidden');
    elements.emptyState.classList.add('hidden');
}

function createCard(article) {
    const card = document.createElement('div');
    card.className = 'card';

    // Handle click to open article
    card.addEventListener('click', () => {
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

    // Update article count to show filtered count
    const count = displayedArticles.length;
    const totalCount = articles.length;

    if (selectedCategory === 'all') {
        elements.articleCount.textContent = `${count} article${count !== 1 ? 's' : ''}`;
    } else {
        elements.articleCount.textContent = `${count} of ${totalCount} articles`;
    }
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

    // Update "All Articles" count
    const totalCount = articles.length;
    const allCountEl = document.getElementById('allCount');
    if (allCountEl) {
        allCountEl.textContent = totalCount;
    }

    // Alphabetical categories (excluding Uncategorized)
    const sortedCategories = Array.from(categoryMap.keys())
        .filter(cat => cat !== 'Uncategorized')
        .sort();

    sortedCategories.forEach(category => {
        const count = categoryMap.get(category);
        const item = document.createElement('button');
        item.className = 'category-item';
        item.dataset.category = category;
        item.innerHTML = `
            <span class="category-name">${category}</span>
            <span class="category-count">${count}</span>
        `;
        item.addEventListener('click', () => selectCategory(category));
        categoryChips.appendChild(item);
    });

    // Add Uncategorized at end if exists
    if (categoryMap.has('Uncategorized')) {
        const count = categoryMap.get('Uncategorized');
        const item = document.createElement('button');
        item.className = 'category-item';
        item.dataset.category = 'Uncategorized';
        item.innerHTML = `
            <span class="category-name">Uncategorized</span>
            <span class="category-count">${count}</span>
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
                console.log('Auto-refreshing feeds...');
                fetchFeeds();
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

    // Add event listener for "All Articles" button
    const allArticlesBtn = document.querySelector('[data-category="all"]');
    if (allArticlesBtn) {
        allArticlesBtn.addEventListener('click', () => selectCategory('all'));
    }
}

// ==================== Initialization ====================
function init() {
    initTheme();
    setupEventListeners();
    fetchFeeds();
    setupAutoRefresh();
}

// Start the application when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
