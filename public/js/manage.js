/**
 * Briefing Feed Management
 */

// ==================== State Management ====================
let feeds = [];
let calendars = [];
let settings = {};
let originalConfig = null;
let selectedCategory = 'all';
let searchQuery = '';
let hasChanges = false;
let activeTab = 'feeds';

// ==================== DOM Elements ====================
const elements = {
    // Stats
    totalFeeds: document.getElementById('totalFeeds'),
    enabledFeeds: document.getElementById('enabledFeeds'),
    disabledFeeds: document.getElementById('disabledFeeds'),
    categoryCount: document.getElementById('categoryCount'),

    // Controls
    searchInput: document.getElementById('searchInput'),
    addFeedBtn: document.getElementById('addFeedBtn'),
    saveBtn: document.getElementById('saveBtn'),
    categoryChips: document.getElementById('categoryChips'),
    feedsList: document.getElementById('feedsList'),
    loadingState: document.getElementById('loadingState'),
    themeToggle: document.getElementById('themeToggle'),

    // Add Feed Modal
    addFeedModal: document.getElementById('addFeedModal'),
    addFeedForm: document.getElementById('addFeedForm'),
    feedName: document.getElementById('feedName'),
    feedUrl: document.getElementById('feedUrl'),
    feedCategory: document.getElementById('feedCategory'),
    feedEnabled: document.getElementById('feedEnabled'),

    // Edit Feed Modal
    editFeedModal: document.getElementById('editFeedModal'),
    editFeedForm: document.getElementById('editFeedForm'),
    editFeedIndex: document.getElementById('editFeedIndex'),
    editFeedName: document.getElementById('editFeedName'),
    editFeedUrl: document.getElementById('editFeedUrl'),
    editFeedCategory: document.getElementById('editFeedCategory'),
    editFeedEnabled: document.getElementById('editFeedEnabled'),
    deleteFeedBtn: document.getElementById('deleteFeedBtn'),

    // Calendar Elements
    totalCalendars: document.getElementById('totalCalendars'),
    enabledCalendars: document.getElementById('enabledCalendars'),
    calendarsList: document.getElementById('calendarsList'),
    addCalendarBtn: document.getElementById('addCalendarBtn'),

    // Add Calendar Modal
    addCalendarModal: document.getElementById('addCalendarModal'),
    addCalendarForm: document.getElementById('addCalendarForm'),
    calendarName: document.getElementById('calendarName'),
    calendarUrl: document.getElementById('calendarUrl'),
    calendarEnabled: document.getElementById('calendarEnabled'),

    // Edit Calendar Modal
    editCalendarModal: document.getElementById('editCalendarModal'),
    editCalendarForm: document.getElementById('editCalendarForm'),
    editCalendarIndex: document.getElementById('editCalendarIndex'),
    editCalendarName: document.getElementById('editCalendarName'),
    editCalendarUrl: document.getElementById('editCalendarUrl'),
    editCalendarEnabled: document.getElementById('editCalendarEnabled'),
    deleteCalendarBtn: document.getElementById('deleteCalendarBtn')
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
async function loadConfig() {
    try {
        const response = await fetch('/api/config');
        if (!response.ok) throw new Error('Failed to load config');

        const data = await response.json();
        feeds = data.feeds || [];
        calendars = (data.calendar && data.calendar.sources) || [];
        settings = data.settings || {};
        originalConfig = JSON.parse(JSON.stringify(data));

        // Infer categories from feed names (since we don't have them yet)
        inferCategories();

        updateStats();
        updateCategoryFilter();
        renderFeeds();
        updateCalendarStats();
        renderCalendars();

        elements.loadingState.classList.add('hidden');
    } catch (error) {
        console.error('Error loading config:', error);
        alert('Failed to load feeds configuration');
    }
}

function inferCategories() {
    // Add category property to feeds if not present
    feeds.forEach(feed => {
        if (!feed.category) {
            feed.category = 'Uncategorized';
        }
    });
}

async function saveConfig() {
    try {
        elements.saveBtn.disabled = true;
        elements.saveBtn.innerHTML = '<span class="btn-icon">⏳</span> Saving...';

        const config = {
            feeds: feeds,
            calendar: {
                sources: calendars
            },
            settings: settings
        };

        const response = await fetch('/api/save-config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });

        if (!response.ok) throw new Error('Failed to save config');

        originalConfig = JSON.parse(JSON.stringify(config));
        hasChanges = false;
        updateSaveButton();

        alert('✅ Configuration saved successfully!\n\nRestart the server or wait for auto-refresh to see changes.');
    } catch (error) {
        console.error('Error saving config:', error);
        alert('Failed to save configuration: ' + error.message);
    } finally {
        elements.saveBtn.disabled = false;
        elements.saveBtn.innerHTML = '<span class="btn-icon">💾</span> Save Changes';
    }
}

// ==================== Category Management ====================
function getCategories() {
    const categories = {};
    feeds.forEach(feed => {
        const cat = feed.category || 'Uncategorized';
        categories[cat] = (categories[cat] || 0) + 1;
    });
    return categories;
}

function updateCategoryFilter() {
    const categories = getCategories();
    elements.categoryChips.innerHTML = '';

    Object.keys(categories).sort().forEach(category => {
        const chip = document.createElement('button');
        chip.className = 'category-chip';
        chip.dataset.category = category;
        chip.innerHTML = `${category} <span class="count">(${categories[category]})</span>`;
        chip.addEventListener('click', () => selectCategory(category));
        elements.categoryChips.appendChild(chip);
    });

    // Populate category datalists for forms
    const options = Object.keys(categories).sort().map(cat =>
        `<option value="${cat}">`
    ).join('');

    document.getElementById('categorySuggestions').innerHTML = options;
    document.getElementById('editCategorySuggestions').innerHTML = options;
}

function selectCategory(category) {
    selectedCategory = category;

    // Update active state
    document.querySelectorAll('.category-chip').forEach(chip => {
        if (chip.dataset.category === category || (category === 'all' && !chip.dataset.category)) {
            chip.classList.add('active');
        } else {
            chip.classList.remove('active');
        }
    });

    renderFeeds();
}

// ==================== Feed Rendering ====================
function renderFeeds() {
    const filteredFeeds = feeds.filter(feed => {
        // Category filter
        if (selectedCategory !== 'all') {
            const feedCat = feed.category || 'Uncategorized';
            if (selectedCategory === 'uncategorized') {
                if (feedCat !== 'Uncategorized') return false;
            } else {
                if (feedCat !== selectedCategory) return false;
            }
        }

        // Search filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            const nameMatch = feed.name.toLowerCase().includes(query);
            const urlMatch = feed.url.toLowerCase().includes(query);
            if (!nameMatch && !urlMatch) return false;
        }

        return true;
    });

    // Group by category
    const byCategory = {};
    filteredFeeds.forEach(feed => {
        const cat = feed.category || 'Uncategorized';
        if (!byCategory[cat]) byCategory[cat] = [];
        byCategory[cat].push(feed);
    });

    // Render
    elements.feedsList.innerHTML = '';

    if (Object.keys(byCategory).length === 0) {
        elements.feedsList.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🔍</div>
                <h2>No feeds found</h2>
                <p>Try adjusting your search or filters</p>
            </div>
        `;
        return;
    }

    Object.keys(byCategory).sort().forEach(category => {
        const section = createCategorySection(category, byCategory[category]);
        elements.feedsList.appendChild(section);
    });
}

function createCategorySection(category, categoryFeeds) {
    const section = document.createElement('div');
    section.className = 'category-section';

    const enabledCount = categoryFeeds.filter(f => f.enabled !== false).length;

    section.innerHTML = `
        <div class="category-header">
            <h3 class="category-title">${category} (${categoryFeeds.length})</h3>
            <div class="category-actions">
                <button class="category-toggle" data-action="enable-all">
                    Enable All
                </button>
                <button class="category-toggle" data-action="disable-all">
                    Disable All
                </button>
            </div>
        </div>
        <div class="feed-items"></div>
    `;

    const feedItems = section.querySelector('.feed-items');
    categoryFeeds.forEach((feed, localIndex) => {
        const globalIndex = feeds.indexOf(feed);
        const item = createFeedItem(feed, globalIndex);
        feedItems.appendChild(item);
    });

    // Category actions
    section.querySelector('[data-action="enable-all"]').addEventListener('click', () => {
        categoryFeeds.forEach(feed => feed.enabled = true);
        markChanged();
        renderFeeds();
        updateStats();
    });

    section.querySelector('[data-action="disable-all"]').addEventListener('click', () => {
        categoryFeeds.forEach(feed => feed.enabled = false);
        markChanged();
        renderFeeds();
        updateStats();
    });

    return section;
}

function createFeedItem(feed, index) {
    const item = document.createElement('div');
    item.className = 'feed-item' + (feed.enabled === false ? ' disabled' : '');

    item.innerHTML = `
        <div class="feed-toggle ${feed.enabled !== false ? 'active' : ''}" data-index="${index}"></div>
        <div class="feed-info">
            <div class="feed-name">${escapeHtml(feed.name)}</div>
            <div class="feed-url">${escapeHtml(feed.url)}</div>
        </div>
        <div class="feed-category-badge">${escapeHtml(feed.category || 'Uncategorized')}</div>
        <div class="feed-actions">
            <button class="icon-btn" data-action="edit" data-index="${index}" title="Edit feed">
                ✏️
            </button>
        </div>
    `;

    // Toggle handler
    item.querySelector('.feed-toggle').addEventListener('click', () => {
        feed.enabled = !feed.enabled;
        markChanged();
        renderFeeds();
        updateStats();
    });

    // Edit handler
    item.querySelector('[data-action="edit"]').addEventListener('click', () => {
        openEditModal(index);
    });

    return item;
}

// ==================== Modal Management ====================
function openAddModal() {
    elements.addFeedForm.reset();
    elements.feedEnabled.checked = true;
    elements.addFeedModal.classList.remove('hidden');
}

function closeAddModal() {
    elements.addFeedModal.classList.add('hidden');
}

function openEditModal(index) {
    const feed = feeds[index];
    elements.editFeedIndex.value = index;
    elements.editFeedName.value = feed.name;
    elements.editFeedUrl.value = feed.url;
    elements.editFeedCategory.value = feed.category || '';
    elements.editFeedEnabled.checked = feed.enabled !== false;
    elements.editFeedModal.classList.remove('hidden');
}

function closeEditModal() {
    elements.editFeedModal.classList.add('hidden');
}

// ==================== Feed Actions ====================
function addFeed(name, url, category, enabled) {
    feeds.push({
        name: name,
        url: url,
        category: category || 'Uncategorized',
        enabled: enabled
    });

    markChanged();
    updateStats();
    updateCategoryFilter();
    renderFeeds();
}

function editFeed(index, name, url, category, enabled) {
    feeds[index] = {
        name: name,
        url: url,
        category: category || 'Uncategorized',
        enabled: enabled
    };

    markChanged();
    updateStats();
    updateCategoryFilter();
    renderFeeds();
}

function deleteFeed(index) {
    if (!confirm(`Are you sure you want to delete "${feeds[index].name}"?`)) {
        return;
    }

    feeds.splice(index, 1);
    markChanged();
    updateStats();
    updateCategoryFilter();
    renderFeeds();
    closeEditModal();
}

// ==================== Stats ====================
function updateStats() {
    const enabled = feeds.filter(f => f.enabled !== false).length;
    const disabled = feeds.length - enabled;
    const categories = Object.keys(getCategories()).length;

    elements.totalFeeds.textContent = feeds.length;
    elements.enabledFeeds.textContent = enabled;
    elements.disabledFeeds.textContent = disabled;
    elements.categoryCount.textContent = categories;
}

// ==================== Change Tracking ====================
function markChanged() {
    hasChanges = true;
    updateSaveButton();
}

function updateSaveButton() {
    if (hasChanges) {
        elements.saveBtn.classList.add('btn-success');
        elements.saveBtn.disabled = false;
    } else {
        elements.saveBtn.classList.remove('btn-success');
    }
}

// ==================== Calendar Management ====================
function renderCalendars() {
    if (!elements.calendarsList) return;

    elements.calendarsList.innerHTML = '';

    if (calendars.length === 0) {
        elements.calendarsList.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📅</div>
                <h2>No calendars added</h2>
                <p>Click "Add Calendar" to connect your first calendar</p>
            </div>
        `;
        return;
    }

    calendars.forEach((calendar, index) => {
        const item = createCalendarItem(calendar, index);
        elements.calendarsList.appendChild(item);
    });
}

function createCalendarItem(calendar, index) {
    const item = document.createElement('div');
    item.className = 'feed-item' + (calendar.enabled === false ? ' disabled' : '');

    item.innerHTML = `
        <div class="feed-toggle ${calendar.enabled !== false ? 'active' : ''}" data-index="${index}"></div>
        <div class="feed-info">
            <div class="feed-name">${escapeHtml(calendar.name)}</div>
            <div class="feed-url">${escapeHtml(calendar.url)}</div>
        </div>
        <div class="feed-actions">
            <button class="icon-btn" data-action="edit" data-index="${index}" title="Edit calendar">
                ✏️
            </button>
        </div>
    `;

    // Toggle handler
    item.querySelector('.feed-toggle').addEventListener('click', () => {
        calendar.enabled = !calendar.enabled;
        markChanged();
        renderCalendars();
        updateCalendarStats();
    });

    // Edit handler
    item.querySelector('[data-action="edit"]').addEventListener('click', () => {
        openEditCalendarModal(index);
    });

    return item;
}

function updateCalendarStats() {
    if (!elements.totalCalendars) return;

    const enabled = calendars.filter(c => c.enabled !== false).length;
    elements.totalCalendars.textContent = calendars.length;
    elements.enabledCalendars.textContent = enabled;
}

function openAddCalendarModal() {
    elements.addCalendarForm.reset();
    elements.calendarEnabled.checked = true;
    elements.addCalendarModal.classList.remove('hidden');
}

function closeAddCalendarModal() {
    elements.addCalendarModal.classList.add('hidden');
}

function openEditCalendarModal(index) {
    const calendar = calendars[index];
    elements.editCalendarIndex.value = index;
    elements.editCalendarName.value = calendar.name;
    elements.editCalendarUrl.value = calendar.url;
    elements.editCalendarEnabled.checked = calendar.enabled !== false;
    elements.editCalendarModal.classList.remove('hidden');
}

function closeEditCalendarModal() {
    elements.editCalendarModal.classList.add('hidden');
}

function addCalendar(name, url, enabled) {
    calendars.push({
        name: name,
        url: url,
        enabled: enabled
    });

    markChanged();
    updateCalendarStats();
    renderCalendars();
}

function editCalendar(index, name, url, enabled) {
    calendars[index] = {
        name: name,
        url: url,
        enabled: enabled
    };

    markChanged();
    updateCalendarStats();
    renderCalendars();
}

function deleteCalendar(index) {
    if (!confirm(`Are you sure you want to delete "${calendars[index].name}"?`)) {
        return;
    }

    calendars.splice(index, 1);
    markChanged();
    updateCalendarStats();
    renderCalendars();
    closeEditCalendarModal();
}

// ==================== Tab Management ====================
function switchTab(tabName) {
    activeTab = tabName;

    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        if (btn.dataset.tab === tabName) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        if (content.id === tabName + 'Tab') {
            content.classList.add('active');
        } else {
            content.classList.remove('active');
        }
    });
}

// ==================== Utilities ====================
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ==================== Event Listeners ====================
function setupEventListeners() {
    // Theme toggle
    elements.themeToggle.addEventListener('click', toggleTheme);

    // Search
    elements.searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        renderFeeds();
    });

    // Add feed button
    elements.addFeedBtn.addEventListener('click', openAddModal);

    // Save button
    elements.saveBtn.addEventListener('click', saveConfig);

    // Category filter - "All" and "Uncategorized" buttons
    document.querySelectorAll('.category-chip[data-category]').forEach(chip => {
        chip.addEventListener('click', () => selectCategory(chip.dataset.category));
    });

    // Add feed form
    elements.addFeedForm.addEventListener('submit', (e) => {
        e.preventDefault();
        addFeed(
            elements.feedName.value,
            elements.feedUrl.value,
            elements.feedCategory.value,
            elements.feedEnabled.checked
        );
        closeAddModal();
    });

    // Edit feed form
    elements.editFeedForm.addEventListener('submit', (e) => {
        e.preventDefault();
        editFeed(
            parseInt(elements.editFeedIndex.value),
            elements.editFeedName.value,
            elements.editFeedUrl.value,
            elements.editFeedCategory.value,
            elements.editFeedEnabled.checked
        );
        closeEditModal();
    });

    // Delete feed
    elements.deleteFeedBtn.addEventListener('click', () => {
        deleteFeed(parseInt(elements.editFeedIndex.value));
    });

    // Modal close buttons
    document.querySelectorAll('.modal-close, .modal-cancel').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal');
            modal.classList.add('hidden');
        });
    });

    // Modal overlay clicks
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            e.target.closest('.modal').classList.add('hidden');
        });
    });

    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Calendar buttons
    if (elements.addCalendarBtn) {
        elements.addCalendarBtn.addEventListener('click', openAddCalendarModal);
    }

    // Add calendar form
    if (elements.addCalendarForm) {
        elements.addCalendarForm.addEventListener('submit', (e) => {
            e.preventDefault();
            addCalendar(
                elements.calendarName.value,
                elements.calendarUrl.value,
                elements.calendarEnabled.checked
            );
            closeAddCalendarModal();
        });
    }

    // Edit calendar form
    if (elements.editCalendarForm) {
        elements.editCalendarForm.addEventListener('submit', (e) => {
            e.preventDefault();
            editCalendar(
                parseInt(elements.editCalendarIndex.value),
                elements.editCalendarName.value,
                elements.editCalendarUrl.value,
                elements.editCalendarEnabled.checked
            );
            closeEditCalendarModal();
        });
    }

    // Delete calendar
    if (elements.deleteCalendarBtn) {
        elements.deleteCalendarBtn.addEventListener('click', () => {
            deleteCalendar(parseInt(elements.editCalendarIndex.value));
        });
    }

    // Warn before leaving with unsaved changes
    window.addEventListener('beforeunload', (e) => {
        if (hasChanges) {
            e.preventDefault();
            e.returnValue = '';
        }
    });
}

// ==================== Initialization ====================
function init() {
    initTheme();
    setupEventListeners();
    loadConfig();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
